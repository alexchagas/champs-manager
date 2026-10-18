import React, { useMemo, useState } from 'react';
import { Trophy, Award, ArrowRight, ShieldCheck, TrendingUp, TrendingDown, DollarSign, Calendar, Medal } from 'lucide-react';
import type { GameState, ChampionshipRecord, StandingRow, Club } from '../types/index';
import { ClubCrest } from './ClubCrest';
import { getClubTheme } from '../theme/clubTheme';
import { sound } from '../audio/soundEngine';
import { detectNewlyCompletedCompetitions } from '../engine/tournamentCompletion';
import { getNationalStandingsForDivision } from '../engine/sportsMobility';

interface Props {
  gameState: GameState;
  onStartNextSeason: () => void;
}

export const SeasonReviewScreen: React.FC<Props> = ({ gameState, onStartNextSeason }) => {
  const seasonYear = gameState.seasonYear;

  const userClub = useMemo(() => {
    return gameState.clubs.find(c => c.id === gameState.userClubId) || gameState.clubs[0];
  }, [gameState.clubs, gameState.userClubId]);

  const clubTheme = useMemo(() => getClubTheme(userClub), [userClub]);

  // Combine championshipHistory with any newly detected completions so that
  // parallel national divisions, state divisions, and continental cups are never omitted.
  const history = useMemo(() => {
    const existing = (gameState.championshipHistory || []).filter(h => h.seasonYear === seasonYear);
    const newlyDetected = detectNewlyCompletedCompetitions(gameState);
    const existingIds = new Set(existing.map(h => h.id));
    const combined = [...existing];
    for (const record of newlyDetected) {
      if (!existingIds.has(record.id)) {
        combined.push(record);
      }
    }
    return combined;
  }, [gameState, seasonYear]);

  // Build all available league tabs across the multidivision ecosystem
  const availableTabs = useMemo(() => {
    const tabs: Array<{
      id: string;
      label: string;
      fullName: string;
      standings: StandingRow[];
      division?: number;
      type: 'nacional' | 'estadual' | 'continental';
    }> = [];

    const isBrazil = (userClub.countryId || 29) === 29;

    if (isBrazil) {
      // 4 Brazilian National Divisions
      const divisions = [
        { div: 1, label: 'Série A', name: 'Brasileirão Série A' },
        { div: 2, label: 'Série B', name: 'Brasileirão Série B' },
        { div: 3, label: 'Série C', name: 'Brasileirão Série C' },
        { div: 4, label: 'Série D', name: 'Brasileirão Série D' },
      ];

      for (const d of divisions) {
        const rows = getNationalStandingsForDivision(gameState, d.div);
        if (rows && rows.length > 0) {
          tabs.push({
            id: `nacional-div${d.div}`,
            label: d.label,
            fullName: d.name,
            standings: rows,
            division: d.div,
            type: 'nacional',
          });
        }
      }
    } else {
      // Non-Brazil active league + nationalDivisions
      const userRows = gameState.standingsNacional || gameState.standings || [];
      if (userRows.length > 0) {
        tabs.push({
          id: 'nacional-user',
          label: gameState.divisionName || 'Liga Principal',
          fullName: gameState.nationalLeagueName || gameState.leagueName || 'Campeonato Nacional',
          standings: userRows,
          division: userClub.division ?? 1,
          type: 'nacional',
        });
      }
      if (gameState.nationalDivisions) {
        for (const nd of gameState.nationalDivisions) {
          if (nd.standings && nd.standings.length > 0) {
            tabs.push({
              id: `nacional-div${nd.division}`,
              label: `Divisão ${nd.division}`,
              fullName: nd.leagueName,
              standings: nd.standings,
              division: nd.division,
              type: 'nacional',
            });
          }
        }
      }
    }

    // Estadual (User + Parallel)
    const userEstadualRows = gameState.standingsEstadual || (gameState.calendar?.some(f => f.competitionType === 'estadual') ? gameState.standings : []);
    if (userEstadualRows && userEstadualRows.length > 0) {
      tabs.push({
        id: 'estadual-user',
        label: 'Estadual',
        fullName: gameState.stateChampionshipName || 'Campeonato Estadual',
        standings: userEstadualRows,
        type: 'estadual',
      });
    }
    if (gameState.stateDivisions) {
      for (const sd of gameState.stateDivisions) {
        if (sd.standings && sd.standings.length > 0) {
          tabs.push({
            id: `estadual-div${sd.division}`,
            label: sd.leagueName,
            fullName: sd.leagueName,
            standings: sd.standings,
            type: 'estadual',
          });
        }
      }
    }

    // Continentais
    if (gameState.standingsContinental && gameState.standingsContinental.length > 0) {
      tabs.push({
        id: 'continental-user',
        label: gameState.continentalCupName?.includes('Sul-Americana') ? 'Sul-Americana' : 'Libertadores',
        fullName: gameState.continentalCupName || 'Copa Libertadores',
        standings: gameState.standingsContinental,
        type: 'continental',
      });
    }
    if (gameState.continentalCompetitions) {
      for (const cc of gameState.continentalCompetitions) {
        if (cc.standings && cc.standings.length > 0) {
          const isSula = cc.leagueName.includes('Sul-Americana');
          tabs.push({
            id: `continental-${cc.id}`,
            label: isSula ? 'Sul-Americana' : 'Libertadores',
            fullName: cc.leagueName,
            standings: cc.standings,
            type: 'continental',
          });
        }
      }
    }

    return tabs;
  }, [gameState, userClub]);

  const defaultTabId = useMemo(() => {
    const userTab = availableTabs.find(t => t.standings.some(s => s.clubId === userClub.id));
    return userTab ? userTab.id : (availableTabs[0]?.id || '');
  }, [availableTabs, userClub.id]);

  const [selectedTabId, setSelectedTabId] = useState<string>(defaultTabId);

  const currentTab = useMemo(() => {
    return availableTabs.find(t => t.id === selectedTabId) ||
      availableTabs.find(t => t.id === defaultTabId) ||
      availableTabs[0];
  }, [availableTabs, selectedTabId, defaultTabId]);

  const currentStandings = useMemo(() => currentTab?.standings || [], [currentTab]);

  const userStandingInCurrentTab = useMemo(() => {
    return currentStandings.find(s => s.clubId === userClub.id);
  }, [currentStandings, userClub.id]);

  const userRankInCurrentTab = useMemo(() => {
    return userStandingInCurrentTab ? currentStandings.indexOf(userStandingInCurrentTab) + 1 : undefined;
  }, [currentStandings, userStandingInCurrentTab]);

  // Overall user rank in their primary national division
  const userPrimaryStandings = useMemo(() => {
    return gameState.standingsNacional || gameState.standings || [];
  }, [gameState.standingsNacional, gameState.standings]);

  const userPrimaryStanding = useMemo(() => {
    return userPrimaryStandings.find(s => s.clubId === userClub.id);
  }, [userPrimaryStandings, userClub.id]);

  const userPositionOverall = useMemo(() => {
    return userPrimaryStanding ? userPrimaryStandings.indexOf(userPrimaryStanding) + 1 : undefined;
  }, [userPrimaryStandings, userPrimaryStanding]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  const getClubData = (clubId: number, fallbackName: string, fallbackCrest?: string): Partial<Club> => {
    const found = gameState.clubs.find(c => c.id === clubId);
    if (found) return found;
    return { name: fallbackName, crestUrl: fallbackCrest };
  };

  // Badging helper for standings table
  const getRowZone = (index: number, total: number, division?: number, type?: string) => {
    const pos = index + 1;
    if (type === 'nacional') {
      if (division === 1) {
        if (pos <= 4) return { bg: 'bg-emerald-950/70 border-l-2 border-l-emerald-500 text-emerald-300', tag: 'Libertadores' };
        if (pos <= 6) return { bg: 'bg-blue-950/70 border-l-2 border-l-blue-500 text-blue-300', tag: 'Pré-Libertadores' };
        if (pos <= 12) return { bg: 'bg-amber-950/60 border-l-2 border-l-amber-500 text-amber-300', tag: 'Sul-Americana' };
        if (pos > total - 4) return { bg: 'bg-rose-950/70 border-l-2 border-l-rose-500 text-rose-300', tag: 'Rebaixamento Série B' };
      } else if (division === 2) {
        if (pos <= 4) return { bg: 'bg-emerald-950/70 border-l-2 border-l-emerald-500 text-emerald-300', tag: 'Acesso à Série A' };
        if (pos > total - 4) return { bg: 'bg-rose-950/70 border-l-2 border-l-rose-500 text-rose-300', tag: 'Rebaixamento Série C' };
      } else if (division === 3) {
        if (pos <= 4) return { bg: 'bg-emerald-950/70 border-l-2 border-l-emerald-500 text-emerald-300', tag: 'Acesso à Série B' };
        if (pos > total - 4) return { bg: 'bg-rose-950/70 border-l-2 border-l-rose-500 text-rose-300', tag: 'Rebaixamento Série D' };
      } else if (division === 4) {
        if (pos <= 4) return { bg: 'bg-emerald-950/70 border-l-2 border-l-emerald-500 text-emerald-300', tag: 'Acesso à Série C' };
      }
    } else if (type === 'estadual') {
      if (pos <= 4) return { bg: 'bg-emerald-950/70 border-l-2 border-l-emerald-500 text-emerald-300', tag: 'Fase Final' };
      if (pos > total - 2) return { bg: 'bg-rose-950/70 border-l-2 border-l-rose-500 text-rose-300', tag: 'Rebaixamento' };
    } else if (type === 'continental') {
      if (pos === 1) return { bg: 'bg-emerald-950/70 border-l-2 border-l-emerald-500 text-emerald-300', tag: 'Campeão' };
      if (pos === 2) return { bg: 'bg-slate-800/80 border-l-2 border-l-slate-400 text-slate-200', tag: 'Vice-campeão' };
    }
    return { bg: '', tag: '' };
  };

  const g4 = useMemo(() => currentStandings.slice(0, 4), [currentStandings]);
  const z4 = useMemo(() => currentStandings.length > 4 ? currentStandings.slice(-4) : [], [currentStandings]);

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
              Todos os campeonatos foram finalizados. Confira os campeões, artilheiros e tabelas completas de todas as divisões.
            </p>
          </div>
        </div>

        {/* Club Quick Summary */}
        <div className="flex items-center space-x-2 sm:space-x-3 text-xs ml-auto sm:ml-0">
          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] px-3 py-1.5 rounded-lg text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Sua Classificação</span>
            <span className="text-emerald-400 font-mono font-black text-sm">
              {userPositionOverall ? `${userPositionOverall}º Lugar` : 'Concluída'}
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

        {/* TABELAS DAS DIVISÕES (MULTIDIVISÃO EXPLORER) */}
        {availableTabs.length > 0 && (
          <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 sm:p-4 space-y-3 shadow-sm">
            {/* TAB SELECTOR HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--app-border-subtle)] pb-2.5">
              <div className="flex items-center space-x-2">
                <Medal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
                  Tabelas de Classificação Final
                </h3>
              </div>
              {/* Tab Navigation Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {availableTabs.map((tab) => {
                  const isActive = (currentTab?.id || availableTabs[0].id) === tab.id;
                  const containsUserClub = tab.standings.some(s => s.clubId === userClub.id);

                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        sound.playClick();
                        setSelectedTabId(tab.id);
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-[var(--app-text-accent)] text-slate-950 shadow-sm'
                          : 'bg-[var(--app-surface-2)] text-slate-300 hover:text-white hover:bg-[var(--app-surface-2)]/80 border border-[var(--app-border-subtle)]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {containsUserClub && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-slate-950' : 'bg-emerald-400'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* LEAGUE HEADER & ACTIVE TAB STANDINGS */}
            {currentTab && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold text-slate-200 uppercase tracking-wider">
                    {currentTab.fullName}
                  </span>
                  <span className="font-mono">
                    {currentStandings.length} clubes participantes
                  </span>
                </div>

                {/* FULL STANDINGS TABLE */}
                <div className="overflow-x-auto rounded-lg border border-[var(--app-border-subtle)]">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[var(--app-surface-2)] text-slate-400 uppercase font-mono text-[10px] border-b border-[var(--app-border-subtle)]">
                        <th className="py-2 px-2.5 w-10 text-center">#</th>
                        <th className="py-2 px-3">Clube</th>
                        <th className="py-2 px-2.5 text-center font-bold text-slate-200">P</th>
                        <th className="py-2 px-2 text-center">J</th>
                        <th className="py-2 px-2 text-center">V</th>
                        <th className="py-2 px-2 text-center">E</th>
                        <th className="py-2 px-2 text-center">D</th>
                        <th className="py-2 px-2 text-center">GP</th>
                        <th className="py-2 px-2 text-center">GC</th>
                        <th className="py-2 px-2 text-center">SG</th>
                        <th className="py-2 px-2.5 text-center">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--app-border-subtle)]/40 font-mono">
                      {currentStandings.map((row, idx) => {
                        const isUserRow = row.clubId === userClub.id;
                        const clubData = getClubData(row.clubId, row.clubName);
                        const zone = getRowZone(idx, currentStandings.length, currentTab.division, currentTab.type);
                        const pct = row.matchesPlayed > 0 ? Math.round((row.points / (row.matchesPlayed * 3)) * 100) : 0;

                        return (
                          <tr
                            key={row.clubId}
                            className={`transition-colors ${
                              isUserRow
                                ? 'bg-[var(--app-surface-2)] font-bold text-white shadow-inner'
                                : idx % 2 === 0
                                ? 'bg-transparent text-slate-300'
                                : 'bg-[var(--app-surface-2)]/30 text-slate-300'
                            } ${zone.bg}`}
                          >
                            <td className="py-2 px-2.5 text-center font-bold">
                              {idx + 1}º
                            </td>
                            <td className="py-2 px-3 font-sans">
                              <div className="flex items-center space-x-2">
                                <ClubCrest club={clubData} size="xs" preferMini={true} />
                                <span className={`truncate max-w-[160px] sm:max-w-[240px] ${isUserRow ? 'text-[var(--app-text-accent)] font-black' : ''}`}>
                                  {row.clubName}
                                </span>
                                {isUserRow && (
                                  <span className="text-[9px] px-1 py-0.2 rounded font-bold uppercase bg-[var(--app-text-accent)] text-slate-950 font-mono">
                                    VOCÊ
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-center font-bold text-white">
                              {row.points}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-400">
                              {row.matchesPlayed}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-300">
                              {row.won}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-300">
                              {row.drawn}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-300">
                              {row.lost}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-400">
                              {row.goalsFor}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-400">
                              {row.goalsAgainst}
                            </td>
                            <td className={`py-2 px-2 text-center font-medium ${row.goalDiff > 0 ? 'text-emerald-400' : row.goalDiff < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                              {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                            </td>
                            <td className="py-2 px-2.5 text-center text-slate-400 text-[11px]">
                              {pct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* CONTEXTUAL G4 & Z4 CARDS FOR THE SELECTED TAB */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* G4 / Top Section */}
                  <div className="bg-[var(--app-surface-2)]/50 border border-[var(--app-border-subtle)] rounded-lg p-3 space-y-2">
                    <div className="flex items-center space-x-2 text-emerald-400 border-b border-[var(--app-border-subtle)] pb-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        {currentTab.division === 1
                          ? 'Zona de Classificação Continental (G4)'
                          : currentTab.type === 'nacional'
                          ? `Zona de Acesso à Série ${currentTab.division === 2 ? 'A' : currentTab.division === 3 ? 'B' : 'C'} (G4)`
                          : 'Zona de Classificação (G4)'}
                      </h4>
                    </div>
                    <div className="space-y-1 pt-0.5">
                      {g4.map((row, idx) => (
                        <div
                          key={row.clubId}
                          className={`flex items-center justify-between p-1.5 rounded text-xs border border-[var(--app-border-subtle)]/60 ${
                            row.clubId === userClub.id
                              ? 'bg-[var(--app-surface-2)] text-white font-bold border-l-2 border-l-[var(--app-text-accent)]'
                              : 'bg-[var(--app-surface-1)] text-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="w-5 text-center font-mono font-bold text-emerald-400">{idx + 1}º</span>
                            <span className="truncate max-w-[180px]">{row.clubName}</span>
                          </div>
                          <span className="font-mono font-medium text-slate-400">{row.points} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Z4 / Relegation Section (if division has relegation) */}
                  {currentTab.division !== 4 && z4.length > 0 && (
                    <div className="bg-[var(--app-surface-2)]/50 border border-[var(--app-border-subtle)] rounded-lg p-3 space-y-2">
                      <div className="flex items-center space-x-2 text-rose-400 border-b border-[var(--app-border-subtle)] pb-1.5">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                          {currentTab.division === 1
                            ? 'Zona de Rebaixamento para Série B (Z4)'
                            : currentTab.division === 2
                            ? 'Zona de Rebaixamento para Série C (Z4)'
                            : currentTab.division === 3
                            ? 'Zona de Rebaixamento para Série D (Z4)'
                            : 'Zona de Rebaixamento'}
                        </h4>
                      </div>
                      <div className="space-y-1 pt-0.5">
                        {z4.map((row, idx) => (
                          <div
                            key={row.clubId}
                            className={`flex items-center justify-between p-1.5 rounded text-xs border border-[var(--app-border-subtle)]/60 ${
                              row.clubId === userClub.id
                                ? 'bg-[var(--app-surface-2)] text-white font-bold border-l-2 border-l-rose-500'
                                : 'bg-[var(--app-surface-1)] text-slate-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <span className="w-5 text-center font-mono font-bold text-rose-400">
                                {currentStandings.length - 4 + idx + 1}º
                              </span>
                              <span className="truncate max-w-[180px]">{row.clubName}</span>
                            </div>
                            <span className="font-mono font-medium text-slate-400">{row.points} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentTab.division === 4 && (
                    <div className="bg-[var(--app-surface-2)]/50 border border-[var(--app-border-subtle)] rounded-lg p-3 space-y-2 flex flex-col justify-center text-center">
                      <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Estrutura Sem Rebaixamento Nacional
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Na Série D, os 4 melhores colocados conquistam o acesso à Série C. As vagas da próxima edição são definidas pelos campeonatos estaduais.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
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
