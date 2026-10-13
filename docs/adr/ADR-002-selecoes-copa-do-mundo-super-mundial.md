# ADR-002: Seleções Nacionais, Copa do Mundo FIFA e Torneios Mundiais de Clubes

## Contexto e Motivação
Na Fase 4 do Champs Manager, o escopo expande o universo das ligas domésticas e continentais para o nível internacional com seleções nacionais e competições mundiais de clubes.
Seguindo a fidelidade às regras e ao ecossistema do Brasfoot 2026:
1. A **Copa do Mundo FIFA** ocorre em um ciclo quadrienal em anos pares (2026, 2030, 2034) durante a janela de pausa de junho/julho das ligas nacionais.
2. O **Super Mundial de Clubes** ocorre em anos ímpares pré-Copa (2029, 2033) na mesma janela de junho/julho.
3. A **Copa Intercontinental** ocorre anualmente em dezembro, após o término dos campeonatos nacionais.
4. O treinador humano pode comandar paralelamente seu clube e uma Seleção Nacional, respeitando requisitos de reputação e títulos.
5. Atletas convocados do elenco do jogador recebem valorização substancial de passe após o torneio.

## Decisões Arquiteturais

### 1. Ciclo Quadrienal e Calendários Oficiais
- A Copa do Mundo é agendada em anos onde `seasonYear % 4 == 2` (2026, 2030, 2034).
- As datas da Copa utilizam as 7 janelas oficiais de junho/julho (`calendario_supermundial.txt`: 21/06, 25/06, 29/06, 02/07, 06/07, 10/07, 15/07).
- A Copa Intercontinental ocorre anualmente em dezembro (`calendario_intercontinental.txt`: 16/12, 19/12, 22/12, 25/12, 29/12).
- O Super Mundial de Clubes ocorre em anos ímpares pré-Copa (`(seasonYear + 1) % 4 == 2 && seasonYear % 2 != 0`).

### 2. Mecânica de Técnico de Seleção
- O treinador humano mantém seu clube ativo enquanto comanda a seleção nacional.
- O critério de propostas segue faixas de prestígio:
  - Seleções menores (1-2 estrelas): aceitam qualquer treinador.
  - Seleções médias (3-4 estrelas): exigem reputação >= 3 ou ao menos 1 título conquistado.
  - Seleções de elite (5 estrelas - Brasil, Argentina, França, Alemanha, etc.): exigem reputação >= 4 e ao menos 2 títulos importantes.

### 3. Convocação de Atletas e Valorização de Mercado
- Atletas com `isStar`, `isWorldTop` ou força elevada compatível com sua seleção são convocados.
- Notícias no `NewsFeed` anunciam as convocações.
- Ao final da Copa, atletas que participaram recebem bônus de +20% a +35% em seu valor de mercado (`marketValue`).

### 4. Estrutura da Copa do Mundo
- 32 seleções divididas em 8 grupos de 4 (Grupos A a H).
- Potes de sorteio ponderados por reputação.
- 3 rodadas de fase de grupos seguidas de mata-mata em jogo único com prorrogação/pênaltis (Oitavas, Quartas, Semifinal e Final).
- Chaveamento integrado ao motor de partidas e ao `qualification.ts`.

## Consequências
- Os torneios de seleções enriquecem a imersão sem interferir negativamente na integridade dos calendários das ligas de clubes.
- O contrato de dados do `GameState` continua 100% retrocompatível graças ao campo extensível serializado via serde/WASM.
