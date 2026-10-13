import React from 'react';
import { useGame } from '../state/GameContext';
import type { Manager } from '../types';
import { getClubTheme } from '../theme/clubTheme';
import { ClubCrest } from './ClubCrest';
import { Award, UserCheck, Shield, ChevronRight } from 'lucide-react';

const money = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);

export const ManagersScreen: React.FC = () => {
  const { gameState, userClub, acceptManagerJob } = useGame();
  const clubTheme = getClubTheme(userClub);

  const managers = gameState.managers || [];
  const human = managers.find(m => m.id === gameState.humanManagerId);
  const sorted = (key: 'seasonScore' | 'careerScore') => [...managers].sort((a, b) => b[key] - a[key]);

  const ranking = (title: string, list: Manager[]) => (
    <section className="rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] p-4 shadow-md flex flex-col">
      <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-[var(--app-border-subtle)]">
        <Award className="w-4 h-4 text-[var(--app-text-accent)]" />
        <h2 className="text-[var(--app-text-accent)] font-bold text-sm uppercase tracking-wider">
          Ranking: {title}
        </h2>
      </div>

      <div className="space-y-1 text-sm flex-1">
        {list.slice(0, 15).map((m, i) => {
          const isHuman = m.id === human?.id;
          const club = gameState.clubs.find(c => c.id === m.currentClubId);

          return (
            <div 
              key={m.id} 
              style={isHuman ? { 
                borderLeft: `4px solid ${clubTheme.primaryAccent}`,
                backgroundColor: clubTheme.subtleBg 
              } : undefined}
              className={`flex items-center justify-between border-b border-[var(--app-border-subtle)] py-1.5 px-2 rounded-r transition-colors ${
                isHuman 
                  ? 'font-bold text-white shadow-xs' 
                  : 'text-slate-300 hover:bg-[var(--app-surface-2)]'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-xs text-slate-400 font-mono-numbers w-5">{i + 1}º</span>
                {club && <ClubCrest club={club} size="xs" preferMini={true} className="w-4 h-4 shrink-0" />}
                <span className="truncate">
                  {m.name}
                  <span className="text-slate-400 text-xs ml-1 font-normal">
                    · {club?.name || 'Disponível'}
                  </span>
                </span>
                {isHuman && (
                  <span 
                    className="text-[9px] px-1.5 py-0.2 rounded font-black tracking-wider uppercase shrink-0"
                    style={{ backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent }}
                  >
                    VOCÊ
                  </span>
                )}
              </div>
              <strong className="font-mono-numbers text-[var(--app-text-accent)]">
                {m[title === 'Temporada' ? 'seasonScore' : 'careerScore']} pts
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="flex-1 overflow-auto bg-[var(--app-bg-deep)] text-slate-100 p-4 sm:p-5 space-y-4 select-none pb-8 md:pb-5 min-h-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-wide text-white">Carreira dos Técnicos</h1>
        <span className="text-xs bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] px-2.5 py-1 rounded font-mono font-bold">
          {gameState.divisionName || 'Série A'} • Temporada {gameState.seasonYear}
        </span>
      </div>

      {human && (
        <section className="rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] p-4 space-y-3 relative overflow-hidden shadow-lg">
          {/* Kit Stripe Top Accent Line */}
          <div 
            className="h-1 w-full absolute top-0 left-0 right-0" 
            style={{ background: clubTheme.stripeGradient }} 
          />

          <div className="flex items-center space-x-3 pt-1">
            <ClubCrest club={userClub} size="lg" preferMini={true} className="w-10 h-10 shrink-0" />
            <div>
              <h2 className="font-bold text-lg text-white flex items-center space-x-2">
                <span>{human.name}</span>
                <span 
                  className="w-2 h-2 rounded-full inline-block" 
                  style={{ backgroundColor: clubTheme.primaryAccent }} 
                />
                <span className="text-sm text-slate-300 font-normal">
                  ({gameState.clubs.find(c => c.id === human.currentClubId)?.name || 'Sem clube'})
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Avaliação da diretoria: <strong className="text-[var(--app-text-accent)]">{Math.max(0, Math.min(100, Math.round(human.boardRating)))}/100</strong> · Reputação: <strong className="text-amber-400">{Math.max(0, Math.min(100, Math.round(human.reputation)))}/100</strong> · Perfil: <strong className="text-slate-200">{human.riskProfile}</strong>
              </p>
            </div>
          </div>

          <div className="p-3 bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] rounded-lg text-xs space-y-1">
            <p className="font-semibold text-slate-200">
              Pontuação da temporada: <strong className="text-[var(--app-text-accent)] font-mono-numbers text-sm">{human.seasonScore} pts</strong> = resultados ({human.scoreComponents.results}) + competições ({human.scoreComponents.competitions}) + elenco ({human.scoreComponents.squad}) + finanças ({human.scoreComponents.finances})
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Resultados: 4 × (pontos obtidos − pontos esperados). Competições: até 16 por aproveitamento e +20 pelo título ao encerrar a temporada. Elenco: variação do valor inicial, limitada a ±15. Finanças: caixa desde a posse e novos salários atrasados, limitada a ±20.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300 mb-2">Histórico Profissional</h3>
            <div className="space-y-1.5 text-xs">
              {human.jobs.map((j, i) => (
                <div key={i} className="p-2 rounded bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] flex items-center justify-between">
                  <span>
                    <strong className="text-white">{j.clubName}</strong>: {j.startSeason}, rodada {j.startRound} {j.endRound ? `até ${j.endSeason}, rodada ${j.endRound}` : '— atual'}
                  </span>
                  <span className="text-slate-300 font-mono-numbers">
                    {j.wins}V {j.draws}E {j.losses}D · caixa inicial {money(j.initialBalance)} {j.reason || ''}
                  </span>
                </div>
              ))}
              {human.titles.map((t, i) => (
                <p key={i} className="text-amber-300 font-semibold flex items-center space-x-1">
                  <span>🏆 Título Conquistado: {t}</span>
                </p>
              ))}
              {human.events.map((e, i) => (
                <p key={i} className="text-[11px] text-slate-400">{e}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {human?.available && (
        <section className="rounded-lg border border-amber-700/60 bg-amber-950/30 p-4">
          <h2 className="font-bold text-amber-300">Você foi demitido. Continue a carreira em outro clube.</h2>
          <p className="text-sm mb-3 text-slate-300">A situação financeira e o elenco dos clubes são preservados. Escolha um novo convite:</p>
          <div className="flex flex-wrap gap-2">
            {gameState.clubs.filter(c => c.id !== gameState.userClubId).slice(0, 6).map(c => (
              <button 
                key={c.id} 
                onClick={() => acceptManagerJob(c.id)} 
                className="rounded bg-emerald-600 hover:bg-emerald-500 font-bold px-3 py-2 text-sm text-black cursor-pointer shadow active:scale-95 transition-all"
              >
                Assumir {c.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ranking('Temporada', sorted('seasonScore'))}
        {ranking('Carreira', sorted('careerScore'))}
      </div>
    </div>
  );
};
