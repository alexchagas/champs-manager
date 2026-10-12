# Champs Manager - Web Interface

Interface web moderna inspirada no clássico **Brasfoot**, desenvolvida com **React 19**, **TypeScript**, **Tailwind CSS v4** e **Vite**.

## 🎨 Identidade Visual e Recursos

- **Estética Clássica do Brasfoot**: Tema verde e cinza escuro (`#0b1410`), tabelas densas e compactas com altura otimizada para caber na tela sem rolagem desnecessária.
- **Tipografia**: Chakra Petch (estilo placar digital retrô), JetBrains Mono (estatísticas e números tabulares) e Outfit (interface limpa).
- **Áudio Sintetizado Web Audio API**: Efeitos sonoros procedurais para apito do árbitro, chutes, grito e êxtase de gol da torcida, sem necessidade de arquivos externos de áudio.

---

## 🖥️ As 4 Telas Essenciais

### 1. Tela Inicial / Menu
- **Novo Jogo**: Seleção rápida entre os 20 clubes da Série A do Brasileirão, nome do treinador customizável e prévia do time (estádio, capacidade, elenco, orçamento).
- **Carregar Jogo**: Gerenciamento de saves locais no navegador com data, rodada e clube, além de opção de salvar o jogo atual.
- **Opções do Jogo**: Chave liga/desliga de som, controle de volume, velocidade de simulação padrão (1x, 2x, 5x) e pausa automática em lances de gol.

### 2. Visão Geral do Clube
- **Tabela de Classificação da Série A**: 20 clubes com pontos, jogos, vitórias, empates, derrotas, saldo de gols e últimos 5 jogos. Zonas coloridas características (Libertadores, Pré-Libertadores, Sul-Americana e Rebaixamento).
- **Calendário da Temporada**: Navegação pelas 38 rodadas com resultados dos jogos passados e confrontos da rodada atual.
- **Finanças do Clube & Estádio**: Saldo em caixa, projeção semanal, folha salarial, despesas de manutenção, capacidade do estádio e receita estimada de bilheteria.

### 3. Escalação Tática
- **Campo Visual**: Gramado verde com marcações clássicas e os 11 titulares posicionados na formação selecionada (`4-4-2`, `4-3-3`, `3-5-2`, `4-5-1`, `5-3-2`).
- **Arrastar e Soltar (Drag & Drop)**: Permite arrastar os jogadores no campo ou clicar em dois jogadores para inverter titular e reserva.
- **Barras de Energia & Força**: Indicador visual colorido de energia (verde, amarelo, vermelho) e força de 1 a 100.
- **Configuração de Batedores**: Seleção de capitão, batedor de pênaltis, faltas e escanteios.
- **Forças do Setor em Tempo Real**: Cálculo de Defesa, Meio-Campo, Ataque e Média Geral.

### 4. Tela de Partida ao Vivo
- **Cronômetro de 90 Minutos**: Simulação minuto a minuto com aceleração 1x, 2x, 5x, pausa e opção de simular direto até o fim.
- **Placar Digital com Animação de Gol**: Banner animado de gol com comemoração em confetes e reprodução do áudio de torcida.
- **Narração Lance a Lance**: Feed com acontecimentos detalhados em português (finalizações, defesas espetaculares, quase gols, faltas e cartões).
- **Estatísticas ao Vivo**: Posse de bola, chutes no gol, escanteios, faltas e cartões.
- **Encerramento da Rodada**: Exibição dos placares de todos os outros 9 jogos da rodada e atualização da tabela.

---

## 🚀 Como Executar

Dentro do diretório `web`:

```bash
# Iniciar o servidor de desenvolvimento Vite
npm run dev

# Compilar para produção
npm run build

# Pré-visualizar o build de produção
npm run preview
```
