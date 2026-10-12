import { Club, MatchEvent, Player } from '../types';

export interface SimulatedMatchResult {
  homeScore: number;
  awayScore: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homePossession: number;
  awayPossession: number;
  homeFouls: number;
  awayFouls: number;
  homeCorners: number;
  awayCorners: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  events: MatchEvent[];
}

export function getSquadStarters(club: Club): Player[] {
  const starters = club.squad.filter((p) => p.isStarter);
  if (starters.length === 11) return starters;
  return club.squad.slice(0, 11);
}

export function calculateSectorStrength(players: Player[]) {
  const gk = players.filter((p) => p.position === 'GOL');
  const def = players.filter((p) => p.position === 'ZAG' || p.position === 'LAT');
  const mid = players.filter((p) => p.position === 'VOL' || p.position === 'MEI');
  const att = players.filter((p) => p.position === 'ATA');

  const avg = (list: Player[], fallback: number) =>
    list.length ? Math.round(list.reduce((acc, p) => acc + p.strength * (p.energy / 100), 0) / list.length) : fallback;

  const defStrength = Math.round((avg(gk, 75) * 0.4) + (avg(def, 75) * 0.6));
  const midStrength = avg(mid, 75);
  const attStrength = avg(att, 75);
  const overall = Math.round((defStrength + midStrength + attStrength) / 3);

  return { defStrength, midStrength, attStrength, overall };
}

// Anti-goleada tables from Brasfoot engine
const TU = [0.10, 0.60, 0.30]; // <= 2 goals
const TV = [0.08, 0.62, 0.30]; // 3-4 goals
const TW = [0.05, 0.65, 0.30]; // 5 goals
const TX = [0.01, 0.69, 0.30]; // 6+ goals

function getFinishingProb(currentGoals: number): number {
  if (currentGoals <= 2) return TU[0];
  if (currentGoals <= 4) return TV[0];
  if (currentGoals === 5) return TW[0];
  return TX[0];
}

