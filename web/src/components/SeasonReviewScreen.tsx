import React, { useMemo } from 'react';
import { Trophy, Award, ArrowRight, ShieldCheck, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import type { GameState, ChampionshipRecord, StandingRow, Club } from '../types/index';
import { ClubCrest } from './ClubCrest';
import { getClubTheme } from '../theme/clubTheme';
import { sound } from '../audio/soundEngine';

interface Props {
  gameState: GameState;
  onStartNextSeason: () => void;
}

export const SeasonReviewScreen: React.FC<Props> = ({ gameState, onStartNextSeason }) => {
  const seasonYear = gameState.seasonYear;
  const history = useMemo(() => {
    return (gameState.championshipHistory || []).filter(h => h.seasonYear === seasonYear);
  }, [gameState.championshipHistory, seasonYear]);

  const userClub = useMemo(() => {
    return gameState.clubs.find(c => c.id === gameState.userClubId) || gameState.clubs[0];
  }, [gameState.clubs, gameState.userClubId]);

  const clubTheme = useMemo(() => getClubTheme(userClub), [userClub]);

  const standings = useMemo(() => {
    return gameState.standingsNacional || gameState.standings || [];
  }, [gameState.standingsNacional, gameState.standings]);

  const userStanding = useMemo(() => {
    return standings.find(s => s.clubId === userClub.id);
  }, [standings, userClub.id]);

  const userPosition = useMemo(() => {
    return userStanding ? standings.indexOf(userStanding) + 1 : undefined;
  }, [standings, userStanding]);

  const g4 = useMemo(() => standings.slice(0, 4), [standings]);
  const z4 = useMemo(() => standings.slice(-4), [standings]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  const getClubData = (clubId: number, fallbackName: string, fallbackCrest?: string): Partial<Club> => {
    const found = gameState.clubs.find(c => c.id === clubId);
    if (found) return found;
    return { name: fallbackName, crestUrl: fallbackCrest };
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--app-bg-deep)] p-2 sm:p-4 md:h-screen select-none md:overflow-hidden md:min-h-0 pb-8 md:pb-0">
      {/* TOP HERO BANNER */}
      <div className="relative overflow-hidden bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-md mb-2 shrink-0">
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: clubTheme.stripeGradient }} />

        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] flex items-center justify-center p-1.5 shrink-0">
            <ClubCrest club={userClub} size="md" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-950/70 border border-emerald-600/40 text-emerald-300">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Encerramento de Temporada</span>
              </span>
              <span className="text-xs bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-subtle)] px-2 py-0.5 rounded-full font-mono font-bold">
                Ano {seasonYear}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-black text-white uppercase tracking-wider mt-0.5">
              Retrospectiva & Conclusão de Temporada
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Todos os campeonatos foram finalizados. Confira os campeões, acessos, rebaixamentos e o balanço do seu clube.
            </p>
          </div>
        </div>

        {/* Club Quick Summary */}
        <div className="flex items-center space-x-2 sm:space-x-3 text-xs ml-auto sm:ml-0">
          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] px-3 py-1.5 rounded-lg text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Classificação Final</span>
            <span className="text-emerald-400 font-mono font-black text-sm">
              {userPosition ? `${userPosition}º Lugar` : 'Concluída'}
            </span>
          </div>
          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] px-3 py-1.5 rounded-lg text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Caixa do Clube</span>
            <span className="text-amber-400 font-mono font-black text-sm">
              {formatCurrency(userClub.balance)}
            </span>
          </div>
        </div>
      </div>

      {/* SCROLLABLE MAIN CONTENT */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {/* QUADRO DE CAMPEÕES DA TEMPORADA */}
        <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-[var(--app-border-subtle)] pb-2">
            <div className="flex items-center space-x-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
                Campeões da Temporada {seasonYear}
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {history.length} {history.length === 1 ? 'título disputado' : 'títulos disputados'}
            </span>
          </div>

          {history.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-[var(--app-surface-2)]/50 rounded-lg border border-[var(--app-border-subtle)]">
              Nenhuma competição registrada nesta temporada.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {history.map((record) => {
                const isUserWinner = record.championClubId === userClub.id;
                const champData = getClubData(record.championClubId, record.championClubName, record.championClubCrest);
                const runnerData = getClubData(record.runnerUpClubId, record.runnerUpClubName, record.runnerUpClubCrest);

                return (
                  <div
                    key={record.id}
                    className={`p-3 rounded-lg border flex flex-col justify-between transition-colors ${
                      isUserWinner
                        ? 'bg-[var(--app-surface-2)] border-[var(--app-border-highlight)] shadow-sm'
                        : 'bg-[var(--app-surface-2)]/60 border-[var(--app-border-subtle)]'
                    }`}
                    style={
                      isUserWinner
                        ? { borderLeft: '3px solid var(--app-text-accent)' }
                        : undefined
                    }
                  >
                    <div>
                      {/* Competition Title */}
                      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-[var(--app-border-subtle)]">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 truncate">
                          {record.competitionName}
                        </span>
                        {isUserWinner && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[var(--app-text-accent)] text-slate-950 shrink-0">
                            SEU CLUBE
                          </span>
                        )}
                      </div>

                      {/* Champion Row */}
                      <div className="flex items-center space-x-2.5 my-2">
                        <div className="w-10 h-10 rounded-lg bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] flex items-center justify-center p-1 shrink-0">
                          <ClubCrest club={champData} size="sm" preferMini={true} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-bold text-amber-400 block">Campeão 🏆</span>
                          <h3 className="text-xs sm:text-sm font-bold text-white truncate leading-tight">
                            {record.championClubName}
                          </h3>
                          <span className="text-[11px] text-amber-300 font-mono font-medium">
                            {record.finalScoreText}
                          </span>
                        </div>
                      </div>

                      {/* Runner-up */}
                      <div className="pt-2 border-t border-[var(--app-border-subtle)]/50 flex items-center justify-between text-xs text-slate-400">
                        <span className="text-[10px] uppercase font-semibold">Vice:</span>
                        <div className="flex items-center space-x-1.5 truncate max-w-[140px]">
                          <ClubCrest club={runnerData} size="xs" preferMini={true} />
                          <span className="text-slate-300 font-medium truncate">{record.runnerUpClubName}</span>
                        </div>
                      </div>

                      {/* Top Scorer */}
                      {record.topScorerName && (
                        <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                          <span className="text-[10px] uppercase font-semibold">Artilheiro:</span>
                          <span className="text-slate-300 font-medium truncate max-w-[140px]">
                            {record.topScorerName} <strong className="text-amber-400 font-mono">({record.topScorerGoals}g)</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LIGA NACIONAL: G4 & Z4 */}
        {standings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* G4 - Libertadores */}
            <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 sm:p-4 space-y-2 shadow-sm">
              <div className="flex items-center space-x-2 text-emerald-400 border-b border-[var(--app-border-subtle)] pb-2">
                <TrendingUp className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                  Zona de Classificação Continental (G4)
                </h3>
              </div>
              <div className="space-y-1.5 pt-1">
                {g4.map((row, idx) => (
                  <div
                    key={row.clubId}
                    className={`flex items-center justify-between p-2 rounded text-xs border border-[var(--app-border-subtle)] ${
                      row.clubId === userClub.id
                        ? 'bg-[var(--app-surface-2)] text-white font-bold border-l-2'
                        : 'bg-[var(--app-surface-2)]/60 text-slate-300'
                    }`}
                    style={
                      row.clubId === userClub.id
                        ? { borderLeftColor: 'var(--app-text-accent)' }
                        : undefined
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-5 text-center font-mono font-bold text-emerald-400">{idx + 1}º</span>
                      <span>{row.clubName}</span>
                    </div>
                    <span className="font-mono font-medium text-slate-400">{row.points} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Z4 - Rebaixamento */}
            <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 sm:p-4 space-y-2 shadow-sm">
              <div className="flex items-center space-x-2 text-rose-400 border-b border-[var(--app-border-subtle)] pb-2">
                <TrendingDown className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                  Zona de Rebaixamento (Z4)
                </h3>
              </div>
              <div className="space-y-1.5 pt-1">
                {z4.map((row, idx) => (
                  <div
                    key={row.clubId}
                    className={`flex items-center justify-between p-2 rounded text-xs border border-[var(--app-border-subtle)] ${
                      row.clubId === userClub.id
                        ? 'bg-[var(--app-surface-2)] text-white font-bold border-l-2 border-l-rose-500'
                        : 'bg-[var(--app-surface-2)]/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-5 text-center font-mono font-bold text-rose-400">
                        {standings.length - 4 + idx + 1}º
                      </span>
                      <span>{row.clubName}</span>
                    </div>
                    <span className="font-mono font-medium text-slate-400">{row.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FINANCIAL SUMMARY BAR */}
        <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-950/70 border border-emerald-600/40 flex items-center justify-center text-emerald-400 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">
                Caixa Disponível para o Planejamento de {seasonYear + 1}
              </span>
              <p className="text-sm sm:text-base font-black text-white">{formatCurrency(userClub.balance)}</p>
            </div>
          </div>
          <div className="text-xs text-slate-400 text-center sm:text-right">
            Salários quitados • Mercado de transferências será reaberto na virada
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION FOOTER BAR */}
      <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md mt-2">
        <div className="text-xs text-slate-400 flex items-center space-x-1.5">
          <Calendar className="w-4 h-4 text-[var(--app-text-accent)]" />
          <span>Ao avançar, o novo calendário da temporada será formulado e os contratos atualizados.</span>
        </div>

        <button
          onClick={() => {
            sound.playClick();
            onStartNextSeason();
          }}
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--app-text-accent)] hover:brightness-110 text-slate-950 shadow-md cursor-pointer transition-all active:scale-98"
        >
          <span>Iniciar Temporada {seasonYear + 1}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default SeasonReviewScreen;
