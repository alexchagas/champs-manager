# 04. Estratégia de Validação de Fidelidade & Testes Diferenciais

Para garantir que o **Champs Manager** seja **matematicamente e comportamentalmente idêntico** ao Brasfoot 22-23 (sem alucinações de IA ou desvios na simulação), adotamos uma metodologia científica de **Engenharia Reversa Baseada em Oráculo (Differential Testing)**.

---

## 1. O Problema da Validação em Jogos de Simulação

Em um jogo gerencial, bugs sutis na simulação (ex.: um peso trocado de `0.25` para `0.30` ou uma curva de Poisson incorreta) não causam crashes imediatos, mas desequilibram o ecossistema a médio prazo:
* Excesso de empates em 0x0 ou placares irrealistas de 8x5.
* Zagueiros artilheiros e atacantes sem finalizações.
* Inflação econômica descontrolada após 5 temporadas.

Para evitar isso, o código original do Brasfoot (agora descompilado) atuará como **Oráculo da Verdade**.

---

## 2. A Estratégia dos Três Níveis de Validação

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PIRÂMIDE DE VALIDAÇÃO                             │
├────────────────────────────────────────────────────────────────────────┤
│ Nível 3: Teste Estatístico de Monte Carlo (10.000 jogos)               │
│          • Distribuição de gols (Poisson / Qui-quadrado p > 0.05)      │
│          • Win/Draw/Loss ratio por diferença de força                  │
├────────────────────────────────────────────────────────────────────────┤
│ Nível 2: Teste Determinístico Passo-a-Passo (Seed Fixa)                │
│          • Com a mesma semente RNG, minuto a minuto deve coincidir    │
│          • Mesmo autor do gol, mesmo tipo (falta/pênalti/bola rolando) │
├────────────────────────────────────────────────────────────────────────┤
│ Nível 1: Testes Unitários de Fórmulas Algébricas                       │
│          • B(f_0) para cada uma das 8 posições táticas                │
│          • Roleta de finalização TU / TV / TW / TX                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Protocolo de Teste Diferencial (Monte Carlo)

### Passo 1: Construção do Harness Headless em Java
Criamos um pequeno runner Java que importa as classes originais (`c.b`, `best.ah`, `best.f_0`, `forms.Randoms`) e roda partidas sem interface gráfica (modo headless):

```java
// Java: OracleBenchmark.java
Match match = createFixture(Flamengo, Palmeiras);
for (int i = 0; i < 10000; i++) {
    c.b engine = new c.b(match);
    SimResult res = engine.simulateFullMatch();
    recorder.log(res); // gols, chutes, cartões, posse
}
```

### Passo 2: Execução Equivalente no Champs Manager (Rust)
Executamos o mesmo cenário com os mesmos atributos no motor implementado em Rust:

```rust
// Rust: oracle_benchmark.rs
let match_fixture = create_fixture(flamengo, palmeiras);
for _ in 0..10_000 {
    let mut engine = MatchEngine::new(&match_fixture);
    let res = engine.simulate_full_match();
    recorder.log(res);
}
```

### Passo 3: Teste de Hipótese Estatística
Comparamos os dois datasets gerados via script automatizado em Python/Rust:
1. **Média e Variância de Gols:** A discrepância entre as médias de gols por partida deve ser $< 1.5\%$.
2. **Teste Qui-Quadrado ($\chi^2$ Goodness of Fit):** A distribuição da frequência de placares (ex: 1x0, 2x1, 0x0) do Champs Manager deve ter $p > 0.05$ em relação ao Brasfoot.
3. **Distribuição de Artilharia:** Proporção de gols marcados por atacantes ($>70\%$), meias ($~20\%$), laterais/zagueiros ($<10\%$).

---

## 4. Garantia de Determinismo na Web (WASM)

Para garantir que a versão Web (WebAssembly) produza resultados rigorosamente idênticos ao binário Desktop nativo:

1. **RNG Portável:** Utilizar o algoritmo **PCG64** ou **Xoroshiro128+** configurado com as mesmas primitivas do `forms.Randoms` (distribuições Box-Muller e Poisson com float de 64 bits padrão IEEE 754).
2. **Aritmética Float Estrita:** Evitar otimizações agressivas de ponto flutuante do compilador (`-ffast-math`) que alterem a ordem de arredondamento entre x86_64 e WASM32.
3. **Savegames Portáveis:** O arquivo de save gerado na versão desktop deve abrir identicamente na versão Web rodando no navegador, e vice-versa.
