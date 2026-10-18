import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllClubs } from '../src/data/teamsDatabase.ts';
import { createNewGame } from '../src/data/initialData.ts';
import {
  computeSeasonMobility,
  sortStandingRows,
  determineSerieDPromotedClubs,
} from '../src/engine/sportsMobility.ts';

test('Sports Mobility: Série A <-> Série B canonical 4-club promotion and relegation', () => {
  const allClubs = getAllClubs();
  // Start with a Série B club (e.g. Avaí, division 2)
  const avai = allClubs.find((c) => c.name === 'Avaí' && c.countryId === 29);
  assert.ok(avai, 'Avaí must exist');
  assert.equal(avai.division, 2);

  const state = createNewGame(avai.id);
  assert.ok(state.standingsNacional && state.standingsNacional.length === 20, 'Série B must have 20 clubs');

  // Put Avaí at position 1 (Champion of Série B)
  const fakeSerieB = [...state.standingsNacional];
  fakeSerieB.sort((a, b) => (a.clubId === avai.id ? -1 : b.clubId === avai.id ? 1 : 0));
  fakeSerieB[0].points = 80;
  fakeSerieB[0].won = 25;
  fakeSerieB[1].points = 75;
  fakeSerieB[2].points = 70;
  fakeSerieB[3].points = 68;

  const modifiedState = {
    ...state,
    standingsNacional: fakeSerieB,
  };

  const mobility = computeSeasonMobility(modifiedState);

  // Avaí must be promoted to Série A
  assert.equal(mobility.userPromoted, true, 'Avaí in G4 must be promoted');
  assert.equal(mobility.userNewDivision, 1, 'Avaí new division must be 1 (Série A)');

  const userInUpdated = mobility.updatedClubs.find((c) => c.id === avai.id);
  assert.equal(userInUpdated?.division, 1, 'Updated club must have division 1');
  assert.equal(userInUpdated?.divisionName, 'Série A');

  // Verify exactly 4 clubs promoted from B to A
  const bToA = mobility.nationalPromotions.filter((p) => p.fromDivision === 2 && p.toDivision === 1);
  assert.equal(bToA.length, 4, 'Exactly 4 clubs must be promoted from Série B to Série A');
  assert.ok(bToA.some((p) => p.clubId === avai.id), 'Avaí must be among promoted clubs');

  // Verify exactly 4 clubs relegated from A to B
  const aToB = mobility.nationalRelegations.filter((r) => r.fromDivision === 1 && r.toDivision === 2);
  assert.equal(aToB.length, 4, 'Exactly 4 clubs must be relegated from Série A to Série B');
});

test('Sports Mobility: Série B <-> Série C and Série C <-> Série D promotions and relegations', () => {
  const allClubs = getAllClubs();
  const palmeiras = allClubs.find((c) => c.name === 'Palmeiras' && c.countryId === 29);
  assert.ok(palmeiras);

  const state = createNewGame(palmeiras.id);

  // Find Série C standings from nationalDivisions
  const cDiv = state.nationalDivisions?.find((d) => d.division === 3);
  assert.ok(cDiv && cDiv.standings.length === 20);

  // Find Série D standings from nationalDivisions
  const dDiv = state.nationalDivisions?.find((d) => d.division === 4);
  assert.ok(dDiv && dDiv.standings.length === 64);

  const mobility = computeSeasonMobility(state);

  // Check C -> B promotions (4 clubs)
  const cToB = mobility.nationalPromotions.filter((p) => p.fromDivision === 3 && p.toDivision === 2);
  assert.equal(cToB.length, 4, 'Exactly 4 clubs promoted from Série C to Série B');

  // Check B -> C relegations (4 clubs)
  const bToC = mobility.nationalRelegations.filter((r) => r.fromDivision === 2 && r.toDivision === 3);
  assert.equal(bToC.length, 4, 'Exactly 4 clubs relegated from Série B to Série C');

  // Check D -> C promotions (4 clubs)
  const dToC = mobility.nationalPromotions.filter((p) => p.fromDivision === 4 && p.toDivision === 3);
  assert.equal(dToC.length, 4, 'Exactly 4 clubs promoted from Série D to Série C');

  // Check C -> D relegations (4 clubs)
  const cToD = mobility.nationalRelegations.filter((r) => r.fromDivision === 3 && r.toDivision === 4);
  assert.equal(cToD.length, 4, 'Exactly 4 clubs relegated from Série C to Série D');

  // Conservation of total clubs per division
  const div1Count = mobility.updatedClubs.filter((c) => c.countryId === 29 && c.division === 1).length;
  const div2Count = mobility.updatedClubs.filter((c) => c.countryId === 29 && c.division === 2).length;
  const div3Count = mobility.updatedClubs.filter((c) => c.countryId === 29 && c.division === 3).length;
  const div4Count = mobility.updatedClubs.filter((c) => c.countryId === 29 && c.division === 4).length;

  assert.equal(div1Count, 20, 'Série A must strictly maintain 20 clubs');
  assert.equal(div2Count, 20, 'Série B must strictly maintain 20 clubs');
  assert.equal(div3Count, 20, 'Série C must strictly maintain 20 clubs');
  assert.equal(div4Count, 64, 'Série D must strictly maintain 64 clubs');
});

