# SPEC-008 / SPEC-009: Revisão Técnica de Integridade de Torneios e Pirâmide Nacional

| Metadado | Detalhes |
| :--- | :--- |
| **Status** | Aprovado & Implementado (Integridade e Correções Críticas) |
| **Data** | 17/10/2026 |
| **Autor** | Antigravity AI & Alex Chagas |
| **Módulos Afetados** | `continentalRepresentatives.ts`, `teamsDatabase.ts`, `calendarGenerator.ts`, `ClubOverview.tsx`, `GameContext.tsx`, `crossSeasonSimulation.ts`, `stateLeagueFormulas.ts` |
| **Escopo** | Correções de integridade confirmadas no PR #9 e roadmap de expansão continental (SPEC-008) |

---

## 1. Resumo Executivo das Correções Implementadas

Com base na investigação do PR #9 e nos requisitos de integridade esportiva definidos no SPEC-008 e SPEC-009, foram identificados e corrigidos seis pontos arquiteturais essenciais:

### 1.1. Isolamento Continental de Clubes de Divisões Inferiores (Caso Portuguesa)
* **Problema anterior:** Clubes de divisões inferiores (ex: Portuguesa, Série D / 4ª divisão) eram compulsoriamente inseridos na Copa Sul-Americana ou Libertadores logo no início da carreira através de `selected = [userClub]` em `continentalRepresentatives.ts`.
* **Solução implementada:** 
  - `getContinentalTournamentField` agora avalia explicitamente a elegibilidade do clube (`isLowerDivision = division > 1`).
  - Clubes de divisões inferiores sem qualificação explícita não são adicionados ao torneio (`userParticipates = false`).
  - O torneio continental continua sendo gerado para os 16 clubes elegíveis do continente (ex: Palmeiras, Flamengo, River Plate, Boca Juniors), garantindo que a competição exista no universo do jogo.
  - O calendário ativo do usuário (`allFixtures`) não agenda partidas continentais para o clube do usuário quando este não estiver qualificado, eliminando datas vazias e bloqueios de avanço.
  - Suporte ao parâmetro explícito `options: { forceUserParticipation: true }` para garantir compatibilidade com futuras mecânicas de qualificação ou torneios customizados.

### 1.2. Avanço e Sobrevivência de `nationalDivisions` Entre Rodadas e Temporadas
* **Problema anterior:** A estrutura `nationalDivisions` (Séries simultâneas B, C e D) introduzida no PR #9 era instanciada no início, mas ficava congelada na rodada 0 quando o usuário avançava suas rodadas e era completamente descartada no rollover de temporada (`startNewSeason`).
* **Solução implementada:**
  - `advanceRound` em `GameContext.tsx` calcula `updatedNationalDivisions` através de `advanceOtherLeaguesProgress` proporcionalmente ao progresso da temporada, atualizando tabelas, pontuação e rodadas disputadas.
  - `startNewSeason` em `GameContext.tsx` recria e avança `nationalDivisions` para o novo ano através de `buildInitialNationalDivisions(club, updatedClubs, nextYear)`.
  - `wasmBridge.ts` preserva `nationalDivisions` durante a fusão de estado com o motor Rust (`mergeCareerState`).

### 1.3. Rotulagem Explícita e Zonas de Competição em `ClubOverview.tsx`
* **Problema anterior:** O menu de abas exibia apenas "Brasileirão" de forma genérica para qualquer divisão, e o cálculo de zonas de competição (`competitionZones`) para ligas externas/divisões nacionais hardcodava `division: 1`, aplicando indevidamente zonas de Libertadores e Sul-Americana para Séries B, C e D.
* **Solução implementada:**
  - Aba de divisão do clube agora é rotulada explicitamente de acordo com a divisão do usuário: `Brasileirão Série A`, `Brasileirão Série B`, `Brasileirão Série C` ou `Brasileirão Série D`.
  - `ClubOverview.tsx` passa `selectedOtherLeague.division ?? 1` para `getCompetitionZones`, calculando corretamente zonas de Acesso (1-4) e Rebaixamento para Séries B e C, e Acesso exclusivo (sem rebaixamento) para a Série D.

