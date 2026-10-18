# SPEC-010: Sistema de Confiança, Reputação, Demissão, Desemprego e Propostas de Clubes (Engenharia Reversa do Brasfoot)

| Metadado | Detalhes |
| :--- | :--- |
| **Status** | Proposto / Especificação Técnica & Engenharia Reversa |
| **Data** | 17/10/2026 |
| **Autor** | Antigravity AI & Alex Chagas |
| **Módulos Afetados** | `web/src/engine/careerEconomy.ts`, `web/src/state/GameContext.tsx`, `web/src/types/index.ts`, `web/src/components/ClubOverview.tsx`, `web/src/components/ManagersScreen.tsx` + Novos Modais de Demissão e Propostas |
| **Referências do Brasfoot** | `best/al.java`, `best/ah.java`, `best/ay.java`, `best/Z.java`, `f/s.java`, `best/f.java`, `best/a_0.java`, `best/aq.java`, `a/dm_0.java`, `a/go_0.java`, `a/gE.java` |

---

## 1. Contexto do Problema Atual no Champs Manager

Atualmente, a dinâmica de carreira do treinador humano no **Champs Manager** apresenta lacunas importantes em relação ao ciclo clássico do Brasfoot:

1. **Ausência de separação entre Confiança da Diretoria, Confiança da Torcida e Reputação:**
   * Em [`careerEconomy.ts`](../../web/src/engine/careerEconomy.ts), existe apenas `boardRating` (iniciando em `60` na criação e `55` ao trocar de clube) e `reputation` (iniciando em `50` numa escala de `0-100`, ou `100` após ganhar Copa do Mundo).
   * Não existe a barra independente de **Confiança da Torcida** nem o efeito de pressão da arquibancada sobre a diretoria.
2. **Queda e subida de confiança pouco sensíveis ao contexto real da partida:**
   * Em `scoreManagers()` (`careerEconomy.ts:172`), a confiança varia por `(points - job.initialExpectation) * 3`, ignorando se o jogo foi em casa ou fora, se houve goleada ($\ge 3$ gols de diferença), se o adversário era muito mais fraco ou se o clube está na zona de rebaixamento (Z4).
3. **Demissão silenciosa e sem estado real de Desempregado:**
   * Em `changeManagers()` (`careerEconomy.ts:185`), quando `boardRating < 20` após 5 jogos, o treinador humano tem `currentClubId = undefined` e `available = true`, mas **nenhum modal de demissão é exibido** e `gameState.userClubId` continua apontando para o clube antigo.
   * Na tela [`ManagersScreen.tsx`](../../web/src/components/ManagersScreen.tsx), aparece um bloco estático (`gameState.clubs.filter(c => c.id !== gameState.userClubId).slice(0, 6)`) que permite assumir imediatamente os 6 primeiros clubes da lista (geralmente clubes de elite da Série A), sem período de espera e sem filtro de reputação/crise.
4. **Inexistência de Convites para Treinador Empregado ("Assédio do Mercado"):**
   * Um treinador que está fazendo excelente campanha em um clube menor ou conquistando títulos nunca recebe convites oficiais de clubes maiores no meio ou ao final da temporada.

---

## 2. Engenharia Reversa Completa do Brasfoot (`brasfoot.jar`)

Abaixo está o mapeamento exato extraído do código decompilado (`src_decompiled/`).

### 2.1. Atributos do Treinador (`best/al.java`)

Na classe `best.al` (entidade `Tecnico`), os campos de estado da carreira são:

