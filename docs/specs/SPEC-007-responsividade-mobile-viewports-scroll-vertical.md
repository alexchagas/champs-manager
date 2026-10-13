# SPEC-007: Responsividade Mobile (iPhone SE/16), Gestão de Viewports e Scroll Vertical Unificado

- **Autor:** Champs Manager Architecture Team
- **Data:** 13 de Outubro de 2026
- **Status:** Proposto / Pronto para Implementação
- **Impacto:** Alto (AppShell, Layout Global, MainMenu / Novo Jogo, ClubOverview, TacticsScreen, LiveMatchScreen e Telas de Gestão)

---

## 1. Contexto & Problema Identificado

Ao executar o **Champs Manager** em dispositivos móveis reais — em especial iPhones modernos com proporções verticais altas (como iPhone 16, 393×852 px) e compactos clássicos (como iPhone SE 3ª Geração, 375×667 px) — o jogo apresenta sérias falhas de usabilidade e quebra de layout:

1. **A Tela de "Novo Jogo" não é responsiva:**
   - O menu principal (`MainMenu.tsx`) implementa uma barra lateral esquerda fixa de 256px (`w-64 shrink-0`) em um container `flex-row`.
   - Em uma tela de iPhone com 375px a 393px de largura, essa barra consome quase 70% da largura visível, esmagando o formulário de "Novo Jogo" nos míseros pixels restantes.
   - O botão principal de "Iniciar Carreira" fica inacessível ou empurrado para fora da tela.
2. **Ausência de Scroll Vertical nas telas de jogo:**
   - As telas do jogo aplicam classes rígidas como `overflow-hidden`, `h-full`, `h-screen` e `h-[calc(100vh-3.5rem)]`.
   - Embora algumas tabelas ou abas possuam scroll horizontal secundário, **não há scroll vertical** que permita percorrer os cards, listas de atletas, painéis financeiros e classificações completas no celular.
   - Consequência: elementos inferiores (botões de ação como "ESCALAR TIME", "JOGAR PARTIDA", "AVANÇAR CALENDÁRIO") são cortados pela base da tela ou encobertos pela `BottomNavBar` e pela área segura (*home indicator*) do iOS.
3. **Contraste de Comportamento (iPad vs iPhone):**
   - No **iPad / Tablets (>= 768px)** e no **Desktop / PC**, a interface atual funciona confortavelmente porque o espaço vertical e horizontal é abundante para comportar grids de 2 colunas lado a lado sem necessidade de rolagem de página.
   - O usuário expressamente destacou que **o iPad está funcionando bem** e que no PC/Tablet deseja-se manter o scroll fixo (evitando que a janela inteira fique saltando ou rolando de forma deselegante).
   - O desafio central é **gerir a expectativa de layout entre os dois mundos**:
     - *Tablet/PC*: App de Painel Fixo (*Dashboard Lock*).
     - *iPhone/Mobile*: Fluxo de Página com Rolagem Vertical Fluida (*Vertical Scroll Flow*).

---

## 2. Gestão de Expectativas: O Paradigma Dual-Viewport

Para atender perfeitamente aos dois perfis de hardware sem comprometer o que já está aprovado no iPad, definimos a seguinte matriz de comportamento:

```
+-------------------------------------------------------------------------------+
|                             CHAMPS MANAGER VIEWPORT                           |
+------------------------------------+------------------------------------------+
|  MOBILE (iPhone SE / iPhone 16)    |      TABLET (iPad) & DESKTOP (PC)        |
|  Largura < 768px                   |      Largura >= 768px (ou Landscape)     |
+------------------------------------+------------------------------------------+
| • Scroll Vertical: ATIVO (Global)  | • Scroll da Janela: FIXO (overflow-hidden)|
| • Orientação: 1 Coluna Empilhada   | • Orientação: 2 Colunas / Grid Lateral   |
| • Menus: Abas Horizontais / Chips  | • Menus: Sidebar Lateral Fixa (w-64)     |
| • Ações: Sticky Footer / Flutuante | • Ações: Botões em Header e Cards Fixos  |
| • Altura: 100dvh (Dynamic Safari)  | • Altura: 100vh Fixo                     |
| • Touch Target: Mínimo 44x44px     | • Cursor Pointer / Teclado (Espaço/Esc)  |
+------------------------------------+------------------------------------------+
```

