import React, { useState } from 'react';
import { useGame } from '../state/GameContext';

export const MatchLineupPanel: React.FC = () => {
  const { gameState, dispatchMatch, matchError } = useGame();
  const session = gameState.activeMatch!;
  const human = session.humanSide ?? 0;
  const [side, setSide] = useState(human);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const team = session.teams[side];
  const readOnly = side !== human || session.phase === 'full_time' || session.phase === 'committed';
  const onField = Object.keys(team.onFieldRoleByPlayerId).map(Number);
  const injured = team.injuredIds.filter(id => !team.unavailableIds.includes(id));
  const bench = team.namedSubstituteIds.filter(id => !team.usedSubstituteIds.includes(id) && !team.unavailableIds.includes(id));
  return <section className="rounded border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] p-3 space-y-3 text-sm">
    <div className="flex gap-2">
      {session.teams.map((t,i) => <button key={t.clubId} onClick={() => {setSide(i); setOutgoing(null);}} className={`px-3 py-1 rounded ${side === i ? 'bg-emerald-700' : 'bg-slate-800'}`}>{t.name}{i !== human ? ' · consulta' : ''}</button>)}
    </div>
    <p>{team.formation} · Formação e convocação bloqueadas · {onField.length} em campo</p>
    <p>Trocas: {team.substitutionsUsed}/{session.rules.substitutionLimit} · Oportunidades: {team.opportunitiesUsed}/{session.rules.opportunityLimit}{session.phase === 'halftime' ? ' · intervalo gratuito' : ''}</p>
    <p className="text-slate-400 text-xs">Pause, selecione quem sai e clique no reserva que entra. Faça as trocas da mesma parada antes de continuar.</p>
    <div className="grid grid-cols-2 gap-3">
      <div><h3 className="font-bold">Em campo / lesionados</h3>{[...onField,...injured].map(id => {
        const p = team.players.find(p => p.id === id)!;
        return <button key={id} disabled={readOnly} onClick={() => {dispatchMatch({type:'pause'}); setOutgoing(id);}} className={`block w-full text-left p-1 rounded ${outgoing === id ? 'bg-emerald-800' : ''}`}>
          {team.onFieldRoleByPlayerId[id] || p.position} · {p.name}{injured.includes(id) ? ' · lesionado' : ''}{team.temporaryGoalkeeperId === id ? ' · improvisado' : ''}
        </button>;
      })}</div>
      <div><h3 className="font-bold">Banco convocado ({bench.length})</h3>{bench.map(id => {
        const p = team.players.find(p => p.id === id)!;
        return <button key={id} disabled={readOnly || outgoing === null} onClick={() => {
          if (outgoing !== null && dispatchMatch({type:'substitute',side,outgoing,incoming:id}).success) setOutgoing(null);
        }} className="block w-full text-left p-1 hover:bg-emerald-900 disabled:opacity-50">{p.position} · {p.name} · força {p.strength}</button>;
      })}</div>
    </div>
    {team.sentOffIds.length > 0 && <p>Expulsos: {team.sentOffIds.map(id => team.players.find(p => p.id === id)?.name).join(', ')}</p>}
    <p className="text-slate-500 text-xs">Fora da súmula: {team.offSheetIds.map(id => team.players.find(p => p.id === id)?.name).join(', ') || 'ninguém'}</p>
    {matchError && <p role="alert" className="text-amber-300">{matchError}</p>}
  </section>;
};
