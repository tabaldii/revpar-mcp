import { z } from "zod";

export const PropertyTypeSchema = z.enum(["studio", "1br", "2br", "luxury"]);
export type PropertyType = z.infer<typeof PropertyTypeSchema>;

export const PropertySchema = z.object({
  id: z.string().min(1),
  city: z.string().min(1),
  neighborhood: z.string().min(1),
  propertyType: PropertyTypeSchema,
  active: z.boolean(),
});
export type Property = z.infer<typeof PropertySchema>;

export const NeighborhoodSchema = z.object({
  city: z.string().min(1),
  name: z.string().min(1),
});
export type Neighborhood = z.infer<typeof NeighborhoodSchema>;

export const MarketMetricSchema = z.object({
  city: z.string().min(1),
  neighborhood: z.string().min(1),
  propertyType: PropertyTypeSchema,
  month: z.string().regex(/^(0?[1-9]|1[0-2])$/),
  airbnbAdr: z.number().finite().nonnegative(),
  hotelAdr: z.number().finite().nonnegative(),
  occupancyRate: z.number().finite().min(0).max(100),
  activeListings: z.number().int().nonnegative(),
});
export type MarketMetric = z.infer<typeof MarketMetricSchema>;

export const LocalEventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  city: z.string().min(1),
  month: z.string().regex(/^(0?[1-9]|1[0-2])$/),
  demandMultiplier: z.number().finite().positive(),
  minStayDays: z.number().int().min(1),
});
export type LocalEvent = z.infer<typeof LocalEventSchema>;

export const PricingRequestSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  city: z.string().min(1),
  neighborhood: z.string().min(1),
  propertyType: PropertyTypeSchema,
  month: z.string().regex(/^(0?[1-9]|1[0-2])$/),
});
export type PricingRequest = z.infer<typeof PricingRequestSchema>;

export const PricingRecommendationSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  suggestedAdr: z.number().finite().nonnegative(),
  revPar: z.number().finite().nonnegative(),
  occupancyRate: z.number().finite().min(0).max(100),
  minStayDays: z.number().int().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  sources: z.array(z.string().min(1)),
  assumptions: z.array(z.string()),
});
export type PricingRecommendation = z.infer<typeof PricingRecommendationSchema>;

export const ToolExecutionSchema = z.object({
  toolName: z.string().min(1),
  callId: z.string().min(1),
  status: z.enum(["success", "error", "timeout"]),
  durationMs: z.number().finite().nonnegative(),
  attempts: z.number().int().min(0),
  errorCode: z.string().optional(),
  error: z.string().optional(),
});
export type ToolExecution = z.infer<typeof ToolExecutionSchema>;
