import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  detectNewlyCompletedCompetitions, 
  isSeasonComplete, 
  getCompetitionPrizeMoney,
  sanitizePrematureChampionships
} from '../src/engine/tournamentCompletion.ts';
import { createChampionshipNews } from '../src/engine/newsEngine.ts';

test('tournamentCompletion - detects knockout final completion dynamically regardless of round date', () => {
  const dummyClubs = [
    { id: 10, name: 'Flamengo', squad: [{ id: 101, name: 'Pedro', goals: 8, strength: 80, position: 'ATA' }] },
    { id: 20, name: 'Palmeiras', squad: [{ id: 201, name: 'Veiga', goals: 4, strength: 78, position: 'MEI' }] },
    { id: 30, name: 'São Paulo', squad: [{ id: 301, name: 'Calleri', goals: 6, strength: 75, position: 'ATA' }] },
  ];

  // Simulating a state where the Copa Libertadores final just ended on round 32
  const state = {
    seasonYear: 2026,
    userClubId: 10,
    managerName: 'Alex Chagas',
    clubs: dummyClubs,
    calendar: [
      {
        id: 1,
        round: 32,
        competitionType: 'libertadores',
        competitionName: 'Copa Libertadores',
        stage: 'Final',
        homeClubId: 10,
        awayClubId: 20,
        homeScore: 2,
        awayScore: 1,
        played: true,
      }
    ],
    championshipHistory: [],
    standings: [],
  };

  const records = detectNewlyCompletedCompetitions(state);
  assert.equal(records.length, 1);
  assert.equal(records[0].competitionType, 'libertadores');
  assert.equal(records[0].championClubId, 10);
  assert.equal(records[0].championClubName, 'Flamengo');
  assert.equal(records[0].runnerUpClubId, 20);
  assert.equal(records[0].runnerUpClubName, 'Palmeiras');
  assert.equal(records[0].finalScoreText, '2 x 1');
  assert.equal(records[0].userPositionText, 'Campeão 🏆');
  assert.equal(records[0].topScorerName, 'Pedro');
  assert.equal(records[0].topScorerGoals, 8);
  assert.ok(records[0].userPrizeMoney > 0);
});

test('tournamentCompletion - handles two-legged final and penalty tiebreaks', () => {
  const dummyClubs = [
    { id: 1, name: 'Real Madrid', squad: [] },
    { id: 2, name: 'Bayern München', squad: [] },
  ];

  const state = {
    seasonYear: 2026,
    userClubId: 99, // user not in final
    managerName: 'Treinador',
    clubs: dummyClubs,
    calendar: [
      {
        id: 100,
        round: 28,
        competitionType: 'champions',
        competitionName: 'UEFA Champions League',
        stage: 'Final',
        leg: 1,
        homeClubId: 1,
        awayClubId: 2,
        homeScore: 1,
        awayScore: 0,
        played: true,
      },
      {
        id: 101,
        round: 30,
        competitionType: 'champions',
        competitionName: 'UEFA Champions League',
        stage: 'Final',
        leg: 2,
        homeClubId: 2,
        awayClubId: 1,
        homeScore: 1,
        awayScore: 0,
        penaltyScore: [4, 5], // Real Madrid wins on penalties
        played: true,
      }
    ],
    championshipHistory: [],
    standings: [],
  };

  const records = detectNewlyCompletedCompetitions(state);
  assert.equal(records.length, 1);
  assert.equal(records[0].championClubId, 1); // Real Madrid won penalties
  assert.equal(records[0].runnerUpClubId, 2);
  assert.ok(records[0].finalScoreText.includes('Pên: 4 x 5'));
  assert.equal(records[0].userPositionText, 'Participante');
});