| Campo (`al.java`) | Getter / Setter | Valor Inicial | Escala / Significado |
| :--- | :--- | :---: | :--- |
| `of` | `lL()` / `cl(int)` / `cj(int)` | **`95`** | **Confiança da Diretoria** (`0` a `100%`). Recalculada a cada jogo e título; resetada para `95` ao assumir novo clube (`al.E(ah)`). |
| `og` | `lM()` / `cm(int)` / `ck(int)` | **`85`** | **Confiança da Torcida** (`0` a `100%`). Recalculada a cada jogo e título; resetada para `85` ao assumir novo clube (`al.E(ah)`). |
| `nc` | `getReputacao()` / `setReputacao(int)` | Herda do clube (`1..5`) ou `3` se iniciar sem clube | **Nível de Reputação** (`0` a `5`), mapeado em `aq.pZ`: `0 = Municipal`, `1 = Estadual`, `2 = Regional`, `3 = Nacional`, `4 = Continental`, `5 = Mundial`. |
| `nu` | Acumulador interno (`al.a` e `al.kk`) | `0` | **Pontos Ocultos de Prestígio** acumulados por títulos e vices para subir/descer a reputação `nc` no fim do ano. |
| `oc` | `lI()` | `0` | **Pontuação no Ranking de Técnicos** (soma pontos por vitória, empate e classificações em torneios). |
| `bZ` | `cr()` | `0` | Total de títulos na carreira. |
| `nV` / `bW` | `fg()` / `n(ah)` | Clube atual (`null` / `-1` se desempregado) | Referência ao clube atualmente comandado. |
| `nW` / `nX` | `lF()` / `B(ah)` | `null` / `-1` | **Último clube que demitiu o técnico** (usado para impedir que o mesmo clube envie proposta logo após demiti-lo). |
| `nY` | `lG()` / `ch(int)` | `divisao - 1` | Índice da última divisão em que trabalhou (`0` = 1ª Divisão, `1` = 2ª Divisão, etc.). |
| `bf` | `bz()` / `v(int)` | `pais` do clube | ID do país onde o treinador está trabalhando/trabalhou por último. |
| `nZ` | `lE()` / `cg(int)` | Nacionalidade | ID do país de nacionalidade do treinador. |

> **Recuperação na Virada de Temporada (`best/f.java:1191` — método `ag()`):**
> Ao encerrar a temporada, todo treinador que permanece empregado recebe `+50` de Confiança da Diretoria (`cj(50)`) e `+50` de Confiança da Torcida (`ck(50)`), respeitando o teto de `100`.

---

### 2.2. Cálculo de Confiança Pós-Partida (`best/al.java:163` — método `a(I i2, boolean bl, int n2)`)

Após cada partida (`I i2`), o Brasfoot executa o método `al.a(i2, bl, n2)` com a seguinte sequência exata:

#### Passo 1: Variáveis de Contexto da Partida
* `bl4`: `false` se o clube do técnico jogou **em casa** (`hc()`), `true` se jogou **fora de casa** (`hd()`).
* `n6`: Diferença de nível entre os clubes: `meuClube.getNivel() - adversario.getNivel()`. (Se `n6 >= 0`, meu time é igual ou mais forte que o adversário; se `n6 < 0`, meu time é mais fraco).
* `n5`: Resultado da partida:
  * `0` = Empate (`n3 == n4`)
  * `1` = Vitória (`n3 > n4`)
  * `2` = Derrota (`n3 < n4`)
* `bl5`: Flag de **Goleada** (`true` quando `|n3 - n4| >= 3`).
* `n7`: Tipo de competição (`i2.hy().b()`):
  * `1` = Campeonato Nacional (Séries A, B, C, D)
  * `2` = Copa Nacional (Copa do Brasil)
  * `3` = Campeonato Estadual
  * `4` = Continental Principal (Libertadores / Champions)
  * `6` = Continental Secundário (Sul-Americana / Liga Europa)
  * `10` = Regional (Copa do Nordeste / Copa Verde)

#### Passo 2: Penalidade/Bônus Preliminar por Favoritismo e Mando (`al.java:218-232`)
Antes de olhar a tabela do campeonato, o jogo compara o resultado com a diferença de nível (`n6`):
* **Se empatou (`n5 == 0`):**
  * Jogando **em casa** contra time igual ou mais fraco (`n6 >= 0 && !bl4`): **Diretoria `-1`, Torcida `-1`**.
  * Contra time mais forte (`n6 < 0`): **Diretoria `+1`**.
