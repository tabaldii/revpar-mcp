export type AgentErrorCode =
  | "INVALID_TOOL_ARGUMENTS"
  | "TOOL_TIMEOUT"
  | "TOOL_FAILURE"
  | "TOOL_RESPONSE_ERROR"
  | "TOOL_RETRY_EXHAUSTED"
  | "TOOL_CIRCUIT_OPEN";

export class AgentError extends Error {
  constructor(
    public readonly code: AgentErrorCode,
    message: string,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export function toSafeErrorMessage(error: unknown): string {
  if (error instanceof AgentError) {
    return error.message;
  }

  return "Falha controlada durante a execução da ferramenta.";
}
