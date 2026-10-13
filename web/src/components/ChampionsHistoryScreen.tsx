import React, { useState, useMemo } from 'react';
import { Trophy, ArrowLeft, Search, Calendar, Award, Shield, Star, Users } from 'lucide-react';
import type { GameState, ChampionshipRecord, Club } from '../types/index';
import { ClubCrest } from './ClubCrest';
import { getClubTheme } from '../theme/clubTheme';
import { sound } from '../audio/soundEngine';

interface Props {
  gameState: GameState;
  onBack: () => void;
}

export const ChampionsHistoryScreen: React.FC<Props> = ({ gameState, onBack }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const history = useMemo(() => gameState.championshipHistory || [], [gameState.championshipHistory]);
  const userClub = useMemo(() => {
    return gameState.clubs.find(c => c.id === gameState.userClubId) || gameState.clubs[0];
  }, [gameState.clubs, gameState.userClubId]);

  const clubTheme = useMemo(() => getClubTheme(userClub), [userClub]);

  // Quick stats
  const userTitlesCount = useMemo(() => {
    return history.filter(h => h.championClubId === userClub?.id).length;
  }, [history, userClub?.id]);

  const userRunnerUpsCount = useMemo(() => {
    return history.filter(h => h.runnerUpClubId === userClub?.id).length;
  }, [history, userClub?.id]);

  const totalSeasonsTracked = useMemo(() => {
    const seasons = new Set(history.map(h => h.seasonYear));
    return seasons.size;
  }, [history]);

  // Filtered and sorted records
  const filteredHistory = useMemo(() => {
    return history.filter(record => {
      // Type filter
      if (filterType === 'user') {
        if (record.championClubId !== userClub?.id) return false;
      } else if (filterType === 'nacional') {
        if (record.competitionType !== 'nacional') return false;
      } else if (filterType === 'continental') {
        if (!['libertadores', 'sulamericana', 'champions'].includes(record.competitionType)) return false;
      } else if (filterType === 'copa') {
        if (record.competitionType !== 'copa') return false;
      } else if (filterType === 'estadual') {
        if (record.competitionType !== 'estadual') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesComp = record.competitionName.toLowerCase().includes(q);
        const matchesChamp = record.championClubName.toLowerCase().includes(q);
        const matchesRunner = record.runnerUpClubName.toLowerCase().includes(q);
        const matchesYear = record.seasonYear.toString().includes(q);
        const matchesScorer = record.topScorerName?.toLowerCase().includes(q);
        if (!matchesComp && !matchesChamp && !matchesRunner && !matchesYear && !matchesScorer) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => b.seasonYear - a.seasonYear || a.competitionName.localeCompare(b.competitionName));
  }, [history, filterType, searchQuery, userClub?.id]);

  const getClubData = (clubId: number, fallbackName: string, fallbackCrest?: string): Partial<Club> => {
    const found = gameState.clubs.find(c => c.id === clubId);
    if (found) return found;
    return { name: fallbackName, crestUrl: fallbackCrest };
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--app-bg-deep)] p-2 sm:p-4 h-[calc(100vh-3.5rem)] select-none overflow-hidden">
      {/* HEADER BANNER */}
      <div className="relative overflow-hidden bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md mb-2 shrink-0">
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: clubTheme.stripeGradient }} />
        
        {/* Left: Back button + Title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              sound.playClick();
              onBack();
            }}
            className="p-1.5 rounded-lg bg-[var(--app-surface-2)] hover:border-[var(--app-border-highlight)] border border-[var(--app-border-subtle)] text-slate-300 hover:text-white cursor-pointer transition-colors"
            title="Voltar à Visão Geral (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-extrabold text-white uppercase tracking-wider">
                  Galeria de Campeões & Títulos
                </h2>
                <span className="text-xs bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-subtle)] px-2 py-0.5 rounded-full font-mono font-bold">
                  {history.length} {history.length === 1 ? 'Título' : 'Títulos Arquivados'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Histórico de campeões, vices e artilheiros de todas as competições disputadas na carreira
              </p>
            </div>
          </div>
        </div>

        {/* Right: Summary badges */}
        <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] px-3 py-1.5 rounded-lg text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Seus Títulos</span>
            <span className="text-amber-400 font-mono font-black text-sm">{userTitlesCount}</span>
          </div>
          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] px-3 py-1.5 rounded-lg text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Seus Vices</span>
            <span className="text-slate-300 font-mono font-black text-sm">{userRunnerUpsCount}</span>
          </div>
          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] px-3 py-1.5 rounded-lg text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Temporadas</span>
            <span className="text-[var(--app-text-accent)] font-mono font-black text-sm">{totalSeasonsTracked}</span>
          </div>
        </div>
      </div>

      {/* TOOLBAR: FILTER TABS + SEARCH */}
      <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-2 flex flex-wrap items-center justify-between gap-2 shadow-xs mb-2 shrink-0">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'user', label: '⭐ Meus Títulos' },
            { id: 'nacional', label: 'Nacional' },
            { id: 'continental', label: 'Continentais' },
            { id: 'copa', label: 'Copas' },
            { id: 'estadual', label: 'Estaduais' },
          ].map(tab => {
            const isActive = filterType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  sound.playClick();
                  setFilterType(tab.id);
                }}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--app-text-accent)] text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:bg-[var(--app-surface-2)] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por clube, torneio ou ano..."
            className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] rounded pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[var(--app-border-highlight)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA: TABLE & LIST */}
      <div className="flex-1 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-lg min-h-0">
        {filteredHistory.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--app-surface-2)] text-amber-400/80 flex items-center justify-center border border-[var(--app-border-subtle)]">
              <Trophy className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-200">
              {searchQuery ? 'Nenhum título encontrado para esta busca' : 'Nenhum título arquivado ainda'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md">
              {searchQuery
                ? 'Tente buscar com outro nome de clube, competição ou ano de temporada.'
                : 'Assim que as finais forem disputadas nesta temporada, os campeões, vices e artilheiros ficarão registrados para sempre nesta galeria.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Desktop Table View */}
            <table className="w-full text-left border-collapse hidden md:table">
              <thead className="sticky top-0 z-10 bg-[var(--app-surface-2)] text-[10px] text-slate-400 uppercase tracking-wider border-b border-[var(--app-border-subtle)] select-none">
                <tr>
                  <th className="py-2.5 px-4 font-bold w-20 text-center">Ano</th>
                  <th className="py-2.5 px-4 font-bold">Competição</th>
                  <th className="py-2.5 px-4 font-bold">Campeão 🏆</th>
                  <th className="py-2.5 px-4 font-bold text-center">Decisão</th>
                  <th className="py-2.5 px-4 font-bold">Vice-Campeão 🥈</th>
                  <th className="py-2.5 px-4 font-bold">Artilheiro ⚽</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border-subtle)]/50 text-xs">
                {filteredHistory.map((record) => {
                  const isUserWinner = record.championClubId === userClub?.id;
                  const isUserRunner = record.runnerUpClubId === userClub?.id;
                  const champData = getClubData(record.championClubId, record.championClubName, record.championClubCrest);
                  const runnerData = getClubData(record.runnerUpClubId, record.runnerUpClubName, record.runnerUpClubCrest);

                  return (
                    <tr
                      key={record.id}
                      className={`transition-colors ${
                        isUserWinner
                          ? 'bg-[var(--app-surface-2)]/80 hover:bg-[var(--app-surface-2)] font-semibold'
                          : 'hover:bg-[var(--app-surface-2)]/50'
                      }`}
                      style={
                        isUserWinner
                          ? { borderLeft: '3px solid var(--app-text-accent)' }
                          : undefined
                      }
                    >
                      {/* Year */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-amber-300">
                        {record.seasonYear}
                      </td>

                      {/* Tournament */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-xs">
                            {record.competitionName}
                          </span>
                          {isUserWinner && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[var(--app-text-accent)] text-slate-950">
                              Seu Título
                            </span>
                          )}
                          {isUserRunner && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--app-surface-2)] text-slate-300 border border-[var(--app-border-subtle)]">
                              Seu Vice
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Champion */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <ClubCrest club={champData} size="sm" preferMini={true} />
                          <span className={`font-bold ${isUserWinner ? 'text-[var(--app-text-accent)]' : 'text-slate-100'}`}>
                            {record.championClubName}
                          </span>
                        </div>
                      </td>

                      {/* Decision Score */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono text-xs text-amber-300 bg-[var(--app-bg-deep)] px-2 py-0.5 rounded border border-[var(--app-border-subtle)]">
                          {record.finalScoreText || 'Campeão'}
                        </span>
                      </td>

                      {/* Runner-up */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <ClubCrest club={runnerData} size="sm" preferMini={true} />
                          <span className="text-slate-300 font-medium">
                            {record.runnerUpClubName}
                          </span>
                        </div>
                      </td>

                      {/* Top Scorer */}
                      <td className="py-3 px-4">
                        {record.topScorerName ? (
                          <div className="flex items-center space-x-1.5 text-slate-300">
                            <span className="font-medium">{record.topScorerName}</span>
                            <span className="text-amber-400 font-mono font-bold text-[11px]">
                              ({record.topScorerGoals}g)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Card View (< md) */}
            <div className="md:hidden divide-y divide-[var(--app-border-subtle)]">
              {filteredHistory.map((record) => {
                const isUserWinner = record.championClubId === userClub?.id;
                const isUserRunner = record.runnerUpClubId === userClub?.id;
                const champData = getClubData(record.championClubId, record.championClubName, record.championClubCrest);
                const runnerData = getClubData(record.runnerUpClubId, record.runnerUpClubName, record.runnerUpClubCrest);

                return (
                  <div
                    key={record.id}
                    className={`p-3 space-y-2.5 ${
                      isUserWinner ? 'bg-[var(--app-surface-2)]/60' : ''
                    }`}
                    style={
                      isUserWinner
                        ? { borderLeft: '3px solid var(--app-text-accent)' }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-amber-300 bg-[var(--app-bg-deep)] px-2 py-0.5 rounded border border-[var(--app-border-subtle)]">
                          {record.seasonYear}
                        </span>
                        <span className="text-xs font-bold text-white">
                          {record.competitionName}
                        </span>
                      </div>
                      {isUserWinner && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[var(--app-text-accent)] text-slate-950">
                          Seu Título
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs bg-[var(--app-surface-2)] p-2 rounded-lg border border-[var(--app-border-subtle)]">
                      {/* Champion */}
                      <div className="flex items-center space-x-2">
                        <ClubCrest club={champData} size="sm" preferMini={true} />
                        <div>
                          <span className="text-[10px] uppercase font-bold text-amber-400 block leading-tight">Campeão 🏆</span>
                          <span className="font-bold text-white leading-tight">{record.championClubName}</span>
                        </div>
                      </div>

                      <div className="text-center font-mono text-[11px] text-amber-300 px-2 py-0.5 bg-[var(--app-bg-deep)] rounded border border-[var(--app-border-subtle)]">
                        {record.finalScoreText || '—'}
                      </div>

                      {/* Runner-up */}
                      <div className="flex items-center space-x-2">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Vice 🥈</span>
                          <span className="font-medium text-slate-200 leading-tight">{record.runnerUpClubName}</span>
                        </div>
                        <ClubCrest club={runnerData} size="sm" preferMini={true} />
                      </div>
                    </div>

                    {record.topScorerName && (
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                        <span>Artilheiro:</span>
                        <span className="font-medium text-slate-200">
                          {record.topScorerName} <strong className="text-amber-400 font-mono">({record.topScorerGoals}g)</strong>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChampionsHistoryScreen;
