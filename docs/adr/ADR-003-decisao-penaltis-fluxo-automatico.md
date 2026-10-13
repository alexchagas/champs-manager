# ADR-003 / DRI: Fluxo Automático de Decisão por Pênaltis e Eliminação de Spoiler no Placar

## Status
Implementado e Validado

---

## 1. Contexto e Motivação

Durante os confrontos de mata-mata (Copa do Brasil, mata-matas estaduais, fases eliminatórias de competições continentais ou Copa do Mundo), quando a partida ou o placar agregado termina empatado e exige decisão por pênaltis (`phase == "shootout"`), foram identificados três problemas críticos de jogabilidade e sincronização:

1. **Seleção Manual Repetitiva a Cada Cobrança**:
   - Atualmente, o motor (`crates/champs-sim/src/session.rs`) pausa a partida em toda cobrança da equipe do jogador e emite uma `PendingDecision { kind: "penalty" }`.
   - O usuário é forçado a selecionar jogador por jogador em um menu suspenso e bater manualmente a cada cobrança individual (até 10+ vezes se houver alternadas).
   - Isso quebra o dinamismo clássico do jogo, tornando a disputa lenta e cansativa.

2. **Spoiler Visual do Placar do Adversário**:
   - Quando o adversário cobra, o motor Rust resolve a cobrança instantaneamente no mesmo tick (`advance_minute()`), incrementando `session.penalty_score` antes mesmo da animação do lance começar.
   - O placar digital no topo de `LiveMatchScreen.tsx` consome diretamente `session.penaltyScore`, exibindo o gol do adversário no topo segundos antes de a cobrança ser exibida ou animada no modal, arruinando a emoção e o suspense.

3. **Ritmo Quebrado da Disputa**:
   - Em vez de uma sequência contínua, cadenciada e emocionante onde as cobranças vão acontecendo e o usuário acompanha o drama da decisão até a consagração final, o fluxo atual é fragmentado em múltiplos pop-ups e cliques manuais.

---

## 2. Engenharia Reversa do Brasfoot (Referência Canônica)

A engenharia reversa do código-fonte decompilado do Brasfoot (`src_decompiled`) revela com precisão como o jogo original resolve essa mecânica com dinamismo e suspense:

### 2.1. Ordenação Automática dos Batedores (`h.A` / `a_0.abg`)
No Brasfoot, a ordem dos 11 batedores é montada automaticamente a partir dos 11 titulares que terminaram o jogo em campo, utilizando o comparador `h/A.java`:

```java
// h/A.java decompilado
public int a(f_0 p1, f_0 p2) {
    // 1. Posição em campo (Decrescente: ATA > MEI > LAT/ZAG > GOL)
    if (p1.getPosicao() > p2.getPosicao()) return -1;
    if (p1.getPosicao() < p2.getPosicao()) return 1;

    // 2. Força / Overall do Atleta (Decrescente: maior força primeiro)
    if (p1.fi() > p2.fi()) return -1;
    if (p1.fi() < p2.fi()) return 1;

    // 3. Energia / Condição Física (Decrescente: maior energia primeiro)
    if (p1.fp() > p2.fp()) return -1;
    if (p1.fp() < p2.fp()) return 1;

    return 0;
}
```
- **Atacantes** com maior força e energia batem primeiro;
- Seguidos pelos **Meias**, depois **Laterais/Zagueiros**, e por último o **Goleiro**;
- No início da decisão (`a/dV.java` e `a/C.java`), o jogo apenas abre uma tela prévia ("Disputa penalties - ordem dos batedores") onde a lista já vem pronta e o usuário pode apenas clicar em "Jogar" (ou subir/descer a ordem se quiser), **sem nunca ter que escolher jogador por jogador durante as cobranças**.

### 2.2. Execução Sequencial em Dois Estágios sem Spoiler (`a/bg_0.java`)
A tela de disputa de pênaltis do Brasfoot (`a/bg_0.java`) opera com uma máquina de estados baseada em dois timers independentes para cada cobrança:

