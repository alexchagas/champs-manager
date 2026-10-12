// Cloudflare Worker entrypoint with Static Assets & Discord Bug Reporter

interface Env {
  ASSETS: Fetcher;
  DISCORD_WEBHOOK_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Relay Bug Reports to Discord safely
    if (url.pathname === '/api/report' && request.method === 'POST') {
      try {
        const webhookUrl = env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) {
          return new Response(
            JSON.stringify({ ok: false, error: 'DISCORD_WEBHOOK_URL não configurado na Cloudflare.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const payload = (await request.json()) as any;
        const author = payload.author || 'Jogador Anônimo';
        const description = payload.description || 'Sem descrição fornecida.';
        const initialError = payload.initialError
          ? `\`\`\`${payload.initialError.slice(0, 500)}\`\`\``
          : 'Nenhum erro de crash';
        const contextInfo = payload.gameContext
          ? `**Clube:** ${payload.gameContext.userClubName || 'N/A'}\n**Rodada:** ${payload.gameContext.currentRound || 'N/A'}\n**Tela:** ${payload.gameContext.activeScreen || 'N/A'}`
          : 'Sem contexto de partida';
        const device = payload.device?.userAgent || 'Desconhecido';
        const screen = payload.device?.screen || 'N/A';

        // Rich Embed for Discord
        const discordBody = {
          username: 'Champs Manager BugBot',
          avatar_url: 'https://raw.githubusercontent.com/alexchagas/champs-manager/main/web/public/pwa-192x192.png',
          embeds: [
            {
              title: '🐛 Novo Relatório de Bug / Feedback',
              color: 0x10b981,
              fields: [
                { name: '👤 Jogador', value: author, inline: true },
                { name: '📱 Tela / Resolução', value: screen, inline: true },
                { name: '🎮 Estado do Jogo', value: contextInfo, inline: false },
                { name: '📝 Descrição do Jogador', value: description.slice(0, 1024), inline: false },
                { name: '⚠️ Erro Técnico', value: initialError, inline: false },
                { name: '🌐 Dispositivo', value: `\`${device.slice(0, 250)}\``, inline: false },
              ],
              footer: { text: 'Champs Manager Observability • Cloudflare' },
              timestamp: new Date().toISOString(),
            },
          ],
        };

        const discordResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordBody),
        });

        if (!discordResponse.ok) {
          const errText = await discordResponse.text();
          return new Response(
            JSON.stringify({ ok: false, error: `Discord error: ${errText}` }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, error: err?.message || 'Erro interno' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Serve static PWA frontend assets
    return env.ASSETS.fetch(request);
  },
};
