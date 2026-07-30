export interface StructuredLog {
  event: string;
  requestId: string;
  sessionId?: string;
  toolName?: string;
  status?: string;
  durationMs?: number;
  attempts?: number;
  errorCode?: string;
}

export function logStructured(event: StructuredLog): void {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...event,
    })
  );
}
