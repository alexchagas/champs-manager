# Roadmap: Visualizador de Clubes, Escalação Adversária e Theming Dinâmico

Este documento detalha o planejamento técnico, especificações funcionais e os prompts prontos para execução de cada uma das funcionalidades solicitadas para o **Champs Manager / Brasfoot REA**.

---

## 0. Diagnóstico e Resolução do Bug das Formações Táticas

- **Sintoma observado:** Na tela de tática (`TacticsScreen.tsx`), os 11 titulares no gramado apareciam acumulados no canto inferior esquerdo em vez de distribuídos conforme a formação (4-4-2, 4-3-3, etc.).
- **Causa Raiz:** No elemento dos cartões dos jogadores no campo, a lista de classes continha simultaneamente `absolute` e `relative` (`className="absolute ... relative overflow-hidden ..."`). Na ordem da folha de estilo do Tailwind, `position: relative` prevaleceu sobre `position: absolute`. Com isso, as coordenadas `top: ${slot.y}%` e `left: ${slot.x}%` foram interpretadas em fluxo normal de bloco em vez de posicionamento absoluto relativo ao campo, fazendo todos os cartões descerem em cascata.
- **Correção Aplicada:** A classe `relative` redundante foi removida em [`web/src/components/TacticsScreen.tsx`](../web/src/components/TacticsScreen.tsx), restaurando o posicionamento absoluto calibrado para todas as formações táticas.

---

## 1. Feature: Visualizador Completo de Clubes Externos & Adversários (Club Viewer)

### Contexto & Objetivo
No Brasfoot clássico e nos gerenciadores modernos, clicar no nome ou escudo de qualquer clube (na tabela de classificação, na lista de jogos da rodada, na busca ou no mercado de transferências) abre o perfil detalhado daquela equipe. O usuário pode analisar o elenco, estádio e informações daquele adversário antes de enfrentá-lo.

### Especificação Funcional
1. **Gatilhos de Abertura:**
   - Clicar na linha de qualquer clube na tabela de classificação (`ClubOverview.tsx`).
   - Clicar no adversário no card "Próxima Partida" ou na lista de jogos da rodada.
   - Pesquisa direta de clubes na busca global ou no menu de transferências.
2. **Identidade Visual Dinâmica:**
   - O visualizador renderiza com as cores do clube inspecionado (ex: ao abrir Tombense, Atlético-MG ou Cruzeiro, o cabeçalho, bordas e detalhes refletem as cores e o escudo daquele clube).
3. **Seções do Perfil do Clube:**
   - **Cabeçalho:** Escudo oficial, nome completo, divisão/campeonato, técnico atual, reputação em estrelas, estádio oficial e capacidade de público.
   - **Elenco Completo:** Tabela com todos os jogadores do clube divididos por setor (GOL, ZAG, LAT, MEI, ATA), exibindo idade, força geral (1-99), energia atual e características especiais.
   - **Histórico & Desempenho:** Posição na tabela, últimos resultados (vitórias/empates/derrotas) e saldo de gols.
4. **Modo:** Janela modal responsiva ou tela dedicada com botão claro de "Voltar" para a tela de origem.

### Prompt Pronto para Execução
```text
Implemente a funcionalidade de Visualizador de Clube Externo (Club Viewer) no Brasfoot REA:

1. Ao clicar em qualquer clube adversário na tabela de classificação, nos confrontos da rodada ou no card da próxima partida, abra uma visualização detalhada do clube selecionado.
2. O componente deve exibir:
   - Cabeçalho com escudo, nome, divisão, treinador, estádio (nome e capacidade) e estrelas de reputação.
   - Identidade visual temática baseada nas cores primária e secundária do clube inspecionado (usando getClubTheme).
   - Lista/tabela completa do elenco com todos os jogadores divididos por setor (Goleiros, Zagueiros, Laterais, Meias, Atacantes), com força, idade, características e energia.
   - Resumo da campanha na temporada atual (pontos, vitórias, empates, derrotas, gols marcados/sofridos).
3. Essa visualização é de consulta e deve possuir botão evidente de fechar/voltar à tela anterior.
4. Mantenha os testes existentes passando e adicione cobertura de testes para a seleção e abertura do clube externo.
```

