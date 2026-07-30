import { randomUUID } from "node:crypto";

export interface RequestContext {
  requestId: string;
  sessionId?: string;
  startedAt: number;
}

export function createRequestId(candidate?: string | null): string {
  if (candidate && /^[a-zA-Z0-9._:-]{1,100}$/.test(candidate)) {
    return candidate;
  }

  return `req_${randomUUID()}`;
}

export function createRequestContext(
  requestId?: string,
  sessionId?: string
): RequestContext {
  return {
    requestId: requestId || createRequestId(),
    sessionId,
    startedAt: Date.now(),
  };
}