* **Se perdeu (`n5 == 2`):**
  * Jogando **em casa** contra time igual ou mais fraco (`n6 >= 0 && !bl4`): **Diretoria `-3`, Torcida `-3`**.
  * Jogando **fora de casa** contra time igual ou mais fraco (`n6 >= 0 && bl4`): **Diretoria `-1`**.

#### Passo 3: Faixa de Posição na Tabela (`n8` calculado em `best/ah.java:1611` — método `p(at)`)
Para jogos de pontos corridos (Nacional `n7 == 1` ou Estadual `n7 == 3`), o método `ah.p(at)` classifica a posição atual `pos` do time em uma faixa `n8` de `1` a `5` (sendo `total` o número de clubes, `reb` o número de rebaixados, `classif` = 4 no Nacional ou 2 no Estadual, e `margem` = 4 se `total >= 20` ou 2 se `< 20`):
* **`n8 = 1`:** Líder isolado (`pos == 1`) — ou valor padrão para fases de mata-mata (`!bl7`).
* **`n8 = 2`:** Zona de classificação / topo (`pos <= classif`).
* **`n8 = 3`:** Meio de tabela confortável (`pos <= total - (reb + margem)`).
* **`n8 = 4`:** Beira da zona de rebaixamento (`pos > total - (reb + margem)` e fora do Z4).
* **`n8 = 5`:** Dentro da **Zona de Rebaixamento (Z4)** (`pos > total - reb`).

#### Passo 4: Penalidade Financeira por Saldo Negativo (`al.java:257, 307, 356, 405`)
Se o treinador for humano (`jZ() == true`) e o saldo bancário do clube estiver negativo (`fg().kb() < 0L`):
* Em jogos da **Liga Nacional (`n7 == 1`)**: **Diretoria `-10`** imediatamente!
* Nas **demais competições**: **Diretoria `-5`** imediatamente!

#### Passo 5: Matriz de Variação da Confiança da Diretoria (`cj`) por Faixa `n8` (`1..5`)

| Competição (`n7`) | Resultado (`n5`) | Em Casa (`!bl4`) por faixa `[1, 2, 3, 4, 5]` | Fora de Casa (`bl4`) por faixa `[1, 2, 3, 4, 5]` |
| :--- | :--- | :---: | :---: |
| **Liga Nacional (`1`)** e **Copas (`2`, outros)** | **Vitória (`1`)** | `[+5, +4, +1, +1,  0]` | `[+6, +5, +2, +2, +1]` |
| | **Empate (`0`)** | `[+2, +1, -1, -1, -3]` | `[+2, +1,  0, -1, -2]` |
| | **Derrota (`2`)** | `[-2, -2, -3, -5, -7]` | `[-1, -1, -2, -4, -5]` |
| **Estadual / Regional (`3`, `10`)** | **Vitória (`1`)** | `[+2, +2, +1, +1, +1]` | `[+3, +2, +2, +2, +1]` |
| | **Empate (`0`)** | `[+1, +1,  0,  0, -1]` | `[+1, +1, +1,  0, -1]` |
| | **Derrota (`2`)** | `[-2, -2, -3, -3, -5]` | `[-1, -1, -2, -2, -3]` |
| **Continental (`4`, `6`)** | **Vitória (`1`)** | `[+5, +4, +3, +3, +3]` | `[+7, +6, +4, +4, +5]` |
| | **Empate (`0`)** | `[+2, +1,  0, -1, -3]` | `[+2, +1,  0,  0, -2]` |
| | **Derrota (`2`)** | `[-2, -2, -3, -3, -5]` | `[-1, -1, -2, -2, -3]` |

#### Passo 6: Variação da Confiança da Torcida (`ck`) e Goleadas (`al.java:475-517`)
* **Empate (`n5 == 0`):**
  * Em casa: **`-1`** | Fora de casa: **`+1`**.
* **Vitória (`n5 == 1`):**
  * Base: Em casa **`+3`** | Fora de casa **`+4`**.
  * Se foi **Goleada (`bl5`, $\ge 3$ gols de saldo)**: soma mais **`+4` (casa)** ou **`+5` (fora)** (totalizando `+7` ou `+9` na Torcida) e, se for clássico (`i2.ic()`), envia mensagem `"Parabéns pela goleada!"`.
