import { z } from "zod";

export const MCP_TOOL_NAMES = [
  "get_market_intelligence",
  "get_local_events",
  "calculate_dynamic_pricing_v2",
] as const;

export const McpToolNameSchema = z.enum(MCP_TOOL_NAMES);
export type McpToolName = z.infer<typeof McpToolNameSchema>;

export const MCP_RESOURCE_URIS = [
  "revpar://policies/pricing",
  "revpar://policies/occupancy",
  "revpar://glossary/revenue-management",
] as const;

export const MCP_PROMPT_NAMES = [
  "high-season-analysis",
  "explain-pricing-decision",
] as const;
