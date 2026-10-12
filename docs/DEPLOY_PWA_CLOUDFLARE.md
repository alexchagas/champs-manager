# 🚀 Guia de Deploy PWA, Cloudflare Pages, Sentry & Discord

Este guia explica passo a passo como colocar o **Champs Manager 2026** no ar gratuitamente, com proteção por senha, suporte a PWA (instalação no iPhone, iPad e Android) e observabilidade completa com envio de bugs para o seu celular.

---

## 1. Como Criar o Webhook no Discord (Para receber relatórios de bug)

1. No seu Discord, crie um servidor (ou use um existente) e crie um canal de texto (ex: `#champs-bugs`).
2. Clique na **engrenagem (Configurações do canal)** ao lado do nome do canal.
3. Vá em **Integrações (Integrations)** > **Webhooks** > **Criar Webhook**.
4. Dê o nome de `Champs Manager BugBot` e clique em **"Copiar URL do Webhook"** (`Copy Webhook URL`).
5. Guarde essa URL! Ela será usada na Cloudflare.

---

## 2. Como Configurar o Sentry (Opcional - Rastreamento automático de erros)

1. Crie uma conta gratuita em [sentry.io](https://sentry.io).
2. Crie um novo projeto escolhendo a plataforma **React**.
3. Copie a chave **DSN** fornecida (algo como `https://xxxxxx@o450xxxxxx.ingest.sentry.io/xxxxxx`).
4. Em *Project Settings* > *Security & Privacy*, no campo **Allowed Domains**, adicione:
   * `localhost`
   * `*.pages.dev` (ou seu domínio próprio)
5. Guarde o seu DSN!

---

## 3. Como Fazer o Deploy no Cloudflare Pages (100% Grátis)

1. Acesse [pages.cloudflare.com](https://pages.cloudflare.com) e crie uma conta gratuita (não precisa de cartão).
2. No painel, clique em **Create application** > **Pages** > **Connect to Git**.
3. Selecione a sua conta do GitHub e escolha o repositório privado **`champs-manager`**.
4. Preencha as configurações do projeto:
   * **Project Name:** `champs-manager` (sua URL será `champs-manager.pages.dev`)
   * **Production Branch:** `main`
   * **Framework Preset:** `Vite` (ou `None`)
   * **Root Directory:** `web`
   * **Build Command:** `npm run build`
   * **Build Output Directory:** `dist`
5. Na seção **Environment Variables (Variáveis de Ambiente)**, adicione:
   * `DISCORD_WEBHOOK_URL` = `https://discord.com/api/webhooks/1559307258033086534/Kos_RPWWCJT966J7qToOCMexJcFP_4NkU-n_K65NBIEcTg8sOkXRZVbsLes_296xJOm4`
   * `VITE_SENTRY_DSN` = `https://0fe88f0dba4b1ea02cc33e1dd7d2f1d6@o4512245219983361.ingest.de.sentry.io/4512245317763152`
   * `VITE_ACCESS_HASH` = `4c7d4c3e0e024e04a6c41ba1932ec71b991bef21b3e0a90659de092e1baddc51`
6. Clique em **Save and Deploy**.
7. Em cerca de 35 a 45 segundos, seu jogo estará online em `https://champs-manager.pages.dev`!

---

## 4. Como Alterar a Chave de Acesso Beta (Senha do Jogo)

A senha padrão embutida no projeto é:
👉 **`CHAMPS2026`**

Se você quiser criar outra senha (por exemplo, `MINHA_SENHA`):
1. No terminal do seu Mac, gere o hash SHA-256 da sua nova senha:
   ```bash
   echo -n "MINHA_SENHA" | shasum -a 256
   ```
2. Copie o hash de 64 caracteres gerado.
3. No painel da Cloudflare Pages, vá em **Settings** > **Environment variables** e defina:
   * `VITE_ACCESS_HASH` = `<hash_gerado>`
4. Dê um novo deploy ou `git push`. A nova senha passará a valer imediatamente!

---

## 5. Como Jogar e "Baixar o App"

### No iPhone e iPad (Safari):
1. Abra a URL (ex: `https://champs-manager.pages.dev`) no **Safari**.
2. Digite a senha `CHAMPS2026` na tela de Acesso Antecipado.
3. Toque no botão de **Compartilhar** do Safari (quadrado com seta para cima).
4. Escolha **"Adicionar à Tela de Início"** (*Add to Home Screen*).
5. O ícone do jogo aparecerá na tela do aparelho.
6. Ao abrir pelo ícone, ele executa em **tela cheia standalone**, sem barras do navegador, exatamente como um app nativo!

> 💡 **Dica de Link com Chave:** Se você quiser mandar um link para um amigo que já entra liberado direto sem ele precisar digitar a senha:  
> `https://champs-manager.pages.dev/?key=CHAMPS2026`  
> O jogo valida a chave automaticamente, salva a autorização no aparelho dele e remove a chave da barra de navegação!

### No Android (Chrome):
1. Abra o link no Chrome.
2. O navegador mostrará o aviso ou banner **"Adicionar à tela inicial"** ou **"Instalar Aplicativo"**.
3. O app é instalado na gaveta de aplicativos do celular.
