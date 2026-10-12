# 05. Planejamento Estratégico & Roadmap do Champs Manager

Este documento define a arquitetura tecnológica, a divisão em fases modulares e a estratégia para conduzir o desenvolvimento do **Champs Manager** através de múltiplos agentes e sessões sem estouro de contexto e sem alucinação.

---

## 1. Arquitetura Tecnológica Recomendada

Para atender o requisito de **"jogar no browser e também ter um instalador desktop leve igual ao Brasfoot"**, a arquitetura recomendada é:

```
┌────────────────────────────────────────────────────────┐
│               CHAMPS MANAGER ARCHITECTURE              │
├────────────────────────────────────────────────────────┤
│                    UI LAYER (Web)                      │
│   • HTML5 / TypeScript / Tailwind CSS / Svelte ou React │
│   • Responsivo, suporte a temas clássicos e modernos  │
├──────────────────────────┬─────────────────────────────┤
│    DESKTOP (PC / Mac)    │         WEB BROWSER         │
│   • Tauri (Rust Webview) │   • WebAssembly (WASM)      │
│   • < 15 MB de instalador│   • Executa 100% no cliente │
│   • Acesso ao disco local│   • Saves em IndexedDB / OPFS│
├──────────────────────────┴─────────────────────────────┤
│                   CORE ENGINE (Rust)                   │
│   • `champs-core`: crate pura sem dependência de UI    │
│   • Modelos de dados, Motor de partida, Economia       │
│   • 100% determinístico e testável                     │
└────────────────────────────────────────────────────────┘
```

### Vantagens dessa Escolha:
1. **Single Source of Truth:** A mesma lógica em Rust roda tanto no executável Desktop (via Tauri) quanto no navegador (compilada para WASM). Zero duplicação de regras.
2. **Performance Imbatível:** A simulação de uma rodada de 20 jogos leva milissegundos em Rust/WASM, sem engasgos de interface.
3. **Distribuição Simplificada:** Você gera o `.exe` / `.dmg` instalável para quem quer jogar offline e hospeda uma versão online para jogar no navegador de qualquer dispositivo.

---

## 2. Estratégia Anti-Delírio & Gestão de Janela de Contexto

Tentar implementar o jogo inteiro em uma única sessão causa perda de contexto, esquecimento de regras e código incompleto. A estratégia para manter o desenvolvimento consistente envolve:

1. **Spec-Driven Development:** Toda decisão técnica já está fixada nesta pasta `rea/`. Nenhuma sessão ou subagente pode inventar regras; tudo deve referenciar os documentos `01`, `02`, `03` e `04`.
2. **Contratos e Testes de Aceitação Rígidos:** Cada fase possui uma suíte de testes automatizados (`cargo test`). Uma fase só é considerada concluída quando todos os testes passam.
3. **Módulos Isolados (Crates):**
   * `champs-core`: Lógica matemática, regras e estado.
   * `champs-data`: Importador de dados históricos e times.
   * `champs-sim`: Engine de simulação e oráculo de testes.
   * `champs-web`: Interface e bindings WASM.

---

## 3. Roadmap de Implementação em Fases

### Fase 1: Fundação do Core & Modelos de Dados (Rust)
* **Objetivo:** Criar a estrutura básica do projeto Rust (`champs-core`).
* **Entregáveis:**
  * Structs fortemente tipadas: `Player`, `Club`, `Match`, `Tournament`, `SeasonState`.
  * Conversão de atributos e características especiais (`Skill`).
  * Serialização e persistência moderna (JSON + Bincode comprimido).
* **Critério de Aceitação:** Testes unitários de serialização e desserialização salvando e carregando um estado de temporada completo.

### Fase 2: Motor de Simulação de Partida & Oráculo
* **Objetivo:** Portar a classe `c.b` e `forms.Randoms` para Rust.
* **Entregáveis:**
  * Algoritmo de cálculo de força ponderada por função tática (`B(f_0)`).
  * Loop de 90 minutos de lances com proteção anti-goleada (`TU`, `TV`, `TW`, `TX`).
  * Distribuição estatística de gols (bola rolando, pênaltis, faltas, gols contra, escanteios).
* **Critério de Aceitação:** Teste de Monte Carlo de 10.000 partidas rodado contra os dados de referência do Brasfoot, confirmando equivalência estatística ($\chi^2$ com $p > 0.05$).

### Fase 3: Importador de Dados do Brasfoot (`teams/*.ban` & Ligas)
* **Objetivo:** Capacidade de importar diretamente a base de dados original de times e ligas do Brasfoot para o formato do Champs Manager.
* **Entregáveis:**
  * Parser do formato `.ban` (Java Serialization stream parser em Rust/Python).
  * Conversão de todos os 700+ times e escudos para o catálogo do Champs Manager.
* **Critério de Aceitação:** Todos os 710 times da pasta `teams/` importados com elencos e atributos íntegros.

### Fase 4: Gestão de Carreira, Calendário e Torneios
* **Objetivo:** Loop macro do gerenciamento de futebol.
* **Entregáveis:**
  * Gerador de tabela (pontos corridos, mata-mata com ida e volta).
  * Mercado de transferências, propostas, contratos e salários.
  * Sistema de energia física e recuperação pós-jogo.
  * Cartões amarelos acumulados (suspensão automática após 3 amarelos).
* **Critério de Aceitação:** Simulação autônoma de 5 temporadas completas sem falhas numéricas ou inflação descontrolada.

### Fase 5: Interface Web & Empacotamento Desktop (Tauri + WASM)
* **Objetivo:** Construir a interface visual interativa e empacotar para Web e Desktop.
* **Entregáveis:**
  * Interface retrô-moderna inspirada no Brasfoot (tabela de classificação, escalação tática arrastável, tela de partida ao vivo com placar e narração de lances).
  * Compilação WASM para rodar em browsers.
  * Configuração do Tauri para gerar os instaladores `.dmg` (macOS) e `.exe` (Windows).
* **Critério de Aceitação:** Aplicação abrindo no navegador e no desktop nativo, permitindo jogar uma carreira completa do início ao fim.
