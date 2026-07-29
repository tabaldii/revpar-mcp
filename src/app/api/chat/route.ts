import { NextResponse } from "next/server";
import { setupMcpClient } from "@/agent/openaiAdapter";
import { RevParAgent } from "@/agent/runner";

// Instância singleton mantida no runtime Node.js
const globalForAgent = globalThis as unknown as {
  mcpAgentInstance: RevParAgent | undefined;
};

async function getAgentInstance(): Promise<RevParAgent> {
  if (!globalForAgent.mcpAgentInstance) {
    const mcpClient = await setupMcpClient();
    globalForAgent.mcpAgentInstance = new RevParAgent(mcpClient);
  }
  return globalForAgent.mcpAgentInstance;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "O campo 'message' é obrigatório e deve ser uma string." },
        { status: 400 }
      );
    }

    const agent = await getAgentInstance();
    const agentResponse = await agent.run(message);

    return NextResponse.json({
      response: agentResponse.content,
      metrics: agentResponse.updatedMetrics,
      executedTools: agentResponse.executedTools,
    });
  } catch (error: any) {
    console.error("[API Error /api/chat]:", error);

    return NextResponse.json(
      {
        error: "Falha interna ao processar consulta de Yield Management.",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}