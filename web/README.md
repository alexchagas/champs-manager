# Champs Manager - Web Interface

Interface web moderna e imersiva inspirada no clássico **Brasfoot**, desenvolvida com **React 19**, **TypeScript**, **Tailwind CSS v4** e **Vite**, impulsionada pelo motor matemático compilado em **WebAssembly (WASM)**.

---

## 🎨 Identidade Visual e Theming Dinâmico

- **Club Atmospheric Theming (`deriveClubAtmosphere`):** O layout adapta suas variáveis de fundo, superfícies, bordas e acentos em tempo real conforme as cores oficiais do clube gerenciado (Azul Meia-noite para Cruzeiro/Grêmio, Carmesim Profundo para Flamengo/Internacional, Obsidiana para Santos/Corinthians/Vasco, Floresta Esmeralda para Palmeiras/Coritiba, etc.).
- **Preservação de Cores Funcionais:** Gramado verde estável, barras de energia (verde/amarelo/vermelho), cartões esportivos e indicadores financeiros de superávit/déficit protegidos contra alterações temáticas.
- **Tipografia Retrô & Esportiva:** Chakra Petch (estilo placar digital eletrônico), JetBrains Mono (estatísticas e números tabulares) e Outfit (interface limpa e moderna).
- **Áudio Sintetizado Web Audio API:** Efeitos sonoros procedurais para apito do árbitro, chutes, grito e êxtase de gol da torcida, sem requisição de arquivos externos.

---

## 🖥️ Telas e Módulos do Jogo

### 1. Menu Principal (`MainMenu.tsx`)
- **Novo Jogo com 703 Clubes:** Seleção entre 134 países e toda a pirâmide do futebol brasileiro (Séries A, B, C, D, Estaduais e Acesso).
- **Busca Global e Filtros:** Busca rápida por nome, cidade ou estádio, visualização de escudos oficiais, capacidade e reputação em estrelas.
- **Gerenciador de Saves:** Salvamento manual e slots automáticos persistidos em `IndexedDB` e `LocalStorage`.
- **Editor de Dados Integrado (`TeamEditorScreen.tsx`):** Edição de nomes de clubes, cores de uniforme e atributos de atletas.

### 2. Visão Geral do Clube (`ClubOverview.tsx`)
- **Tabela de Classificação Dinâmica:** Zonas coloridas (Libertadores, Sul-Americana, Rebaixamento), pontuação, saldo de gols e histórico de forma recente.
- **Calendário da Temporada:** Navegação pelas rodadas com confrontos do dia e resultados passados.
- **Próxima Partida & Acesso ao Jogo:** Card de destaque com botão de início de partida sincronizado ao atalho de teclado `Espaço`.
- **Resumo do Estádio & Ingressos:** Capacidade de público, precificação de ingressos e projeção de receita líquida por jogo como mandante.

### 3. Prancheta Tática & Convocação (`TacticsScreen.tsx`)
- **Gramado Tático Interativo:** Formações táticas (`4-4-2`, `4-3-3`, `3-5-2`, `4-5-1`, `5-3-2`) com posicionamento geométrico calibrado.
- **Arrastar e Soltar (Drag & Drop):** Inversão instantânea entre titulares e reservas arrastando no campo ou clicando em dois jogadores.
- **Convocação de Súmula (11 Titulares + até 11 Reservas):** Separação estrita entre titulares, banco convocado e atletas fora da súmula, com botão de convocação automática que assegura cobertura de goleiro.
- **Batedores Oficiais:** Seleção de capitão, cobrador oficial de pênaltis, faltas e escanteios.
- **Cálculo de Setores:** Força da Defesa, Meio-Campo, Ataque e Média Geral calculadas em tempo real.

