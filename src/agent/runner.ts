import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getOpenAIToolsFromMCP } from "./openaiAdapter";

export interface MarketMetrics {
  city?: string;
  neighborhood?: string;
  suggestedAdr?: number;
  airbnbBaseAdr?: number;
  hotelBaseAdr?: number;
  revPar?: number;
  occupancyRate?: number;
  minStayDays?: number;
  eventName?: string;
}

export interface AgentRunResult {
  content: string;
  executedTools: string[];
  updatedMetrics?: MarketMetrics;
}

/**
 * Função auxiliar para buscar valores no JSON de forma flexível,
 * ignorando diferenças de case (camelCase vs snake_case) e variações de nomes.
 */
function extractValue(obj: any, candidateKeys: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;
  
  const objectKeys = Object.keys(obj);
  for (const candidate of candidateKeys) {
    const normalizedCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const key of objectKeys) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalizedKey === normalizedCandidate && obj[key] !== undefined && obj[key] !== null) {
        return obj[key];
      }
    }
  }
  return undefined;
}

/**
 * Agente orquestrador de Revenue Management responsável por gerenciar a conversação
 * e coordenar a execução de ferramentas via MCP / OpenAI Function Calling.
 */
export class RevParAgent {
  private openai: OpenAI;
  private mcpClient: Client;
  private history: OpenAI.Chat.Completions.ChatCompletionMessageParam[];

  constructor(mcpClient: Client) {
    this.openai = new OpenAI();
    this.mcpClient = mcpClient;

    this.history = [
      {
        role: "system",
        content: `Você é o RevPar Intel Agent, um especialista em Revenue Management e precificação dinâmica para aluguel por temporada e hotelaria.

Diretrizes Operacionais:
1. Sempre consulte as ferramentas MCP ('get_market_intelligence', 'get_local_events', 'calculate_dynamic_pricing_v2') antes de emitir recomendações tarifárias.
2. É estritamente proibido inferir ou inventar tarifas (ADR) e taxas de ocupação sem respaldo das ferramentas.
3. Considere sempre o impacto de eventos locais e estadias mínimas (LOS) ao formular estratégias de Yield.
4. Mantenha o contexto e histórico de interações anteriores para análises incrementais.`,
      },
    ];
  }

  /**
   * Processa uma mensagem do usuário resolvendo recursivamente as chamadas de ferramentas requeridas.
   */
  async run(userPrompt: string): Promise<AgentRunResult> {
    const tools = await getOpenAIToolsFromMCP(this.mcpClient);
    const usedToolNames: string[] = [];
    let latestCalculatedMetrics: MarketMetrics | undefined = undefined;

    this.history.push({
      role: "user",
      content: userPrompt,
    });

    let response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: this.history,
      tools,
      tool_choice: "auto",
    });

    let responseMessage = response.choices[0].message;

    // Resolução recursiva de chamadas de ferramentas MCP
    while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      this.history.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.type !== "function") {
          console.warn(`[MCP] Tool call não suportado: ${toolCall.type}`);
          continue;
        }

        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        if (!usedToolNames.includes(functionName)) {
          usedToolNames.push(functionName);
        }

        const toolResult = await this.mcpClient.callTool({
          name: functionName,
          arguments: functionArgs,
        });

        let resultContent = "";
        if (Array.isArray(toolResult.content) && toolResult.content[0]?.type === "text") {
          resultContent = toolResult.content[0].text;
        } else {
          resultContent = JSON.stringify(toolResult.content);
        }

        // ⚡ CAPTURA E ACÚMULO ULTRA-RESILIENTE DE MÉTRICAS
        try {
          const parsedData = JSON.parse(resultContent);
          if (parsedData && typeof parsedData === "object") {
            const current: MarketMetrics = latestCalculatedMetrics || {};

            // Extração flexível de campos com múltiplos alias
            const city = extractValue(parsedData, ["city", "location", "cidade"]) ?? current.city;
            const neighborhood = extractValue(parsedData, ["neighborhood", "district", "bairro"]) ?? current.neighborhood;
            
            const suggestedAdr = Number(
              extractValue(parsedData, ["suggestedAdr", "suggested_adr", "adr", "recommendedAdr", "recommended_adr", "price", "diaria"])
            ) || current.suggestedAdr || 0;

            const airbnbBaseAdr = Number(
              extractValue(parsedData, ["airbnbBaseAdr", "airbnb_base_adr", "airbnbAvg", "airbnb_avg", "airbnbAdr", "avgAirbnb"])
            ) || current.airbnbBaseAdr || 0;

            const hotelBaseAdr = Number(
              extractValue(parsedData, ["hotelBaseAdr", "hotel_base_adr", "hotelAvg", "hotel_avg", "hotelAdr", "avgHotel"])
            ) || current.hotelBaseAdr || 0;

            const occupancyRate = Number(
              extractValue(parsedData, ["occupancyRate", "occupancy_rate", "occupancy", "targetOccupancy", "target_occupancy", "ocupacao"])
            ) || current.occupancyRate || 0;

            const minStayDays = Number(
              extractValue(parsedData, [
                "minStayDays", "min_stay_days", "minStay", "min_stay", 
                "minimumStay", "minimum_stay", "minNights", "min_nights", "los",
                "suggestedMinStayDays", "suggested_min_stay_days",
                "recommendedMinStayDays", "recommended_min_stay_days"
              ])
            ) || current.minStayDays || 0;

            // Extração ou Cálculo Automático do RevPAR
            let revPar = Number(
              extractValue(parsedData, ["revPar", "rev_par", "revpar", "calculatedRevPar", "estimatedRevPar"])
            );

            // Fallback: Se o RevPAR não veio na tool, calcula via (ADR * Taxa de Ocupação)
            if ((!revPar || isNaN(revPar)) && suggestedAdr > 0 && occupancyRate > 0) {
              const occRatio = occupancyRate > 1 ? occupancyRate / 100 : occupancyRate;
              revPar = Math.round(suggestedAdr * occRatio);
            } else if (!revPar || isNaN(revPar)) {
              revPar = current.revPar || 0;
            }

            // Tratamento flexível de eventos
            let extractedEvent = extractValue(parsedData, ["eventName", "event_name", "event"]);
            if (!extractedEvent && Array.isArray(parsedData.events)) {
              extractedEvent = parsedData.events.length > 0
                ? (parsedData.events[0].name || parsedData.events[0].title || parsedData.events[0].description)
                : "Nenhum evento relevante no período";
            }

            latestCalculatedMetrics = {
              city,
              neighborhood,
              suggestedAdr,
              airbnbBaseAdr,
              hotelBaseAdr,
              revPar,
              occupancyRate,
              minStayDays,
              eventName: extractedEvent ?? current.eventName,
            };
          }
        } catch {
          // Trata retornos em formato de texto simples
        }

        this.history.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: resultContent,
        });
      }

      response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: this.history,
        tools,
      });

      responseMessage = response.choices[0].message;
    }

    const finalAnswer = responseMessage.content || "Não foi possível gerar uma resposta válida.";

    this.history.push({
      role: "assistant",
      content: finalAnswer,
    });

    return {
      content: finalAnswer,
      executedTools: usedToolNames,
      updatedMetrics: latestCalculatedMetrics,
    };
  }
}
