import React, { useState, useMemo } from 'react';
import { useGame } from '../state/GameContext';
import { 
  Trophy, 
  Target, 
  Award, 
  Zap, 
  Search, 
  ArrowLeft, 
  ChevronRight, 
  DollarSign, 
  ShieldAlert, 
  Flame,
  Users
} from 'lucide-react';
import { Player, Club } from '../types';
import { sound } from '../audio/soundEngine';
import { ClubCrest } from './ClubCrest';
import { getClubTheme } from '../theme/clubTheme';

type StatTab = 'goals' | 'assists' | 'combined' | 'mvp';

interface PlayerStatRow {
  player: Player;
  club: Club;
  rank: number;
  isUserPlayer: boolean;
  matchesPlayed: number;
}

export const LeagueStatsScreen: React.FC = () => {
  const { gameState, userClub, setScreen } = useGame();
  const clubTheme = getClubTheme(userClub);
  const [activeTab, setActiveTab] = useState<StatTab>('goals');
  const [searchQuery, setSearchQuery] = useState('');

  const currentRound = gameState.currentRound;

  // Flatten all players across all division clubs
  const allDivisionPlayers = useMemo(() => {
    const list: { player: Player; club: Club }[] = [];
    for (const club of gameState.clubs) {
      for (const player of club.squad) {
        list.push({ player, club });
      }
    }
    return list;
  }, [gameState.clubs]);

  // Ranked Top 10 Scorers (Artilheiros)
  const topScorers = useMemo<PlayerStatRow[]>(() => {
    return [...allDivisionPlayers]
      .sort((a, b) => {
        if (b.player.goals !== a.player.goals) {
          return b.player.goals - a.player.goals;
        }
        if (b.player.assists !== a.player.assists) {
          return b.player.assists - a.player.assists;
        }
        return b.player.strength - a.player.strength;
      })
      .slice(0, 10)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
        isUserPlayer: item.club.id === userClub.id,
        matchesPlayed: Math.max(1, currentRound),
      }));
  }, [allDivisionPlayers, userClub.id, currentRound]);

  // Ranked Top 10 Assists (Líderes de Assistências)
  const topAssists = useMemo<PlayerStatRow[]>(() => {
    return [...allDivisionPlayers]
      .sort((a, b) => {
        if (b.player.assists !== a.player.assists) {
          return b.player.assists - a.player.assists;
        }
        if (b.player.goals !== a.player.goals) {
          return b.player.goals - a.player.goals;
        }
        return b.player.strength - a.player.strength;
      })
      .slice(0, 10)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
        isUserPlayer: item.club.id === userClub.id,
        matchesPlayed: Math.max(1, currentRound),
      }));
  }, [allDivisionPlayers, userClub.id, currentRound]);

  // Ranked Top 10 Combined (Gols + Assistências)
  const topCombined = useMemo<PlayerStatRow[]>(() => {
    return [...allDivisionPlayers]
      .sort((a, b) => {
        const totalA = a.player.goals + a.player.assists;
        const totalB = b.player.goals + b.player.assists;
        if (totalB !== totalA) return totalB - totalA;
        return b.player.goals - a.player.goals;
      })
      .slice(0, 10)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
        isUserPlayer: item.club.id === userClub.id,
        matchesPlayed: Math.max(1, currentRound),
      }));
  }, [allDivisionPlayers, userClub.id, currentRound]);

  // Ranked Top 10 Market Values
  const topValued = useMemo<PlayerStatRow[]>(() => {
    return [...allDivisionPlayers]
      .sort((a, b) => b.player.marketValue - a.player.marketValue)
      .slice(0, 10)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
        isUserPlayer: item.club.id === userClub.id,
        matchesPlayed: Math.max(1, currentRound),
      }));
  }, [allDivisionPlayers, userClub.id, currentRound]);

  // Filtered search results if user is querying a player
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allDivisionPlayers
      .filter(
        (item) =>
          item.player.name.toLowerCase().includes(q) ||
          item.club.name.toLowerCase().includes(q)
      )
      .slice(0, 15)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
        isUserPlayer: item.club.id === userClub.id,
        matchesPlayed: Math.max(1, currentRound),
      }));
  }, [allDivisionPlayers, searchQuery, userClub.id, currentRound]);

  const activeRows = useMemo(() => {
    if (searchQuery.trim()) return searchResults;
    switch (activeTab) {
      case 'goals':
        return topScorers;
      case 'assists':
        return topAssists;
      case 'combined':
        return topCombined;
      case 'mvp':
        return topValued;
    }
  }, [activeTab, searchQuery, searchResults, topScorers, topAssists, topCombined, topValued]);

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'GOL':
        return 'bg-amber-950/70 text-amber-300 border-amber-700/60';
      case 'ZAG':
      case 'LAT':
        return 'bg-blue-950/70 text-blue-300 border-blue-700/60';
      case 'VOL':
      case 'MEI':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60';
      case 'ATA':
        return 'bg-rose-950/70 text-rose-300 border-rose-700/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const totalLeagueGoals = useMemo(() => {
    return allDivisionPlayers.reduce((acc, p) => acc + p.player.goals, 0);
  }, [allDivisionPlayers]);

  const totalLeagueAssists = useMemo(() => {
    return allDivisionPlayers.reduce((acc, p) => acc + p.player.assists, 0);
  }, [allDivisionPlayers]);

  return (
    <div className="flex-1 flex flex-col bg-[var(--app-bg-deep)] p-3 sm:p-4 md:h-[calc(100vh-3.5rem)] select-none md:overflow-hidden md:min-h-0 pb-6 md:pb-0">
      {/* HEADER BANNER */}
      <div className="relative overflow-hidden bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md mb-3 shrink-0">
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: clubTheme.stripeGradient }} />
        <div className="flex items-center space-x-3">
          <button
            onClick={() => { sound.playClick(); setScreen('overview'); }}
            className="p-1.5 rounded-lg bg-[var(--app-surface-2)] hover:border-[var(--app-border-highlight)] border border-[var(--app-border-subtle)] text-slate-300 hover:text-white cursor-pointer transition-colors"
            title="Voltar à Visão Geral (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-3">
            <ClubCrest club={userClub} size="sm" />
            <div>
              <div className="flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-[var(--app-text-accent)]" />
                <h2 className="text-base font-extrabold text-white uppercase tracking-wider">
                  Estatísticas do Campeonato
                </h2>
                <span className="text-xs bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-subtle)] px-2 py-0.5 rounded-full font-mono font-bold">
                  {gameState.divisionName || 'Série A'} • Rodada {currentRound}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Rankings individuais de artilharia, assistências e valores de mercado dos {gameState.clubs.length} clubes
              </p>
            </div>
          </div>
        </div>

        {/* Global Summary Stats Badges */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] px-3 py-1.5 rounded-lg text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Gols Marcados</span>
            <span className="text-emerald-400 font-mono-numbers font-black text-sm">{totalLeagueGoals}</span>
          </div>
          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] px-3 py-1.5 rounded-lg text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Assistências</span>
            <span className="text-sky-400 font-mono-numbers font-black text-sm">{totalLeagueAssists}</span>
          </div>
          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] px-3 py-1.5 rounded-lg text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Atletas Ativos</span>
            <span className="text-amber-400 font-mono-numbers font-black text-sm">{allDivisionPlayers.length}</span>
          </div>
          <button
            onClick={() => { sound.playClick(); setScreen('champions_history'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 transition-all cursor-pointer shadow-sm"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Galeria de Campeões</span>
          </button>
        </div>
      </div>

      {/* TOOLBAR: TABS + PLAYER SEARCH */}
      <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-2 flex flex-wrap items-center justify-between gap-2 shadow-xs mb-3 shrink-0">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => { sound.playClick(); setActiveTab('goals'); setSearchQuery(''); }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'goals' && !searchQuery
                ? 'shadow-inner'
                : 'text-slate-300 hover:bg-[var(--app-surface-2)] hover:text-white'
            }`}
            style={
              activeTab === 'goals' && !searchQuery
                ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent }
                : undefined
            }
          >
            <Target className="w-3.5 h-3.5" />
            <span>⚽ 10 Maiores Artilheiros</span>
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('assists'); setSearchQuery(''); }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'assists' && !searchQuery
                ? 'shadow-inner'
                : 'text-slate-300 hover:bg-[var(--app-surface-2)] hover:text-white'
            }`}
            style={
              activeTab === 'assists' && !searchQuery
                ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent }
                : undefined
            }
          >
            <Zap className="w-3.5 h-3.5" />
            <span>🎯 Líderes de Assistências</span>
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('combined'); setSearchQuery(''); }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'combined' && !searchQuery
                ? 'shadow-inner'
                : 'text-slate-300 hover:bg-[var(--app-surface-2)] hover:text-white'
            }`}
            style={
              activeTab === 'combined' && !searchQuery
                ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent }
                : undefined
            }
          >
            <Award className="w-3.5 h-3.5" />
            <span>⭐ Participação em Gols (G+A)</span>
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('mvp'); setSearchQuery(''); }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'mvp' && !searchQuery
                ? 'shadow-inner'
                : 'text-slate-300 hover:bg-[var(--app-surface-2)] hover:text-white'
            }`}
            style={
              activeTab === 'mvp' && !searchQuery
                ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent }
                : undefined
            }
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>💎 Mais Valiosos</span>
          </button>
        </div>

        {/* Search Player across all teams */}
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar atleta na divisão..."
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

      {/* STATS LEADERBOARD TABLE */}
      <div className="flex-1 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-lg">
        {/* Table title info */}
        <div className="px-4 py-2.5 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {searchQuery
                ? `Resultados da busca por "${searchQuery}" (${searchResults.length})`
                : activeTab === 'goals'
                ? 'Tabela de Artilharia Global • Top 10 Goleadores'
                : activeTab === 'assists'
                ? 'Líderes de Assistências da Liga • Top 10 Garçons'
                : activeTab === 'combined'
                ? 'Participações Diretas em Gols • Top 10 (Gols + Assistências)'
                : 'Atletas Mais Valiosos do Campeonato Nacional'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono-numbers">
            {activeRows.length} Atletas Listados
          </span>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto">
          {activeRows.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhum jogador encontrado com os critérios de busca selecionados.
            </div>
          ) : (
            <table className="w-full text-left text-xs brasfoot-table border-collapse">
              <thead>
                <tr className="sticky top-0 z-10 bg-[var(--app-surface-2)] text-slate-400 border-b border-[var(--app-border-subtle)]">
                  <th className="w-12 text-center py-2">Pos</th>
                  <th className="py-2">Atleta</th>
                  <th className="w-16 text-center py-2">Posição</th>
                  <th className="w-16 text-center py-2">Força</th>
                  <th className="w-14 text-center py-2">Idade</th>
                  <th className="py-2">Clube</th>
                  <th className="w-20 text-center py-2 bg-[var(--app-surface-1)] text-[var(--app-text-accent)] font-bold">
                    {activeTab === 'goals' ? 'Gols ⚽' : activeTab === 'assists' ? 'Passes 🎯' : activeTab === 'combined' ? 'G + A ⭐' : 'Valor 💰'}
                  </th>
                  <th className="w-16 text-center py-2">
                    {activeTab === 'goals' ? 'Assists' : activeTab === 'assists' ? 'Gols' : 'Gols'}
                  </th>
                  <th className="w-20 text-center py-2">Média/J</th>
                  <th className="w-28 text-right pr-4 py-2">Valor de Mercado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border-subtle)] font-mono-numbers">
                {activeRows.map((row) => {
                  const p = row.player;
                  const c = row.club;
                  const rank = row.rank;

                  // Rank Badge
                  let rankElement = (
                    <span className="font-bold text-slate-400 text-xs">{rank}º</span>
                  );
                  if (rank === 1) {
                    rankElement = (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-black font-extrabold text-xs shadow-xs" title="1º Lugar (Ouro)">
                        🥇
                      </span>
                    );
                  } else if (rank === 2) {
                    rankElement = (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-black font-extrabold text-xs shadow-xs" title="2º Lugar (Prata)">
                        🥈
                      </span>
                    );
                  } else if (rank === 3) {
                    rankElement = (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-extrabold text-xs shadow-xs" title="3º Lugar (Bronze)">
                        🥉
                      </span>
                    );
                  }

                  const primaryMetric =
                    activeTab === 'goals'
                      ? p.goals
                      : activeTab === 'assists'
                      ? p.assists
                      : activeTab === 'combined'
                      ? p.goals + p.assists
                      : formatMoney(p.marketValue);

                  const secondaryMetric = activeTab === 'goals' ? p.assists : p.goals;

                  const metricPerMatch =
                    activeTab === 'goals'
                      ? (p.goals / row.matchesPlayed).toFixed(2)
                      : activeTab === 'assists'
                      ? (p.assists / row.matchesPlayed).toFixed(2)
                      : ((p.goals + p.assists) / row.matchesPlayed).toFixed(2);

                  return (
                    <tr
                      key={`${c.id}-${p.id}`}
                      className={`transition-colors ${
                        row.isUserPlayer
                          ? 'font-bold shadow-xs'
                          : 'text-slate-300 hover:bg-[var(--app-surface-2)]'
                      }`}
                      style={
                        row.isUserPlayer
                          ? {
                              borderLeft: `4px solid ${clubTheme.primaryAccent}`,
                              backgroundColor: clubTheme.subtleBg,
                            }
                          : undefined
                      }
                    >
                      {/* Rank */}
                      <td className="text-center py-2">{rankElement}</td>

                      {/* Player Name */}
                      <td className="py-2 font-sans">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-xs truncate max-w-[180px]">
                            {p.name}
                          </span>
                          {row.isUserPlayer && (
                            <span
                              className="text-[9px] px-1.5 py-0.2 rounded font-black uppercase tracking-tight shrink-0 shadow-xs"
                              style={{
                                backgroundColor: clubTheme.primaryAccent,
                                color: clubTheme.onPrimaryAccent,
                              }}
                            >
                              SEU ATLETA
                            </span>
                          )}
                          {p.isStar && (
                            <span className="text-[10px] text-amber-400 font-bold" title="Estrela do time">
                              ★
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans flex items-center space-x-1.5">
                          <span>{p.skill1}</span>
                          <span>•</span>
                          <span>{p.skill2}</span>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="text-center py-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-bold ${getPositionColor(
                            p.position
                          )}`}
                        >
                          {p.position}
                        </span>
                      </td>

                      {/* Strength */}
                      <td className="text-center py-2">
                        <span className="font-bold text-white text-xs bg-[var(--app-surface-2)] px-2 py-0.5 rounded border border-[var(--app-border-subtle)]">
                          {p.strength}
                        </span>
                      </td>

                      {/* Age */}
                      <td className="text-center py-2 text-slate-400 text-xs">
                        {p.age} anos
                      </td>

                      {/* Club */}
                      <td className="py-2 font-sans">
                        <div className="flex items-center space-x-2">
                          <ClubCrest club={c} size="sm" preferMini={true} />
                          <span className="truncate max-w-[140px] text-slate-200 font-medium">
                            {c.name}
                          </span>
                        </div>
                      </td>

                      {/* Primary Metric Badge */}
                      <td className="text-center py-2 bg-[var(--app-surface-2)] font-bold text-sm text-[var(--app-text-accent)]">
                        {primaryMetric}
                      </td>

                      {/* Secondary Metric */}
                      <td className="text-center py-2 text-slate-400 text-xs">
                        {secondaryMetric}
                      </td>

                      {/* Average / Match */}
                      <td className="text-center py-2 text-slate-300 text-xs">
                        {metricPerMatch}
                      </td>

                      {/* Market Value */}
                      <td className="text-right pr-4 py-2 text-slate-300 font-semibold text-xs">
                        {formatMoney(p.marketValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
