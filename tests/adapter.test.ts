import { describe, it, expect, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { setupMcpClient, getOpenAIToolsFromMCP } from "../src/agent/openaiAdapter.js";

describe("OpenAI Adapter v2", () => {
  let mcpClient: Client;

  beforeEach(async () => {
    mcpClient = await setupMcpClient();
  });

  it("deve mapear corretamente as novas ferramentas do MCP para a OpenAI", async () => {
    const openAiTools = await getOpenAIToolsFromMCP(mcpClient);

    expect(openAiTools.length).toBe(3);

    const functionTools = openAiTools.filter(
      (tool): tool is Extract<(typeof openAiTools)[number], { type: "function" }> => tool.type === "function"
    );

    const toolNames = functionTools.map((tool) => tool.function.name);
    expect(toolNames).toContain("get_market_intelligence");
    expect(toolNames).toContain("get_local_events");
    expect(toolNames).toContain("calculate_dynamic_pricing_v2");
  });
});