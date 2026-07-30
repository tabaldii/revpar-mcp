/** Abstrai a fonte de dados consumida pelas ferramentas MCP. */

import {
  getAdvancedMarketData,
  getEventsByCityAndMonth,
  LocalEvent,
  PropertyType,
} from "@/mcp/mockData";

export interface MarketDataRepository {
  getAdvancedMarketData(
    city: string,
    neighborhood: string,
    propertyType: PropertyType,
    month: string
  ): ReturnType<typeof getAdvancedMarketData>;

  getEventsByCityAndMonth(city: string, month: string): LocalEvent[];
}

export class MockMarketDataRepository implements MarketDataRepository {
  getAdvancedMarketData(
    city: string,
    neighborhood: string,
    propertyType: PropertyType,
    month: string
  ): ReturnType<typeof getAdvancedMarketData> {
    return getAdvancedMarketData(city, neighborhood, propertyType, month);
  }

  getEventsByCityAndMonth(city: string, month: string): LocalEvent[] {
    return getEventsByCityAndMonth(city, month);
  }
}

export function createMarketDataRepository(): MarketDataRepository {
  return new MockMarketDataRepository();
}
