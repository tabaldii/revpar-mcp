# RevPar MCP

[![CI](https://github.com/tabaldii/revpar-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/tabaldii/revpar-mcp/actions/workflows/ci.yml)

Agente de Revenue Management para hotelaria e aluguel por temporada, desenvolvido para demonstrar a integração entre LLMs, Model Context Protocol (MCP), APIs e regras determinísticas de negócio.

O sistema recebe perguntas em linguagem natural e combina dados de mercado, eventos locais e estratégias de precificação para produzir recomendações de ADR, ocupação, RevPAR e estadia mínima.

> **Status:** MVP técnico para estudo e portfólio. Os dados de mercado e eventos são mocks locais e não representam informações de produção ou recomendações comerciais reais.

## Demonstração

[Acessar demonstração online](https://revpar-mcp.vercel.app/)

## Objetivo do projeto

O RevPar MCP foi criado como um laboratório prático para estudar e demonstrar:

- construção de agentes com uso de ferramentas;
- integração entre OpenAI e MCP;
- engenharia de prompt e controle de alucinações;
- validação de respostas geradas por LLM;
- modelagem de domínio com TypeScript e Zod;
- tratamento de falhas em integrações externas;
- observabilidade, testes automatizados e CI.

O projeto não foi desenhado para atender clientes reais, operar reservas ou substituir uma plataforma profissional de Revenue Management.

## Visão geral

Exemplo de consulta:

> Qual a diária recomendada para um imóvel simples em Chapecó no mês de dezembro?

O agente coordena as seguintes etapas:

1. interpreta a solicitação e identifica cidade, período e tipologia;
2. consulta métricas de mercado por meio de uma ferramenta MCP;
3. busca eventos locais e possíveis impactos na demanda;
4. executa o cálculo determinístico de precificação;
5. valida as métricas e as premissas antes de responder;
6. entrega uma resposta textual e indicadores estruturados para o dashboard.

## Principais capacidades

### Agente e MCP

- Agente conversacional integrado à API da OpenAI.
- Function calling para selecionar e executar ferramentas MCP.
- Servidor MCP executado em memória por transporte interno.
- Tools com schemas de entrada validados por Zod.
- Resources MCP para políticas de precificação, ocupação e glossário de Revenue Management.
- Prompts MCP parametrizados para análises de alta temporada e explicação de decisões tarifárias.

### Motor de precificação

O cálculo é determinístico e considera:

- ponderação entre ADR de aluguel por temporada e hotelaria;
- multiplicador de demanda por eventos;
- estratégia de lead time;
- ajuste conforme ocupação-alvo;
- piso operacional de R$ 150 por noite;
- cálculo de RevPAR;
- recomendação de estadia mínima (LOS).

Os dados mockados possuem normalização de cidade e bairro, incluindo acentos, caixa alta e variações de entrada.

### Confiabilidade e controle do agente

- Validação das métricas antes da resposta final.
- Bloqueio de recomendações quando os dados são insuficientes ou inválidos.
- Registro das fontes, premissas, nível de confiança e erros de validação.
- Limite de rodadas de execução de ferramentas.
- Timeout para chamadas MCP.
- Retry controlado para falhas transitórias.
- Circuit breaker para interromper temporariamente ferramentas com falhas consecutivas.

### Segurança e operação da demonstração

- Histórico conversacional isolado por sessão.
- Cookie de sessão HTTP-only.
- Rate limiting em memória.
- Limite de tamanho das mensagens recebidas.
- Respostas sem exposição de detalhes internos de exceções.
- `requestId` para rastrear cada requisição.
- Logs estruturados e trace individual das ferramentas executadas.

Esses controles são adequados ao objetivo demonstrativo do MVP. Rate limiting, sessões e histórico ainda dependem da memória da instância em execução.

### Modelagem de domínio

As entidades principais estão centralizadas em `src/domain/entities.ts` e possuem tipos TypeScript e schemas Zod:

- `Property`;
- `Neighborhood`;
- `MarketMetric`;
- `LocalEvent`;
- `PricingRequest`;
- `PricingRecommendation`;
- `ToolExecution`.

Essa camada cria contratos explícitos para os conceitos do negócio e reduz o risco de cada parte da aplicação interpretar os mesmos dados de maneira diferente.

## Interface

### Dashboard de Revenue Management

Interface para acompanhar ADR sugerida, RevPAR, ocupação, estadia mínima e comparação entre tarifas de mercado.

![Dashboard do RevPar MCP](docs/screenshots/dashboard.png)

### Interações com o agente

O agente interpreta perguntas em linguagem natural, consulta as ferramentas MCP e apresenta recomendações contextualizadas.

![Interações com o RevPar MCP](docs/screenshots/questions.png)

## Arquitetura

```text
Usuário
  |
  v
Dashboard Next.js
  |
  | POST /api/chat
  v
RevParAgent
  |
  +--> OpenAI Adapter
  |       |
  |       v
  |    MCP Client <----> MCP Server em memória
  |                         |
  |                         +--> get_market_intelligence
  |                         +--> get_local_events
  |                         +--> calculate_dynamic_pricing_v2
  |                         +--> Resources e Prompts
  |
  +--> Validação de domínio
  +--> Observabilidade e Tool Trace
  +--> Histórico em memória por sessão
```

A separação entre agente, servidor MCP, ferramentas, domínio e validação permite evoluir cada responsabilidade de forma independente. O transporte em memória foi escolhido para manter o MVP simples e autocontido.

## Ferramentas MCP

### `get_market_intelligence`

Consulta métricas de mercado por localização, tipologia e mês.

Parâmetros principais:

- `city`: cidade;
- `neighborhood`: bairro ou região;
- `propertyType`: `studio`, `1br`, `2br` ou `luxury`;
- `month`: mês numérico de `01` a `12`.

### `get_local_events`

Busca eventos de impacto por cidade e mês, incluindo multiplicador de demanda e estadia mínima recomendada.

### `calculate_dynamic_pricing_v2`

Calcula a recomendação tarifária considerando:

- `baseAirbnbAdr`;
- `baseHotelAdr`;
- `targetOccupancy`;
- `eventDemandMultiplier`;
- `eventMinStayDays`;
- `leadTimeDays`.

O retorno inclui `suggestedAdr`, `estimatedRevPar` e `suggestedMinStayDays`.

## Testes e qualidade

Os testes priorizam as regras determinísticas e os contratos de integração, sem depender de chamadas reais à API da OpenAI.

São cobertos, entre outros pontos:

- cálculo de precificação, RevPAR e estadia mínima;
- diferenciação por cidade, bairro e tipologia;
- identificação de eventos e impacto na demanda;
- contrato entre servidor MCP e adaptador OpenAI;
- validação das métricas e respostas do agente;
- rate limiting e isolamento de sessão;
- timeout, retry e circuit breaker;
- histórico separado por sessão e expiração por TTL;
- schemas das entidades de domínio;
- validação do endpoint HTTP.

Comandos principais:

```bash
npm test
npm run typecheck
npm run build
```

O workflow de CI executa esses comandos automaticamente em pushes e pull requests.

## Stack

- Next.js 16;
- React 19;
- TypeScript 5;
- OpenAI SDK;
- Model Context Protocol SDK;
- Zod;
- Tailwind CSS;
- Vitest.

## Estrutura do projeto

```text
src/
├── domain/
│   └── entities.ts          # Entidades e schemas do domínio
├── agent/
│   ├── historyRepository.ts # Histórico de recomendações por sessão
│   ├── openaiAdapter.ts     # Integração MCP com ferramentas OpenAI
│   ├── recommendationValidator.ts
│   ├── runner.ts            # Orquestração conversacional
│   └── toolExecutor.ts      # Timeout, retry, circuit breaker e trace
├── app/
│   ├── api/chat/route.ts    # Endpoint HTTP do agente
│   ├── page.tsx             # Dashboard
│   └── globals.css          # Estilos globais
├── mcp/
│   ├── mockData.ts          # Dados locais de mercado e eventos
│   ├── repository.ts        # Contrato de acesso aos dados
│   ├── server.ts            # Tools, resources e prompts MCP
│   └── tools.ts             # Regras de negócio expostas ao agente
├── lib/
│   └── security.ts          # Sessão e rate limiting
tests/                       # Testes unitários e de integração
.github/workflows/ci.yml    # Pipeline de qualidade
```
