// Cloudflare Pages Function: POST /api/report
// Relays bug reports safely to Discord Webhook without exposing the webhook URL to the client.

interface Env {
  DISCORD_WEBHOOK_URL?: string;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const webhookUrl = context.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: 'DISCORD_WEBHOOK_URL is not configured on Cloudflare.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const payload = await context.request.json() as any;

    const author = payload.author || 'Jogador Anônimo';
    const description = payload.description || 'Sem descrição fornecida.';
    const initialError = payload.initialError ? `\`\`\`${payload.initialError.slice(0, 500)}\`\`\`` : 'Nenhum erro de crash';
    const contextInfo = payload.gameContext
      ? `**Clube:** ${payload.gameContext.userClubName || 'N/A'}\n**Rodada:** ${payload.gameContext.currentRound || 'N/A'}\n**Tela:** ${payload.gameContext.activeScreen || 'N/A'}`
      : 'Sem contexto de partida';
    const device = payload.device?.userAgent || 'Desconhecido';
    const screen = payload.device?.screen || 'N/A';

    // Discord Webhook Rich Embed
    const discordBody = {
      username: 'Champs Manager BugBot',
      avatar_url: 'https://raw.githubusercontent.com/alexchagas/champs-manager/main/web/public/pwa-192x192.png',
      embeds: [
        {
          title: '🐛 Novo Relatório de Bug / Feedback',
          color: 0x10b981, // Emerald green
          fields: [
            {
              name: '👤 Jogador',
              value: author,
              inline: true,
            },
            {
              name: '📱 Tela / Resolução',
              value: screen,
              inline: true,
            },
            {
              name: '🎮 Estado do Jogo',
              value: contextInfo,
              inline: false,
            },
            {
              name: '📝 Descrição do Jogador',
              value: description.slice(0, 1024),
              inline: false,
            },
            {
              name: '⚠️ Erro Técnico',
              value: initialError,
              inline: false,
            },
            {
              name: '🌐 Dispositivo / User Agent',
              value: `\`${device.slice(0, 250)}\``,
              inline: false,
            },
          ],
          footer: {
            text: 'Champs Manager Observability • Cloudflare Pages',
          },
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
        JSON.stringify({ ok: false, error: `Discord responded with error: ${errText}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