### 1.4. Preservação dos Grupos Regionais Oficiais da Série D (8 Clubes)
* **Problema anterior:** Ao selecionar um clube da Série D em `getCompetitionClubs`, o motor dividia os 64 clubes em 8 grupos de 8 times, mas o bloco subsequente de padding (`if (competitionClubs.length < 16)`) tratava o grupo como incompleto e o preenchia com 12 clubes avulsos de acesso até atingir 20 times, distorcendo o formato regional oficial.
* **Solução implementada:**
  - A verificação de preenchimento (`< 16`) agora ignora grupos oficiais da Série D (`!isSerieD`), garantindo que o grupo regional mantenha estritamente seus 8 clubes oficiais e 14 rodadas em turno e returno.

### 1.5. Paulistão Fórmula 7: Resolução do Defeito de Rodadas Inter-Grupos
* **Problema anterior:** No PR #9, o Paulistão selecionava 16 clubes, mas aplicava `Math.min(11, ...)`, truncando a tabela em 11 rodadas e deixando 4 rodadas/clubes sem confronto em uma fórmula que exige confrontos inter-chaves.
* **Solução implementada:**
  - Implementado o gerador canônico da Fórmula 7 em `calendarGenerator.ts`: 16 clubes organizados em 4 grupos de 4 clubes ($A, B, C, D$).
  - Cada rodada emparelha grupos distintos ($A \times B$, $C \times D$ nas rodadas 1–4; $A \times C$, $B \times D$ nas rodadas 5–8; $A \times D$, $B \times C$ nas rodadas 9–12), totalizando 12 rodadas completas onde cada time joga exatamente contra os 12 times dos outros grupos.
  - As Semifinais (ida e volta) e Final ocorrem nas semanas 12 e 13, integradas sem colisão antes do início do Campeonato Nacional (semana 14).
  - *Nota técnica / TODO:* A expansão das Quartas de Final com 8 clubes no mata-mata estadual permanece documentada para quando o motor de chaveamento de estaduais for generalizado para multi-fases de knockout.

---

## 2. Slice 2: Fidelidade de Torneios, Nomenclatura Canônica e 2ª Divisão Estadual

Implementada a fatia subsequente de fidelidade e integridade desportiva sobre o PR-14:

### 2.1. Canonicalização Universal de Nomes Nacionais (`Brasileirão Série A/B/C/D`)
* **Problema:** O nome da competição nacional variava entre `"Brasileirão"`, nomes compostos com grupo regional (`"Brasileirão Série D • Grupo 5"`), ou rótulos genéricos em fixtures e tabelas, gerando inconsistências no cabeçalho e na navegação de divisões.
* **Solução:**
  - `getCanonicalNationalLeagueName` implementado em `teamsDatabase.ts` para padronizar canonicamente as quatro divisões brasileiras: `Brasileirão Série A`, `Brasileirão Série B`, `Brasileirão Série C` e `Brasileirão Série D`.
  - `GameState.nationalLeagueName` e `calendarGenerator.ts` agora gravam estritamente o nome canônico em todas as rodadas (`f.competitionName = 'Brasileirão Série A/B/C/D'`).
  - `buildInitialNationalDivisions` em `crossSeasonSimulation.ts` garante que as ligas nacionais paralelas recebam nomes canônicos.
  - `ClubOverview.tsx` exibe o título canônico tanto na visualização da divisão ativa do usuário quanto ao selecionar qualquer divisão nacional paralela na barra de torneios (sem concatenar ano de temporada de forma redundante).

### 2.2. Geração Continental Honesta e Remoção do Fallback de Sul-Americana
* **Problema:** Quando clubes com reputação modesta eram selecionados na América do Sul, `continentalRepresentatives.ts` renomeava o torneio continental de 16 clubes de elite (Palmeiras, River, Boca, etc.) para `"Copa Sul-Americana"`, criando uma falsa ilusão de Sul-Americana como disfarce da Libertadores, enquanto a Sul-Americana real não existia.
* **Solução:**
  - O torneio continental sul-americano é explicitamente gerado como `type: 'libertadores'`, `name: 'Copa Libertadores'`.
  - Sul-Americana não é representada como fallback para a Libertadores.
  - Clubes de divisões inferiores (Séries B, C, D) sem qualificação explícita não participam do torneio continental (0 partidas agendadas).
  - Clubes da Série A elegíveis mantêm participação íntegra na Libertadores.
  - A topologia de 16 clubes é preservada com segurança, mantendo o teste bloqueador de 32 clubes ativo.

