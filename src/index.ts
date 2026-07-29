/**
 * Ponto de entrada da aplicação CLI (Command Line Interface).
 * Inicializa a sessão interativa do agente de Revenue Management no terminal.
 */

import "dotenv/config";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { setupMcpClient } from "./agent/openaiAdapter.js";
import { RevParAgent } from "./agent/runner.js";

async function main() {
  // Validação do ambiente antes de iniciar o loop da aplicação
  if (!process.env.OPENAI_API_KEY) {
    console.error("Erro crítico: A variável de ambiente OPENAI_API_KEY não foi configurada.");
    process.exit(1);
  }

  console.log("--------------------------------------------------");
  console.log("RevPar MCP Engine - Sessão Interativa");
  console.log("--------------------------------------------------\n");

  const mcpClient = await setupMcpClient();
  const agent = new RevParAgent(mcpClient);
  const rl = readline.createInterface({ input, output });

  console.log("Sistema pronto. Digite sua consulta ou 'sair' para encerrar.\n");

  while (true) {
    const userInput = await rl.question("Prompt > ");
    const trimmedInput = userInput.trim();

    if (["exit", "quit", "sair"].includes(trimmedInput.toLowerCase())) {
      rl.close();
      process.exit(0);
    }

    if (!trimmedInput) continue;

    try {
      const answer = await agent.run(trimmedInput);
      console.log("\n[Resposta do Agente]");
      console.log(answer);
      console.log("\n--------------------------------------------------\n");
    } catch (error) {
      console.error("\nErro na execução:", error, "\n");
    }
  }
}

main();