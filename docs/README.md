# Guia de Documentação Técnica - Champs Manager 2026

Bem-vindo à documentação oficial do **Champs Manager 2026**.

Esta pasta reúne a documentação definitiva da arquitetura, funcionalidades, regras desportivas e decisões de engenharia do projeto.

---

## 📚 Documentos Disponíveis

| Documento | Foco | Descrição |
| --- | --- | --- |
| [**`ARQUITETURA.md`**](./ARQUITETURA.md) | **Arquitetura & Engenharia** | Visão geral do sistema em camadas, interoperabilidade Rust + WebAssembly, fluxo de dados, autoridade de estado e persistência *offline-first* em IndexedDB/LocalStorage. |
| [**`FUNCIONALIDADES.md`**](./FUNCIONALIDADES.md) | **Produto & Interface** | Guia completo de cada tela do jogo (Menu Principal, Visão Geral, Tática, Partida ao Vivo, Mercado de Transferências, Finanças, Juniores, Notícias e Theming). |
| [**`MOTOR_E_REGRAS.md`**](./MOTOR_E_REGRAS.md) | **Motor & Regras** | Modelos matemáticos de forças por setor, loop minuto a minuto, matrizes anti-goleada, regras da IFAB (5 substituições em 3 janelas), lesões, pênaltis e finanças. |
| [**`screenshots/`**](./screenshots/) | **Galeria Visual** | Capturas de tela oficiais em alta resolução demonstrando as interfaces e temas do jogo. |

---

## 🔎 Engenharia Reversa e Origens (`rea/`)

Para aprofundamento histórico e análise das classes do Brasfoot clássico que serviram de inspiração para a concepção deste projeto, consulte a pasta [`rea/`](../rea/):

- [`rea/01_ARCHITECTURE_OVERVIEW.md`](../rea/01_ARCHITECTURE_OVERVIEW.md)
- [`rea/02_DATA_MODELS_AND_PERSISTENCE.md`](../rea/02_DATA_MODELS_AND_PERSISTENCE.md)
- [`rea/03_MATCH_SIMULATION_ENGINE.md`](../rea/03_MATCH_SIMULATION_ENGINE.md)
- [`rea/04_FIDELITY_TESTING_STRATEGY.md`](../rea/04_FIDELITY_TESTING_STRATEGY.md)
- [`rea/05_CHAMPS_MANAGER_ROADMAP.md`](../rea/05_CHAMPS_MANAGER_ROADMAP.md)
- [`rea/06_CURRENT_STATUS_AND_GAP_ANALYSIS.md`](../rea/06_CURRENT_STATUS_AND_GAP_ANALYSIS.md)
- [`rea/07_NEXT_SESSIONS_ROADMAP.md`](../rea/07_NEXT_SESSIONS_ROADMAP.md)

---

## 🚀 Como Executar e Testar

Consulte o [**README principal na raiz do projeto**](../README.md) para instruções completas de como rodar a aplicação web, compilar o motor WebAssembly e executar as suítes de testes automatizados.
