import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { AgentError, toSafeErrorMessage } from "./errors";
import { logStructured } from "./observability";

export const TOOL_TIMEOUT_MS = 10_000;
export const MAX_TOOL_ATTEMPTS = 2;
export const CIRCUIT_FAILURE_THRESHOLD = 3;
export const CIRCUIT_COOLDOWN_MS = 30_000;

interface CircuitState {
  consecutiveFailures: number;
  openedAt?: number;
}

const globalForCircuit = globalThis as typeof globalThis & {
  revparCircuitStates?: Map<string, CircuitState>;
};

const circuitStates =
  globalForCircuit.revparCircuitStates ?? new Map<string, CircuitState>();

globalForCircuit.revparCircuitStates = circuitStates;

export interface ToolExecutionTrace {
  toolName: string;
  callId: string;
  status: "success" | "error" | "timeout";
  durationMs: number;
  attempts: number;
  errorCode?: string;
  error?: string;
}

interface ToolExecutionInput {
  mcpClient: Client;
  toolName: string;
  callId: string;
  argumentsJson: string;
  requestId: string;
  sessionId?: string;
}

export async function executeToolCall({
  mcpClient,
  toolName,
  callId,
  argumentsJson,
  requestId,
  sessionId,
}: ToolExecutionInput): Promise<{
  resultContent: string;
  trace: ToolExecutionTrace;
}> {
  const circuitError = getCircuitError(toolName);
  if (circuitError) {
    return createErrorResult({
      toolName,
      callId,
      requestId,
      sessionId,
      error: circuitError,
      status: "error",
      attempts: 0,
    });
  }

  let toolArguments: Record<string, unknown>;

  try {
    const parsedArguments: unknown = JSON.parse(argumentsJson || "{}");
    if (!parsedArguments || typeof parsedArguments !== "object" || Array.isArray(parsedArguments)) {
      throw new Error("Tool arguments must be an object.");
    }
    toolArguments = parsedArguments as Record<string, unknown>;
  } catch {
    const error = new AgentError(
      "INVALID_TOOL_ARGUMENTS",
      "Os argumentos da ferramenta são inválidos."
    );
    return createErrorResult({
      toolName,
      callId,
      requestId,
      sessionId,
      error,
      status: "error",
      attempts: 0,
    });
  }

  let lastError: AgentError | undefined;

  for (let attempt = 1; attempt <= MAX_TOOL_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();

    try {
      const toolResult = await withTimeout(
        mcpClient.callTool({ name: toolName, arguments: toolArguments }),
        TOOL_TIMEOUT_MS
      );

      if (toolResult.isError) {
        throw new AgentError(
          "TOOL_RESPONSE_ERROR",
          "A ferramenta retornou um erro controlado.",
          true
        );
      }

      const resultContent = extractTextContent(toolResult.content);
      const trace: ToolExecutionTrace = {
        toolName,
        callId,
        status: "success",
        durationMs: Date.now() - startedAt,
        attempts: attempt,
      };

      recordCircuitSuccess(toolName);

      logStructured({
        event: "agent.tool.completed",
        requestId,
        sessionId,
        toolName,
        status: trace.status,
        durationMs: trace.durationMs,
        attempts: attempt,
      });

      return { resultContent, trace };
    } catch (error) {
      const normalizedError =
        error instanceof AgentError
          ? error
          : new AgentError("TOOL_FAILURE", "Falha controlada na ferramenta.", true);
      lastError = normalizedError;
      const isTimeout = normalizedError.code === "TOOL_TIMEOUT";

      logStructured({
        event: "agent.tool.failed",
        requestId,
        sessionId,
        toolName,
        status: isTimeout ? "timeout" : "error",
        durationMs: Date.now() - startedAt,
        attempts: attempt,
        errorCode: normalizedError.code,
      });

      if (!normalizedError.retryable || attempt === MAX_TOOL_ATTEMPTS) {
        break;
      }
    }
  }

  recordCircuitFailure(toolName);

  return createErrorResult({
    toolName,
    callId,
    requestId,
    sessionId,
    error:
      lastError ||
      new AgentError("TOOL_RETRY_EXHAUSTED", "Não foi possível executar a ferramenta."),
    status: lastError?.code === "TOOL_TIMEOUT" ? "timeout" : "error",
    attempts: MAX_TOOL_ATTEMPTS,
  });
}

export function resetCircuitBreakersForTests(): void {
  circuitStates.clear();
}

function getCircuitError(toolName: string): AgentError | undefined {
  const state = circuitStates.get(toolName);
  if (!state?.openedAt) return undefined;

  if (Date.now() - state.openedAt >= CIRCUIT_COOLDOWN_MS) {
    circuitStates.delete(toolName);
    return undefined;
  }

  return new AgentError(
    "TOOL_CIRCUIT_OPEN",
    "A ferramenta está temporariamente indisponível após falhas consecutivas."
  );
}

function recordCircuitSuccess(toolName: string): void {
  circuitStates.delete(toolName);
}

function recordCircuitFailure(toolName: string): void {
  const state = circuitStates.get(toolName) ?? { consecutiveFailures: 0 };
  state.consecutiveFailures += 1;

  if (state.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    state.openedAt = Date.now();
  }

  circuitStates.set(toolName, state);
}

function extractTextContent(content: unknown): string {
  if (Array.isArray(content) && content[0]?.type === "text") {
    return content[0].text;
  }

  return JSON.stringify(content);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new AgentError("TOOL_TIMEOUT", "A ferramenta excedeu o tempo limite.", true)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function createErrorResult({
  toolName,
  callId,
  requestId,
  sessionId,
  error,
  status,
  attempts,
}: {
  toolName: string;
  callId: string;
  requestId: string;
  sessionId?: string;
  error: AgentError;
  status: "error" | "timeout";
  attempts: number;
}): { resultContent: string; trace: ToolExecutionTrace } {
  const trace: ToolExecutionTrace = {
    toolName,
    callId,
    status,
    durationMs: 0,
    attempts,
    errorCode: error.code,
    error: toSafeErrorMessage(error),
  };

  return {
    resultContent: JSON.stringify({
      error: toSafeErrorMessage(error),
      errorCode: error.code,
    }),
    trace,
  };
}
