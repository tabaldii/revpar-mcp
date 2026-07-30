import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST } from "../src/app/api/chat/route";

describe("POST /api/chat", () => {
  it("deve rejeitar payload sem message e devolver requestId", async () => {
    const requestId = "req_route_validation";
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": requestId,
          "x-forwarded-for": `198.51.100.${randomUUID()}`,
        },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("X-Request-Id")).toBe(requestId);
    await expect(response.json()).resolves.toEqual({
      error: "O campo 'message' é obrigatório e deve ser uma string.",
    });
  });

  it("deve rejeitar mensagens acima do limite sem chamar o agente", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `203.0.113.${randomUUID()}`,
        },
        body: JSON.stringify({ message: "x".repeat(1_001) }),
      })
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "A mensagem deve ter no máximo 1000 caracteres.",
    });
  });
});