---

## 2. Feature: Prancheta Tática & Escalação do Adversário (Read-Only Lineup & Tactics)

### Contexto & Engenharia Reversa (Brasfoot)
Na engenharia reversa do Brasfoot, a IA escala os melhores jogadores para cada confronto com base na formação tática do time (ex: 4-4-2, 3-5-2, 4-3-3). O jogador humano tem o direito tático de "espionar" como o adversário vem a campo:
- Ver a prancheta de futebol com os 11 titulares posicionados nas suas coordenadas exatas.
- Ver o banco de reservas daquele time.
- Ver a formação escolhida pela comissão técnica adversária e sua postura (equilibrada, ofensiva, defensiva).
- **Restrição inviolável (Read-Only):** O jogador humano NÃO pode arrastar jogadores, mudar titulares ou trocar batedores de pênalti/falta do time adversário.

### Especificação Funcional
1. **Aba Tática no Perfil do Clube Adversário:**
   - Alternância entre `[ Elenco Geral ]` e `[ Formação / Tática ]`.
2. **Gramado Tático Somente-Leitura:**
   - Renderiza o gramado padrão com os 11 jogadores titulares posicionados conforme a formação da IA.
   - Cartões dos jogadores recebem a faixa nas cores do uniforme do clube inspecionado.
   - Badges de força, posição natural (GOL, ZAG, MEI, ATA) e capitão/batedores do adversário visíveis.
   - Desabilitar `draggable`, `onDrop` e cliques de substituição quando visualizando time alheio.
   - Exibir badge clara: `Modo Consulta (IA)` ou `Escalação Prevista`.
3. **Setor de Reservas:**
   - Lista lateral dos jogadores no banco de reservas disponíveis para o jogo.

### Prompt Pronto para Execução
```text
Implemente a visualização da Prancheta Tática e Escalação do Clube Adversário (modo Somente Leitura) baseado no comportamento original do Brasfoot:

1. Na visualização de um clube adversário (ou antes da partida ao vivo), permita alternar para a aba "Tática / Escalação".
2. Renderize o gramado de futebol com os 11 titulares do adversário escalados pela IA para a formação tática da equipe (ex: 4-4-2, 4-3-3):
   - Os cartões dos jogadores devem exibir nome, força, posição e faixa com as cores do uniforme do adversário.
   - A prancheta deve ser estritamente SOMENTE-LEITURA: desabilite drag-and-drop, cliques de substituição e alteração de batedores/capitão.
   - Exiba a formação tática utilizada, postura (defensiva, equilibrada, ofensiva) e médias de força por setor (DEF, MEI, ATA).
3. Exiba o banco de reservas do adversário em uma lista lateral de consulta.
4. Garanta que o posicionamento dos 11 titulares no gramado utilize as coordenadas exatas da formação selecionada pela IA.
```

---

## 3. Feature: Design Tokens Dinâmicos & Fundo Atmosférico por Clube (Club Atmospheric Theming)

### Contexto & Objetivo
Atualmente o jogo utiliza uma casca predominantemente verde escuro (`#0a1410`, `#0e1b15`, bordas esmeralda). Ao jogar com clubes de outras matrizes cromáticas (Cruzeiro em azul e branco, Flamengo em rubro-negro, Santos/Vasco em preto e branco), a casca fixa verde colide com a atmosfera do clube.

A solução consiste em migrar a casca do jogo para **CSS Variables Semânticas**, transformando todo o HUD em um ambiente imersivo customizado para o clube controlado.

