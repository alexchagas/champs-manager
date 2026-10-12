# 02. Modelos de Dados e Persistência - Brasfoot 22-23

Este documento detalha as estruturas de dados, modelos de clubes e atletas, e o sistema de persistência serializada do Brasfoot.

---

## 1. Separação de Modelos: Templates Estáticos vs. Runtime

O Brasfoot divide seus dados em duas camadas distintas:

1. **Templates Estáticos (`e.t` e `e.g`):** Arquivos distribuídos na pasta `teams/*.ban`. Representam a configuração de fábrica dos times e jogadores (nome, país, idade, características base).
2. **Entidades Ativas em Runtime (`best.ah` e `best.f_0`):** Instanciadas na inicialização de um novo jogo dentro do estado geral (`best.f`). Contêm atributos dinâmicos como moral, energia física, contratos vigentes, estatísticas e lesões.

---

## 2. Especificação do Modelo de Jogador

### A. Template Estático (`e.g`) — Serializado no `.ban`
Classe: `e.g implements java.io.Serializable (serialVersionUID = 16L)`

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `a` | `String` | Nome completo / de exibição do jogador |
| `b` | `boolean` | Flag de jogador estrela (`estrela`) |
| `c` | `int` | ID numérico do País de nacionalidade |
| `d` | `int` | Idade (anos) |
| `e` | `int` | Posição tática base: `0`=Goleiro, `1`=Lateral, `2`=Zagueiro, `3`=Volante/Meia, `4`=Atacante |
| `f` | `int` | Status inicial na escalação: `1`=Titular, `0`=Reserva |
| `g` | `int` | Característica Principal (`cr1`): ID de habilidade (Desarme, Passe, Finalização, etc.) |
| `h` | `int` | Característica Secundária (`cr2`) |
| `i` | `int` | Lado preferido: `0`=Direito, `1`=Esquerdo, `2`=Ambidestro |
| `j` | `boolean` | Flag `topMundial` (jogadores de elite global) |
| `tid`, `sid`, `aid` | `int` | Identificadores internos e referências cruzadas |

### B. Jogador em Execução (`best.f_0`) — Serializado no Save (`.s22`)
Classe: `best.f_0 implements java.io.Serializable`

| Campo / Método | Tipo | Descrição |
| :--- | :--- | :--- |
| `dm` / `getNome()` | `String` | Nome do atleta |
| `em` / `getIdade()`| `int` | Idade atual |
| `eu` / `fk()` | `int` | **Força Máxima** do jogador (escala de 1 a 100) |
| `ev` / `fl()` | `int` | **Força Atual** (ajustada por condição/lesão) |
| `eK` / `fp()` | `int` | **Energia Física (0 a 100)**: desgastada em jogos (`aj(n)`), recuperada em descanso (`ak(n)`) |
| `status` | `int` | `1`=Titular, `0`=Reserva |
| `eI` / `fo()` | `long` | Salário (semanal ou mensal) |
| `eJ` | `long` | Valor de passe de mercado |
| `eo` / `fg()` | `best.ah` | Referência ao Clube atual |
| `eq` / `fi()` | `int` | Força geral sem atributos individuais |
| `ey` / `ez` | `int` | Características `cr1` e `cr2` herdadas |
| `eM` / `eN` | `double` | Moral e motivação do atleta |
| `eL` / `fs()` | `Boolean` | Flag de lesão ativa |
| `eO` / `fv()` | `Boolean` | Flag de suspensão por cartões |

---

## 3. Especificação do Modelo de Clube

### A. Template Estático (`e.t`) — Serializado no `.ban`
Classe: `e.t implements java.io.Serializable (serialVersionUID = 16L)`

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `int` | ID do Clube |
| `e` | `String` | Nome do Clube |
| `d` | `String` | `fileRef` (nome base do arquivo `.ban`, escudo e camisa) |
| `a` | `int` | ID do País |
| `b` | `int` | ID do Estado (para federações estaduais brasileiras) |
| `c` | `int` | Nível / Reputação de divisão inicial |
| `f` | `String` | Nome do Estádio |
| `g` | `int` | Capacidade do Estádio |
| `h` | `String` | Nome do Técnico inicial |
| `i` | `int` | Nacionalidade do Técnico |
| `l` | `ArrayList<e.g>` | Elenco Profissional (limite recomendado: 30 atletas) |
| `m` | `ArrayList<e.g>` | Categorias de Base / Juniores (limite: 15 atletas) |
| `cor1` | `String` | Cor primária (`#RRGGBB`) |
| `cor2` | `String` | Cor secundária (`#RRGGBB`) |

### B. Clube em Execução (`best.ah`)
* Gerencia o saldo financeiro em conta, dívidas, empréstimos bancários e bilheteria.
* Mantém as formações táticas (`kj()`), batedor de faltas/pênaltis (`ke()`) e escanteios (`lq()`).

---

## 4. O Ecossistema de Persistência e Formatos de Arquivo

O Brasfoot implementa uma estratégia híbrida de I/O em `c.a`:

```
┌─────────────────────────────────────────────────────────────┐
│                       SISTEMA DE I/O                        │
├───────────────┬─────────────────────────────┬───────────────┤
│ Extensão      │ Engine / Protocolo          │ Finalidade    │
├───────────────┼─────────────────────────────┼───────────────┤
│ .ban          │ Java ObjectOutputStream     │ Times & Elencos│
│ .bcf          │ Java ObjectOutputStream     │ Opções globais│
│ .info         │ Java ObjectOutputStream     │ Metadados save│
│ .s22          │ Kryo 4.0.2 Binary Output    │ Savegame total│
│ .sbck         │ Files.copy (Binário)        │ Backup seguro │
└───────────────┴─────────────────────────────┴───────────────┘
```

### O Protocolo Kryo dos Saves (`.s22`)
Ao salvar (`c.a.ae(String nome)`):
```java
Kryo kryo = new Kryo();
kryo.setRegistrationRequired(false);
FileOutputStream fos = new FileOutputStream(userDir + "/sav/" + nome + ".s22");
Output output = new Output(fos);
kryo.writeClassAndObject(output, SR);   // best.f  (Estado Geral)
kryo.writeClassAndObject(output, afQ);  // best.ay (Histórico e Estatísticas)
output.close();
```
* O uso de `setRegistrationRequired(false)` permite que o Kryo serialize grafos polimórficos de objetos em tempo de execução sem registrar IDs prévios de classe.
* Ao concluir a gravação, uma cópia idêntica é gravada como `<nome>.sbck`.
* Se o arquivo `.s22` estiver corrompido, o carregador tenta automaticamente o fallback no `.sbck`.

---

## 5. Especificação para o Champs Manager (Equivalente Rust)

Para o **Champs Manager**, a persistência abandonará a serialização Java/Kryo em favor de um formato portável, versionado e seguro:

* **Bancos de Dados de Dados Fixos (Times/Jogadores):**
  * Arquivos JSON ou MessagePack estruturados, ou SQLite leve embarcado.
* **Formato de Saves (`.cmsav`):**
  * `Bincode` ou `MessagePack` comprimido com `zstd` (rápido, tipado e com validação de esquema).
  * Metadados no header com SHA-256 e versão do schema para migração automática.
