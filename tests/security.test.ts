import { describe, expect, it } from "vitest";
import {
  RATE_LIMIT_MAX_REQUESTS,
  checkRateLimit,
  getClientIdentifier,
  getOrCreateSessionId,
} from "../src/lib/security";

describe("Security controls", () => {
  it("deve criar uma sessão quando o cookie não existe", () => {
    const result = getOrCreateSessionId(null);

    expect(result.isNew).toBe(true);
    expect(result.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("deve reutilizar uma sessão válida do cookie", () => {
    const sessionId = "123e4567-e89b-12d3-a456-426614174000";
    const result = getOrCreateSessionId(`other=value; revpar_session_id=${sessionId}`);

    expect(result.isNew).toBe(false);
    expect(result.sessionId).toBe(sessionId);
  });

  it("deve bloquear novas requisições após o limite da janela", () => {
    const identifier = `test-ip-${crypto.randomUUID()}`;

    for (let request = 0; request < RATE_LIMIT_MAX_REQUESTS; request += 1) {
      expect(checkRateLimit(identifier).allowed).toBe(true);
    }

    const blocked = checkRateLimit(identifier);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("deve priorizar o primeiro IP encaminhado pela plataforma", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "x-real-ip": "198.51.100.1",
      },
    });

    expect(getClientIdentifier(request)).toBe("203.0.113.10");
  });
});
