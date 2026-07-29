import { describe, it, expect, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { setupMcpClient } from "../src/agent/openaiAdapter.js";

describe("MCP Tools v2 (Revenue Management Engine)", () => {
  let mcpClient: Client;

  beforeEach(async () => {
    mcpClient = await setupMcpClient();
  });

  function getTextContent(result: unknown): string {
    if (result && typeof result === "object") {
      const record = result as Record<string, unknown>;
      const content = Array.isArray(record.content) ? record.content : [];
      const firstContent = content[0];

      if (firstContent && typeof firstContent === "object" && "text" in firstContent && typeof firstContent.text === "string") {
        return firstContent.text;
      }
    }

    throw new Error("Conteúdo de resposta inesperado do MCP");
  }

  // Teste 1: Bairro nobre (Jurerê) x Bairro tradicional (Centro)
  it("deve aplicar precificação diferenciada para Jurerê x Centro em Florianópolis", async () => {
    const jurereResult = await mcpClient.callTool({
      name: "get_market_intelligence",
      arguments: {
        city: "Florianopolis",
        neighborhood: "Jurere",
        propertyType: "luxury",
        month: "12",
      },
    });

    const centroResult = await mcpClient.callTool({
      name: "get_market_intelligence",
      arguments: {
        city: "Florianopolis",
        neighborhood: "Centro",
        propertyType: "studio",
        month: "12",
      },
    });

    const jurereData = JSON.parse(getTextContent(jurereResult)) as Record<string, unknown>;
    const centroData = JSON.parse(getTextContent(centroResult)) as Record<string, unknown>;

    // Luxo em Jurerê deve ser significativamente mais caro que Studio no Centro
    const jurereAdr = Number(jurereData.airbnbAdr);
    const centroAdr = Number(centroData.airbnbAdr);

    expect(jurereAdr).toBeGreaterThan(centroAdr);
    expect(String(jurereData.propertyType)).toBe("luxury");
    expect(String(centroData.propertyType)).toBe("studio");
  });

  // Teste 2: Busca de eventos locais (Réveillon em Floripa)
  it("deve retornar o evento de Réveillon para Florianópolis em Dezembro", async () => {
    const result = await mcpClient.callTool({
      name: "get_local_events",
      arguments: { city: "Florianopolis", month: "12" },
    });

    const data = JSON.parse(getTextContent(result)) as Record<string, unknown>;
    const events = Array.isArray(data.events) ? data.events : [];

    expect(data.hasEvents).toBe(true);
    expect(events[0] && typeof events[0] === "object" && "id" in events[0] ? String(events[0].id) : "").toBe("reveillon-floripa");
    expect(Number((events[0] && typeof events[0] === "object" && "demandMultiplier" in events[0] ? events[0].demandMultiplier : 0))).toBe(1.6);
    expect(Number((events[0] && typeof events[0] === "object" && "minStayDays" in events[0] ? events[0].minStayDays : 0))).toBe(4);
  });

  // Teste 3: Algoritmo Yield v2 com Evento + Antecedência (Early Bird)
  it("deve calcular tarifa premium para alta demanda de evento com reserva antecipada", async () => {
    const result = await mcpClient.callTool({
      name: "calculate_dynamic_pricing_v2",
      arguments: {
        baseAirbnbAdr: 950,
        baseHotelAdr: 880,
        targetOccupancy: 90,
        eventDemandMultiplier: 1.6, // +60% Réveillon
        eventMinStayDays: 4,
        leadTimeDays: 70,           // Early Bird (+10%)
      },
    });

    const data = JSON.parse(getTextContent(result)) as Record<string, unknown>;
    const factorsApplied = data.factorsApplied && typeof data.factorsApplied === "object" ? (data.factorsApplied as Record<string, unknown>) : {};

    expect(Number(data.suggestedAdr)).toBeGreaterThan(1000);
    expect(Number(data.suggestedMinStayDays)).toBe(4);
    expect(String(factorsApplied.leadTimeStrategy)).toContain("Early Bird Premium");
  });
});