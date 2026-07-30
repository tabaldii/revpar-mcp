/**
 * Modelos de dados e repositório mock de inteligência de mercado imobiliário e hoteleiro.
 * Fornece métricas de ADR (Average Daily Rate), ocupação e eventos locais para precificação dinâmica.
 */

import type { PropertyType } from "@/domain/entities";
export type { PropertyType } from "@/domain/entities";

/**
 * Métricas históricas e consolidadas de mercado por bairro/região.
 */
export interface NeighborhoodMetrics {
  neighborhood: string;
  /** Multiplicador de tarifa com base na tipologia da unidade */
  typeMultipliers: Record<PropertyType, number>;
  /** Tarifa média diária (ADR) base para imóveis de aluguel por temporada (STR) */
  baseAdrAirbnb: number;
  /** Tarifa média diária (ADR) base para a rede hoteleira tradicional */
  baseAdrHotel: number;
  /** Taxa média de ocupação histórica (%) */
  occupancyRate: number;
  /** Volume aproximado de anúncios ativos na região */
  activeListings: number;
}

/**
 * Registro de eventos locais de alto impacto na curva de demanda.
 */
export interface LocalEvent {
  id: string;
  name: string;
  city: string;
  /** Mês do evento no formato 'MM' */
  month: string;
  /** Multiplicador aplicado sobre a tarifa base durante o evento */
  demandMultiplier: number;
  /** Duração mínima de estadia recomendada (LOS - Length of Stay) */
  minStayDays: number;
}

/**
 * Base de dados de mercado para cidades do Sul do Brasil.
 * Os valores refletem sazonalidades locais e o perfil da oferta imobiliária.
 */
const NEIGHBORHOOD_DATABASE: Record<string, NeighborhoodMetrics[]> = {
  florianopolis: [
    {
      neighborhood: "jurere",
      baseAdrAirbnb: 950,
      baseAdrHotel: 880,
      occupancyRate: 90,
      activeListings: 3200,
      typeMultipliers: { studio: 0.75, "1br": 0.9, "2br": 1.2, luxury: 2.5 },
    },
    {
      neighborhood: "centro",
      baseAdrAirbnb: 380,
      baseAdrHotel: 420,
      occupancyRate: 75,
      activeListings: 4100,
      typeMultipliers: { studio: 0.85, "1br": 1.0, "2br": 1.3, luxury: 1.8 },
    },
    {
      neighborhood: "lagoa_da_conceicao",
      baseAdrAirbnb: 520,
      baseAdrHotel: 490,
      occupancyRate: 82,
      activeListings: 2800,
      typeMultipliers: { studio: 0.8, "1br": 1.0, "2br": 1.35, luxury: 2.0 },
    },
  ],
  "balneario camboriu": [
    {
      neighborhood: "barra_sul",
      baseAdrAirbnb: 1100,
      baseAdrHotel: 1020,
      occupancyRate: 93,
      activeListings: 2500,
      typeMultipliers: { studio: 0.7, "1br": 0.85, "2br": 1.25, luxury: 2.8 },
    },
    {
      neighborhood: "centro",
      baseAdrAirbnb: 620,
      baseAdrHotel: 590,
      occupancyRate: 84,
      activeListings: 5200,
      typeMultipliers: { studio: 0.85, "1br": 1.0, "2br": 1.3, luxury: 2.1 },
    },
  ],
  chapeco: [
    {
      neighborhood: "centro",
      baseAdrAirbnb: 260,
      baseAdrHotel: 290,
      occupancyRate: 70,
      activeListings: 850,
      typeMultipliers: { studio: 0.9, "1br": 1.0, "2br": 1.2, luxury: 1.6 },
    },
    {
      neighborhood: "efapi",
      baseAdrAirbnb: 210,
      baseAdrHotel: 230,
      occupancyRate: 60,
      activeListings: 350,
      typeMultipliers: { studio: 0.85, "1br": 1.0, "2br": 1.15, luxury: 1.4 },
    },
  ],
};

const EVENTS_DATABASE: LocalEvent[] = [
  {
    id: "reveillon-floripa",
    name: "Réveillon Magic Island",
    city: "florianopolis",
    month: "12",
    demandMultiplier: 1.6,
    minStayDays: 4,
  },
  {
    id: "carnaval-floripa",
    name: "Carnaval de Florianópolis",
    city: "florianopolis",
    month: "02",
    demandMultiplier: 1.4,
    minStayDays: 3,
  },
  {
    id: "efapi-chapeco",
    name: "Feira Agroindustrial EFAPI",
    city: "chapeco",
    month: "10",
    demandMultiplier: 1.5,
    minStayDays: 2,
  },
  {
    id: "reveillon-bc",
    name: "Réveillon Show de Fogos BC",
    city: "balneario camboriu",
    month: "12",
    demandMultiplier: 1.75,
    minStayDays: 5,
  },
];

/**
 * Normaliza strings para busca e correspondência de chave (remove acentos, espaços e caixa alta).
 */
function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
}

/**
 * Recupera e calcula as métricas de mercado ajustadas por sazonalidade e tipologia do imóvel.
 *
 * @param city Nome da cidade
 * @param neighborhood Bairro desejado
 * @param propertyType Tipologia do imóvel (ex: 'studio', '1br')
 * @param month Mês numérico da consulta ('01' a '12')
 * @returns Objeto com as métricas consolidadas de ADR e ocupação ou null se não encontrado
 */
export function getAdvancedMarketData(
  city: string,
  neighborhood: string,
  propertyType: PropertyType = "1br",
  month: string
) {
  const normCity = normalizeString(city);
  const normNeighborhood = normalizeString(neighborhood);
  const normMonth = month.padStart(2, "0");

  const cityData = NEIGHBORHOOD_DATABASE[normCity];
  if (!cityData) return null;

  const metrics = cityData.find(
    (item) => normalizeString(item.neighborhood) === normNeighborhood
  );
  if (!metrics) return null;

  // Curva de Sazonalidade: Alta temporada no verão (Dez/Jan/Fev) e baixa no inverno
  const isHighSeason = ["12", "01", "02"].includes(normMonth);
  const seasonMultiplier = isHighSeason ? 1.35 : normMonth === "07" ? 0.8 : 1.0;
  const typeMultiplier = metrics.typeMultipliers[propertyType] ?? 1.0;

  return {
    city: normCity,
    neighborhood: normNeighborhood,
    propertyType,
    month: normMonth,
    isHighSeason,
    airbnbAdr: Math.round(metrics.baseAdrAirbnb * seasonMultiplier * typeMultiplier),
    hotelAdr: Math.round(metrics.baseAdrHotel * seasonMultiplier * typeMultiplier),
    occupancyRate: isHighSeason ? Math.min(98, metrics.occupancyRate + 10) : metrics.occupancyRate,
    activeListings: metrics.activeListings,
  };
}

/**
 * Busca os eventos programados para uma determinada cidade e mês.
 */
export function getEventsByCityAndMonth(city: string, month: string): LocalEvent[] {
  const normCity = normalizeString(city);
  const normMonth = month.padStart(2, "0");

  return EVENTS_DATABASE.filter(
    (event) => normalizeString(event.city) === normCity && event.month === normMonth
  );
}
