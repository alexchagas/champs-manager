# 03. Motor de Simulação de Partidas - Brasfoot 22-23

Este documento descreve as fórmulas exatas, probabilidades e algoritmos matemáticos do motor de simulação de partidas de 90 minutos do Brasfoot (classe `c.b` e gerador `forms.Randoms`).

---

## 1. Visão Geral do Ciclo da Partida

Uma partida é instanciada por `c.b(best.I partida)`.
O confronto é disputado em iterações discretas de lances (`vO()`):

```
                   [Início do Tick: vO()]
                             │
                             ▼
                 [Disputa de Meio: vR()]
                 /                    \
     [Posse Mandante (TB=0)]   [Posse Visitante (TB=1)]
                │                         │
                └────────────┬────────────┘
                             ▼
                [Tentativa de Criação: vS()]
                 /                        \
      [Sucesso: vS() == 0]          [Falha: vS() != 0]
              │                              │
              ▼                              ▼
     [Finalização: vT()]            [Desarme / Interceptação]
      • Gol                         [Alterna Posse: vP()]
      • Defesa Goleiro
      • Chute Fora
```

---

## 2. Cálculo da Força Efetiva do Jogador em Campo (`B(f_0)`)

O método `c.b.B(f_0)` calcula a contribuição matemática de cada jogador conforme sua posição tática no gramado (`fT()`):

### Pesos Ponderados por Função Tática:

| Posição Tática | Código (`fT`) | Fórmula de Força Efetiva |
| :--- | :--- | :--- |
| **Goleiro** | `1` | `(Defesa * 0.60) + (Reflexo * 0.15) + (Posicionamento * 0.15) + (Passe * 0.10)` |
| **Zagueiro** | `3..8` | `(Desarme * 0.50) + (Cabeceio * 0.25) + (Passe * 0.10) + (Velocidade * 0.10) + (Armação * 0.05)` |
| **Lateral** | `2, 9` | `(Desarme * 0.40) + (Cruzamento * 0.30) + (Cabeceio * 0.10) + (Velocidade * 0.10) + (Armação * 0.05) + (Finalização * 0.05)` |
| **Volante** | `11..13` | `(Desarme * 0.40) + (Passe * 0.20) + (Cabeceio * 0.15) + (Armação * 0.10) + (Velocidade * 0.10) + (Finalização * 0.05)` |
| **Meia Central** | `14..16` | `(Armação * 0.40) + (Passe * 0.25) + (Finalização * 0.10) + (Cabeceio * 0.10) + (Velocidade * 0.10) + (Desarme * 0.05)` |
| **Ponta / Meia-Ofensivo**| `10, 17` | `(Passe * 0.25) + (Cabeceio * 0.25) + (Armação * 0.20) + (Velocidade * 0.15) + (Finalização * 0.10) + (Desarme * 0.05)` |
| **Atacante / Centroavante**| `19..24` | `(Finalização * 0.40) + (Cabeceio * 0.25) + (Velocidade * 0.25) + (Passe * 0.05) + (Armação * 0.05)` |
| **Segundo Atacante** | `18, 25` | `(Finalização * 0.40) + (Passe * 0.25) + (Velocidade * 0.15) + (Cruzamento * 0.15) + (Armação * 0.05)` |

### Modificadores de Condição:
* **Fadiga Extrema / Jogador Fora de Posição:** Se a flag `gF()` for verdadeira, a força sofre penalidade imediata de **50%**:
  $$\text{Força Final} = \text{round}(\text{Força} \times 0.5)$$
* **Piso Mínimo:** Se $\text{Força} \le 0$, ela é fixada em $1$.
* **Ajuste por Reputação do Adversário:** Jogadores de clubes com reputação muito baixa contra times de reputação alta sofrem decaimento de até $35\%$ no rendimento relativo.

---

## 3. Resolução da Chance de Gol (`vT()`)

Quando um ataque fura as linhas adversárias, o método `vT()` resolve o resultado do chute.

### A. Matriz Base de Probabilidade de Finalização
A roleta de finalização parte de um vetor estático `[Gol, Defesa Goleiro, Chute Fora]`:

$$\text{Matriz Padrão (TU)} = [5.5, \; 35.55, \; 15.0]$$

### B. Mecanismo de Proteção Anti-Goleada (*Rubber Banding*)
Conforme a equipe acumula gols na partida, a chance de novos gols decresce dinamicamente:

| Gols Já Marcados pelo Time | Matriz Utilizada | Peso do Gol | Efeito Prático |
| :--- | :--- | :--- | :--- |
| **0 a 2 gols** | `TU` | **5.5** | Taxa de conversão padrão |
| **3 a 4 gols** | `TV` | **4.5** | Leve amortecimento |
| **5 gols** | `TW` | **3.0** | Dificulta o 6º gol |
| **$\ge 6$ gols** | `TX` | **0.5** | Bloqueio quase total de novos gols |
| **$\ge 2$ gols contra time mais forte** | `TW` | **3.0** | Efeito "zebra" estabiliza |

### C. Fator Mando de Campo
Se a partida não for em campo neutro (`!TD`):
* O time mandante ganha bônus de $+0.1$ na eficiência ofensiva e defensiva.
* O time visitante sofre redução de $-0.1$.

---

## 4. Distribuição do Tipo de Gol Marcado

Quando o sorteio resulta em gol, o método `c.b.a(A, f_0)` sorteia um inteiro entre `0` e `999` para determinar a natureza do tento:

```
[0 .................... 899] -> 90.0%: Gol de Bola Rolando Normal (com Assistência)
[900 ........... 949]        ->  5.0%: Gol de Pênalti (Cobrador ke())
[950 ..... 979]              ->  3.0%: Gol de Falta Direta (Cobrador ke())
[980 .. 989]                 ->  1.0%: Gol Contra (Defensor adversário vV())
[990 . 994]                  ->  0.5%: Gol de Cabeça / Escanteio (Cobrador lq())
[995 .. 999]                 ->  0.5%: Gol Normal (Fallback)
```

### Atribuição de Assistência:
* No gol normal, o método `C(f_0)` sorteia um passador entre os jogadores de meio/laterais escalados.
* O atleta recebe $+1$ assistência na carreira e estatísticas do campeonato (`gV()`).

---

## 5. Distribuições Estatísticas em `forms.Randoms`

A classe `forms.Randoms` estende `java.util.Random` implementando modelos estocásticos formais:

1. **Processo de Poisson (`q(double lambda)`):**
   * Usado para modelar eventos raros em intervalos de tempo fixos (ocorrência de faltas, cartões e gols):
     $$P(k) = \frac{\lambda^k e^{-\lambda}}{k!}$$
2. **Distribuição Normal / Box-Muller (`nextGaussian()`):**
   * Utilizada para oscilação de rendimento individual e fadiga jogo a jogo.
3. **Distribuições Gama (`s(alpha)`) e Beta (`i(alpha, beta)`):**
   * Utilizadas para sorteio de orçamentos, curvas de idade/evolução e oscilações do mercado de transferências.
