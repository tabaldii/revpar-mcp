import { randomUUID } from "node:crypto";
import type { MarketMetrics } from "./runner";

export const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_HISTORY_ENTRIES_PER_SESSION = 20;

export interface RecommendationHistoryEntry {
  id: string;
  sessionId: string;
  requestId: string;
  prompt: string;
  response: string;
  metrics?: MarketMetrics;
  executedTools: string[];
  createdAt: string;
}

export type CreateRecommendationHistoryEntry = Omit<
  RecommendationHistoryEntry,
  "id" | "createdAt"
>;

export interface RecommendationHistoryRepository {
  save(entry: CreateRecommendationHistoryEntry): RecommendationHistoryEntry;
  listBySession(sessionId: string): RecommendationHistoryEntry[];
}

export class InMemoryRecommendationHistoryRepository
  implements RecommendationHistoryRepository
{
  private readonly entries = new Map<string, RecommendationHistoryEntry[]>();

  save(entry: CreateRecommendationHistoryEntry): RecommendationHistoryEntry {
    const createdEntry: RecommendationHistoryEntry = {
      ...entry,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    const sessionEntries = this.entries.get(entry.sessionId) ?? [];
    sessionEntries.push(createdEntry);
    this.entries.set(
      entry.sessionId,
      sessionEntries.slice(-MAX_HISTORY_ENTRIES_PER_SESSION)
    );

    this.removeExpiredEntries(Date.now());
    return createdEntry;
  }

  listBySession(sessionId: string): RecommendationHistoryEntry[] {
    this.removeExpiredEntries(Date.now());
    return [...(this.entries.get(sessionId) ?? [])];
  }

  private removeExpiredEntries(now: number): void {
    for (const [sessionId, entries] of this.entries) {
      const activeEntries = entries.filter(
        (entry) => now - Date.parse(entry.createdAt) < HISTORY_TTL_MS
      );

      if (activeEntries.length === 0) {
        this.entries.delete(sessionId);
      } else {
        this.entries.set(sessionId, activeEntries);
      }
    }
  }
}

const globalForHistory = globalThis as typeof globalThis & {
  revparHistoryRepository?: RecommendationHistoryRepository;
};

export function getRecommendationHistoryRepository(): RecommendationHistoryRepository {
  globalForHistory.revparHistoryRepository ??=
    new InMemoryRecommendationHistoryRepository();

  return globalForHistory.revparHistoryRepository;
}