### 2.1 Princípios de Design
1. **Zero Regressão no iPad e PC:** Telas maiores que `768px` continuam operando exatamente como hoje — `overflow-hidden` nos containers principais, com scroll interno apenas nas tabelas de dados.
2. **Mobile First Verticality:** No iPhone, o conteúdo é um documento contínuo rolável. O usuário pode deslizar o polegar verticalmente para explorar desde o topo até a base da tela sem restrições.
3. **Sticky Call-To-Action (CTA):** O botão de ação principal de cada tela (ex: "Iniciar Carreira", "Escalar Time", "Jogar Partida", "Avançar Calendário") nunca pode desaparecer ou ficar inalcançável. Ele deve permanecer visível em uma barra flutuante ou no topo/base de fácil toque.
4. **Respeito às Áreas Seguras do iOS:** Utilização rigorosa de `env(safe-area-inset-top)` e `env(safe-area-inset-bottom)` em conjunto com a `BottomNavBar`.

---

## 3. Diagnóstico Técnico & Causa Raiz

### 3.1 `index.html` e `index.css`
- Em `web/index.html`:
  ```html
  <body class="... overflow-hidden h-screen w-screen">
  ```
- Em `web/src/index.css`:
  ```css
  body {
    overflow: hidden;
    height: 100vh;
    width: 100vw;
  }
  ```
- **Problema:** A propriedade `overflow: hidden` e `100vh` bloqueiam a rolagem nativa da página no nível do navegador. Além disso, no WebKit/Safari do iOS, `100vh` não desconta a barra de navegação retrátil e a Dynamic Island, provocando um corte de aproximadamente 60px a 90px na base.

### 3.2 `App.tsx` e `AppShell`
- Em `web/src/App.tsx`:
  ```tsx
  <div id="app-shell" className="h-screen w-screen flex flex-col overflow-hidden ...">
    {showChrome && <Header />}
    <main className={`flex-1 flex overflow-hidden relative ${showChrome ? 'pb-14 md:pb-0' : ''}`}>
      {/* Telas ativas */}
    </main>
    {showChrome && <BottomNavBar />}
  </div>
  ```
- **Problema:** O elemento `<main>` possui `overflow-hidden` fixo para todos os dispositivos. No mobile, `<main>` deve possuir `overflow-y-auto` e permitir que as telas filhas cresçam naturalmente.

### 3.3 Estrutura Rígida em Telas Individuais
Múltiplas telas possuem altura estática fixada via classes Tailwind:
- `TransfersScreen.tsx`: `h-[calc(100vh-3.5rem)] overflow-hidden`
- `FinancesScreen.tsx`: `h-[calc(100vh-3.5rem)] overflow-hidden`
- `LeagueStatsScreen.tsx`: `h-[calc(100vh-3.5rem)] overflow-hidden`
- `ChampionsHistoryScreen.tsx`: `h-[calc(100vh-3.5rem)] overflow-hidden`
- `RoundResultsScreen.tsx`: `h-screen w-full select-none overflow-hidden`
- `ClubOverview.tsx`: `h-full min-h-0 overflow-hidden`
- `MainMenu.tsx`: `flex-row` com `w-64 shrink-0` sem colapso mobile.

---

## 4. Especificação Técnica da Solução

### 4.1 Fundação do Viewport (`index.html`, `index.css`, `AppShell`)

1. **Adoção do Dynamic Viewport Unit (`100dvh`):**
   - Atualizar `web/src/index.css` e `AppShell` para utilizarem `100dvh` em vez de `100vh`:
   ```css
   @layer base {
     body {
       height: 100dvh;
       min-height: -webkit-fill-available;
     }
   }
   ```
2. **Comportamento do `<main>` no `App.tsx`:**
   - No mobile (`< 768px` / `< md`):
     - `overflow-y-auto`
     - `-webkit-overflow-scrolling: touch`
     - `pb-[calc(4rem+env(safe-area-inset-bottom))]` quando a `BottomNavBar` estiver ativa.
   - No tablet e desktop (`>= md`):
     - `overflow-hidden` (mantém o comportamento estável atual).

```tsx
/* App.tsx */
<main className={`flex-1 flex flex-col relative min-h-0 ${
  showChrome 
    ? 'overflow-y-auto md:overflow-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0' 
    : 'overflow-y-auto md:overflow-hidden'
}`}>
```

---

### 4.2 Especificação por Tela

