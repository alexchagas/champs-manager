import React, { useState } from 'react';
import { MatchLineupPanel } from './MatchLineupPanel';
import { automaticMatchBench } from '../engine/careerEconomy';
import { useGame } from '../state/GameContext';
import { 
  Users, 
  Shield, 
  Flame, 
  Zap, 
  Check, 
  Award, 
  Crosshair, 
  CornerDownRight, 
  HelpCircle,
  ArrowUpDown,
  Play,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { FormationType, Mentality, Player } from '../types';
import { calculateSectorStrength } from '../engine/simulationEngine';
import { sound } from '../audio/soundEngine';
import { getClubTheme } from '../theme/clubTheme';

// Coordinates (x% from left, y% from top of pitch) for formations
const FORMATION_COORDINATES: Record<FormationType, { x: number; y: number; defaultRole: string }[]> = {
  '4-4-2': [
    // Goleiro
    { x: 50, y: 88, defaultRole: 'GOL' },
    // Defensores (LAT D, ZAG D, ZAG E, LAT E)
    { x: 16, y: 70, defaultRole: 'LAT' },
    { x: 38, y: 72, defaultRole: 'ZAG' },
    { x: 62, y: 72, defaultRole: 'ZAG' },
    { x: 84, y: 70, defaultRole: 'LAT' },
    // Meio-campistas
    { x: 20, y: 46, defaultRole: 'VOL' },
    { x: 40, y: 48, defaultRole: 'VOL' },
    { x: 60, y: 48, defaultRole: 'MEI' },
    { x: 80, y: 46, defaultRole: 'MEI' },
    // Atacantes
    { x: 36, y: 20, defaultRole: 'ATA' },
    { x: 64, y: 20, defaultRole: 'ATA' },
  ],
  '4-3-3': [
    { x: 50, y: 88, defaultRole: 'GOL' },
    { x: 16, y: 70, defaultRole: 'LAT' },
    { x: 38, y: 72, defaultRole: 'ZAG' },
    { x: 62, y: 72, defaultRole: 'ZAG' },
    { x: 84, y: 70, defaultRole: 'LAT' },
    { x: 30, y: 48, defaultRole: 'VOL' },
    { x: 50, y: 44, defaultRole: 'MEI' },
    { x: 70, y: 48, defaultRole: 'MEI' },
    { x: 18, y: 22, defaultRole: 'ATA' },
    { x: 50, y: 18, defaultRole: 'ATA' },
    { x: 82, y: 22, defaultRole: 'ATA' },
  ],
  '3-5-2': [
    { x: 50, y: 88, defaultRole: 'GOL' },
    { x: 26, y: 72, defaultRole: 'ZAG' },
    { x: 50, y: 74, defaultRole: 'ZAG' },
    { x: 74, y: 72, defaultRole: 'ZAG' },
    { x: 12, y: 48, defaultRole: 'LAT' },
    { x: 34, y: 50, defaultRole: 'VOL' },
    { x: 50, y: 44, defaultRole: 'MEI' },
    { x: 66, y: 50, defaultRole: 'VOL' },
    { x: 88, y: 48, defaultRole: 'LAT' },
    { x: 38, y: 20, defaultRole: 'ATA' },
    { x: 62, y: 20, defaultRole: 'ATA' },
  ],
  '4-5-1': [
    { x: 50, y: 88, defaultRole: 'GOL' },
    { x: 16, y: 70, defaultRole: 'LAT' },
    { x: 38, y: 72, defaultRole: 'ZAG' },
    { x: 62, y: 72, defaultRole: 'ZAG' },
    { x: 84, y: 70, defaultRole: 'LAT' },
    { x: 18, y: 46, defaultRole: 'MEI' },
    { x: 36, y: 50, defaultRole: 'VOL' },
    { x: 50, y: 42, defaultRole: 'MEI' },
    { x: 64, y: 50, defaultRole: 'VOL' },
    { x: 82, y: 46, defaultRole: 'MEI' },
    { x: 50, y: 18, defaultRole: 'ATA' },
  ],
  '5-3-2': [
    { x: 50, y: 88, defaultRole: 'GOL' },
    { x: 14, y: 68, defaultRole: 'LAT' },
    { x: 32, y: 72, defaultRole: 'ZAG' },
    { x: 50, y: 74, defaultRole: 'ZAG' },
    { x: 68, y: 72, defaultRole: 'ZAG' },
    { x: 86, y: 68, defaultRole: 'LAT' },
    { x: 30, y: 48, defaultRole: 'VOL' },
    { x: 50, y: 44, defaultRole: 'MEI' },
    { x: 70, y: 48, defaultRole: 'VOL' },
    { x: 38, y: 20, defaultRole: 'ATA' },
    { x: 62, y: 20, defaultRole: 'ATA' },
  ],
};

const POSITION_COLORS: Record<string, { bg: string; text: string }> = {
  GOL: { bg: 'bg-amber-600', text: 'text-amber-100' },
  LAT: { bg: 'bg-cyan-600', text: 'text-cyan-100' },
  ZAG: { bg: 'bg-blue-600', text: 'text-blue-100' },
  VOL: { bg: 'bg-emerald-600', text: 'text-emerald-100' },
  MEI: { bg: 'bg-purple-600', text: 'text-purple-100' },
  ATA: { bg: 'bg-rose-600', text: 'text-rose-100' },
};

export const TacticsScreen: React.FC = () => {
  const { 
    gameState, 
    setScreen, 
    setMatchBench, 
    matchError, 
    userClub, 
    userFixture,
    nextOpponent,
    updateTactics, 
    swapPlayers, 
    toggleStarter, 
    autoSelectBestLineup 
  } = useGame();
  const clubTheme = getClubTheme(userClub);

  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [draggedPlayerId, setDraggedPlayerId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [mobileTab, setMobileTab] = useState<'pitch' | 'squad'>('pitch');

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  React.useEffect(() => {
    if (matchError) {
      showToast('error', matchError);
    }
  }, [matchError]);

  const selectedPlayer = userClub.squad.find((p) => p.id === selectedPlayerId);

  const starters = userClub.squad.filter((p) => p.isStarter);
  const benchIds = userClub.namedSubstituteIds || [];
  const bench = userClub.squad.filter((p) => benchIds.includes(p.id));
  const unavailableStarters = starters.filter((p) => p.injured || p.suspended);

  const currentFormation = userClub.tactics.formation;
  const currentMentality = userClub.tactics.mentality;
  const coords = FORMATION_COORDINATES[currentFormation];

  const sectorStrength = calculateSectorStrength(starters);

  // Unified Smart Auto-Lineup: selects best 11 starters for current formation, rests tired players (< 75%), and populates 11-player bench
  const handleSmartAutoLineup = () => {
    sound.playClick();
    const result = autoSelectBestLineup(currentFormation);
    const restedCount = result?.restedCount ?? 0;

    if (restedCount > 0) {
      showToast('success', `⚡ Auto-escalação concluída (${restedCount} poupado(s)).`);
    } else {
      showToast('success', '⚡ 11 titulares e reservas definidos com sucesso!');
    }
  };

  const handlePlayMatch = () => {
    const injuredStarters = starters.filter((p) => p.injured);
    const suspendedStarters = starters.filter((p) => p.suspended);

    if (injuredStarters.length > 0) {
      sound.playClick();
      showToast('error', `Substitua ${injuredStarters.map((p) => p.name).join(', ')} (DM) antes da partida!`);
      return;
    }

    if (suspendedStarters.length > 0) {
      sound.playClick();
      showToast('error', `Substitua ${suspendedStarters.map((p) => p.name).join(', ')} (Suspenso) antes da partida!`);
      return;
    }

    if (starters.length < 11) {
      sound.playClick();
      showToast('error', `Escale 11 titulares para jogar (atualmente: ${starters.length}/11). Use o Auto-Escalar!`);
      return;
    }

    if (starters.length > 11) {
      sound.playClick();
      showToast('error', `Mais de 11 titulares escalados (${starters.length}/11).`);
      return;
    }

    sound.playWhistle();
    setScreen('live_match');
  };

  if (gameState.activeMatch && gameState.activeMatch.phase !== 'committed') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[var(--app-bg-deep)] text-slate-200">
        <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-xl p-6 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-950 border border-emerald-600/50 flex items-center justify-center text-emerald-400">
            <Play className="w-6 h-6 fill-emerald-400" />
          </div>
          <h2 className="text-base font-bold text-white">Partida em Andamento</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Há uma partida pausada ({gameState.activeMatch.clock.minute}′ • {gameState.activeMatch.score.join(' : ')}). As alterações táticas e substituições durante o jogo devem ser feitas diretamente no painel ao vivo.
          </p>
          <button
            onClick={() => setScreen('live_match')}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-lg shadow-lg cursor-pointer transition-all active:scale-95"
          >
            Voltar à Partida
          </button>
        </div>
      </div>
    );
  }

  // Click-to-swap logic
  const handlePlayerClick = (playerId: number) => {
    sound.playClick();
    if (selectedPlayerId === null) {
      setSelectedPlayerId(playerId);
    } else if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
    } else {
      swapPlayers(selectedPlayerId, playerId);
      setSelectedPlayerId(null);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, playerId: number) => {
    setDraggedPlayerId(playerId);
    e.dataTransfer.setData('text/plain', playerId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetPlayerId: number) => {
    e.preventDefault();
    if (draggedPlayerId !== null && draggedPlayerId !== targetPlayerId) {
      swapPlayers(draggedPlayerId, targetPlayerId);
    }
    setDraggedPlayerId(null);
  };

  const formations: FormationType[] = ['4-4-2', '4-3-3', '3-5-2', '4-5-1', '5-3-2'];
  const mentalities: Mentality[] = [
    'Muito Defensiva',
    'Defensiva',
    'Equilibrada',
    'Ofensiva',
    'Muito Ofensiva',
  ];

  return (
    <div className="flex-1 flex flex-col lg:overflow-hidden bg-[var(--app-bg-deep)] p-2.5 sm:p-3 gap-2 sm:gap-2.5 min-h-0 select-none pb-4 lg:pb-0">
      {/* MATCH PREPARATION ACTION BAR (RESPONSIVE WRAP & COMPACT SIZING) */}
      {userFixture && nextOpponent && (
        <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg py-2 px-3 sm:px-3.5 flex flex-wrap items-center justify-between gap-2 shadow-md shrink-0 relative overflow-hidden">
          {/* Top dual stripe */}
          <div className="absolute top-0 left-0 right-0 h-1 flex z-10">
            <div className="flex-1" style={{ background: clubTheme.stripeGradient }} />
            <div className="w-1 bg-[var(--app-surface-2)]" />
            <div className="flex-1" style={{ background: clubTheme.stripeGradient }} />
          </div>

          {/* Left: Fixture context & DM/Suspenso Alert */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 pt-0.5 min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--app-text-accent)] bg-[var(--app-bg-deep)] px-2 py-0.5 rounded border border-[var(--app-border-subtle)] shrink-0">
              {userFixture.competitionName || 'Campeonato'} • {userFixture.competitionRound || userFixture.stage || `Rodada ${userFixture.round}`}
            </span>
            <div className="flex items-center space-x-1.5 text-xs shrink-0">
              <span className="font-bold text-white">{userClub.name}</span>
              <span className="text-slate-400 font-semibold text-[11px]">vs</span>
              <span className="font-bold text-slate-200">{nextOpponent.name}</span>
              <span className="text-[10px] text-[var(--app-text-accent)] bg-[var(--app-surface-2)] px-1.5 py-0.5 rounded font-mono font-semibold border border-[var(--app-border-subtle)]">
                {userFixture.homeClubId === userClub.id ? 'CASA' : 'FORA'}
              </span>
            </div>

            {/* ONLY Alert if there are Injured or Suspended Starters */}
            {unavailableStarters.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-300 bg-rose-950/80 border border-rose-700/60 px-2 py-0.5 rounded animate-pulse shrink-0">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{unavailableStarters.length} titular(es) no DM/Suspenso!</span>
              </span>
            )}
          </div>

          {/* Right: Actions & Error/Success Toast Notification */}
          <div className="flex items-center gap-2 pt-0.5 ml-auto sm:ml-0 shrink-0">
            {/* Toast notification right next to the buttons */}
            {toast && (
              <div
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border shadow-md animate-in fade-in duration-200 shrink-0 ${
                  toast.type === 'error'
                    ? 'bg-rose-950/90 border-rose-700/80 text-rose-200'
                    : 'bg-emerald-950/90 border-emerald-700/80 text-emerald-200'
                }`}
              >
                {toast.type === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="truncate max-w-[240px] sm:max-w-none">{toast.message}</span>
              </div>
            )}

            {/* Smart Auto-Escalar button */}
            <button
              onClick={handleSmartAutoLineup}
              className="flex items-center justify-center space-x-1.5 px-3 py-1.5 h-8.5 sm:h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] sm:text-xs rounded-lg transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
              title="Escala automaticamente os melhores 11 titulares, descansa atletas cansados (< 75%) e convoca o melhor banco de reservas de 11 jogadores"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>Auto-Escalar Time</span>
            </button>

            {/* JOGAR PARTIDA >> */}
            <button
              onClick={handlePlayMatch}
              className={`flex items-center justify-center space-x-1.5 px-3.5 sm:px-4 h-8.5 sm:h-9 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-black text-[11px] sm:text-xs uppercase tracking-wider rounded-lg shadow-md active:scale-95 transition-all cursor-pointer shrink-0 ${
                starters.length !== 11 || unavailableStarters.length > 0 ? 'opacity-85' : ''
              }`}
              title="Confirmar escalação e ir para o jogo (Espaço)"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>JOGAR PARTIDA &gt;&gt;</span>
              <kbd className="hidden sm:inline-block bg-black/20 text-black/90 px-1 py-0.2 rounded text-[9px] font-mono lowercase tracking-normal font-bold">
                espaço
              </kbd>
            </button>
          </div>
        </div>
      )}

      {/* SELECTED PLAYER TOUCH HIGHLIGHT BANNER */}
      {selectedPlayer && (
        <div className="bg-amber-950/95 border border-amber-500/80 text-amber-200 px-3 py-2 rounded-lg flex items-center justify-between text-xs font-bold animate-pulse shrink-0 shadow-lg">
          <div className="flex items-center space-x-2 truncate">
            <ArrowUpDown className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="truncate">
              Atleta selecionado: <strong className="text-white">{selectedPlayer.name}</strong> ({selectedPlayer.position} • Força {selectedPlayer.strength}). Toque em outro para trocar!
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedPlayerId(null); }}
            className="text-[11px] underline text-amber-300 hover:text-white ml-2 shrink-0 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* MOBILE/TABLET VIEW TOGGLE SWITCHER (< 1024px) */}
      <div className="flex lg:hidden bg-[var(--app-surface-2)] p-1 rounded-lg border border-[var(--app-border-subtle)] shrink-0 gap-1">
        <button
          onClick={() => { sound.playClick(); setMobileTab('pitch'); }}
          className={`flex-1 min-h-[42px] py-2 px-3 rounded text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
            mobileTab === 'pitch'
              ? 'bg-[var(--app-surface-1)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🏟️ Campo ({starters.length})</span>
        </button>
        <button
          onClick={() => { sound.playClick(); setMobileTab('squad'); }}
          className={`flex-1 min-h-[42px] py-2 px-3 rounded text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
            mobileTab === 'squad'
              ? 'bg-[var(--app-surface-1)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>📋 Elenco Completo ({userClub.squad.length})</span>
        </button>
      </div>

      {/* TACTICAL WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden gap-2.5 sm:gap-3 min-h-0">
        {/* LEFT: PITCH & TACTICAL BOARD (FULL ON MOBILE IF TAB=PITCH, SIDE-BY-SIDE ON LG) */}
        <div className={`bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-lg shrink-0 min-h-0 ${mobileTab === 'pitch' ? 'flex flex-1' : 'hidden'} lg:flex lg:w-[440px] xl:w-[480px] 2xl:w-[500px]`}>
        {/* Top Control Bar: Formation, Mentality, Power summary */}
        <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-highlight)] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-300 font-semibold">Formação:</span>
            <select
              value={currentFormation}
              onChange={(e) => {
                const newF = e.target.value as FormationType;
                sound.playClick();
                updateTactics({ formation: newF });
                autoSelectBestLineup(newF);
              }}
              className="bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] text-[var(--app-text-accent)] font-bold px-2 py-0.5 rounded text-xs focus:outline-none cursor-pointer"
            >
              {formations.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <span className="text-slate-500">|</span>

            <select
              value={currentMentality}
              onChange={(e) => {
                sound.playClick();
                updateTactics({ mentality: e.target.value as Mentality });
              }}
              className="bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] text-slate-200 font-semibold px-2 py-0.5 rounded text-xs focus:outline-none cursor-pointer"
            >
              {mentalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Quick sector stats */}
          <div className="flex items-center space-x-2 text-[11px] font-mono-numbers">
            <span className="text-slate-400">DEF: <strong className="text-[var(--app-text-accent)]">{sectorStrength.defStrength}</strong></span>
            <span className="text-slate-400">MEI: <strong className="text-[var(--app-text-accent)]">{sectorStrength.midStrength}</strong></span>
            <span className="text-slate-400">ATA: <strong className="text-[var(--app-text-accent)]">{sectorStrength.attStrength}</strong></span>
            <span className="bg-[var(--app-surface-1)] text-[var(--app-text-accent)] px-1.5 py-0.5 rounded font-bold border border-[var(--app-border-subtle)]">
              MÉD: {sectorStrength.overall}
            </span>
          </div>
        </div>


        {/* VISUAL FOOTBALL PITCH */}
        <div className="flex-1 relative pitch-pattern overflow-hidden border border-[#0d2618] m-2 rounded shadow-inner">
          {/* Pitch Markings SVG Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Outer border */}
            <rect x="2" y="2" width="96" height="96" fill="none" stroke="#ffffff" strokeWidth="0.8" />
            {/* Center line */}
            <line x1="2" y1="50" x2="98" y2="50" stroke="#ffffff" strokeWidth="0.8" />
            {/* Center circle */}
            <circle cx="50" cy="50" r="14" fill="none" stroke="#ffffff" strokeWidth="0.8" />
            <circle cx="50" cy="50" r="0.8" fill="#ffffff" />
            {/* Top Penalty Area (Opponent) */}
            <rect x="24" y="2" width="52" height="18" fill="none" stroke="#ffffff" strokeWidth="0.8" />
            <rect x="36" y="2" width="28" height="7" fill="none" stroke="#ffffff" strokeWidth="0.8" />
            <circle cx="50" cy="12" r="0.8" fill="#ffffff" />
            {/* Bottom Penalty Area (Our Goal) */}
            <rect x="24" y="80" width="52" height="18" fill="none" stroke="#ffffff" strokeWidth="0.8" />
            <rect x="36" y="91" width="28" height="7" fill="none" stroke="#ffffff" strokeWidth="0.8" />
            <circle cx="50" cy="88" r="0.8" fill="#ffffff" />
          </svg>

          {/* 11 Starters Cards Placed on Coordinates */}
          {coords.map((slot, index) => {
            const player = starters[index];
            if (!player) return null;

            const isSelected = selectedPlayerId === player.id;
            const posBadge = POSITION_COLORS[player.position] || { bg: 'bg-emerald-700', text: 'text-white' };

            // Energy bar color
            const energyColor = player.energy >= 80 ? 'bg-emerald-400' : player.energy >= 60 ? 'bg-amber-400' : 'bg-rose-500';

            const isCaptain = userClub.tactics.captainId === player.id;
            const isPenalty = userClub.tactics.penaltyTakerId === player.id;
            const isFreeKick = userClub.tactics.freeKickTakerId === player.id;
            const isCorner = userClub.tactics.cornerTakerId === player.id;

            return (
              <div
                key={player.id}
                draggable
                onDragStart={(e) => handleDragStart(e, player.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, player.id)}
                onClick={() => handlePlayerClick(player.id)}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  transform: 'translate(-50%, -50%)',
                  borderColor: isSelected ? undefined : clubTheme.subtleBorder,
                }}
                className={`absolute w-[84px] sm:w-[88px] p-1 rounded-md text-center cursor-pointer transition-all duration-150 shadow-md overflow-hidden ${
                  isSelected
                    ? 'bg-amber-400 text-black ring-4 ring-amber-300 ring-offset-2 ring-offset-black scale-110 z-30 shadow-[0_0_15px_rgba(251,191,36,0.8)] animate-pulse'
                    : 'bg-[#0a1811]/92 hover:bg-[#12281d] text-white border z-20 hover:scale-105'
                }`}
              >
                {/* Kit sash / shirt color accent stripe at the top */}
                {!isSelected && (
                  <div 
                    className="h-1.5 -mx-1 -mt-1 mb-1 rounded-t opacity-90"
                    style={{ background: clubTheme.stripeGradient }}
                  />
                )}

                {/* Header: Position Badge, Strength & Role Badges */}
                <div className="flex items-center justify-between px-1 mb-0.5">
                  <span className={`text-[9px] font-black px-1 rounded uppercase tracking-tighter ${posBadge.bg} ${posBadge.text}`}>
                    {player.position}
                  </span>
                  <div className="flex items-center space-x-0.5">
                    {isCaptain && <span className="text-[8px] bg-amber-500 text-black px-0.5 rounded font-black">C</span>}
                    {isPenalty && <span className="text-[8px] bg-red-500 text-white px-0.5 rounded font-black">P</span>}
                    {isFreeKick && <span className="text-[8px] bg-blue-500 text-white px-0.5 rounded font-black">F</span>}
                    {isCorner && <span className="text-[8px] bg-purple-500 text-white px-0.5 rounded font-black">E</span>}
                    <span className={`text-[11px] font-black font-mono-numbers ${isSelected ? 'text-black' : 'text-emerald-400'}`}>
                      {player.strength}
                    </span>
                  </div>
                </div>

                {/* Player Name */}
                <div className={`text-[11px] font-bold truncate leading-tight ${isSelected ? 'text-black' : 'text-slate-100'}`}>
                  {player.name}
                </div>

                {/* Energy Indicator & Mini-bar */}
                <div className="mt-1 space-y-0.5">
                  <div className="flex items-center justify-between text-[8px] font-mono leading-none px-0.5">
                    <span className={isSelected ? 'text-black font-black' : player.energy >= 80 ? 'text-emerald-400 font-bold' : player.energy >= 60 ? 'text-amber-300 font-bold' : 'text-rose-400 font-bold'}>
                      ⚡ {player.energy}%
                    </span>
                    {player.energy < 75 && (
                      <span className={isSelected ? 'text-black font-black' : 'text-amber-400 font-black tracking-tighter'}>
                        CANSADO
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-black/40 h-1 rounded-full overflow-hidden p-0.2">
                    <div
                      className={`h-full rounded-full ${energyColor}`}
                      style={{ width: `${player.energy}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Set Pieces Selectors Footer */}
        <div className="p-2 bg-[#0a1510] border-t border-[#183225] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] shrink-0">
          <div>
            <label className="text-slate-400 text-[10px] block font-semibold mb-0.5">Capitão:</label>
            <select
              value={userClub.tactics.captainId}
              onChange={(e) => updateTactics({ captainId: Number(e.target.value) })}
              className="w-full bg-[#122219] border border-[#1e3b2d] rounded text-emerald-300 px-1 py-1 text-xs focus:outline-none"
            >
              {starters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 text-[10px] block font-semibold mb-0.5">Pênaltis:</label>
            <select
              value={userClub.tactics.penaltyTakerId}
              onChange={(e) => updateTactics({ penaltyTakerId: Number(e.target.value) })}
              className="w-full bg-[#122219] border border-[#1e3b2d] rounded text-emerald-300 px-1 py-1 text-xs focus:outline-none"
            >
              {starters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 text-[10px] block font-semibold mb-0.5">Faltas:</label>
            <select
              value={userClub.tactics.freeKickTakerId}
              onChange={(e) => updateTactics({ freeKickTakerId: Number(e.target.value) })}
              className="w-full bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] rounded text-[var(--app-text-accent)] px-1 py-1 text-xs focus:outline-none"
            >
              {starters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 text-[10px] block font-semibold mb-0.5">Escanteios:</label>
            <select
              value={userClub.tactics.cornerTakerId}
              onChange={(e) => updateTactics({ cornerTakerId: Number(e.target.value) })}
              className="w-full bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] rounded text-[var(--app-text-accent)] px-1 py-1 text-xs focus:outline-none"
            >
              {starters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* RIGHT: DENSE SQUAD LIST (TITULARES E BANCO DE RESERVAS) */}
      <div className={`bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col shadow-lg flex-1 min-h-0 lg:overflow-hidden ${mobileTab === 'squad' ? 'flex' : 'hidden lg:flex'}`}>
        {/* Table header */}
        <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-highlight)] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-[var(--app-text-accent)]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Elenco do {userClub.name} ({userClub.squad.length} Jogadores)
            </h3>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            {/* If no match fixture is active, show Auto-Escalar Time here */}
            {(!userFixture || !nextOpponent) && (
              <button
                onClick={handleSmartAutoLineup}
                className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded border border-emerald-400/40 shadow active:scale-95 transition-all cursor-pointer"
                title="Escala os melhores titulares, descansa atletas fatigados e preenche o banco"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>Auto-Escalar Time</span>
              </button>
            )}
            {selectedPlayerId && (
              <span className="text-[11px] bg-amber-400 text-black px-2 py-0.5 rounded font-bold animate-pulse">
                Clique em outro jogador para trocar
              </span>
            )}
            <span className="text-slate-400 text-[11px] font-mono-numbers">
              Titulares: <strong className="text-[var(--app-text-accent)]">{starters.length}</strong>/11
            </span>
          </div>
        </div>

        {/* Squad bench status bar */}
        <div className="px-3 py-1.5 text-xs flex flex-wrap items-center justify-between gap-1.5 border-b border-[var(--app-border-subtle)] bg-[var(--app-surface-2)]/30 shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-slate-300">
            <span>
              Banco convocado: <strong className="text-white font-mono-numbers">{bench.length}/11</strong> (Demais atletas fora da súmula)
            </span>
            {bench.length < 11 && (
              <button
                onClick={() => {
                  sound.playClick();
                  setMatchBench(automaticMatchBench(userClub));
                  showToast('success', '📋 Banco de reservas completado!');
                }}
                className="px-2 py-0.5 bg-slate-700/80 hover:bg-slate-600 text-slate-200 border border-slate-500/40 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                title="Convoca automaticamente os melhores reservas para o banco"
              >
                Completar banco
              </button>
            )}
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-[11px] text-slate-400">
              Físico do banco:{' '}
              <strong className="text-emerald-400 font-mono">
                {bench.filter(p => p.energy >= 80).length} inteiros
              </strong>
              {bench.filter(p => p.energy < 75).length > 0 && (
                <span className="text-amber-400 font-mono ml-1">
                  ({bench.filter(p => p.energy < 75).length} fatigados)
                </span>
              )}
            </span>
          </div>
          {matchError && <p role="alert" className="text-amber-300 font-semibold text-[11px]">{matchError}</p>}
        </div>

        {/* Dense Squad Table with horizontal scroll support */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-xs brasfoot-table border-collapse min-w-[580px] lg:min-w-0">
            <thead>
              <tr className="sticky top-0 z-10">
                <th className="w-16 sm:w-18 text-center">Status</th>
                <th className="w-11 text-center">Pos</th>
                <th>Nome</th>
                <th className="w-10 text-center">Idade</th>
                <th className="w-12 text-center">Força</th>
                <th className="w-20 text-center">Energia</th>
                <th className="w-8 text-center hidden xl:table-cell">Pé</th>
                <th className="hidden lg:table-cell">Características</th>
                <th className="w-18 text-right hidden sm:table-cell">Salário</th>
                <th className="w-9 text-center">Troca</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#14281f] font-mono-numbers">
              {userClub.squad.map((player) => {
                const isSelected = selectedPlayerId === player.id;
                const posBadge = POSITION_COLORS[player.position] || { bg: 'bg-emerald-700', text: 'text-white' };
                const energyColor = player.energy >= 80 ? 'bg-emerald-400' : player.energy >= 60 ? 'bg-amber-400' : 'bg-rose-500';

                return (
                  <tr
                    key={player.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, player.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, player.id)}
                    onClick={() => handlePlayerClick(player.id)}
                    style={
                      isSelected
                        ? undefined
                        : player.isStarter
                        ? { borderLeft: `3px solid ${clubTheme.primaryAccent}` }
                        : undefined
                    }
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-400/25 border-l-4 border-l-amber-400 text-white font-bold'
                        : player.isStarter
                        ? 'bg-[#10241a] hover:bg-[#163024] text-slate-100'
                        : 'hover:bg-[#13261d] text-slate-400 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* Unified Status: Starter / Bench / Out / Injury / Suspended */}
                    <td className="text-center py-0.5 px-1">
                      {player.injured ? (
                        <span className="h-6 sm:h-6.5 w-full px-1 py-0.5 rounded text-[10px] font-black bg-rose-950 text-rose-300 border border-rose-800/80 flex items-center justify-center">
                          DM
                        </span>
                      ) : player.suspended ? (
                        <span className="h-6 sm:h-6.5 w-full px-1 py-0.5 rounded text-[10px] font-black bg-amber-950 text-amber-300 border border-amber-800/80 flex items-center justify-center">
                          SUSP
                        </span>
                      ) : player.isStarter ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStarter(player.id);
                          }}
                          title="Titular (clique para retirar dos titulares)"
                          className="h-6 sm:h-6.5 w-full px-1 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-black hover:bg-emerald-400 transition-all shadow-xs cursor-pointer flex items-center justify-center active:scale-95"
                        >
                          TITULAR
                        </button>
                      ) : benchIds.includes(player.id) ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMatchBench(benchIds.filter((id) => id !== player.id));
                          }}
                          title="Banco de reservas (clique para retirar da súmula)"
                          className="h-6 sm:h-6.5 w-full px-1 py-0.5 rounded text-[10px] font-bold bg-cyan-900 text-cyan-200 hover:bg-cyan-800 border border-cyan-700/50 transition-all cursor-pointer flex items-center justify-center active:scale-95"
                        >
                          BANCO
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (starters.length < 11) {
                              toggleStarter(player.id);
                            } else if (benchIds.length < 11) {
                              setMatchBench([...benchIds, player.id]);
                            }
                          }}
                          title={starters.length < 11 ? "Colocar como titular" : benchIds.length < 11 ? "Colocar no banco de reservas" : "Súmula completa"}
                          disabled={starters.length >= 11 && benchIds.length >= 11}
                          className="h-6 sm:h-6.5 w-full px-1 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center active:scale-95"
                        >
                          FORA
                        </button>
                      )}
                    </td>

                    {/* Position */}
                    <td className="text-center py-1 font-sans">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${posBadge.bg} ${posBadge.text}`}>
                        {player.position}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="py-1 font-sans font-semibold text-slate-200">
                      <div className="flex items-center space-x-1.5">
                        <span className="truncate max-w-[130px] lg:max-w-[150px]">{player.name}</span>
                        {player.isStar && <span className="text-amber-400 text-xs">★</span>}
                      </div>
                    </td>

                    {/* Age */}
                    <td className="text-center py-1 text-slate-300">{player.age}</td>

                    {/* Strength */}
                    <td className="text-center py-1 font-bold text-emerald-400 text-[12px]">
                      {player.strength}
                    </td>

                    {/* Energy bar */}
                    <td className="py-1 px-2">
                      <div className="flex items-center space-x-1.5">
                        <div className="flex-1 bg-black/40 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${energyColor}`}
                            style={{ width: `${player.energy}%` }}
                          />
                        </div>
                        <span className={`text-[10px] w-7 text-right font-bold font-mono ${
                          player.energy >= 80 ? 'text-emerald-400' : player.energy >= 60 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {player.energy}%
                        </span>
                        {player.energy < 75 && (
                          <span title="Fadiga física (<75%)" className="text-[8px] bg-amber-950/80 text-amber-300 border border-amber-800/80 px-1 py-0.2 rounded font-black uppercase">
                            ⚠️
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Preferred foot */}
                    <td className="text-center py-1 text-[11px] text-slate-300 hidden xl:table-cell">{player.foot}</td>

                    {/* Skills */}
                    <td className="py-1 font-sans text-[11px] text-slate-300 truncate max-w-[120px] hidden lg:table-cell">
                      {player.skill1} / {player.skill2}
                    </td>

                    {/* Salary */}
                    <td className="text-right py-1 text-[11px] text-slate-400 hidden sm:table-cell">
                      R$ {(player.salary / 1000).toFixed(0)}k
                    </td>

                    {/* Swap button icon */}
                    <td className="text-center py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayerClick(player.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-[#1b3b2c] cursor-pointer"
                        title="Selecionar para Troca"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer tip */}
        <div className="px-3 py-1.5 bg-[#0a1510] border-t border-[#183225] flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>Dica: Arraste os jogadores ou clique em dois para inverter titular e reserva.</span>
          <span className="text-emerald-400 font-semibold">11 Titulares Escalados</span>
        </div>
      </div>
    </div>
  </div>
);
};
