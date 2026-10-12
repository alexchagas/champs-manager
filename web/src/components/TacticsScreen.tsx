import React, { useState } from 'react';
import { MatchLineupPanel } from './MatchLineupPanel';
import { automaticMatchBench } from '../engine/careerEconomy';
import { useGame } from '../state/GameContext';
import { 
  Users, 
  Shield, 
  Flame, 
  Zap, 
  RotateCcw, 
  Check, 
  Award, 
  Crosshair, 
  CornerDownRight, 
  HelpCircle,
  ArrowUpDown
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
  const { gameState, setScreen, setMatchBench, matchError, userClub, updateTactics, swapPlayers, toggleStarter, autoSelectBestLineup } = useGame();
  const clubTheme = getClubTheme(userClub);

  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [draggedPlayerId, setDraggedPlayerId] = useState<number | null>(null);

  const starters = userClub.squad.filter((p) => p.isStarter);
  const benchIds = userClub.namedSubstituteIds || [];
  const bench = userClub.squad.filter((p) => benchIds.includes(p.id));

  const currentFormation = userClub.tactics.formation;
  const currentMentality = userClub.tactics.mentality;
  const coords = FORMATION_COORDINATES[currentFormation];

  const sectorStrength = calculateSectorStrength(starters);

  if (gameState.activeMatch && gameState.activeMatch.phase !== 'committed') return <div className="flex-1 overflow-auto p-4 space-y-3">
    <button onClick={() => setScreen('live_match')} className="bg-emerald-700 p-2 rounded">Voltar à partida</button>
    <MatchLineupPanel/>
  </div>;

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
    <div className="flex-1 flex overflow-hidden bg-[var(--app-bg-deep)] p-3 gap-3 h-[calc(100vh-3.5rem)] select-none">
      {/* LEFT: PITCH & TACTICAL BOARD */}
      <div className="w-[520px] flex flex-col bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg overflow-hidden shadow-lg shrink-0">
        {/* Top Control Bar: Formation, Mentality, Power summary */}
        <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-highlight)] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-300 font-semibold">Formação:</span>
            <select
              value={currentFormation}
              onChange={(e) => {
                sound.playClick();
                updateTactics({ formation: e.target.value as FormationType });
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

            <button
              onClick={() => autoSelectBestLineup(currentFormation)}
              className="flex items-center space-x-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded border border-emerald-400/40 shadow active:scale-95 transition-all cursor-pointer ml-1"
              title="Auto-escalar / Melhores: aloca os melhores jogadores estritamente para suas posições naturais com base na força e energia"
            >
              <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
              <span>Auto-escalar</span>
            </button>
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
                className={`absolute w-24 p-1 rounded-md text-center cursor-pointer transition-all duration-150 shadow-md overflow-hidden ${
                  isSelected
                    ? 'bg-amber-400 text-black ring-3 ring-amber-300 ring-offset-2 ring-offset-black scale-110 z-30'
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

                {/* Energy Mini-bar */}
                <div className="mt-1 w-full bg-black/40 h-1.5 rounded-full overflow-hidden p-0.2">
                  <div
                    className={`h-full rounded-full ${energyColor}`}
                    style={{ width: `${player.energy}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Set Pieces Selectors Footer */}
        <div className="p-2.5 bg-[#0a1510] border-t border-[#183225] grid grid-cols-4 gap-2 text-[11px] shrink-0">
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
      <div className="flex-1 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-lg">
        {/* Table header */}
        <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-highlight)] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-[var(--app-text-accent)]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Elenco do {userClub.name} ({userClub.squad.length} Jogadores)
            </h3>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={() => autoSelectBestLineup(currentFormation)}
              className="flex items-center space-x-1.5 px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded border border-emerald-400/50 shadow active:scale-95 transition-all cursor-pointer mr-1"
              title="Escala automaticamente os melhores jogadores estritamente para suas posições naturais com base na força e energia"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>Auto-escalar / Melhores</span>
            </button>
            {selectedPlayerId && (
              <span className="text-[11px] bg-amber-400 text-black px-2 py-0.5 rounded font-bold animate-pulse">
                Clique em outro jogador para trocar
              </span>
            )}
            <span className="text-slate-400 text-[11px]">
              Titulares: <strong className="text-[var(--app-text-accent)]">{starters.length}</strong> / 11
            </span>
          </div>
        </div>

        <div className="p-2 text-xs space-y-1 border-b border-[var(--app-border-subtle)]">
          <span>Banco convocado: <strong>{bench.length}/11</strong> · Demais atletas ficam fora da súmula.</span>
          <button onClick={() => setMatchBench(automaticMatchBench(userClub))} className="ml-3 p-1 bg-emerald-800 rounded">Convocação automática</button>
          {matchError && <p role="alert" className="text-amber-300">{matchError}</p>}
        </div>
        {/* Dense Squad Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs brasfoot-table border-collapse">
            <thead>
              <tr className="sticky top-0 z-10">
                <th className="w-9 text-center">Tit</th>
                <th className="text-center">Súmula</th>
                <th className="w-12 text-center">Pos</th>
                <th>Nome</th>
                <th className="w-10 text-center">Idade</th>
                <th className="w-14 text-center">Força</th>
                <th className="w-20 text-center">Energia</th>
                <th className="w-8 text-center">Pé</th>
                <th>Características</th>
                <th className="w-20 text-right">Salário</th>
                <th className="w-10 text-center">Troca</th>
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
                    {/* Starter check */}
                    <td className="text-center py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStarter(player.id);
                        }}
                        className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold mx-auto cursor-pointer ${
                          player.isStarter
                            ? 'bg-emerald-500 text-black'
                            : 'bg-[#193326] text-slate-500 hover:text-white'
                        }`}
                      >
                        {player.isStarter ? 'T' : '—'}
                      </button>
                    </td>

                    <td className="text-center"><button
                      disabled={player.isStarter || player.injured || player.suspended}
                      onClick={e => { e.stopPropagation(); setMatchBench(benchIds.includes(player.id) ? benchIds.filter(id => id !== player.id) : [...benchIds,player.id]); }}
                      className="p-1 rounded bg-slate-800 disabled:opacity-40">
                      {player.injured ? 'Lesão' : player.suspended ? 'Suspenso' : player.isStarter ? 'Titular' : benchIds.includes(player.id) ? 'Banco' : 'Fora'}
                    </button></td>
                    {/* Position */}
                    <td className="text-center py-1 font-sans">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${posBadge.bg} ${posBadge.text}`}>
                        {player.position}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="py-1 font-sans font-semibold text-slate-200">
                      <div className="flex items-center space-x-1.5">
                        <span className="truncate max-w-[130px]">{player.name}</span>
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
                        <span className="text-[10px] w-6 text-right font-medium text-slate-300">
                          {player.energy}%
                        </span>
                      </div>
                    </td>

                    {/* Preferred foot */}
                    <td className="text-center py-1 text-[11px] text-slate-300">{player.foot}</td>

                    {/* Skills */}
                    <td className="py-1 font-sans text-[11px] text-slate-300 truncate max-w-[120px]">
                      {player.skill1} / {player.skill2}
                    </td>

                    {/* Salary */}
                    <td className="text-right py-1 text-[11px] text-slate-400">
                      R$ {(player.salary / 1000).toFixed(0)}k
                    </td>

                    {/* Swap button icon */}
                    <td className="text-center py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayerClick(player.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-[#1b3b2c]"
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
  );
};
