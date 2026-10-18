import React, { useState, useMemo } from 'react';
import { useGame } from '../state/GameContext';
import { 
  Trophy, 
  Calendar, 
  DollarSign, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Play, 
  TrendingUp, 
  Users, 
  Shield, 
  Building2, 
  Info,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Minus,
  Hammer,
  Landmark,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Newspaper,
  BarChart3,
  Zap,
  Award
} from 'lucide-react';
import { calculateSectorStrength, getSquadStarters } from '../engine/simulationEngine';
import { sound } from '../audio/soundEngine';
import { getAllClubs, getStateByCode, getStateById, findLeagueForClub, isPreLibPlaceholderId } from '../data/teamsDatabase';
import { getCompetitionZones, getZoneForPosition } from '../engine/competitionZones';
import { ClubCrest } from './ClubCrest';
import { getClubTheme } from '../theme/clubTheme';
import { formatMatchDate } from '../utils/dateFormatter';
import { COUNTRY_FLAGS } from '../data/countryFlags';

export const ClubOverview: React.FC = () => {
  const { 
    gameState, 
    userClub, 
    userFixture, 
    nextOpponent, 
    setScreen, 
    currentRoundFixtures,
    completeRound,
    advanceRound,
    viewClub,
    markNewsAsRead
  } = useGame();

  const userClubTheme = getClubTheme(userClub);
  const opponentTheme = nextOpponent ? getClubTheme(nextOpponent) : null;

  const [selectedRound, setSelectedRound] = useState(gameState.currentRound);
  const [mobileTab, setMobileTab] = useState<'standings' | 'calendar'>('standings');
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>('all');
  const [calendarGroupFilter, setCalendarGroupFilter] = useState<string>('all');
  const [selectedCompetitionTab, setSelectedCompetitionTab] = useState<string | null>(null);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const roundFixtures = gameState.calendar.filter((f) => (f.fixtureDateIndex ?? f.round) === selectedRound);

  const totalRounds = gameState.calendar.length > 0 ? Math.max(...gameState.calendar.map((f) => f.fixtureDateIndex ?? f.round)) : 38;
  const currentCompetition = gameState.calendar.find(f => (f.fixtureDateIndex ?? f.round) === gameState.currentRound)?.competitionType;

  const currentDateStr = currentRoundFixtures[0]?.date || gameState.calendar.find(f => (f.fixtureDateIndex ?? f.round) === gameState.currentRound)?.date;

  // Competição ativa exibida na tabela
  const defaultCompetitionTab = currentCompetition === 'estadual' ? 'estadual' :
    (currentCompetition === 'libertadores' || currentCompetition === 'sulamericana' || currentCompetition === 'champions') ? 'continental' :
    currentCompetition === 'copa' ? 'copa' : 'nacional';

  const activeCompetitionTab = selectedCompetitionTab || defaultCompetitionTab;

  const allExternalLeagues = useMemo(() => [
    ...(gameState.stateDivisions || []),
    ...(gameState.nationalDivisions || []),
    ...(gameState.continentalCompetitions || []),
    ...(gameState.otherLeagues || []),
  ], [gameState.stateDivisions, gameState.nationalDivisions, gameState.continentalCompetitions, gameState.otherLeagues]);

  const selectedOtherLeague = allExternalLeagues.find((l) => l.id === activeCompetitionTab);
  const tableIsOtherLeague = !!selectedOtherLeague;

  const tableIsEstadual = !tableIsOtherLeague && activeCompetitionTab === 'estadual';
  const tableIsContinental = !tableIsOtherLeague && activeCompetitionTab === 'continental';
  const tableIsCopa = !tableIsOtherLeague && activeCompetitionTab === 'copa';
  const tableIsNacional = !tableIsOtherLeague && activeCompetitionTab === 'nacional';

  const isNationalDiv = !!gameState.nationalDivisions?.some((d) => d.id === selectedOtherLeague?.id);
  const isStateDiv = !!gameState.stateDivisions?.some((d) => d.id === selectedOtherLeague?.id);
  const isSisterContinental = !!gameState.continentalCompetitions?.some((d) => d.id === selectedOtherLeague?.id) || selectedOtherLeague?.id === 'continental-sister';

  const tableTitle = tableIsOtherLeague
    ? (isNationalDiv || isStateDiv
        ? selectedOtherLeague.leagueName
        : isSisterContinental
        ? selectedOtherLeague.leagueName
        : selectedOtherLeague.countryId === userClub.countryId
        ? `${selectedOtherLeague.leagueName} (${selectedOtherLeague.seasonLabel})`
        : `${COUNTRY_FLAGS[selectedOtherLeague.countryId] || selectedOtherLeague.countryFlag || '🌐'} ${selectedOtherLeague.leagueName} (${selectedOtherLeague.seasonLabel})`)
    : tableIsEstadual 
    ? (gameState.stateChampionshipName || 'Campeonato Estadual') 
    : tableIsContinental 
    ? (gameState.continentalCupName || 'Copa Continental') 
    : tableIsCopa 
    ? (userClub.countryId === 29 ? 'Copa do Brasil' : 'Copa Nacional')
    : (gameState.nationalLeagueName || gameState.leagueName || 'Campeonato Nacional');

  const displayedStandings = tableIsOtherLeague
    ? selectedOtherLeague.standings
    : tableIsEstadual 
    ? (gameState.standingsEstadual || gameState.standings) 
    : tableIsContinental 
    ? (gameState.standingsContinental || gameState.standings) 
    : (gameState.standingsNacional || gameState.standings);

  const standingsList = displayedStandings || gameState.standings;

  const availableCompetitionTabs = useMemo(() => {
    const list: { id: string; label: string; isCurrent: boolean; badge?: string; tier?: number }[] = [];
    if (gameState.standingsEstadual && gameState.standingsEstadual.length > 0) {
      const isTier2 = gameState.stateTier === 2;
      list.push({
        id: 'estadual',
        label: gameState.stateChampionshipName ? gameState.stateChampionshipName.split('(')[0].trim() : 'Estadual',
        badge: isTier2 ? '2ª Divisão' : '1ª Divisão', // badge: '1ª Divisão'
        tier: isTier2 ? 2 : 1,
        isCurrent: currentCompetition === 'estadual',
      });
    }
    if (gameState.stateDivisions && gameState.stateDivisions.length > 0) {
      gameState.stateDivisions.forEach(sDiv => {
        list.push({
          id: sDiv.id,
          label: sDiv.leagueName,
          badge: sDiv.division === 1 ? '1ª Divisão' : '2ª Divisão', // badge: '2ª Divisão'
          tier: sDiv.division,
          isCurrent: false,
        });
      });
    }
    if (gameState.standingsNacional && gameState.standingsNacional.length > 0) {
      const divisionLetter = userClub.countryId === 29
        ? (userClub.division === 1 ? 'A' : userClub.division === 2 ? 'B' : userClub.division === 3 ? 'C' : userClub.division >= 4 ? 'D' : '')
        : '';
      const nationalLabel = divisionLetter
        ? `Brasileirão Série ${divisionLetter}`
        : (gameState.nationalLeagueName || gameState.leagueName || 'Brasileirão');
      list.push({
        id: 'nacional',
        label: nationalLabel,
        isCurrent: currentCompetition === 'nacional',
      });
    }
    if (gameState.standingsContinental && gameState.standingsContinental.length > 0) {
      list.push({
        id: 'continental',
        label: gameState.continentalCupName || 'Libertadores',
        isCurrent: currentCompetition === 'libertadores' || currentCompetition === 'sulamericana' || currentCompetition === 'champions',
      });
    }
    if (gameState.continentalCompetitions && gameState.continentalCompetitions.length > 0) {
      gameState.continentalCompetitions.forEach(sisterContinental => {
        list.push({
          id: sisterContinental.id,
          label: sisterContinental.leagueName,
          isCurrent: false,
        });
      });
    }
    const hasCopaMatches = gameState.calendar.some(f => f.competitionType === 'copa');
    if (hasCopaMatches) {
      list.push({
        id: 'copa',
        label: userClub.countryId === 29 ? 'Copa do Brasil' : 'Copa Nacional',
        isCurrent: currentCompetition === 'copa',
      });
    }
    if (gameState.nationalDivisions && gameState.nationalDivisions.length > 0) {
      gameState.nationalDivisions.forEach(div => {
        list.push({
          id: div.id,
          label: div.leagueName,
          isCurrent: false,
        });
      });
    }
    if (gameState.otherLeagues && gameState.otherLeagues.length > 0) {
      gameState.otherLeagues.forEach(other => {
        const flag = COUNTRY_FLAGS[other.countryId] || other.countryFlag || '🌐';
        const label = other.countryId === userClub.countryId
          ? other.leagueName
          : `${flag} ${other.leagueName}`;
        list.push({
          id: other.id,
          label,
          isCurrent: false,
        });
      });
    }
    return list;
  }, [gameState, currentCompetition, userClub.countryId, userClub.division]);

  const enrichedStandingsList = useMemo(() => {
    const matchesTargetComp = (compType?: string) => {
      if (tableIsOtherLeague) return false;
      if (tableIsContinental) return compType === 'libertadores' || compType === 'sulamericana' || compType === 'champions';
      if (tableIsEstadual) return compType === 'estadual';
      if (tableIsNacional) return compType === 'nacional';
      return false;
    };
    return standingsList.map(row => {
      if (row.group) return row;
      if (tableIsOtherLeague) return row;
      const fix = gameState.calendar.find(
        f =>
          matchesTargetComp(f.competitionType) &&
          (f.homeClubId === row.clubId || f.awayClubId === row.clubId) &&
          f.competitionRound?.startsWith('Grupo ')
      );
      const g = fix?.competitionRound?.match(/Grupo ([A-Z]+)(?:\s|$)/)?.[1];
      return g ? { ...row, group: g } : row;
    });
  }, [tableIsOtherLeague, tableIsContinental, tableIsEstadual, tableIsNacional, standingsList, gameState.calendar]);

  const continentalGroups = useMemo(() => {
    if (tableIsCopa) return [];
    const set = new Set<string>();
    for (const row of enrichedStandingsList) {
      if (row.group) set.add(row.group);
    }
    return set.size > 1 ? Array.from(set).sort() : [];
  }, [enrichedStandingsList, tableIsCopa]);

  // Grupos presentes na rodada selecionada no calendário
  const roundCalendarGroups = useMemo(() => {
    const set = new Set<string>();
    for (const fix of roundFixtures) {
      const match = fix.competitionRound?.match(/Grupo ([A-Z]+)/i);
      if (match?.[1]) set.add(match[1].toUpperCase());
    }
    return Array.from(set).sort();
  }, [roundFixtures]);

  const displayedRoundFixtures = useMemo(() => {
    if (calendarGroupFilter === 'all' || !roundCalendarGroups.includes(calendarGroupFilter)) {
      return roundFixtures;
    }
    return roundFixtures.filter((f) => f.competitionRound?.includes(`Grupo ${calendarGroupFilter}`));
  }, [roundFixtures, calendarGroupFilter, roundCalendarGroups]);

  const userStateInfo = getStateByCode(userClub.stateCode) || getStateById(userClub.stateId);
  const userLeagueInfo = findLeagueForClub(userClub.id);

  const copaStages = useMemo(() => {
    if (!tableIsCopa) return [];
    const allCopa = gameState.calendar.filter(f => f.competitionType === 'copa');
    const stagesOrder = [
      'Primeira Fase',
      'Segunda Fase',
      'Terceira Fase',
      'Oitavas de Final',
      'Quartas de Final',
      'Semifinal',
      'Final',
    ];
    const map = new Map<string, typeof allCopa>();
    for (const fix of allCopa) {
      const s = fix.stage || fix.competitionRound?.split('(')[0]?.trim() || 'Mata-mata';
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(fix);
    }
    return stagesOrder.filter(s => map.has(s)).map(s => ({ stage: s, fixtures: map.get(s)! }));
  }, [tableIsCopa, gameState.calendar]);

  const continentalPreStages = useMemo(() => {
    if (!tableIsContinental) return [];
    const allCont = gameState.calendar.filter(
      f => (f.competitionType === 'libertadores' || f.competitionType === 'sulamericana' || f.competitionType === 'champions') &&
           (f.stage?.startsWith('Pré-Libertadores') || f.competitionRound?.startsWith('Pré-Libertadores'))
    );
    const stagesOrder = ['Pré-Libertadores (2ª Fase)', 'Pré-Libertadores (3ª Fase)'];
    const map = new Map<string, typeof allCont>();
    for (const fix of allCont) {
      const s = fix.stage || fix.competitionRound?.split('(')[0]?.trim() || 'Pré-Libertadores';
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(fix);
    }
    return stagesOrder.filter(s => map.has(s)).map(s => ({ stage: s, fixtures: map.get(s)! }));
  }, [tableIsContinental, gameState.calendar]);

  const continentalKnockoutStages = useMemo(() => {
    if (!tableIsContinental) return [];
    const allCont = gameState.calendar.filter(
      f => (f.competitionType === 'libertadores' || f.competitionType === 'sulamericana' || f.competitionType === 'champions') &&
           f.stage && !f.stage.startsWith('Pré-Libertadores')
    );
    const stagesOrder = ['Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final'];
    const map = new Map<string, typeof allCont>();
    for (const fix of allCont) {
      const s = fix.stage!;
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(fix);
    }
    return stagesOrder.filter(s => map.has(s)).map(s => ({ stage: s, fixtures: map.get(s)! }));
  }, [tableIsContinental, gameState.calendar]);

  const activeKnockoutStages = tableIsCopa
    ? (selectedGroupTab === 'all' || !copaStages.some(s => s.stage === selectedGroupTab)
        ? copaStages
        : copaStages.filter(s => s.stage === selectedGroupTab))
    : tableIsContinental && selectedGroupTab === 'pre-libertadores'
      ? continentalPreStages
      : tableIsContinental && selectedGroupTab === 'mata-mata'
        ? continentalKnockoutStages
        : null;

  const competitionZones = useMemo(() => {
    const teamsPerTableOrGroup = continentalGroups.length > 0
      ? Math.max(4, enrichedStandingsList.filter(row => row.group === continentalGroups[0]).length)
      : standingsList.length;

    if (selectedOtherLeague) {
      if (selectedOtherLeague.id === 'continental-sister') {
        return getCompetitionZones({
          competitionType: 'sulamericana',
          totalTeams: teamsPerTableOrGroup,
        });
      }
      const isStateDiv = gameState.stateDivisions?.some(d => d.id === selectedOtherLeague.id);
      if (isStateDiv) {
        return getCompetitionZones({
          competitionType: 'estadual',
          totalTeams: teamsPerTableOrGroup,
          division: selectedOtherLeague.division ?? 2,
          countryId: 29,
          stateCode: userClub.stateCode,
          stateDivisions: 2,
        });
      }
      return getCompetitionZones({
        competitionType: 'nacional',
        totalTeams: teamsPerTableOrGroup,
        division: selectedOtherLeague.division ?? 1,
        countryId: selectedOtherLeague.countryId,
      });
    }
    const effectiveDivision = tableIsEstadual
      ? (gameState.stateTier ?? 1)
      : userClub.countryId === 29 && (userClub.division ?? 1) >= 4
      ? 4
      : (userClub.division ?? 1);
    return getCompetitionZones({
      competitionType: tableIsEstadual ? 'estadual' : tableIsContinental ? 'libertadores' : 'nacional',
      totalTeams: teamsPerTableOrGroup,
      division: effectiveDivision,
      countryId: userClub.countryId ?? 29,
      stateCode: userClub.stateCode,
      stateDivisions: (gameState.stateDivisions && gameState.stateDivisions.length > 0) ? 2 : (userStateInfo?.divisions ?? 1),
      totalClubsInState: userStateInfo?.clubCount,
      customRelegated: userLeagueInfo?.relegated,
    });
  }, [selectedOtherLeague, tableIsEstadual, tableIsContinental, continentalGroups, enrichedStandingsList, standingsList.length, userClub, userStateInfo, userLeagueInfo, gameState.stateDivisions, gameState.stateTier]);

  // Sector strengths and availability for user and opponent
  const userStarters = getSquadStarters(userClub);
  const unavailableStarters = userStarters.filter((p) => p.injured || p.suspended);
  const userStrength = calculateSectorStrength(userStarters);

  const opponentStarters = nextOpponent ? getSquadStarters(nextOpponent) : [];
  const opponentStrength = nextOpponent ? calculateSectorStrength(opponentStarters) : userStrength;

  // Manager & Career Status (Board Trust, Reputation & Manager Profile)
  const managers = gameState.managers || [];
  const humanManager = managers.find((m) => m.id === gameState.humanManagerId) 
    || managers.find((m) => m.kind === 'human')
    || {
      id: 'manager-human-1',
      name: gameState.managerName || 'Professor',
      boardRating: 65,
      reputation: 50,
      riskProfile: 'balanced' as const,
      seasonScore: 0,
      careerScore: 0,
      titles: [],
    };

  const boardRating = Math.max(0, Math.min(100, Math.round(humanManager.boardRating ?? 65)));
  const managerReputation = Math.max(0, Math.min(100, Math.round(humanManager.reputation ?? 50)));
  const boardStatus = 
    boardRating >= 75 ? { label: 'Diretoria Segura', color: 'text-emerald-400 bg-emerald-950/70 border-emerald-600/40', dot: 'bg-emerald-400' } :
    boardRating >= 50 ? { label: 'Diretoria Estável', color: 'text-amber-300 bg-amber-950/70 border-amber-600/40', dot: 'bg-amber-400' } :
    { label: 'Diretoria em Risco', color: 'text-rose-400 bg-rose-950/70 border-rose-600/40', dot: 'bg-rose-500' };

  const profileLabel = 
    humanManager.riskProfile === 'aggressive' ? 'Ofensivo' :
    humanManager.riskProfile === 'cautious' ? 'Cauteloso' : 'Equilibrado';

  const newsList = gameState.newsFeed || [];
  const headlineArticle = newsList.find((a) => a.isHeadline) || newsList[0];

  return (
    <div className="flex-1 flex flex-col lg:overflow-hidden bg-[var(--app-bg-deep)] p-2 sm:p-3 gap-2 sm:gap-2.5 lg:min-h-0 select-none pb-4 lg:pb-0">
      {/* TOP: CAREER & BOARD DASHBOARD WIDGET (ESTILO CLÁSSICO BRASFOOT) */}
      <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-2.5 sm:p-3 shadow-md shrink-0 relative overflow-hidden">
        {/* Top dual stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 flex z-10">
          <div className="flex-1" style={{ background: userClubTheme.stripeGradient }} />
          <div className="w-1 bg-[var(--app-surface-2)]" />
          <div className="flex-1" style={{ background: userClubTheme.stripeGradient }} />
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-2.5 sm:gap-4 pt-0.5">
          {/* Section 1: Identidade do Clube & Comando Técnico */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 shrink-0 min-w-0 flex-wrap sm:flex-nowrap gap-y-2">
            {/* Escudo e Nome com Divisão Abaixo */}
            <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
              <div 
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center font-bold text-sm shadow-md bg-[var(--app-bg-deep)] shrink-0 p-1 relative overflow-hidden"
                style={{ 
                  border: `1.5px solid ${userClubTheme.subtleBorder}`,
                  boxShadow: `0 0 12px ${userClubTheme.subtleBg}`
                }}
                title={userClub.name}
              >
                <ClubCrest club={userClub} size="lg" className="w-8 h-8 sm:w-9 sm:h-9" preferMini={false} />
                <div 
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: userClubTheme.stripeGradient }}
                />
              </div>

              <div className="flex flex-col shrink-0 min-w-0">
                <h1 className="text-sm sm:text-base font-black text-white leading-tight truncate max-w-[130px] sm:max-w-[180px]">
                  {userClub.name}
                </h1>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="text-[10px] sm:text-[11px] font-bold text-[var(--app-text-accent)] uppercase tracking-wider">
                    {gameState.divisionName || 'Série A'}
                  </span>
                  <span 
                    className="w-1.5 h-1.5 rounded-full inline-block shrink-0" 
                    style={{ backgroundColor: userClubTheme.primaryAccent }}
                    title={`Cores do ${userClub.name}`}
                  />
                </div>
              </div>
            </div>

            {/* Separador vertical sutil em telas maiores */}
            <div className="hidden sm:block h-8 w-px bg-[var(--app-border-subtle)] shrink-0" />

            {/* Comando Técnico & Métricas do Treinador */}
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center space-x-1.5 text-[10px] text-slate-400">
                <span className="uppercase font-bold tracking-wider">Comando Técnico:</span>
                <span className="font-bold text-slate-200 truncate max-w-[110px] sm:max-w-[160px]">
                  {humanManager.name}
                </span>
              </div>

              {/* Badges de Confiança da Diretoria, Reputação e Perfil */}
              <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mt-1">
                {/* Confiança da Diretoria */}
                <span 
                  className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold border ${boardStatus.color}`}
                  title={`Avaliação da Diretoria: ${boardRating}% (${boardStatus.label})`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${boardStatus.dot} animate-pulse`} />
                  <span>Confiança: {boardRating}%</span>
                </span>

                {/* Reputação */}
                <span 
                  className="inline-flex items-center gap-1 text-[10px] text-[var(--app-text-accent)] bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] px-1.5 py-0.5 rounded font-mono font-bold"
                  title={`Reputação do Treinador: ${managerReputation}%`}
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                  <span>Rep: {managerReputation}%</span>
                </span>

                {/* Perfil */}
                <span className="hidden md:inline-flex text-[10px] text-slate-400 bg-[var(--app-surface-2)]/60 px-1.5 py-0.5 rounded font-semibold border border-[var(--app-border-subtle)]">
                  Estilo: <strong className="text-slate-200 ml-1">{profileLabel}</strong>
                </span>

                {/* Força Média do Time */}
                <span className="hidden lg:inline-flex text-[10px] text-slate-400 bg-[var(--app-surface-2)]/60 px-1.5 py-0.5 rounded font-semibold border border-[var(--app-border-subtle)]">
                  Elenco: <strong className="text-[var(--app-text-accent)] ml-1">{userStrength.overall} Força</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Competição & Barra de Progresso da Temporada */}
          <div className="hidden lg:flex flex-col items-center justify-center px-4 py-1.5 bg-[var(--app-surface-2)]/60 rounded-md border border-[var(--app-border-subtle)] shrink-0 min-w-[220px]">
            <div className="flex items-center justify-between w-full text-[11px] mb-1">
              <span className="text-slate-400 truncate max-w-[130px] font-medium">
                {tableTitle || 'Campeonato'}
              </span>
              <span className="text-[var(--app-text-accent)] font-bold font-mono-numbers">
                Rodada {gameState.currentRound}/{totalRounds}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-[var(--app-bg-deep)] h-1.5 rounded-full overflow-hidden border border-[var(--app-border-subtle)]">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((gameState.currentRound / Math.max(1, totalRounds)) * 100))}%` }}
              />
            </div>
          </div>

          {/* Section 3: Widget de Saldo em Caixa */}
          <div 
            onClick={() => setScreen('finances')}
            className="flex items-center space-x-3 px-3 py-1.5 bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-2)]/80 border border-[var(--app-border-subtle)] rounded-lg cursor-pointer transition-all active:scale-98 shadow-xs ml-auto sm:ml-0"
            title="Ver Finanças detalhadas"
          >
            <div className="w-7 h-7 rounded-md bg-emerald-950/70 border border-emerald-600/40 flex items-center justify-center text-emerald-400 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                Saldo em Caixa
              </span>
              <span className={`text-xs sm:text-sm font-black font-mono-numbers block ${userClub.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatMoney(userClub.balance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PLANTÃO DA RODADA / HEADLINE TICKER */}
      {headlineArticle && (
        <div 
          onClick={() => { 
            sound.playClick(); 
            if (!headlineArticle.read) markNewsAsRead(headlineArticle.id); 
            setScreen('news'); 
          }}
          className="bg-[var(--app-surface-1)] hover:bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] hover:border-[var(--app-border-highlight)] rounded-lg px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2 shadow-xs shrink-0 cursor-pointer transition-all group"
          title="Clique para abrir a edição completa do Jornal"
        >
          <div className="flex items-center space-x-2 min-w-0">
            <span className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
              !headlineArticle.read
                ? 'bg-amber-950/80 text-amber-300 border-amber-600/50'
                : 'bg-[var(--app-surface-2)] text-slate-300 border-[var(--app-border-subtle)]'
            }`}>
              <Newspaper className="w-3 h-3 text-amber-400" />
              <span>Plantão</span>
              {!headlineArticle.read && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />
              )}
            </span>
            <span className={`text-xs font-bold truncate transition-colors ${
              !headlineArticle.read ? 'text-white group-hover:text-[var(--app-text-accent)]' : 'text-slate-300 group-hover:text-white'
            }`}>
              {headlineArticle.title}
            </span>
            {headlineArticle.subtitle && (
              <span className="hidden md:inline text-xs text-slate-400 truncate">
                — {headlineArticle.subtitle}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1 text-[11px] text-[var(--app-text-accent)] font-bold shrink-0">
            <span className="hidden sm:inline">Ler Jornal</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="flex-none lg:flex-1 flex flex-col lg:flex-row lg:overflow-hidden gap-2.5 sm:gap-3 lg:min-h-0">
        {/* COLUMN 1: TABELA DE CLASSIFICAÇÃO (50% NO DESKTOP, CONDICIONAL NO MOBILE) */}
        <div className={`bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col shadow-lg order-2 lg:order-1 lg:w-1/2 lg:min-h-0 lg:overflow-hidden ${mobileTab === 'standings' ? 'flex-none lg:flex-1' : 'hidden lg:flex'}`}>
        {/* Table Header */}
        <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-highlight)] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <Trophy className="w-4 h-4 text-[var(--app-text-accent)] shrink-0" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider truncate max-w-[240px] sm:max-w-[320px]">
              {tableTitle || gameState.leagueName || 'Campeonato Nacional'}
            </h2>
            {tableIsEstadual && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                gameState.stateTier === 2
                  ? 'bg-blue-950/60 text-blue-300 border border-blue-600/40'
                  : 'bg-amber-950/60 text-amber-300 border border-amber-600/40'
              }`}>
                {gameState.stateTier === 2 ? '2ª Divisão' : '1ª Divisão'}
              </span>
            )}
            {selectedOtherLeague && gameState.stateDivisions?.some(d => d.id === selectedOtherLeague.id) && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                selectedOtherLeague.division === 1
                  ? 'bg-amber-950/60 text-amber-300 border border-amber-600/40'
                  : 'bg-blue-950/60 text-blue-300 border border-blue-600/40'
              }`}>
                {selectedOtherLeague.division === 1 ? '1ª Divisão' : '2ª Divisão'}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            {selectedOtherLeague ? (
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-600/40 px-2 py-0.5 rounded font-mono-numbers font-bold">
                {selectedOtherLeague.currentRound}ª de {selectedOtherLeague.totalRounds} Rodadas
              </span>
            ) : (
              <>
                <span className="text-[11px] font-mono-numbers text-[var(--app-text-accent)] font-bold">
                  {formatMatchDate(currentDateStr, 'short')}
                </span>
                <span className="text-[9px] text-slate-300 bg-[var(--app-bg-deep)] px-1.5 py-0.5 rounded border border-[var(--app-border-subtle)] font-semibold">
                  Hoje
                </span>
              </>
            )}
          </div>
        </div>

        {/* Competition Switcher Selector (Dropdown compacto que elimina o scroll horizontal gigante) */}
        {availableCompetitionTabs.length > 1 && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-[var(--app-surface-2)]/90 border-b border-[var(--app-border-subtle)] shrink-0 text-xs">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider shrink-0 flex items-center space-x-1">
                <Trophy className="w-3.5 h-3.5 text-[var(--app-text-accent)] shrink-0" />
                <span className="hidden xs:inline">Torneio:</span>
              </span>
              <div className="relative flex-1 max-w-full sm:max-w-md">
                <select
                  value={activeCompetitionTab}
                  onChange={(e) => {
                    sound.playClick();
                    setSelectedCompetitionTab(e.target.value);
                    setSelectedGroupTab('all');
                  }}
                  className="w-full appearance-none bg-[var(--app-surface-3)] hover:bg-[var(--app-surface-2)] text-white text-[11px] sm:text-xs font-bold py-1.5 pl-2.5 pr-8 rounded-md border border-[var(--app-border-subtle)] hover:border-[var(--app-text-accent)] focus:outline-none focus:border-[var(--app-text-accent)] cursor-pointer truncate shadow-xs transition-colors"
                >
                  {availableCompetitionTabs.map(comp => (
                    <option key={comp.id} value={comp.id} className="bg-[var(--app-bg-deep)] text-white py-1">
                      {comp.label} {comp.badge ? `• ${comp.badge}` : ''} {comp.isCurrent ? '⭐ (Em Andamento)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              {availableCompetitionTabs.find(c => c.id === activeCompetitionTab)?.badge && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                  availableCompetitionTabs.find(c => c.id === activeCompetitionTab)?.tier === 2
                    ? 'bg-blue-950/70 text-blue-300 border border-blue-600/40'
                    : 'bg-amber-950/70 text-amber-300 border border-amber-600/40'
                }`}>
                  {availableCompetitionTabs.find(c => c.id === activeCompetitionTab)?.badge}
                </span>
              )}
              {availableCompetitionTabs.find(c => c.id === activeCompetitionTab)?.isCurrent && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-600/40 uppercase hidden sm:inline">
                  Em Andamento
                </span>
              )}
            </div>
          </div>
        )}

        {/* Copa do Brasil / Knockout Phases Filter Bar (Fases da Copa, sem vazamento de grupos) */}
        {tableIsCopa && copaStages.length > 0 && (
          <div className="flex items-center space-x-1 px-3 py-1 bg-[var(--app-surface-2)]/80 border-b border-[var(--app-border-subtle)] overflow-x-auto no-scrollbar shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setSelectedGroupTab('all')}
              className={`px-2 py-0.5 rounded font-bold text-[10px] sm:text-[11px] transition-colors shrink-0 cursor-pointer ${
                selectedGroupTab === 'all' || !copaStages.some(s => s.stage === selectedGroupTab)
                  ? 'bg-[var(--app-surface-3)] text-white border border-[var(--app-text-accent)]/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todas as Fases
            </button>
            {copaStages.map(({ stage }) => (
              <button
                key={stage}
                type="button"
                onClick={() => setSelectedGroupTab(stage)}
                className={`px-2 py-0.5 rounded font-bold text-[10px] sm:text-[11px] transition-colors shrink-0 cursor-pointer ${
                  selectedGroupTab === stage
                    ? 'bg-[var(--app-surface-3)] text-[var(--app-text-accent)] border border-[var(--app-text-accent)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {stage.replace(' de Final', '')}
              </button>
            ))}
          </div>
        )}

        {/* Groups Filter Bar (Continental, Série D, Paulistão, etc. - Apenas para ligas com grupos, nunca Copa) */}
        {!tableIsCopa && continentalGroups.length > 0 && (
          <div className="flex items-center space-x-1 px-3 py-1 bg-[var(--app-surface-2)]/80 border-b border-[var(--app-border-subtle)] overflow-x-auto no-scrollbar shrink-0 text-xs">
            {tableIsContinental && continentalPreStages.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedGroupTab('pre-libertadores')}
                className={`px-2 py-0.5 rounded font-bold text-[10px] sm:text-[11px] transition-colors shrink-0 cursor-pointer ${
                  selectedGroupTab === 'pre-libertadores'
                    ? 'bg-[var(--app-surface-3)] text-amber-300 border border-amber-500/80'
                    : 'text-amber-300/80 hover:text-amber-200'
                }`}
              >
                Pré-Libertadores
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedGroupTab('all')}
              className={`px-2 py-0.5 rounded font-bold text-[10px] sm:text-[11px] transition-colors shrink-0 cursor-pointer ${
                selectedGroupTab === 'all' || (!continentalGroups.includes(selectedGroupTab) && selectedGroupTab !== 'pre-libertadores' && selectedGroupTab !== 'mata-mata')
                  ? 'bg-[var(--app-surface-3)] text-white border border-[var(--app-text-accent)]/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos os Grupos
            </button>
            {continentalGroups.map(grp => (
              <button
                key={grp}
                type="button"
                onClick={() => setSelectedGroupTab(grp)}
                className={`px-2 py-0.5 rounded font-bold text-[10px] sm:text-[11px] transition-colors shrink-0 cursor-pointer ${
                  selectedGroupTab === grp
                    ? 'bg-[var(--app-surface-3)] text-[var(--app-text-accent)] border border-[var(--app-text-accent)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Grupo {grp}
              </button>
            ))}
            {tableIsContinental && continentalKnockoutStages.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedGroupTab('mata-mata')}
                className={`px-2 py-0.5 rounded font-bold text-[10px] sm:text-[11px] transition-colors shrink-0 cursor-pointer ${
                  selectedGroupTab === 'mata-mata'
                    ? 'bg-[var(--app-surface-3)] text-emerald-300 border border-emerald-500/80'
                    : 'text-emerald-300/80 hover:text-emerald-200'
                }`}
              >
                Mata-mata
              </button>
            )}
          </div>
        )}

        {/* Standings Table or Copa / Continental Knockout Stages */}
        {activeKnockoutStages !== null ? (
          <div className="flex-none lg:flex-1 lg:overflow-y-auto p-2 sm:p-2.5 space-y-3 no-scrollbar">
            {activeKnockoutStages.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                Nenhum jogo eliminatório programado ainda.
              </div>
            ) : (
              activeKnockoutStages.map(({ stage, fixtures }) => (
                <div key={stage} className="bg-[var(--app-surface-2)]/60 border border-[var(--app-border-subtle)] rounded-lg p-2 space-y-1.5">
                  <div className="text-[11px] font-bold text-[var(--app-text-accent)] uppercase tracking-wider px-1 pb-1 border-b border-[var(--app-border-subtle)] flex items-center justify-between">
                    <span>{stage}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{fixtures.length} confrontos</span>
                  </div>
                  <div className="space-y-1 pt-1">
                    {fixtures.map(fix => {
                      if (fix.pendingQualification) {
                        const knownHome = fix.homeClubId > 0
                          ? (gameState.clubs.find(c => c.id === fix.homeClubId) || getAllClubs().find(c => c.id === fix.homeClubId))
                          : undefined;
                        const knownAway = fix.awayClubId > 0
                          ? (gameState.clubs.find(c => c.id === fix.awayClubId) || getAllClubs().find(c => c.id === fix.awayClubId))
                          : undefined;
                        const isKnownUser = knownHome?.id === userClub.id || knownAway?.id === userClub.id;
                        return (
                          <div
                            key={fix.id}
                            className={`flex items-center justify-between px-2 py-1 rounded text-[11px] ${
                              isKnownUser
                                ? 'bg-[var(--app-surface-3)] border border-[var(--app-border-highlight)] text-white'
                                : 'bg-[var(--app-surface-1)] text-slate-400'
                            }`}
                          >
                            <span className={knownHome ? 'font-semibold text-slate-200' : ''}>{knownHome ? knownHome.name : 'A definir'}</span>
                            <span className="text-[10px] text-slate-500">{fix.competitionRound}</span>
                            <span className={knownAway ? 'font-semibold text-slate-200' : ''}>{knownAway ? knownAway.name : 'A definir'}</span>
                          </div>
                        );
                      }
                      const home = gameState.clubs.find(c => c.id === fix.homeClubId) || getAllClubs().find(c => c.id === fix.homeClubId);
                      const away = gameState.clubs.find(c => c.id === fix.awayClubId) || getAllClubs().find(c => c.id === fix.awayClubId);
                      if (!home || !away) return null;
                      const isUserMatch = home.id === userClub.id || away.id === userClub.id;

                      return (
                        <div
                          key={fix.id}
                          className={`flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                            isUserMatch ? 'bg-[var(--app-surface-3)] border border-[var(--app-border-highlight)]' : 'bg-[var(--app-surface-1)]'
                          }`}
                        >
                          <div 
                            onClick={() => viewClub(home.id)}
                            className="flex items-center space-x-1.5 w-[42%] justify-end truncate cursor-pointer hover:opacity-80"
                          >
                            <span className={`truncate text-[11px] ${home.id === userClub.id ? 'text-[var(--app-text-accent)] font-bold' : 'text-slate-200'}`}>
                              {home.name}
                            </span>
                            <ClubCrest club={home} size="sm" preferMini />
                          </div>
                          <div className="w-[16%] flex flex-col items-center justify-center shrink-0">
                            {fix.played ? (
                              <span className="font-mono-numbers font-black px-1.5 py-0.2 bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] rounded text-[var(--app-text-accent)] text-[11px]">
                                {fix.homeScore} x {fix.awayScore}
                                {fix.penaltyScore && (
                                  <span className="block text-[8px] text-amber-300">Pen {fix.penaltyScore[0]}x{fix.penaltyScore[1]}</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400 bg-[var(--app-bg-deep)] px-1.5 py-0.5 rounded border border-[var(--app-border-subtle)]">
                                {formatMatchDate(fix.date, 'short')}
                              </span>
                            )}
                          </div>
                          <div 
                            onClick={() => viewClub(away.id)}
                            className="flex items-center space-x-1.5 w-[42%] truncate cursor-pointer hover:opacity-80"
                          >
                            <ClubCrest club={away} size="sm" preferMini />
                            <span className={`truncate text-[11px] ${away.id === userClub.id ? 'text-[var(--app-text-accent)] font-bold' : 'text-slate-200'}`}>
                              {away.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex-none lg:flex-1 overflow-x-auto lg:overflow-y-auto no-scrollbar">
            <table className="w-full text-left text-xs brasfoot-table border-collapse min-w-[280px] sm:min-w-0">
              <thead>
                <tr className="sticky top-0 z-10">
                <th className="w-7 sm:w-8 text-center">#</th>
                <th>Clube</th>
                <th className="w-8 text-center">PTS</th>
                <th className="w-7 text-center">J</th>
                <th className="w-7 text-center hidden sm:table-cell">V</th>
                <th className="w-7 text-center hidden sm:table-cell">E</th>
                <th className="w-7 text-center hidden sm:table-cell">D</th>
                <th className="w-7 text-center hidden md:table-cell">GP</th>
                <th className="w-7 text-center hidden md:table-cell">GC</th>
                <th className="w-7 sm:w-8 text-center">SG</th>
                <th className="w-14 text-center hidden sm:table-cell">Forma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#14281f] font-mono-numbers">
              {continentalGroups.length > 0 ? (
                continentalGroups
                  .filter(grp => selectedGroupTab === 'all' || !continentalGroups.includes(selectedGroupTab) || selectedGroupTab === grp)
                  .map(grp => {
                    const groupRows = enrichedStandingsList.filter(r => r.group === grp);
                    return (
                      <React.Fragment key={grp}>
                        <tr className="bg-[var(--app-surface-2)] border-y border-[var(--app-border-subtle)]">
                          <td colSpan={11} className="py-1 px-3 text-[11px] font-bold text-[var(--app-text-accent)] uppercase tracking-wider">
                            Grupo {grp}
                          </td>
                        </tr>
                        {groupRows.map((row, indexInGroup) => {
                          const pos = indexInGroup + 1;
                          const isUser = row.clubId === userClub.id;
                          const isPlaceholder = isPreLibPlaceholderId(row.clubId);
                          const zone = getZoneForPosition(competitionZones, pos);
                          const posColor = zone ? zone.colorClass : 'text-slate-400';
                          const rowBg = zone ? zone.bgHoverClass : '';

                          return (
                            <tr
                              key={row.clubId}
                              onClick={isPlaceholder ? undefined : () => viewClub(row.clubId)}
                              style={
                                isUser
                                  ? {
                                      borderLeft: `4px solid ${userClubTheme.primaryAccent}`,
                                      backgroundColor: 'rgba(18, 38, 29, 0.75)',
                                    }
                                  : undefined
                              }
                              className={`transition-colors ${rowBg} ${
                                isPlaceholder ? 'cursor-default opacity-85' : 'cursor-pointer'
                              } ${
                                isUser
                                  ? 'text-white font-bold shadow-xs'
                                  : 'text-slate-300 hover:bg-[#152c21]'
                              }`}
                              title={
                                isPlaceholder
                                  ? 'Vaga da Pré-Libertadores a definir'
                                  : isUser
                                  ? 'Seu clube'
                                  : `Ver detalhes de ${row.clubName}`
                              }
                            >
                              <td className={`text-center py-1 text-[11px] ${posColor}`}>
                                {pos}
                              </td>
                              <td className="py-1 font-sans text-xs">
                                {isPlaceholder ? (
                                  <div className="flex items-center space-x-1 sm:space-x-1.5">
                                    <span className="w-4 h-4 rounded bg-amber-950/80 border border-amber-600/50 flex items-center justify-center text-[9px] text-amber-300 font-bold shrink-0">
                                      ?
                                    </span>
                                    <span className="truncate max-w-[105px] sm:max-w-[140px] font-semibold text-amber-300/90 italic">
                                      {row.clubName}
                                    </span>
                                    <span className="text-[8px] sm:text-[9px] px-1 rounded font-bold uppercase tracking-tighter shrink-0 bg-amber-950/60 text-amber-400 border border-amber-600/40">
                                      Pré-Lib
                                    </span>
                                  </div>
                                ) : (() => {
                                  const rowClub = gameState.clubs.find((c) => c.id === row.clubId) || getAllClubs().find((c) => c.id === row.clubId);
                                  return (
                                    <div className="flex items-center space-x-1 sm:space-x-1.5">
                                      <ClubCrest
                                        club={rowClub || { name: row.clubName, primaryColor: row.primaryColor }}
                                        size="sm"
                                        preferMini={true}
                                      />
                                      <span className="truncate max-w-[105px] sm:max-w-[140px] font-semibold">{row.clubName}</span>
                                      {isUser && (
                                        <span 
                                          className="text-[8px] sm:text-[9px] px-1 rounded font-bold uppercase tracking-tighter shrink-0"
                                          style={{
                                            backgroundColor: userClubTheme.primaryAccent,
                                            color: userClubTheme.onPrimaryAccent,
                                          }}
                                        >
                                          VOCÊ
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="text-center font-bold text-white text-[12px] bg-[#12231b]/60">
                                {row.points}
                              </td>
                              <td className="text-center text-slate-300 text-[11px]">{row.played}</td>
                              <td className="text-center text-emerald-300 text-[11px] hidden sm:table-cell">{row.won}</td>
                              <td className="text-center text-slate-400 text-[11px] hidden sm:table-cell">{row.drawn}</td>
                              <td className="text-center text-rose-300 text-[11px] hidden sm:table-cell">{row.lost}</td>
                              <td className="text-center text-slate-300 text-[11px] hidden md:table-cell">{row.goalsFor}</td>
                              <td className="text-center text-slate-300 text-[11px] hidden md:table-cell">{row.goalsAgainst}</td>
                              <td className={`text-center text-[11px] font-semibold ${
                                row.goalDiff > 0 ? 'text-emerald-400' : row.goalDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                              }`}>
                                {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                              </td>
                              <td className="text-center py-1 hidden sm:table-cell">
                                <div className="flex items-center justify-center space-x-0.5">
                                  {row.form.length === 0 ? (
                                    <span className="text-[10px] text-slate-600">-</span>
                                  ) : (
                                    row.form.slice(0, 4).map((res, i) => (
                                      <span
                                        key={i}
                                        className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold text-black ${
                                          res === 'V'
                                            ? 'bg-emerald-400'
                                            : res === 'E'
                                            ? 'bg-slate-400'
                                            : 'bg-rose-500'
                                        }`}
                                      >
                                        {res}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
              ) : (
                standingsList.map((row, index) => {
                  const pos = index + 1;
                  const isUser = row.clubId === userClub.id;
                  const isPlaceholder = isPreLibPlaceholderId(row.clubId);

                  const zone = getZoneForPosition(competitionZones, pos);
                  const posColor = zone ? zone.colorClass : 'text-slate-400';
                  const rowBg = zone ? zone.bgHoverClass : '';

                  return (
                    <tr
                      key={row.clubId}
                      onClick={isPlaceholder ? undefined : () => viewClub(row.clubId)}
                      style={
                        isUser
                          ? {
                              borderLeft: `4px solid ${userClubTheme.primaryAccent}`,
                              backgroundColor: 'rgba(18, 38, 29, 0.75)',
                            }
                          : undefined
                      }
                      className={`transition-colors ${rowBg} ${
                        isPlaceholder ? 'cursor-default opacity-85' : 'cursor-pointer'
                      } ${
                        isUser
                          ? 'text-white font-bold shadow-xs'
                          : 'text-slate-300 hover:bg-[#152c21]'
                      }`}
                      title={
                        isPlaceholder
                          ? 'Vaga da Pré-Libertadores a definir'
                          : isUser
                          ? 'Seu clube'
                          : `Ver detalhes de ${row.clubName}`
                      }
                    >
                      <td className={`text-center py-1 text-[11px] ${posColor}`}>
                        {pos}
                      </td>
                      <td className="py-1 font-sans text-xs">
                        {isPlaceholder ? (
                          <div className="flex items-center space-x-1 sm:space-x-1.5">
                            <span className="w-4 h-4 rounded bg-amber-950/80 border border-amber-600/50 flex items-center justify-center text-[9px] text-amber-300 font-bold shrink-0">
                              ?
                            </span>
                            <span className="truncate max-w-[105px] sm:max-w-[140px] font-semibold text-amber-300/90 italic">
                              {row.clubName}
                            </span>
                            <span className="text-[8px] sm:text-[9px] px-1 rounded font-bold uppercase tracking-tighter shrink-0 bg-amber-950/60 text-amber-400 border border-amber-600/40">
                              Pré-Lib
                            </span>
                          </div>
                        ) : (() => {
                          const rowClub = gameState.clubs.find((c) => c.id === row.clubId) || getAllClubs().find((c) => c.id === row.clubId);
                          return (
                            <div className="flex items-center space-x-1 sm:space-x-1.5">
                              <ClubCrest
                                club={rowClub || { name: row.clubName, primaryColor: row.primaryColor }}
                                size="sm"
                                preferMini={true}
                              />
                              <span className="truncate max-w-[105px] sm:max-w-[140px] font-semibold">{row.clubName}</span>
                              {isUser && (
                                <span 
                                  className="text-[8px] sm:text-[9px] px-1 rounded font-bold uppercase tracking-tighter shrink-0"
                                  style={{
                                    backgroundColor: userClubTheme.primaryAccent,
                                    color: userClubTheme.onPrimaryAccent,
                                  }}
                                >
                                  VOCÊ
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="text-center font-bold text-white text-[12px] bg-[#12231b]/60">
                        {row.points}
                      </td>
                      <td className="text-center text-slate-300 text-[11px]">{row.played}</td>
                      <td className="text-center text-emerald-300 text-[11px] hidden sm:table-cell">{row.won}</td>
                      <td className="text-center text-slate-400 text-[11px] hidden sm:table-cell">{row.drawn}</td>
                      <td className="text-center text-rose-300 text-[11px] hidden sm:table-cell">{row.lost}</td>
                      <td className="text-center text-slate-300 text-[11px] hidden md:table-cell">{row.goalsFor}</td>
                      <td className="text-center text-slate-300 text-[11px] hidden md:table-cell">{row.goalsAgainst}</td>
                      <td className={`text-center text-[11px] font-semibold ${
                        row.goalDiff > 0 ? 'text-emerald-400' : row.goalDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                      }`}>
                        {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                      </td>
                      <td className="text-center py-1 hidden sm:table-cell">
                        <div className="flex items-center justify-center space-x-0.5">
                          {row.form.length === 0 ? (
                            <span className="text-[10px] text-slate-600">-</span>
                          ) : (
                            row.form.slice(0, 4).map((res, i) => (
                              <span
                                key={i}
                                className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold text-black ${
                                  res === 'V'
                                    ? 'bg-emerald-400'
                                    : res === 'E'
                                    ? 'bg-slate-400'
                                    : 'bg-rose-500'
                                }`}
                              >
                                {res}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* Dynamic Legend Footer */}
        {!tableIsCopa && competitionZones.length > 0 && (
          <div className="px-3 py-1.5 bg-[#0a1510] border-t border-[#183225] flex items-center justify-between text-[10px] text-slate-400 shrink-0">
            <div className="flex items-center space-x-3 flex-wrap gap-y-1">
              {competitionZones.map((zone, idx) => (
                <span key={idx} className="flex items-center space-x-1">
                  <span className={`w-2 h-2 rounded-full ${zone.dotColor}`} />
                  <span>{zone.label}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* COLUMN 2: HUB DA PARTIDA & JOGOS DA RODADA (50% NO DESKTOP, ORDER-1 NO MOBILE) */}
      <div className="flex flex-col gap-2.5 sm:gap-3 lg:overflow-hidden order-1 lg:order-2 lg:w-1/2 lg:min-h-0">
        {/* TOP ROW: NEXT MATCH HERO CARD */}
        {nextOpponent && userFixture && (
          <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-2.5 sm:p-3 flex flex-col gap-2 sm:gap-2.5 shadow-md shrink-0 relative overflow-hidden">
            {/* Top dual-team kit stripe line */}
            <div className="absolute top-0 left-0 right-0 h-1 flex z-10">
              <div className="flex-1" style={{ background: userClubTheme.stripeGradient }} />
              <div className="w-1 bg-[var(--app-surface-2)]" />
              <div className="flex-1" style={{ background: opponentTheme?.stripeGradient || userClubTheme.stripeGradient }} />
            </div>

            {/* Teams & VS Row */}
            <div className="flex items-center justify-between pt-1">
              {/* User Club */}
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 max-w-[42%] lg:w-44">
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-black text-sm text-white shadow bg-[var(--app-bg-deep)] shrink-0 p-0.5 relative overflow-hidden"
                  style={{ 
                    border: `1.5px solid ${userClubTheme.subtleBorder}`,
                    boxShadow: `0 0 10px ${userClubTheme.subtleBg}`
                  }}
                >
                  <ClubCrest club={userClub} size="lg" className="w-8 h-8 sm:w-9 sm:h-9" />
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: userClubTheme.stripeGradient }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-xs sm:text-sm text-white truncate flex items-center gap-1 sm:gap-1.5">
                    <span className="truncate">{userClub.name}</span>
                    <span 
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: userClubTheme.primaryAccent }}
                    />
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-[var(--app-text-accent)] font-semibold">
                    {userFixture.homeClubId === userClub.id ? 'Mandante' : 'Visitante'}
                  </div>
                </div>
              </div>

              {/* VS Badge & Match Details */}
              <div className="flex flex-col items-center px-1 shrink-0">
                <div className="flex items-center space-x-1 mb-0.5">
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-[var(--app-text-accent)] bg-[var(--app-bg-deep)] px-1.5 sm:px-2 py-0.5 rounded border border-[var(--app-border-subtle)] truncate max-w-[100px] sm:max-w-none">
                    {userFixture.competitionName || (gameState.currentSemester === 2 ? gameState.nationalLeagueName : gameState.stateChampionshipName) || 'Campeonato'}
                  </span>
                  {userFixture.date && (
                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-200 bg-[var(--app-bg-deep)] px-1 sm:px-1.5 py-0.5 rounded border border-[var(--app-border-subtle)]">
                      {formatMatchDate(userFixture.date, 'short')}
                    </span>
                  )}
                  {userFixture.dayOfWeek && (
                    <span className={`text-[8px] sm:text-[9px] uppercase font-bold px-1 sm:px-1.5 py-0.5 rounded ${userFixture.dayOfWeek === 'quarta' ? 'bg-amber-950/80 text-amber-300 border border-amber-700/50' : 'bg-[var(--app-surface-2)] text-[var(--app-text-accent)]'}`}>
                      {userFixture.dayOfWeek === 'quarta' ? 'Qua' : userFixture.dayOfWeek === 'quinta' ? 'Qui' : 'Dom'}
                    </span>
                  )}
                </div>
                <div className="text-base sm:text-lg font-black text-white tracking-wider my-0.2 sm:my-0.5">
                  VS
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-300 font-medium truncate max-w-[130px] sm:max-w-[220px]">
                  🏟️ {userFixture.homeClubId === userClub.id ? `${userClub.stadium}` : `${nextOpponent.stadium}`}
                </span>
              </div>

              {/* Opponent Club */}
              <div 
                onClick={() => viewClub(nextOpponent.id)}
                className="flex items-center justify-end space-x-2 sm:space-x-3 flex-1 min-w-0 max-w-[42%] lg:w-44 cursor-pointer group hover:opacity-90 transition-all"
                title={`Ver detalhes de ${nextOpponent.name}`}
              >
                <div className="text-right min-w-0">
                  <div className="font-extrabold text-xs sm:text-sm text-white truncate flex items-center justify-end gap-1 sm:gap-1.5 group-hover:text-[var(--app-text-accent)] transition-colors">
                    <span 
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: opponentTheme?.primaryAccent || '#94a3b8' }}
                    />
                    <span className="truncate">{nextOpponent.name}</span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-semibold flex items-center justify-end gap-1">
                    <span>{userFixture.homeClubId === nextOpponent.id ? 'Mandante' : 'Visitante'}</span>
                    <span className="hidden sm:inline text-[9px] text-[var(--app-text-accent)] font-normal underline">ver clube</span>
                  </div>
                </div>
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-black text-sm text-white shadow bg-[var(--app-bg-deep)] shrink-0 p-0.5 relative overflow-hidden group-hover:scale-105 transition-transform"
                  style={{ 
                    border: `1.5px solid ${opponentTheme?.subtleBorder || 'var(--app-border-subtle)'}`,
                    boxShadow: opponentTheme ? `0 0 10px ${opponentTheme.subtleBg}` : undefined
                  }}
                >
                  <ClubCrest club={nextOpponent} size="lg" className="w-8 h-8 sm:w-9 sm:h-9" />
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: opponentTheme?.stripeGradient || userClubTheme.stripeGradient }}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Row of Hero Card: DM/Suspension Status & ESCALAR TIME Button */}
            <div className="pt-2 border-t border-[var(--app-border-subtle)] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
              {/* Availability status */}
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                {unavailableStarters.length > 0 ? (
                  <button 
                    onClick={() => { sound.playClick(); setScreen('tactics'); }}
                    className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded bg-rose-950/80 border border-rose-700/60 text-rose-300 text-[11px] sm:text-xs font-bold hover:bg-rose-900/80 transition-colors cursor-pointer animate-pulse"
                    title="Clique para ir para a tela de escalação e substituir jogadores indisponíveis"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>⚠️ {unavailableStarters.length} titular(es) no DM/Suspenso!</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Força dos titulares: <strong className="text-emerald-400 font-mono-numbers">{userStrength.overall}</strong>
                  </span>
                )}
              </div>

              {/* Action Button: ESCALAR TIME (Touch friendly, thumb accessible on mobile) */}
              <button
                onClick={() => { sound.playClick(); setScreen('tactics'); }}
                className="w-full sm:w-auto px-4 sm:px-5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-black rounded text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg active:scale-95 transition-all cursor-pointer"
                title="Ir para a preparação e escalação do time (Espaço)"
              >
                <Users className="w-4 h-4 fill-black text-black" />
                <span>ESCALAR TIME</span>
                <kbd className="hidden sm:inline-block bg-black/20 text-black/90 px-1 py-0.2 rounded text-[9px] font-mono lowercase tracking-normal font-bold">
                  espaço
                </kbd>
              </button>
            </div>
          </div>
        )}

        {!userFixture && currentRoundFixtures.some(f => !f.pendingQualification && !f.played) && (
          <div className="bg-[#12261d] border border-[#204232] rounded-lg p-3 flex items-center justify-between shrink-0">
            <span className="text-sm text-slate-200">
              Seu clube não joga nesta data ({formatMatchDate(currentRoundFixtures[0]?.date, 'weekday')}).
            </span>
            <button onClick={() => completeRound()} className="px-4 py-2 bg-emerald-500 text-black font-bold rounded text-xs uppercase cursor-pointer">
              Simular data
            </button>
          </div>
        )}

        {!userFixture && currentRoundFixtures.length > 0 && currentRoundFixtures.every(f => f.played) && (
          <div className="bg-[#12261d] border border-[#204232] rounded-lg p-3 flex items-center justify-between shrink-0">
            <span className="text-sm text-slate-200">
              Data concluída ({formatMatchDate(currentRoundFixtures[0]?.date, 'weekday')}).
            </span>
            <button onClick={() => advanceRound()} className="px-4 py-2 bg-emerald-500 text-black font-bold rounded text-xs uppercase cursor-pointer">
              Avançar Calendário
            </button>
          </div>
        )}

        {/* Mobile/Tablet Tab Switcher (Classificação vs Jogos da Rodada) */}
        <div className="flex lg:hidden bg-[var(--app-surface-2)] p-1 rounded-lg border border-[var(--app-border-subtle)] shrink-0 gap-1">
          <button
            onClick={() => { sound.playClick(); setMobileTab('standings'); }}
            className={`flex-1 py-1.5 px-3 rounded text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              mobileTab === 'standings'
                ? 'bg-[var(--app-surface-1)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Classificação</span>
          </button>
          <button
            onClick={() => { sound.playClick(); setMobileTab('calendar'); }}
            className={`flex-1 py-1.5 px-3 rounded text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              mobileTab === 'calendar'
                ? 'bg-[var(--app-surface-1)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Jogos da Rodada</span>
          </button>
        </div>

        {/* BOTTOM: CALENDÁRIO DA TEMPORADA & JOGOS DA RODADA (EXPANDIDO) */}
        <div className={`bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col shadow-md flex-none lg:flex-1 lg:min-h-0 lg:overflow-hidden ${mobileTab === 'calendar' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Header with Round Switcher */}
          <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-highlight)] flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2 min-w-0">
              <Calendar className="w-4 h-4 text-[var(--app-text-accent)] shrink-0" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider truncate max-w-[200px] sm:max-w-[280px]">
                {roundFixtures[0]?.competitionName || 'Calendário'} • {roundFixtures[0]?.competitionRound || 'Rodada'}
              </h3>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              <button
                disabled={selectedRound <= 1}
                onClick={() => { sound.playClick(); setSelectedRound((r) => Math.max(1, r - 1)); }}
                className="p-1 rounded bg-[var(--app-bg-deep)] hover:bg-[var(--app-surface-2)] text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-[var(--app-border-subtle)] cursor-pointer"
                title="Data anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center space-x-1.5 px-2">
                <span className="text-xs font-mono-numbers text-white font-bold">
                  {formatMatchDate(roundFixtures[0]?.date, 'short')}
                </span>
                {selectedRound === gameState.currentRound && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1 py-0.2 rounded font-bold uppercase">
                    Hoje
                  </span>
                )}
              </div>
              <button
                disabled={selectedRound >= totalRounds}
                onClick={() => { sound.playClick(); setSelectedRound((r) => Math.min(totalRounds, r + 1)); }}
                className="p-1 rounded bg-[var(--app-bg-deep)] hover:bg-[var(--app-surface-2)] text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-[var(--app-border-subtle)] cursor-pointer"
                title="Próxima data"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Calendar Group Filter Bar (quando houver múltiplos grupos nesta rodada) */}
          {roundCalendarGroups.length > 1 && (
            <div className="flex items-center space-x-1 px-3 py-1 bg-[var(--app-surface-2)]/80 border-b border-[var(--app-border-subtle)] overflow-x-auto no-scrollbar shrink-0 text-xs">
              <span className="text-[10px] text-slate-400 uppercase font-bold mr-1">Filtrar:</span>
              <button
                type="button"
                onClick={() => setCalendarGroupFilter('all')}
                className={`px-2 py-0.5 rounded font-bold text-[10px] sm:text-[11px] transition-colors cursor-pointer ${
                  calendarGroupFilter === 'all'
                    ? 'bg-[var(--app-surface-3)] text-white border border-[var(--app-text-accent)]/60'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              {roundCalendarGroups.map((grp) => (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setCalendarGroupFilter(grp)}
                  className={`px-2 py-0.5 rounded font-bold text-[10px] sm:text-[11px] transition-colors cursor-pointer ${
                    calendarGroupFilter === grp
                      ? 'bg-[var(--app-surface-3)] text-[var(--app-text-accent)] border border-[var(--app-text-accent)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Grupo {grp}
                </button>
              ))}
            </div>
          )}

          {/* Matches list */}
          <div className="flex-none lg:flex-1 lg:overflow-y-auto p-2 sm:p-2.5 space-y-1.5 no-scrollbar">
            {displayedRoundFixtures.map((fix) => {
              if (fix.pendingQualification) return (
                <div key={fix.id} className="flex items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 rounded bg-[var(--app-surface-2)] text-xs text-slate-400">
                  <span>A definir</span>
                  <span className="text-[11px] truncate max-w-[160px]">{fix.competitionRound || fix.stage} • aguardando</span>
                  <span>A definir</span>
                </div>
              );
              const home = gameState.clubs.find((c) => c.id === fix.homeClubId) || getAllClubs().find(c => c.id === fix.homeClubId);
              const away = gameState.clubs.find((c) => c.id === fix.awayClubId) || getAllClubs().find(c => c.id === fix.awayClubId);
              if (!home || !away) return null;
              const isUserMatch = home.id === userClub.id || away.id === userClub.id;
              const groupMatch = fix.competitionRound?.match(/Grupo ([A-Z]+)/i)?.[1];

              return (
                <div
                  key={fix.id}
                  className={`flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs transition-colors ${
                    isUserMatch
                      ? 'bg-[var(--app-surface-2)] border border-[var(--app-border-highlight)] shadow-xs'
                      : 'bg-[var(--app-surface-2)]/60 border border-transparent hover:border-[var(--app-border-subtle)]'
                  }`}
                >
                  {/* Home Club */}
                  <div 
                    onClick={() => viewClub(home.id)}
                    className="flex items-center space-x-1.5 sm:space-x-2 w-[42%] justify-end min-w-0 cursor-pointer group hover:opacity-85 transition-opacity"
                    title={`Ver detalhes de ${home.name}`}
                  >
                    <span className={`font-semibold truncate text-[11px] sm:text-xs group-hover:underline ${home.id === userClub.id ? 'text-[var(--app-text-accent)] font-bold' : 'text-slate-200'}`}>
                      {home.name}
                    </span>
                    <ClubCrest club={home} size="sm" preferMini={true} />
                  </div>

                  {/* Score / Time Badge */}
                  <div className="w-[16%] flex flex-col items-center justify-center shrink-0">
                    {groupMatch && calendarGroupFilter === 'all' && (
                      <span className="text-[8px] text-[var(--app-text-accent)] font-bold mb-0.5">
                        Gr. {groupMatch}
                      </span>
                    )}
                    {fix.played ? (
                      <span className="font-mono-numbers font-black px-1.5 sm:px-2.5 py-0.5 bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] rounded text-[var(--app-text-accent)] text-[11px] sm:text-xs">
                        {fix.homeScore} x {fix.awayScore}
                        {fix.penaltyScore && <span className="block text-[8px] sm:text-[9px] text-amber-300">Pen. {fix.penaltyScore[0]} x {fix.penaltyScore[1]}</span>}
                      </span>
                    ) : (
                      <span className="text-[9px] sm:text-[10px] text-slate-400 bg-[var(--app-bg-deep)] px-1.5 sm:px-2.5 py-0.5 rounded border border-[var(--app-border-subtle)]">
                        {selectedRound === gameState.currentRound ? 'Hoje' : 'A Jogar'}
                      </span>
                    )}
                  </div>

                  {/* Away Club */}
                  <div 
                    onClick={() => viewClub(away.id)}
                    className="flex items-center space-x-1.5 sm:space-x-2 w-[42%] min-w-0 cursor-pointer group hover:opacity-85 transition-opacity"
                    title={`Ver detalhes de ${away.name}`}
                  >
                    <ClubCrest club={away} size="sm" preferMini={true} />
                    <span className={`font-semibold truncate text-[11px] sm:text-xs group-hover:underline ${away.id === userClub.id ? 'text-[var(--app-text-accent)] font-bold' : 'text-slate-200'}`}>
                      {away.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
