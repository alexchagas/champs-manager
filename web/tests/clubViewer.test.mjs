import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/data/initialData.ts';
import { getAllClubs, getClubById } from '../src/data/teamsDatabase.ts';
import { getClubTheme, deriveClubAtmosphere } from '../src/theme/clubTheme.ts';
import { groupSquadBySector, getClubCampaign } from '../src/engine/clubViewer.ts';

test('groupSquadBySector splits squad into all 5 required sectors with strength, age, skills, and energy', () => {
  // Use a real club from the database (Flamengo or Palmeiras)
  const club = getAllClubs().find((c) => c.name === 'Flamengo') || getAllClubs()[0];
  assert.ok(club, 'Club must exist');
  assert.ok(club.squad.length > 0, 'Club squad must not be empty');

  const sectors = groupSquadBySector(club.squad);
  assert.equal(sectors.length, 5, 'Must contain exactly 5 sectors');

  const sectorNames = sectors.map((s) => s.name);
  assert.deepEqual(sectorNames, ['Goleiros', 'Zagueiros', 'Laterais', 'Meias', 'Atacantes']);

  // All squad players should be accounted for in the sectors
  const totalGroupedPlayers = sectors.reduce((acc, s) => acc + s.players.length, 0);
  assert.equal(totalGroupedPlayers, club.squad.length, 'Every player in squad must be allocated to a sector');

  // Verify sectors contain appropriate positions
  const golSector = sectors.find((s) => s.name === 'Goleiros');
  assert.ok(golSector.players.length > 0, 'Must have at least one goalkeeper');
  assert.ok(golSector.players.every((p) => p.position === 'GOL'));

  const zagSector = sectors.find((s) => s.name === 'Zagueiros');
  assert.ok(zagSector.players.length > 0);
  assert.ok(zagSector.players.every((p) => p.position === 'ZAG'));

  const latSector = sectors.find((s) => s.name === 'Laterais');
  assert.ok(latSector.players.length > 0);
  assert.ok(latSector.players.every((p) => p.position === 'LAT'));

  const meiSector = sectors.find((s) => s.name === 'Meias');
  assert.ok(meiSector.players.length > 0);
  assert.ok(meiSector.players.every((p) => p.position === 'VOL' || p.position === 'MEI'));

  const ataSector = sectors.find((s) => s.name === 'Atacantes');
  assert.ok(ataSector.players.length > 0);
  assert.ok(ataSector.players.every((p) => p.position === 'ATA'));

  // Verify all players possess required properties: strength, age, characteristics (skills/foot), energy
  for (const sector of sectors) {
    assert.ok(sector.avgStrength > 0, 'Sector average strength must be greater than 0');
    for (const player of sector.players) {
      assert.ok(player.name, 'Player must have a name');
      assert.ok(typeof player.strength === 'number' && player.strength > 0, 'Player must have positive strength');
      assert.ok(typeof player.age === 'number' && player.age > 0, 'Player must have valid age');
      assert.ok(typeof player.energy === 'number' && player.energy >= 0 && player.energy <= 100, 'Energy between 0-100');
      assert.ok(['D', 'E', 'A'].includes(player.foot), 'Foot must be D, E or A');
      assert.ok(typeof player.skill1 === 'string', 'Player must have skill1');
    }
  }
});

test('getClubCampaign retrieves standing data accurately for opponent club', () => {
  const game = createNewGame(255, 'Test Manager', 1);

  // Set up standings row for opponent Palmeiras (id 280 or first opponent)
  const opponentClub = game.clubs.find((c) => c.id !== 255);
  assert.ok(opponentClub, 'Must have opponent club in league');

  // Insert test standing data
  game.standings = [
    {
      clubId: opponentClub.id,
      clubName: opponentClub.name,
      primaryColor: opponentClub.primaryColor,
      points: 10,
      played: 4,
      won: 3,
      drawn: 1,
      lost: 0,
      goalsFor: 8,
      goalsAgainst: 2,
      goalDiff: 6,
      form: ['V', 'V', 'E', 'V'],
    },
    {
      clubId: 255,
      clubName: 'Flamengo',
      primaryColor: '#ff3333',
      points: 7,
      played: 4,
      won: 2,
      drawn: 1,
      lost: 1,
      goalsFor: 5,
      goalsAgainst: 3,
      goalDiff: 2,
      form: ['V', 'E', 'D', 'V'],
    },
  ];

  const campaign = getClubCampaign(opponentClub.id, game);
  assert.equal(campaign.points, 10);
  assert.equal(campaign.played, 4);
  assert.equal(campaign.won, 3);
  assert.equal(campaign.drawn, 1);
  assert.equal(campaign.lost, 0);
  assert.equal(campaign.goalsFor, 8);
  assert.equal(campaign.goalsAgainst, 2);
  assert.equal(campaign.goalDiff, 6);
  assert.equal(campaign.position, 1);
  assert.equal(campaign.winRate, 83); // 10 / 12 = 83%
  assert.deepEqual(campaign.form, ['V', 'V', 'E', 'V']);
});

test('getClubCampaign falls back cleanly when club has no recorded matches yet', () => {
  const game = createNewGame(255, 'Test Manager', 1);
  game.standings = [];
  game.calendar = [];

  const club = game.clubs[0];
  const campaign = getClubCampaign(club.id, game);

  assert.equal(campaign.points, 0);
  assert.equal(campaign.played, 0);
  assert.equal(campaign.won, 0);
  assert.equal(campaign.drawn, 0);
  assert.equal(campaign.lost, 0);
  assert.equal(campaign.goalsFor, 0);
  assert.equal(campaign.goalsAgainst, 0);
  assert.equal(campaign.goalDiff, 0);
  assert.equal(campaign.winRate, 0);
  assert.deepEqual(campaign.form, []);
});