1. **Estágio 1 - Apresentação do Cobrador (`nJ()` -> 1000ms -> `nL()`):**
   - Exibe na tela: `"<Nome do Jogador> vai pra bola..."`.
   - **O placar e o histórico de cobranças NÃO são atualizados.**
   - Suspense de ~1.5 segundos (`nK()` -> 1500ms).

2. **Estágio 2 - Resolução do Chute (`nM()`):**
   - O resultado é calculado e narrado: `"Gol!!!"` ou `"Perdeu!"`.
   - **Somente agora o placar é incrementado** (`zA[side] += 1`).
   - A tabela/indicadores (bolinhas verdes/vermelhas) são atualizados.
   - O método `cP()` avalia se a disputa acabou:
     - Primeiras 5 cobranças: se a diferença de gols for matematicamente irreversível considerando as cobranças restantes.
     - Alternadas (> 5 cobranças): se ambos tiveram o mesmo número de tentativas e os gols forem desiguais.
   - Se encerrou: `nO()` exibe `"<Nome do Clube> venceu"` e exibe o botão para sair/continuar.
   - Se não encerrou: alterna o time (`zH = 1 <-> 2`) e agenda a próxima cobrança após intervalo de 1000ms.

---

## 3. Especificação de Requisitos (DRI)

### 3.1. Requisitos Funcionais (RF)

- **RF-01 (Ordenação Automática dos Batedores)**:
  - Ao entrar na fase `shootout`, o sistema deve ordenar automaticamente os 11 atletas de linha/goleiro que terminaram a partida em campo para ambos os times.
  - A ordenação padrão deve seguir:
    1. Posição tática: `ATA` > `MEI` > `VOL` > `LAT` > `ZAG` > `GOL`.
    2. Força / Overall: Maior força primeiro.
    3. Energia física atual: Maior energia primeiro.
  - Caso os 11 atletas cobrem e a disputa continue, o ciclo se reinicia a partir do 1º cobrador.

- **RF-02 (Fluxo de Execução Automático e Cadenciado)**:
  - Na disputa por pênaltis de mata-mata, o usuário **não deve** precisar selecionar o jogador manualmente a cada cobrança.
  - As cobranças devem ocorrer de forma autônoma e contínua, alternando entre Mandante e Visitante, até que haja um vencedor matemático oficial.
  - (Opcional pré-disputa): Uma tela/modal inicial rápida de confirmação onde o usuário pode visualizar os 5 primeiros batedores e pressionar "Iniciar Disputa" (ou iniciar automaticamente se o modo for rápido).

- **RF-03 (Eliminação Completa de Spoilers no Placar)**:
  - O placar visível para o usuário durante a disputa (`displayedPenaltyScore`) só deve ser incrementado no momento exato em que o desfecho do chute (Gol / Defesa / Trave / Fora) é revelado na tela e narrado.
  - Sob nenhuma hipótese o placar geral da barra superior ou do painel central deve mostrar o novo placar enquanto o cobrador ainda estiver na fase de preparação ou corrida.

- **RF-04 (Temporização e Emoção dos Lances)**:
  - Cada cobrança deve manter o suspense emocionante através de micro-estágios cronometrados:
    - **Preparação/Anúncio (1.0s a 1.3s)**: `"<Jogador> vai para a cobrança..."`, com efeito sonoro de tensão (`heartbeat`).
    - **Batida / Chute (0.5s)**: Som do chute (`kick.wav`).
    - **Desfecho (1.2s a 1.5s)**: Celebração de `"GOOOOL!"` (com confetes e som de torcida) ou `"DEFENDEU O GOLEIRO!"` / `"NA TRAVE!"` / `"PRA FORA!"`, atualizando o marcador de bolinhas e o placar simultaneamente.
    - **Intervalo de Transição (0.8s a 1.0s)**: Breve respiro antes do cobrador adversário iniciar sua batida.