* **Derrota (`n5 == 2`):**
  * Base: Em casa **`-5`** | Fora de casa **`-4`**.
  * Se sofreu **Goleada (`bl5`, $\ge 3$ gols de diferença)**: perde mais **`-7` (casa)** ou **`-5` (fora)** (totalizando **`-12` em casa** ou **`-9` fora**!) e dispara mensagem de protesto da torcida (`"Não aceitamos goleadas!"` / `"Desse jeito você vai cair"`).

#### Passo 7: Contágio Torcida $\rightarrow$ Diretoria (`al.java:518-520`)
```java
if (this.og < 20) {
    this.cj(-3);
}
```
Se após o jogo a **Confiança da Torcida estiver abaixo de 20%**, a pressão da arquibancada retira mais **`-3` pontos da Confiança da Diretoria**!

#### Passo 8: Bônus de Confiança por Títulos (`al.java:921` — método `q(at)`)
Quando o treinador é campeão de um torneio (`n2 == 1`):
* **Liga Nacional (1ª Divisão):** Torcida **`+40`**, Diretoria **`+30`**.
* **Liga Nacional (Divisões de acesso):** Torcida **`+20`**, Diretoria **`+10`**.
* **Estadual (1ª Divisão):** Torcida **`+20`**, Diretoria **`+15`** (`+10` na 2ª divisão).
* **Supercopa (`b == 11`):** Torcida **`+10`**.
* **Copa Nacional, Libertadores/Champions, Sul-Americana, Mundial (`b == 2, 4, 5, 6, 12`):** Torcida **`+30`**, Diretoria **`+30`**.

---

### 2.3. Evolução e Decaimento da Reputação do Técnico (`al.java:1065-1150`)

O Brasfoot usa um acumulador oculto `nu` para calcular a reputação em estrelas (`nc` de `1` a `5`):

1. **Ganho de Pontos de Prestígio (`al.a(int viceOuCampeao, int tipoTorneio, int subTipo, boolean elite, int continente)`):**
   * Ao ser **Campeão (`n2 == 0`)** ou **Vice (`n2 == 1`)**:
     * **Mundial de Clubes (`5`):** Campeão `+10.000`, Vice `+1.000`
     * **Continental Principal (`4` — Libertadores/Champions):** Campeão `+6.000`, Vice `+1.000`
     * **Continental Secundário (`6` / `12` — Sul-Americana/Conference):** Campeão `+2.000` a `+3.000`, Vice `+300` a `+500`
     * **Liga Nacional 1ª Divisão (`1`):** Campeão `+600`, Vice `+150` (Divisões inferiores: `+50`)
     * **Copa Nacional (`2`):** Campeão `+500`, Vice `+150`
     * **Recopa (`8`) / Supercopa (`11`) / Regional (`10`):** Campeão `+500` / `+100` / `+50`
     * **Estadual (`3`):** Campeão `+30`, Vice `+5`
     * **Copa do Mundo (`7`, `n4 == 7`):** Campeão `+23.000`, Vice `+2.000` (Copa continental de seleção: `+6.000`)
2. **Atualização e Decaimento no Fim da Temporada (`al.kk()` em `al.java:1109`):**
   * Na virada de ano (`f.iZ()`), o técnico sofre cobrança proporcional à sua reputação atual:
     * Se `nc == 5` (Mundial): `nu -= 6000`. Se `nu < -20000`, cai para `nc = 4` e `nu = 0`.
     * Se `nc == 4` (Continental): `nu -= 600`. Se `nu < -3000`, cai para `nc = 3` e `nu = 0`.
     * Se `nc == 3` (Nacional) e atua em liga nacional: `nu -= 50`. Se `nu < -500`, cai para `nc = 2` e `nu = 0`.
     * Se `nc == 2` (Regional) e atua em liga nacional: `nu -= 5`. Se `nu < -50`, cai para `nc = 1` e `nu = 0`.
   * Em seguida, verifica os limiares de subida (`if (n2 > this.nc) this.nc = n2`):
     * `nu > 22.000` $\rightarrow$ **`5` (Mundial)**
     * `nu > 10.000` $\rightarrow$ **`4` (Continental)**
     * `nu > 1.000` $\rightarrow$ **`3` (Nacional)**
     * `nu > 100` $\rightarrow$ **`2` (Regional)**
     * `nu > 10` $\rightarrow$ **`1` (Estadual)**