const COMMENTARY_TEMPLATES = {
  midfieldWin: [
    '{player} ganha a dividida no círculo central e liga o contra-ataque!',
    '{player} recupera a posse com elegância e acerta lindo passe!',
    '{player} domina no peito, gira rápido e arma a jogada.',
  ],
  foul: [
    'Falta cometida por {player} após chegada dura na intermediária.',
    '{player} puxa a camisa do adversário e o árbitro marca a infração.',
  ],
  yellow: [
    'Cartão amarelo! {player} entra de carrinho atrasado e é advertido pelo árbitro.',
    '{player} recebe cartão amarelo por parar contra-ataque promissor com falta.',
  ],
  nearMiss: [
    '{player} solta uma bomba da entrada da área! A bola tira tinta da trave!',
    '{player} recebe cruzamento perfeito, cabeceia com perigo, mas manda por cima do gol!',
    '{player} arrisca de fora da área! O chute passa raspando o travessão!',
  ],
  save: [
    'MILAGRE! {player} finaliza no canto e o goleiro {gk} voa para espalmar para escanteio!',
    'Defesa espetacular de {gk}! {player} tentou o toque por cobertura mas parou nas mãos do goleiro!',
    '{gk} fecha o ângulo com coragem e defende o chute à queima-roupa de {player}!',
  ],
  corner: [
    'Cruzamento travado na linha de fundo. Escanteio perigoso a favor!',
    'A zaga rebate para trás e cede o tiro de canto.',
  ],
  goalOpenPlay: [
    'GOOOOOOOOOOL! {player} recebe passe na medida de {assist}, limpa a marcação e estufa as redes!',
    'É GOOOOOOOL! Golaço! {player} recebe em velocidade e bate rasteiro, sem chances pro goleiro!',
    'GOOOL! {player} aproveita bate-rebate na grande área e empurra pro fundo do gol!',
  ],
  goalPenalty: [
    'PÊNALTI E GOOOOOOL! {player} bate com categoria no ângulo, bola de um lado, goleiro do outro!',
  ],
  goalFreeKick: [
    'QUE PINTURA! GOOOOOOL DE FALTA! {player} cobra com perfeição por cima da barreira!',
  ],
  goalHeader: [
    'GOOOOOL DE CABEÇA! Cruzamento com açúcar de {assist} e {player} sobe mais alto que todo mundo!',
  ]
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function simulateFullMatch(homeClub: Club, awayClub: Club): SimulatedMatchResult {
  const homeStarters = getSquadStarters(homeClub);
  const awayStarters = getSquadStarters(awayClub);

  const homePower = calculateSectorStrength(homeStarters);
  const awayPower = calculateSectorStrength(awayStarters);

  // Mando de campo
  const homeFactor = 1.1;
  const awayFactor = 0.95;

  let homeGoals = 0;
  let awayGoals = 0;
  let homeShots = 0;
  let awayShots = 0;
  let homeShotsOnTarget = 0;
  let awayShotsOnTarget = 0;
  let homeFouls = 0;
  let awayFouls = 0;
  let homeCorners = 0;
  let awayCorners = 0;
  let homeYellows = 0;
  let awayYellows = 0;
  let homeReds = 0;
  let awayReds = 0;

  const events: MatchEvent[] = [];

  const homeGK = homeStarters.find((p) => p.position === 'GOL') || homeStarters[0];
  const awayGK = awayStarters.find((p) => p.position === 'GOL') || awayStarters[0];

  const homeAtts = homeStarters.filter((p) => p.position === 'ATA' || p.position === 'MEI');
  const awayAtts = awayStarters.filter((p) => p.position === 'ATA' || p.position === 'MEI');

  const homeMids = homeStarters.filter((p) => p.position === 'MEI' || p.position === 'VOL' || p.position === 'LAT');
  const awayMids = awayStarters.filter((p) => p.position === 'MEI' || p.position === 'VOL' || p.position === 'LAT');

  // Total midfield comparison for possession
  const totalMid = (homePower.midStrength * homeFactor) + (awayPower.midStrength * awayFactor);
  const homePossession = Math.round(((homePower.midStrength * homeFactor) / totalMid) * 100);
  const awayPossession = 100 - homePossession;

  // Simulate 90 minutes
  for (let min = 1; min <= 90; min++) {
    // Check chance of match action happening in this minute (approx 20-25 actions per game)
    if (Math.random() > 0.32) continue;

    // Disputa de posse no minuto
    const isHome = Math.random() < (homePossession / 100);
    const attackingTeam = isHome ? homeClub : awayClub;
    const defendingTeam = isHome ? awayClub : homeClub;
    const teamSide = isHome ? 'home' : 'away';

    const attPower = (isHome ? homePower.attStrength * homeFactor : awayPower.attStrength * awayFactor);
    const defPower = (isHome ? awayPower.defStrength * awayFactor : homePower.defStrength * homeFactor);

    const attPool = isHome ? (homeAtts.length ? homeAtts : homeStarters) : (awayAtts.length ? awayAtts : awayStarters);
    const midPool = isHome ? (homeMids.length ? homeMids : homeStarters) : (awayMids.length ? awayMids : awayStarters);
    const gk = isHome ? awayGK : homeGK;

    const shooter = pickRandom(attPool);
    const passer = pickRandom(midPool.filter((p) => p.id !== shooter.id) || [shooter]);

    // Attack creation roll
    const pCreate = 0.28 * (2 * Math.pow(attPower, 2)) / (Math.pow(attPower, 2) + Math.pow(defPower, 2));
    const roll = Math.random();

    if (roll < pCreate) {
      // Chance de finalização
      if (isHome) homeShots++; else awayShots++;

      const currentScore = isHome ? homeGoals : awayGoals;
      const pGoal = getFinishingProb(currentScore);
      const finishRoll = Math.random();

      if (finishRoll < pGoal) {
        // GOL!
        if (isHome) {
          homeGoals++;
          homeShotsOnTarget++;
        } else {
          awayGoals++;
          awayShotsOnTarget++;
        }

        const isPenalty = Math.random() < 0.1;
        const isFreeKick = !isPenalty && Math.random() < 0.1;
        const isHeader = !isPenalty && !isFreeKick && Math.random() < 0.3;

        let desc = '';
        if (isPenalty) {
          desc = pickRandom(COMMENTARY_TEMPLATES.goalPenalty).replace('{player}', shooter.name);
        } else if (isFreeKick) {
          desc = pickRandom(COMMENTARY_TEMPLATES.goalFreeKick).replace('{player}', shooter.name);
        } else if (isHeader) {
          desc = pickRandom(COMMENTARY_TEMPLATES.goalHeader).replace('{player}', shooter.name).replace('{assist}', passer.name);
        } else {
          desc = pickRandom(COMMENTARY_TEMPLATES.goalOpenPlay).replace('{player}', shooter.name).replace('{assist}', passer.name);
        }

        events.push({
          id: `ev-${min}-${Math.random()}`,
          minute: min,
          type: 'goal',
          team: teamSide,
          title: `GOL DO ${attackingTeam.name.toUpperCase()}!`,
          description: desc,
          scorerName: shooter.name,
          scorerId: shooter.id,
          assistName: isPenalty || isFreeKick ? undefined : passer.name,
        });

      } else if (finishRoll < pGoal + 0.55) {
        // Defesa do goleiro
        if (isHome) {
          homeShotsOnTarget++;
          awayCorners++;
        } else {
          awayShotsOnTarget++;
          homeCorners++;
        }

        events.push({
          id: `ev-${min}-${Math.random()}`,
          minute: min,
          type: 'save',
          team: teamSide,
          title: 'Grande Defesa!',
          description: pickRandom(COMMENTARY_TEMPLATES.save).replace('{player}', shooter.name).replace('{gk}', gk.name),
        });

      } else {
        // Chute para fora / trave
        events.push({
          id: `ev-${min}-${Math.random()}`,
          minute: min,
          type: 'near_miss',
          team: teamSide,
          title: 'Quase Gol!',
          description: pickRandom(COMMENTARY_TEMPLATES.nearMiss).replace('{player}', shooter.name),
        });
      }

    } else if (roll < pCreate + 0.14) {
      // Falta / Cartão
      if (isHome) awayFouls++; else homeFouls++;
      const defender = pickRandom(isHome ? awayStarters : homeStarters);
      const isCard = Math.random() < 0.35;

      if (isCard) {
        if (isHome) awayYellows++; else homeYellows++;
        events.push({
          id: `ev-${min}-${Math.random()}`,
          minute: min,
          type: 'yellow_card',
          team: isHome ? 'away' : 'home',
          title: 'Cartão Amarelo',
          description: pickRandom(COMMENTARY_TEMPLATES.yellow).replace('{player}', defender.name),
        });
      } else {
        events.push({
          id: `ev-${min}-${Math.random()}`,
          minute: min,
          type: 'foul',
          team: isHome ? 'away' : 'home',
          title: 'Falta Marcada',
          description: pickRandom(COMMENTARY_TEMPLATES.foul).replace('{player}', defender.name),
        });
      }

    } else if (roll < pCreate + 0.22) {
      // Disputa ou escanteio
      if (Math.random() < 0.5) {
        if (isHome) homeCorners++; else awayCorners++;
        events.push({
          id: `ev-${min}-${Math.random()}`,
          minute: min,
          type: 'corner',
          team: teamSide,
          title: 'Escanteio',
          description: pickRandom(COMMENTARY_TEMPLATES.corner),
        });
      } else {
        events.push({
          id: `ev-${min}-${Math.random()}`,
          minute: min,
          type: 'commentary',
          team: teamSide,
          description: pickRandom(COMMENTARY_TEMPLATES.midfieldWin).replace('{player}', passer.name),
        });
      }
    }
  }

  // Halftime and Fulltime markers
  events.push({
    id: 'ev-45-half',
    minute: 45,
    type: 'halftime',
    team: 'home',
    title: 'Fim do Primeiro Tempo',
    description: `Fim dos primeiros 45 minutos. Placar parcial: ${homeClub.name} ${homeGoals} x ${awayGoals} ${awayClub.name}.`,
  });

  events.push({
    id: 'ev-90-full',
    minute: 90,
    type: 'fulltime',
    team: 'home',
    title: 'Fim de Jogo!',
    description: `Apito final no estádio! Placar encerrado: ${homeClub.name} ${homeGoals} x ${awayGoals} ${awayClub.name}.`,
  });

  events.sort((a, b) => a.minute - b.minute);

  return {
    homeScore: homeGoals,
    awayScore: awayGoals,
    homeShots: Math.max(homeShots, homeGoals + homeShotsOnTarget),
    awayShots: Math.max(awayShots, awayGoals + awayShotsOnTarget),
    homeShotsOnTarget: Math.max(homeShotsOnTarget, homeGoals),
    awayShotsOnTarget: Math.max(awayShotsOnTarget, awayGoals),
    homePossession,
    awayPossession,
    homeFouls: Math.max(homeFouls, 4),
    awayFouls: Math.max(awayFouls, 4),
    homeCorners: Math.max(homeCorners, 2),
    awayCorners: Math.max(awayCorners, 2),
    homeYellowCards: homeYellows,
    awayYellowCards: awayYellows,
    homeRedCards: homeReds,
    awayRedCards: awayReds,
    events,
  };
}
