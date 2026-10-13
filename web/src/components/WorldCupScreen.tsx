import React, { useState } from 'react';
import { useGame } from '../state/GameContext';
import { 
  Trophy, 
  Globe, 
  Users, 
  ArrowRight, 
  Award, 
  CheckCircle2, 
  ChevronRight, 
  ShieldCheck, 
  Star,
  Play,
  RotateCw,
  Shuffle,
  Shield,
  Calendar,
  Layers,
  MapPin,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import type { WorldCupGroup, MatchFixture, NationalCallup, FormationType, TacticalMentality, Player } from '../types/index.ts';
import { getWorldCupHostInfo, getPotsForWorldCup, initializeNationalTeams } from '../data/nationalTeamsData';
import { sound } from '../audio/soundEngine';

export const WorldCupScreen: React.FC = () => {
  const { 
    gameState, 
    setScreen, 
    acceptNationalTeamOffer, 
    rejectNationalTeamOffer,
    advanceWorldCup,
    performWorldCupDrawAction,
    finishWorldCupAndReturnToClub,
  } = useGame();

  const worldCup = gameState.worldCup;
  const nationalJob = gameState.nationalJob;
  const offers = gameState.nationalTeamOffers?.filter(o => o.status === 'pending') || [];
  const callups = gameState.nationalCallups || [];

  const [activeTab, setActiveTab] = useState<'groups' | 'knockout' | 'my_squad' | 'draw' | 'callups' | 'offers'>(
    worldCup && !worldCup.drawCompleted ? 'draw' : nationalJob ? 'my_squad' : 'groups'
  );
  const [selectedGroup, setSelectedGroup] = useState<string>('A');
  const [mobileKnockoutStage, setMobileKnockoutStage] = useState<'r16' | 'qf' | 'sf' | 'final'>('r16');
  const [isSimulating, setIsSimulating] = useState(false);

  // Tactic states for the user's managed national team
  const [nationalFormation, setNationalFormation] = useState<FormationType>('4-4-2');
  const [nationalMentality, setNationalMentality] = useState<TacticalMentality>('Equilibrada');

  if (!worldCup) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
          <Globe className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-100">Copa do Mundo FIFA</h2>
        <p className="text-slate-400">
          A Copa do Mundo é disputada a cada 4 anos (2026, 2030, 2034) durante a janela de junho/julho.
          Nesta temporada ({gameState.seasonYear}), as seleções disputam eliminatórias e amistosos preparatórios.
        </p>
        <button
          onClick={() => setScreen('overview')}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition cursor-pointer"
        >
          Voltar à Carreira
        </button>
      </div>
    );
  }

  const hostInfo = worldCup.hostInfo || getWorldCupHostInfo(worldCup.seasonYear);
  const currentGroup = worldCup.groups.find(g => g.groupLetter === selectedGroup) || worldCup.groups[0];

  const r16Matches = worldCup.fixtures.filter(f => f.round === 4);
  const qfMatches = worldCup.fixtures.filter(f => f.round === 5);
  const sfMatches = worldCup.fixtures.filter(f => f.round === 6);
  const finalMatch = worldCup.fixtures.find(f => f.round === 7);

  // Compute active round of the tournament
  const getActiveRoundInfo = () => {
    if (worldCup.status === 'finished' || worldCup.champion) {
      return { roundNumber: 8, label: 'Torneio Concluído', dateText: '15/07', isFinal: true, canPlay: false };
    }
    const r1 = worldCup.fixtures.filter(f => f.round === 1);
    const r2 = worldCup.fixtures.filter(f => f.round === 2);
    const r3 = worldCup.fixtures.filter(f => f.round === 3);
    if (!r1.every(f => f.played)) return { roundNumber: 1, label: 'Fase de Grupos • Rodada 1', dateText: '21/06', isFinal: false, canPlay: true };
    if (!r2.every(f => f.played)) return { roundNumber: 2, label: 'Fase de Grupos • Rodada 2', dateText: '25/06', isFinal: false, canPlay: true };
    if (!r3.every(f => f.played)) return { roundNumber: 3, label: 'Fase de Grupos • Rodada 3', dateText: '29/06', isFinal: false, canPlay: true };
    if (!r16Matches.every(f => f.played)) return { roundNumber: 4, label: 'Oitavas de Final (Jogo Único)', dateText: '02/07', isFinal: false, canPlay: true };
    if (!qfMatches.every(f => f.played)) return { roundNumber: 5, label: 'Quartas de Final (Jogo Único)', dateText: '06/07', isFinal: false, canPlay: true };
    if (!sfMatches.every(f => f.played)) return { roundNumber: 6, label: 'Semifinais (Jogo Único)', dateText: '10/07', isFinal: false, canPlay: true };
    if (finalMatch && !finalMatch.played) return { roundNumber: 7, label: 'Grande Final da Copa do Mundo', dateText: '15/07', isFinal: true, canPlay: true };
    return { roundNumber: 8, label: 'Campeão Consagrado', dateText: '15/07', isFinal: true, canPlay: false };
  };

  const currentRoundInfo = getActiveRoundInfo();

  // Find user's national team if managing one
  const userNationalTeam = nationalJob
    ? (() => {
        for (const g of worldCup.groups) {
          const found = g.teams.find(t => t.id === nationalJob.nationalTeamId || t.countryId === nationalJob.countryId);
          if (found) return found;
        }
        return null;
      })()
    : null;

  const getTeamName = (id: number): { name: string; flag: string; shirtUrl: string } => {
    for (const group of worldCup.groups) {
      const found = group.teams.find(t => t.id === id);
      if (found) return { name: found.name, flag: found.flag, shirtUrl: found.shirtUrl };
    }
    return { name: 'A definir', flag: '🏳️', shirtUrl: '' };
  };

  const allNationalTeams = initializeNationalTeams(gameState.clubs);
  const pots = getPotsForWorldCup(worldCup.seasonYear, allNationalTeams);

  const handlePlayRound = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    sound.playClick();
    setTimeout(() => {
      advanceWorldCup(currentRoundInfo.roundNumber);
      setIsSimulating(false);
      sound.playWhistle();
    }, 400);
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-5 md:p-6 space-y-5 pb-20 md:pb-8">
      {/* Header Banner with Authentic Host Identity */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border border-slate-700/60 p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner shrink-0">
              <Trophy className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  FIFA World Cup
                </span>
                <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
                  <span>{hostInfo.hosts.map(h => h.flag).join(' ')}</span>
                  <span className="hidden sm:inline font-semibold">{hostInfo.hostTitle}</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-100 tracking-tight mt-0.5">
                Copa do Mundo FIFA {worldCup.seasonYear}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                {hostInfo.hostSlogan}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {hostInfo.famousStadiums.map((stadium, i) => (
                  <span key={i} className="text-[10px] bg-slate-800/80 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 text-rose-400" />
                    {stadium}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action Hub: Current Managed Team or Play Match Button */}
          <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            {nationalJob && (
              <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-xl px-3.5 py-2 flex items-center gap-3 shadow">
                <img
                  src={`/selecoes/camisas/${nationalJob.code}.png`}
                  alt={nationalJob.nationalTeamName}
                  className="w-8 h-8 object-contain drop-shadow shrink-0"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block leading-tight">Comando Técnico:</span>
                  <p className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                    Seleção {nationalJob.nationalTeamName}
                  </p>
                </div>
              </div>
            )}

            {/* Play Round or Finish Button */}
            {worldCup.champion ? (
              <button
                onClick={finishWorldCupAndReturnToClub}
                className="py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trophy className="w-4 h-4" />
                Retornar ao Clube (Rodada 19)
              </button>
            ) : !worldCup.drawCompleted ? (
              <button
                onClick={() => setActiveTab('draw')}
                className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer animate-pulse"
              >
                <Shuffle className="w-4 h-4" />
                Realizar Sorteio dos Grupos
              </button>
            ) : (
              <button
                onClick={handlePlayRound}
                disabled={isSimulating}
                className={`py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs sm:text-sm transition shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
                  isSimulating ? 'opacity-50 cursor-wait' : ''
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                {isSimulating ? 'Simulando Partidas...' : `Jogar ${currentRoundInfo.label}`}
              </button>
            )}
          </div>
        </div>

        {/* Champion Celebration Banner if finished */}
        {worldCup.champion && (
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{worldCup.champion.flag}</span>
              <div>
                <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Campeã Mundial FIFA
                </span>
                <h3 className="text-lg sm:text-xl font-black text-amber-200">
                  {worldCup.champion.name} é a Campeã da Copa do Mundo {worldCup.seasonYear}!
                </h3>
              </div>
            </div>
            {worldCup.runnerUp && (
              <div className="text-left sm:text-right text-xs text-slate-300">
                Vice-campeã: <span className="font-bold text-slate-100">{worldCup.runnerUp.flag} {worldCup.runnerUp.name}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs (Mobile-Friendly Horizontal Scrolling) */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        {userNationalTeam && (
          <button
            onClick={() => setActiveTab('my_squad')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'my_squad'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Shield className="w-4 h-4" />
            Minha Seleção ({userNationalTeam.name})
          </button>
        )}

        <button
          onClick={() => setActiveTab('groups')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'groups'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Globe className="w-4 h-4" />
          Fase de Grupos
        </button>

        <button
          onClick={() => setActiveTab('knockout')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'knockout'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Mata-Mata
        </button>

        <button
          onClick={() => setActiveTab('draw')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'draw'
              ? 'bg-indigo-600 text-white shadow-md'
              : !worldCup.drawCompleted
              ? 'text-indigo-400 font-black animate-pulse hover:bg-indigo-950/40'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Shuffle className="w-4 h-4" />
          Sorteio dos Grupos
          {!worldCup.drawCompleted && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
        </button>

        <button
          onClick={() => setActiveTab('callups')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'callups'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          Convocados do Seu Clube ({callups.length})
        </button>

        {offers.length > 0 && (
          <button
            onClick={() => setActiveTab('offers')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'offers'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Award className="w-4 h-4" />
            Convites de Seleção ({offers.length})
          </button>
        )}
      </div>

      {/* Tab: Sorteio dos Grupos da FIFA (Draw Ceremony) */}
      {activeTab === 'draw' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 border border-indigo-500/30 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                  Cerimônia Oficial FIFA
                </span>
                <span className="text-xs text-slate-400">4 Potes • 8 Grupos</span>
              </div>
              <h3 className="text-xl font-bold text-slate-100 mt-1">
                Sorteio dos Grupos da Copa do Mundo {worldCup.seasonYear}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Os países-sede {hostInfo.hosts.map(h => h.name).join(', ')} e as melhores seleções do mundo no Pote 1.
                Máximo de 2 seleções europeias por grupo e no máximo 1 das demais confederações.
              </p>
            </div>

            <button
              onClick={() => {
                performWorldCupDrawAction();
                setActiveTab('groups');
              }}
              className="w-full md:w-auto px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-black rounded-xl text-sm transition shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              {worldCup.drawCompleted ? 'Sortear Novamente os Grupos' : 'Realizar Sorteio dos Grupos'}
            </button>
          </div>

          {/* 4 Official FIFA Pots */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Pote 1 (Cabeças de Chave & Sedes)', teams: pots.pot1, color: 'border-amber-500/40 bg-amber-950/10' },
              { title: 'Pote 2 (Seleções Fortes)', teams: pots.pot2, color: 'border-indigo-500/40 bg-indigo-950/10' },
              { title: 'Pote 3 (Seleções Médias)', teams: pots.pot3, color: 'border-emerald-500/40 bg-emerald-950/10' },
              { title: 'Pote 4 (Seleções Desafiantes)', teams: pots.pot4, color: 'border-slate-700 bg-slate-900/40' },
            ].map((pot, idx) => (
              <div key={idx} className={`p-4 rounded-2xl border ${pot.color} space-y-3 shadow`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">{pot.title}</h4>
                  <span className="text-[10px] font-mono text-slate-400">{pot.teams.length} seleções</span>
                </div>
                <div className="space-y-1.5">
                  {pot.teams.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base">{t.flag}</span>
                        <span className="font-semibold text-slate-200 truncate">{t.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0 uppercase">{t.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Minha Seleção (Escalação e Tática) */}
      {activeTab === 'my_squad' && userNationalTeam && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={userNationalTeam.shirtUrl}
                alt={userNationalTeam.name}
                className="w-12 h-12 object-contain drop-shadow"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{userNationalTeam.flag}</span>
                  <h3 className="text-xl font-black text-slate-100">Seleção {userNationalTeam.name}</h3>
                </div>
                <p className="text-xs text-slate-400">
                  23 Atletas Convocados • Força Média {Math.round(userNationalTeam.squad.reduce((a, b) => a + b.strength, 0) / userNationalTeam.squad.length)}
                </p>
              </div>
            </div>

            {/* Quick Tactics Toggles */}
            <div className="flex items-center gap-2 text-xs">
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                <span className="text-slate-400">Formação:</span>
                <select
                  value={nationalFormation}
                  onChange={(e) => setNationalFormation(e.target.value as FormationType)}
                  className="bg-slate-900 text-slate-100 font-bold px-2 py-1 rounded border border-slate-700 cursor-pointer"
                >
                  <option value="4-4-2">4-4-2</option>
                  <option value="4-3-3">4-3-3</option>
                  <option value="3-5-2">3-5-2</option>
                  <option value="4-2-3-1">4-2-3-1</option>
                </select>
              </div>

              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                <span className="text-slate-400">Mentalidade:</span>
                <select
                  value={nationalMentality}
                  onChange={(e) => setNationalMentality(e.target.value as TacticalMentality)}
                  className="bg-slate-900 text-slate-100 font-bold px-2 py-1 rounded border border-slate-700 cursor-pointer"
                >
                  <option value="Equilibrada">Equilibrada</option>
                  <option value="Ofensiva">Ofensiva</option>
                  <option value="Defensiva">Defensiva</option>
                </select>
              </div>
            </div>
          </div>

          {/* Squad Grid: Starters and Reserves */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Titulares (11) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="font-bold text-sm text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> 11 Titulares Escalados
                </h4>
                <span className="text-xs text-slate-400">Formação {nationalFormation}</span>
              </div>
              <div className="divide-y divide-slate-800/60">
                {userNationalTeam.squad.filter(p => p.isStarter).map((p, idx) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-slate-500 font-bold font-mono">{idx + 1}</span>
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {p.position}
                      </span>
                      <div>
                        <span className="font-bold text-slate-200">{p.name}</span>
                        <span className="text-[10px] text-slate-400 block">{p.age} anos • {p.skill1 || 'Habilidade'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">FOR {p.strength}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Suplentes / Banco de Reservas (12) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4" /> Banco de Reservas (12)
                </h4>
                <span className="text-xs text-slate-400">Prontos para entrar</span>
              </div>
              <div className="divide-y divide-slate-800/60 max-h-[460px] overflow-y-auto pr-1">
                {userNationalTeam.squad.filter(p => !p.isStarter).map((p, idx) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-slate-500 font-bold font-mono">{idx + 12}</span>
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-300">
                        {p.position}
                      </span>
                      <div>
                        <span className="font-bold text-slate-300">{p.name}</span>
                        <span className="text-[10px] text-slate-500 block">{p.age} anos</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-300">FOR {p.strength}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Fase de Grupos */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Group Letters Selector (Mobile Scrollable) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const).map(letter => {
              const grp = worldCup.groups.find(g => g.groupLetter === letter);
              const isSelected = selectedGroup === letter;
              return (
                <button
                  key={letter}
                  onClick={() => setSelectedGroup(letter)}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/30'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                  }`}
                >
                  <span>Grupo {letter}</span>
                  <span className="text-[11px] opacity-75 font-normal">
                    ({grp?.teams.map(t => t.flag).join('')})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Group Table and Matches */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Standings Table */}
            <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  Classificação • Grupo {currentGroup.groupLetter}
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">Top 2 avançam às Oitavas</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left">
                  <thead>
                    <tr className="text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-2">Pos</th>
                      <th className="py-2.5 px-2">Seleção</th>
                      <th className="py-2.5 px-2 text-center font-bold">PTS</th>
                      <th className="py-2.5 px-1.5 text-center">J</th>
                      <th className="py-2.5 px-1.5 text-center">V</th>
                      <th className="py-2.5 px-1.5 text-center">E</th>
                      <th className="py-2.5 px-1.5 text-center">D</th>
                      <th className="py-2.5 px-1.5 text-center hidden sm:table-cell">GP</th>
                      <th className="py-2.5 px-1.5 text-center hidden sm:table-cell">GC</th>
                      <th className="py-2.5 px-1.5 text-center">SG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {currentGroup.standings.map((row, idx) => {
                      const nt = currentGroup.teams.find(t => t.id === row.clubId);
                      const isTop2 = idx < 2;
                      return (
                        <tr
                          key={row.clubId}
                          className={`hover:bg-slate-800/40 transition ${
                            isTop2 ? 'bg-emerald-950/20' : ''
                          }`}
                        >
                          <td className="py-3 px-2 font-bold text-slate-300">
                            <span className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-[11px] ${
                              isTop2 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-500'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-3 px-2 font-semibold text-slate-200">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-base sm:text-lg shrink-0">{nt?.flag || '🏳️'}</span>
                              <span className="truncate">{row.clubName}</span>
                              {nt?.code && (
                                <span className="text-[10px] text-slate-500 uppercase font-mono hidden sm:inline">
                                  {nt.code}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-emerald-400 font-mono">
                            {row.points}
                          </td>
                          <td className="py-3 px-1.5 text-center font-mono text-slate-300">{row.played}</td>
                          <td className="py-3 px-1.5 text-center font-mono text-slate-300">{row.won}</td>
                          <td className="py-3 px-1.5 text-center font-mono text-slate-300">{row.drawn}</td>
                          <td className="py-3 px-1.5 text-center font-mono text-slate-300">{row.lost}</td>
                          <td className="py-3 px-1.5 text-center font-mono text-slate-400 hidden sm:table-cell">{row.goalsFor}</td>
                          <td className="py-3 px-1.5 text-center font-mono text-slate-400 hidden sm:table-cell">{row.goalsAgainst}</td>
                          <td className="py-3 px-1.5 text-center font-mono font-semibold text-slate-200">
                            {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Group Matches */}
            <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center justify-between">
                <span>Jogos do Grupo {currentGroup.groupLetter}</span>
                <span className="text-xs text-slate-400 font-normal">3 Rodadas</span>
              </h3>

              <div className="space-y-2.5">
                {currentGroup.fixtures.map((fix) => {
                  const home = getTeamName(fix.homeClubId);
                  const away = getTeamName(fix.awayClubId);
                  return (
                    <div
                      key={fix.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition"
                    >
                      <div className="flex-1 flex items-center justify-end gap-2 text-right truncate">
                        <span className="font-semibold text-slate-200 truncate">{home.name}</span>
                        <span className="text-base shrink-0">{home.flag}</span>
                      </div>

                      <div className="px-3 shrink-0 text-center font-mono font-bold text-sm">
                        {fix.played ? (
                          <span className="text-slate-100 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            {fix.homeScore} x {fix.awayScore}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px] uppercase tracking-wider block">
                            {fix.date ? fix.date.slice(5) : 'A jogar'}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 flex items-center justify-start gap-2 text-left truncate">
                        <span className="text-base shrink-0">{away.flag}</span>
                        <span className="font-semibold text-slate-200 truncate">{away.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Chaveamento Mata-Mata (Responsive Mobile Tabs + Desktop 4-Columns) */}
      {activeTab === 'knockout' && (
        <div className="space-y-6">
          {/* Mobile Phase Pill Selector */}
          <div className="flex md:hidden items-center justify-between gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setMobileKnockoutStage('r16')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition text-center ${
                mobileKnockoutStage === 'r16' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400'
              }`}
            >
              Oitavas (8)
            </button>
            <button
              onClick={() => setMobileKnockoutStage('qf')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition text-center ${
                mobileKnockoutStage === 'qf' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'
              }`}
            >
              Quartas (4)
            </button>
            <button
              onClick={() => setMobileKnockoutStage('sf')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition text-center ${
                mobileKnockoutStage === 'sf' ? 'bg-purple-600 text-white shadow' : 'text-slate-400'
              }`}
            >
              Semis (2)
            </button>
            <button
              onClick={() => setMobileKnockoutStage('final')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition text-center ${
                mobileKnockoutStage === 'final' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400'
              }`}
            >
              Final
            </button>
          </div>

          {/* Knockout Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Oitavas de Final */}
            <div className={`space-y-3 ${mobileKnockoutStage !== 'r16' ? 'hidden md:block' : ''}`}>
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">Oitavas de Final (02/07)</h4>
              </div>
              <div className="space-y-2.5">
                {r16Matches.map((fix) => {
                  const home = getTeamName(fix.homeClubId);
                  const away = getTeamName(fix.awayClubId);
                  return (
                    <div key={fix.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5 shadow">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-medium text-slate-200 truncate">
                          <span>{home.flag}</span> {home.name}
                        </span>
                        <span className="font-mono font-bold text-slate-100">{fix.played ? fix.homeScore : '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-medium text-slate-200 truncate">
                          <span>{away.flag}</span> {away.name}
                        </span>
                        <span className="font-mono font-bold text-slate-100">{fix.played ? fix.awayScore : '-'}</span>
                      </div>
                      {fix.penaltyScore && (
                        <div className="text-[10px] text-amber-400 font-mono text-center pt-1 border-t border-slate-800">
                          Pênaltis: {fix.penaltyScore[0]} x {fix.penaltyScore[1]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quartas de Final */}
            <div className={`space-y-3 ${mobileKnockoutStage !== 'qf' ? 'hidden md:block' : ''}`}>
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">Quartas de Final (06/07)</h4>
              </div>
              <div className="space-y-2.5">
                {qfMatches.map((fix) => {
                  const home = getTeamName(fix.homeClubId);
                  const away = getTeamName(fix.awayClubId);
                  return (
                    <div key={fix.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5 shadow">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-medium text-slate-200 truncate">
                          <span>{home.flag}</span> {home.name}
                        </span>
                        <span className="font-mono font-bold text-slate-100">{fix.played ? fix.homeScore : '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-medium text-slate-200 truncate">
                          <span>{away.flag}</span> {away.name}
                        </span>
                        <span className="font-mono font-bold text-slate-100">{fix.played ? fix.awayScore : '-'}</span>
                      </div>
                      {fix.penaltyScore && (
                        <div className="text-[10px] text-amber-400 font-mono text-center pt-1 border-t border-slate-800">
                          Pênaltis: {fix.penaltyScore[0]} x {fix.penaltyScore[1]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Semifinais */}
            <div className={`space-y-3 ${mobileKnockoutStage !== 'sf' ? 'hidden md:block' : ''}`}>
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">Semifinais (10/07)</h4>
              </div>
              <div className="space-y-2.5">
                {sfMatches.map((fix) => {
                  const home = getTeamName(fix.homeClubId);
                  const away = getTeamName(fix.awayClubId);
                  return (
                    <div key={fix.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5 shadow">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-medium text-slate-200 truncate">
                          <span>{home.flag}</span> {home.name}
                        </span>
                        <span className="font-mono font-bold text-slate-100">{fix.played ? fix.homeScore : '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-medium text-slate-200 truncate">
                          <span>{away.flag}</span> {away.name}
                        </span>
                        <span className="font-mono font-bold text-slate-100">{fix.played ? fix.awayScore : '-'}</span>
                      </div>
                      {fix.penaltyScore && (
                        <div className="text-[10px] text-amber-400 font-mono text-center pt-1 border-t border-slate-800">
                          Pênaltis: {fix.penaltyScore[0]} x {fix.penaltyScore[1]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grande Final */}
            <div className={`space-y-3 ${mobileKnockoutStage !== 'final' ? 'hidden md:block' : ''}`}>
              <div className="flex items-center gap-2 pb-2 border-b border-amber-500/40">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-amber-300">Grande Final (15/07)</h4>
              </div>
              {finalMatch ? (() => {
                const home = getTeamName(finalMatch.homeClubId);
                const away = getTeamName(finalMatch.awayClubId);
                return (
                  <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-950/40 to-slate-900 border border-amber-500/30 text-xs space-y-3 shadow-xl">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                        <span>{home.flag}</span> {home.name}
                      </span>
                      <span className="font-mono font-black text-lg text-amber-400">{finalMatch.played ? finalMatch.homeScore : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                        <span>{away.flag}</span> {away.name}
                      </span>
                      <span className="font-mono font-black text-lg text-amber-400">{finalMatch.played ? finalMatch.awayScore : '-'}</span>
                    </div>
                    {finalMatch.penaltyScore && (
                      <div className="text-xs text-amber-400 font-mono text-center pt-2 border-t border-amber-500/20 font-bold">
                        Pênaltis: {finalMatch.penaltyScore[0]} x {finalMatch.penaltyScore[1]}
                      </div>
                    )}
                  </div>
                );
              })() : null}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Convocados do Seu Clube (Strict Cap Applied) */}
      {activeTab === 'callups' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                Atletas Convocados do {gameState.clubs.find(c => c.id === gameState.userClubId)?.name}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Cota oficial da FIFA (máximo 1 a 2 convocados por clube) • Passe valorizado pós-torneio
              </p>
            </div>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs rounded-full border border-emerald-500/30">
              {callups.length} Convocado(s)
            </span>
          </div>

          {callups.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="font-semibold">Nenhum jogador do seu clube foi convocado para a Copa do Mundo.</p>
              <p className="text-xs text-slate-500 mt-1">Destaques com boa média ou estrelas mundiais têm prioridade na lista final.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {callups.map((c) => (
                <div
                  key={c.playerId}
                  className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-3 shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-100 text-sm">{c.playerName}</h4>
                      <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Convocado pela Seleção {c.nationalTeamName}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">
                      +{c.marketValueBoostPercent}%
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-700/60 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Valor Anterior:</span>
                      <span className="font-mono">R$ {c.originalMarketValue.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-400">
                      <span>Valor Pós-Copa:</span>
                      <span className="font-mono">R$ {c.boostedMarketValue.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Convites de Seleção */}
      {activeTab === 'offers' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                Propostas Oficiais para Comandar Seleções
              </h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Você pode assumir uma Seleção Nacional em paralelo com seu clube durante as competições de seleções.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700 p-5 space-y-4 shadow-lg flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={`/selecoes/camisas/${offer.code}.png`}
                      alt={offer.nationalTeamName}
                      className="w-12 h-12 object-contain drop-shadow"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{offer.flag}</span>
                        <h4 className="font-black text-lg text-slate-100">Seleção {offer.nationalTeamName}</h4>
                      </div>
                      <div className="flex items-center gap-1 text-amber-400 text-xs mt-0.5">
                        {Array.from({ length: offer.reputation }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-current" />
                        ))}
                        <span className="ml-1 text-slate-400">({offer.reputation} estrelas)</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs uppercase font-mono bg-slate-950 px-2 py-1 rounded text-slate-400">
                    {offer.code}
                  </span>
                </div>

                <p className="text-xs text-slate-300">
                  A confederação de futebol da {offer.nationalTeamName} formalizou proposta para que você lidere o país na Copa do Mundo FIFA!
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      acceptNationalTeamOffer(offer.id);
                      setActiveTab('my_squad');
                    }}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Aceitar Proposta
                  </button>
                  <button
                    onClick={() => rejectNationalTeamOffer(offer.id)}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs sm:text-sm transition cursor-pointer"
                  >
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
