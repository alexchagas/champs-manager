import React, { useEffect, useRef } from 'react';
import { useGame } from '../state/GameContext';
import { MatchLineupPanel } from './MatchLineupPanel';
import { ClubCrest } from './ClubCrest';
import { sound } from '../audio/soundEngine';

export const LiveMatchScreen: React.FC = () => {
  const { gameState, dispatchMatch, completeRound, updateOptions, setScreen, matchError, viewedClubId } = useGame();
  const session = gameState.activeMatch;
  const seenEvents = useRef(session?.events.length ?? 0);
  const endRef = useRef<HTMLDivElement>(null);
  const pending = session?.pendingDecision;
  const finished = session?.phase === 'full_time' || session?.phase === 'committed';
  useEffect(() => {
    if (!session || session.paused || finished || gameState.activeScreen !== 'live_match' || viewedClubId !== null) return;
    const timer = window.setInterval(() => dispatchMatch({type:'advance'}), session.speed === 5 ? 120 : session.speed === 2 ? 350 : 750);
    return () => window.clearInterval(timer);
  }, [session?.paused, session?.speed, finished, gameState.activeScreen, viewedClubId]);
  useEffect(() => {
    if (!session) return;
    for (const event of session.events.slice(seenEvents.current)) {
      if (event.type === 'goal') sound.playGoal();
      else if (event.type === 'fulltime') sound.playFullTimeWhistle();
      else if (event.type === 'yellow_card' || event.type === 'red_card') sound.playWhistle(true);
    }
    seenEvents.current = session.events.length;
    endRef.current?.scrollIntoView({behavior:'smooth'});
  }, [session?.events.length]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (viewedClubId !== null) return;
      if ((e.target as HTMLElement)?.closest('input,select,textarea,button')) return;
      if (e.code === 'Space') { e.preventDefault(); if (finished) completeRound(); else if (!pending) dispatchMatch({type: session?.paused ? 'resume' : 'pause'}); }
      if (e.code === 'Escape') { e.preventDefault(); setScreen('overview'); }
    };
    window.addEventListener('keydown',handle); return () => window.removeEventListener('keydown',handle);
  }, [session?.paused, pending, finished, viewedClubId]);
  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) dispatchMatch({type:'pause'}); };
    document.addEventListener('visibilitychange',pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange',pauseWhenHidden);
  }, []);
  if (!session) return <div className="p-6">Nenhuma partida ativa. {matchError}</div>;
  const fixture = gameState.calendar.find(f => f.id === session.fixtureId)!;
  const clubs = session.teams.map(t => gameState.clubs.find(c => c.id === t.clubId)!);
  const clock = `${session.clock.minute}${session.clock.added ? '+'+session.clock.added : ''}′`;
  const phases: Record<string,string> = {first_half:'1º tempo',halftime:'Intervalo',second_half:'2º tempo',extra_time:'Prorrogação',shootout:'Disputa por pênaltis',full_time:'Encerrado',committed:'Consolidado'};
  const scoresMode = gameState.options.liveScores || 'hidden';
  const totalPossession = session.stats.possession[0]+session.stats.possession[1];
  const possession = totalPossession ? Math.round(session.stats.possession[0]*100/totalPossession) : 50;
  return <div className="flex-1 flex flex-col overflow-hidden bg-[var(--app-bg-deep)] text-slate-100">
    <div className="p-4 border-b border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] text-center">
      <p className="text-xs text-slate-400">{fixture.competitionName} · {fixture.stage} · {phases[session.phase]} · {clock}{session.paused && !finished ? ' · pausada' : ''}</p>
      <div className="flex justify-center items-center gap-5 mt-2 text-xl font-bold">
        <ClubCrest club={clubs[0]} size="lg"/><span>{session.teams[0].name}</span>
        <span className="font-digital text-4xl">{session.score[0]} : {session.score[1]}</span>
        <span>{session.teams[1].name}</span><ClubCrest club={clubs[1]} size="lg"/>
      </div>
      {session.penaltyAttempts.some(Boolean) && <p>Pênaltis: {session.penaltyScore.join(' : ')}</p>}
    </div>
    <div className="flex gap-2 flex-wrap items-center p-3 border-b border-[var(--app-border-subtle)]">
      {!finished && <button disabled={!!pending} onClick={() => dispatchMatch({type:session.paused ? 'resume':'pause'})} className="px-4 py-1 rounded bg-emerald-700 disabled:opacity-40">{session.paused ? session.phase === 'halftime' ? 'Iniciar 2º tempo' : 'Continuar' : 'Pausar'}</button>}
      {[1,2,5].map(speed => <button key={speed} onClick={() => dispatchMatch({type:'speed',speed})} className={`px-2 py-1 rounded ${session.speed === speed ? 'bg-emerald-800' : 'bg-slate-800'}`}>{speed}x</button>)}
      {!finished && <button disabled={!!pending || session.phase === 'halftime'} onClick={() => dispatchMatch({type:'finish'})} className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40">Simular até a próxima decisão / fim</button>}
      <button onClick={() => updateOptions({soundEnabled:!gameState.options.soundEnabled})} className="px-3 py-1">{gameState.options.soundEnabled ? 'Som ativo' : 'Mudo'}</button>
      {finished && <button onClick={() => completeRound()} className="px-4 py-2 rounded bg-emerald-500 text-black font-bold">Ver resultados da data</button>}
    </div>
    {matchError && <p role="alert" className="p-2 text-amber-300">{matchError}</p>}
    <div className="flex-1 grid grid-cols-2 gap-3 p-3 overflow-hidden">
      <div className="overflow-y-auto rounded border border-[var(--app-border-subtle)] p-3 space-y-2">
        <h2 className="font-bold">Lance a lance</h2>
        {session.events.map(e => <div key={e.id} className={`p-2 rounded ${e.type === 'goal' ? 'bg-emerald-900' : 'bg-[var(--app-surface-1)]'}`}>
          <span className="font-bold mr-2">{e.clock?.minute ?? e.minute}{e.clock?.added ? '+'+e.clock.added : ''}′</span>
          <span className="text-xs text-slate-400 mr-2">{session.teams[e.team === 'home' ? 0 : 1].name}</span>{e.description}
        </div>)}<div ref={endRef}/>
      </div>
      <div className="overflow-y-auto space-y-3">
        {pending && <section role="dialog" aria-label={pending.kind === 'penalty' ? 'Escolher cobrador' : 'Jogador lesionado'} className="p-4 rounded border border-amber-400 bg-[var(--app-surface-1)] space-y-2">
          <h2 className="font-bold text-amber-300">{pending.kind === 'penalty' ? 'Escolha o cobrador' : 'Lesão · '+session.teams[pending.side].players.find(p => p.id === pending.playerId)?.name}</h2>
          {pending.kind === 'penalty' ? <>
            <select value={pending.defaultTakerId ?? ''} onChange={e => dispatchMatch({type:'select_penalty_taker',player_id:Number(e.target.value)})} className="bg-slate-800 p-2 rounded w-full">
              {pending.eligibleIds.map(id => <option key={id} value={id}>{session.teams[pending.side].players.find(p => p.id === id)?.name}</option>)}
            </select>
            <button onClick={() => {const id = pending.defaultTakerId; if (id !== null) dispatchMatch({type:'choose_penalty_taker',player_id:id});}} className="bg-amber-500 text-black font-bold p-2 rounded">Cobrar pênalti</button>
          </> : <>
            <p>Gravidade: {pending.severity}. {pending.eligibleIds.length ? 'Escolha um reserva convocado para entrar.' : 'Sem troca válida: a equipe segue com um jogador a menos.'}</p>
            {pending.eligibleIds.map(id => <button key={id} onClick={() => dispatchMatch({type:'substitute',side:pending.side,outgoing:pending.playerId!,incoming:id})} className="block p-2 rounded bg-emerald-800 w-full text-left">Entrar: {session.teams[pending.side].players.find(p => p.id === id)?.name}</button>)}
            <button onClick={() => dispatchMatch({type:'continue_without_replacement'})} className="p-2 rounded bg-slate-800">Seguir sem substituir</button>
          </>}
          <p className="text-xs text-slate-400">A partida permanece pausada até você continuar. Pode salvar ou consultar os menus.</p>
        </section>}
        <MatchLineupPanel/>
        <section className="p-3 rounded bg-[var(--app-surface-1)] space-y-2">
          <h2 className="font-bold">Estatísticas ao vivo</h2>
          <p>Posse: {possession}% / {100-possession}%</p>
          <p>Finalizações: {session.stats.shots.join(' / ')} · No alvo: {session.stats.shotsOnTarget.join(' / ')}</p>
          <p>Escanteios: {session.stats.corners.join(' / ')} · Faltas: {session.stats.fouls.join(' / ')}</p>
        </section>
        <section className="p-3 rounded bg-[var(--app-surface-1)] space-y-2">
          <label>Outros jogos <select value={scoresMode} onChange={e => updateOptions({liveScores:e.target.value as 'hidden'|'competition'|'date'})} className="bg-slate-800 p-1 rounded">
            <option value="hidden">Ocultar</option><option value="competition">Mesma competição</option><option value="date">Todos da data</option>
          </select></label>
          {scoresMode !== 'hidden' && session.parallelMatches.filter(m => scoresMode === 'date' || gameState.calendar.find(f => f.id === m.fixtureId)?.competitionName === fixture.competitionName).map(m => <p key={m.fixtureId} className="text-xs">
            {m.teams[0].name} {m.score[0]} : {m.score[1]} {m.teams[1].name} · {m.phase === 'full_time' ? 'fim' : `${m.clock.minute}${m.clock.added ? '+'+m.clock.added : ''}′`}
          </p>)}
        </section>
      </div>
    </div>
  </div>;
};
