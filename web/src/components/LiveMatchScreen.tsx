import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { useGame } from '../state/GameContext';
import { MatchLineupPanel } from './MatchLineupPanel';
import { ClubCrest } from './ClubCrest';
import { sound } from '../audio/soundEngine';
import { 
  Play, 
  Pause, 
  FastForward, 
  Volume2, 
  VolumeX, 
  ArrowLeft, 
  Clock, 
  Users, 
  BarChart3, 
  AlertTriangle,
  CheckCircle2,
  ListOrdered,
  Activity,
  Flame,
  ShieldAlert,
  Target,
  Sparkles,
  Footprints,
  X
} from 'lucide-react';

const POSITION_COLORS: Record<string, { bg: string; text: string }> = {
  GOL: { bg: 'bg-amber-600', text: 'text-amber-100' },
  LAT: { bg: 'bg-cyan-600', text: 'text-cyan-100' },
  ZAG: { bg: 'bg-blue-600', text: 'text-blue-100' },
  VOL: { bg: 'bg-emerald-600', text: 'text-emerald-100' },
  MEI: { bg: 'bg-purple-600', text: 'text-purple-100' },
  ATA: { bg: 'bg-rose-600', text: 'text-rose-100' },
};

export const LiveMatchScreen: React.FC = () => {
  const { gameState, dispatchMatch, completeRound, updateOptions, setScreen, matchError, viewedClubId } = useGame();
  const session = gameState.activeMatch;
  const seenEvents = useRef(session?.events.length ?? 0);
  const pending = session?.pendingDecision;
  const finished = session?.phase === 'full_time' || session?.phase === 'committed';

  type PenaltyZone = 'top-left' | 'bottom-left' | 'center' | 'top-right' | 'bottom-right';
  type PenaltyStep = 'aim' | 'runup' | 'kick' | 'outcome';
  type PenaltyOutcome = 'goal' | 'saved' | 'post' | 'wide';

  interface UserPenaltyKickState {
    takerId: number;
    takerName: string;
    takerStrength: number;
    gkName: string;
    gkStrength: number;
    selectedZone: PenaltyZone;
    step: PenaltyStep;
    gkDive: 'left' | 'center' | 'right';
    outcome: PenaltyOutcome;
    outcomeTitle: string;
    outcomeNarrative: string;
    isGoal: boolean;
    scoreDisplay: string;
  }

  interface OpponentPenaltyData {
    takerName: string;
    takerStrength: number;
    gkName: string;
    gkStrength: number;
    isGoal: boolean;
    step: PenaltyStep;
    userGkChoice: 'left' | 'center' | 'right';
    takerTargetZone: PenaltyZone;
    outcome: PenaltyOutcome;
    outcomeTitle: string;
    outcomeNarrative: string;
    scoreDisplay: string;
  }

  interface ShootoutKickDisplay {
    index: number;
    side: 0 | 1;
    takerId: number;
    takerName: string;
    takerPosition: string;
    takerStrength: number;
    isGoal: boolean;
    step: 'aim' | 'kick' | 'outcome';
    narrative: string;
  }

  const [userPenaltyKick, setUserPenaltyKick] = useState<UserPenaltyKickState | null>(null);
  const [selectedPenaltyTakerId, setSelectedPenaltyTakerId] = useState<number | null>(null);
  const [selectedPenaltyZone, setSelectedPenaltyZone] = useState<PenaltyZone>('bottom-right');
  const [opponentPenalty, setOpponentPenalty] = useState<OpponentPenaltyData | null>(null);
  const [mobileTab, setMobileTab] = useState<'events' | 'lineup' | 'stats'>('events');
  const [showTacticsModal, setShowTacticsModal] = useState(false);
  const [inspectedParallelFixtureId, setInspectedParallelFixtureId] = useState<number | null>(null);

  // Shootout automated states
  const [currentShootoutKick, setCurrentShootoutKick] = useState<ShootoutKickDisplay | null>(null);
  const [revealedShootoutKicks, setRevealedShootoutKicks] = useState<Array<{
    side: 0 | 1;
    isGoal: boolean;
    takerName: string;
    index: number;
  }>>([]);

  const handleCloseUserPenaltyModal = () => {
    setUserPenaltyKick(null);
    setSelectedPenaltyTakerId(null);
  };

  const handleCloseOpponentPenaltyModal = () => {
    setOpponentPenalty(null);
    dispatchMatch({ type: 'resume' });
  };

  // Anti-spoiler score calculations
  const revealedPenaltyScore: [number, number] = useMemo(() => {
    if (!session || !session.penaltyAttempts.some(Boolean)) return [0, 0];
    if (finished || session.phase === 'full_time' || session.phase === 'committed') {
      return session.penaltyScore;
    }
    const homeGoals = revealedShootoutKicks.filter(k => k.side === 0 && k.isGoal).length;
    const awayGoals = revealedShootoutKicks.filter(k => k.side === 1 && k.isGoal).length;
    return [homeGoals, awayGoals];
  }, [session, finished, revealedShootoutKicks]);

  const visibleScore = useMemo(() => {
    if (!session) return [0, 0];
    if (opponentPenalty && opponentPenalty.step !== 'outcome' && opponentPenalty.isGoal) {
      const oppSideIndex = 1 - (session.humanSide ?? 0);
      return [
        oppSideIndex === 0 ? session.score[0] - 1 : session.score[0],
        oppSideIndex === 1 ? session.score[1] - 1 : session.score[1],
      ];
    }
    return session.score;
  }, [session, opponentPenalty]);

  const visiblePenaltyScore = useMemo(() => {
    if (!session || !session.penaltyAttempts.some(Boolean)) return null;
    if (finished || session.phase === 'full_time' || session.phase === 'committed') {
      return session.penaltyScore;
    }
    return revealedPenaltyScore;
  }, [session, finished, revealedPenaltyScore]);

  // Auto-pause and show tactical interventions when a decision is pending (regulation only)
  useEffect(() => {
    if (pending && session?.phase !== 'shootout') {
      if (session && !session.paused) {
        dispatchMatch({ type: 'pause' });
      }
      setMobileTab('lineup');
    }
  }, [pending?.kind, session?.phase]);

  // Main simulation timer loop (regulation only, shootout handled by dedicated orchestrator)
  useEffect(() => {
    if (!session || session.paused || finished || session.phase === 'shootout' || gameState.activeScreen !== 'live_match' || viewedClubId !== null) return;
    const timer = window.setInterval(
      () => dispatchMatch({ type: 'advance' }), 
      session.speed === 5 ? 120 : session.speed === 2 ? 350 : 750
    );
    return () => window.clearInterval(timer);
  }, [session?.paused, session?.speed, session?.phase, finished, gameState.activeScreen, viewedClubId, dispatchMatch]);

  // Event sounds & penalty detection
  useEffect(() => {
    if (!session) return;
    const humanSide = session.humanSide ?? 0;
    const userTeamKind = humanSide === 1 ? 'away' : 'home';
    const newEvents = session.events.slice(seenEvents.current);

    for (const event of newEvents) {
      if (event.type === 'goal') {
        const isUserGoal = event.team === userTeamKind;
        const isPenaltyGoal = event.description?.includes('cobrança de pênalti');
        if (!isPenaltyGoal) {
          if (isUserGoal) {
            sound.playGoal();
          } else {
            sound.playGoalConceded();
          }
        }
      } else if (event.type === 'penalty') {
        sound.playPenalty();
      } else if (event.type === 'red_card') {
        sound.playRedCard();
      } else if (event.type === 'injury') {
        sound.playInjury();
      } else if (event.type === 'halftime') {
        sound.playHalfTime();
      } else if (event.type === 'fulltime') {
        sound.playFullTimeWhistle();
      } else if (event.type === 'yellow_card') {
        sound.playWhistle(true);
      }
    }

    // Detect if opponent was awarded a penalty in this tick (regulation only)
    const oppPenaltyEvent = newEvents.find(e => e.type === 'penalty' && e.team !== userTeamKind);
    if (oppPenaltyEvent && session.phase !== 'shootout') {
      const resolution = newEvents.find(e => (e.type === 'goal' || e.type === 'penalty_missed') && e.team !== userTeamKind);
      const isGoal = resolution?.type === 'goal' || false;
      const oppTeamData = session.teams[1 - humanSide];
      const userTeamData = session.teams[humanSide];
      const takerName = resolution?.scorerName || resolution?.description?.split(':')[0] || oppTeamData?.players[0]?.name || 'Cobrador';
      const oppPlayer = oppTeamData?.players.find(p => p.name === takerName) ?? oppTeamData?.players[0];
      const ourGk = userTeamData?.players.find(p => userTeamData.onFieldRoleByPlayerId[String(p.id)] === 'GOL' || p.position === 'GOL') ?? userTeamData?.players[0];

      const zones: PenaltyZone[] = ['top-left', 'bottom-left', 'center', 'top-right', 'bottom-right'];
      const takerTargetZone = zones[Math.floor(Math.random() * zones.length)];
      let outcome: PenaltyOutcome = 'goal';
      let outcomeTitle = 'GOL DO ADVERSÁRIO';
      let outcomeNarrative = `${takerName} bateu com precisão no cantinho e balançou as redes contra ${ourGk?.name || 'seu goleiro'}.`;

      if (!isGoal) {
        const roll = Math.random();
        if (roll < 0.60) {
          outcome = 'saved';
          outcomeTitle = 'DEFEEEEEENDEU O NOSSO GOLEIRO!';
          outcomeNarrative = `${ourGk?.name || 'Seu goleiro'} operou um verdadeiro milagre! Voou no canto certo e espalmou a cobrança para fora!`;
        } else if (roll < 0.85) {
          outcome = 'post';
          outcomeTitle = 'NA TRAVE! NO POSTE!';
          outcomeNarrative = `${takerName} soltou a pancada, a bola explodiu na trave com estrondo e não entrou!`;
        } else {
          outcome = 'wide';
          outcomeTitle = 'PRA FOOOORA!';
          outcomeNarrative = `${takerName} isolou! A batida foi torta e passou longe da meta de ${ourGk?.name || 'seu goleiro'}!`;
        }
      }

      // Pre-penalty score to eliminate spoiler in regulation
      const oppSideIndex = 1 - humanSide;
      const prePenaltyScore: [number, number] = [
        oppSideIndex === 0 && isGoal ? session.score[0] - 1 : session.score[0],
        oppSideIndex === 1 && isGoal ? session.score[1] - 1 : session.score[1],
      ];

      setOpponentPenalty({
        takerName,
        takerStrength: oppPlayer?.strength ?? 82,
        gkName: ourGk?.name ?? 'Goleiro',
        gkStrength: ourGk?.strength ?? 80,
        isGoal,
        step: 'aim',
        userGkChoice: 'right',
        takerTargetZone,
        outcome,
        outcomeTitle,
        outcomeNarrative,
        scoreDisplay: `${prePenaltyScore[0]} x ${prePenaltyScore[1]}`,
      });
      if (!session.paused) {
        dispatchMatch({ type: 'pause' });
      }
    }

    seenEvents.current = session.events.length;
  }, [session?.events.length, session, dispatchMatch]);

  // Sync existing shootout kicks if loaded mid-shootout
  useEffect(() => {
    if (session && session.penaltyAttempts.some(Boolean) && revealedShootoutKicks.length === 0 && session.events.length > 0) {
      const existing = session.events
        .filter(e => e.type === 'shootout_kick')
        .map((e, idx) => ({
          side: (e.team === 'home' ? 0 : 1) as 0 | 1,
          isGoal: e.description?.includes('gol') || false,
          takerName: e.scorerName || e.description?.split(':')[0] || 'Cobrador',
          index: idx,
        }));
      if (existing.length > 0) {
        setRevealedShootoutKicks(existing);
      }
    }
  }, [session?.phase]);

  // Automated Shootout Orchestrator with Brasfoot timing & anti-spoiler suspense
  useEffect(() => {
    if (!session || gameState.activeScreen !== 'live_match' || viewedClubId !== null) return;
    if (session.phase !== 'shootout' || finished) return;

    const shootoutEvents = session.events.filter(e => e.type === 'shootout_kick');
    const revealedCount = revealedShootoutKicks.length;

    // If currently animating a kick, wait for it to complete
    if (currentShootoutKick) return;

    // If there is an unrevealed kick produced by the engine:
    if (revealedCount < shootoutEvents.length) {
      const nextKick = shootoutEvents[revealedCount];
      const side = (nextKick.team === 'home' ? 0 : 1) as 0 | 1;
      const oppSide = (1 - side) as 0 | 1;
      const isGoal = nextKick.description?.includes('gol') || false;
      const takerName = nextKick.scorerName || nextKick.description?.split(':')[0] || 'Cobrador';
      const teamData = session.teams[side];
      const oppTeamData = session.teams[oppSide];
      const player = teamData?.players.find(p => p.id === nextKick.scorerId || p.name === takerName) ?? teamData?.players[0];
      const gk = oppTeamData?.players.find(p => oppTeamData.onFieldRoleByPlayerId[String(p.id)] === 'GOL' || p.position === 'GOL') ?? oppTeamData?.players[0];

      // Stage 1: Aim / Approaching (1200ms) - Placar inalterado
      setCurrentShootoutKick({
        index: revealedCount,
        side,
        takerId: nextKick.scorerId ?? 0,
        takerName,
        takerPosition: player?.position ?? 'ATA',
        takerStrength: player?.strength ?? 80,
        isGoal,
        step: 'aim',
        narrative: `${takerName} ajeita a bola com calma na marca da cal... Respira fundo e vai pra bola!`,
      });
      sound.playWhistle(true);
      sound.playHeartbeat();

      const kickTimer = window.setTimeout(() => {
        // Stage 2: Kick (400ms)
        setCurrentShootoutKick(prev => prev ? { ...prev, step: 'kick' } : null);
        sound.playKick();

        const outcomeTimer = window.setTimeout(() => {
          // Stage 3: Outcome (1400ms) - Placar atualiza neste instante exato!
          const outcomeNarrative = isGoal
            ? `GOOOOOOOL! ${takerName} soltou a bomba no canto e estufou as redes contra ${gk?.name || 'o goleiro'}!`
            : `DEFEEEEEENDEU O GOLEIRO! ${gk?.name || 'O goleiro'} adivinhou a intenção e operou um verdadeiro milagre contra ${takerName}!`;

          setCurrentShootoutKick(prev => prev ? {
            ...prev,
            step: 'outcome',
            narrative: outcomeNarrative,
          } : null);

          if (isGoal) {
            sound.playGoal();
            try {
              confetti({ particleCount: 75, spread: 75, origin: { y: 0.6 } });
            } catch {}
          } else {
            sound.playCrowdGasp();
          }

          // Revela a pontuação apenas agora!
          setRevealedShootoutKicks(prev => [
            ...prev,
            { side, isGoal, takerName, index: revealedCount }
          ]);

          const nextTimer = window.setTimeout(() => {
            setCurrentShootoutKick(null);
            // Se o jogo ainda não acabou na engine, dispara o próximo chute
            if (session.phase === 'shootout' && !session.paused) {
              dispatchMatch({ type: 'advance' });
            }
          }, 1400);

          return () => window.clearTimeout(nextTimer);
        }, 400);

        return () => window.clearTimeout(outcomeTimer);
      }, 1200);

      return () => window.clearTimeout(kickTimer);
    } else if (revealedCount === shootoutEvents.length && session.phase === 'shootout') {
      // Nenhum chute pendente na fila, dispara o próximo após 800ms
      const startTimer = window.setTimeout(() => {
        dispatchMatch({ type: 'advance' });
      }, 800);
      return () => window.clearTimeout(startTimer);
    }
  }, [
    session?.events.length, 
    session?.phase, 
    session?.paused,
    revealedShootoutKicks.length, 
    currentShootoutKick, 
    finished, 
    gameState.activeScreen, 
    viewedClubId, 
    dispatchMatch
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (viewedClubId !== null) return;
      if ((e.target as HTMLElement)?.closest('input,select,textarea,button')) return;
      if (e.code === 'Space') { 
        e.preventDefault(); 
        if (finished) completeRound(); 
        else if (userPenaltyKick && userPenaltyKick.step === 'outcome') {
          handleCloseUserPenaltyModal();
        } else if (opponentPenalty && opponentPenalty.step === 'outcome') {
          handleCloseOpponentPenaltyModal();
        } else if (!pending && !userPenaltyKick && !opponentPenalty) {
          dispatchMatch({ type: session?.paused ? 'resume' : 'pause' }); 
        }
      }
      if (e.code === 'Escape') { 
        e.preventDefault(); 
        if (inspectedParallelFixtureId !== null) {
          setInspectedParallelFixtureId(null);
        } else if (showTacticsModal) {
          setShowTacticsModal(false);
        } else {
          setScreen('overview'); 
        }
      }
    };
    window.addEventListener('keydown', handle); 
    return () => window.removeEventListener('keydown', handle);
  }, [session?.paused, pending, finished, viewedClubId, showTacticsModal, inspectedParallelFixtureId, completeRound, dispatchMatch, setScreen]);

  useEffect(() => {
    const pauseWhenHidden = () => { 
      if (document.hidden) dispatchMatch({ type: 'pause' }); 
    };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, [dispatchMatch]);

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-300">
        <p className="text-base font-semibold mb-3">Nenhuma partida ativa.</p>
        {matchError && <p role="alert" className="text-amber-400 text-sm mb-4">{matchError}</p>}
        <button 
          onClick={() => setScreen('overview')}
          className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
        >
          Voltar à Visão Geral
        </button>
      </div>
    );
  }

  const fixture = gameState.calendar.find(f => f.id === session.fixtureId)!;
  const clubs = session.teams.map(t => gameState.clubs.find(c => c.id === t.clubId)!);
  const clock = `${session.clock.minute}${session.clock.added ? '+' + session.clock.added : ''}′`;
  const phases: Record<string, string> = {
    first_half: '1º tempo',
    halftime: 'Intervalo',
    second_half: '2º tempo',
    extra_time: 'Prorrogação',
    shootout: 'Pênaltis',
    full_time: 'Encerrado',
    committed: 'Finalizado'
  };
  const scoresMode = gameState.options.liveScores || 'date';
  const totalPossession = session.stats.possession[0] + session.stats.possession[1];
  const possession = totalPossession ? Math.round((session.stats.possession[0] * 100) / totalPossession) : 50;
  const humanSide = session.humanSide ?? 0;
  const userTeam = session.teams[humanSide];
  const oppTeam = session.teams[1 - humanSide];
  const displayedEvents = useMemo(() => [...session.events].reverse(), [session.events]);

  // ================= VISUAL DO GOL E COBRANÇA DE PÊNALTI =================
  const ZONE_INFO: Record<PenaltyZone, { top: string; left: string; label: string; desc: string }> = {
    'top-left': { top: '22%', left: '20%', label: 'Gaveta Esq.', desc: 'Ângulo esquerdo: bola no cantinho alto, indefensável!' },
    'bottom-left': { top: '68%', left: '20%', label: 'Rasteiro Esq.', desc: 'Cantinho esquerdo: chute colocado e rente à trave.' },
    'center': { top: '45%', left: '50%', label: 'Meio / Cavada', desc: 'Meio do gol: frieza ou cavadinha. Golaço se o goleiro cair!' },
    'top-right': { top: '22%', left: '80%', label: 'Gaveta Dir.', desc: 'Ângulo direito: no ninho da coruja, sem chances para o goleiro.' },
    'bottom-right': { top: '68%', left: '80%', label: 'Rasteiro Dir.', desc: 'Cantinho direito: batida firme na bochecha da rede.' },
  };

  const renderGoalVisual = (
    step: PenaltyStep,
    targetZone: PenaltyZone,
    gkDive: 'left' | 'center' | 'right',
    outcome: PenaltyOutcome,
    isOpponent: boolean,
    onSelectZone?: (z: PenaltyZone) => void,
    userGkChoice?: 'left' | 'center' | 'right',
    gkName?: string
  ) => {
    const isGoalScored = step === 'outcome' && outcome === 'goal';
    const effectiveGkDive = isOpponent && step === 'aim' ? (userGkChoice || 'center') : gkDive;

    return (
      <div className="relative w-full h-52 sm:h-60 rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950/80 border-2 border-slate-700/80 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] overflow-hidden select-none">
        {/* Stadium Floodlight Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

        {/* Goal Net Background Mesh */}
        <div className={`absolute top-4 bottom-10 left-7 right-7 border-b border-white/20 bg-[linear-gradient(to_right,#ffffff15_1px,transparent_1px),linear-gradient(to_bottom,#ffffff15_1px,transparent_1px)] bg-[size:14px_14px] transition-all duration-300 ${
          isGoalScored ? 'bg-emerald-500/15 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-pulse' : ''
        }`} />

        {/* Pitch Grass Floor & Penalty Mark */}
        <div className="absolute bottom-0 left-0 right-0 h-11 bg-gradient-to-t from-emerald-900/90 via-emerald-800/80 to-emerald-950/40 border-t border-emerald-500/30 flex items-center justify-center">
          {/* Penalty Spot */}
          <div className="w-3 h-3 rounded-full bg-white/90 shadow-[0_0_10px_white] relative">
            {step === 'runup' && (
              <span className="absolute -inset-1 rounded-full border border-amber-400 animate-ping" />
            )}
          </div>
        </div>

        {/* Goal Posts & Crossbar */}
        <div className="absolute top-4 left-6 right-6 h-3 rounded bg-gradient-to-b from-slate-200 via-white to-slate-400 shadow-[0_0_15px_rgba(255,255,255,0.4)] z-20" />
        <div className="absolute top-4 bottom-10 left-6 w-3 rounded-b bg-gradient-to-r from-slate-300 via-white to-slate-400 shadow-[0_0_15px_rgba(255,255,255,0.4)] z-20" />
        <div className="absolute top-4 bottom-10 right-6 w-3 rounded-b bg-gradient-to-l from-slate-300 via-white to-slate-400 shadow-[0_0_15px_rgba(255,255,255,0.4)] z-20" />

        {/* Goalkeeper Silhouette */}
        <div 
          className={`absolute z-10 transition-all duration-700 ease-out flex flex-col items-center justify-center pointer-events-none ${
            step === 'aim' || step === 'runup'
              ? (effectiveGkDive === 'left' ? 'top-[44%] left-[38%] -translate-x-1/2 -translate-y-1/2' : effectiveGkDive === 'right' ? 'top-[44%] left-[62%] -translate-x-1/2 -translate-y-1/2' : 'top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse')
              : gkDive === 'left'
              ? 'top-[48%] left-[24%] -translate-x-1/2 -translate-y-1/2 -rotate-25 scale-110'
              : gkDive === 'right'
              ? 'top-[48%] left-[76%] -translate-x-1/2 -translate-y-1/2 rotate-25 scale-110'
              : 'top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 scale-105'
          }`}
        >
          <div className={`p-2 rounded-xl flex items-center justify-center border shadow-lg ${
            step === 'outcome' && outcome === 'saved'
              ? 'bg-amber-500/90 border-amber-300 text-slate-950 ring-4 ring-amber-400 animate-bounce'
              : isOpponent
              ? 'bg-emerald-900/90 border-emerald-400/60 text-white'
              : 'bg-sky-900/80 border-sky-400/60 text-white'
          }`}>
            <span className="text-xl sm:text-2xl leading-none">🧤</span>
          </div>
          <span className="text-[10px] font-black text-slate-200 mt-1 bg-black/75 px-1.5 py-0.5 rounded border border-slate-700 truncate max-w-[90px]">
            {gkName || 'Goleiro'}
          </span>
        </div>

        {/* Soccer Ball */}
        <div 
          className={`absolute z-30 transition-all duration-700 ease-out flex items-center justify-center pointer-events-none ${
            step === 'aim' || step === 'runup'
              ? 'bottom-2.5 left-1/2 -translate-x-1/2 scale-100'
              : step === 'kick' || step === 'outcome'
              ? (outcome === 'saved'
                  ? (gkDive === 'left' ? 'top-[48%] left-[24%] -translate-x-1/2 -translate-y-1/2 scale-90' : gkDive === 'right' ? 'top-[48%] left-[76%] -translate-x-1/2 -translate-y-1/2 scale-90' : 'top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 scale-90')
                  : outcome === 'post'
                  ? (targetZone.includes('top') || targetZone === 'center'
                      ? 'top-[22px] left-1/2 -translate-x-1/2 scale-95'
                      : targetZone.includes('left')
                      ? 'top-[65%] left-[34px] -translate-x-1/2 scale-95'
                      : 'top-[65%] right-[34px] translate-x-1/2 scale-95')
                  : outcome === 'wide'
                  ? (targetZone.includes('left') ? 'top-[35%] left-[2px] -translate-x-1/2 scale-75' : 'top-[35%] right-[2px] translate-x-1/2 scale-75')
                  : (/* goal */
                      targetZone === 'top-left' ? 'top-[24%] left-[20%] -translate-x-1/2 -translate-y-1/2 scale-85' :
                      targetZone === 'bottom-left' ? 'top-[68%] left-[20%] -translate-x-1/2 -translate-y-1/2 scale-85' :
                      targetZone === 'center' ? 'top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 scale-85' :
                      targetZone === 'top-right' ? 'top-[24%] left-[80%] -translate-x-1/2 -translate-y-1/2 scale-85' :
                      'top-[68%] left-[80%] -translate-x-1/2 -translate-y-1/2 scale-85'
                    )
                )
              : 'bottom-2.5 left-1/2 -translate-x-1/2'
          }`}
        >
          <div className={`relative flex items-center justify-center ${
            step === 'outcome' && outcome === 'goal' ? 'animate-bounce' : ''
          }`}>
            <span className="text-xl sm:text-2xl leading-none filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">⚽</span>
            {step === 'outcome' && outcome === 'post' && (
              <span className="absolute -top-3 -right-2 text-base animate-ping">💥</span>
            )}
          </div>
        </div>

      </div>
    );
  };

  // ================= EXECUÇÃO DO PÊNALTI DO USUÁRIO =================
  const handleExecuteUserPenalty = () => {
    if (!pending || pending.kind !== 'penalty') return;
    const currentTakerId = selectedPenaltyTakerId ?? pending.defaultTakerId ?? pending.eligibleIds[0];
    const currentTaker = userTeam.players.find(p => p.id === currentTakerId) ?? userTeam.players[0];
    const oppGoalkeeper = oppTeam.players.find(p => 
      oppTeam.onFieldRoleByPlayerId[String(p.id)] === 'GOL' || p.position === 'GOL'
    ) ?? oppTeam.players[0];

    // O jogador escolhe organicamente onde bater com base no momento da partida
    const zones: PenaltyZone[] = ['top-left', 'bottom-left', 'center', 'top-right', 'bottom-right'];
    const chosenZone = zones[Math.floor(Math.random() * zones.length)];

    // Despacha a decisão para o motor Rust e obtém o resultado imediatamente
    const res = dispatchMatch({ type: 'choose_penalty_taker', player_id: currentTakerId });
    const updated = res.updatedSession ?? session;
    const latestEvent = updated.events[updated.events.length - 1];
    const isGoal = latestEvent?.type === 'goal' || (latestEvent?.type === 'shootout_kick' && latestEvent?.description?.includes('gol')) || false;

    // Determina o mergulho do goleiro e o desfecho visual e narrativo
    let gkDive: 'left' | 'center' | 'right' = 'center';
    let outcome: PenaltyOutcome = 'goal';
    let outcomeTitle = 'GOOOOOOOOOOL!';
    let outcomeNarrative = '';

    const zoneDescriptions: Record<PenaltyZone, string> = {
      'top-left': 'na gaveta esquerda',
      'bottom-left': 'no cantinho rasteiro esquerdo',
      'center': 'com frieza no meio do gol',
      'top-right': 'na gaveta direita',
      'bottom-right': 'no cantinho rasteiro direito',
    };

    if (isGoal) {
      outcome = 'goal';
      outcomeTitle = 'GOOOOOOOOOOL!';
      const wrongWay = Math.random() < 0.65;
      if (wrongWay) {
        if (chosenZone.includes('left')) gkDive = Math.random() < 0.6 ? 'right' : 'center';
        else if (chosenZone.includes('right')) gkDive = Math.random() < 0.6 ? 'left' : 'center';
        else gkDive = Math.random() < 0.5 ? 'left' : 'right';

        outcomeNarrative = `Bola de um lado, goleiro do outro! ${currentTaker.name} cobrou ${zoneDescriptions[chosenZone]}, deslocou completamente ${oppGoalkeeper.name} e estufou as redes!`;
      } else {
        gkDive = chosenZone.includes('left') ? 'left' : chosenZone.includes('right') ? 'right' : 'center';
        outcomeNarrative = `${oppGoalkeeper.name} acertou o canto e se esticou todo, mas a cobrança de ${currentTaker.name} foi perfeita ${zoneDescriptions[chosenZone]}! Indefensável!`;
      }
    } else {
      const roll = Math.random();
      if (roll < 0.60) {
        outcome = 'saved';
        gkDive = chosenZone.includes('left') ? 'left' : chosenZone.includes('right') ? 'right' : 'center';
        outcomeTitle = 'DEFEEEEEENDEU O GOLEIRO!';
        outcomeNarrative = `${oppGoalkeeper.name} operou um milagre! O arqueiro adivinhou a intenção de ${currentTaker.name}, voou no canto certo e espalmou a bola!`;
      } else if (roll < 0.85) {
        outcome = 'post';
        gkDive = chosenZone.includes('left') ? 'left' : chosenZone.includes('right') ? 'right' : 'center';
        outcomeTitle = 'NA TRAVE! NO TRAVESSÃO!';
        outcomeNarrative = chosenZone.includes('top') || chosenZone === 'center'
          ? `${currentTaker.name} soltou uma bomba! A bola explodiu no travessão com um estrondo ensurdecedor e não entrou!`
          : `${currentTaker.name} tirou do goleiro, mas a bola caprichosamente carimbou a trave e foi para longe!`;
      } else {
        outcome = 'wide';
        gkDive = chosenZone.includes('left') ? 'left' : chosenZone.includes('right') ? 'right' : 'center';
        outcomeTitle = 'PRA FOOOORA!';
        outcomeNarrative = `${currentTaker.name} buscou o cantinho extremo e errou o alvo! A bola tirou tinta do poste e saiu pela linha de fundo!`;
      }
    }

    const scoreDisplay = updated.phase === 'shootout'
      ? `Pên: ${updated.penaltyScore[0]} x ${updated.penaltyScore[1]}`
      : `${updated.score[0]} x ${updated.score[1]}`;

    // Inicializa a fase de corrida (runup)
    setUserPenaltyKick({
      takerId: currentTaker.id,
      takerName: currentTaker.name,
      takerStrength: currentTaker.strength,
      gkName: oppGoalkeeper.name,
      gkStrength: oppGoalkeeper.strength,
      selectedZone: chosenZone,
      step: 'runup',
      gkDive,
      outcome,
      outcomeTitle,
      outcomeNarrative,
      isGoal,
      scoreDisplay,
    });

    // Efeitos sonoros de início: apito do árbitro e batimentos cardíacos de tensão
    sound.playWhistle(true);
    sound.playHeartbeat();

    // Timer parcial: Etapa da corrida -> Chute (1300ms)
    window.setTimeout(() => {
      setUserPenaltyKick(prev => prev ? { ...prev, step: 'kick' } : null);
      sound.playKick();

      // Timer parcial: Chute -> Desfecho emocionante no modal (950ms)
      window.setTimeout(() => {
        setUserPenaltyKick(prev => {
          if (!prev) return null;
          if (prev.isGoal) {
            sound.playGoal();
            try {
              confetti({ particleCount: 85, spread: 80, origin: { y: 0.6 } });
            } catch {}
          } else if (prev.outcome === 'post') {
            sound.playPostHit();
            window.setTimeout(() => sound.playCrowdGasp(), 300);
          } else {
            sound.playCrowdGasp();
          }
          return { ...prev, step: 'outcome' };
        });
      }, 950);
    }, 1300);
  };

  // ================= MODAL DE PÊNALTI DO USUÁRIO =================
  const renderPenaltyModal = () => {
    const isModalOpen = ((!!pending && pending.kind === 'penalty') || !!userPenaltyKick) && session?.phase !== 'shootout';
    if (!isModalOpen) return null;

    const penaltyTakerId = selectedPenaltyTakerId ?? (pending?.defaultTakerId ?? pending?.eligibleIds[0] ?? userTeam.players[0].id);
    const currentTaker = userTeam.players.find(p => p.id === penaltyTakerId) ?? userTeam.players[0];
    const oppGoalkeeper = oppTeam.players.find(p => 
      oppTeam.onFieldRoleByPlayerId[String(p.id)] === 'GOL' || p.position === 'GOL'
    ) ?? oppTeam.players[0];

    const currentStep: PenaltyStep = userPenaltyKick?.step ?? 'aim';
    const currentZone: PenaltyZone = userPenaltyKick?.selectedZone ?? selectedPenaltyZone;
    const currentGkDive = userPenaltyKick?.gkDive ?? 'center';
    const currentOutcome = userPenaltyKick?.outcome ?? 'goal';

    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
        <div 
          role="dialog" 
          aria-label="Cobrança de Pênalti"
          className="w-full max-w-lg rounded-2xl border-2 border-amber-500/90 bg-gradient-to-b from-slate-900 via-amber-950/30 to-slate-950 p-4 sm:p-6 text-white shadow-[0_0_60px_rgba(245,158,11,0.35)] space-y-4 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-black uppercase tracking-widest">
              <Flame className="w-4 h-4 animate-bounce text-amber-400" />
              <span>{session.phase === 'shootout' ? 'Disputa de Pênaltis!' : 'Penalidade Máxima Marcada!'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              {currentStep === 'outcome' ? 'DESFECHO DO LANCE' : 'MOMENTO DA COBRANÇA'}
            </h2>
          </div>

          {/* Duelo Visual: Cobrador vs Goleiro */}
          <div className="grid grid-cols-2 gap-3 bg-black/50 p-3 rounded-xl border border-amber-500/30">
            {/* Cobrador */}
            <div className="text-center space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Cobrador ({userTeam.name})
              </span>
              <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                {currentTaker?.name}
              </div>
              <div className="inline-block font-mono text-[11px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-600/50">
                Força: {currentTaker?.strength}
              </div>
            </div>

            {/* Goleiro */}
            <div className="text-center space-y-0.5 border-l border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                Goleiro ({oppTeam.name})
              </span>
              <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                {oppGoalkeeper?.name}
              </div>
              <div className="inline-block font-mono text-[11px] font-bold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-600/50">
                Força: {oppGoalkeeper?.strength}
              </div>
            </div>
          </div>

          {/* Gráfico do Gol Interativo e Animação */}
          {renderGoalVisual(
            currentStep,
            currentZone,
            currentGkDive,
            currentOutcome,
            false,
            undefined,
            undefined,
            oppGoalkeeper?.name
          )}

          {/* Etapa 1: Escolha / Confirmação do Cobrador */}
          {currentStep === 'aim' && (
            <div className="space-y-3">
              {/* Painel do treinador com informações e troca de cobrador */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300 flex items-center space-x-1.5">
                    <Target className="w-4 h-4 text-amber-400" />
                    <span>Cobrador Definido:</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    ⚡ {Math.round(currentTaker?.energy ?? 100)}% Energia
                  </span>
                </div>
                
                {/* Seletor de Cobradores se houver atletas elegíveis */}
                {pending && pending.eligibleIds && pending.eligibleIds.length > 1 ? (
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Alterar batedor da penalidade:</span>
                      <span className="text-amber-400 font-mono">{pending.eligibleIds.length} em campo</span>
                    </label>
                    <select
                      value={penaltyTakerId}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setSelectedPenaltyTakerId(id);
                        dispatchMatch({ type: 'select_penalty_taker', player_id: id });
                      }}
                      className="w-full bg-black/60 border border-amber-500/60 p-2 rounded-lg text-white font-bold text-xs focus:ring-2 focus:ring-amber-400 outline-none cursor-pointer"
                    >
                      {pending.eligibleIds.map((id) => {
                        const player = userTeam.players.find(p => p.id === id);
                        return (
                          <option key={id} value={id}>
                            {player?.name} ({player?.position} • Força {player?.strength} • ⚡ {Math.round(player?.energy ?? 100)}%)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-slate-300 font-medium">
                    {currentTaker?.name} ({currentTaker?.position}) partirá para a bola.
                  </p>
                )}

                <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800">
                  Como treinador, você define o cobrador. O atleta decide a execução e o canto da batida.
                </p>
              </div>

              {/* Botão de Ação: Executar Pênalti */}
              <button
                type="button"
                onClick={handleExecuteUserPenalty}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/30 cursor-pointer transition-all active:scale-95 flex items-center justify-center space-x-2"
              >
                <span>⚽ BATER PÊNALTI</span>
              </button>
            </div>
          )}

          {/* Etapa 2: A Corrida (Runup) */}
          {currentStep === 'runup' && (
            <div className="p-3.5 rounded-xl bg-black/60 border border-amber-500/50 text-center space-y-2 animate-pulse">
              <div className="flex items-center justify-center space-x-2 text-amber-300 font-black text-sm uppercase tracking-wider">
                <Footprints className="w-5 h-5 text-amber-400 animate-bounce" />
                <span>O árbitro apita... Vai bater!</span>
              </div>
              <p className="text-xs text-slate-300">
                {userPenaltyKick?.takerName} toma distância, respira fundo e parte para a bola...
              </p>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 w-full animate-pulse" />
              </div>
            </div>
          )}

          {/* Etapa 3: O Chute (Kick) */}
          {currentStep === 'kick' && (
            <div className="p-3.5 rounded-xl bg-black/60 border border-amber-500/80 text-center space-y-1 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <div className="flex items-center justify-center space-x-2 text-white font-black text-base sm:text-lg uppercase tracking-widest animate-bounce">
                <span>⚡ CHUTOU! PRA ONDE VAI A BOLA?!</span>
              </div>
              <p className="text-xs text-amber-200">
                A bola viaja com curva em direção à meta! {userPenaltyKick?.gkName} salta para tentar o milagre!
              </p>
            </div>
          )}

          {/* Etapa 4: Desfecho com Emoção e Informação Completa */}
          {currentStep === 'outcome' && userPenaltyKick && (
            <div className="space-y-3">
              <div className={`p-4 rounded-xl border-2 text-center space-y-1.5 shadow-xl animate-in zoom-in-95 duration-200 ${
                userPenaltyKick.outcome === 'goal'
                  ? 'bg-gradient-to-r from-emerald-950 via-green-900/60 to-emerald-950 border-emerald-500 shadow-emerald-500/30'
                  : userPenaltyKick.outcome === 'post'
                  ? 'bg-gradient-to-r from-amber-950 via-orange-900/60 to-amber-950 border-amber-500 shadow-amber-500/30'
                  : userPenaltyKick.outcome === 'saved'
                  ? 'bg-gradient-to-r from-sky-950 via-blue-900/60 to-sky-950 border-sky-500 shadow-sky-500/30'
                  : 'bg-gradient-to-r from-rose-950 via-red-900/60 to-rose-950 border-rose-500 shadow-rose-500/30'
              }`}>
                <div className="text-2xl sm:text-3xl font-black tracking-wider flex items-center justify-center space-x-2 text-white">
                  {userPenaltyKick.outcome === 'goal' && <Sparkles className="w-6 h-6 text-yellow-400 animate-spin" />}
                  <span>{userPenaltyKick.outcomeTitle}</span>
                  {userPenaltyKick.outcome === 'goal' && <Sparkles className="w-6 h-6 text-yellow-400 animate-spin" />}
                </div>
                <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                  {userPenaltyKick.outcomeNarrative}
                </p>
              </div>

              {/* Placar Atualizado */}
              <div className="flex items-center justify-center space-x-3 py-1.5 px-3 rounded-lg bg-black/60 border border-slate-700 text-xs font-mono font-bold text-slate-300">
                <span>Placar do Jogo:</span>
                <span className="text-amber-400 font-black text-sm">{userPenaltyKick.scoreDisplay}</span>
              </div>

              {/* Botão de Fechamento / Prosseguir */}
              <button
                type="button"
                onClick={handleCloseUserPenaltyModal}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/30 cursor-pointer transition-all active:scale-95 flex items-center justify-center space-x-2"
              >
                <span>CONTINUAR PARTIDA ➔</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ================= EXECUÇÃO DO PÊNALTI DO ADVERSÁRIO =================
  const handleExecuteOpponentPenalty = () => {
    if (!opponentPenalty) return;

    const calculatedGkDive: 'left' | 'center' | 'right' = opponentPenalty.outcome === 'saved'
      ? (opponentPenalty.takerTargetZone.includes('left') ? 'left' : opponentPenalty.takerTargetZone.includes('right') ? 'right' : 'center')
      : opponentPenalty.outcome === 'goal'
      ? (Math.random() < 0.65 ? (opponentPenalty.takerTargetZone.includes('left') ? 'right' : 'left') : 'center')
      : (Math.random() < 0.5 ? 'left' : 'right');

    setOpponentPenalty(prev => prev ? { ...prev, userGkChoice: calculatedGkDive, step: 'runup' } : null);
    sound.playWhistle(true);
    sound.playHeartbeat();

    window.setTimeout(() => {
      setOpponentPenalty(prev => prev ? { ...prev, step: 'kick' } : null);
      sound.playKick();

      window.setTimeout(() => {
        setOpponentPenalty(prev => {
          if (!prev) return null;
          if (prev.isGoal) {
            sound.playWhistle(true);
          } else if (prev.outcome === 'post') {
            sound.playPostHit();
            window.setTimeout(() => sound.playCrowdGasp(), 300);
          } else {
            sound.playCrowdGasp();
          }
          return { ...prev, step: 'outcome' };
        });
      }, 950);
    }, 1300);
  };

  // ================= MODAL DE PÊNALTI DO ADVERSÁRIO =================
  const renderOpponentPenaltyModal = () => {
    if (!opponentPenalty) return null;

    const currentStep = opponentPenalty.step;

    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
        <div 
          role="dialog" 
          aria-label="Pênalti do Adversário"
          className="w-full max-w-lg rounded-2xl border-2 border-rose-500/90 bg-gradient-to-b from-slate-900 via-rose-950/30 to-slate-950 p-4 sm:p-6 text-white shadow-[0_0_60px_rgba(244,63,94,0.35)] space-y-4 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-black uppercase tracking-widest">
              <ShieldAlert className="w-4 h-4 animate-bounce text-rose-400" />
              <span>Pênalti para o Adversário!</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              {currentStep === 'outcome' ? 'DESFECHO DO LANCE' : 'MOMENTO DE TENSÃO'}
            </h2>
          </div>

          {/* Duelo Visual: Cobrador Adversário vs Nosso Goleiro */}
          <div className="grid grid-cols-2 gap-3 bg-black/50 p-3 rounded-xl border border-rose-500/30">
            {/* Cobrador */}
            <div className="text-center space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                Cobrador ({oppTeam.name})
              </span>
              <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                {opponentPenalty.takerName}
              </div>
              <div className="inline-block font-mono text-[11px] font-bold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-600/50">
                Força: {opponentPenalty.takerStrength}
              </div>
            </div>

            {/* Nosso Goleiro */}
            <div className="text-center space-y-0.5 border-l border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                Seu Goleiro ({userTeam.name})
              </span>
              <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                {opponentPenalty.gkName}
              </div>
              <div className="inline-block font-mono text-[11px] font-bold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-600/50">
                Força: {opponentPenalty.gkStrength}
              </div>
            </div>
          </div>

          {/* Gráfico do Gol com Mergulho */}
          {renderGoalVisual(
            currentStep,
            opponentPenalty.takerTargetZone,
            opponentPenalty.userGkChoice,
            opponentPenalty.outcome,
            true,
            undefined,
            opponentPenalty.userGkChoice,
            opponentPenalty.gkName
          )}

          {/* Etapa 1: Tensão e Acompanhamento */}
          {currentStep === 'aim' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-900/90 border border-rose-500/40 text-center space-y-1">
                <span className="text-xs font-bold text-rose-300 block">
                  Penalidade máxima contra a sua equipe!
                </span>
                <p className="text-[11px] text-slate-400">
                  {opponentPenalty.gkName} se posiciona na meta para tentar a defesa da cobrança de {opponentPenalty.takerName}.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExecuteOpponentPenalty}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-400 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-rose-600/30 cursor-pointer transition-all active:scale-95 flex items-center justify-center space-x-2"
              >
                <span>🧤 ACOMPANHAR COBRANÇA</span>
              </button>
            </div>
          )}

          {/* Etapa 2: A Corrida do Adversário */}
          {currentStep === 'runup' && (
            <div className="p-3.5 rounded-xl bg-black/60 border border-rose-500/50 text-center space-y-2 animate-pulse">
              <div className="flex items-center justify-center space-x-2 text-rose-300 font-black text-sm uppercase tracking-wider">
                <Footprints className="w-5 h-5 text-rose-400 animate-bounce" />
                <span>O adversário parte para a cobrança...</span>
              </div>
              <p className="text-xs text-slate-300">
                {opponentPenalty.takerName} corre em direção à bola sob pressão máxima!
              </p>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 w-full animate-pulse" />
              </div>
            </div>
          )}

          {/* Etapa 3: O Chute do Adversário */}
          {currentStep === 'kick' && (
            <div className="p-3.5 rounded-xl bg-black/60 border border-rose-500/80 text-center space-y-1 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
              <div className="flex items-center justify-center space-x-2 text-white font-black text-base sm:text-lg uppercase tracking-widest animate-bounce">
                <span>⚡ BATEU FORTE NA BOLA!</span>
              </div>
              <p className="text-xs text-rose-200">
                {opponentPenalty.gkName} salta na bola para salvar o time!
              </p>
            </div>
          )}

          {/* Etapa 4: Desfecho Completo */}
          {currentStep === 'outcome' && (
            <div className="space-y-3">
              <div className={`p-4 rounded-xl border-2 text-center space-y-1.5 shadow-xl animate-in zoom-in-95 duration-200 ${
                opponentPenalty.outcome === 'goal'
                  ? 'bg-gradient-to-r from-rose-950 via-red-900/60 to-rose-950 border-rose-500 shadow-rose-500/30'
                  : 'bg-gradient-to-r from-emerald-950 via-green-900/60 to-emerald-950 border-emerald-500 shadow-emerald-500/30'
              }`}>
                <div className="text-2xl sm:text-3xl font-black tracking-wider text-white">
                  {opponentPenalty.outcomeTitle}
                </div>
                <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                  {opponentPenalty.outcomeNarrative}
                </p>
              </div>

              {/* Placar Atualizado */}
              <div className="flex items-center justify-center space-x-3 py-1.5 px-3 rounded-lg bg-black/60 border border-slate-700 text-xs font-mono font-bold text-slate-300">
                <span>Placar do Jogo:</span>
                <span className="text-amber-400 font-black text-sm">{opponentPenalty.scoreDisplay}</span>
              </div>

              {/* Botão de Fechamento / Prosseguir */}
              <button
                type="button"
                onClick={handleCloseOpponentPenaltyModal}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition-all active:scale-95"
              >
                Continuar Partida ➔
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ================= MODAL DE LESÃO =================
  const renderInjuryModal = () => {
    if (!pending || pending.kind !== 'injury') return null;

    const injuredPlayer = userTeam.players.find(p => p.id === pending.playerId);
    const injuredRole = injuredPlayer ? (userTeam.onFieldRoleByPlayerId[String(injuredPlayer.id)] || injuredPlayer.position) : 'MEI';
    const injuredBadge = POSITION_COLORS[injuredPlayer?.position || injuredRole] || { bg: 'bg-rose-700', text: 'text-white' };

    // Ordena os reservas: mesma posição natural primeiro, depois por maior força
    const sortedEligibleSubs = [...pending.eligibleIds]
      .map(id => userTeam.players.find(p => p.id === id)!)
      .filter(Boolean)
      .sort((a, b) => {
        const aSamePos = a.position === injuredPlayer?.position || a.position === injuredRole;
        const bSamePos = b.position === injuredPlayer?.position || b.position === injuredRole;
        if (aSamePos && !bSamePos) return -1;
        if (!aSamePos && bSamePos) return 1;
        return b.strength - a.strength;
      });

    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div 
          role="dialog" 
          aria-label="Atendimento Médico"
          className="w-full max-w-lg rounded-2xl border-2 border-rose-500/90 bg-gradient-to-b from-slate-900 via-rose-950/40 to-slate-950 p-5 sm:p-6 text-white shadow-[0_0_60px_rgba(244,63,94,0.35)] space-y-4 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-black uppercase tracking-widest">
              <ShieldAlert className="w-4 h-4 animate-bounce text-rose-400" />
              <span>Departamento Médico · Lesão em Campo</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              {injuredPlayer?.name ?? 'Atleta'} Lesionado!
            </h2>
            <p className="text-xs text-slate-300">
              Gravidade: <strong className="text-rose-300 font-bold">{pending.severity}</strong>. O atleta precisará deixar o gramado.
            </p>
          </div>

          {/* Card Detalhado do Jogador Machucado */}
          {injuredPlayer && (
            <div className="p-3 rounded-xl bg-black/50 border border-rose-500/40 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <span className={`px-2 py-0.5 rounded font-mono text-xs font-black uppercase ${injuredBadge.bg} ${injuredBadge.text}`}>
                  {injuredPlayer.position}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-white truncate">{injuredPlayer.name}</div>
                  <div className="text-[11px] text-slate-400">
                    Posição em campo: <span className="text-slate-200 font-semibold">{injuredRole}</span>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 font-mono text-xs space-y-0.5">
                <div className="text-emerald-400 font-bold">Força: {injuredPlayer.strength}</div>
                <div className="text-slate-400 text-[11px]">⚡ {Math.round(injuredPlayer.energy)}%</div>
              </div>
            </div>
          )}

          {/* Opções de substituição */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>{sortedEligibleSubs.length ? 'Escolha o reserva para entrar:' : 'Não há suplentes disponíveis no banco!'}</span>
              <span className="text-[11px] text-slate-400 font-mono">{sortedEligibleSubs.length} disponíveis</span>
            </span>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {sortedEligibleSubs.map((sub) => {
                const subBadge = POSITION_COLORS[sub.position] || { bg: 'bg-slate-700', text: 'text-white' };
                const isIdealPos = sub.position === injuredPlayer?.position || sub.position === injuredRole;
                const energyColor = sub.energy >= 80 ? 'text-emerald-400' : sub.energy >= 60 ? 'text-amber-400' : 'text-rose-400';

                return (
                  <button
                    key={sub.id}
                    onClick={() => dispatchMatch({ type: 'substitute', side: pending.side, outgoing: pending.playerId!, incoming: sub.id })}
                    className={`w-full p-2.5 rounded-lg text-white font-bold text-xs text-left cursor-pointer transition-all active:scale-95 flex items-center justify-between border ${
                      isIdealPos
                        ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/70 shadow-sm'
                        : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-black uppercase ${subBadge.bg} ${subBadge.text}`}>
                        {sub.position}
                      </span>
                      <span className="truncate">{sub.name}</span>
                      {isIdealPos && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1 py-0.2 rounded font-black tracking-tighter uppercase">
                          Ideal
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 font-mono text-xs">
                      <span className="text-slate-300">F: {sub.strength}</span>
                      <span className={`font-bold ${energyColor}`}>⚡ {Math.round(sub.energy)}%</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => dispatchMatch({ type: 'continue_without_replacement' })}
              className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors text-center"
            >
              Continuar com 1 jogador a menos
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ================= MODAL / DRAWER DE TÁTICA E SUBSTITUIÇÃO =================
  const renderTacticsModal = () => {
    if (!showTacticsModal) return null;

    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <h2 className="font-extrabold text-sm sm:text-base text-white uppercase tracking-wider">
                Painel Tático & Substituições
              </h2>
            </div>
            <button
              onClick={() => setShowTacticsModal(false)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase cursor-pointer transition-all active:scale-95 flex items-center space-x-1"
            >
              <span>✓ Confirmar & Fechar</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            <MatchLineupPanel />
          </div>
        </div>
      </div>
    );
  };

  // ================= MODAL DE INSPEÇÃO DE PARTIDA PARALELA =================
  const renderInspectedMatchModal = () => {
    if (inspectedParallelFixtureId === null) return null;
    const match = session.parallelMatches.find(m => m.fixtureId === inspectedParallelFixtureId);
    if (!match) return null;

    const homeClub = gameState.clubs.find(c => c.id === match.teams[0].clubId);
    const awayClub = gameState.clubs.find(c => c.id === match.teams[1].clubId);

    const goalsHome: string[] = [];
    const goalsAway: string[] = [];
    const cardsHome: { type: 'yellow' | 'red'; text: string }[] = [];
    const cardsAway: { type: 'yellow' | 'red'; text: string }[] = [];

    for (const ev of match.events) {
      const evType = (ev as any).event_type || ev.type;
      const isHome = ev.team === 'home' || (ev as any).team === 0;
      const min = ev.clock?.minute ?? ev.minute;

      if (evType === 'goal') {
        const scorer = (ev as any).scorer_name || ev.scorerName || ev.description?.split(':')[0] || 'Gol';
        const assist = (ev as any).assist_name || ev.assistName;
        const entry = `${min}′ ${scorer}${assist ? ` (${assist})` : ''}`;
        if (isHome) goalsHome.push(entry);
        else goalsAway.push(entry);
      } else if (evType === 'yellow_card') {
        const name = (ev as any).playerName || (ev as any).scorer_name || ev.scorerName || ev.description?.split(':')[0] || 'Atleta';
        const entry = { type: 'yellow' as const, text: `${min}′ ${name}` };
        if (isHome) cardsHome.push(entry);
        else cardsAway.push(entry);
      } else if (evType === 'red_card') {
        const name = (ev as any).playerName || (ev as any).scorer_name || ev.scorerName || ev.description?.split(':')[0] || 'Atleta';
        const entry = { type: 'red' as const, text: `${min}′ ${name}` };
        if (isHome) cardsHome.push(entry);
        else cardsAway.push(entry);
      }
    }

    const totalPoss = match.stats.possession[0] + match.stats.possession[1];
    const poss0 = totalPoss ? Math.round((match.stats.possession[0] * 100) / totalPoss) : 50;

    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
        <div 
          role="dialog" 
          aria-label="Detalhes da Partida Paralela"
          className="w-full max-w-lg rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
            <span className="font-extrabold text-xs uppercase tracking-wider text-slate-200 flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Acompanhamento em Tempo Real</span>
            </span>
            <button
              onClick={() => setInspectedParallelFixtureId(null)}
              className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Teams & Score */}
          <div className="p-4 bg-[var(--app-surface-2)]/40 border-b border-[var(--app-border-subtle)] flex items-center justify-between gap-3">
            <div className="flex-1 flex items-center justify-end space-x-2 min-w-0">
              <span className="font-extrabold text-xs sm:text-sm text-right truncate text-white">
                {match.teams[0].name}
              </span>
              <ClubCrest club={homeClub} size="md" className="w-7 h-7 shrink-0" />
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-center shrink-0">
              <span className="font-mono font-black text-xl sm:text-2xl text-emerald-400 tracking-wider">
                {match.score[0]} : {match.score[1]}
              </span>
              <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                {match.phase === 'full_time' ? 'Encerrado' : match.phase === 'halftime' ? 'Intervalo' : `${match.clock.minute}′ em andamento`}
              </span>
            </div>

            <div className="flex-1 flex items-center justify-start space-x-2 min-w-0">
              <ClubCrest club={awayClub} size="md" className="w-7 h-7 shrink-0" />
              <span className="font-extrabold text-xs sm:text-sm text-left truncate text-white">
                {match.teams[1].name}
              </span>
            </div>
          </div>

          {/* Gols e Cartões */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {/* Gols */}
            <div className="space-y-1.5">
              <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px] block">
                ⚽ Gols
              </span>
              <div className="grid grid-cols-2 gap-2 bg-[var(--app-surface-2)]/60 p-2.5 rounded-lg border border-[var(--app-border-subtle)]">
                <div className="space-y-1">
                  {goalsHome.length === 0 ? (
                    <span className="text-[11px] text-slate-500 italic block">Nenhum</span>
                  ) : (
                    goalsHome.map((g, i) => (
                      <div key={i} className="text-[11px] font-semibold text-emerald-300">{g}</div>
                    ))
                  )}
                </div>
                <div className="space-y-1 border-l border-slate-800/80 pl-2">
                  {goalsAway.length === 0 ? (
                    <span className="text-[11px] text-slate-500 italic block">Nenhum</span>
                  ) : (
                    goalsAway.map((g, i) => (
                      <div key={i} className="text-[11px] font-semibold text-emerald-300">{g}</div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Cartões */}
            <div className="space-y-1.5">
              <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px] block">
                Cartões
              </span>
              <div className="grid grid-cols-2 gap-2 bg-[var(--app-surface-2)]/60 p-2.5 rounded-lg border border-[var(--app-border-subtle)]">
                <div className="space-y-1">
                  {cardsHome.length === 0 ? (
                    <span className="text-[11px] text-slate-500 italic block">Nenhum</span>
                  ) : (
                    cardsHome.map((c, i) => (
                      <div key={i} className={`text-[11px] font-semibold ${c.type === 'red' ? 'text-rose-400 font-bold' : 'text-amber-300'}`}>
                        {c.type === 'red' ? '🟥 ' : '🟨 '}{c.text}
                      </div>
                    ))
                  )}
                </div>
                <div className="space-y-1 border-l border-slate-800/80 pl-2">
                  {cardsAway.length === 0 ? (
                    <span className="text-[11px] text-slate-500 italic block">Nenhum</span>
                  ) : (
                    cardsAway.map((c, i) => (
                      <div key={i} className={`text-[11px] font-semibold ${c.type === 'red' ? 'text-rose-400 font-bold' : 'text-amber-300'}`}>
                        {c.type === 'red' ? '🟥 ' : '🟨 '}{c.text}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Estatísticas resumidas da partida */}
            <div className="space-y-1.5">
              <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px] block">
                Estatísticas do Confronto
              </span>
              <div className="grid grid-cols-3 gap-2 text-center font-mono bg-[var(--app-surface-2)]/60 p-2.5 rounded-lg border border-[var(--app-border-subtle)]">
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Posse</span>
                  <span className="text-xs font-bold text-white">{poss0}% x {100 - poss0}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Finalizações</span>
                  <span className="text-xs font-bold text-white">{match.stats.shots[0]} x {match.stats.shots[1]}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">No Alvo</span>
                  <span className="text-xs font-bold text-emerald-400">{match.stats.shotsOnTarget[0]} x {match.stats.shotsOnTarget[1]}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 bg-[var(--app-surface-2)] border-t border-[var(--app-border-subtle)] flex justify-end">
            <button
              onClick={() => setInspectedParallelFixtureId(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ================= OUTROS JOGOS (PARALELOS COM ESCUDOS) =================
  const renderParallelMatches = () => {
    return (
      <section className="p-3.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] space-y-2.5 shadow-md">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Outros Jogos da Rodada</span>
          </h2>
          <select 
            value={scoresMode} 
            onChange={e => updateOptions({ liveScores: e.target.value as 'hidden' | 'competition' | 'date' })} 
            className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-[11px] text-slate-200 px-2 py-1 rounded cursor-pointer"
          >
            <option value="hidden">Ocultar</option>
            <option value="competition">Mesma competição</option>
            <option value="date">Todos da rodada</option>
          </select>
        </div>

        {scoresMode !== 'hidden' && (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {session.parallelMatches
              .filter(m => scoresMode === 'date' || gameState.calendar.find(f => f.id === m.fixtureId)?.competitionName === fixture.competitionName)
              .map(m => {
                const homeClub = gameState.clubs.find(c => c.id === m.teams[0].clubId);
                const awayClub = gameState.clubs.find(c => c.id === m.teams[1].clubId);

                // Jitter sutil determinístico por jogo (-2 a +2 minutos) para que nem todos fiquem no mesmo minuto exato
                const jitter = ((m.fixtureId * 3) % 5) - 2;
                let displayMinute = `${Math.min(90, Math.max(1, m.clock.minute + jitter))}′`;
                if (m.phase === 'full_time' || m.phase === 'committed') displayMinute = 'FIM';
                else if (m.phase === 'halftime') displayMinute = 'INT';

                return (
                  <div 
                    key={m.fixtureId} 
                    onClick={() => {
                      sound.playClick();
                      setInspectedParallelFixtureId(m.fixtureId);
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[var(--app-surface-2)]/60 hover:bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] hover:border-emerald-500/50 transition-all cursor-pointer text-xs group"
                    title="Clique para ver os gols, cartões e estatísticas desta partida"
                  >
                    {/* Home Team */}
                    <div className="flex items-center space-x-1.5 flex-1 min-w-0 justify-end">
                      <span className="truncate font-semibold text-slate-200 group-hover:text-white text-right">
                        {m.teams[0].name}
                      </span>
                      <ClubCrest club={homeClub} size="xs" preferMini className="w-4 h-4 shrink-0" />
                    </div>

                    {/* Placar */}
                    <div className="px-2 py-0.5 mx-2 rounded bg-slate-900/90 font-mono font-bold text-xs text-emerald-400 shrink-0 border border-slate-700/50 group-hover:border-emerald-500/60">
                      {m.score[0]} : {m.score[1]}
                    </div>

                    {/* Away Team */}
                    <div className="flex items-center space-x-1.5 flex-1 min-w-0 justify-start">
                      <ClubCrest club={awayClub} size="xs" preferMini className="w-4 h-4 shrink-0" />
                      <span className="truncate font-semibold text-slate-200 group-hover:text-white text-left">
                        {m.teams[1].name}
                      </span>
                    </div>

                    {/* Minute Badge */}
                    <span className="text-[10px] font-mono text-slate-400 pl-2 shrink-0">
                      {displayMinute}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </section>
    );
  };

  // ================= ESTATÍSTICAS DA PARTIDA =================
  const renderLiveStats = () => (
    <section className="p-3.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] space-y-3 shadow-md">
      <h2 className="font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
        <BarChart3 className="w-4 h-4 text-[var(--app-text-accent)]" />
        <span>Estatísticas da Partida</span>
      </h2>

      {/* Possession Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-bold font-mono">
          <span className="text-emerald-400">{session.teams[0].name} ({possession}%)</span>
          <span className="text-sky-400">{100 - possession}% ({session.teams[1].name})</span>
        </div>
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${possession}%` }} />
          <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${100 - possession}%` }} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
        <div className="bg-[var(--app-surface-2)] p-2 rounded-md border border-[var(--app-border-subtle)]">
          <span className="text-[10px] text-slate-400 block font-sans">Finalizações</span>
          <span className="text-xs font-bold text-white">{session.stats.shots[0]} x {session.stats.shots[1]}</span>
        </div>
        <div className="bg-[var(--app-surface-2)] p-2 rounded-md border border-[var(--app-border-subtle)]">
          <span className="text-[10px] text-slate-400 block font-sans">No Alvo</span>
          <span className="text-xs font-bold text-emerald-400">{session.stats.shotsOnTarget[0]} x {session.stats.shotsOnTarget[1]}</span>
        </div>
        <div className="bg-[var(--app-surface-2)] p-2 rounded-md border border-[var(--app-border-subtle)]">
          <span className="text-[10px] text-slate-400 block font-sans">Escanteios</span>
          <span className="text-xs font-bold text-white">{session.stats.corners[0]} x {session.stats.corners[1]}</span>
        </div>
        <div className="bg-[var(--app-surface-2)] p-2 rounded-md border border-[var(--app-border-subtle)] col-span-3">
          <span className="text-[10px] text-slate-400 block font-sans">Faltas Cometidas</span>
          <span className="text-xs font-bold text-amber-300">{session.stats.fouls[0]} x {session.stats.fouls[1]}</span>
        </div>
      </div>
    </section>
  );

  // ================= ARENA DE DISPUTA DE PÊNALTIS (SHOOTOUT) =================
  const renderShootoutArena = () => {
    if (!session || (session.phase !== 'shootout' && !session.penaltyAttempts.some(Boolean))) return null;

    const homeKicks = revealedShootoutKicks.filter(k => k.side === 0);
    const awayKicks = revealedShootoutKicks.filter(k => k.side === 1);
    const maxKicks = Math.max(5, homeKicks.length, awayKicks.length);
    const isFinished = finished || session.phase === 'full_time' || session.phase === 'committed';
    const winnerSide = isFinished && session.penaltyScore[0] !== session.penaltyScore[1]
      ? (session.penaltyScore[0] > session.penaltyScore[1] ? 0 : 1)
      : null;
    const winnerClub = winnerSide !== null ? clubs[winnerSide] : null;

    return (
      <div className="flex-1 flex flex-col p-3 sm:p-4 bg-gradient-to-b from-slate-950 via-slate-900 to-black rounded-xl border border-amber-500/40 shadow-2xl overflow-y-auto space-y-4 max-w-4xl mx-auto w-full">
        {/* Arena Header */}
        <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-amber-400 animate-pulse" />
            <span className="font-extrabold text-sm sm:text-base uppercase tracking-wider text-amber-300">
              Disputa de Pênaltis
            </span>
          </div>
          <span className="text-xs font-mono bg-amber-950/80 text-amber-300 px-2.5 py-1 rounded-full border border-amber-700/60 font-bold">
            {isFinished ? 'Encerrada' : 'Em Andamento'}
          </span>
        </div>

        {/* Score & Clubs Banner */}
        <div className="grid grid-cols-7 items-center bg-slate-950/70 p-3 sm:p-4 rounded-xl border border-slate-800 gap-2">
          {/* Home Club */}
          <div className="col-span-3 flex flex-col items-center sm:items-end text-center sm:text-right space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xs sm:text-base text-white truncate max-w-[120px] sm:max-w-[200px]">
                {clubs[0]?.name ?? session.teams[0].name}
              </span>
              <ClubCrest club={clubs[0]} size="lg" className="w-7 h-7 sm:w-9 sm:h-9 shrink-0" />
            </div>
            {/* Dots */}
            <div className="flex items-center space-x-1.5 pt-1 flex-wrap justify-center sm:justify-end gap-y-1">
              {Array.from({ length: maxKicks }).map((_, i) => {
                const kick = homeKicks[i];
                return (
                  <span
                    key={i}
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[9px] font-bold border transition-all ${
                      kick
                        ? kick.isGoal
                          ? 'bg-emerald-500 border-emerald-300 text-white shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                          : 'bg-rose-600 border-rose-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                        : 'bg-slate-800/80 border-slate-600 text-slate-500'
                    }`}
                  >
                    {kick ? (kick.isGoal ? '✓' : '✕') : ''}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Center Digital Score */}
          <div className="col-span-1 flex flex-col items-center justify-center">
            <span className="font-digital text-2xl sm:text-4xl text-amber-400 tracking-wider">
              {revealedPenaltyScore[0]} : {revealedPenaltyScore[1]}
            </span>
          </div>

          {/* Away Club */}
          <div className="col-span-3 flex flex-col items-center sm:items-start text-center sm:text-left space-y-1">
            <div className="flex items-center space-x-2">
              <ClubCrest club={clubs[1]} size="lg" className="w-7 h-7 sm:w-9 sm:h-9 shrink-0" />
              <span className="font-extrabold text-xs sm:text-base text-white truncate max-w-[120px] sm:max-w-[200px]">
                {clubs[1]?.name ?? session.teams[1].name}
              </span>
            </div>
            {/* Dots */}
            <div className="flex items-center space-x-1.5 pt-1 flex-wrap justify-center sm:justify-start gap-y-1">
              {Array.from({ length: maxKicks }).map((_, i) => {
                const kick = awayKicks[i];
                return (
                  <span
                    key={i}
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[9px] font-bold border transition-all ${
                      kick
                        ? kick.isGoal
                          ? 'bg-emerald-500 border-emerald-300 text-white shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                          : 'bg-rose-600 border-rose-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                        : 'bg-slate-800/80 border-slate-600 text-slate-500'
                    }`}
                  >
                    {kick ? (kick.isGoal ? '✓' : '✕') : ''}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Current Kick Dramatic Stage or Victory Message */}
        {isFinished && winnerClub ? (
          <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-950/80 via-yellow-950/60 to-amber-950/80 border-2 border-amber-500/80 rounded-2xl text-center space-y-3 shadow-[0_0_30px_rgba(245,158,11,0.3)] animate-in zoom-in-95 duration-300">
            <Sparkles className="w-8 h-8 text-amber-400 mx-auto animate-bounce" />
            <div className="text-lg sm:text-2xl font-black text-amber-300 uppercase tracking-wider">
              {winnerClub.name} Venceu nos Pênaltis!
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
              Em uma disputa emocionante, {winnerClub.name} superou o adversário por {session.penaltyScore[0]} a {session.penaltyScore[1]} e garantiu a classificação!
            </p>
            <div className="pt-2">
              <button
                onClick={() => completeRound()}
                className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                Ver Resultados da Rodada
              </button>
            </div>
          </div>
        ) : currentShootoutKick ? (
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 ${
            currentShootoutKick.step === 'outcome'
              ? currentShootoutKick.isGoal
                ? 'bg-emerald-950/80 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                : 'bg-rose-950/80 border-rose-500 shadow-[0_0_25px_rgba(239,68,68,0.4)]'
              : 'bg-slate-900 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ClubCrest club={clubs[currentShootoutKick.side]} size="md" className="w-6 h-6" />
                <span className="font-extrabold text-xs sm:text-sm text-white">
                  {clubs[currentShootoutKick.side]?.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-amber-400 font-mono font-bold">
                  Cobrança #{currentShootoutKick.index + 1}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${POSITION_COLORS[currentShootoutKick.takerPosition]?.bg || 'bg-slate-700'}`}>
                  {currentShootoutKick.takerPosition}
                </span>
                <span className="text-xs font-mono font-bold text-slate-300">
                  Força {currentShootoutKick.takerStrength}
                </span>
              </div>
            </div>

            {/* Kicker Name */}
            <div className="text-center py-1 sm:py-2">
              <span className="text-lg sm:text-2xl font-black text-white tracking-wide">
                {currentShootoutKick.takerName}
              </span>
            </div>

            {/* Step animation & text */}
            <div className="text-center space-y-1">
              {currentShootoutKick.step === 'aim' && (
                <div className="inline-flex items-center space-x-2 text-amber-300 font-bold text-sm sm:text-base animate-pulse">
                  <Footprints className="w-4 h-4 animate-bounce" />
                  <span>Vai para a cobrança...</span>
                </div>
              )}
              {currentShootoutKick.step === 'kick' && (
                <div className="inline-flex items-center space-x-2 text-yellow-400 font-black text-base sm:text-xl scale-105 transition-transform">
                  <Flame className="w-5 h-5 text-orange-400 animate-spin" />
                  <span>Partiu pra bola! Soltou o chute!</span>
                </div>
              )}
              {currentShootoutKick.step === 'outcome' && (
                <div className={`text-xl sm:text-3xl font-black tracking-wider uppercase animate-in zoom-in-75 duration-200 ${
                  currentShootoutKick.isGoal ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]' : 'text-rose-400 drop-shadow-[0_0_12px_rgba(248,113,113,0.8)]'
                }`}>
                  {currentShootoutKick.isGoal ? 'GOOOOOOOOL!' : 'DEFEEEEEENDEU O GOLEIRO!'}
                </div>
              )}
              <p className="text-xs sm:text-sm text-slate-300 italic pt-1">
                {currentShootoutKick.narrative}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl text-center space-y-2">
            <Footprints className="w-6 h-6 text-amber-400 mx-auto animate-pulse" />
            <p className="text-sm text-slate-300 font-bold">
              Preparando a disputa de pênaltis...
            </p>
            <p className="text-xs text-slate-500">
              Os melhores cobradores de cada equipe estão sendo definidos automaticamente.
            </p>
          </div>
        )}

        {/* Histórico das Cobranças */}
        {revealedShootoutKicks.length > 0 && (
          <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-3 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Histórico de Cobranças
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {revealedShootoutKicks.map((k, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${
                    k.isGoal
                      ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-800/50 text-rose-200'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="font-mono text-[10px] text-slate-400">#{i + 1}</span>
                    <ClubCrest club={clubs[k.side]} size="xs" className="w-4 h-4 shrink-0" />
                    <span className="font-bold truncate">{k.takerName}</span>
                  </div>
                  <span className="font-extrabold text-[11px] shrink-0 ml-2">
                    {k.isGoal ? '✓ GOL' : '✕ PERDEU'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--app-bg-deep)] text-slate-100 select-none">
      {/* Modals de Intervenção */}
      {renderPenaltyModal()}
      {renderOpponentPenaltyModal()}
      {renderInjuryModal()}
      {renderTacticsModal()}
      {renderInspectedMatchModal()}

      {/* ================= PLACAR FIXO NO TOPO ================= */}
      <div className="shrink-0 bg-[var(--app-surface-1)] border-b border-[var(--app-border-subtle)] px-3 py-2 sm:px-4 sm:py-2.5 shadow-md">
        {/* Top Info Header */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <button 
            onClick={() => setScreen('overview')} 
            className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Sair para visão geral (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Visão Geral (Esc)</span>
            <span className="sm:hidden">Sair</span>
          </button>

          <span className="truncate max-w-[180px] sm:max-w-none text-center font-medium text-slate-300">
            {fixture.competitionName} · {fixture.stage}
          </span>

          <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold uppercase ${
            finished 
              ? 'bg-slate-800 text-slate-300' 
              : session.paused 
              ? 'bg-amber-950 text-amber-300 border border-amber-800/80' 
              : 'bg-emerald-950 text-emerald-300 border border-emerald-800/80 animate-pulse'
          }`}>
            {phases[session.phase]} · {clock}{session.paused && !finished ? ' (Pausada)' : ''}
          </span>
        </div>

        {/* Teams & Score Row */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 pt-1">
          {/* Team 1 (Home) */}
          <div className="flex items-center justify-end space-x-2 flex-1 min-w-0">
            <span className="font-extrabold text-xs sm:text-base text-right truncate text-white">
              {session.teams[0].name}
            </span>
            <ClubCrest club={clubs[0]} size="lg" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
          </div>

          {/* Center Digital Score Display */}
          <div className="px-3 sm:px-4 py-1 bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] rounded-lg shadow-inner flex flex-col items-center justify-center shrink-0 min-w-[76px] sm:min-w-[96px]">
            <span className="font-digital text-2xl sm:text-3xl text-emerald-400 tracking-wider leading-none">
              {visibleScore[0]} : {visibleScore[1]}
            </span>
            {visiblePenaltyScore && (
              <span className="text-[10px] text-amber-300 font-mono font-bold mt-0.5">
                Pen: {visiblePenaltyScore.join(' : ')}
              </span>
            )}
          </div>

          {/* Team 2 (Away) */}
          <div className="flex items-center justify-start space-x-2 flex-1 min-w-0">
            <ClubCrest club={clubs[1]} size="lg" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
            <span className="font-extrabold text-xs sm:text-base text-left truncate text-white">
              {session.teams[1].name}
            </span>
          </div>
        </div>
      </div>

      {/* Match Error Alert */}
      {matchError && (
        <div role="alert" className="p-2 bg-amber-950/80 border-b border-amber-700 text-amber-200 text-xs font-semibold text-center shrink-0">
          {matchError}
        </div>
      )}

      {/* ================= MOBILE TABS SELECTOR (< 1024px) ================= */}
      {session.phase !== 'shootout' && !session.penaltyAttempts.some(Boolean) && (
        <div className="lg:hidden flex bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] shrink-0 px-2 py-1 gap-1">
          <button
            onClick={() => { setMobileTab('events'); sound.playClick(); }}
            className={`flex-1 min-h-[40px] px-2 py-1 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              mobileTab === 'events'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Lance a Lance</span>
            <span className="font-mono text-[10px] bg-black/40 px-1 rounded">
              {session.events.length}
            </span>
          </button>

          <button
            onClick={() => { 
              setMobileTab('lineup'); 
              sound.playClick(); 
              if (!session.paused) dispatchMatch({ type: 'pause' });
            }}
            className={`flex-1 min-h-[40px] px-2 py-1 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer relative ${
              mobileTab === 'lineup'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Substituições</span>
            {pending && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute top-1.5 right-1.5" />
            )}
          </button>

          <button
            onClick={() => { setMobileTab('stats'); sound.playClick(); }}
            className={`flex-1 min-h-[40px] px-2 py-1 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              mobileTab === 'stats'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Estatísticas</span>
          </button>
        </div>
      )}

      {/* ================= MAIN CONTENT VIEWPORT ================= */}
      {session.phase === 'shootout' || (session.penaltyAttempts.some(Boolean) && (finished || session.phase === 'full_time' || session.phase === 'committed')) ? (
        <div className="flex-1 flex flex-col p-3 overflow-hidden min-h-0">
          {renderShootoutArena()}
        </div>
      ) : (
        <>
          {/* DESKTOP LAYOUT (>= 1024px) */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-3 p-3 flex-1 overflow-hidden min-h-0">
        {/* Left Col: Lance a Lance Feed */}
        <div className="flex flex-col rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] p-3 overflow-hidden shadow-md">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--app-border-subtle)] shrink-0">
            <h2 className="font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <ListOrdered className="w-4 h-4 text-emerald-400" />
              <span>Lance a Lance ({session.events.length} eventos)</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Tempo: {clock}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-sans text-xs">
            {session.events.length === 0 ? (
              <div className="text-center text-slate-500 py-8">Aguardando o início dos lances...</div>
            ) : (
              displayedEvents.map((e) => {
                const isUserGoal = e.type === 'goal' && e.team === (humanSide === 1 ? 'away' : 'home');

                return (
                  <div 
                    key={e.id} 
                    className={`p-2.5 rounded-md transition-all shadow-xs ${
                      e.type === 'goal' 
                        ? isUserGoal
                          ? 'bg-emerald-950 border-2 border-emerald-500 text-emerald-100 font-medium'
                          : 'bg-slate-900 border border-rose-800 text-rose-200 font-medium'
                        : e.type === 'yellow_card' || e.type === 'red_card'
                        ? 'bg-amber-950/50 border border-amber-700/50 text-amber-200'
                        : e.type === 'injury'
                        ? 'bg-rose-950/60 border border-rose-700/60 text-rose-200'
                        : 'bg-[var(--app-surface-2)]/80 border border-[var(--app-border-subtle)] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-emerald-400 text-[11px]">
                        {e.clock?.minute ?? e.minute}{e.clock?.added ? '+' + e.clock.added : ''}′
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {session.teams[e.team === 'home' ? 0 : 1].name}
                      </span>
                    </div>
                    <div className="leading-snug">{e.description}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Col: Tactical Overview, Live Stats & Parallel Matches */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
          {/* Quick Tactical Action Card */}
          <section className="p-3.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] shadow-md flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>{userTeam.name} · {userTeam.formation}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Substituições: <strong className="text-white">{userTeam.substitutionsUsed}/{session.rules.substitutionLimit}</strong>
                {' · '}
                Paradas: <strong className="text-white">{userTeam.opportunitiesUsed}/{session.rules.opportunityLimit}</strong>
              </div>
            </div>

            <button
              onClick={() => {
                if (!session.paused) dispatchMatch({ type: 'pause' });
                setShowTacticsModal(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase cursor-pointer transition-all active:scale-95 shadow-md flex items-center space-x-1.5 shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Ajustar Tática & Trocas</span>
            </button>
          </section>

          {/* Estatísticas da Partida */}
          {renderLiveStats()}

          {/* Outros Jogos com Escudos */}
          {renderParallelMatches()}
        </div>
      </div>

      {/* MOBILE LAYOUT (< 1024px) */}
      <div className="flex-1 flex flex-col p-3 overflow-hidden min-h-0 lg:hidden">
        {/* Tab 1: Lance a Lance */}
        {mobileTab === 'events' && (
          <div className="flex-1 flex flex-col rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] p-3 overflow-hidden shadow-md">
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-sans text-xs">
              {session.events.length === 0 ? (
                <div className="text-center text-slate-500 py-8">Aguardando o início dos lances...</div>
              ) : (
                displayedEvents.map((e) => (
                  <div 
                    key={e.id} 
                    className={`p-2.5 rounded-md shadow-xs ${
                      e.type === 'goal' 
                        ? 'bg-emerald-950/90 border border-emerald-600/70 text-emerald-100 font-medium' 
                        : e.type === 'yellow_card' || e.type === 'red_card'
                        ? 'bg-amber-950/50 border border-amber-700/50 text-amber-200'
                        : 'bg-[var(--app-surface-2)]/80 border border-[var(--app-border-subtle)] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-emerald-400 text-[11px]">
                        {e.clock?.minute ?? e.minute}{e.clock?.added ? '+' + e.clock.added : ''}′
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {session.teams[e.team === 'home' ? 0 : 1].name}
                      </span>
                    </div>
                    <div className="leading-snug">{e.description}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Substituições & Decisões */}
        {mobileTab === 'lineup' && (
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            <MatchLineupPanel />
          </div>
        )}

        {/* Tab 3: Estatísticas & Outros Jogos */}
        {mobileTab === 'stats' && (
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {renderLiveStats()}
            {renderParallelMatches()}
          </div>
        )}
      </div>
        </>
      )}

      {/* ================= BARRA INFERIOR DE AÇÕES ================= */}
      <div className="shrink-0 bg-[var(--app-surface-1)] border-t border-[var(--app-border-subtle)] p-2.5 sm:p-3 shadow-2xl flex items-center justify-between gap-2 z-20">
        {/* Speed Controls: 1x, 2x, 5x */}
        <div className="flex items-center bg-[var(--app-surface-2)] p-1 rounded-lg border border-[var(--app-border-subtle)] shrink-0">
          {[1, 2, 5].map((speed) => (
            <button
              key={speed}
              onClick={() => dispatchMatch({ type: 'speed', speed })}
              className={`min-h-[44px] min-w-[38px] px-2 font-mono font-black text-xs rounded transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
                session.speed === speed
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Main Play / Pause or Complete Round Button */}
        {finished ? (
          <button
            onClick={() => completeRound()}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Ver Resultados da Rodada</span>
          </button>
        ) : (
          <button
            disabled={!!pending}
            onClick={() => dispatchMatch({ type: session.paused ? 'resume' : 'pause' })}
            className={`flex-1 min-h-[44px] px-4 py-2 rounded-lg font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              session.paused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            {session.paused ? (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{session.phase === 'halftime' ? 'Iniciar 2º Tempo' : 'Continuar Partida'}</span>
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pausar</span>
              </>
            )}
          </button>
        )}

        {/* Substitutions & Tactics Button (Opens tactical drawer & pauses) */}
        {!finished && (
          <button
            onClick={() => {
              if (!session.paused) dispatchMatch({ type: 'pause' });
              setShowTacticsModal(true);
            }}
            className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0 flex items-center space-x-1.5 border border-slate-700/60"
            title="Pausar e gerenciar escalação e formação"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Substituições</span>
          </button>
        )}

        {/* Fast Simulate Button */}
        {!finished && (
          <button
            disabled={!!pending || session.phase === 'halftime'}
            onClick={() => dispatchMatch({ type: 'finish' })}
            className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 shrink-0 flex items-center space-x-1"
            title="Simular até o apito final ou próxima intervenção"
          >
            <FastForward className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Simular</span>
          </button>
        )}

        {/* Sound Toggle Button */}
        <button
          onClick={() => updateOptions({ soundEnabled: !gameState.options.soundEnabled })}
          className="min-h-[44px] min-w-[44px] p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer active:scale-95 shrink-0 flex items-center justify-center"
          title={gameState.options.soundEnabled ? 'Silenciar som' : 'Ativar som'}
        >
          {gameState.options.soundEnabled ? (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-500" />
          )}
        </button>
      </div>
    </div>
  );
};