#### A. Menu Principal & "Novo Jogo" (`MainMenu.tsx`)
- **Problema Atual:** Barra lateral esquerda fixa de 256px esmagando a área de configuração de nova carreira em celulares.
- **Solução Mobile:**
  1. **Top Segmented Switcher no Mobile:** Em telas `< md`, a barra lateral `w-64` é convertida em uma barra de abas horizontal fixa no topo (`overflow-x-auto no-scrollbar py-2 px-3 border-b border-[#1b3629] flex md:hidden gap-1.5`).
  2. **Sidebar Preservada no Desktop:** Em `md:` para cima, a barra lateral `w-64 shrink-0` é exibida normalmente.
  3. **Fluxo do "Novo Jogo":**
     - O formulário passa a ocupar 100% da largura útil (`w-full`).
     - **Seleção de País:** Grade responsiva de chips (`grid grid-cols-3 sm:grid-cols-4 md:flex md:flex-wrap gap-1.5`).
     - **Seleção de Divisão e Estado:** Menus empilhados com touch target ampliado (mínimo 44px de altura).
     - **Lista de Clubes:** Cards de clubes em grid de 2 colunas no celular (`grid-cols-2 sm:grid-cols-3`), com escudo nítido e nome legível.
     - **Sticky CTA "INICIAR CARREIRA":** O botão de confirmação e criação do savegame é fixado no rodapé inferior da tela em mobile, com fundo escurecido (`backdrop-blur-md pb-safe`), garantindo que o jogador nunca se perca procurando onde iniciar o jogo.

#### B. Visão Geral do Clube (`ClubOverview.tsx`)
- **Problema Atual:** Container com `h-full min-h-0 overflow-hidden` corta a tabela ou os jogos da rodada no iPhone SE.
- **Solução Mobile:**
  1. **Remoção de Trava de Altura no Mobile:** Container vira `flex-1 flex flex-col md:overflow-hidden md:h-full min-h-0 overflow-visible`.
  2. **Hero do Próximo Jogo com Prioridade:** Em telas menores, o Hero Card ("Próximo Adversário" + Botão "ESCALAR TIME") é a primeira coisa que o usuário vê (Ordem 1).
  3. **Scroll Natural nas Tabelas:** A tabela de classificação pode rolar verticalmente de ponta a ponta sem ficar limitada a uma janela de 200px de altura.
  4. **Tabs Mobile Estáveis:** As abas "Classificação" vs "Jogos da Rodada" continuam permitindo foco rápido, mas o conteúdo de cada uma cresce verticalmente de forma limpa.

#### C. Tática e Escalação (`TacticsScreen.tsx`)
- **Problema Atual:** O campo tático (pitch) e a lista do elenco disputam um espaço vertical limitado em 667px (iPhone SE), fazendo os botões inferiores desaparecerem.
- **Solução Mobile:**
  1. **Dimensão Proporcional do Campo no Mobile:** Definir altura com aspect ratio restrito (`aspect-[4/3]` ou altura máxima de `340px` no mobile) para evitar que o campo ocupe todo o viewport.
  2. **Lista do Elenco e Banco:** Permitir rolagem vertical completa no banco de reservas e titulares.
  3. **Floating Action Bar:** Os botões "Auto-Escalar Time" e "JOGAR PARTIDA >>" devem ficar ancorados em barra fixa ou sticky inferior acima da `BottomNavBar`.

#### D. Partida ao Vivo (`LiveMatchScreen.tsx`)
- **Problema Atual:** Durante a partida, a barra de controle de velocidade (`1x, 2x, 5x, Pausar`) pode se chocar com a área segura do iPhone.
- **Solução Mobile:**
  1. Manter o placar fixo no topo (`shrink-0`).
  2. As abas mobile ("Lance a Lance", "Substituições", "Estatísticas") operam dentro de container com scroll vertical suave (`overflow-y-auto`).
  3. A barra inferior de controles de partida recebe `pb-safe` e z-index garantido.

#### E. Resultados da Rodada (`RoundResultsScreen.tsx`)
- **Problema Atual:** `h-screen w-full overflow-hidden` esconde a maior parte dos jogos da rodada e a tabela pós-jogo.
- **Solução Mobile:**
  1. Alterar container para `min-h-full flex flex-col pb-6`.
  2. Empilhar a lista de confrontos da rodada seguida pela classificação atualizada.
  3. Fixar o botão "Avançar Calendário" no topo ou em barra inferior flutuante para agilizar o avanço da temporada com 1 toque.

