/**
 * Adaptador de integração entre o ecossistema MCP (Model Context Protocol) e a API da OpenAI.
 * Mapeia schemas JSON de ferramentas do MCP para o formato nativo de Function Calling do GPT.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import OpenAI from "openai";
import { registerTools } from "@/mcp/tools";

/**
 * Inicializa o servidor MCP em memória e conecta o cliente MCP via transporte interno.
 */
export async function setupMcpClient(): Promise<Client> {
  const server = new McpServer({
    name: "RevPar-Yield-Server",
    version: "2.0.0",
  });

  registerTools(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client(
    { name: "RevPar-Agent-Client", version: "2.0.0" },
    { capabilities: {} }
  );

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return client;
}

/**
 * Converte a lista de ferramentas declaradas no servidor MCP em objetos
 * compatíveis com a especificação `tools` da API Chat Completions da OpenAI.
 *
 * @param mcpClient Instância do cliente MCP conectado
 * @returns Array de ferramentas no formato OpenAI.ChatCompletionTool
 */
export async function getOpenAIToolsFromMCP(
  mcpClient: Client
): Promise<OpenAI.ChatCompletionTool[]> {
  const { tools } = await mcpClient.listTools();

  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as Record<string, unknown>,
    },
  }));
}