---

### 2.4. Regra de Demissão (`f/s.java:1721` e `a/dm_0.java`)

Ao encerrar cada rodada de Campeonato Nacional (`n2 == 1`) ou Estadual (`n2 == 3`), o método `f.n(int n2)` chama `s.A(arrayList)` para verificar demissões em todos os clubes da competição:

```java
if (((ah)this.yK().get(n2)).ka() != null && ((ah)this.yK().get(n2)).ka().lL() < 10) {
    if (((ah)this.yK().get(n2)).jZ().booleanValue()) {
        int n3 = ((ah)this.yK().get(n2)).kb() < 0L ? 1 : new Random().nextInt(2) + 2;
        al al2 = ((ah)this.yK().get(n2)).ka();
        al al3 = ((ah)this.yK().get(n2)).kE();
        s_0.a(al2, al3, (ah)this.yK().get(n2), n3);
        arrayList.add(new h((ah)this.yK().get(n2), al2, al3, n3));
    } else if (n2 > 5) {
        // Demissão de técnico da IA (apenas se estiver abaixo do 6º lugar na tabela)
    }
}
```

* **Gatilho exato:** `Confiança da Diretoria < 10%` (`lL() < 10`).
* **Motivos da Demissão (`aq.sg`):**
  * `0`: *"você solicitou a demiss\u00e3o."* (quando o jogador pede demissão no menu)
  * `1`: *"você estava levando o clube para o abismo financeiro."* (quando `saldo < 0`)
  * `2`: *"a pressão da torcida estava grande pelos maus resultados."*
  * `3`: *"seus resultados não agradaram nem a torcida nem a diretoria."*
* **O que acontece no estado do jogo (`al.i(al2)` em `al.java:733`):**
  1. Registra a troca no histórico de demissões da temporada (`a.SR.bn().add(u_02)`).
  2. Salva o clube atual como ` último clube ` (`this.B(this.fg())`), salva o país (`bf`) e a divisão (`nY = divisao - 1`) via `lN()`.
  3. Desmarca o clube como controlado por humano (`fg().k(false)`), remove da lista de clubes humanos (`a.SR.aN().remove(this.fg())`), limpa o técnico do clube e define `this.n(null)` (o técnico humano agora tem `fg() == null`, ou seja, **está desempregado**).
  4. O clube contrata imediatamente um substituto da IA compatível com sua reputação (`ah.kE()`).
  5. Exibe o modal **`a/dm_0.java` ("Demitido!")** com a mensagem: *"Você foi demitido. A razão foi: [motivo]. Para o seu lugar foi contratado: [novo técnico]. Agora, espere por propostas de outros times."*

---

### 2.5. Período Desempregado e Propostas de Clubes (`best/f.java:1732`, `best/ay.java:200`, `best/Z.java:1005`, `f/s.java:1409`)

Como funciona o período sem clube depois de ser demitido:

1. **Ordem de execução em `f.n(int n2)` (`best/f.java:1729-1755`):**
   * Em toda rodada de Liga Nacional (`n2 == 1`) ou Estadual (`n2 == 3`), o jogo **primeiro** verifica quem já estava desempregado (`fg() == null`) e gera propostas (`a.afQ.b(al, false)`), e **só depois** executa `Z.A()` / `w.A()` que demite quem caiu abaixo de 10% naquela rodada!
   * Isso garante que o técnico **nunca recebe proposta no mesmo dia em que é demitido**: ele fica desempregado, avança o calendário assistindo às rodadas seguintes e, na próxima checagem de rodada nacional/estadual, recebe a janela de convites (`go_0`).
   * Se o jogador clicar em **"Rejeitar todos"** no modal de convites (`go_0`), ele permanece desempregado e novas propostas serão geradas nas rodadas seguintes!
