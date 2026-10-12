# Champs Manager - Rust Crates

Este diretório contém os módulos centrais em **Rust**, responsáveis pela integridade do domínio, determinismo matemático e alta performance do **Champs Manager 2026**.

A mesma base de código em Rust roda no **WebAssembly (WASM)** no navegador e nativamente no executável desktop **Tauri**.

---

## 📦 Módulos do Workspace

```
crates/
├── champs-core/   # Domínio principal, carreira, calendário, persistência e bindings WASM
├── champs-sim/    # Motor de simulação de 90 minutos, sessões determinísticas e oráculo
└── champs-data/   # Parser de formatos legados e importador de dados
```

### 1. `champs-core`
- **Modelos de Dados:** Tipagem estrita para `Player`, `Club`, `Match`, `Tournament`, `SeasonState`.
- **Calendário e Campeonatos:** Geração de tabelas de pontos corridos (Séries A a D, estaduais) e chaveamentos de mata-mata com critérios de desempate e prorrogação/pênaltis.
- **Persistência (.cmsav):** Serialização de saves com compactação Zstandard (`zstd`), preservando integridade e velocidade.
- **WASM Bridge:** Módulo `wasm.rs` e `web_match.rs` que exporta `WasmCareerEngine` e `wasm_match_command` para consumo direto pelo frontend em TypeScript.

### 2. `champs-sim`
- **Sessão da Partida (`session.rs`):** Sessão determinística serializável com relógio por período, RNG de 32 bits, 5 substituições em até 3 oportunidades, parada no intervalo, e suporte a goleiro improvisado e lesões graves.
- **Cálculo Setorial de Forças:** Ponderação tática calibrada para todas as 8 funções em campo (`GOL`, `LAT`, `ZAG`, `VOL`, `MEI`, `ATA`, etc.).
- **Proteção Anti-Goleada:** Matrizes originais do Brasfoot adaptadas para manter placares verossímeis e competitividade equilibrada.

### 3. `champs-data`
- **Parser de Arquivos Legados:** Deserializador do fluxo de objetos Java (`.ban`) para conversão de elencos e clubes originais.
- **Conversão de Escudos e Uniformes:** Normalização de paletas de cores e metadados de estádio.

---

## 🧪 Executando Testes

Para executar toda a suíte de testes Rust:

```bash
cargo test -p champs-core -p champs-sim
```

Todos os 68 testes unitários e de integração cobrem regras de elegibilidade, determinismo, reversão de decisões, substituições atômicas e serialização sem perdas.