test('tournamentCompletion - detects National League points champion when all matches played', () => {
  const dummyClubs = [
    { id: 1, name: 'Botafogo', squad: [] },
    { id: 2, name: 'Palmeiras', squad: [] },
    { id: 3, name: 'Fortaleza', squad: [] },
  ];

  const state = {
    seasonYear: 2026,
    userClubId: 1,
    managerName: 'Artur Jorge',
    clubs: dummyClubs,
    nationalLeagueName: 'Brasileirão Betano Série A',
    standingsNacional: [
      { clubId: 1, clubName: 'Botafogo', points: 79, played: 38, won: 24, drawn: 7, lost: 7, goalsFor: 65, goalsAgainst: 30, goalDiff: 35, form: [] },
      { clubId: 2, clubName: 'Palmeiras', points: 76, played: 38, won: 23, drawn: 7, lost: 8, goalsFor: 62, goalsAgainst: 32, goalDiff: 30, form: [] },
      { clubId: 3, clubName: 'Fortaleza', points: 68, played: 38, won: 20, drawn: 8, lost: 10, goalsFor: 52, goalsAgainst: 39, goalDiff: 13, form: [] },
    ],
    calendar: [
      { id: 1, round: 38, competitionType: 'nacional', homeClubId: 1, awayClubId: 2, played: true },
    ],
    championshipHistory: [],
  };

  const records = detectNewlyCompletedCompetitions(state);
  assert.equal(records.length, 1);
  assert.equal(records[0].competitionType, 'nacional');
  assert.equal(records[0].championClubId, 1);
  assert.equal(records[0].championClubName, 'Botafogo');
  assert.equal(records[0].runnerUpClubId, 2);
  assert.equal(records[0].runnerUpClubName, 'Palmeiras');
  assert.equal(records[0].finalScoreText, '79 pts');
  assert.equal(records[0].userPositionText, 'Campeão 🏆');
});

test('tournamentCompletion - is idempotent and does not duplicate existing recorded championships', () => {
  const state = {
    seasonYear: 2026,
    userClubId: 1,
    managerName: 'Coach',
    clubs: [{ id: 1, name: 'Clube', squad: [] }],
    calendar: [
      { id: 1, round: 12, competitionType: 'estadual', stage: 'Final', homeClubId: 1, awayClubId: 2, homeScore: 3, awayScore: 0, played: true },
    ],
    championshipHistory: [
      { id: '2026-estadual', seasonYear: 2026, competitionType: 'estadual', competitionName: 'Campeonato Paulista', championClubId: 1, championClubName: 'Clube', runnerUpClubId: 2, runnerUpClubName: 'Vice' }
    ],
  };

  const records = detectNewlyCompletedCompetitions(state);
  assert.equal(records.length, 0); // Already recorded!
});

test('tournamentCompletion - isSeasonComplete returns true only when all fixtures are played', () => {
  const stateNotDone = {
    calendar: [
      { id: 1, played: true },
      { id: 2, played: false },
    ]
  };
  assert.equal(isSeasonComplete(stateNotDone), false);

  const stateDone = {
    calendar: [
      { id: 1, played: true },
      { id: 2, played: true },
    ]
  };
  assert.equal(isSeasonComplete(stateDone), true);
});

test('createChampionshipNews - generates headline and golden boot articles', () => {
  const record = {
    id: '2026-copa',
    seasonYear: 2026,
    competitionType: 'copa',
    competitionName: 'Copa do Brasil',
    championClubId: 10,
    championClubName: 'Flamengo',
    runnerUpClubId: 15,
    runnerUpClubName: 'Atlético-MG',
    finalScoreText: '1 x 0',
    topScorerName: 'Gabriel Barbosa',
    topScorerClubName: 'Flamengo',
    topScorerGoals: 5,
  };

  const news = createChampionshipNews(record, 42);
  assert.equal(news.length, 2);
  assert.ok(news[0].title.includes('FLAMENGO'));
  assert.ok(news[0].title.includes('CAMPEÃO'));
  assert.equal(news[0].isHeadline, true);
  assert.equal(news[0].badgeText, '🏆 CAMPEÃO');

  assert.ok(news[1].title.includes('GABRIEL BARBOSA'));
  assert.equal(news[1].badgeText, '⚽ CHUTEIRA DE OURO');
});

