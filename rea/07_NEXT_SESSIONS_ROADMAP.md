# 07. Roadmap das Próximas Sessões (Fechamento do Projeto)

> [!NOTE]
> **Status: 100% CONCLUÍDO & ENTREGUE**
> Todas as sessões deste roadmap (7, 8, 9 e 10) foram executadas e validadas:
> - **Sessão 7:** Novo Jogo com 703 clubes reais, 134 países e pirâmide brasileira entregue em `MainMenu.tsx`.
> - **Sessão 8:** Mercado de Transferências na interface (Passes livres, propostas e contratos) entregue em `TransfersScreen.tsx`.
> - **Sessão 9:** Obras no estádio, ingressos, empréstimos bancários e juniores entregues em `FinancesScreen.tsx` e `YouthScreen.tsx`.
> - **Sessão 10:** Jornal da Rodada, artilharia global e treinadores entregues em `NewsFeed.tsx`, `LeagueStatsScreen.tsx` e `ManagersScreen.tsx`.

Este documento estabelece o plano para completar 100% das funcionalidades do Brasfoot 22-23 no Champs Manager, com escopos bem delimitados para cada sessão subsequente.

---

## 1. Visão Geral das Próximas Sessões

```
Sessão 7 ──► Novo Jogo Completo & 703 Clubes Reais (Séries A, B, C, D e Mundo)
    │
Sessão 8 ──► Mercado de Transferências na UI (Passes Livres, Propostas, Contratos)
    │
Sessão 9 ──► Obras no Estádio, Ingressos, Empréstimos Bancários & Juniores
    │
Sessão 10 ──► Jornal da Rodada, Estatísticas de Artilharia Global & Build Final
```

---

## 2. Detalhamento e Prompts Prontos para as Novas Sessões

### 🚀 Sessão 7: Novo Jogo Completo & Integração dos 703 Clubes Reais
* **Objetivo:** Tirar o time hardcoded (Flamengo) e permitir ao jogador escolher qualquer clube do Brasil e do mundo, com filtros por país e divisão.
* **Modelo Recomendado:** **Gemini Pro** ou **Gemini Flash**.
* **Prompt da Sessão:**
```text
/goal Seu objetivo nesta sessão é implementar o fluxo completo de "Novo Jogo" no Champs Manager e conectar a base real de 703 clubes gerada em data/teams.json:
1. Analise data/teams.json e conecte a lista completa de clubes, ligas (Séries A, B, C, D e ligas internacionais) e estados ao frontend web.
2. Na tela MainMenu.tsx, crie a experiência autêntica de Novo Jogo:
   - Seleção de País e Divisão de largada.
   - Lista/grid de clubes com escudo oficial, nome, estádio, capacidade e estrelas de reputação.
   - Campo para o jogador digitar o nome do seu técnico (ex: "Alex Chagas").
   - Opções de jogo (tempo de simulação, áudio ativado, etc.).
3. Ao clicar em "Iniciar Carreira", crie o estado isolado com o clube selecionado pelo jogador e gere o calendário da divisão escolhida.
4. Garanta que o jogador possa jogar com qualquer clube e que a navegação para a tela de Visão Geral ocorra perfeitamente.
```

---

### 💼 Sessão 8: Mercado de Transferências na UI & Gestão de Contratos
* **Objetivo:** Trazer a lógica do `market.rs` para a interface web, permitindo comprar, vender, contratar agentes livres e renovar contratos.
* **Modelo Recomendado:** **Gemini Pro**.
* **Prompt da Sessão:**
```text
/goal Seu objetivo nesta sessão é criar a tela de Mercado de Transferências (TransfersScreen.tsx) e conectar todas as regras de compra, venda e contratos no Champs Manager:
1. Revise a lógica de mercado existente em crates/champs-core/src/market.rs e exponha os métodos necessários no wasm.rs (listar agentes livres, buscar atletas por filtro, fazer proposta, aceitar proposta da IA, renovar contrato).
2. Construa a tela TransfersScreen.tsx acessível pelo Header do jogo com as seguintes abas:
   - "Passes Livres": Lista de atletas sem contrato que podem ser contratados apenas negociando salário.
   - "Buscar Jogadores": Filtro por posição (Goleiro, Zagueiro, etc.), faixa de força, idade e valor de mercado em outros clubes.
   - "Propostas Recebidas": Notificações quando clubes da IA enviam ofertas para comprar jogadores do seu time (botões Aceitar/Recusar).
   - "Contratos do Elenco": Anos restantes de contrato de cada jogador do time e botão para renovar salário.
3. Atualize o saldo financeiro do clube ao comprar/vender e integre as validações de limite de elenco (mínimo 16, máximo 30 atletas).
```

---

### 🏟️ Sessão 9: Obras no Estádio, Ingressos, Finanças & Juniores
* **Objetivo:** Adicionar a ampliação de capacidade do estádio, precificação de ingressos, empréstimos bancários e gestão das categorias de base.
* **Modelo Recomendado:** **Gemini Pro**.
* **Prompt da Sessão:**
```text
/goal Seu objetivo nesta sessão é implementar a gestão de Estádio, Finanças detalhadas e Categorias de Base no Champs Manager:
1. Na tela de Visão Geral / Estádio:
   - Exiba o estádio com capacidade atual e média de público.
   - Adicione opções de expansão de capacidade (+2.000, +5.000, +10.000 lugares) pagando valores debitados do caixa.
   - Adicione controle para definir o preço do ingresso (R$), impactando a arrecadação das partidas em casa.
2. No painel de Finanças:
   - Adicione sistema de empréstimo bancário (pegar até o limite de crédito do clube e pagar em parcelas com juros).
   - Exiba o demonstrativo semanal de receitas (bilheteria, vendas) e despesas (salários, obras).
3. Na aba/tela de Juniores:
   - Exiba os 10 a 15 atletas da base do clube (youth squad).
   - Adicione os botões "Promover ao Profissional" e "Dispensar da Base".
4. Verifique que todas as operações recalculam o caixa do clube e a folha salarial corretamente.
```

---

### 📰 Sessão 10: Jornal da Rodada, Artilharia Global & Polimento Final
* **Objetivo:** Criar o feed de notícias da temporada, telas de estatísticas completas de todos os artilheiros e o empacotamento final.
* **Modelo Recomendado:** **Gemini Flash** ou **Gemini Pro**.
* **Prompt da Sessão:**
```text
/goal Seu objetivo nesta sessão é implementar o sistema de Notícias/Jornal, tabela de artilharia global e fazer o polimento final do Champs Manager:
1. Crie o componente NewsFeed.tsx / Jornal da Rodada exibindo manchetes dinâmicas geradas a cada semana (vitórias em clássicos, lesões graves de atletas, demissões de técnicos e maiores transferências do mercado).
2. Adicione a tela de Estatísticas do Campeonato exibindo os 10 maiores artilheiros e líderes de assistências de todos os clubes da divisão.
3. Faça uma revisão geral de UX: atalhos de teclado (Espaço para avançar semana/jogo, Esc para voltar), responsividade e persistência automática no save local.
4. Execute o build de produção web (npm run build) e verifique que o bundle foi gerado sem erros.
```
