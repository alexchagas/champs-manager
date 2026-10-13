# ADR-001: Balanceamento do Motor de Partida, Sistema de Fadiga e Progressão de Jogadores

## Status
Aceito e Em Execução

## Contexto
Durante a execução de partidas estaduais e nacionais (ex.: Campeonato Mineiro com o Cruzeiro enfrentando clubes menores de divisões inferiores como Betim, Democrata GV, Itabirito, etc.), foram observados três problemas críticos:
1. **Goleadas Absurdas (ex.: 22 a 0)**: O motor de partida interativa (`crates/champs-sim/src/session.rs`) não possuía as matrizes anti-goleada clássicas do Brasfoot (`TU`, `TV`, `TW`, `TX`). A probabilidade de conversão de gols permanecia travada no teto de 28% a cada finalização, independente do placar.
2. **Fadiga Excessiva e Inexistência de Recuperação**: Jogadores titulares perdiam ~14.4% de energia por partida completa (inclusive goleiros), e a passagem de rodada (`advance_to_next_round`) não concedia recuperação para quem jogava. Em 3 a 4 partidas, titulares ficavam completamente esgotados (< 50% de energia), colapsando clubes menores sem elenco profundo.
3. **Ausência de Chance de Zebra e Falta de Progressão**: A disparidade de forças bruta impedia qualquer resistência tática (chance de vitória do time menor era 0.002%), e os atributos dos jogadores eram estáticos (a força nunca evoluía com a idade ou minutagem em campo).

## Decisões Arquiteturais

### 1. Motor de Partida (`champs-sim/src/session.rs`)
- **Anti-Goleada**: Portar a lógica da tabela anti-goleada do Brasfoot (`TU`, `TV`, `TW`, `TX`) para o método `advance_minute()`. A chance de gol por chute passa a ser amortecida conforme os gols já marcados na partida (0-2 gols: padrão ~9.8%; 3-4 gols: ~8.2%; 5 gols: ~5.6%; 6+ gols: ~0.98%).
- **Gestão de Ritmo / Desaceleração**: Quando uma equipe atinge 3+ gols de vantagem, a taxa de criação de novas jogadas de ataque é atenuada, representando a desaceleração natural do futebol real.
- **Efeito Retranca e Congestionamento**: Equipes em posturas defensivas ou formações com 5 defensores (5-4-1, 5-3-2) reduzem a taxa de finalizações cedidas.
- **Variação de Inspiração do Goleiro (Dia de Muralha)**: Adicionar chance de o goleiro estar em dia inspirado, fornecendo defesas difíceis e mantendo a zebra viva.
- **Probabilidades Realistas**: Não utilizar travas duras (hard limits), preservando a chance matemática de goleadas expressivas (ex.: 7x1 ou 8x1) em casos raros de alta variância.

### 2. Sistema de Energia e Fadiga (`web_match.rs` e `wasm.rs`)
- **Dreno Diferenciado por Posição**:
  - Goleiro: dreno mínimo (1% a 2% por 90 min).
  - Zagueiros e Volantes: 7% a 9% por 90 min.
  - Laterais, Meias e Atacantes: 11% a 13% por 90 min.
- **Recuperação Semanal na Virada de Rodada**:
  - Titulares que jogaram 90 min recuperam +8% a +10% de energia entre as rodadas (desgaste líquido real de apenas 3% a 5% por jogo, permitindo sequência de 4 a 6 jogos).
  - Reservas/Poupados recuperam +20% a +25%, retornando a 95%-100% com apenas um jogo de descanso.

### 3. Sistema de Progressão e Evolução de Atletas (`wasm.rs`, `career.rs`)
- Atletas acumulam experiência semanal baseada em idade e minutos jogados.
- Jogadores jovens (sub-21) evoluem mais rápido (+2 a +5 de força por temporada se titulares).
- Jogadores veteranos (32+) iniciam curva de declínio gradual (-1 a -2 de força por ano).
- Força é ajustada de forma persistente.

## Consequências
- Fim dos placares surreais (22x0) mantendo partidas competitivas e emocionantes.
- Clubes pequenos conseguem competir e se recuperar sem esgotamento sistêmico do elenco.
- Modos carreira tornam-se gratificantes ao permitir lapidar jovens talentos e conquistar vitórias táticas memoráveis.
