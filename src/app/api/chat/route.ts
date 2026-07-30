import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getAgentForSession,
  getClientIdentifier,
  getOrCreateSessionId,
  MAX_MESSAGE_LENGTH,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "@/lib/security";
import { createRequestContext, createRequestId } from "@/agent/requestContext";
import { getRecommendationHistoryRepository } from "@/agent/historyRepository";

export async function POST(req: Request) {
  const requestId = createRequestId(req.headers.get("x-request-id"));

  try {
    const rateLimit = checkRateLimit(getClientIdentifier(req));
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Limite de requisições atingido. Tente novamente em instantes." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
            "X-Request-Id": requestId,
          },
        }
      );
    }

    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "O campo 'message' é obrigatório e deve ser uma string." },
        { status: 400, headers: { "X-Request-Id": requestId } }
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          error: `A mensagem deve ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.`,
        },
        { status: 413, headers: { "X-Request-Id": requestId } }
      );
    }

    const { sessionId, isNew } = getOrCreateSessionId(req.headers.get("cookie"));
    const agent = await getAgentForSession(sessionId);
    const agentResponse = await agent.run(
      message,
      createRequestContext(requestId, sessionId)
    );

    getRecommendationHistoryRepository().save({
      sessionId,
      requestId,
      prompt: message,
      response: agentResponse.content,
      metrics: agentResponse.updatedMetrics,
      executedTools: agentResponse.executedTools,
    });

    const response = NextResponse.json({
      response: agentResponse.content,
      metrics: agentResponse.updatedMetrics,
      executedTools: agentResponse.executedTools,
      sources: agentResponse.sources,
      assumptions: agentResponse.assumptions,
      confidence: agentResponse.confidence,
      validationErrors: agentResponse.validationErrors,
      requestId: agentResponse.requestId,
      durationMs: agentResponse.durationMs,
      toolTrace: agentResponse.toolTrace,
    });

    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Request-Id", requestId);

    if (isNew) {
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: sessionId,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_TTL_MS / 1000,
        path: "/",
      });
    }

    return response;
  } catch (error: any) {
    console.error("[API Error /api/chat]:", error);

    return NextResponse.json(
      { error: "Falha interna ao processar consulta de Yield Management." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Request-Id": requestId,
        },
      }
    );
  }
}