### 4. Partida ao Vivo (`LiveMatchScreen.tsx`)
- **Simulação Minuto a Minuto via WASM:** Motor incremental determinístico em Rust executando os 90 minutos de jogo lance a lance.
- **Controle de Velocidade & Pausa:** Velocidades 1x, 2x, 5x, pausa manual e simulação acelerada até a próxima decisão humana ou apito final.
- **Decisões em Tempo Real:** 5 substituições em até 3 oportunidades, parada gratuita no intervalo, lesões graves de atletas e escolha interativa de cobrador em caso de pênalti.
- **Goleiro Improvisado:** Tratamento de expulsão ou lesão de goleiro sem reservas, com rebaixamento de eficiência técnica calibrado.
- **Placar dos Demais Jogos da Rodada:** Acompanhamento de partidas paralelas da mesma data sem vazamento de resultados futuros.

### 5. Mercado de Transferências (`TransfersScreen.tsx`)
- **Passes Livres (Free Agents):** Jogadores sem clube disponíveis para contratação direta sem custo de transferência.
- **Busca no Mercado:** Filtros por posição (Goleiro, Lateral, Zagueiro, Meia, Atacante), faixa de força, idade e valores.
- **Propostas e Negociações:** Envio de ofertas com negociação de salários, duração de contrato e taxa de transferência.
- **Caixa de Ofertas Recebidas:** Notificações de ofertas da IA por jogadores do seu elenco com opção de Aceitar ou Recusar.
- **Contratos do Elenco:** Monitoramento de anos de contrato restantes e botão de renovação salarial.

### 6. Finanças & Obras do Estádio (`FinancesScreen.tsx`)
- **Obras e Expansão:** Ampliação da capacidade do estádio (+2.000, +5.000, +10.000 lugares) com débito direto no caixa.
- **Simulador de Empréstimos Bancários:** Empréstimos com limite baseado na reputação do clube, juros progressivos (8% a 15%) e amortização semanal em 10, 15 ou 20 rodadas.
- **Demonstrativo Semanal:** Balancete contábil completo de receitas (bilheteria, premiações, transferências) e despesas (folha salarial, manutenção predial, amortizações).
- **Extrato Financeiro Transacional:** Livro-razão com histórico de todas as transações da temporada.

### 7. Categorias de Base / Juniores (`YouthScreen.tsx`)
- **Plantel de Juniores:** Atletas jovens de 16 a 19 anos gerados proporcionalmente à infraestrutura e reputação do clube.
- **Promover ao Profissional:** Transição direta para o time principal com contrato profissional inicial.
- **Dispensar da Base:** Liberação de vagas na base para atração de novas promessas.

### 8. Feed de Notícias & Jornal (`NewsFeed.tsx`)
- **Manchetes Dinâmicas:** Notícias automáticas a cada rodada destacando clássicos, lesões de atletas, demissões de técnicos e negociações do mercado.

### 9. Estatísticas da Liga & Técnicos (`LeagueStatsScreen.tsx` e `ManagersScreen.tsx`)
- **Artilharia & Assistências:** Tabela dos 10 maiores goleadores, garçons e atletas mais advertidos do campeonato.
- **Painel de Treinadores:** Reputação, tempo de cargo e desempenho de todos os comandantes da liga.

### 10. Visualizador de Clubes Adversários (`ClubViewer.tsx`)
- **Espionagem Tática:** Análise detalhada de qualquer equipe da competição ao clicar no seu nome ou escudo.
- **Prancheta do Adversário (Somente-Leitura):** Visualização dos 11 titulares escalados pela IA, banco de reservas e postura tática.

---

## 🚀 Como Executar

Dentro do diretório `web`:

```bash
# Iniciar o servidor de desenvolvimento Vite
npm run dev

# Compilar motor Rust para WebAssembly
npm run wasm:build

# Compilar frontend para produção
npm run build

# Executar suíte de testes de Carreira e Economia
npm run test:career

# Executar suíte de testes do Ciclo da Partida
npm run test:match

# Executar simulação estocástica de economia (3 temporadas completas)
npm run sim:economy
```