#### F. Mercado de Transferências (`TransfersScreen.tsx`) e Finanças (`FinancesScreen.tsx`)
- **Problema Atual:** Classes `h-[calc(100vh-3.5rem)] overflow-hidden` truncam listas de empréstimos, estádio e mercado de jogadores livres.
- **Solução Mobile:**
  1. Substituir por `flex-1 flex flex-col md:h-[calc(100vh-3.5rem)] md:overflow-hidden min-h-0`.
  2. Liberar scroll vertical para percorrer todos os atletas da lista de transferências e todas as opções financeiras de estádio e patrocínio.

---

## 5. Matriz de Breakpoints e Dispositivos de Teste

| Dispositivo / Perfil | Resolução Lógica | Breakpoint Tailwind | Comportamento Alvo |
| :--- | :--- | :--- | :--- |
| **iPhone SE (3ª Geração)** | 375 × 667 px | `< sm` | Scroll vertical 100%, 1 coluna, sticky CTA, campo compacto |
| **iPhone 16 / 15 / 14** | 393 × 852 px | `sm` (< md) | Scroll vertical nativo, áreas seguras (Dynamic Island + Home Bar) |
| **iPhone 16 Pro Max** | 430 × 932 px | `sm` (< md) | Scroll vertical fluido, cards confortáveis |
| **iPad Mini / Air / Pro** | 768 × 1024 px ou 820 × 1180 px | `md` / `lg` | **Layout Fixo Preservado (Dashboard)**, 2 colunas lado a lado |
| **Desktop / Laptop** | 1280 × 800 px ou 1920 × 1080 px | `xl` / `2xl` | **Layout Fixo Preservado (Dashboard)**, atalhos de teclado |

---

## 6. Plano de Implementação em Fases

### Fase 1: Fundação do Shell e Regras Globais de Viewport
- Ajustar `index.html` (remover `overflow-hidden` do `body` no mobile ou usar classes responsivas).
- Ajustar `index.css` para suporte a `100dvh` e `-webkit-overflow-scrolling: touch`.
- Atualizar `AppShell` e `<main>` em `App.tsx` para permitir `overflow-y-auto` em dispositivos `< md`.
- Validar cálculo de padding da `BottomNavBar` (`pb-safe`).

### Fase 2: Redesign Responsivo do Menu Principal (`MainMenu.tsx`)
- Implementar switcher de abas horizontal compacto no topo para telas móveis.
- Exibir a sidebar clássica `w-64` exclusivamente em `md:flex`.
- Reestruturar o painel de "Novo Jogo": filtros em bloco vertical, cards de times em grade responsiva e botão flutuante de início de carreira.

### Fase 3: Loop Principal do Jogo (`ClubOverview`, `TacticsScreen`, `RoundResultsScreen`)
- Desbloquear scroll vertical em `ClubOverview.tsx`.
- Ajustar o campo tático e ancorar o botão "JOGAR PARTIDA >>" em `TacticsScreen.tsx`.
- Empilhar resultados e tabela com botão de avanço acessível em `RoundResultsScreen.tsx`.

### Fase 4: Telas Secundárias & Modais
- Adaptar `TransfersScreen`, `FinancesScreen`, `LeagueStatsScreen`, `ChampionsHistoryScreen` e `YouthScreen`.
- Revisar modais flutuantes (Súmula de Partida, Bug Report, Negociação de Contratos) com `max-h-[85dvh]` e scroll interno.

### Fase 5: Bateria de Testes Automatizados & Validação Visual
- Criar testes de integridade de layout para verificar a presença de classes de scroll vertical em mobile (`overflow-y-auto`) e bloqueio em tablet/desktop (`md:overflow-hidden`).
- Validar via Playwright/Node test suite sem regressões no build do Vite e Tauri.

---

## 7. Critérios de Aceite

1. **iPhone SE (375×667):**
   - É possível iniciar um novo jogo sem que nenhum elemento fique cortado na horizontal.
   - O botão "Iniciar Carreira" está visível e clicável em qualquer resolução.
   - Na visão geral e tática, é possível rolar verticalmente a tela com o toque do polegar para ver todos os elementos até o rodapé.
2. **iPhone 16 (393×852):**
   - Respeito à Dynamic Island no topo e ao Home Indicator na base sem sobreposição de botões.
   - A `BottomNavBar` permanece fixa e totalmente funcional enquanto o conteúdo da página rola por trás.
3. **iPad e Desktop (>= 768px):**
   - **Zero alteração visual negativa**: a tela permanece fixa (`overflow-hidden`), sem rolagem global da janela do navegador, mantendo a experiência de dashboard nativo intacta.
4. **Build & Testes:**
   - O projeto compila com `npm run build` sem erros de TypeScript e os testes existentes continuam passando com 100% de sucesso.
