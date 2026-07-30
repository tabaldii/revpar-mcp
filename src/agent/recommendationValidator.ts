import { z } from "zod";
import type { MarketMetrics } from "./runner";

const ToolExecutionTraceSchema = z.object({
  toolName: z.string().min(1),
  callId: z.string().min(1),
  status: z.enum(["success", "error", "timeout"]),
  durationMs: z.number().finite().nonnegative(),
  attempts: z.number().int().min(0),
  errorCode: z.string().optional(),
  error: z.string().optional(),
});

export const MarketMetricsSchema = z.object({
  city: z.string().min(1),
  neighborhood: z.string().min(1),
  suggestedAdr: z.number().finite().nonnegative(),
  airbnbBaseAdr: z.number().finite().nonnegative(),
  hotelBaseAdr: z.number().finite().nonnegative(),
  revPar: z.number().finite().nonnegative(),
  occupancyRate: z.number().finite().min(0).max(100),
  minStayDays: z.number().finite().int().min(1),
  eventName: z.string().optional(),
});

export const RecommendationResponseSchema = z.object({
  content: z.string().min(1),
  metrics: MarketMetricsSchema.optional(),
  sources: z.array(z.string()),
  assumptions: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  validationErrors: z.array(z.string()),
  requestId: z.string().min(1),
  durationMs: z.number().finite().nonnegative(),
  toolTrace: z.array(ToolExecutionTraceSchema),
});

export interface MetricsValidationResult {
  isValid: boolean;
  metrics?: MarketMetrics;
  errors: string[];
}

export function validateMarketMetrics(
  metrics: MarketMetrics | undefined
): MetricsValidationResult {
  if (!metrics) {
    return {
      isValid: false,
      errors: ["Não há métricas suficientes para gerar uma recomendação confiável."],
    };
  }

  const result = MarketMetricsSchema.safeParse(metrics);
  const errors = result.success
    ? []
    : result.error.issues.map((issue) => `Métrica inválida: ${issue.path.join(".") || "resposta"}.`);

  if (
    result.success &&
    metrics.revPar !== undefined &&
    metrics.suggestedAdr !== undefined &&
    metrics.revPar > metrics.suggestedAdr
  ) {
    errors.push("RevPAR não pode ser maior que a ADR sugerida.");
  }

  return {
    isValid: errors.length === 0,
    metrics: errors.length === 0 ? result.data : undefined,
    errors,
  };
}
