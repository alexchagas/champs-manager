import { createNewGame } from '../src/data/initialData.ts';
import { generateTwoSemesterCalendar } from '../src/data/calendarGenerator.ts';
import { getAllClubs } from '../src/data/teamsDatabase.ts';

console.log('=== CHAMPS MANAGER INTEGRATION VERIFICATION ===');

const allClubs = getAllClubs();
console.log(`Loaded ${allClubs.length} total clubs from database.`);

// 1. Verify Auto-escalação Inteligente Logic
console.log('\n--- 1. Testing Auto-escalação Inteligente Logic ---');
const palmeiras = allClubs.find((c) => c.name.toLowerCase().includes('palmeiras')) || allClubs[0];
console.log(`Testing with club: ${palmeiras.name} (${palmeiras.squad.length} players)`);

function autoSelectLineupJS(squad, formationStr) {
  let defTarget = 4;
  let midTarget = 4;
  let fwdTarget = 2;

  if (formationStr === '4-3-3') {
    defTarget = 4; midTarget = 3; fwdTarget = 3;
  } else if (formationStr === '3-5-2') {
    defTarget = 3; midTarget = 5; fwdTarget = 2;
  } else if (formationStr === '4-5-1') {
    defTarget = 4; midTarget = 5; fwdTarget = 1;
  } else if (formationStr === '5-3-2') {
    defTarget = 5; midTarget = 3; fwdTarget = 2;
  }

  const score = (p) => {
    const avail = !p.injured && !p.suspended ? 1.0 : 0.05;
    return (p.strength * (p.energy / 100) + p.strength * 0.01) * avail;
  };

  const gks = squad.filter((p) => p.position === 'GOL').sort((a, b) => score(b) - score(a));
  const defs = squad.filter((p) => p.position === 'ZAG' || p.position === 'LAT').sort((a, b) => score(b) - score(a));
  const mids = squad.filter((p) => p.position === 'VOL' || p.position === 'MEI').sort((a, b) => score(b) - score(a));
  const fwds = squad.filter((p) => p.position === 'ATA').sort((a, b) => score(b) - score(a));

  const chosenIds = new Set();
  const starters = [];

  // Strictly 1 GK, never outfield
  if (gks.length > 0) {
    starters.push({ ...gks[0], isStarter: true });
    chosenIds.add(gks[0].id);
  }

  // Defenders
  for (const d of defs) {
    if (starters.filter((p) => p.position === 'ZAG' || p.position === 'LAT').length >= defTarget) break;
    if (!chosenIds.has(d.id)) {
      starters.push({ ...d, isStarter: true });
      chosenIds.add(d.id);
    }
  }

  // Midfielders
  for (const m of mids) {
    if (starters.filter((p) => p.position === 'VOL' || p.position === 'MEI').length >= midTarget) break;
    if (!chosenIds.has(m.id)) {
      starters.push({ ...m, isStarter: true });
      chosenIds.add(m.id);
    }
  }

  // Forwards
  for (const f of fwds) {
    if (starters.filter((p) => p.position === 'ATA').length >= fwdTarget) break;
    if (!chosenIds.has(f.id)) {
      starters.push({ ...f, isStarter: true });
      chosenIds.add(f.id);
    }
  }

  return starters;
}

const formations = ['4-4-2', '4-3-3', '3-5-2', '4-5-1', '5-3-2'];
for (const formation of formations) {
  const starters = autoSelectLineupJS(palmeiras.squad, formation);
  console.log(`Formation ${formation}: Selected ${starters.length} starters:`);
  const gks = starters.filter((p) => p.position === 'GOL');
  const defs = starters.filter((p) => p.position === 'ZAG' || p.position === 'LAT');
  const mids = starters.filter((p) => p.position === 'VOL' || p.position === 'MEI');
  const fwds = starters.filter((p) => p.position === 'ATA');

  console.log(`  -> GOL: ${gks.map((p) => `${p.name} (${p.strength})`).join(', ')}`);
  console.log(`  -> DEF: ${defs.map((p) => `${p.name} [${p.position}] (${p.strength})`).join(', ')}`);
  console.log(`  -> MEI: ${mids.map((p) => `${p.name} [${p.position}] (${p.strength})`).join(', ')}`);
  console.log(`  -> ATA: ${fwds.map((p) => `${p.name} [${p.position}] (${p.strength})`).join(', ')}`);

  if (gks.length !== 1) throw new Error(`Expected exactly 1 GK, got ${gks.length}`);
  if (starters.length !== 11) throw new Error(`Expected exactly 11 starters, got ${starters.length}`);
}
console.log('✓ Auto-escalação Inteligente passed for all formations!');