2. **Quais clubes enviam proposta para o técnico desempregado (`ay.b(al, false)` $\rightarrow$ `Z.a()` $\rightarrow$ `s.b()`):**
   * O método `Z.a(arrayList, al2, bl, bl2)` cruza a **última divisão em que o técnico trabalhou (`n2 = al2.lG()`)** com uma roleta probabilística (`n3 = Random.nextInt(1000)`) para escolher de quais divisões virão os convites:
     * Se estava na **1ª Divisão (`n2 == 0`)**: recebe convites da 2ª e 3ª divisões (50% de chance), apenas da 3ª divisão (30% de chance), ou nenhum naquela rodada (`nArrayArray5[0]` é todo `-1`, 20% de chance de ter que esperar mais rodadas!).
     * Se estava na **2ª Divisão (`n2 == 1`)**: recebe convites da 2ª, 3ª e 4ª divisões (ou apenas da 2ª e 3ª).
     * Se estava na **3ª ou 4ª Divisão (`n2 == 2, 3`)**: recebe convites da 3ª e 4ª divisões (e da divisão de acesso).
   * Dentro de cada divisão sorteada, `f/s.java:1409` (`b(arrayList, al2, bl = false)`) seleciona clubes que estão nas **últimas 6 posições da tabela de classificação** (`n2 = this.Zb.size() - 6` até `Zb.size()`), embaralha e escolhe 1 por faixa, **excluindo o clube que acabou de demitir o treinador** (`this.Zb.get(n4) != al2.lF()`).

---

### 2.6. Convites para Treinador Empregado ("Assédio de Outros Clubes" — `best/ay.java:238` e `best/a_0.java:608`)

Quando o treinador **está empregado** (`fg() != null`), o Brasfoot também envia propostas para ele trocar de clube através do método `ay.zw()`:

```java
public void zw() {
    int n2 = 0;
    while (n2 < a.SR.M().size()) {
        ArrayList arrayList;
        if (((al)a.SR.M().get(n2)).jZ().booleanValue() && ((al)a.SR.M().get(n2)).fg() != null && (arrayList = this.b((al)a.SR.M().get(n2), true)) != null && arrayList.size() > 0) {
            s_0.a(arrayList, (al)a.SR.M().get(n2), 0);
        }
        ++n2;
    }
}
```

* **Quando `zw()` é disparado:**
  1. **Durante a temporada (gatilho `"cPromocao"` no calendário `a_0.java:608`):** Em datas específicas do calendário (transição de fases / meio para reta final da temporada).
  2. **Ao final da temporada (`best/f.java:1652`):** Logo após a última rodada do ano, antes de abrir a tela de resumo da temporada (`s_0.aY(6)`).
* **Diferença de quando está empregado (`bl = true` em `ay.b(al, true)` e `s.b(arrayList, al, true)`):**
  * Em `f/s.java:1413`: Quando `bl == true`, em vez de pegar os últimos 6 colocados (zona de rebaixamento), o jogo seleciona clubes situados entre o **3º e o 6º lugar da tabela** (`n2 = 2; n3 = 6`)!
  * Além disso, em `ay.java:211`: Se o treinador estiver na 1ª ou 2ª divisão (`lG() < 2`) ou tiver **Reputação $> 3$ (Continental ou Mundial)**, o jogo também sorteia propostas de **clubes de outros países** (`arrayList2`, limitado a até 6 propostas no total)!

---

### 2.7. Central de Empregos (`a/gE.java` e `best/ay.java:164`)

