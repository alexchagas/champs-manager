# Tutorial: Como Remover os Escudos do Git Sem Apagar os Arquivos do Computador

Este guia explica como desindexar os mais de 17.000 escudos e mini escudos do controle de versão do **Git** mantendo **100% dos arquivos intactos na sua máquina**.

---

## 1. O Conceito: Como o Git Enxerga Seus Arquivos

No Git existem três áreas fundamentais:
1. **Working Directory (Seu Disco Local)**: Onde os arquivos reais existem na sua máquina (`web/public/escudos/...`).
2. **Index / Staging Area (Área de Rastreamento)**: A lista de arquivos que o Git está monitorando para o próximo commit.
3. **Repositório Git (Histórico / Commits)**: Os commits salvos no histórico.

### A Diferença Vital:
- `git rm arquivo.png`: **Apaga o arquivo do seu computador** e tira do Git. ❌ *(Nunca use isso se quiser manter os arquivos!)*
- `git rm --cached arquivo.png`: **Mantém o arquivo no seu computador**, mas avisa ao Git: *"pare de rastrear este arquivo a partir de agora"*. ✅ *(É exatamente isso que queremos!)*

---

## 2. Passo a Passo Prático

Abra o seu terminal na raiz do projeto `champs-manager` e siga os passos abaixo:

### Passo 1: Informar ao `.gitignore` para ignorar os escudos
Antes de desindexar, precisamos garantir que o Git não tente adicioná-los novamente no futuro.

Abra o arquivo `.gitignore` na raiz do projeto e adicione estas duas linhas ao final:

```gitignore
# Escudos gerenciados fora do repositório de código (Cloudflare R2 / CDN)
web/public/escudos/
web/public/escudosMini/
```

*(Nota: os áudios em `web/public/audio/` **NÃO** entram no `.gitignore`, pois devem continuar rastreados e embutidos na aplicação).*

---

### Passo 2: Desindexar as pastas com `--cached`
Execute os seguintes comandos no terminal:

```bash
git rm -r --cached web/public/escudos
git rm -r --cached web/public/escudosMini
```

> **O que a flag `-r` faz?**  
> Aplica a remoção recursivamente em todos os arquivos dentro das pastas.  
> **O que a flag `--cached` faz?**  
> Diz ao Git para remover apenas da área de controle (índice), **deixando todos os arquivos físicos intocados no seu disco**.

---

### Passo 3: Conferir que os arquivos NÃO foram apagados
Você pode testar e ter 100% de certeza de que seus arquivos continuam no seu computador:

1. Abra a pasta `web/public/escudos/` no Finder ou execute no terminal:
   ```bash
   ls web/public/escudos | head -n 10
   ```
   *Você verá que todos os escudos continuam lá normalmente.*

2. Verifique o status do Git:
   ```bash
   git status
   ```
   *O Git reportará:*
   - `modified: .gitignore`
   - Vários `deleted: web/public/escudos/...` (indicando que foram removidos **do rastreamento do Git**, não do disco).

---

### Passo 4: Fazer o commit da desindexação
Agora podemos commitar essa alteração para que o repositório remoto (GitHub) fique leve:

```bash
git add .gitignore
git commit -m "chore: remove crest assets from git tracking (migrated to R2)"
```

---

### Passo 5: Enviar para o GitHub
Envie o commit para a branch principal:

```bash
git push origin main
```

---

## 3. Resumo de Comandos Rápidos

Quando você quiser executar tudo de uma vez:

```bash
# 1. Adicionar ao .gitignore
echo -e "\nweb/public/escudos/\nweb/public/escudosMini/" >> .gitignore

# 2. Desindexar sem apagar do disco
git rm -r --cached web/public/escudos
git rm -r --cached web/public/escudosMini

# 3. Adicionar o .gitignore e commitar
git add .gitignore
git commit -m "chore: remove crest assets from git tracking"

# 4. Enviar para o repositório remoto
git push origin main
```

---

## 4. O que Acontece Após Este Processo?

1. **Na sua máquina**: Você continua com todos os 17.000 escudos e mini escudos intactos na pasta `web/public/`, podendo rodar `npm run dev` localmente sem nenhum problema.
2. **No GitHub / Pipeline**: O repositório encolhe cerca de **30 MB**, o Git roda comandos de forma instantânea e o deploy não corre o risco de bater no teto de 20.000 arquivos da Cloudflare.
3. **No Cloudflare R2**: Quando configurarmos o R2, um script faz o upload dos arquivos que estão na sua pasta para o bucket na nuvem, servindo todos os usuários de forma rápida e com zero egress fee.
