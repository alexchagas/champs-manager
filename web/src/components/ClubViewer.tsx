import React, { useState, useMemo } from 'react';
import { useGame } from '../state/GameContext';
import { ClubCrest } from './ClubCrest';
import { getClubTheme, deriveClubAtmosphere } from '../theme/clubTheme';
import { getAllClubs, getClubById } from '../data/teamsDatabase';
import type { Club, Player, Position, GameState } from '../types';
import { 
  ArrowLeft, 
  X, 
  Trophy, 
  Building2, 
  User, 
  Users,
  Star, 
  Zap, 
  Search, 
  Shield, 
  TrendingUp, 
  Activity, 
  Eye, 
  Flame, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { sound } from '../audio/soundEngine';

import { 
  groupSquadBySector, 
  getClubCampaign, 
  type SectorGroup, 
  type ClubCampaignSummary 
} from '../engine/clubViewer';

export { groupSquadBySector, getClubCampaign, type SectorGroup, type ClubCampaignSummary };

export interface ClubViewerProps {
  clubId?: number;
  onClose?: () => void;
}

export const ClubViewer: React.FC<ClubViewerProps> = ({ clubId: propClubId, onClose: propOnClose }) => {
  const { gameState, viewedClubId, closeClubViewer } = useGame();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [mobileTab, setMobileTab] = useState<'squad' | 'campaign'>('squad');

  const targetClubId = propClubId ?? viewedClubId;
  const handleClose = propOnClose ?? closeClubViewer;

  const club: Club | null = useMemo(() => {
    if (!targetClubId) return null;
    return gameState.clubs.find((c) => c.id === targetClubId) || getClubById(targetClubId) || null;
  }, [targetClubId, gameState.clubs]);

  const atmosphere = useMemo(() => deriveClubAtmosphere(club), [club]);
  const theme = useMemo(() => getClubTheme(club), [club]);
  const campaign = useMemo(() => {
    if (!club) return null;
    return getClubCampaign(club.id, gameState);
  }, [club, gameState]);

  const sectors = useMemo(() => {
    if (!club) return [];
    return groupSquadBySector(club.squad || []);
  }, [club]);

  const totalPlayers = club?.squad?.length ?? 0;
  const overallAvgStrength = totalPlayers > 0
    ? Math.round(club!.squad.reduce((acc, p) => acc + p.strength, 0) / totalPlayers)
    : 0;

  if (!club) {
    return (
      <div 
        className="absolute inset-0 z-50 bg-[var(--app-bg-deep)] flex flex-col items-center justify-center p-6 text-slate-300"
        style={atmosphere.style}
      >
        <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
        <h2 className="text-lg font-bold text-white mb-2">Clube não encontrado</h2>
        <p className="text-xs text-slate-400 mb-4">As informações deste clube não puderam ser carregadas.</p>
        <button
          onClick={handleClose}
          className="px-4 py-2 bg-[var(--app-text-accent)] text-slate-900 font-extrabold rounded text-xs uppercase cursor-pointer"
        >
          Voltar
        </button>
      </div>
    );
  }

  const divisionText = club.divisionName || club.leagueName || (club.division ? `Série ${['A', 'B', 'C', 'D'][club.division - 1] || club.division}` : 'Divisão Principal');

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getPositionBadge = (pos: Position) => {
    switch (pos) {
      case 'GOL': return 'bg-amber-950 text-amber-300 border-amber-700/60';
      case 'ZAG': return 'bg-blue-950 text-blue-300 border-blue-700/60';
      case 'LAT': return 'bg-cyan-950 text-cyan-300 border-cyan-700/60';
      case 'VOL': return 'bg-indigo-950 text-indigo-300 border-indigo-700/60';
      case 'MEI': return 'bg-emerald-950 text-emerald-300 border-emerald-700/60';
      case 'ATA': return 'bg-rose-950 text-rose-300 border-rose-700/60';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getEnergyColor = (energy: number) => {
    if (energy >= 85) return 'bg-emerald-500';
    if (energy >= 65) return 'bg-amber-400';
    return 'bg-rose-500';
  };

  const filteredSectors = sectors.map((sec) => {
    if (selectedSector !== 'all' && sec.key !== selectedSector) {
      return { ...sec, players: [] };
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sec;
    return {
      ...sec,
      players: sec.players.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q) ||
          (p.skill1 && p.skill1.toLowerCase().includes(q)) ||
          (p.skill2 && p.skill2.toLowerCase().includes(q))
      ),
    };
  }).filter((sec) => sec.players.length > 0);

  return (
    <div 
      className="absolute inset-0 z-50 bg-[var(--app-bg-deep)] text-slate-100 flex flex-col select-none overflow-hidden animate-in fade-in duration-150"
      style={atmosphere.style}
      data-testid="club-viewer"
      data-club-family={atmosphere.family}
    >
      {/* Club Kit Stripe Top Accent Line */}
      <div className="h-1.5 w-full shrink-0 shadow-sm" style={{ background: theme.stripeGradient }} />

      {/* TOP HEADER: Breadcrumbs & Back Button */}
      <div className="px-4 py-2.5 bg-[var(--app-surface-1)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleClose}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-md font-bold text-xs transition-all cursor-pointer bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] text-slate-200 hover:text-white border border-[var(--app-border-subtle)] hover:border-[var(--app-border-highlight)] shadow-xs active:scale-95"
            title="Voltar à tela anterior (ESC)"
            data-testid="club-viewer-close-btn"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--app-text-accent)]" />
            <span>Voltar</span>
            <kbd className="hidden sm:inline-block bg-black/40 text-slate-300 px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold border border-white/10">
              ESC
            </kbd>
          </button>

          <div className="h-4 w-px bg-[var(--app-border-subtle)]" />

          <div className="flex items-center space-x-2 text-xs">
            <Eye className="w-3.5 h-3.5 text-[var(--app-text-accent)]" />
            <span className="font-semibold text-slate-300">Visualizador de Clube</span>
            <span className="text-slate-600">•</span>
            <span 
              className="text-[10px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider"
              style={{
                backgroundColor: atmosphere.tokens['--app-surface-2'],
                color: atmosphere.tokens['--app-text-accent'],
                border: `1px solid ${atmosphere.tokens['--app-border-highlight']}`,
              }}
            >
              Consulta Externa • {atmosphere.familyName}
            </span>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[var(--app-surface-2)] transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* MAIN CLUB HERO BANNER */}
      <div 
        className="px-3.5 py-3 sm:px-5 sm:py-4 border-b shrink-0 relative overflow-hidden shadow-md"
        style={{
          background: `linear-gradient(135deg, ${atmosphere.tokens['--app-surface-1']} 0%, ${atmosphere.tokens['--app-surface-2']} 100%)`,
          borderBottomColor: atmosphere.tokens['--app-border-subtle'],
        }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 relative z-10">
          {/* Crest & Identity */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div 
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center shrink-0 p-1 relative overflow-hidden shadow-lg"
              style={{
                backgroundColor: atmosphere.tokens['--app-bg-deep'],
                border: `2px solid ${atmosphere.tokens['--app-border-highlight']}`,
                boxShadow: `0 0 16px ${atmosphere.tokens['--app-border-subtle']}`,
              }}
            >
              <ClubCrest club={club} size="xl" className="w-10 h-10 sm:w-14 sm:h-14" />
              <div 
                className="absolute bottom-0 left-0 right-0 h-1"
                style={{ background: theme.stripeGradient }}
              />
            </div>

            <div>
              <div className="flex items-center space-x-2 sm:space-x-2.5 flex-wrap gap-y-1">
                <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">{club.name}</h1>
                <span 
                  className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-xs"
                  style={{
                    backgroundColor: atmosphere.tokens['--app-text-accent'],
                    color: '#0F172A',
                  }}
                >
                  {divisionText}
                </span>
                {club.stateCode && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--app-surface-2)] text-slate-300 border border-[var(--app-border-subtle)]">
                    {club.stateCode}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 sm:space-x-4 mt-1 text-xs text-slate-300 flex-wrap gap-y-0.5 sm:gap-y-1">
                {/* Treinador */}
                <div className="flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-[var(--app-text-accent)] shrink-0" />
                  <span className="text-slate-400">Treinador:</span>
                  <span className="font-semibold text-white">{club.coach || 'Sem treinador'}</span>
                </div>

                <span className="text-slate-600 hidden sm:inline">•</span>

                {/* Estádio & Capacidade */}
                <div className="flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[var(--app-text-accent)] shrink-0" />
                  <span className="text-slate-400">Estádio:</span>
                  <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-none">{club.stadium}</span>
                  <span className="text-slate-400 font-mono-numbers hidden sm:inline">
                    ({club.capacity.toLocaleString('pt-BR')} lugares)
                  </span>
                </div>

                <span className="text-slate-600 hidden sm:inline">•</span>

                {/* Estrelas de Reputação */}
                <div className="flex items-center space-x-1" title={`Reputação: ${club.reputation} estrelas`}>
                  <div className="flex items-center space-x-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < Math.round(club.reputation)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-slate-700/50 text-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-amber-300 font-mono-numbers font-bold ml-1">
                    {club.reputation.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Squad Quick Stats */}
          <div className="flex items-center space-x-2 sm:space-x-4 bg-[var(--app-surface-2)]/80 border border-[var(--app-border-subtle)] rounded-lg p-2 sm:p-2.5 self-stretch md:self-auto justify-around">
            <div className="text-center px-1.5 sm:px-2">
              <span className="block text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold">Elenco</span>
              <span className="text-sm font-black text-white font-mono-numbers">{totalPlayers}</span>
            </div>
            <div className="w-px h-6 bg-[var(--app-border-subtle)]" />
            <div className="text-center px-1.5 sm:px-2">
              <span className="block text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold">Força Média</span>
              <span className="text-sm font-black text-[var(--app-text-accent)] font-mono-numbers">{overallAvgStrength}</span>
            </div>
            <div className="w-px h-6 bg-[var(--app-border-subtle)]" />
            <div className="text-center px-1.5 sm:px-2">
              <span className="block text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold">Cores</span>
              <div className="flex items-center justify-center space-x-1 mt-0.5">
                <span 
                  className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs" 
                  style={{ backgroundColor: theme.primary }} 
                  title={`Primária: ${theme.primary}`}
                />
                <span 
                  className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs" 
                  style={{ backgroundColor: theme.secondary }} 
                  title={`Secundária: ${theme.secondary}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE TAB TOGGLE (< md) */}
      <div className="flex md:hidden bg-[var(--app-surface-2)] p-1 rounded-lg border border-[var(--app-border-subtle)] shrink-0 gap-1 mx-3 mt-2">
        <button
          onClick={() => { sound.playClick(); setMobileTab('squad'); }}
          className={`flex-1 min-h-[38px] py-1.5 px-3 rounded text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
            mobileTab === 'squad'
              ? 'bg-[var(--app-surface-1)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
          data-testid="club-viewer-mobile-tab-squad"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Elenco ({totalPlayers})</span>
        </button>
        <button
          onClick={() => { sound.playClick(); setMobileTab('campaign'); }}
          className={`flex-1 min-h-[38px] py-1.5 px-3 rounded text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
            mobileTab === 'campaign'
              ? 'bg-[var(--app-surface-1)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
          data-testid="club-viewer-mobile-tab-campaign"
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Campanha & Estádio</span>
        </button>
      </div>

      {/* CONTENT AREA: SPLIT WITH CAMPAIGN & SQUAD */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-2.5 sm:p-3 gap-2.5 sm:gap-3 bg-[var(--app-bg-deep)] min-h-0">
        {/* COLUMN 1: RESUMO DA CAMPANHA NA TEMPORADA ATUAL */}
        <div className={`bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-md min-h-0 ${
          mobileTab === 'campaign' ? 'flex-1' : 'hidden md:flex'
        } md:w-[320px] lg:w-[360px] md:shrink-0`}>
          <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <Trophy className="w-4 h-4 text-[var(--app-text-accent)] shrink-0" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider truncate">
                Campanha na Temporada
              </h3>
            </div>
            <span className="text-[10px] text-[var(--app-text-accent)] font-medium font-sans truncate max-w-[140px]">
              {campaign?.competitionName || 'Liga'}
            </span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3 font-mono-numbers text-xs">
            {campaign && (
              <>
                {/* Ranking & Win Rate Hero */}
                <div 
                  className="p-3 rounded-lg border flex items-center justify-between"
                  style={{
                    backgroundColor: atmosphere.tokens['--app-surface-2'],
                    borderColor: atmosphere.tokens['--app-border-subtle'],
                  }}
                >
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block font-semibold">Posição Atual</span>
                    <div className="text-xl font-black text-white flex items-baseline space-x-1">
                      <span>{campaign.position ? `${campaign.position}º` : '-'}</span>
                      {campaign.totalTeams && (
                        <span className="text-xs text-slate-400 font-normal">/ {campaign.totalTeams} times</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase block font-semibold">Aproveitamento</span>
                    <span className="text-lg font-black text-[var(--app-text-accent)]">
                      {campaign.winRate}%
                    </span>
                  </div>
                </div>

                {/* Dense Campaign Metrics Grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] p-2 rounded text-center">
                    <span className="text-[9px] text-slate-400 uppercase block">PTS</span>
                    <span className="text-base font-black text-white">{campaign.points}</span>
                  </div>
                  <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] p-2 rounded text-center">
                    <span className="text-[9px] text-slate-400 uppercase block">Jogos</span>
                    <span className="text-base font-black text-slate-200">{campaign.played}</span>
                  </div>
                  <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] p-2 rounded text-center">
                    <span className="text-[9px] text-emerald-400 uppercase block">Vitórias</span>
                    <span className="text-base font-black text-emerald-300">{campaign.won}</span>
                  </div>
                  <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] p-2 rounded text-center">
                    <span className="text-[9px] text-slate-400 uppercase block">Empates</span>
                    <span className="text-base font-black text-slate-300">{campaign.drawn}</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] p-2 rounded text-center">
                    <span className="text-[9px] text-rose-400 uppercase block">Derrotas</span>
                    <span className="text-base font-black text-rose-300">{campaign.lost}</span>
                  </div>
                  <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] p-2 rounded text-center">
                    <span className="text-[9px] text-slate-400 uppercase block">Gols Pró</span>
                    <span className="text-base font-black text-slate-200">{campaign.goalsFor}</span>
                  </div>
                  <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] p-2 rounded text-center">
                    <span className="text-[9px] text-slate-400 uppercase block">Contra</span>
                    <span className="text-base font-black text-slate-200">{campaign.goalsAgainst}</span>
                  </div>
                  <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] p-2 rounded text-center">
                    <span className="text-[9px] text-slate-400 uppercase block">Saldo</span>
                    <span className={`text-base font-black ${
                      campaign.goalDiff > 0 ? 'text-emerald-400' : campaign.goalDiff < 0 ? 'text-rose-400' : 'text-slate-300'
                    }`}>
                      {campaign.goalDiff > 0 ? `+${campaign.goalDiff}` : campaign.goalDiff}
                    </span>
                  </div>
                </div>

                {/* Recent Form */}
                <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] p-2.5 rounded">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold mb-1.5 font-sans">
                    Forma Recente (Últimos Jogos)
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {campaign.form.length === 0 ? (
                      <span className="text-slate-500 text-xs font-sans">Nenhum jogo disputado ainda</span>
                    ) : (
                      campaign.form.slice(-6).map((res, i) => (
                        <span
                          key={i}
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-black shadow-xs ${
                            res === 'V'
                              ? 'bg-emerald-400'
                              : res === 'E'
                              ? 'bg-slate-400'
                              : 'bg-rose-500 text-white'
                          }`}
                          title={res === 'V' ? 'Vitória' : res === 'E' ? 'Empate' : 'Derrota'}
                        >
                          {res}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Club Stadium & Capacity Info Card */}
                <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] p-2.5 rounded font-sans space-y-1.5">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                    Praça Esportiva
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Estádio:</span>
                    <span className="text-white font-bold">{club.stadium}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Capacidade:</span>
                    <span className="text-[var(--app-text-accent)] font-mono-numbers font-semibold">
                      {club.capacity.toLocaleString('pt-BR')} pessoas
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Ingresso Médio:</span>
                    <span className="text-slate-200 font-mono-numbers">
                      {formatMoney(club.ticketPrice || 40)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* COLUMN 2: TABELA COMPLETA DO ELENCO DIVIDIDO POR SETOR */}
        <div className={`bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-md min-h-0 ${
          mobileTab === 'squad' ? 'flex-1' : 'hidden md:flex'
        } md:flex-1`}>
          {/* Controls Bar: Search & Sector filter pills */}
          <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* Filter pills */}
            <div className="flex items-center space-x-1 flex-wrap gap-y-1">
              <button
                onClick={() => { sound.playClick(); setSelectedSector('all'); }}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  selectedSector === 'all'
                    ? 'bg-[var(--app-text-accent)] text-slate-900 shadow-sm'
                    : 'bg-[var(--app-surface-1)] text-slate-300 hover:bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)]'
                }`}
              >
                Todos ({totalPlayers})
              </button>
              {sectors.map((sec) => (
                <button
                  key={sec.key}
                  onClick={() => { sound.playClick(); setSelectedSector(sec.key); }}
                  className={`px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                    selectedSector === sec.key
                      ? 'bg-[var(--app-text-accent)] text-slate-900 shadow-sm'
                      : 'bg-[var(--app-surface-1)] text-slate-300 hover:bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)]'
                  }`}
                >
                  {sec.name} ({sec.players.length})
                </button>
              ))}
            </div>

            {/* Quick Search Input */}
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar jogador ou carac..."
                className="pl-8 pr-3 py-1 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--app-border-highlight)] w-full sm:w-56"
              />
            </div>
          </div>

          {/* SQUAD SECTORS LIST */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3 min-h-0">
            {filteredSectors.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Nenhum jogador encontrado com os filtros aplicados.
              </div>
            ) : (
              filteredSectors.map((sector) => (
                <div 
                  key={sector.key} 
                  className="bg-[var(--app-surface-2)]/40 border border-[var(--app-border-subtle)] rounded-lg overflow-hidden shadow-xs"
                >
                  {/* Sector Header Banner */}
                  <div 
                    className="px-3 py-1.5 flex items-center justify-between border-b border-[var(--app-border-subtle)]"
                    style={{
                      background: `linear-gradient(90deg, ${atmosphere.tokens['--app-surface-2']} 0%, transparent 100%)`,
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <span 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: atmosphere.tokens['--app-text-accent'] }}
                      />
                      <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">
                        {sector.name} ({sector.players.length})
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono-numbers">
                      Força Média: <strong className="text-[var(--app-text-accent)]">{sector.avgStrength}</strong>
                    </span>
                  </div>

                  {/* Dense Players Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs brasfoot-table border-collapse min-w-[560px] md:min-w-0">
                      <thead>
                        <tr className="bg-[var(--app-surface-2)] text-[10px] uppercase text-slate-400 border-b border-[var(--app-border-subtle)]">
                          <th className="py-1.5 px-2 w-14 text-center">Status</th>
                          <th className="py-1.5 px-2">Jogador</th>
                          <th className="py-1.5 px-2 w-12 text-center">Pos</th>
                          <th className="py-1.5 px-2 w-12 text-center">Força</th>
                          <th className="py-1.5 px-2 w-12 text-center">Idade</th>
                          <th className="py-1.5 px-2">Características</th>
                          <th className="py-1.5 px-2 w-28 text-center">Energia</th>
                          <th className="py-1.5 px-2 w-24 text-right">Salário</th>
                          <th className="py-1.5 px-2 w-24 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--app-border-subtle)]">
                        {sector.players.map((player) => {
                          const skills = [player.skill1, player.skill2].filter(Boolean).join(' • ');
                          const footLabel = player.foot === 'D' ? 'Destro' : player.foot === 'E' ? 'Canhoto' : 'Ambidestro';

                          return (
                            <tr
                              key={player.id}
                              className={`hover:bg-[var(--app-surface-2)]/60 transition-colors ${
                                player.isStarter ? 'bg-[var(--app-surface-2)]/30 text-white font-medium' : 'text-slate-300'
                              }`}
                            >
                              {/* Status Badges */}
                              <td className="py-1 px-2 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  {player.isStarter && (
                                    <span 
                                      className="text-[9px] px-1 py-0.2 rounded font-extrabold uppercase"
                                      style={{
                                        backgroundColor: atmosphere.tokens['--app-text-accent'],
                                        color: '#0F172A',
                                      }}
                                      title="Titular"
                                    >
                                      TIT
                                    </span>
                                  )}
                                  {player.injured && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-rose-900 text-rose-200 font-bold" title="Lesionado">
                                      LES
                                    </span>
                                  )}
                                  {player.suspended && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-900 text-amber-200 font-bold" title="Suspenso">
                                      SUS
                                    </span>
                                  )}
                                  {player.isStar && (
                                    <span title="Estrela do Time">
                                      <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Player Name */}
                              <td className="py-1 px-2 font-semibold text-white">
                                <div className="flex items-center space-x-1.5">
                                  <span className="truncate max-w-[160px] sm:max-w-[200px]">{player.name}</span>
                                </div>
                              </td>

                              {/* Specific Position Badge */}
                              <td className="py-1 px-2 text-center">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border ${getPositionBadge(player.position)}`}>
                                  {player.position}
                                </span>
                              </td>

                              {/* Strength */}
                              <td className="py-1 px-2 text-center font-mono-numbers">
                                <span className={`text-xs font-black ${
                                  player.strength >= 85
                                    ? 'text-emerald-400'
                                    : player.strength >= 75
                                    ? 'text-amber-300'
                                    : 'text-slate-300'
                                }`}>
                                  {player.strength}
                                </span>
                              </td>

                              {/* Age */}
                              <td className="py-1 px-2 text-center font-mono-numbers text-slate-300">
                                {player.age}
                              </td>

                              {/* Skills & Foot */}
                              <td className="py-1 px-2 text-slate-300">
                                <div className="flex items-center space-x-1.5 text-[11px] truncate max-w-[220px]">
                                  <span className="text-slate-200 font-medium">
                                    {skills || 'Equilibrado'}
                                  </span>
                                  <span className="text-slate-500">•</span>
                                  <span className="text-slate-400 text-[10px]">
                                    {footLabel}
                                  </span>
                                </div>
                              </td>

                              {/* Energy Bar & Number */}
                              <td className="py-1 px-2 text-center">
                                <div className="flex items-center justify-center space-x-1.5">
                                  <div className="w-14 h-2 bg-[var(--app-surface-1)] rounded-full overflow-hidden border border-white/10">
                                    <div 
                                      className={`h-full rounded-full ${getEnergyColor(player.energy)}`}
                                      style={{ width: `${Math.min(100, Math.max(0, player.energy))}%` }}
                                    />
                                  </div>
                                  <span className="font-mono-numbers text-[10px] font-bold text-slate-300 w-6 text-right">
                                    {player.energy}%
                                  </span>
                                </div>
                              </td>

                              {/* Salary */}
                              <td className="py-1 px-2 text-right font-mono-numbers text-slate-400 text-[11px]">
                                {formatMoney(player.salary)}
                              </td>

                              {/* Market Value */}
                              <td className="py-1 px-2 text-right font-mono-numbers text-[var(--app-text-accent)] font-semibold text-[11px]">
                                {formatMoney(player.marketValue)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
