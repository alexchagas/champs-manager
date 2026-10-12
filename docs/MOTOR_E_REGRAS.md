# Motor de Simulação e Regras de Jogo - Champs Manager 2026

Este documento descreve os modelos matemáticos, as regras desportivas e a lógica econômica implementada nos motores Rust (`champs-core`, `champs-sim`) e na camada de carreira do **Champs Manager 2026**.

---

## 1. Cálculo de Força por Setor

A força coletiva de uma equipe em campo não é uma simples média aritmética, mas sim uma combinação ponderada dos atributos individuais dos 11 atletas escalados, respeitando suas posições e aptidões táticas.

### 1.1. Setores em Campo
O campo de jogo é dividido em três setores principais:
- **Defesa (DEF):** Composta pelo Goleiro (GOL), Zagueiros (ZAG) e Laterais (LAT).
- **Meio-Campo (MEI):** Composto por Volantes (VOL), Meias Centrais (MEI) e Meias Ofensivos.
- **Ataque (ATA):** Composto por Pontas, Meias-Atacantes e Centroavantes/Atacantes (ATA).

### 1.2. Ponderação de Aptidão Natural e Energia
Cada jogador possui uma força nominal $F \in [1, 99]$ e uma energia física $E \in [0, 100]$. A força efetiva $F_{efetiva}$ de um atleta no minuto $t$ considera:

$$F_{efetiva} = F \times \left(0.5 + 0.5 \times \frac{E}{100}\right) \times P_{pos}$$

Onde $P_{pos}$ é a penalidade de posicionamento:
- **Posição Natural:** $P_{pos} = 1.0$ (atleta atuando na sua função de origem).
- **Função Improvisada de Linha:** $P_{pos} = 0.85$ (ex: lateral improvisado na zaga).
- **Goleiro Improvisado de Linha:** $P_{pos} = 0.28$ (quando um atleta de linha vai para o gol por falta de goleiro reserva).

---

## 2. Motor de Simulação dos 90 Minutos

A partida ocorre em um loop discreto minuto a minuto ($t = 1 \dots 90+2$), acionado de maneira incremental.

### 2.1. Roleta de Lances por Minuto
A cada minuto $t$, o motor calcula a probabilidade de ocorrência de um evento com base na comparação das forças do mandante ($H$) e visitante ($A$):
1. **Disputa de Posse:** Definida pela razão entre os setores de meio-campo ($MEI_H$ vs. $MEI_A$).
2. **Geração de Oportunidade:** O time com a posse tenta furar a defesa adversária ($ATA_{ataque}$ vs. $DEF_{defesa}$).
3. **Desfecho do Lance:** Caso a finalização ocorra, a probabilidade de gol é calculada contra o reflexo do goleiro adversário, com possibilidades de:
   - Gol com bola rolando.
   - Defesa espetacular do goleiro.
   - Finalização para fora / na trave.
   - Pênalti ou falta perigosa.
   - Falta com cartão amarelo ou vermelho.
   - Lesão física por choque de jogo.

### 2.2. Matrizes Anti-Goleada (Equilíbrio Estatístico)
Para evitar placares bizarros ou excessivamente discrepantes (ex: 12x0), o motor incorpora matrizes de atenuação inspiradas na calibração histórica do Brasfoot:
- À medida que a vantagem de uma equipe atinge 3 ou 4 gols de diferença, a probabilidade de novas conversões da equipe líder sofre atenuação progressiva, enquanto o ímpeto de reação da equipe em desvantagem recebe leve compensação de esforço.
- Isso reproduz a curva normal observada no futebol profissional, com médias entre 2.2 e 2.8 gols por partida.

---

## 3. Regras Oficiais de Substituição & Incidentes

### 3.1. Cinco Substituições em Três Janelas (IFAB)
- Cada equipe tem direito a substituir até **5 atletas**.
- As substituições durante o tempo regulamentar devem ocorrer em no máximo **3 oportunidades de parada**.
- Múltiplas trocas realizadas na mesma parada consomem apenas 1 oportunidade.
- **Substituições no Intervalo:** Trocas feitas durante o intervalo de jogo (45') são gratuitas e **não gastam** oportunidades de parada.

### 3.2. Banco Convocado Limitado
- A súmula de jogo é congelada no momento do apito inicial.
- Apenas os atletas previamente inscritos no **Banco de Reservas (até 11 atletas elegíveis)** podem entrar em campo.
- Atletas fora da súmula, já substituídos ou expulsos não podem retornar.

### 3.3. Lesão ou Expulsão de Goleiro
- Se o goleiro titular sofrer lesão grave ou expulsão:
  - Havendo goleiro reserva convocado no banco e saldo de substituições, a partida pausa para a decisão humana de substituição.
  - Caso não haja goleiro reserva convocado ou as trocas/janelas estejam esgotadas, um atleta de linha em campo é designado automaticamente para o gol por critério determinístico de aptidão defensiva, recebendo o multiplicador de eficácia de goleiro improvisado ($0.28$).

### 3.4. Decisões Interativas de Pênalti
- Em lances de pênalti a favor da equipe humana, o motor interrompe o relógio e abre a escolha de batedor antes de calcular o desfecho.
- A confirmação do atleta resolve o lance (gol, defesa ou bola na trave) de forma definitiva.

---

## 4. Mata-Mata e Critérios de Desempate

Para fases eliminatórias (Copa do Brasil, mata-matas estaduais e continentais):
- **Jogos Únicos:** Empate no tempo normal leva à prorrogação (2 tempos de 15 minutos) e, persistindo a igualdade, disputa por pênaltis.
- **Jogos de Ida e Volta:** Critério de placar agregado (gols somados das duas partidas). Empate no agregado leva direto para disputa por pênaltis, sem regra de gol qualificado fora de casa.
- **Disputa por Pênaltis:** Série inicial de 5 cobranças alternadas por equipe, seguida de cobranças em morte súbita com ciclos completos de cobradores.

---

## 5. Modelo Econômico e Sustentabilidade da Carreira

### 5.1. Folha Salarial e Escala de Contratos
- Os salários de jogadores profissionais e atletas da base são proporcionais à sua força e reputação de mercado.
- A folha salarial é debitada semanalmente após cada rodada disputada.

### 5.2. Bilheteria Determinística
A arrecadação de cada partida com mando de campo depende da capacidade do estádio, do preço do ingresso e da taxa de ocupação:

$$Público = Capacidade \times Ocupação$$

A taxa de ocupação é modelada por uma curva elástica:
- Ingressos acessíveis (ex: R$ 25 a R$ 40) proporcionam altas taxas de lotação (75% a 90%).
- Preços excessivamente elevados reduzem a presença de torcedores, incentivando a gestão estratégica de preços.
- A renda líquida desconta despesas de operação e manutenção do estádio (aproximadamente R$ 0,70 por assento).

### 5.3. Empréstimos Bancários
- Limite máximo de crédito calculado com base no valor de mercado do elenco e prestígio da divisão.
- Prazos de 10, 15 ou 20 semanas com taxas de juros nominais entre 8% e 15%.
- Parcelas semanais amortizadas automaticamente a cada fechamento de rodada.
