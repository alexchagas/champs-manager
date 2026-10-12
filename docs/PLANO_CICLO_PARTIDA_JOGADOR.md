# Fechar o ciclo da partida do jogador

## Objetivo e decisão de produto

Uma partida iniciada pertence à carreira, não à tela que a mostra. Abrir um menu, consultar o adversário, salvar, recarregar ou voltar à partida conserva minuto, placar, eventos, escalações, decisões e partidas paralelas. A formação escolhida antes do apito inicial fica bloqueada até o fim; durante o jogo o técnico pode trocar atletas, definir cobradores e consultar informações. O resultado da rodada só é consolidado uma vez, depois do encerramento da partida do jogador e das demais partidas da data.

Este é um plano de implementação. Nenhuma mecânica abaixo foi alterada no aplicativo nesta investigação.

## Evidências da engenharia reversa

Artefato analisado: `brasfoot.jar`, SHA-256 `c771b3f009d534d1fc730fa057a7180de93ced2ab52454f5b165c57090f022aa`. As referências `src_decompiled/` são decompilação estática desse artefato; elas mostram caminhos de código, não uma execução observada.

| ID | Observação no Brasfoot de referência | Fonte |
| --- | --- | --- |
| B1 | Cada partida guarda `fR = [5, 5]` como substituições restantes; uma troca decrementa o contador e altera titulares/reservas, produzindo evento do tipo 6. | `src_decompiled/best/I.java:89-95,753-785,1243-1250` |
| B2 | A tela de escalação durante a partida permite alternar mandante/visitante, mostra as substituições restantes e só efetua entrada de reserva quando há saldo. | `src_decompiled/a/cd_0.java:146-173,209-231,484-509` |
| B3 | O modelo original registra eventos distintos para lesão, substituição e pênalti perdido. Lesão remove o atleta em campo e pode acionar troca automática para equipe sem técnico humano. | `src_decompiled/best/aq.java:844-845`, `src_decompiled/best/I.java:647-707`, `src_decompiled/best/A.java:136-147` |
| B4 | Em pênalti de equipe humana, a partida abre uma escolha de cobrador entre atletas em campo antes da cobrança. | `src_decompiled/a/dV.java:739-747,789-801`, `src_decompiled/a/gh.java:42-68,123-130` |
| B5 | O objeto da partida avança lances por etapa (`q`/`vO`) e a interface de rodada atualiza placares enquanto os jogos ocorrem. | `src_decompiled/best/I.java:999-1023`, `src_decompiled/c/b.java:126-155`, `src_decompiled/a/dV.java:730-785` |
| B6 | O pré-jogo separa 11 titulares, até 11 lugares de banco (posições 26–36) e atletas não convocados (a partir da posição 37). Ao jogar, grava o banco escolhido em uma lista distinta da lista de atletas em campo. A escalação automática percorre 11 posições de reserva, incluindo pedidos de goleiro. | `src_decompiled/a/bz.java:552-590,613-681,981-989`, `src_decompiled/best/aq.java:773`, `src_decompiled/best/ah.java:435-466` |
| B7 | O motor original busca o goleiro pelo código tático `1`; se não encontra ninguém nessa posição, usa uma força defensiva mínima (`0.1`). O código analisado não demonstra uma transferência **automática** de um jogador de linha para o gol quando acabam as trocas. | `src_decompiled/c/b.java:220-237`, `src_decompiled/best/I.java:1304-1326` |

**Limites da evidência:** não foi confirmado por execução se o Brasfoot permite navegar por todos os menus durante uma partida nem se aplica três janelas de substituição. A referência B1 confirma cinco atletas, não a regra de janelas. B6 confirma um banco com **até** 11 vagas nessa versão do jogo, não que todas devam ser ocupadas. O goleiro de linha automático é requisito novo do projeto, sem equivalência confirmada no original. A escolha de travar a formação após o início também vem do requisito deste projeto. Não copiar automaticamente probabilidades, duração da lesão ou regras de torneio de uma versão histórica.

## Diagnóstico do projeto atual

