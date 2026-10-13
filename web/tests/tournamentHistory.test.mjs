import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  detectNewlyCompletedCompetitions, 
  isSeasonComplete, 
  getCompetitionPrizeMoney 
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
