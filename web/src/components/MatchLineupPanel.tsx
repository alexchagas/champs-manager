import React, { useState } from 'react';
import { useGame } from '../state/GameContext';
import { FormationType, Mentality } from '../types';
import { Shield, ArrowUpDown, AlertCircle, Zap } from 'lucide-react';

const POSITION_RANK: Record<string, number> = {
  GOL: 1,
  ZAG: 2,
  LAT: 3,
  VOL: 4,
  MEI: 5,
  ATA: 6,
};

const POSITION_COLORS: Record<string, { bg: string; text: string }> = {
  GOL: { bg: 'bg-amber-600', text: 'text-amber-100' },
  LAT: { bg: 'bg-cyan-600', text: 'text-cyan-100' },
  ZAG: { bg: 'bg-blue-600', text: 'text-blue-100' },
  VOL: { bg: 'bg-emerald-600', text: 'text-emerald-100' },
  MEI: { bg: 'bg-purple-600', text: 'text-purple-100' },
  ATA: { bg: 'bg-rose-600', text: 'text-rose-100' },
};

const FORMATIONS: FormationType[] = ['4-4-2', '4-3-3', '3-5-2', '4-5-1', '5-3-2'];
const MENTALITIES: Mentality[] = ['Muito Defensiva', 'Defensiva', 'Equilibrada', 'Ofensiva', 'Muito Ofensiva'];