### Especificação dos Tokens Semânticos
```css
:root {
  /* Fundo profundo da tela */
  --app-bg-deep: #050b14;        /* Ex: Cruzeiro = Azul Meia-noite */
  
  /* Superfícies de cards e painéis */
  --app-surface-1: #0a1526;      /* Slate Navy */
  --app-surface-2: #10213b;      /* Input/Hover Navy */
  
  /* Linhas e bordas */
  --app-border-subtle: #19335a;  /* Contorno discreto */
  --app-border-highlight: #2563eb;/* Destaque primário */
  
  /* Acentos de marca do clube */
  --app-primary-accent: #1d4ed8; /* Azul Royal */
  --app-secondary-accent: #ffffff;
  --app-text-accent: #60a5fa;
}
```

### Mapeamento das Famílias Cromáticas
| Família | Exemplos de Clubes | Fundo (`--app-bg-deep`) | Painéis (`--app-surface-1`) | Acento Primário |
|---|---|---|---|---|
| **Azuis** | Cruzeiro, Grêmio, Bahia, Chelsea | `#050B14` (Midnight Blue) | `#0A1526` (Slate Navy) | Azul Royal / Celeste |
| **Rubro-Negros / Vermelhos** | Flamengo, Internacional, Athletico, São Paulo | `#0D0707` (Deep Wine/Charcoal) | `#170D0E` (Dark Crimson) | Vermelho Vivo / Ouro |
| **Alvinegros / Neutros** | Santos, Corinthians, Vasco, Botafogo, Atlético-MG | `#090A0C` (Obsidian) | `#111317` (Dark Charcoal) | Branco / Prata de alto contraste |
| **Verdes** | Palmeiras, Coritiba, Goiás, Chapecoense | `#06120B` (Dark Forest) | `#0C1D13` (Emerald Surface)| Verde Esmeralda clássico |
| **Dourados / Amarelos** | Mirassol, Novorizontino, Criciúma, Villarreal | `#0D0C07` (Dark Bronze) | `#17150C` (Warm Charcoal) | Ouro / Âmbar de alto contraste |

### Proteção das Cores Funcionais (Regra de Ouro)
- **Gramado de Futebol:** Sempre verde de estádio natural (não muda com o clube).
- **Barras de Energia:** Sempre verde (>80%), amarelo (60-79%) e vermelho (<60%).
- **Cartões:** Amarelo e vermelho esportivos estritos.
- **Lesões:** Ícone médico vermelho.
- **Saldo Financeiro:** Verde para superávit, vermelho para déficit.

### Prompt Pronto para Execução
```text
Implemente a arquitetura de Design Tokens Dinâmicos e Atmosfera do Clube (Club Atmospheric Theming) no Brasfoot REA:

1. Crie o gerador de tokens CSS em deriveClubAtmosphere(club):
   - Mapeie a matriz cromática do clube para uma das famílias (Azuis, Vermelhos, Alvinegros, Verdes, Dourados).
   - Gere variáveis CSS dinâmicas para: --app-bg-deep, --app-surface-1, --app-surface-2, --app-border-subtle, --app-border-highlight e --app-text-accent.
   - Aplique contraste seguro WCAG em todos os elementos.
2. No container principal do jogo (AppShell / GameLayout), injete essas variáveis de estilo no elemento raiz conforme o clube atualmente controlado.
3. Atualize os componentes estruturais principais (Header, Navegação lateral, ClubOverview, painéis do LiveMatch e modais) para consumirem as variáveis de superfície e borda (--app-surface-1, --app-border-subtle, etc.) em vez de cores verdes fixas no Tailwind.
4. Mantenha estritamente protegidas todas as cores funcionais: gramado de jogo verde, barras de energia (verde/amarelo/vermelho), cartões de arbitragem, cruz médica de lesões e indicadores de superávit/déficit financeiro.
5. Adicione testes automatizados validando a derivação de paletas para Cruzeiro (azul), Flamengo (rubro-negro), Santos (alvinegro) e Palmeiras (verde).
```
