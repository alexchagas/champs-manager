# 01. Arquitetura Geral & Engenharia Reversa - Brasfoot 22-23

Este documento consolida a análise de arquitetura do binário `brasfoot.jar` realizada através do **REA (Reverse Engineer Anything)**, servindo como especificação canônica para o desenvolvimento do **Champs Manager**.

---

## 1. Visão Geral do Binário

* **Artefato Alvo:** `brasfoot.jar` (SHA-256: `c771b3f009d534d1fc730fa057a7180de93ced2ab52454f5b165c57090f022aa`)
* **Tamanho:** 7,27 MB (2.187 arquivos no container ZIP)
* **Classes Compiladas:** 1.038 arquivos `.class`
* **Entry Point (Manifesto):** `org.eclipse.jdt.internal.jarinjarloader.JarRsrcLoader`
* **Classe Principal do Jogo:** `best.h2`
* **Dependências Embutidas:**
  * `kryo-4.0.2.jar` (Serialização binária de alta velocidade)
  * `reflectasm-1.10.1-shaded.jar` (Reflexão acelerada via bytecode)
  * `objenesis-2.1.jar` (Instanciação de objetos sem construtores padrão)
  * `minlog-1.3.0.jar` (Logger interno)

---

## 2. Mapa de Pacotes e Responsabilidades

A tabela abaixo correlaciona a estrutura ofuscada do jogo com suas responsabilidades de negócio:

| Pacote | Classes | Responsabilidade Técnica |
| :--- | :--- | :--- |
| `best` | 78 | **Bootstrap & Central State:** Ponto de entrada (`best.h2`), estado da temporada (`best.f`), clube em runtime (`best.ah`), jogador em runtime (`best.f_0`), partida (`best.I`), evento de jogo (`best.A`). |
| `c` | 2 | **Motor & Persistência:** `c.a` (Gerenciador de I/O, Kryo e Saves) e `c.b` (Motor de Simulação de Partida de 90 minutos). |
| `e` | 2 | **Templates Estáticos:** `e.t` (Modelo de Clube gravado no `.ban`) e `e.g` (Modelo de Jogador gravado no `.ban`). |
| `est` | 7 | **Tipos de Configuração (Sem ofuscação):** `Options`, `ConfigLigaType`, `ConfigEstadualType`, `InfoArquivoSalvoType`, `LoadLigaOptions`, `ArrayLigaType`. |
| `forms` | 27 | **Interface Swing & RNG:** Janelas e telas de jogo; inclui `forms.Randoms` (Gerador de distribuições Poisson, Gaussiana, Beta, Gama). |
| `f` | 40 | **Módulos de Campeonatos:** Estruturas de ligas nacionais, divisões (A, B, C, D), estaduais, copas nacionais e torneios internacionais. |
| `components`| 85 | **Widgets UI:** Controles visuais, seletores numéricos, sliders e renderizadores customizados do Nimbus. |
| `a`, `b`, `d`, `h` | 790 | **Lógica Ofuscada de Suporte:** Tabelas de pontuação, geradores de calendário, transferências de mercado, finanças e diálogos. |

---

## 3. Fluxo de Execução (Lifecycle)

```
[Launcher: Brasfoot.sh]
    │  Configura -Duser.dir=~/Library/Application Support/Brasfoot
    │  Injeta flags de reflexão: --add-opens java.base/...
    ▼
[JarRsrcLoader]
    │  Carrega kryo e dependências embutidas em runtime
    ▼
[best.h2.main()]
    │  Define Nimbus LookAndFeel
    │  Verifica registro de licença no Java Preferences (systemacxyz22)
    │  Chama c.a.vH() -> Pré-carrega áudios wav (sons/intervalo, gol1, etc.)
    │  Instancia Window principal (gq_0 de dimensão 532x300)
    ▼
[Loop do Menu Principal]
    │  "Novo Jogo": Carrega ligas (.cfg/.ces) e templates de times (.ban)
    │  "Carregar Jogo": Lê sav/<nome>.s22 via Kryo e restaura best.f
    ▼
[Loop da Carreira (best.f)]
    │  Semana a semana: calendário, escalação, treinos, finanças
    │  Rodada de Partida: instanciada via c.b(best.I)
    │  Salvar: serializa estado em *.s22 e *.info
```

---

## 4. Descoberta Crítica de Portabilidade: Case Sensitivity

O bytecode foi ofuscado gerando identificadores sobrecarregados por caixa alta/baixa (`a/A.class` vs `a/a.class`, `b/K.class` vs `b/k.class`). No macOS/Windows (sistemas de arquivos case-insensitive), a extração direta para diretório colide e sobrescreve arquivos. 

Para a recriação no **Champs Manager**, toda a arquitetura será reimplementada de forma limpa, tipada e sem ofuscação, eliminando completamente essa dependência arcaica de nomes curtos.