export const MatchLineupPanel: React.FC = () => {
  const { gameState, userClub, dispatchMatch, changeMatchFormation, changeMatchMentality, matchError } = useGame();
  const session = gameState.activeMatch!;
  const human = session.humanSide ?? 0;
  const [side, setSide] = useState(human);
  const [outgoing, setOutgoing] = useState<number | null>(null);

  const team = session.teams[side];
  const readOnly = side !== human || session.phase === 'full_time' || session.phase === 'committed';
  const onField = Object.keys(team.onFieldRoleByPlayerId).map(Number);
  const injured = team.injuredIds.filter(id => !team.unavailableIds.includes(id));
  const bench = team.namedSubstituteIds.filter(
    id => !team.usedSubstituteIds.includes(id) && !team.unavailableIds.includes(id)
  );

  const getRole = (id: number) =>
    team.onFieldRoleByPlayerId[String(id)] ||
    team.players.find(p => p.id === id)?.position ||
    'MEI';

  const outgoingPlayer = outgoing !== null ? team.players.find(p => p.id === outgoing) : null;
  const outgoingRole = outgoing !== null ? getRole(outgoing) : null;

  // Sort on-field players by tactical order: GOL -> ZAG -> LAT -> VOL -> MEI -> ATA
  const sortedOnField = [...onField].sort((a, b) => {
    const roleA = getRole(a);
    const roleB = getRole(b);
    const diff = (POSITION_RANK[roleA] || 99) - (POSITION_RANK[roleB] || 99);
    if (diff !== 0) return diff;
    const playerA = team.players.find(p => p.id === a);
    const playerB = team.players.find(p => p.id === b);
    return (playerB?.strength || 0) - (playerA?.strength || 0);
  });

  // Sort bench: if an outgoing player is selected, natural position matches appear first
  const sortedBench = [...bench].sort((a, b) => {
    const playerA = team.players.find(p => p.id === a);
    const playerB = team.players.find(p => p.id === b);
    if (outgoing !== null && outgoingPlayer) {
      const aIdeal = playerA?.position === outgoingPlayer.position || playerA?.position === outgoingRole;
      const bIdeal = playerB?.position === outgoingPlayer.position || playerB?.position === outgoingRole;
      if (aIdeal && !bIdeal) return -1;
      if (!aIdeal && bIdeal) return 1;
    }
    const posA = playerA?.position || 'MEI';
    const posB = playerB?.position || 'MEI';
    const diff = (POSITION_RANK[posA] || 99) - (POSITION_RANK[posB] || 99);
    if (diff !== 0) return diff;
    return (playerB?.strength || 0) - (playerA?.strength || 0);
  });

  return (
    <section className="rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] p-3 space-y-3 text-sm shadow-md">
      {/* Team Tabs (Cruzeiro vs Adversário) */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {session.teams.map((t, i) => (
          <button
            key={t.clubId}
            onClick={() => {
              setSide(i);
              setOutgoing(null);
            }}
            className={`min-h-[36px] px-3 py-1.5 rounded-md font-bold text-xs shrink-0 cursor-pointer transition-colors active:scale-95 ${
              side === i
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {t.name}
            {i !== human ? ' · adversário' : ''}
          </button>
        ))}
      </div>

      {/* Formation & Match Opportunity Stats */}
      <div className="text-xs space-y-2 bg-[var(--app-surface-2)]/70 p-2.5 rounded-lg border border-[var(--app-border-subtle)]">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
            <span className="font-bold text-emerald-400">{team.formation}</span>
            <span>·</span>
            <span>{onField.length} atletas em campo</span>
          </div>
          <div className="text-slate-300 text-[11px]">
            Trocas: <strong className="text-white">{team.substitutionsUsed}/{session.rules.substitutionLimit}</strong>
            {' · '}
            Paradas: <strong className="text-white">{team.opportunitiesUsed}/{session.rules.opportunityLimit}</strong>
            {session.phase === 'halftime' ? ' · intervalo' : ''}
          </div>
        </div>

        {/* Formation Change Selector (for human team during match) */}
        {!readOnly && (
          <div className="pt-1.5 border-t border-[var(--app-border-subtle)]/60">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center space-x-1">
              <span>Alterar Formação Tática:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {FORMATIONS.map(fmt => (
                <button
                  key={fmt}
                  onClick={() => {
                    dispatchMatch({ type: 'pause' });
                    changeMatchFormation(fmt);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer transition-all active:scale-95 ${
                    team.formation === fmt
                      ? 'bg-emerald-500 text-black shadow-xs font-black'
                      : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            {/* Postura Tática / Mentalidade */}
            <div className="pt-2 mt-2 border-t border-[var(--app-border-subtle)]/40">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
                <span>Postura Tática / Comportamento:</span>
                <span className="text-emerald-400 font-semibold">{userClub.tactics.mentality}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {MENTALITIES.map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      dispatchMatch({ type: 'pause' });
                      changeMatchMentality(m);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all active:scale-95 ${
                      userClub.tactics.mentality === m
                        ? m.includes('Ofensiva')
                          ? 'bg-rose-500 text-white font-black shadow-xs'
                          : m.includes('Defensiva')
                          ? 'bg-blue-600 text-white font-black shadow-xs'
                          : 'bg-emerald-500 text-black font-black shadow-xs'
                        : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="text-slate-400 text-[11px] flex items-center space-x-1 pt-0.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Toque em quem sai e depois toque no reserva para substituir.</span>
        </div>
      </div>

      {/* Lineup Grid (Field vs Bench) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Starters on field */}
        <div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Em campo ({onField.length})</span>
            {outgoing !== null && (
              <span className="text-[10px] text-amber-400 animate-pulse font-bold">
                Escolha o substituto...
              </span>
            )}
          </h3>
          <div className="space-y-1">
            {sortedOnField.map(id => {
              const p = team.players.find(player => player.id === id)!;
              const isSelected = outgoing === id;
              const role = getRole(id);
              const badge = POSITION_COLORS[role] || { bg: 'bg-slate-700', text: 'text-white' };
              const currentEnergy = Math.max(20, Math.round(p.energy - session.clock.minute * 0.16));
              const energyColor = currentEnergy >= 80 ? 'text-emerald-400' : currentEnergy >= 60 ? 'text-amber-400' : 'text-rose-400';

              return (
                <button
                  key={id}
                  disabled={readOnly}
                  onClick={() => {
                    dispatchMatch({ type: 'pause' });
                    setOutgoing(isSelected ? null : id);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 min-h-[38px] rounded-md text-xs transition-all flex items-center justify-between cursor-pointer active:scale-98 ${
                    isSelected
                      ? 'bg-amber-400 text-black font-bold ring-2 ring-amber-300 shadow-md'
                      : 'bg-[var(--app-surface-2)] hover:bg-[#163022] text-slate-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span
                      className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${
                        isSelected ? 'bg-black text-amber-300' : `${badge.bg} ${badge.text}`
                      }`}
                    >
                      {role}
                    </span>
                    <span className="truncate font-medium">{p.name}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[10px] shrink-0 font-mono">
                    <span className={isSelected ? 'text-black font-black' : 'text-slate-300'}>
                      F: {p.strength}
                    </span>
                    <span className={isSelected ? 'text-black font-bold' : energyColor}>
                      ⚡ {currentEnergy}%
                    </span>
                    {injured.includes(id) && (
                      <span className="bg-rose-900 text-rose-200 px-1 rounded font-bold">DM</span>
                    )}
                    {team.temporaryGoalkeeperId === id && (
                      <span className="bg-amber-900 text-amber-200 px-1 rounded font-bold">🧤 GOL</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bench */}
        <div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Banco ({bench.length})</span>
            {outgoing !== null && (
              <button
                onClick={() => setOutgoing(null)}
                className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                Cancelar troca
              </button>
            )}
          </h3>
          <div className="space-y-1">
            {sortedBench.length === 0 ? (
              <div className="text-xs text-slate-500 py-3 text-center bg-[var(--app-surface-2)]/30 rounded-md">
                Sem suplentes disponíveis
              </div>
            ) : (
              sortedBench.map(id => {
                const p = team.players.find(player => player.id === id)!;
                const badge = POSITION_COLORS[p.position] || { bg: 'bg-slate-700', text: 'text-white' };
                const isIdealSub = outgoing !== null && (p.position === outgoingPlayer?.position || p.position === outgoingRole);
                const benchEnergy = Math.round(p.energy);
                const benchEnergyColor = benchEnergy >= 80 ? 'text-emerald-400' : benchEnergy >= 60 ? 'text-amber-400' : 'text-rose-400';

                return (
                  <button
                    key={id}
                    disabled={readOnly || outgoing === null}
                    onClick={() => {
                      if (outgoing !== null) {
                        const res = dispatchMatch({
                          type: 'substitute',
                          side,
                          outgoing,
                          incoming: id,
                        });
                        if (res.success) setOutgoing(null);
                      }
                    }}
                    className={`w-full text-left px-2.5 py-1.5 min-h-[38px] rounded-md text-xs transition-all flex items-center justify-between cursor-pointer active:scale-98 ${
                      outgoing !== null
                        ? isIdealSub
                          ? 'bg-emerald-950/80 hover:bg-emerald-900 border-2 border-emerald-400 text-white shadow-md'
                          : 'bg-[var(--app-surface-2)] hover:bg-emerald-950/60 border border-slate-700/60 text-slate-200'
                        : 'bg-[var(--app-surface-2)]/60 opacity-80 cursor-default'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span
                        className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${badge.bg} ${badge.text}`}
                      >
                        {p.position}
                      </span>
                      <span className="truncate text-slate-200 font-medium">{p.name}</span>
                      {isIdealSub && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1 py-0.2 rounded font-black tracking-tighter uppercase">
                          Ideal
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5 text-[10px] shrink-0 font-mono">
                      <span className="font-bold text-slate-300">
                        F: {p.strength}
                      </span>
                      <span className={`font-bold ${benchEnergyColor}`}>
                        ⚡ {benchEnergy}%
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {team.sentOffIds.length > 0 && (
        <p className="text-xs text-rose-400 font-semibold flex items-center space-x-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>
            Expulsos: {team.sentOffIds.map(id => team.players.find(p => p.id === id)?.name).join(', ')}
          </span>
        </p>
      )}

      {matchError && (
        <p role="alert" className="text-amber-300 text-xs font-semibold">
          {matchError}
        </p>
      )}
    </section>
  );
};
