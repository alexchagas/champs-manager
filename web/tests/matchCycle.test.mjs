import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initSync, wasm_match_command, WasmCareerEngine } from '../src/wasm_pkg/champs_core.js';
import { createNewGame } from '../src/data/initialData.ts';
import { migrateCareer, migrateMatchState, automaticMatchBench, closeRoundFinances } from '../src/engine/careerEconomy.ts';
import { resolvePendingFixtures } from '../src/engine/qualification.ts';
initSync({module:fs.readFileSync(new URL('../src/wasm_pkg/champs_core_bg.wasm',import.meta.url))});
const command=(state,cmd)=>JSON.parse(wasm_match_command(JSON.stringify(state),JSON.stringify(cmd)));
const currentFixture=s=>s.calendar.find(f=>!f.pendingQualification&&!f.played&&(f.fixtureDateIndex??f.round)===s.currentRound&&(f.homeClubId===s.userClubId||f.awayClubId===s.userClubId));
const start=()=>{let s=migrateCareer(createNewGame(255,'Teste Ciclo',{autoPauseOnGoal:false}));return command(s,{type:'start',fixture_id:currentFixture(s).id});};
function tick(state) {
  const active=state.activeMatch;
  if(active.pendingDecision) return command(state,active.pendingDecision.kind==='penalty'?{type:'choose_penalty_taker',player_id:active.pendingDecision.defaultTakerId}:{type:'continue_without_replacement'});
  return command(state,{type:active.paused?'resume':'advance'});
}
function finish(s) {for(let i=0;i<500&&!['full_time','committed'].includes(s.activeMatch.phase);i++)s=tick(s);assert.equal(s.activeMatch.phase,'full_time');return s;}

test('old save opens in planning; migration preserves an explicitly empty bench',()=>{
 const old=createNewGame(255,'Teste');old.activeScreen='live_match';old.activeMatchFixtureId=99;
 const migrated=migrateMatchState(old);assert.equal(migrated.activeScreen,'tactics');assert.equal(migrated.activeMatchFixtureId,undefined);
 const club=migrated.clubs.find(c=>c.id===255);assert.ok(club.namedSubstituteIds.length<=11);assert.ok(club.namedSubstituteIds.some(id=>club.squad.find(p=>p.id===id).position==='GOL'));
 club.namedSubstituteIds=[];assert.deepEqual(migrateMatchState(migrated).clubs.find(c=>c.id===255).namedSubstituteIds,[]);
 assert.ok(automaticMatchBench(club).every(id=>!club.squad.find(p=>p.id===id).isStarter));
});

test('real WASM preserves minute 37, score, RNG, log, bank, speed and parallel clocks after save/menu/reload',()=>{
 let s=start();s=command(s,{type:'speed',speed:5});while(s.activeMatch.clock.elapsed<37)s=tick(s);
 s=command(s,{type:'pause'});const saved=JSON.parse(JSON.stringify(s));
 saved.activeScreen='news';const restored=migrateMatchState(saved);
 assert.equal(restored.activeMatch.clock.minute,37);assert.equal(restored.activeMatch.speed,5);assert.deepEqual(restored.activeMatch,s.activeMatch);
 for(const p of restored.activeMatch.parallelMatches){assert.equal(p.clock.elapsed,37);assert.ok(p.events.every(e=>e.clock.elapsed<=37));}
 assert.deepEqual(command(restored,{type:'start',fixture_id:s.activeMatch.fixtureId}).activeMatch,s.activeMatch);
 const a=finish(s),b=finish(restored);assert.deepEqual(a.activeMatch,b.activeMatch);
});

test('real WASM finalization and career finances are idempotent and use existing parallel results',()=>{
 const ended=finish(start());const closed=command(ended,{type:'commit'});
 assert.equal(closed.activeMatch.phase,'committed');assert.deepEqual(command(closed,{type:'commit'}),closed);
 for(const session of [closed.activeMatch,...closed.activeMatch.parallelMatches]){
  const fixture=closed.calendar.find(f=>f.id===session.fixtureId);assert.deepEqual([fixture.homeScore,fixture.awayScore],session.score);
  assert.deepEqual(fixture.events.map(e=>e.id),session.events.map(e=>e.id));
 }
 const fixtures=closed.calendar.filter(f=>(f.fixtureDateIndex??f.round)===closed.currentRound);
 const finances=closeRoundFinances(closed.clubs,fixtures,closed.currentRound);
 assert.deepEqual(closeRoundFinances(finances,fixtures,closed.currentRound),finances);
});

test('brackets use away shootout wins in single and aggregate ties',()=>{
 const fixture=(id,round,home,away,extra={})=>({id,round,competitionType:'copa',homeClubId:home,awayClubId:away,homeScore:0,awayScore:0,played:true,...extra});
 const s={calendar:[fixture(1,1,1,2,{penaltyScore:[3,4]}),fixture(2,1,3,4,{penaltyScore:[2,4]}),fixture(3,2,0,0,{pendingQualification:true,played:false})]};
 const resolved=resolvePendingFixtures(s);assert.deepEqual([resolved.calendar[2].homeClubId,resolved.calendar[2].awayClubId],[2,4]);
 const semifinal=(id,home,away,leg,extra={})=>({...fixture(id,leg,home,away,extra),competitionType:'estadual',stage:'Semifinal',leg});
 const aggregate={calendar:[semifinal(4,1,2,1),semifinal(5,3,4,1),semifinal(6,2,1,2,{penaltyScore:[3,4]}),semifinal(7,4,3,2,{penaltyScore:[4,3]}),{id:8,round:3,competitionType:'estadual',stage:'Final',pendingQualification:true,played:false}]};
 const result=resolvePendingFixtures(aggregate);assert.deepEqual([result.calendar[4].homeClubId,result.calendar[4].awayClubId],[1,4]);
});

test('active save mirror restores the newest session while IndexedDB is unavailable',async()=>{
 const {saveActiveGameToStorage,loadActiveGameFromStorage}=await import('../src/state/storage.ts');
 const memory=new Map();const previous=globalThis.localStorage;
 globalThis.localStorage={setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k)??null,removeItem:k=>memory.delete(k)};
 try {
  const s=start();await saveActiveGameToStorage(s);
  const next=command(s,{type:'pause'});next.activeMatch.clock.minute=37;
  const pendingWrite=saveActiveGameToStorage(next);
  assert.deepEqual(await loadActiveGameFromStorage(),next);
  await pendingWrite;
 } finally {globalThis.localStorage=previous;}
});

test('atomic auto-lineup populates 11 starters and 11 bench players without Rust rejection', () => {
 const initial = createNewGame(255, 'Manager Teste');
 const engine = new WasmCareerEngine(JSON.stringify(initial), 42);
 const updatedJson = engine.auto_select_best_lineup(255, '4-4-2');
 const updated = JSON.parse(updatedJson);
 const club = updated.clubs.find(c => c.id === 255);
 assert.equal(club.squad.filter(p => p.isStarter).length, 11);

 const benchIds = automaticMatchBench(club);
 assert.equal(benchIds.length, 11);
 assert.ok(benchIds.every(id => !club.squad.find(p => p.id === id).isStarter));

 const withBench = command(updated, { type: 'set_bench', ids: benchIds });
 const rustClub = withBench.clubs.find(c => c.id === 255);
 assert.deepEqual(rustClub.namedSubstituteIds, benchIds);
});
