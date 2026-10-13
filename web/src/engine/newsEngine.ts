import type { Club, GameState, MatchFixture, NewsArticle, Player } from '../types';

interface ClassicDerby {
  clubs: [string, string];
  derbyName: string;
}

const CLASSIC_DERBIES: ClassicDerby[] = [
  { clubs: ['Flamengo', 'Fluminense'], derbyName: 'Fla-Flu' },
  { clubs: ['Flamengo', 'Vasco'], derbyName: 'Clássico dos Milhões' },
  { clubs: ['Flamengo', 'Botafogo'], derbyName: 'Clássico da Rivalidade' },
  { clubs: ['Fluminense', 'Vasco'], derbyName: 'Clássico dos Gigantes' },
  { clubs: ['Botafogo', 'Fluminense'], derbyName: 'Clássico Vovô' },
  { clubs: ['Corinthians', 'Palmeiras'], derbyName: 'Derby Paulista' },
  { clubs: ['São Paulo', 'Corinthians'], derbyName: 'Majestoso' },
  { clubs: ['São Paulo', 'Palmeiras'], derbyName: 'Choque-Rei' },
  { clubs: ['Santos', 'Palmeiras'], derbyName: 'Clássico da Saudade' },
  { clubs: ['Santos', 'Corinthians'], derbyName: 'Clássico Alvinegro' },
  { clubs: ['Santos', 'São Paulo'], derbyName: 'San-São' },
  { clubs: ['Grêmio', 'Internacional'], derbyName: 'Gre-Nal' },
  { clubs: ['Atlético Mineiro', 'Cruzeiro'], derbyName: 'Clássico Mineiro' },
  { clubs: ['Bahia', 'Vitória'], derbyName: 'Ba-Vi' },
  { clubs: ['Athletico Paranaense', 'Coritiba'], derbyName: 'Atletiba' },
  { clubs: ['Sport', 'Náutico'], derbyName: 'Clássico dos Clássicos' },
  { clubs: ['Sport', 'Santa Cruz'], derbyName: 'Clássico das Multidões' },
  { clubs: ['Ceará', 'Fortaleza'], derbyName: 'Clássico-Rei' },
];

