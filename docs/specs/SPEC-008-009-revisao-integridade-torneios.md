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

## 2. Bloqueios Técnicos e Roadmap da Expansão da Libertadores para 32 Clubes (SPEC-008)

Conforme instrução expressa de integridade ("não simular/falsear se a arquitetura atual não suportar com segurança"), a expansão da Copa Libertadores para 32 clubes permanece documentada como bloqueador ativo até que as seguintes dependências estruturais sejam resolvidas:

### 2.1. Bloqueadores Arquiteturais Identificados:
1. **Motor de Chaveamento (`qualification.ts`):**
   - O método `resolvePendingFixtures` está estritamente acoplado a 4 grupos de 4 times (`'ABCD'`) e transiciona diretamente da fase de grupos para as **Quartas de Final** (`quartersFirst.length === 4`).
   - Um torneio de 32 clubes requer 8 grupos ($A$ a $H$, 16 classificados) e uma fase preliminar de **Oitavas de Final** (8 confrontos em ida e volta = 16 partidas).
2. **Grade de Datas no Calendário Anual (`calendarGenerator.ts`):**
   - O segundo semestre possui 12 datas de quarta-feira reservadas para torneios continentais (6 rodadas de grupos + 2 datas para Quartas + 2 datas para Semis + 2 datas para Final).
   - A inclusão de Oitavas de Final exige 2 datas adicionais de quarta-feira (14 semanas de quartas-feiras), o que colide diretamente com o calendário de datas da Copa do Brasil (quintas-feiras e quartas concorrentes) e com as rodadas de meio de semana das Séries A e B.
3. **Mapeamento de Grupos no Estado Global (`initialData.ts` / `GameContext.tsx`):**
   - A lógica de indexação de grupos continentais hardcoda `'ABCD'[Math.floor(idx / 4)] || 'A'`. A expansão exigirá suporte a `'ABCDEFGH'`.
4. **Visualização em `ClubOverview.tsx`:**
   - O filtro de grupos continentais e o painel de classificação esperam 4 grupos de 4 times. A UI precisará de paginação ou abas deslizantes para exibir 8 grupos sem quebra de layout mobile.

### 2.2. Ações Planejadas para Conclusão do SPEC-008:
* **Fase 1 (Chaveamento Genérico):** Estender `qualification.ts` para suportar `Oitavas de Final` continental tanto para Libertadores quanto para UEFA Champions League.
* **Fase 2 (Calendário Harmônico):** Realocar datas da Copa do Brasil e antecipar rodadas da fase de grupos continental para liberar as 2 datas de quarta-feira necessárias para as Oitavas.
* **Fase 3 (Ativação Segura):** Atualizar o pote de seleção de `getContinentalTournamentField` para 32 clubes após homologação dos testes de regressão de calendário completo.