| ID | Estado observado | Fonte |
| --- | --- | --- |
| C1 | `LiveMatchScreen` simula os 90 minutos na inicialização e mantém minuto/pausa/velocidade em `useState`; ao desmontar, tudo se perde. | `web/src/components/LiveMatchScreen.tsx:26-55,103-121` |
| C2 | O `Header` chama `setScreen` para qualquer menu; `App` desmonta a tela da partida, e o Escape da partida vai para `overview`. | `web/src/components/Header.tsx:136-165`, `web/src/App.tsx:119-130`, `web/src/components/LiveMatchScreen.tsx:163-173` |
| C3 | `GameState` tem apenas `activeMatchFixtureId?`; não persiste uma sessão de partida. O save grava o `GameState`. | `web/src/types/index.ts:339-367`, `web/src/state/storage.ts:33-64` |
| C4 | O motor Rust simula tudo de uma vez e calcula forças dos setores antes do loop. O fallback JS também simula tudo de uma vez. Trocas posteriores não podem afetar o resultado já calculado. | `crates/champs-sim/src/engine.rs:223-257`, `web/src/engine/simulationEngine.ts:58-150` |
| C5 | Os demais jogos só são simulados em `completeRound`, depois da partida humana; os resultados finais já aparecem em `RoundResultsScreen`. | `web/src/state/GameContext.tsx:551-667`, `web/src/components/RoundResultsScreen.tsx:73-85` |
| C6 | Há opção de cobrador na tela pré-jogo, mas ela não abre decisão durante uma cobrança. Lesões são aplicadas depois da rodada. | `web/src/components/TacticsScreen.tsx:323-368`, `web/src/state/GameContext.tsx:481-548` |
| C7 | `Player` só tem `isStarter`. A tela Tática trata todos os não titulares como reservas; a seleção automática ordena todo o restante do elenco como banco. Não existem convocados limitados nem atletas fora da súmula. | `web/src/types/index.ts:3-25`, `web/src/components/TacticsScreen.tsx:103-115,407-474`, `web/src/engine/wasmBridge.ts:321-325` |
| C8 | O motor atual só recebe os titulares e não modela goleiro improvisado, banco nomeado ou troca de função em campo. | `crates/champs-core/src/wasm.rs:262-277`, `crates/champs-sim/src/engine.rs:18-50,223-257` |

## Regras propostas