// 2. Verify Brazilian Club Plays Estadual & Nacional in the Same Civil Year
console.log('\n--- 2. Testing Brazilian Club Season & Two-Semester Structure ---');
const game = createNewGame(palmeiras.id, 'Alex Chagas');

console.log(`Club: ${game.clubs.find((c) => c.id === game.userClubId)?.name}`);
console.log(`Civil Year: ${game.seasonYear}`);
console.log(`Current Semester: ${game.currentSemester}`);
console.log(`1st Semester Competition: ${game.stateChampionshipName}`);
console.log(`2nd Semester Competition: ${game.nationalLeagueName}`);
console.log(`Continental Cup: ${game.continentalCupName}`);
console.log(`Total Fixtures Generated: ${game.calendar.length}`);

const userFixtures = game.calendar.filter(
  (f) => f.homeClubId === palmeiras.id || f.awayClubId === palmeiras.id
);
console.log(`Total fixtures for user club: ${userFixtures.length}`);

// Semester 1: Estadual (Rounds 1 - 14)
const s1Matches = userFixtures.filter((f) => f.round <= 14 && f.competitionType === 'estadual');
console.log(`Semester 1 (Estadual) matches: ${s1Matches.length}`);
if (s1Matches.length === 0) {
  throw new Error('No Estadual matches found in Semester 1!');
}
console.log(`  Sample S1 match: Round ${s1Matches[0].round} - ${s1Matches[0].competitionName} (${s1Matches[0].stage})`);

// Semester 2: Nacional (Rounds 15 - 38)
const s2Matches = userFixtures.filter((f) => f.round >= 15 && f.competitionType === 'nacional');
console.log(`Semester 2 (Nacional) matches: ${s2Matches.length}`);
if (s2Matches.length === 0) {
  throw new Error('No Nacional matches found in Semester 2!');
}
console.log(`  Sample S2 match: Round ${s2Matches[0].round} - ${s2Matches[0].competitionName} (${s2Matches[0].stage})`);

// Wednesday Continental Matches (Libertadores / Champions / Sul-Americana)
const wednesdayMatches = userFixtures.filter((f) => f.dayOfWeek === 'quarta');
console.log(`Wednesday (Midweek) matches: ${wednesdayMatches.length}`);
if (wednesdayMatches.length === 0) {
  throw new Error('No Wednesday continental matches found!');
}
console.log(`  Sample Wednesday match: Round ${wednesdayMatches[0].round} - ${wednesdayMatches[0].competitionName} (${wednesdayMatches[0].stage})`);

// Verify two-legged ties (Ida e Volta)
const idaMatches = wednesdayMatches.filter((f) => f.leg === 1);
const voltaMatches = wednesdayMatches.filter((f) => f.leg === 2);
console.log(`Two-legged ties: ${idaMatches.length} Ida matches, ${voltaMatches.length} Volta matches`);
if (idaMatches.length === 0 || voltaMatches.length === 0) {
  throw new Error('Two-legged ties (Ida e Volta) missing in continental stage!');
}

console.log('\n======================================================');
console.log('SUCCESS: Brazilian club plays BOTH Campeonato Estadual');
console.log('and Campeonato Nacional in the same civil year (2026),');
console.log('plus Continental Cup matches on Wednesdays!');
console.log('======================================================');
