import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerTools } from "./tools";
import { createMarketDataRepository, MarketDataRepository } from "./repository";

/**
 * Registra a superfície MCP completa do projeto: tools, resources e prompts.
 */
export function configureMcpServer(
  server: McpServer,
  repository: MarketDataRepository = createMarketDataRepository()
): void {
  registerTools(server, repository);

  server.resource(
    "pricing-policy",
    "revpar://policies/pricing",
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: `
# Diretrizes de Precificação e RevPAR

1. **Prioridade de margem em alta temporada:** durante os meses de alta demanda (12, 01, 02), a diária sugerida nunca deve ser inferior à média hoteleira da região.
2. **Piso de preço:** nenhuma tarifa pode ser sugerida abaixo de R$ 150 por noite.
3. **Foco no RevPAR:** o objetivo é otimizar a receita por quarto disponível (RevPAR = ADR × taxa de ocupação), não apenas reduzir preço para aumentar ocupação.
          `.trim(),
        },
      ],
    })
  );

  server.resource(
    "occupancy-policy",
    "revpar://policies/occupancy",
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: `
# Política de Ocupação

- Ocupação é representada em percentual de 0 a 100.
- RevPAR deve ser calculado como ADR multiplicada pela ocupação em formato decimal.
- Metas acima de 85% podem justificar ajuste positivo de preço quando houver suporte dos dados de mercado.
- A meta de ocupação não substitui a consulta de dados reais ou mockados de mercado.
          `.trim(),
        },
      ],
    })
  );

  server.resource(
    "revenue-glossary",
    "revpar://glossary/revenue-management",
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: `
# Glossário de Revenue Management

- **ADR:** Average Daily Rate, ou diária média.
- **RevPAR:** Revenue per Available Room, receita por quarto disponível.
- **LOS:** Length of Stay, duração mínima ou recomendada da estadia.
- **Lead time:** antecedência entre a reserva e a data de hospedagem.
- **Multiplicador de demanda:** fator aplicado ao preço base em cenários como eventos locais.
          `.trim(),
        },
      ],
    })
  );

  server.prompt(
    "high-season-analysis",
    "Gera um roteiro de análise para precificação em alta temporada.",
    {
      city: z.string().describe("Cidade da análise"),
      month: z.string().describe("Mês numérico da análise"),
      propertyType: z
        .enum(["studio", "1br", "2br", "luxury"])
        .default("1br")
        .describe("Tipologia do imóvel"),
    },
    ({ city, month, propertyType }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analise a precificação de um imóvel ${propertyType} em ${city} durante o mês ${month}. Consulte inteligência de mercado e eventos locais antes de calcular ADR, RevPAR e LOS. Não invente métricas e informe todas as premissas utilizadas.`,
          },
        },
      ],
    })
  );

  server.prompt(
    "explain-pricing-decision",
    "Gera um roteiro para explicar uma recomendação tarifária baseada em dados.",
    {
      city: z.string().describe("Cidade da recomendação"),
      suggestedAdr: z.string().describe("ADR sugerida já calculada"),
      revPar: z.string().describe("RevPAR já calculado"),
    },
    ({ city, suggestedAdr, revPar }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Explique de forma objetiva a recomendação para ${city}. A ADR calculada foi ${suggestedAdr} e o RevPAR foi ${revPar}. Diferencie dados observados, regras determinísticas e premissas. Não crie novos valores.`,
          },
        },
      ],
    })
  );
}

/** Cria e configura uma instância completa do servidor MCP. */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "revpar-mcp",
    version: "1.0.0",
  });

  configureMcpServer(server);
  return server;
}
