# ⚽ Champs Manager 2026

> **O clássico gerenciador de futebol (football manager) inspirado no nostálgico Brasfoot, reconstruído para a web moderna e desktop com alta longevidade, determinismo matemático e performance extrema.**

[![Rust](https://img.shields.io/badge/Rust-1.85%2B-orange?logo=rust)](https://www.rust-lang.org/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-WASM-654FF0?logo=webassembly)](https://webassembly.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri)](https://tauri.app/)
[![Tests](https://img.shields.io/badge/Tests-100%25%20Passing-brightgreen)](#-qualidade-e-testes)

---

## 📸 Demonstração Visual

### Visão Geral do Clube & Campeonato
A experiência clássica de comandar seu clube: tabela de classificação com zonas de competição, calendário de rodadas, estádio oficial e projeção financeira em tempo real com **Theming Dinâmico** baseado nas cores do time.

![Visão Geral do Clube](docs/screenshots/overview.png)

---

### Partida ao Vivo Minuto a Minuto (Rust + WASM)
Simulação lance a lance com motor determinístico: narração em português, 5 substituições em até 3 oportunidades, parada no intervalo, decisões interativas de pênaltis e lesões graves.

![Partida ao Vivo](docs/screenshots/match_live.png)

---

### Prancheta Tática & Convocação de Súmula
Gramado tático interativo com posicionamento geométrico para todas as formações (4-4-2, 4-3-3, 3-5-2, etc.), arrastar e soltar de titulares, banco convocado com até 11 reservas e seleção de capitão e batedores oficiais.

![Prancheta Tática](docs/screenshots/tactics.png)

---

### Menu Principal & Base Global de Mais de 3.200 Clubes
Selecione qualquer clube do Brasil (Séries A, B, C, D, Estaduais e Divisões de Acesso) ou das principais ligas de 224 países do mundo, com escudos oficiais, técnicos e editor de dados integrado.

![Menu Principal](docs/screenshots/main_menu.png)

---

### Mercado de Transferências & Passes Livres
Busque atletas por filtros avançados de posição, força e idade, contrate jogadores sem contrato na aba de Passes Livres, faça propostas de compra a outros clubes e gerencie renovações salariais.

![Mercado de Transferências](docs/screenshots/transfers.png)

---

### Gestão Financeira, Estádio & Empréstimos
Expanda a capacidade do seu estádio, defina o preço dos ingressos por jogo, contrate empréstimos bancários com simulação de parcelas e acompanhe o demonstrativo semanal de receitas e despesas.

![Finanças e Estádio](docs/screenshots/finances.png)

---

## 🎯 Sobre o Projeto & Filosofia

O **Champs Manager** nasceu do amor e da nostalgia pelo clássico **Brasfoot**, que marcou gerações de fãs de futebol com sua jogabilidade dinâmica, rápida e viciante: abrir o jogo, escalar os 11 titulares, ajustar a tática, acompanhar a rodada e vibrar a cada gol.

### 🌟 Por que reimaginar para a Web e Desktop?

1. **Acessibilidade Universal & Longevidade:** Jogos legados muitas vezes dependem de ambientes Java antigos, executáveis legados de 32 bits ou instaladores que deixam de funcionar em novos sistemas operacionais. O Champs Manager foi arquitetado para durar: roda nativamente em qualquer navegador moderno (Chrome, Safari, Firefox, Edge) e em qualquer dispositivo, além de contar com suporte a executáveis leves para desktop (< 15 MB via Tauri para macOS e Windows).
2. **Offline-First & Independência de Servidores:** O jogo não depende de servidores centrais, APIs pagas ou conexões com a internet. Toda a simulação e os dados de save rodam **100% no cliente** (com persistência em IndexedDB e LocalStorage). O jogo funcionará daqui a 10 ou 20 anos exatamente da mesma forma.
3. **Determinismo Matemático em Rust:** O motor de simulação de 90 minutos, a integridade da carreira e as regras de torneios foram construídos em **Rust** e compilados para **WebAssembly (WASM)**. Isso garante que a mesma lógica execute com consistência matemática absoluta, sem bugs de arredondamento em ponto flutuante de JavaScript e com desempenho na casa dos milissegundos.
4. **Identidade Visual Imersiva:** Inspirado nas tabelas densas e compactas que cabem na tela sem rolagem do Brasfoot clássico, mas elevado por um sistema moderno de **Design Tokens Dinâmicos** (`Club Atmospheric Theming`): ao jogar com o Flamengo, a interface assume tons rubro-negros; com o Cruzeiro ou Grêmio, tons de azul meia-noite; com o Santos ou Corinthians, tons alvinegros obsidiana; e com o Palmeiras, verde esmeralda.

---

## 🏆 Principais Recursos do Jogo

- **Base de Dados Global com Mais de 3.200 Clubes (3.216 equipes):**
  - Pirâmide do futebol brasileiro completa: Séries A, B, C, D, Campeonatos Estaduais e Divisões de Acesso.
  - Ligas internacionais completas de 224 países.
  - Mais de 76.500 atletas cadastrados com idades, forças, atributos e contratos.
- **Ciclo da Partida Robusto e Autêntico:**
  - Simulação lance a lance minuto a minuto com proteção anti-goleada calibrada.
  - Regra oficial de 5 substituições em até 3 janelas de parada, além de substituições gratuitas no intervalo.
  - Escolha interativa de cobrador de pênalti em tempo real.
  - Tratamento de lesões e expulsões graves, incluindo suporte a goleiro improvisado em caso de falta de reservas na posição.
  - Acompanhamento simultâneo de outras partidas da mesma rodada sem vazamento de resultados futuros.
- **Prancheta Tática & Espionagem:**
  - 11 titulares posicionados geometricamente na formação escolhida (`4-4-2`, `4-3-3`, `3-5-2`, `4-5-1`, `5-3-2`).
  - Banco convocado de até 11 reservas elegíveis, com convocação automática inteligente.
  - Configuração de capitão e cobradores de faltas, pênaltis e escanteios.
  - Visualizador de Clubes Adversários (`ClubViewer`): espione a formação e os titulares que a IA colocará em campo contra o seu time.
- **Mercado de Transferências Completo:**
  - Contratação de passes livres (agentes livres) sem taxa de transferência.
  - Pesquisa avançada de atletas com filtros de posição, força mínima e faixa de valor.
  - Envio de propostas de compra e recepção de ofertas da IA por jogadores do seu elenco.
  - Gestão de contratos, tempo de vigência e renovações salariais.
- **Economia Sustentável & Obras no Estádio:**
  - Controle de preço do ingresso e cálculo determinístico de público e bilheteria.
  - Obras de ampliação de capacidade das arquibancadas (+2.000, +5.000, +10.000 lugares).
  - Simulador de empréstimos bancários com taxas de juros, prazos semanais e amortização automática.
  - Demonstrativo semanal contábil (receitas de bilheteria e transferências vs. folha salarial e manutenção).
- **Categorias de Base (Juniores):**
  - Plantel de promessas de 16 a 19 anos geradas conforme a estrutura do clube.
  - Promoção direta de juniores para o time profissional e liberação de vagas na base.
- **Jornal da Rodada & Estatísticas Gerais:**
  - Manchetes dinâmicas com os maiores acontecimentos da semana esportiva.
  - Artilharia geral do campeonato, líderes de assistências e ranking de treinadores.
- **Áudio Sintetizado Web Audio API:**
  - Efeitos sonoros procedurais de apito do juiz, chutes e comemoração de gol da torcida sem necessidade de arquivos externos pesados de áudio.

---

## 🏗️ Arquitetura Técnica

```
┌────────────────────────────────────────────────────────┐
│               CHAMPS MANAGER ARCHITECTURE              │
├────────────────────────────────────────────────────────┤
│                     UI LAYER                           │
│   • React 19 + TypeScript + Tailwind CSS v4 + Vite     │
│   • Club Atmospheric Theming (Design Tokens Semânticos)│
├──────────────────────────┬─────────────────────────────┤
│      DESKTOP NATIVO      │         WEB BROWSER         │
│   • Tauri (Rust Webview) │   • WebAssembly (WASM)      │
│   • < 15 MB de pacote    │   • Execução 100% no cliente│
│   • Acesso ao disco      │   • Saves em IndexedDB/OPFS │
├──────────────────────────┴─────────────────────────────┤
│                   CORE ENGINE (Rust)                   │
│   • `champs-core`: Domínio, carreira, torneios e saves │
│   • `champs-sim`: Motor determinístico de 90 minutos   │
│   • `champs-data`: Importador de dados históricos      │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 20 ou superior recomendada)
- [Rust & Cargo](https://rustup.rs/) (versão 1.85 ou superior)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) (para compilação do WebAssembly)

### 1. Clonar o Repositório
```bash
git clone https://github.com/alexchagas/champs-manager.git
cd champs-manager
```

### 2. Rodar a Interface Web (Modo Desenvolvimento)
```bash
cd web
npm install
npm run dev
```
Acesse `http://localhost:5173/` no seu navegador.

### 3. Compilar o Motor WebAssembly (WASM)
Se fizer alterações no código Rust em `crates/`:
```bash
cd web
npm run wasm:build
```

### 4. Compilar para Produção
```bash
cd web
npm run build
npm run preview
```

---

## 🧪 Qualidade e Testes

O projeto adota uma rigorosa estratégia de testes automatizados com 100% de cobertura em domínios críticos:

```bash
# 1. Executar os 68 testes unitários e de integração em Rust
cargo test -p champs-core -p champs-sim

# 2. Executar suíte de testes de Carreira e Economia no frontend
cd web && npm run test:career

# 3. Executar suíte de testes de Ciclo da Partida (WASM real)
cd web && npm run test:match

# 4. Executar simulação de estresse financeiro (3 temporadas completas)
cd web && npm run sim:economy

# 5. Verificação de tipos TypeScript
npx tsc --noEmit
```

---

## 📂 Estrutura do Repositório

```
champs-manager/
├── crates/                    # Módulos centrais em Rust
│   ├── champs-core/           # Domínio de carreira, torneios, modelos e WASM bridge
│   ├── champs-sim/            # Motor de simulação de 90 min e sessão de partida
│   ├── champs-data/           # Parser de dados legados (.ban)
│   └── README.md              # Documentação dos crates
├── data/                      # Base de dados unificada de clubes (teams.json)
├── docs/                      # Documentação técnica e especificações oficiais
│   ├── screenshots/           # Capturas de tela oficiais da aplicação
│   ├── ARQUITETURA.md         # Arquitetura do sistema, fluxo WASM e persistência
│   ├── FUNCIONALIDADES.md     # Catálogo completo de telas e recursos
│   ├── MOTOR_E_REGRAS.md      # Modelos matemáticos de forças, 90 min e finanças
│   └── README.md              # Índice e guia da documentação técnica
├── rea/                       # Engenharia reversa de referência e arquitetura
├── src-tauri/                 # Configuração do wrapper Desktop Tauri
├── web/                       # Aplicação frontend em React 19 + TypeScript
│   ├── src/
│   │   ├── audio/             # Motor de som Web Audio procedural
│   │   ├── components/        # Telas e componentes visuais do jogo
│   │   ├── data/              # Utilitários de acesso ao catálogo de clubes
│   │   ├── engine/            # Pontes WASM e regras econômicas
│   │   ├── state/             # GameContext e persistência IndexedDB/LocalStorage
│   │   └── theme/             # Theming dinâmico por clube (clubTheme.ts)
│   └── README.md              # Documentação específica do frontend
├── Cargo.toml                 # Workspace Rust
└── README.md                  # Este documento
```

---

## 📜 Licença, Isenção Legal & Reconhecimentos

- Desenvolvido por **Alex Chagas** e colaboradores.
- **Projeto Estritamente Recreativo e Privado:** Criado como tributo nostálgico à história dos jogos clássicos de gerenciamento esportivo (em especial ao eterno **Brasfoot**), para uso pessoal e diversão entre amigos, sem fins lucrativos, sem anúncios e sem monetização de qualquer espécie.
- **Marcas, Clubes e Atletas:** Todos os nomes de equipes, escudos, emblemas, uniformes, marcas e nomes de atletas pertencem integralmente às suas respectivas agremiações esportivas, federações e detentores de direitos. O Champs Manager não possui qualquer afiliação oficial nem licenciamento comercial, tratando-se de um patch/modificação comemorativa de fãs.
- **Arquitetura Aberta e Patches Externos:** O motor funciona como plataforma neutra; atualizações futuras permitirão download e configuração customizada de pacotes de dados e elencos pelo próprio usuário.