test('Sports Mobility: State championship (Paulistão A1 <-> A2) promotion and relegation', () => {
  const allClubs = getAllClubs();
  const jau = allClubs.find((c) => c.name.includes('Jaú') && c.stateCode === 'SP');
  assert.ok(jau);

  const state = createNewGame(jau.id);
  assert.equal(state.stateTier, 2, 'XV de Jaú starts in Tier 2');

  // Put XV de Jaú at position 1 in Série A2 standings
  const jauStandings = [...(state.standingsEstadual || [])];
  jauStandings.sort((a, b) => (a.clubId === jau.id ? -1 : b.clubId === jau.id ? 1 : 0));
  jauStandings[0].points = 35;
  jauStandings[1].points = 33;

  const stateWithJaúWinning = {
    ...state,
    standingsEstadual: jauStandings,
  };

  const mobility = computeSeasonMobility(stateWithJaúWinning);

  // XV de Jaú earned promotion to Tier 1
  assert.equal(mobility.userNewStateTier, 1, 'XV de Jaú must ascend to Tier 1');
  assert.ok(mobility.nextPromotedStateClubIds.includes(jau.id), 'XV de Jaú must be in nextPromotedStateClubIds');
  assert.equal(mobility.statePromotions.length, 2, 'Top 2 of A2 are promoted to A1');
  assert.equal(mobility.stateRelegations.length, 2, 'Bottom 2 of A1 are relegated to A2');

  // Verify news articles generated
  assert.ok(mobility.newsArticles.length > 0, 'Must generate news articles');
  const promoNews = mobility.newsArticles.find((n) => n.badgeText === 'ACESSO ESTADUAL');
  assert.ok(promoNews, 'Must generate ACESSO ESTADUAL headline for XV de Jaú');
  assert.ok(promoNews.title.includes('XV DE JAÚ') || promoNews.title.includes('JAÚ'), 'Headline must celebrate club promotion');
});

test('Sports Mobility: User club relegation triggers crisis headline and updates division', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.name === 'Flamengo' && c.countryId === 29);
  assert.ok(flamengo);

  const state = createNewGame(flamengo.id);
  assert.equal(state.userClubId, flamengo.id);

  // Put Flamengo at position 20 (Z4)
  const relegatedStandings = (state.standingsNacional || []).map((row) => {
    if (row.clubId === flamengo.id) {
      return { ...row, points: 10, won: 2, played: 38, goalDiff: -25 };
    }
    return { ...row, points: 45, won: 12, played: 38, goalDiff: 5 };
  });

  const stateWithRelegation = {
    ...state,
    standingsNacional: relegatedStandings,
  };

  const mobility = computeSeasonMobility(stateWithRelegation);

  assert.equal(mobility.userRelegated, true, 'Flamengo in 20th position must be relegated');
  assert.equal(mobility.userNewDivision, 2, 'Flamengo new division must be 2 (Série B)');

  const userInUpdated = mobility.updatedClubs.find((c) => c.id === flamengo.id);
  assert.equal(userInUpdated?.division, 2);
  assert.equal(userInUpdated?.divisionName, 'Série B');

  const crisisNews = mobility.newsArticles.find((n) => n.badgeText === 'REBAIXAMENTO');
  assert.ok(crisisNews, 'Must generate crisis news article for user club relegation');
  assert.ok(crisisNews.title.includes('REBAIXADO'));
});