const INTERIM_COACHES = [
  'Vanderlei Luxemburgo', 'Guto Ferreira', 'Mano Menezes', 'Jair Ventura',
  'Eduardo Barroca', 'Lisca Doido', 'Alberto Valentim', 'Marcelo Cabo',
  'Argel Fuchs', 'Enderson Moreira', 'Roger Machado', 'Tiago Nunes',
  'Fernando Diniz', 'Cuca', 'Dorival Júnior', 'Renato Gaúcho'
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function findDerby(clubA: string, clubB: string): ClassicDerby | undefined {
  const normA = clubA.toLowerCase().trim();
  const normB = clubB.toLowerCase().trim();
  return CLASSIC_DERBIES.find((d) => {
    const c0 = d.clubs[0].toLowerCase();
    const c1 = d.clubs[1].toLowerCase();
    return (
      (normA.includes(c0) || c0.includes(normA)) && (normB.includes(c1) || c1.includes(normB)) ||
      (normA.includes(c1) || c1.includes(normA)) && (normB.includes(c0) || c0.includes(normB))
    );
  });
}

function formatBRL(val: number): string {
  if (val >= 1000000) {
    return `R$ ${(val / 1000000).toFixed(1)} milhões`;
  }
  return `R$ ${(val / 1000).toFixed(0)} mil`;
}

/**
 * Generates newspaper articles for Round 1 (Opening edition of the season).
 */
export function generateKickoffNews(state: GameState): NewsArticle[] {
  const userClub = state.clubs.find((c) => c.id === state.userClubId) || state.clubs[0];
  const articles: NewsArticle[] = [];

  // Headline
  articles.push({
    id: `news-r1-headline`,
    round: 1,
    category: 'geral',
    title: `LARGADA DADA! COMEÇA O CAMPEONATO NACIONAL`,
    subtitle: `${state.clubs.length} clubes iniciam a temporada`,
    content: `A temporada ${state.seasonYear} começa com ${state.clubs.length} clubes na carreira. O calendário contém ${state.calendar.length} partidas programadas.`,
    clubId: userClub.id,
    clubName: userClub.name,
    clubCrest: userClub.crestMiniUrl || userClub.crestUrl,
    date: 'Edição de Abertura',
    isHeadline: true,
    badgeText: 'ESPECIAL DE ABERTURA',
    statsHighlight: `${state.clubs.length} Clubes • 38 Rodadas`,
  });

  // User Manager Appointment
  articles.push({
    id: `news-r1-manager`,
    round: 1,
    category: 'geral',
    title: `NOVA ERA: ${state.managerName.toUpperCase()} ASSUME O ${userClub.name.toUpperCase()}`,
    subtitle: `Diretoria aposta no treinador para comandar o planejamento tático do clube`,
    content: `${state.managerName} assumiu o comando do ${userClub.name} para a temporada ${state.seasonYear}.`,
    clubId: userClub.id,
    clubName: userClub.name,
    clubCrest: userClub.crestMiniUrl || userClub.crestUrl,
    date: 'Plantão Técnico',
    isHeadline: false,
    badgeText: 'NOVO TREINADOR',
  });

  // Big market teaser
  const starPlayer = state.clubs
    .flatMap((c) => c.squad)
    .sort((a, b) => b.marketValue - a.marketValue)[0];

  if (starPlayer) {
    const starClub = state.clubs.find((c) => c.squad.some((p) => p.id === starPlayer.id));
    articles.push({
      id: `news-r1-star`,
      round: 1,
      category: 'transferencia',
      title: `RADAR DO MERCADO: ${starPlayer.name.toUpperCase()} É A JOIA MAIS VALIOSA`,
      subtitle: `Avaliado em ${formatBRL(starPlayer.marketValue)}, é o atleta mais valioso do grupo`,
      content: `${starPlayer.name}, de ${starPlayer.age} anos, é o atleta de maior valor de mercado entre os clubes da carreira. Joga no ${starClub?.name}, tem força ${starPlayer.strength} e atua como ${starPlayer.position}.`,
      clubId: starClub?.id,
      clubName: starClub?.name,
      clubCrest: starClub?.crestMiniUrl || starClub?.crestUrl,
      relatedPlayerName: starPlayer.name,
      relatedPlayerPosition: starPlayer.position,
      date: 'Mercado',
      isHeadline: false,
      badgeText: 'CRAQUE DA LIGA',
      statsHighlight: `Força ${starPlayer.strength}`,
    });
  }

  return articles;
}

/**
 * Generates dynamic newspaper articles for the completed round.
 */
export function generateWeeklyNews(
  state: GameState,
  roundFixtures: MatchFixture[],
  newInjuries: { player: Player; club: Club }[] = [],
  dismissals: { club: Club; oldCoach: string; newCoach: string }[] = [],
  transfers: { player: Player; fromClub: Club; toClub: Club; fee: number }[] = []
): NewsArticle[] {
  const round = state.currentRound;
  const articles: NewsArticle[] = [];

  // 1. CLASSICS & BIG MATCHES
  let foundClassicHeadline = false;

  for (const fix of roundFixtures) {
    const home = state.clubs.find((c) => c.id === fix.homeClubId);
    const away = state.clubs.find((c) => c.id === fix.awayClubId);
    if (!home || !away || fix.homeScore === undefined || fix.awayScore === undefined) continue;

    const derby = findDerby(home.name, away.name);
    const hScore = fix.homeScore;
    const aScore = fix.awayScore;
    const totalGoals = hScore + aScore;
    const diff = Math.abs(hScore - aScore);

    if (derby) {
      // Classic rivalry played!
      const isDraw = hScore === aScore;
      const winner = hScore > aScore ? home : away;
      const loser = hScore > aScore ? away : home;
      const winScore = Math.max(hScore, aScore);
      const loseScore = Math.min(hScore, aScore);

      const title = isDraw
        ? `TUDO IGUAL NO ${derby.derbyName.toUpperCase()}! ${home.name.toUpperCase()} ${hScore} X ${aScore} ${away.name.toUpperCase()}`
        : `${winner.name.toUpperCase()} CONQUISTA O ${derby.derbyName.toUpperCase()}! VITÓRIA POR ${winScore} A ${loseScore}`;

      const subtitle = isDraw
        ? `Clássico tenso termina empatado após 90 minutos de muita disputa e rivalidade`
        : `${winner.name} leva a melhor sobre o rival ${loser.name} e faz a festa da sua torcida`;

      const content = isDraw
        ? `${home.name} e ${away.name} empataram em ${hScore} a ${aScore} no ${derby.derbyName}.`
        : `${winner.name} venceu ${loser.name} por ${winScore} a ${loseScore} no ${derby.derbyName}.`;

      articles.push({
        id: `news-r${round}-classic-${fix.id}`,
        round,
        category: 'classico',
        title,
        subtitle,
        content,
        clubId: winner.id,
        clubName: winner.name,
        clubCrest: winner.crestMiniUrl || winner.crestUrl,
        secondaryClubName: loser.name,
        secondaryClubCrest: loser.crestMiniUrl || loser.crestUrl,
        date: `Rodada ${round}`,
        isHeadline: !foundClassicHeadline,
        badgeText: `🔥 ${derby.derbyName.toUpperCase()}`,
        statsHighlight: `${hScore} x ${aScore}`,
      });

      foundClassicHeadline = true;
    } else if (diff >= 3 || totalGoals >= 5) {
      // Goleada / Thriller match
      const winner = hScore > aScore ? home : away;
      const loser = hScore > aScore ? away : home;
      const winScore = Math.max(hScore, aScore);
      const loseScore = Math.min(hScore, aScore);

      articles.push({
        id: `news-r${round}-goleada-${fix.id}`,
        round,
        category: 'classico',
        title: `MASSACRE! ${winner.name.toUpperCase()} ATROPELA POR ${winScore} A ${loseScore}`,
        subtitle: `Atuação de gala desmonta zaga do ${loser.name} em festival de gols na rodada`,
        content: `${winner.name} venceu ${loser.name} por ${winScore} a ${loseScore} na rodada ${round}.`,
        clubId: winner.id,
        clubName: winner.name,
        clubCrest: winner.crestMiniUrl || winner.crestUrl,
        secondaryClubName: loser.name,
        secondaryClubCrest: loser.crestMiniUrl || loser.crestUrl,
        date: `Rodada ${round}`,
        isHeadline: !foundClassicHeadline,
        badgeText: 'GOLEADA DA RODADA',
        statsHighlight: `${winScore} x ${loseScore}`,
      });
      foundClassicHeadline = true;
    }
  }

  // If no classic was marked as headline, create general lead headline about the round
  if (!foundClassicHeadline && roundFixtures.length > 0) {
    const leader = state.standings[0];
    const leaderClub = state.clubs.find((c) => c.id === leader?.clubId);
    articles.unshift({
      id: `news-r${round}-summary`,
      round,
      category: 'geral',
      title: leaderClub
        ? `${leaderClub.name.toUpperCase()} LIDERA A TABELA APÓS A ${round}ª RODADA`
        : `GIRO DA ${round}ª RODADA: DISPUTA FERVE NO CAMPEONATO`,
      subtitle: `Classificação atualizada após as partidas da rodada`,
      content: `Após a rodada ${round}, ${leaderClub?.name || 'o líder'} ocupa o topo da tabela com ${leader?.points || 0} pontos.`,
      clubId: leaderClub?.id,
      clubName: leaderClub?.name,
      clubCrest: leaderClub?.crestMiniUrl || leaderClub?.crestUrl,
      date: `Rodada ${round}`,
      isHeadline: true,
      badgeText: 'PANORAMA DA LIGA',
      statsHighlight: `${leader?.points || 0} pts`,
    });
  }

  // 2. SEVERE ATHLETE INJURIES
  if (newInjuries.length > 0) {
    newInjuries.slice(0, 2).forEach((inj, i) => {
      const p = inj.player;
      const c = inj.club;
      articles.push({
        id: `news-r${round}-injury-${p.id}-${i}`,
        round,
        category: 'lesao',
        title: `DM LOTADO! ${p.name.toUpperCase()} DESFALCA O ${c.name.toUpperCase()}`,
        subtitle: `Atleta de ${p.age} anos saiu lesionado da rodada`,
        content: `${p.name} (${p.position}, força ${p.strength}) sofreu lesão durante a rodada e está indisponível para escalação do ${c.name}.`,
        clubId: c.id,
        clubName: c.name,
        clubCrest: c.crestMiniUrl || c.crestUrl,
        relatedPlayerName: p.name,
        relatedPlayerPosition: p.position,
        date: 'Departamento Médico',
        isHeadline: false,
        badgeText: '🚑 LESÃO GRAVE',
        statsHighlight: `Força ${p.strength}`,
      });
    });
  }

  // 3. COACH DISMISSALS
  for (const club of state.clubs.filter(c => (c.boardActions || []).length > 0).slice(0, 2)) {
    const recovered = (club.boardActions || []).includes('Salários atrasados quitados');
    articles.push({
      id: `news-r${round}-finance-${club.id}`,
      round, category: 'geral',
      title: recovered ? `${club.name.toUpperCase()} QUITA SALÁRIOS ATRASADOS` : `${club.name.toUpperCase()} ENFRENTA PRESSÃO FINANCEIRA`,
      subtitle: recovered ? 'Clube regulariza pendências com o elenco' : `Obrigações e caixa apertado exigem medidas da diretoria`,
      content: recovered ? `O ${club.name} quitou os salários atrasados nesta rodada. O saldo atual é ${formatBRL(club.balance)}.` : `O ${club.name} encerrou a rodada com saldo de ${formatBRL(club.balance)} e salários atrasados de ${formatBRL(club.overdueWages || 0)}. A diretoria decidiu: ${(club.boardActions || []).join('; ')}.`,
      clubId: club.id, clubName: club.name, clubCrest: club.crestMiniUrl || club.crestUrl, date: `Rodada ${round}`, badgeText: recovered ? 'RECUPERAÇÃO' : 'CRISE FINANCEIRA',
    });
  }
  if (dismissals.length > 0) {
    dismissals.slice(0, 2).forEach((d, i) => {
      articles.push({
        id: `news-r${round}-coach-${d.club.id}-${i}`,
        round,
        category: 'demissao',
        title: `CAIU O PROFESSOR! ${d.club.name.toUpperCase()} DEMITE ${d.oldCoach.toUpperCase()}`,
        subtitle: `Diretoria troca o comando e contrata ${d.newCoach}`,
        content: `O ${d.club.name} encerrou o vínculo de ${d.oldCoach} e contratou ${d.newCoach}. A avaliação da diretoria chegou ao limite após os resultados e a situação do clube nesta rodada.`,
        clubId: d.club.id,
        clubName: d.club.name,
        clubCrest: d.club.crestMiniUrl || d.club.crestUrl,
        date: 'Dança das Cadeiras',
        isHeadline: false,
        badgeText: '👔 DEMISSÃO',
      });
    });
  }

  // 4. MAJOR MARKET TRANSFERS
  if (transfers.length > 0) {
    transfers.slice(0, 2).forEach((t, i) => {
      articles.push({
        id: `news-r${round}-transfer-${t.player.id}-${i}`,
        round,
        category: 'transferencia',
        title: `BOMBA NO MERCADO! ${t.toClub.name.toUpperCase()} CONTRATA ${t.player.name.toUpperCase()}`,
        subtitle: `Operação milionária de ${formatBRL(t.fee)} agita o futebol brasileiro`,
        content: `O ${t.toClub.name} concluiu a compra de ${t.player.name} (${t.player.position}, força ${t.player.strength}) junto ao ${t.fromClub.name} por ${formatBRL(t.fee)}.`,
        clubId: t.toClub.id,
        clubName: t.toClub.name,
        clubCrest: t.toClub.crestMiniUrl || t.toClub.crestUrl,
        secondaryClubName: t.fromClub.name,
        secondaryClubCrest: t.fromClub.crestMiniUrl || t.fromClub.crestUrl,
        relatedPlayerName: t.player.name,
        relatedPlayerPosition: t.player.position,
        date: 'Mercado da Bola',
        isHeadline: false,
        badgeText: '💼 CONTRATAÇÃO',
        statsHighlight: formatBRL(t.fee),
      });
    });
  } else if (state.transferOffers && state.transferOffers.length > 0) {
    // Rumor about active offer
    const off = state.transferOffers[0];
    articles.push({
      id: `news-r${round}-rumor-${off.id}`,
      round,
      category: 'transferencia',
      title: `PROPOSTA NA MESA: ${off.fromClubName.toUpperCase()} QUER ${off.playerName.toUpperCase()}`,
      subtitle: `Investida de ${formatBRL(off.fee)} tenta seduzir a diretoria adversária`,
      content: `O mercado da bola segue fervendo. O ${off.fromClubName} formalizou proposta oficial de ${formatBRL(off.fee)} para levar o atleta ${off.playerName}. As conversas estão em andamento e uma resposta deve acontecer nos próximos dias. Caso confirmada, a transferência entrará no hall das maiores negociações da janela.`,
      relatedPlayerName: off.playerName,
      relatedPlayerPosition: off.playerPosition,
      date: 'Especulações',
      isHeadline: false,
      badgeText: 'NEGOCIAÇÃO EM ANDAMENTO',
      statsHighlight: formatBRL(off.fee),
    });
  }

  return articles;
}

/**
 * Checks team forms and applies coach dismissals if a team is in severe crisis.
 */
export function checkAndApplyCoachDismissals(
  state: GameState
): { updatedClubs: Club[]; dismissals: { club: Club; oldCoach: string; newCoach: string }[] } {
  const dismissals: { club: Club; oldCoach: string; newCoach: string }[] = [];
  const updatedClubs = state.clubs.map((club) => {
    // User club coach is never auto-dismissed
    if (club.id === state.userClubId) return club;

    const row = state.standings.find((s) => s.clubId === club.id);
    if (!row) return club;

    // Conditions for coach dismissal:
    // 1. Lost 3 consecutive games in recent form ('D', 'D', 'D')
    // 2. OR in relegation zone (18th to 20th) after round 3 with chance
    const recentLosses = row.form.slice(0, 3).filter((res) => res === 'D').length;
    const isCrisis = recentLosses === 3 || (row.played >= 4 && row.points <= 2);

    if (isCrisis && Math.random() < 0.45) {
      const oldCoach = club.coach || 'Técnico Interino';
      const available = INTERIM_COACHES.filter((c) => c !== oldCoach);
      const newCoach = pick(available);

      dismissals.push({
        club,
        oldCoach,
        newCoach,
      });

      return {
        ...club,
        coach: newCoach,
      };
    }

    return club;
  });

  return { updatedClubs, dismissals };
}

export function createChampionshipNews(
  record: import('../types/index.ts').ChampionshipRecord,
  round: number
): import('../types/index.ts').NewsArticle[] {
  const articles: import('../types/index.ts').NewsArticle[] = [];

  articles.push({
    id: `news-champ-${record.id}`,
    round,
    category: 'geral',
    title: `FESTA DO TÍTULO! ${record.championClubName.toUpperCase()} É CAMPEÃO DA ${record.competitionName.toUpperCase()}!`,
    subtitle: `Em decisão histórica contra o ${record.runnerUpClubName}, equipe levanta a taça e consagra temporada`,
    content: `O ${record.championClubName} é oficialmente o campeão da edição ${record.seasonYear} do torneio ${record.competitionName}. A final contra o ${record.runnerUpClubName} terminou com o placar de ${record.finalScoreText || 'vitória'}. A torcida faz a festa pelo título histórico!`,
    clubId: record.championClubId,
    clubName: record.championClubName,
    clubCrest: record.championClubCrest,
    secondaryClubName: record.runnerUpClubName,
    secondaryClubCrest: record.runnerUpClubCrest,
    date: `Edição ${record.seasonYear}`,
    isHeadline: true,
    badgeText: '🏆 CAMPEÃO',
    statsHighlight: record.finalScoreText || 'Título',
  });

  if (record.topScorerName && record.topScorerGoals) {
    articles.push({
      id: `news-scorer-${record.id}`,
      round,
      category: 'geral',
      title: `CHUTEIRA DE OURO: ${record.topScorerName.toUpperCase()} É O ARTILHEIRO`,
      subtitle: `Com ${record.topScorerGoals} gols, atacante do ${record.topScorerClubName || 'torneio'} leva a artilharia da ${record.competitionName}`,
      content: `${record.topScorerName} (${record.topScorerClubName}) brilhou ao longo da competição e terminou na liderança isolada dos goleadores com ${record.topScorerGoals} gols anotados.`,
      clubId: record.championClubId,
      clubName: record.topScorerClubName || record.championClubName,
      relatedPlayerName: record.topScorerName,
      date: `Artilharia`,
      isHeadline: false,
      badgeText: '⚽ CHUTEIRA DE OURO',
      statsHighlight: `${record.topScorerGoals} gols`,
    });
  }

  return articles;
}
