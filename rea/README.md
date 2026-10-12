# Engenharia Reversa e Análise de Referência (`rea/`)

Este diretório contém o arquivo documental da **engenharia reversa do Brasfoot 22-23 clássico**, conduzida para extrair a lógica matemática, modelos de dados e padrões que serviram de base para a criação do **Champs Manager 2026**.

---

## 🗂️ Documentos da Pasta `rea/`

| Arquivo | Tópico |
| --- | --- |
| [**`01_ARCHITECTURE_OVERVIEW.md`**](./01_ARCHITECTURE_OVERVIEW.md) | Mapeamento comparativo entre a arquitetura legada e a nova arquitetura do Champs Manager. |
| [**`02_DATA_MODELS_AND_PERSISTENCE.md`**](./02_DATA_MODELS_AND_PERSISTENCE.md) | Estrutura de dados original em Java Serialization (.ban) mapeada para structs Rust. |
| [**`03_MATCH_SIMULATION_ENGINE.md`**](./03_MATCH_SIMULATION_ENGINE.md) | Análise matemática do motor original de lances, forças e distribuição estatística de gols. |
| [**`04_FIDELITY_TESTING_STRATEGY.md`**](./04_FIDELITY_TESTING_STRATEGY.md) | Estratégia de testes de Monte Carlo para validação da equivalência estatística. |
| [**`05_CHAMPS_MANAGER_ROADMAP.md`**](./05_CHAMPS_MANAGER_ROADMAP.md) | Planejamento estratégico em fases de implementação (Core, Engine, Parser, Carreira, UI). |
| [**`06_CURRENT_STATUS_AND_GAP_ANALYSIS.md`**](./06_CURRENT_STATUS_AND_GAP_ANALYSIS.md) | Auditoria dos 6 pilares de funcionalidades do Brasfoot (todos 100% implementados). |
| [**`07_NEXT_SESSIONS_ROADMAP.md`**](./07_NEXT_SESSIONS_ROADMAP.md) | Histórico de entregas das sessões modulares do projeto (Sessões 7 a 10 finalizadas). |

---

> Para a documentação da arquitetura e das funcionalidades ativas do Champs Manager, consulte [`docs/`](../docs/).
