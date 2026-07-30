import { describe, expect, it } from "vitest";
import {
  HISTORY_TTL_MS,
  InMemoryRecommendationHistoryRepository,
} from "../src/agent/historyRepository";

describe("Recommendation history repository", () => {
  it("mantém o histórico separado por sessão", () => {
    const repository = new InMemoryRecommendationHistoryRepository();

    repository.save({
      sessionId: "session_a",
      requestId: "request_a",
      prompt: "Consulta A",
      response: "Resposta A",
      executedTools: ["get_market_intelligence"],
    });
    repository.save({
      sessionId: "session_b",
      requestId: "request_b",
      prompt: "Consulta B",
      response: "Resposta B",
      executedTools: [],
    });

    expect(repository.listBySession("session_a")).toHaveLength(1);
    expect(repository.listBySession("session_a")[0]?.prompt).toBe("Consulta A");
    expect(repository.listBySession("session_b")[0]?.prompt).toBe("Consulta B");
  });

  it("limita a quantidade de registros por sessão", () => {
    const repository = new InMemoryRecommendationHistoryRepository();

    for (let index = 0; index < 25; index += 1) {
      repository.save({
        sessionId: "session_a",
        requestId: `request_${index}`,
        prompt: `Consulta ${index}`,
        response: `Resposta ${index}`,
        executedTools: [],
      });
    }

    const entries = repository.listBySession("session_a");
    expect(entries).toHaveLength(20);
    expect(entries[0]?.prompt).toBe("Consulta 5");
  });

  it("remove registros expirados pelo TTL", () => {
    const repository = new InMemoryRecommendationHistoryRepository();
    const entry = repository.save({
      sessionId: "session_a",
      requestId: "request_a",
      prompt: "Consulta A",
      response: "Resposta A",
      executedTools: [],
    });

    const createdAt = new Date(
      Date.now() - HISTORY_TTL_MS - 1_000
    ).toISOString();
    const internalEntries = repository as unknown as {
      entries: Map<string, Array<typeof entry>>;
    };
    internalEntries.entries.set("session_a", [
      { ...entry, createdAt },
    ]);

    expect(repository.listBySession("session_a")).toEqual([]);
  });
});
