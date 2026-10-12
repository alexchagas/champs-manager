# 06. Diagnóstico do Estado Atual & Análise de Lacunas (Gap Analysis)

Este documento apresenta uma auditoria detalhada do que já foi construído no **Champs Manager** versus os recursos originais do **Brasfoot 22-23**, mapeando com precisão o que está pronto e o que falta implementar.

---

## 1. Resumo do Que Já Foi Desenvolvido

O projeto já possui uma fundação técnica robusta:

```
┌───────────────────────────────────────────────────────────────┐
│                    STATUS ATUAL DO PROJETO                    │
├─────────────────┬─────────────────────────┬───────────────────┤
│ Módulo / Crate  │ Status                  │ Destaques         │
├─────────────────┼─────────────────────────┼───────────────────┤
│ `champs-core`   │ Implementado (Rust)     │ Modelos, calendário, standings, mercado, saves (.cmsav com zstd). │
│ `champs-sim`    │ Implementado (Rust)     │ Motor de 90 min com matrizes anti-goleada e roleta TU/TV/TW/TX.   │
│ `champs-data`   │ Implementado (Rust)     │ Parser Java Serialization (.ban) que converteu 703 times originais.│
│ `wasm_pkg`      │ Compilado (WASM)        │ `WasmCareerEngine` conectando Rust ao TypeScript.                  │
│ `web`           │ Funcional (React/Tailwind)│ Telas de Menu, Visão Geral, Tática, Jogo ao Vivo e Resultados.    │
│ `src-tauri`     │ Configurado (Desktop)   │ Scaffolding pronto para empacotar em executável PC/Mac.            │
└─────────────────┴─────────────────────────┴───────────────────┘
```

---

## 2. Análise de Lacunas: O Que Falta do Brasfoot 22-23

Comparando a experiência completa do Brasfoot com a versão atual do Champs Manager, identificamos as seguintes lacunas divididas em 6 pilares:

### A. Fluxo de Novo Jogo & Base Completa de Clubes
* **Como está hoje:** O jogo inicia com um mock de 20 times brasileiros (`web/src/data/rawClubs.json`) e o Flamengo (ID 255) selecionado por padrão.
* **O que falta:**
  * Integrar a base completa gerada em `data/teams.json` (703 clubes, ligas nacionais das Séries A, B, C, D e principais ligas do mundo).
  * Tela de Novo Jogo completa:
    * Seleção de País e Divisão de início.
    * Busca de time com escudo oficial, reputação (estrelas), capacidade do estádio e cidade.
    * Escolha do nome do técnico humano.
    * Opção de habilitar/desabilitar estaduais e ligas internacionais.

---

### B. Mercado de Transferências & Gestão de Contratos na Interface
* **Como está hoje:** A lógica de mercado existe no backend Rust (`crates/champs-core/src/market.rs`), mas a interface web não tem tela de mercado.
* **O que falta na UI (`TransfersScreen.tsx`):**
  * **Aba Passes Livres (Free Agents):** Jogadores sem clube disponíveis para contratação direta sem taxa de transferência.
  * **Pesquisa de Mercado:** Buscar atletas em outros clubes com filtros por Posição, Força, Idade e Preço.
  * **Fazer Proposta:** Enviar oferta de compra a outro clube com negociação de salário e anos de contrato.
  * **Caixa de Entrada de Ofertas:** Clubes da IA enviando propostas para comprar jogadores do seu time (botões: *Aceitar*, *Recusar*, *Pedir Mais*).
  * **Gestão de Contratos:** Listar anos restantes de contrato dos seus atletas e botão para renovação salarial.

---

### C. Gestão de Estádio & Bilheteria
* **Como está hoje:** O clube tem um estádio com capacidade fixa e saldo financeiro básico.
* **O que falta na UI e Core:**
  * **Expansão de Capacidade:** Botão para construir novas arquibancadas (+2.000, +5.000, +10.000 lugares) pagando custos de reforma proporcionais.
  * **Ajuste de Preço do Ingresso:** Definir o valor do ingresso (ex: R$ 20, R$ 40, R$ 80).
  * **Cálculo de Público Real:** O público pagante varia conforme a fase do time, reputação do adversário e o preço do ingresso cobrado.
  * **Renda Bruta e Líquida:** Crédito da bilheteria ao final de cada partida em casa.

---

### D. Sistema Financeiro Completo & Empréstimos
* **Como está hoje:** Saldo bancário exibido no header.
* **O que falta:**
  * **Empréstimo Bancário:** Possibilidade de pegar empréstimos de emergência no banco (com limite baseado na reputação do clube) e desconto semanal de juros/parcelas.
  * **Painel Financeiro Detalhado:**
    * Receitas: Bilheteria, Premiações de campeonatos, Vendas de jogadores.
    * Despesas: Folha salarial semanal, Obras do estádio, Compras de jogadores, Juros bancários.

---

### E. Categorias de Base (Juniores)
* **Como está hoje:** A struct `Club` possui o vetor `youth: Vec<Player>`, mas não há interface para interagir com eles.
* **O que falta:**
  * Aba ou tela de **Juniores**:
    * Ver os 10 a 15 atletas da base com idade entre 16 e 19 anos.
    * Botão **Promover ao Profissional** (transferindo o jovem para o elenco principal).
    * Botão **Dispensar** da base.
    * Geração automática de novos jovens a cada virada de temporada.

---

### F. Feed de Notícias & Jornal da Rodada
* **Como está hoje:** Apenas os resultados da rodada são mostrados.
* **O que falta:**
  * **Jornal / Notícias da Rodada:**
    * Manchetes de vitórias marcantes e clássicos.
    * Notícias de lesões graves de atletas importantes (tempo de recuperação em semanas).
    * Demissões de técnicos e maiores transferências do mercado.
    * Tabela de artilharia geral (goleadores da Série A/B) e líderes de assistências.
