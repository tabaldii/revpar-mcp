import { describe, expect, it } from "vitest";
import {
  LocalEventSchema,
  MarketMetricSchema,
  PricingRecommendationSchema,
  PropertySchema,
  ToolExecutionSchema,
} from "../src/domain/entities";

describe("domain entities", () => {
  it("valida uma propriedade e uma métrica de mercado", () => {
    expect(
      PropertySchema.safeParse({
        id: "property_1",
        city: "chapeco",
        neighborhood: "centro",
        propertyType: "1br",
        active: true,
      }).success
    ).toBe(true);

    expect(
      MarketMetricSchema.safeParse({
        city: "chapeco",
        neighborhood: "centro",
        propertyType: "1br",
        month: "12",
        airbnbAdr: 351,
        hotelAdr: 392,
        occupancyRate: 80,
        activeListings: 850,
      }).success
    ).toBe(true);
  });

  it("rejeita evento com estadia mínima inválida", () => {
    expect(
      LocalEventSchema.safeParse({
        id: "event_1",
        name: "Evento",
        city: "chapeco",
        month: "10",
        demandMultiplier: 1.5,
        minStayDays: 0,
      }).success
    ).toBe(false);
  });

  it("valida recomendação e execução de ferramenta", () => {
    expect(
      PricingRecommendationSchema.safeParse({
        requestId: "request_1",
        sessionId: "session_1",
        suggestedAdr: 349,
        revPar: 279,
        occupancyRate: 80,
        minStayDays: 1,
        confidence: "high",
        sources: ["get_market_intelligence"],
        assumptions: [],
      }).success
    ).toBe(true);

    expect(
      ToolExecutionSchema.safeParse({
        toolName: "get_market_intelligence",
        callId: "call_1",
        status: "success",
        durationMs: 12,
        attempts: 1,
      }).success
    ).toBe(true);
  });
});
