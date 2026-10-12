import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const positions = { GOL: ['goalkeeper', 0], LAT: ['fullback', 1], ZAG: ['centre_back', 2], VOL: ['midfielder', 3], MEI: ['midfielder', 3], ATA: ['forward', 4] };
const foot = { D: 'right', E: 'left', A: 'both' };

function asRawPlayer(player, old, countryId) {
  const [position, positionCode] = positions[player.position] ?? positions.MEI;
  return { ...old, id: player.id, name: player.name, age: player.age,
    nationality_id: old?.nationality_id ?? countryId, position, position_code: positionCode,
    starter: player.isStarter, star: player.isStar, world_top: player.isWorldTop,
    trait1: old?.trait1 ?? 0, trait2: old?.trait2 ?? 0,
    foot: foot[player.foot] ?? 'right', hash: old?.hash ?? 0,
    strength: player.strength, skill1: player.skill1, skill2: player.skill2 };
}

function asRawClub(club, old, rawPlayers) {
  return { source_id: club.id, variant_id: 0, base_color: 0, coach_nationality_id: club.countryId ?? 29, ...old, id: club.id, name: club.name, file_ref: club.fileRef ?? old?.file_ref ?? '',
    reputation: club.reputation, country_id: club.countryId ?? 29, division: club.division ?? 1,
    state_id: club.stateId ?? old?.state_id ?? 0, level: club.level ?? old?.level ?? 1,
    stadium: club.stadium, stadium_capacity: club.capacity, coach: club.coach,
    primary_color: club.primaryColor, secondary_color: club.secondaryColor, valid: true,
    squad: club.squad.map((player) => asRawPlayer(player, rawPlayers.get(player.id), club.countryId ?? 29)),
    youth: old?.youth ?? [], assets: old?.assets ?? { crest: null, crest_mini: null, shirt: null, shirt2: null, shirt3: null } };
}

async function atomicJson(file, value) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, file);
}

export async function persistClubEdits(root, clubs) {
  if (!Array.isArray(clubs) || !clubs.length || clubs.length > 704) throw new Error('Lista de clubes inválida');
  const ids = new Set();
  for (const club of clubs) {
    if (!Number.isSafeInteger(club.id) || club.id < 1 || ids.has(club.id) ||
      !club.name?.trim() || !club.stadium?.trim() || !Number.isSafeInteger(club.capacity) || club.capacity < 0 ||
      !Number.isInteger(club.reputation) || club.reputation < 1 || club.reputation > 5 || !Array.isArray(club.squad)) {
      throw new Error('Dados de clube inválidos');
    }
    ids.add(club.id);
  }
  const rawPath = path.join(root, 'data/teams.json');
  const webPath = path.join(root, 'web/src/data/teamsDatabase.json');
  const [raw, web] = await Promise.all([
    readFile(rawPath, 'utf8').then(JSON.parse), readFile(webPath, 'utf8').then(JSON.parse),
  ]);
  const rawById = new Map(raw.clubs.map((club) => [club.id, club]));
  const rawPlayers = new Map(raw.clubs.flatMap((club) => club.squad.map((player) => [player.id, player])));
  const webById = new Map(web.clubs.map((club) => [club.id, club]));
  for (const club of clubs) {
    const previous = webById.get(club.id);
    const membershipChanged = !previous || previous.countryId !== club.countryId || previous.division !== club.division;
    rawById.set(club.id, asRawClub(club, rawById.get(club.id), rawPlayers));
    webById.set(club.id, club);
    if (membershipChanged) {
      for (const league of web.leagues) {
        league.clubIds = league.clubIds.filter((id) => id !== club.id);
        league.teamCount = league.clubIds.length;
      }
      const target = web.leagues.find((league) => league.countryId === club.countryId && league.division === club.division);
      if (target) {
        target.clubIds.push(club.id);
        target.teamCount = target.clubIds.length;
      }
      for (const league of raw.leagues ?? []) {
        league.club_ids = league.club_ids.filter((id) => id !== club.id);
      }
      const rawTarget = raw.leagues?.find((league) => league.country_id === club.countryId && league.division === club.division);
      if (rawTarget) rawTarget.club_ids.push(club.id);
    }
  }
  raw.clubs = [...rawById.values()];
  web.clubs = [...webById.values()];
  web.totalClubs = web.clubs.length;
  for (const country of web.countries) country.clubCount = web.clubs.filter((club) => club.countryId === country.id).length;
  await atomicJson(rawPath, raw);
  await atomicJson(webPath, web);
}