1. **Estados:** `pre_match → first_half → halftime → second_half → (extra_time → shootout, se a competição exigir) → full_time → committed`. `paused` é um atributo da sessão, não uma nova partida. Minutos de acréscimo devem ser representados como período + minuto, evitando colisão entre `45+2` e `47` do segundo tempo.
2. **Convocação e escalação:** a preparação separa **titulares**, **banco convocado** e **fora da súmula**. O perfil inicial reproduz o máximo de **11 reservas** do artefato B6; o limite é uma configuração da competição. Selecionar um banco não marca esses atletas como titulares. Exibir contagem `n/11`, posição e elegibilidade, permitir incluir/remover até o limite e oferecer convocação automática que prioriza cobertura de goleiro sem exigir um segundo goleiro quando não houver um disponível. Atleta lesionado/suspenso não entra na súmula; o mesmo ID não pode ocupar dois grupos. O botão “Jogar” valida 11 titulares e o banco antes de congelar titulares, convocados, formação e posições. Os atletas fora da súmula não entram durante a partida, mesmo que estejam saudáveis no elenco. A tela de jogo exibe ambas as formações; a do adversário é somente leitura. O comando global de tática não pode alterar formação, convocação ou titulares da carreira enquanto a sessão estiver ativa.
3. **Substituições:** perfil padrão de até cinco atletas e três oportunidades de interrupção por equipe; substituições no intervalo não gastam oportunidade. Várias trocas na mesma interrupção gastam uma oportunidade. Apenas quem foi convocado ao banco antes do jogo pode entrar. Contar saldo de atletas e saldo de oportunidades separadamente; expulsos ou já substituídos não voltam. Lesões comuns não concedem troca extra. Regras especiais de prorrogação ou concussão são parâmetros da competição, não exceções embutidas no motor. A [Lei 3 da IFAB](https://www.theifab.com/laws/latest/the-players/) permite até cinco trocas e exige que cada competição defina quantos reservas podem ser inscritos (de 3 a 15 em competições oficiais). As 11 vagas são decisão de fidelidade ao artefato, não um limite universal do futebol atual.
4. **Incidentes e goleiro:** uma lesão suspende a partida humana, identifica o jogador, severidade e elegíveis para entrar. Se o lesionado for o goleiro e houver troca disponível **e** goleiro elegível no banco, oferecer a substituição e pausar até a escolha; a IA faz a troca válida. Sem goleiro no banco, designar automaticamente um jogador de linha **já em campo** para o gol; se ainda houver troca válida, permitir que um reserva convocado entre para recompor a linha. Se não houver troca ou oportunidade, o improvisado permanece e a equipe joga com um atleta a menos. Mudar a função de alguém em campo não consome substituição nem oportunidade. A escolha automática deve ser determinística (prioridade por aptidão defensiva/força/energia, desempate por ID) e registrada como evento de troca de função. O atleta mantém identidade e estatísticas, passa a ocupar o posto de goleiro e recebe desempenho de goleiro improvisado calculado com penalidade explícita, sem herdar a força de um goleiro natural nem usar o fallback `0.1` do original. Recalcular a defesa para os lances seguintes. Se o goleiro sair por expulsão, manter a garantia de haver goleiro em campo; eventual entrada do goleiro reserva exige retirar outro atleta de linha, pois o expulso não pode ser substituído diretamente. No final, registrar cartões, fadiga, estatísticas e afastamento exatamente uma vez.
5. **Pênalti:** criar um evento de pênalti **antes** do resultado. Se for a favor do jogador, pausar e escolher entre atletas aptos em campo, com o cobrador pré-configurado selecionado por padrão. Persistir a escolha e só então resolver gol/defesa/erro, sem resultado predeterminado. Para adversário, a IA escolhe. A disputa por pênaltis de mata-mata é fluxo separado, com ordem de cobradores e regras da competição.
6. **Placar paralelo:** simular cada confronto da mesma data de forma determinística com semente derivada de carreira + temporada + ID da partida. Guardar seus eventos e revelar somente até o minuto atual. Alternância opcional entre “mesma competição” e “todos os jogos da data”; opção de ocultar placares ao vivo. Não incluir confrontos de outra data ou revelar resultados futuros. Ao final, a mesma projeção alimenta `RoundResultsScreen` e as tabelas.
7. **Navegação e save:** menus de consulta/áudio/opções abrem sobre a sessão pausada e oferecem “Voltar à partida”. A aba Tática durante jogo aponta para a escalação da sessão e desabilita formação. Ações de nova carreira, carregar outro save e avançar rodada devem exigir uma decisão explícita sobre a partida em curso. Recarregar o aplicativo restaura a sessão e a projeção dos jogos paralelos; o relógio não avança em segundo plano.

## Contrato técnico sugerido

`GameState.activeMatch?: ActiveMatchSession` com `schemaVersion` próprio e campos `fixtureId`, `phase`, `clock`, `paused`, `seed/rngState`, `home/away {formation, starterIds, namedSubstituteIds, offSheetIds, onFieldRoleByPlayerId, temporaryGoalkeeperId?, substitutionsUsed, opportunitiesUsed, unavailableIds}`, `events`, `score`, `stats`, `pendingDecision`, `parallelMatches`, `committedAt?`. O planejamento pré-jogo guarda os IDs do banco selecionado; não basta derivá-lo de `!isStarter`. IDs de eventos estáveis (`fixtureId + sequência`) e comandos `setMatchBench`, `startMatch`, `advanceToNextEvent`, `substitute`, `assignEmergencyGoalkeeper`, `choosePenaltyTaker`, `pause/resume`, `finishMatch`, `commitRound` são validados no motor. Comandos inválidos retornam erro sem alterar estado. `assignEmergencyGoalkeeper` é aplicado automaticamente quando necessário, embora possa existir como operação interna para testes/replay.

A sessão deve viver no domínio/motor Rust e ser serializável pelo WASM; React apenas renderiza e despacha comandos. Preservar a mesma semântica no fallback JS ou remover o fallback quando o motor Rust incremental estiver disponível em todos os ambientes. `completeRound` recebe o resultado **fechado** da sessão, sem re-simular o confronto humano ou os paralelos. O `WebGameState` tem campos extras preservados por `serde(flatten)`, mas o novo contrato deve ser tipado nos dois lados e migrado em saves antigos. Um save antigo sem `activeMatch` abre em pré-jogo.

## Backlog ordenado e critérios de aceite

| Ordem | Entrega | Critério verificável |
| --- | --- | --- |
| P0.1 | Sessão persistente + roteamento de menus | Iniciar jogo, chegar a 37', abrir Jornal e voltar mantém fixture, 37', placar, eventos e velocidade; recarregar o aplicativo também. Não há segundo sorteio. |
| P0.2 | Motor incremental determinístico | Mesma semente e comandos geram o mesmo log e placar; uma troca aos 60' altera somente cálculos posteriores. Pausar, salvar e retomar equivale a execução contínua. |
| P0.3 | Encerramento transacional | Duplo clique/atalho em “concluir” não duplica pontos, finanças, fadiga, notícias ou rodada. Resultado exibido é o que foi simulado. |
| P1.1 | Formação travada + painel das duas equipes | Formação inicial visível e imutável após início; adversário consultável; ninguém altera o elenco da carreira por outro menu durante a partida. |
| P1.2 | Convocação do banco no planejamento | Escolher até 11 nomes distintos e elegíveis, editar antes do início, ver quem ficou fora da súmula. O 12º é rejeitado; o não convocado não aparece como opção de troca. Convocação automática inclui goleiro quando disponível e respeita o limite. Salvar/recarregar conserva a escolha. |
| P1.3 | Trocas e janelas | Exibir `0–5` trocas e `0–3` oportunidades. Testar múltiplas trocas na mesma parada, intervalo gratuito, sexta troca rejeitada, quarta parada rejeitada e reserva já usado. |
| P1.4 | Lesão, expulsão e goleiro improvisado | Se goleiro se lesiona com reserva convocado e saldo, aparece a escolha. Sem goleiro no banco, um jogador de linha em campo assume automaticamente; se houver troca válida, outro convocado pode recompor a linha. Sem troca, o time segue com um atleta a menos. A defesa e eventos futuros usam a nova função; save/replay mantém o mesmo improvisado. Estatísticas e indisponibilidade pós-jogo persistem. |
| P1.5 | Pênalti interativo + cobranças fixas | Modal de escolha pausa o relógio; só atletas elegíveis aparecem; escolhido cobra; save com modal aberto restaura a mesma decisão. Gols de pênalti contabilizam corretamente. |
| P2.1 | Placar paralelo opcional | Listagem por competição/data e atualização até o minuto corrente; opção de ocultar; nenhum placar futuro vaza. |
| P2.2 | Fecho de rodada e torneios | Final do jogo leva aos placares da data; tabelas e chaveamento usam os mesmos resultados; prorrogação/disputa por pênaltis funcionam quando necessárias. |

## Ordem de implementação por arquivos

1. Modelar sessão e comandos em `crates/champs-sim/src/engine.rs` e expor tipos/serialização em `crates/champs-core/src/wasm.rs`.
2. Adicionar tipos e migração em `web/src/types/index.ts` e `web/src/engine/careerEconomy.ts`; integrar persistência em `web/src/state/GameContext.tsx` e `web/src/state/storage.ts`.
3. Trocar a geração em `LiveMatchScreen.tsx` por leitura da sessão; adaptar `Header.tsx`, `App.tsx` e `TacticsScreen.tsx` para navegação, convocação do banco e modo de partida.
4. Gerar e exibir confrontos paralelos a partir dos fixtures da data; fazer `completeRound` consumir o fechamento idempotente e atualizar `RoundResultsScreen.tsx`.
5. Verificar com testes de domínio (reprodução, limite do banco, elegibilidade, incidentes, goleiro improvisado, retomada e idempotência) e fluxos de UI: partida normal, banco completo, goleiro lesionado com/sem troca, pênalti com navegação e mata-mata empatado.

## Pontos ainda a confirmar

- Quais competições do calendário terão prorrogação, disputa por pênaltis e substituição extra; usar as regras existentes em `crates/champs-core/src/calendar.rs` como ponto de partida.
- Se o usuário deseja permitir mudanças de mentalidade e cobradores de falta/escanteio durante o jogo. O bloqueio da formação e as substituições já são requisitos explícitos.
- Se “acompanhar outros jogos” deve iniciar por padrão ou ficar desligado; o plano prevê opção configurável e filtro por data/competição.

**Definição de pronto do ciclo:** uma carreira salva pode iniciar, jogar, interromper, navegar, retomar e encerrar uma partida com decisões que mudam lances futuros; os demais placares seguem o mesmo relógio e a rodada é consolidada uma única vez.
