import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools.js";

/**
 * Cria e configura a instância do Servidor MCP
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "revpar-mcp",
    version: "1.0.0",
  });

  // 1. Registra as ferramentas (Tools)
  registerTools(server);

  // 2. Registra um Recurso (Resource) estático com a política da empresa/sistema
  server.resource(
    "pricing-policy",
    "revpar://policies/pricing",
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: `
# Diretrizes de Precificação e RevPAR

1. **Prioridade de Margem em Alta Temporada:** Durante os meses de alta demanda (12, 01, 02), a diária sugerida nunca deve ser inferior à média hoteleira da região.
2. **Piso de Preço:** Nenhuma tarifa pode ser sugerida abaixo de R$ 150/noite para cobrir custos operacionais e de limpeza.
3. **Foco no RevPAR:** O objetivo final das recomendações deve ser otimizar a receita por quarto disponível (RevPAR = ADR * Taxa de Ocupação), e não apenas lotar o imóvel com tarifas baixas.
          `.trim(),
        },
      ],
    })
  );

  return server;
}