test('tournamentCompletion - Copa do Brasil two-legged format does NOT complete prematurely at round 4 (Quartas)', () => {
  const dummyClubs = [
    { id: 255, name: 'Cruzeiro', squad: [] },
    { id: 20, name: 'Palmeiras', squad: [] },
    { id: 30, name: 'Botafogo', squad: [] },
  ];

  // Simulating state after round 4 (Quartas de Final - Volta) where Cruzeiro played Palmeiras
  const state = {
    seasonYear: 2026,
    userClubId: 255,
    managerName: 'Professor',
    clubs: dummyClubs,
    calendar: [
      { id: 1, round: 1, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Oitavas de Final', leg: 1, homeClubId: 255, awayClubId: 10, played: true },
      { id: 2, round: 2, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Oitavas de Final', leg: 2, homeClubId: 10, awayClubId: 255, played: true },
      { id: 3, round: 3, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Quartas de Final', leg: 1, homeClubId: 255, awayClubId: 20, homeScore: 2, awayScore: 0, played: true },
      { id: 4, round: 4, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Quartas de Final', leg: 2, homeClubId: 20, awayClubId: 255, homeScore: 1, awayScore: 0, played: true },
      // Semifinal and Final are still scheduled / pending!
      { id: 5, round: 5, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Semifinal', leg: 1, homeClubId: 255, awayClubId: 30, played: false },
      { id: 6, round: 6, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Semifinal', leg: 2, homeClubId: 30, awayClubId: 255, played: false },
      { id: 7, round: 7, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Final', leg: 1, homeClubId: 0, awayClubId: 0, played: false },
      { id: 8, round: 8, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Final', leg: 2, homeClubId: 0, awayClubId: 0, played: false },
    ],
    championshipHistory: [],
  };

  const records = detectNewlyCompletedCompetitions(state);
  assert.equal(records.length, 0, 'Copa do Brasil must NOT complete when only Quartas de Final (round 4) is played');
});

test('tournamentCompletion - Copa do Brasil two-legged format completes when Final (Volta) is played and awards aggregate winner', () => {
  const dummyClubs = [
    { id: 255, name: 'Cruzeiro', squad: [] },
    { id: 10, name: 'Flamengo', squad: [] },
  ];

  const state = {
    seasonYear: 2026,
    userClubId: 255,
    managerName: 'Professor',
    clubs: dummyClubs,
    calendar: [
      { id: 7, round: 7, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Final', leg: 1, homeClubId: 255, awayClubId: 10, homeScore: 3, awayScore: 1, played: true },
      { id: 8, round: 8, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Final', leg: 2, homeClubId: 10, awayClubId: 255, homeScore: 1, awayScore: 1, played: true },
    ],
    championshipHistory: [],
  };

  const records = detectNewlyCompletedCompetitions(state);
  assert.equal(records.length, 1);
  assert.equal(records[0].competitionType, 'copa');
  assert.equal(records[0].championClubId, 255); // Cruzeiro won 4 x 2 aggregate!
  assert.equal(records[0].championClubName, 'Cruzeiro');
  assert.equal(records[0].runnerUpClubId, 10);
  assert.equal(records[0].runnerUpClubName, 'Flamengo');
  assert.equal(records[0].userPositionText, 'Campeão 🏆');
  assert.equal(records[0].finalScoreText, '4 x 2 (Agregado)');
});

test('sanitizePrematureChampionships - removes bogus Copa championship records from saves before the Final is completed', () => {
  const dummyClubs = [
    { id: 255, name: 'Cruzeiro', squad: [] },
    { id: 20, name: 'Palmeiras', squad: [] },
  ];

  const corruptedState = {
    seasonYear: 2026,
    userClubId: 255,
    clubs: dummyClubs,
    calendar: [
      { id: 3, round: 3, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Quartas de Final', leg: 1, homeClubId: 255, awayClubId: 20, played: true },
      { id: 4, round: 4, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Quartas de Final', leg: 2, homeClubId: 20, awayClubId: 255, played: true },
      { id: 7, round: 7, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Final', leg: 1, homeClubId: 0, awayClubId: 0, played: false },
      { id: 8, round: 8, competitionType: 'copa', competitionName: 'Copa do Brasil', stage: 'Final', leg: 2, homeClubId: 0, awayClubId: 0, played: false },
    ],
    championshipHistory: [
      {
        id: '2026-copa',
        seasonYear: 2026,
        competitionType: 'copa',
        competitionName: 'Copa do Brasil',
        championClubId: 20,
        runnerUpClubId: 255,
      }
    ],
    pendingTournamentConclusion: {
      id: '2026-copa',
      competitionType: 'copa',
    },
  };

  const repaired = sanitizePrematureChampionships(corruptedState);
  assert.equal(repaired.championshipHistory.length, 0, 'Premature Copa record should be cleaned up');
  assert.equal(repaired.pendingTournamentConclusion, undefined, 'Pending conclusion modal should be cleared');
});

test('tournamentCompletion - detects all 4 divisions (Série A, B, C, D) and parallel continental top scorers when user is in Série D', () => {
  const clubs = [
    { id: 401, name: 'América-RN', division: 4, countryId: 29, squad: [{ id: 1, name: 'Souza', position: 'MEI', strength: 65, goals: 0 }] },
    { id: 402, name: 'Retrô', division: 4, countryId: 29, squad: [{ id: 2, name: 'Fernandinho', position: 'ATA', strength: 63, goals: 0 }] },
    { id: 101, name: 'Flamengo', division: 1, countryId: 29, squad: [{ id: 3, name: 'Pedro', position: 'ATA', strength: 82, goals: 0 }] },
    { id: 102, name: 'Palmeiras', division: 1, countryId: 29, squad: [{ id: 4, name: 'Veiga', position: 'MEI', strength: 81, goals: 0 }] },
    { id: 201, name: 'Santos', division: 2, countryId: 29, squad: [{ id: 5, name: 'Guilherme', position: 'ATA', strength: 74, goals: 0 }] },
    { id: 202, name: 'Sport', division: 2, countryId: 29, squad: [{ id: 6, name: 'Lucas Lima', position: 'MEI', strength: 73, goals: 0 }] },
    { id: 301, name: 'Volta Redonda', division: 3, countryId: 29, squad: [{ id: 7, name: 'MV', position: 'ATA', strength: 69, goals: 0 }] },
    { id: 302, name: 'Athletic Club', division: 3, countryId: 29, squad: [{ id: 8, name: 'Jonathas', position: 'ATA', strength: 68, goals: 0 }] },
    { id: 501, name: 'LDU Quito', countryId: 30, squad: [{ id: 9, name: 'Arce', position: 'ATA', strength: 75, goals: 0 }] },
    { id: 502, name: 'Lanús', countryId: 28, squad: [{ id: 10, name: 'Bou', position: 'ATA', strength: 74, goals: 0 }] },
  ];

  const state = {
    seasonYear: 2026,
    userClubId: 401, // User playing in Série D
    managerName: 'Professor D',
    clubs,
    nationalLeagueName: 'Campeonato Brasileiro Série D',
    standingsNacional: [
      { clubId: 401, clubName: 'América-RN', points: 30, matchesPlayed: 14, won: 9, drawn: 3, lost: 2, goalsFor: 22, goalsAgainst: 10, goalDiff: 12, form: [] },
      { clubId: 402, clubName: 'Retrô', points: 26, matchesPlayed: 14, won: 8, drawn: 2, lost: 4, goalsFor: 18, goalsAgainst: 12, goalDiff: 6, form: [] },
    ],
    nationalDivisions: [
      {
        id: 'league-29-div1',
        countryId: 29,
        countryName: 'Brasil',
        leagueName: 'Brasileirão Série A',
        division: 1,
        seasonLabel: '2026',
        currentRound: 38,
        totalRounds: 38,
        standings: [
          { clubId: 101, clubName: 'Flamengo', points: 80, matchesPlayed: 38, won: 24, drawn: 8, lost: 6, goalsFor: 70, goalsAgainst: 30, goalDiff: 40, form: [] },
          { clubId: 102, clubName: 'Palmeiras', points: 76, matchesPlayed: 38, won: 23, drawn: 7, lost: 8, goalsFor: 64, goalsAgainst: 32, goalDiff: 32, form: [] },
        ],
      },
      {
        id: 'league-29-div2',
        countryId: 29,
        countryName: 'Brasil',
        leagueName: 'Brasileirão Série B',
        division: 2,
        seasonLabel: '2026',
        currentRound: 38,
        totalRounds: 38,
        standings: [
          { clubId: 201, clubName: 'Santos', points: 72, matchesPlayed: 38, won: 21, drawn: 9, lost: 8, goalsFor: 58, goalsAgainst: 33, goalDiff: 25, form: [] },
          { clubId: 202, clubName: 'Sport', points: 68, matchesPlayed: 38, won: 20, drawn: 8, lost: 10, goalsFor: 55, goalsAgainst: 36, goalDiff: 19, form: [] },
        ],
      },
      {
        id: 'league-29-div3',
        countryId: 29,
        countryName: 'Brasil',
        leagueName: 'Brasileirão Série C',
        division: 3,
        seasonLabel: '2026',
        currentRound: 19,
        totalRounds: 19,
        standings: [
          { clubId: 301, clubName: 'Volta Redonda', points: 38, matchesPlayed: 19, won: 11, drawn: 5, lost: 3, goalsFor: 30, goalsAgainst: 15, goalDiff: 15, form: [] },
          { clubId: 302, clubName: 'Athletic Club', points: 36, matchesPlayed: 19, won: 10, drawn: 6, lost: 3, goalsFor: 28, goalsAgainst: 17, goalDiff: 11, form: [] },
        ],
      },
    ],
    continentalCompetitions: [
      {
        id: 'continental-sister',
        countryId: 29,
        countryName: 'América do Sul',
        leagueName: 'Copa Sul-Americana',
        division: 1,
        seasonLabel: '2026',
        currentRound: 6,
        totalRounds: 6,
        standings: [
          { clubId: 501, clubName: 'LDU Quito', points: 14, matchesPlayed: 6, won: 4, drawn: 2, lost: 0, goalsFor: 12, goalsAgainst: 4, goalDiff: 8, form: [] },
          { clubId: 502, clubName: 'Lanús', points: 11, matchesPlayed: 6, won: 3, drawn: 2, lost: 1, goalsFor: 9, goalsAgainst: 5, goalDiff: 4, form: [] },
        ],
      },
    ],
    calendar: [
      { id: 1, round: 14, competitionType: 'nacional', homeClubId: 401, awayClubId: 402, played: true },
    ],
    championshipHistory: [],
  };

  const records = detectNewlyCompletedCompetitions(state);

  // Must detect: Série D (active user league), Série A (div 1), Série B (div 2), Série C (div 3), Sul-Americana
  assert.equal(records.length, 5, 'Should detect all 4 national divisions plus Sul-Americana');

  const serieD = records.find(r => r.id === '2026-nacional-div4');
  assert.ok(serieD, 'Série D record should exist');
  assert.equal(serieD.championClubName, 'América-RN');
  assert.ok(serieD.topScorerName, 'Série D should have a top scorer');
  assert.ok(serieD.topScorerGoals > 0, 'Série D top scorer should have goals > 0');

  const serieA = records.find(r => r.id === '2026-nacional');
  assert.ok(serieA, 'Série A record should exist');
  assert.equal(serieA.championClubName, 'Flamengo');
  assert.equal(serieA.runnerUpClubName, 'Palmeiras');
  assert.ok(serieA.topScorerName, 'Série A should have a top scorer');
  assert.ok(serieA.topScorerGoals >= 15, 'Série A top scorer should have realistic goals >= 15');

  const serieB = records.find(r => r.id === '2026-nacional-div2');
  assert.ok(serieB, 'Série B record should exist');
  assert.equal(serieB.championClubName, 'Santos');

  const serieC = records.find(r => r.id === '2026-nacional-div3');
  assert.ok(serieC, 'Série C record should exist');
  assert.equal(serieC.championClubName, 'Volta Redonda');

  const sula = records.find(r => r.competitionType === 'sulamericana');
  assert.ok(sula, 'Sul-Americana record should exist');
  assert.equal(sula.championClubName, 'LDU Quito');
  assert.ok(sula.topScorerName, 'Sul-Americana must have top scorer name');
  assert.ok(sula.topScorerGoals > 0, 'Sul-Americana must have top scorer goals > 0');
});


