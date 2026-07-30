import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { RevParAgent } from "@/agent/runner";
import { setupMcpClient } from "@/agent/openaiAdapter";

export const SESSION_COOKIE_NAME = "revpar_session_id";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 10;
export const MAX_MESSAGE_LENGTH = 1_000;

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

interface SessionEntry {
  agent: RevParAgent;
  lastAccessAt: number;
}

interface RuntimeState {
  mcpClientPromise?: Promise<Client>;
  sessions: Map<string, SessionEntry>;
  rateLimits: Map<string, RateLimitEntry>;
}

const globalForSecurity = globalThis as typeof globalThis & {
  revparRuntimeState?: RuntimeState;
};

const runtimeState: RuntimeState =
  globalForSecurity.revparRuntimeState ?? {
    sessions: new Map(),
    rateLimits: new Map(),
  };

globalForSecurity.revparRuntimeState = runtimeState;

export function getOrCreateSessionId(cookieHeader: string | null): {
  sessionId: string;
  isNew: boolean;
} {
  const sessionId = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  if (sessionId && /^[0-9a-f-]{36}$/i.test(sessionId)) {
    return { sessionId, isNew: false };
  }

  return { sessionId: randomUUID(), isNew: true };
}

export function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  return forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
}

export function checkRateLimit(identifier: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const current = runtimeState.rateLimits.get(identifier);

  if (!current || now - current.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    runtimeState.rateLimits.set(identifier, {
      count: 1,
      windowStartedAt: now,
    });
    cleanupRateLimits(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(
        (RATE_LIMIT_WINDOW_MS - (now - current.windowStartedAt)) / 1000
      ),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function getAgentForSession(sessionId: string): Promise<RevParAgent> {
  const now = Date.now();
  const existing = runtimeState.sessions.get(sessionId);

  if (existing && now - existing.lastAccessAt < SESSION_TTL_MS) {
    existing.lastAccessAt = now;
    return existing.agent;
  }

  runtimeState.mcpClientPromise ??= setupMcpClient();
  const mcpClient = await runtimeState.mcpClientPromise;
  const agent = new RevParAgent(mcpClient);

  runtimeState.sessions.set(sessionId, { agent, lastAccessAt: now });
  cleanupSessions(now);

  return agent;
}

function cleanupRateLimits(now: number): void {
  for (const [key, entry] of runtimeState.rateLimits) {
    if (now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
      runtimeState.rateLimits.delete(key);
    }
  }
}

function cleanupSessions(now: number): void {
  for (const [key, entry] of runtimeState.sessions) {
    if (now - entry.lastAccessAt >= SESSION_TTL_MS) {
      runtimeState.sessions.delete(key);
    }
  }
}