Além dos convites passivos, o Brasfoot possui no menu a **Central de Empregos (`a/gE.java`)**:
* O método `ay.zj()` coleta até 3 clubes aleatórios da **metade inferior da tabela** (`n2 = size / 2` até `size`) de cada divisão ativa.
* A tela `gE.Ax()` filtra esses clubes pela **Reputação do Treinador (`Es.getReputacao()`)**:
  * **Rep 5 (Mundial):** 1 clube de 5★, 1 de 4★, 2 de 3★, 1 de 2★, 1 de 1★.
  * **Rep 4 (Continental):** 1 de 4★, 1 de 3★, 2 de 2★, 1 de 1★.
  * **Rep 3 (Nacional):** 1 de 3★, 2 de 2★, 1 de 1★.
  * **Rep 2 (Regional):** 2 de 3★, 2 de 2★, 1 de 1★.
  * **Rep 1 (Estadual/Municipal):** 2 de 2★, 2 de 1★.
* O jogador pode a qualquer momento abrir a Central de Empregos (ou pedir demissão no menu) para assumir um desses clubes disponíveis.

---

## 3. Especificação do Que Queremos Implementar no Champs Manager

### 3.1. Modelo de Dados (`web/src/types/index.ts`)
1. Atualizar a interface `Manager`:
   * `boardRating: number` (Confiança da Diretoria: `0` a `100`, iniciando em **`95`** ao assumir um clube).
   * `fanRating: number` (Confiança da Torcida: `0` a `100`, iniciando em **`85`** ao assumir um clube).
   * `reputation: number` (`0` a `100` para exibição percentual/progresso) + `reputationLevel: number` (`1` a `5` estrelas: *Estadual, Regional, Nacional, Continental, Mundial*, iniciando com a reputação em estrelas do clube escolhido).
   * `prestigePoints: number` (acumulador `nu` alimentado por títulos, vices e campanhas).
   * `lastFiredClubId?: number` e `lastDivision?: number` (equivalentes a `lF()` e `lG()` do Brasfoot).
   * `unemployedRounds?: number` (contador de rodadas desempregado para controlar o tempo de espera até chegarem propostas).
2. Adicionar estruturas de eventos/modais em `GameState`:
   * `pendingDismissal?: { clubId: number; clubName: string; reason: string; replacementCoach: string; round: number; seasonYear: number }`: dispara o **Modal de Demissão**.
   * `clubJobOffers?: ClubJobOffer[]`: lista de convites oficiais recebidos pelo treinador (tanto quando está desempregado após o período de espera quanto quando está empregado e recebe convites de outros clubes).

### 3.2. Motor de Confiança e Reputação (`web/src/engine/careerEconomy.ts`)
1. **Recálculo Pós-Partida Fiel ao Brasfoot (`scoreManagers`):**
   * Calcular mando de campo (`isHome`), diferença de força/nível (`levelDiff`), resultado (Vitória/Empate/Derrota), flag de goleada (`goalDiff >= 3`) e faixa na tabela (`1` = Líder, `2` = G4/Classificação, `3` = Meio, `4` = Alerta, `5` = Z4).
   * Aplicar as matrizes de variação na **Confiança da Diretoria (`boardRating`)** e **Confiança da Torcida (`fanRating`)**.
   * Aplicar penalidade financeira se `club.balance < 0` (`-10` no Nacional, `-5` nos demais) ou salários atrasados.
   * Aplicar o contágio da arquibancada: se `fanRating < 20`, descontar `-3` extras de `boardRating`.
   * Conceder os bônus de confiança e pontos de prestígio (`prestigePoints`) ao conquistar títulos (`detectNewlyCompletedCompetitions`).
   * Na virada de temporada (`rolloverManagers`), somar `+50` em `boardRating` e `+50` em `fanRating` (até `100`) e atualizar `reputationLevel` (`1..5`) conforme os limiares de `prestigePoints`.

### 3.3. Demissão e Período Desempregado (`careerEconomy.ts` e `GameContext.tsx`)
1. **Gatilho de Demissão (`boardRating < 10`):**
   * Quando a Confiança da Diretoria do treinador humano cair abaixo de **10%** (após pelo menos 5 jogos no cargo), demitir o treinador:
     * Gerar `pendingDismissal` com o motivo contextual (crise financeira se `balance < 0`, pressão da torcida se `fanRating < 20`, ou maus resultados) e o nome do novo técnico contratado pelo clube.
     * Desvincular o treinador humano do clube (`currentClubId = undefined`, `available = true`, `lastFiredClubId = club.id`, `unemployedRounds = 0`).