test('getClubTheme generates unique visual identity tokens for inspected external club', () => {
  const palmeiras = getAllClubs().find((c) => c.name === 'Palmeiras') || { primaryColor: '#028b4c', secondaryColor: '#ffffff' };
  const palmeirasTheme = getClubTheme(palmeiras);

  assert.equal(palmeirasTheme.primary, '#028B4C');
  assert.ok(palmeirasTheme.stripeGradient.includes('#028B4C'));
  assert.ok(palmeirasTheme.subtleBg.startsWith('rgba('));
  assert.ok(palmeirasTheme.primaryAccent);

  const corinthians = getAllClubs().find((c) => c.name === 'Corinthians') || { primaryColor: '#ffffff', secondaryColor: '#000000' };
  const corinthiansTheme = getClubTheme(corinthians);
  assert.notEqual(palmeirasTheme.primary, corinthiansTheme.primary);
});

test('external club selection and viewer state transitions', () => {
  const game = createNewGame(255, 'Test Manager', 1);
  const opponent = game.clubs.find((c) => c.id !== 255);
  assert.ok(opponent, 'Must have opponent club');

  // Simulated viewer state container
  let viewedClubId = null;
  const viewClub = (clubId) => {
    viewedClubId = clubId;
  };
  const closeClubViewer = () => {
    viewedClubId = null;
  };

  // Initially closed
  assert.equal(viewedClubId, null);

  // User clicks on opponent club (e.g. from standings table, fixtures, or next match hero)
  viewClub(opponent.id);
  assert.equal(viewedClubId, opponent.id);

  // Inspected club is resolvable and has complete profile
  const inspectedClub = game.clubs.find((c) => c.id === viewedClubId) || getClubById(viewedClubId);
  assert.ok(inspectedClub);
  assert.equal(inspectedClub.name, opponent.name);
  assert.ok(inspectedClub.stadium);
  assert.ok(inspectedClub.capacity > 0);
  assert.ok(inspectedClub.coach);
  assert.ok(typeof inspectedClub.reputation === 'number');

  // User clicks close/back button or presses Escape
  closeClubViewer();
  assert.equal(viewedClubId, null);
});

test('deriveClubAtmosphere accurately styles ClubViewer for machine clubs: Ituano, Santos, and Água Santa', () => {
  const allClubs = getAllClubs();

  // 1. Ituano (Galinho de Itu: #000000 / #ff0000)
  const ituano = allClubs.find((c) => c.name === 'Ituano') || getClubById(337);
  assert.ok(ituano, 'Ituano must exist in database');
  const ituanoAtmosphere = deriveClubAtmosphere(ituano);
  assert.equal(ituanoAtmosphere.family, 'vermelhos', 'Ituano should be classified as Vermelhos');
  assert.equal(ituanoAtmosphere.familyName, 'Vermelhos');
  assert.ok(ituanoAtmosphere.tokens['--app-bg-deep']);
  assert.ok(ituanoAtmosphere.tokens['--app-surface-1']);
  assert.ok(ituanoAtmosphere.tokens['--app-surface-2']);
  assert.ok(ituanoAtmosphere.tokens['--app-text-accent']);
  assert.equal(ituanoAtmosphere.style['--app-surface-1'], ituanoAtmosphere.tokens['--app-surface-1']);

  // 2. Santos (Peixe / Alvinegro Praiano: #f0f0f0 / #000000)
  const santos = allClubs.find((c) => c.name === 'Santos') || getClubById(568);
  assert.ok(santos, 'Santos must exist in database');
  const santosAtmosphere = deriveClubAtmosphere(santos);
  assert.equal(santosAtmosphere.family, 'alvinegros', 'Santos should be classified as Alvinegros');
  assert.equal(santosAtmosphere.familyName, 'Alvinegros');
  assert.ok(santosAtmosphere.tokens['--app-bg-deep']);
  assert.ok(santosAtmosphere.tokens['--app-surface-1']);
  assert.ok(santosAtmosphere.tokens['--app-surface-2']);
  assert.ok(santosAtmosphere.tokens['--app-text-accent']);

  // 3. Água Santa (Netuno / Azuis: #002358 / #FFFFFF)
  const aguaSanta = allClubs.find((c) => c.name === 'Água Santa') || getClubById(10);
  assert.ok(aguaSanta, 'Água Santa must exist in database');
  const aguaSantaAtmosphere = deriveClubAtmosphere(aguaSanta);
  assert.equal(aguaSantaAtmosphere.family, 'azuis', 'Água Santa should be classified as Azuis');
  assert.equal(aguaSantaAtmosphere.familyName, 'Azuis');
  assert.ok(aguaSantaAtmosphere.tokens['--app-bg-deep']);
  assert.ok(aguaSantaAtmosphere.tokens['--app-surface-1']);
  assert.ok(aguaSantaAtmosphere.tokens['--app-surface-2']);
  assert.ok(aguaSantaAtmosphere.tokens['--app-text-accent']);

  // Ensure each machine club has distinct visual tokens and doesn't get defaulted to green
  assert.notEqual(ituanoAtmosphere.family, 'verdes', 'Ituano must not default to green');
  assert.notEqual(santosAtmosphere.family, 'verdes', 'Santos must not default to green');
  assert.notEqual(aguaSantaAtmosphere.family, 'verdes', 'Água Santa must not default to green');
});
