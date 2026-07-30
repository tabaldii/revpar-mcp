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

  it("deve expor resources MCP de política e glossário", async () => {
    const { resources } = await mcpClient.listResources();
    const resourceUris = resources.map((resource) => resource.uri);

    expect(resourceUris).toContain("revpar://policies/pricing");
    expect(resourceUris).toContain("revpar://policies/occupancy");
    expect(resourceUris).toContain("revpar://glossary/revenue-management");

    const policy = await mcpClient.readResource({
      uri: "revpar://policies/occupancy",
    });

    expect(policy.contents[0]).toMatchObject({
      uri: "revpar://policies/occupancy",
    });
  });

  it("deve disponibilizar prompts MCP parametrizados", async () => {
    const { prompts } = await mcpClient.listPrompts();
    const promptNames = prompts.map((prompt) => prompt.name);

    expect(promptNames).toContain("high-season-analysis");
    expect(promptNames).toContain("explain-pricing-decision");

    const prompt = await mcpClient.getPrompt({
      name: "high-season-analysis",
      arguments: {
        city: "Chapecó",
        month: "12",
        propertyType: "1br",
      },
    });

    expect(prompt.messages[0]?.content).toMatchObject({ type: "text" });
    expect(JSON.stringify(prompt.messages[0])).toContain("Chapecó");
  });
});
