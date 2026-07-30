import { describe, expect, it } from "vitest";
import {
  RecommendationResponseSchema,
  validateMarketMetrics,
} from "../src/agent/recommendationValidator";

const validMetrics = {
  city: "chapeco",
  neighborhood: "centro",
  suggestedAdr: 349,
  airbnbBaseAdr: 351,
  hotelBaseAdr: 392,
  revPar: 279,
  occupancyRate: 80,
  minStayDays: 1,
  eventName: "Nenhum evento relevante no período",
};

describe("Recommendation validation", () => {
  it("deve aceitar métricas completas e coerentes", () => {
    const result = validateMarketMetrics(validMetrics);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.metrics).toEqual(validMetrics);
  });

  it("deve rejeitar uma recomendação sem métricas suficientes", () => {
    const result = validateMarketMetrics(undefined);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("deve rejeitar RevPAR maior que a ADR sugerida", () => {
    const result = validateMarketMetrics({
      ...validMetrics,
      revPar: 400,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("RevPAR não pode ser maior que a ADR sugerida.");
  });

  it("deve validar o contrato estruturado da resposta", () => {
    const result = RecommendationResponseSchema.safeParse({
      content: "Recomendação calculada com dados de mercado.",
      metrics: validMetrics,
      sources: ["get_market_intelligence", "calculate_dynamic_pricing_v2"],
      assumptions: ["Bairro Centro utilizado porque não foi informado."],
      confidence: "high",
      validationErrors: [],
      requestId: "req_test",
      durationMs: 120,
      toolTrace: [
        {
          toolName: "get_market_intelligence",
          callId: "call_test",
          status: "success",
          durationMs: 40,
          attempts: 1,
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