- **RF-05 (Regras Oficiais de Término IFAB)**:
  - A disputa deve encerrar imediatamente quando:
    - Nas primeiras 5 cobranças: uma equipe não puder mais alcançar a outra, mesmo convertendo todas as suas cobranças restantes.
    - Nas cobranças alternadas (morte súbita após 5 cobranças): ambas as equipes cobraram o mesmo número de pênaltis e uma marcou enquanto a outra errou.

- **RF-06 (Isolamento de Regras: Pênalti no Tempo Normal vs Disputa)**:
  - O pênalti concedido durante os 90 minutos ou prorrogação (`phase in ['first_half', 'second_half', 'extra_time']`) **mantém** o comportamento interativo atual: permite escolher o cobrador, selecionar canto e jogar o mini-game com o goleiro.
  - Apenas a disputa de desempate pós-jogo (`phase == 'shootout'`) adota o fluxo contínuo automatizado.

---

## 4. Arquitetura e Plano de Implementação

### 4.1. Camada de Simulação (`crates/champs-sim/src/session.rs`)
1. **Remoção de Pausa Manual no Shootout**:
   - Em `award_penalty(side)`:
     ```rust
     if self.phase == "shootout" {
         // Não pausa para decisão humana manual interativa.
         // Seleciona automaticamente o próximo batedor da fila de elegíveis ordenada.
         let taker_id = self.get_next_shootout_taker(side);
         self.resolve_penalty(taker_id)?;
         return Ok(());
     }
     ```
   - O motor avança cobrança a cobrança através de ticks regulares ou em lote controlado pelo frontend.

2. **Ordenação Fiel no Rust**:
   - Implementar método `fn sort_shootout_takers(&self, side: usize) -> Vec<u32>` ordenando os titulares ativos por:
     1. Posição (`ATA` = 4, `MEI` = 3, `DEF` = 2, `GOL` = 1)
     2. Força efetiva
     3. Energia física

### 4.2. Camada Web & Frontend (`LiveMatchScreen.tsx` e Types)
1. **Estado de Placar Visual (`revealedPenaltyScore`)**:
   - Criar estado local `displayedPenaltyScore: [number, number]` desacoplado temporariamente do estado cru do motor.
   - Quando um novo evento `shootout_kick` for processado e animado, ao atingir o frame de "desfecho", o `displayedPenaltyScore` é atualizado para igualar a contagem real.
   - No topo da tela (`Digital Score Display`), renderizar `displayedPenaltyScore` durante a fase de `shootout`.

2. **Componente / Modal Dedicado `ShootoutArena`**:
   - Painel imersivo central durante a disputa com:
     - Indicadores de cobranças (5 círculos por equipe: verde = gol, vermelho = erro, cinza = pendente).
     - Nome, foto/avatar e atributos do batedor da vez contra o goleiro adversário.
     - Banner narrativo de suspense:
       - Estágio 1: *"<Nome> ajeita a bola na marca da cal..."*
       - Estágio 2: *"<Nome> partiu pra bola..."*
       - Estágio 3: *"GOOOOOL!"* ou *"DEFENDEU O GOLEIRO!"*
     - Sem necessidade de cliques intermediários: o loop executa sozinho e avança até a consagração.
     - Botão final: *"Encerrar Disputa"* exibindo o time classificado / campeão.

---

## 5. Matriz de Testes e Validação Futura

1. **Teste de Ordenação**:
   - Garantir que atacantes e meias batam as 5 primeiras cobranças e que o goleiro seja o 11º da lista.
2. **Teste Anti-Spoiler**:
   - Monitorar o placar superior no instante do tick: o valor deve permanecer inalterado até o momento exato em que a bola entra na rede ou o goleiro defende.
3. **Teste de Encerramento Matemático**:
   - Série de 5: Ex: Time A abre 3x0 após 3 cobranças de cada -> disputa encerra em 3x0 (impossível virar).
   - Morte súbita: 5x5 nas primeiras 5 cobranças -> 6ª cobrança: Time A faz, Time B erra -> Time A vence por 6x5.
4. **Teste de Não-Regressão**:
   - Pênalti no tempo normal aos 34' do 1º tempo continua abrindo o modal interativo para escolha de cobrador.
