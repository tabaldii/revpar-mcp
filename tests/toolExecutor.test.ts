import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { executeToolCall } from "../src/agent/toolExecutor";

function createClient(callTool: ReturnType<typeof vi.fn>): Client {
  return { callTool } as unknown as Client;
}

describe("MCP tool executor", () => {
  it("deve executar uma ferramenta e registrar sucesso", async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"ok":true}' }],
      isError: false,
    });

    const result = await executeToolCall({
      mcpClient: createClient(callTool),
      toolName: "get_market_intelligence",
      callId: "call_1",
      argumentsJson: '{"city":"Chapecó"}',
      requestId: "req_1",
    });

    expect(result.resultContent).toBe('{"ok":true}');
    expect(result.trace.status).toBe("success");
    expect(result.trace.attempts).toBe(1);
    expect(callTool).toHaveBeenCalledOnce();
  });

  it("deve rejeitar argumentos que não são um objeto JSON", async () => {
    const callTool = vi.fn();

    const result = await executeToolCall({
      mcpClient: createClient(callTool),
      toolName: "get_market_intelligence",
      callId: "call_2",
      argumentsJson: "[]",
      requestId: "req_2",
    });

    expect(result.trace.status).toBe("error");
    expect(result.trace.errorCode).toBe("INVALID_TOOL_ARGUMENTS");
    expect(callTool).not.toHaveBeenCalled();
  });

  it("deve tentar novamente quando uma ferramenta retorna erro", async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "falha" }],
      isError: true,
    });

    const result = await executeToolCall({
      mcpClient: createClient(callTool),
      toolName: "get_local_events",
      callId: "call_3",
      argumentsJson: '{"city":"Chapecó","month":"12"}',
      requestId: "req_3",
    });

    expect(result.trace.status).toBe("error");
    expect(result.trace.errorCode).toBe("TOOL_RESPONSE_ERROR");
    expect(result.trace.attempts).toBe(2);
    expect(callTool).toHaveBeenCalledTimes(2);
  });
});
