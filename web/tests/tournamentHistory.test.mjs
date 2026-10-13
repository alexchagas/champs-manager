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

