/**
 * Definição e registro das ferramentas MCP (Model Context Protocol).
 * Expõe algoritmos determinísticos de Revenue Management para uso pelo Agente LLM.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PropertyType } from "@/mcp/mockData";
import {
  createMarketDataRepository,
  MarketDataRepository,
} from "@/mcp/repository";

/**
 * Registra todas as ferramentas de precificação e dados no servidor MCP fornecido.
 */
export function registerTools(
  server: McpServer,
  repository: MarketDataRepository = createMarketDataRepository()
): void {

  /**
   * Ferramenta de Inteligência de Mercado
   * Fornece métricas históricas de ADR e ocupação por localização e tipologia.
   */
  server.tool(
    "get_market_intelligence",
    "Consulta métricas detalhadas de mercado (Airbnb e Hotéis) considerando cidade, bairro, mês e tipologia do imóvel. Quando o bairro não for informado, utiliza Centro. Quando o imóvel for descrito como simples, padrão ou comum, utiliza a tipologia 1br.",
    {
      city: z.string().describe("Nome da cidade"),
      neighborhood: z
        .string()
        .optional()
        .describe("Bairro ou micro-região. Use Centro quando não informado."),
      propertyType: z
        .enum(["studio", "1br", "2br", "luxury"])
        .optional()
        .describe("Tipologia do imóvel. Para imóvel simples, padrão ou comum, use 1br."),
      month: z
        .string()
        .regex(/^(0?[1-9]|1[0-2])$/)
        .describe("Mês numérico de consulta ('01' a '12')"),
    },
    async ({ city, neighborhood, propertyType, month }) => {
      const resolvedNeighborhood = neighborhood?.trim() || "centro";
      const resolvedPropertyType = propertyType || "1br";
      const assumptions: string[] = [];

      if (!neighborhood?.trim()) {
        assumptions.push("Bairro Centro utilizado porque não foi informado.");
      }

      if (!propertyType) {
        assumptions.push("Tipologia 1br utilizada para representar um imóvel simples.");
      }

      const data = repository.getAdvancedMarketData(
        city,
        resolvedNeighborhood,
        resolvedPropertyType as PropertyType,
        month
      );

      if (!data) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Dados de mercado indisponíveis para ${city}/${resolvedNeighborhood} (${resolvedPropertyType}).`,
                assumptions,
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ...data, assumptions }),
          },
        ],
      };
    }
  );

  /**
   * Ferramenta de Mapeamento de Eventos
   * Identifica picos de demanda pontuais e restrições de estadia mínima (LOS).
   */
  server.tool(
    "get_local_events",
    "Busca eventos de grande porte ou datas comemorativas na cidade/mês que alteram a curva de demanda.",
    {
      city: z.string().describe("Nome da cidade"),
      month: z.string().regex(/^(0?[1-9]|1[0-2])$/).describe("Mês numérico ('01' a '12')"),
    },
    async ({ city, month }) => {
      const events = repository.getEventsByCityAndMonth(city, month);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              city,
              month,
              hasEvents: events.length > 0,
              events,
            }),
          },
        ],
      };
    }
  );

  /**
   * Motor Principal de Yield Management (Dynamic Pricing v2)
   * Calcula a diária ótima com base na ponderação STR/Hotelaria, janela de reserva (Lead Time) e ocupação-alvo.
   */
  server.tool(
    "calculate_dynamic_pricing_v2",
    "Calcula a tarifa ideal por diária, sugestão de estadia mínima (LOS) e estimativa de RevPAR.",
    {
      baseAirbnbAdr: z.number().positive().describe("ADR base de aluguel por temporada"),
      baseHotelAdr: z.number().positive().describe("ADR base do setor hoteleiro"),
      targetOccupancy: z.number().min(1).max(100).describe("Meta de taxa de ocupação (%)"),
      eventDemandMultiplier: z.number().default(1.0).describe("Multiplicador de demanda por eventos"),
      eventMinStayDays: z.number().default(1).describe("Estadia mínima recomendada"),
      leadTimeDays: z.number().default(30).describe("Dias de antecedência da reserva (Lead Time)"),
    },
    async ({
      baseAirbnbAdr,
      baseHotelAdr,
      targetOccupancy,
      eventDemandMultiplier,
      eventMinStayDays,
      leadTimeDays,
    }) => {
      // Ponderação do mercado: 60% peso STR (Airbnb) + 40% peso Hoteleiro tradicional
      const marketBase = baseAirbnbAdr * 0.6 + baseHotelAdr * 0.4;

      // Estratégia de Lead Time (Estratégia de Janela de Reserva):
      // - Last Minute (<= 3 dias): Desconto de 10% para acelerar conversão de estoque ocioso
      // - Early Bird (>= 60 dias): Ágio de 10% para capturar alta disponibilidade futura
      let leadTimeMultiplier = 1.0;
      if (leadTimeDays <= 3) leadTimeMultiplier = 0.9;
      else if (leadTimeDays >= 60) leadTimeMultiplier = 1.1;

      // Ajuste de Yield baseado no objetivo de ocupação
      const occupancyMultiplier = targetOccupancy > 85 ? 1.15 : 0.95;

      const suggestedAdr = Math.round(
        marketBase * eventDemandMultiplier * leadTimeMultiplier * occupancyMultiplier
      );

      // Piso tarifário de segurança operacional (mínimo de R$ 150/noite)
      const finalAdr = Math.max(150, suggestedAdr);
      const estimatedRevPar = Math.round(finalAdr * (targetOccupancy / 100));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              suggestedAdr: finalAdr,
              estimatedRevPar,
              suggestedMinStayDays: Math.max(1, eventMinStayDays),
              currency: "BRL",
              factorsApplied: {
                eventImpact: `${((eventDemandMultiplier - 1) * 100).toFixed(0)}%`,
                leadTimeStrategy:
                  leadTimeDays <= 3
                    ? "Desconto Last-Minute (-10%)"
                    : leadTimeDays >= 60
                    ? "Early Bird Premium (+10%)"
                    : "Janela Padrão",
              },
            }),
          },
        ],
      };
    }
  );
}