2. **Experiência Desempregado (Período de Espera Real):**
   * Ao fechar o Modal de Demissão, o jogador entra em **Modo Desempregado** (`human.available === true` / sem clube ativo).
   * Não é permitido escolher imediatamente qualquer clube da Série A: o jogador avança as semanas/rodadas (simulando a rodada rapidamente em background).
   * Após um período de espera de **1 a 3 rodadas** (`unemployedRounds >= 1` com sorteio probabilístico idêntico ao Brasfoot), o motor gera de **2 a 5 propostas (`clubJobOffers`)** vindas de clubes em crise (últimos 6 colocados da tabela) de divisões compatíveis com a reputação/última divisão do treinador (nunca do clube que acabou de demiti-lo).
   * Abre-se o **Modal de Convites de Clubes**, onde o jogador pode inspecionar elenco/finanças/posição na tabela de cada clube e clicar em **Assumir Clube** ou **Recusar Todas e Aguardar Mais Propostas**.

### 3.4. Convites para Treinador Empregado ("Assédio do Mercado") e Central de Empregos
1. **Convites Estando Empregado:**
   * Em duas janelas da temporada — **transição do 1º para o 2º semestre / metade do Nacional** e **final da temporada** — se o treinador humano estiver com bom desempenho (`boardRating >= 75` ou título conquistado na temporada), sortear de **2 a 4 convites oficiais** de clubes bem posicionados (3º ao 6º lugar) da mesma divisão, de uma divisão acima ou de outros países (se reputação $\ge 4$).
   * Exibir o **Modal de Convites de Clubes** permitindo **Aceitar o Convite** (trocando de clube imediatamente e preservando o histórico no clube anterior) ou **Permanecer no Clube Atual**.
2. **Central de Empregos e Pedido de Demissão Voluntária (`ManagersScreen.tsx`):**
   * Na tela de Carreira dos Técnicos (`ManagersScreen.tsx`), substituir a lista fixa de 6 clubes por uma **Central de Empregos** fiel ao `a/gE.java`: listar vagas abertas em clubes da metade inferior da tabela filtrados pela reputação do treinador, além de um botão **"Pedir Demissão"** com confirmação.

---

## 4. Critérios de Aceite (Checklist de Implementação)

- [ ] **CA-01:** Novo jogo e posse em novo clube iniciam com **95% de Confiança da Diretoria**, **85% de Confiança da Torcida** e **Reputação** compatível com o clube inicial (exibindo estrelas/nível `Municipal` a `Mundial` e percentual).
- [ ] **CA-02:** `ClubOverview.tsx` e `ManagersScreen.tsx` exibem tanto a **Confiança da Diretoria** quanto a **Confiança da Torcida** e o nível de **Reputação**.
- [ ] **CA-03:** Sequências de derrotas (especialmente em casa contra times mais fracos, goleadas $\ge 3$ gols, entrada no Z4 ou saldo negativo) reduzem a confiança da torcida e da diretoria segundo as matrizes do Brasfoot, gerando manchetes de pressão/protesto.
- [ ] **CA-04:** Ao cair abaixo de **10% de Confiança da Diretoria**, o treinador humano é demitido e recebe imediatamente o **Modal de Demissão** com escudo do clube, motivo e técnico substituto.
- [ ] **CA-05:** Após ser demitido, o treinador fica desempregado (sem clube ativo) e precisa avançar rodadas até receber propostas reais de clubes da parte baixa da tabela compatíveis com sua divisão/reputação (excluindo o clube que o demitiu).
- [ ] **CA-06:** Treinador empregado com boa campanha/títulos recebe convites de outros clubes em janelas da temporada (meio do ano e fim de temporada), podendo aceitar mudar de clube ou recusar e continuar no clube atual.
- [ ] **CA-07:** A aba `Carreira dos Técnicos` (`ManagersScreen.tsx`) conta com a **Central de Empregos** filtrada por reputação e opção de **Pedir Demissão**.