### 2.3. Metadados e Visibilidade de 2ª Divisão Estadual (Regra de 8 Clubes Reais)
* **Problema:** Os campeonatos estaduais não possuíam visibilidade de divisões de acesso e não havia distinção explícita de divisões nos estados com grandes contingentes de clubes reais remanescentes.
* **Solução:**
  - `getStateDivisionInfo` em `stateLeagueFormulas.ts` calcula os remanescentes reais após a composição da elite (`totalClubsInState - targetStateCount`).
  - A 2ª divisão estadual é gerada **apenas onde houver pelo menos 8 clubes reais remanescentes** (ex: SP com 87 clubes remanescentes $\rightarrow$ *Paulistão Série A2*; RJ com 50 remanescentes $\rightarrow$ *Carioca Série A2*; MG com 37 $\rightarrow$ *Mineiro Módulo II*; RS com 26 $\rightarrow$ *Gaúcho Divisão de Acesso*; SC com 16 $\rightarrow$ *Catarinense Série B*, etc.).
  - Estados com menos de 8 clubes remanescentes (ex: Acre com 4 clubes, Rondônia com 4, Roraima com 2) **não fabricam competições** e permanecem em divisão única.
  - Em `ClubOverview.tsx`, foram adicionados badges/labels de tier discretos e minimalistas: `1ª Divisão` para o estadual de elite ativo e `2ª Divisão` para divisões estaduais de acesso disponíveis.
  - A 2ª divisão estadual é simulada paralelamente via `buildInitialStateDivisions` em `crossSeasonSimulation.ts`, avança com `advanceRound` e sobrevive ao rollover de temporada (`stateDivisions`).
  - A alocação esportiva do clube do usuário permanece intacta na elite (ex: Portuguesa permanece no Paulistão enfrentando Santos, Palmeiras, Corinthians e São Paulo).

---

## 3. Bloqueios Técnicos e Roadmap Remanescente do SPEC-008

Conforme diretriz de fidelidade sem quebra da integridade do WASM, os seguintes itens do SPEC-008 permanecem mapeados para implementação arquitetural subsequente:

### 3.1. Expansão da Copa Libertadores para 32 Clubes
1. **Motor de Chaveamento (`qualification.ts`):** Suporte a 8 grupos ($A$ a $H$, 16 classificados) e Oitavas de Final em ida e volta antes das Quartas de Final.
2. **Grade de Datas Anual (`calendarGenerator.ts`):** Necessidade de 2 semanas adicionais de quartas-feiras para acomodar as Oitavas de Final sem colidir com as semanas de Copa do Brasil e Brasileirão.
3. **Mapeamento de Grupos no Estado:** Indexação de grupos continentais para `ABCDEFGH` e suporte a paginação na visualização mobile de `ClubOverview.tsx`.

### 3.2. Torneios Continentais Secundários Autônomos (Copa Sul-Americana e Europa League)
* Implementação da Copa Sul-Americana e da UEFA Europa League como torneios paralelos autônomos disputados por clubes de meio de tabela / 3ºs colocados de grupos, com datas de quintas-feiras independentes.

### 3.3. Competições Continentais da Ásia e África
* Criação de `AFC Champions League` e `CAF Champions League` para os clubes de Japão, Arábia Saudita, Coreia do Sul, Egito e África do Sul, substituindo o fallback direto para o Mundial.

### 3.4. Copa do Brasil Expandida (32 / 64 Clubes)
* Introdução de fases preliminares (1ª, 2ª e 3ª fases) com entrada gradual dos clubes de Libertadores na 3ª fase / Oitavas de Final.
