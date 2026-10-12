import React, { useState } from 'react';
import { useGame } from '../state/GameContext';
import { 
  Trophy, 
  Calendar, 
  DollarSign, 
  ChevronLeft, 
  ChevronRight, 
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
  BarChart3
} from 'lucide-react';
import { calculateSectorStrength, getSquadStarters } from '../engine/simulationEngine';
import { sound } from '../audio/soundEngine';
import { getAllClubs, getStateByCode, getStateById, findLeagueForClub } from '../data/teamsDatabase';
import { getCompetitionZones, getZoneForPosition } from '../engine/competitionZones';
import { ClubCrest } from './ClubCrest';
import { getClubTheme } from '../theme/clubTheme';

export const ClubOverview: React.FC = () => {
  const { 
    gameState, 
    userClub, 
    userFixture, 
    nextOpponent, 
    setScreen, 
    currentRoundFixtures,
    completeRound,
    expandStadium,
    setTicketPrice,
    viewClub
  } = useGame();

  const userClubTheme = getClubTheme(userClub);
  const opponentTheme = nextOpponent ? getClubTheme(nextOpponent) : null;

  const [selectedRound, setSelectedRound] = useState(gameState.currentRound);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleExpand = (seats: 2000 | 5000 | 10000) => {
    const res = expandStadium(seats);
    if (res.success) {
      setActionFeedback({
        type: 'success',
        message: `Estádio expandido com sucesso! (+${seats.toLocaleString('pt-BR')} lugares)`,
      });
      setTimeout(() => setActionFeedback(null), 4000);
    } else {
      setActionFeedback({
        type: 'error',
        message: res.error || 'Erro ao expandir estádio.',
      });
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  const roundFixtures = gameState.calendar.filter((f) => (f.fixtureDateIndex ?? f.round) === selectedRound);

  const totalRounds = gameState.calendar.length > 0 ? Math.max(...gameState.calendar.map((f) => f.fixtureDateIndex ?? f.round)) : 38;
  const currentCompetition = gameState.calendar.find(f => (f.fixtureDateIndex ?? f.round) === gameState.currentRound)?.competitionType;
  const tableIsEstadual = currentCompetition === 'estadual';
  const tableIsContinental = currentCompetition === 'libertadores' || currentCompetition === 'sulamericana' || currentCompetition === 'champions';
  const tableTitle = tableIsEstadual ? gameState.stateChampionshipName : tableIsContinental ? gameState.continentalCupName : gameState.nationalLeagueName;
  const displayedStandings = tableIsEstadual ? gameState.standingsEstadual : tableIsContinental ? gameState.standingsContinental : gameState.standingsNacional;

  const standingsList = displayedStandings || gameState.standings;
  const userStateInfo = getStateByCode(userClub.stateCode) || getStateById(userClub.stateId);
  const userLeagueInfo = findLeagueForClub(userClub.id);

  const competitionZones = getCompetitionZones({
    competitionType: currentCompetition || (tableIsEstadual ? 'estadual' : tableIsContinental ? 'libertadores' : 'nacional'),
    totalTeams: standingsList.length,
    division: userClub.division ?? 1,
    countryId: userClub.countryId ?? 29,
    stateCode: userClub.stateCode,
    stateDivisions: userStateInfo?.divisions,
    totalClubsInState: userStateInfo?.clubCount,
    customRelegated: userLeagueInfo?.relegated,
  });

  // Sector strengths for user and opponent
  const userStarters = getSquadStarters(userClub);
  const userStrength = calculateSectorStrength(userStarters);

  const opponentStarters = nextOpponent ? getSquadStarters(nextOpponent) : [];
  const opponentStrength = nextOpponent ? calculateSectorStrength(opponentStarters) : userStrength;

  // Attendance and Financial calculations
  const avgAttendance = userClub.avgAttendance ?? Math.round(userClub.capacity * 0.76);
  const occupancyRate = Math.min(100, Math.round((avgAttendance / userClub.capacity) * 100));

  // Ticket price elasticity projection
  const priceElasticity = Math.max(0.2, Math.min(0.98, 1.15 - (userClub.ticketPrice / 125)));
  const expectedAttendance = Math.min(userClub.capacity, Math.round(userClub.capacity * priceElasticity));
  const expectedOccupancy = Math.round((expectedAttendance / userClub.capacity) * 100);

  const weeklySeniorPayroll = Math.round(userClub.squad.reduce((acc, p) => acc + p.salary, 0) / 4);
  const weeklyYouthPayroll = Math.round((userClub.youth || []).reduce((acc, p) => acc + p.salary, 0) / 4);
  const weeklyPayroll = weeklySeniorPayroll + weeklyYouthPayroll;
  const stadiumMaintenance = Math.round((userClub.capacity * 2.2));
  const estimatedTicketIncome = Math.round(expectedAttendance * userClub.ticketPrice);
  const estimatedNetMatchIncome = estimatedTicketIncome - weeklyPayroll - stadiumMaintenance;


  return (
    <div className="flex-1 flex overflow-hidden bg-[var(--app-bg-deep)] p-3 gap-3 h-[calc(100vh-3.5rem)] select-none">
      {/* COLUMN 1: TABELA DE CLASSIFICAÇÃO */}
      <div className="w-[520px] bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-lg">
        {/* Table Header */}
        <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-highlight)] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <Trophy className="w-4 h-4 text-[var(--app-text-accent)] shrink-0" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider truncate max-w-[340px]">
              {tableTitle || gameState.leagueName || 'Campeonato Nacional'}
            </h2>
          </div>
          <span className="text-[11px] font-mono-numbers text-[var(--app-text-accent)] font-semibold shrink-0">
            Data {gameState.currentRound} / {totalRounds}
          </span>
        </div>


        {/* Dense Standings Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs brasfoot-table border-collapse">
            <thead>
              <tr className="sticky top-0 z-10">
                <th className="w-8 text-center">#</th>
                <th>Clube</th>
                <th className="w-8 text-center">PTS</th>
                <th className="w-7 text-center">J</th>
                <th className="w-7 text-center">V</th>
                <th className="w-7 text-center">E</th>
                <th className="w-7 text-center">D</th>
                <th className="w-7 text-center">GP</th>
                <th className="w-7 text-center">GC</th>
                <th className="w-7 text-center">SG</th>
                <th className="w-14 text-center">Forma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#14281f] font-mono-numbers">
              {standingsList.map((row, index) => {
                const pos = index + 1;
                const isUser = row.clubId === userClub.id;

                const zone = getZoneForPosition(competitionZones, pos);
                const posColor = zone ? zone.colorClass : 'text-slate-400';
                const rowBg = zone ? zone.bgHoverClass : '';

                return (
                  <tr
                    key={row.clubId}
                    onClick={() => viewClub(row.clubId)}
                    style={
                      isUser
                        ? {
                            borderLeft: `4px solid ${userClubTheme.primaryAccent}`,
                            backgroundColor: 'rgba(18, 38, 29, 0.75)',
                          }
                        : undefined
                    }
                    className={`transition-colors ${rowBg} cursor-pointer ${
                      isUser
                        ? 'text-white font-bold shadow-xs'
                        : 'text-slate-300 hover:bg-[#152c21]'
                    }`}
                    title={isUser ? 'Seu clube' : `Ver detalhes de ${row.clubName}`}
                  >
                    <td className={`text-center py-1 text-[11px] ${posColor}`}>
                      {pos}
                    </td>
                    <td className="py-1 font-sans text-xs">
                      {(() => {
                        const rowClub = gameState.clubs.find((c) => c.id === row.clubId);
                        return (
                          <div className="flex items-center space-x-1.5">
                            <ClubCrest
                              club={rowClub || { name: row.clubName, primaryColor: row.primaryColor }}
                              size="sm"
                              preferMini={true}
                            />
                            <span className="truncate max-w-[130px] font-semibold">{row.clubName}</span>
                            {isUser && (
                              <span 
                                className="text-[9px] px-1 rounded font-bold uppercase tracking-tighter"
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
                    <td className="text-center text-emerald-300 text-[11px]">{row.won}</td>
                    <td className="text-center text-slate-400 text-[11px]">{row.drawn}</td>
                    <td className="text-center text-rose-300 text-[11px]">{row.lost}</td>
                    <td className="text-center text-slate-300 text-[11px]">{row.goalsFor}</td>
                    <td className="text-center text-slate-300 text-[11px]">{row.goalsAgainst}</td>
                    <td className={`text-center text-[11px] font-semibold ${
                      row.goalDiff > 0 ? 'text-emerald-400' : row.goalDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                    }`}>
                      {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                    </td>
                    <td className="text-center py-1">
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
            </tbody>
          </table>
        </div>

        {/* Dynamic Legend Footer */}
        {competitionZones.length > 0 && (
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

      {/* COLUMN 2 & 3: CALENDÁRIO, PRÓXIMO JOGO & FINANÇAS */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* TOP ROW: NEXT MATCH HERO CARD */}
        {nextOpponent && userFixture && (
          <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 flex items-center justify-between shadow-md shrink-0 relative overflow-hidden">
            {/* Top dual-team kit stripe line */}
            <div className="absolute top-0 left-0 right-0 h-1 flex z-10">
              <div className="flex-1" style={{ background: userClubTheme.stripeGradient }} />
              <div className="w-1 bg-[var(--app-surface-2)]" />
              <div className="flex-1" style={{ background: opponentTheme?.stripeGradient || userClubTheme.stripeGradient }} />
            </div>

            {/* User Club */}
            <div className="flex items-center space-x-3 w-48">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm text-white shadow bg-[var(--app-bg-deep)] shrink-0 p-0.5 relative overflow-hidden"
                style={{ 
                  border: `1.5px solid ${userClubTheme.subtleBorder}`,
                  boxShadow: `0 0 10px ${userClubTheme.subtleBg}`
                }}
              >
                <ClubCrest club={userClub} size="lg" className="w-9 h-9" />
                <div 
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: userClubTheme.stripeGradient }}
                />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-sm text-white truncate flex items-center gap-1.5">
                  <span className="truncate">{userClub.name}</span>
                  <span 
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: userClubTheme.primaryAccent }}
                  />
                </div>
                <div className="text-[11px] text-[var(--app-text-accent)] font-semibold">
                  {userFixture.homeClubId === userClub.id ? 'Mandante' : 'Visitante'}
                </div>
              </div>
            </div>

            {/* VS Badge & Match Details */}
            <div className="flex flex-col items-center">
              <div className="flex items-center space-x-1 mb-0.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--app-text-accent)] bg-[var(--app-bg-deep)] px-2 py-0.5 rounded border border-[var(--app-border-subtle)]">
                  {userFixture.competitionName || (gameState.currentSemester === 2 ? gameState.nationalLeagueName : gameState.stateChampionshipName) || 'Campeonato'}
                </span>
                {userFixture.dayOfWeek && (
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${userFixture.dayOfWeek === 'quarta' ? 'bg-amber-950/80 text-amber-300 border border-amber-700/50' : 'bg-[var(--app-surface-2)] text-[var(--app-text-accent)]'}`}>
                    {userFixture.dayOfWeek === 'quarta' ? 'Quarta' : userFixture.dayOfWeek === 'quinta' ? 'Quinta' : 'Domingo'}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono-numbers">
                {userFixture.competitionName} • {userFixture.competitionRound || userFixture.stage || `Rodada ${userFixture.round}`}
              </span>
              <div className="text-xl font-black text-white tracking-wider my-0.5">
                VS
              </div>
              <span className="text-[11px] text-slate-300 font-medium truncate max-w-[180px]">
                {userFixture.homeClubId === userClub.id ? userClub.stadium : nextOpponent.stadium}
              </span>
            </div>

            {/* Opponent Club */}
            <div 
              onClick={() => viewClub(nextOpponent.id)}
              className="flex items-center justify-end space-x-3 w-48 cursor-pointer group hover:opacity-90 transition-all"
              title={`Ver detalhes de ${nextOpponent.name}`}
            >
              <div className="text-right min-w-0">
                <div className="font-extrabold text-sm text-white truncate flex items-center justify-end gap-1.5 group-hover:text-[var(--app-text-accent)] transition-colors">
                  <span 
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: opponentTheme?.primaryAccent || '#94a3b8' }}
                  />
                  <span className="truncate">{nextOpponent.name}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-semibold flex items-center justify-end gap-1">
                  <span>{userFixture.homeClubId === nextOpponent.id ? 'Mandante' : 'Visitante'}</span>
                  <span className="text-[9px] text-[var(--app-text-accent)] font-normal underline">ver clube</span>
                </div>
              </div>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm text-white shadow bg-[var(--app-bg-deep)] shrink-0 p-0.5 relative overflow-hidden group-hover:scale-105 transition-transform"
                style={{ 
                  border: `1.5px solid ${opponentTheme?.subtleBorder || 'var(--app-border-subtle)'}`,
                  boxShadow: opponentTheme ? `0 0 10px ${opponentTheme.subtleBg}` : undefined
                }}
              >

                <ClubCrest club={nextOpponent} size="lg" className="w-9 h-9" />
                <div 
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: opponentTheme?.stripeGradient || userClubTheme.stripeGradient }}
                />
              </div>
            </div>

            {/* Match Action Button */}
            <button
              onClick={() => { sound.playWhistle(); setScreen('live_match'); }}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-extrabold rounded text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
              title="Ir para o Jogo (Espaço)"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>Ir para o Jogo</span>
              <kbd className="hidden sm:inline-block bg-black/20 text-black/90 px-1 py-0.2 rounded text-[9px] font-mono lowercase tracking-normal font-bold">
                espaço
              </kbd>
            </button>
          </div>
        )}
        {!userFixture && currentRoundFixtures.some(f => !f.pendingQualification && !f.played) && (
          <div className="bg-[#12261d] border border-[#204232] rounded-lg p-3 flex items-center justify-between shrink-0">
            <span className="text-sm text-slate-200">Seu clube não joga nesta data.</span>
            <button onClick={() => completeRound()} className="px-4 py-2 bg-emerald-500 text-black font-bold rounded text-xs uppercase">
              Simular data
            </button>
          </div>
        )}

        {/* BOTTOM SPLIT: ROUND FIXTURES + FINANCIAL SUMMARY */}
        <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
          {/* FIXTURES TABLE (CALENDÁRIO DA TEMPORADA) */}
          <div className="col-span-7 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-md">
            {/* Header with Round Switcher */}
            <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-highlight)] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[var(--app-text-accent)]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {roundFixtures[0]?.competitionName || 'Calendário'} • {roundFixtures[0]?.competitionRound || `Data ${selectedRound}`} • {roundFixtures[0]?.date || ''}
                </h3>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  disabled={selectedRound <= 1}
                  onClick={() => { sound.playClick(); setSelectedRound((r) => Math.max(1, r - 1)); }}
                  className="p-1 rounded bg-[var(--app-bg-deep)] hover:bg-[var(--app-surface-2)] text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-[var(--app-border-subtle)]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono-numbers px-2 text-white font-bold">
                  {selectedRound} / {totalRounds}
                </span>
                <button
                  disabled={selectedRound >= totalRounds}
                  onClick={() => { sound.playClick(); setSelectedRound((r) => Math.min(totalRounds, r + 1)); }}
                  className="p-1 rounded bg-[var(--app-bg-deep)] hover:bg-[var(--app-surface-2)] text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-[var(--app-border-subtle)]"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Matches list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {roundFixtures.map((fix) => {
                if (fix.pendingQualification) return (
                  <div key={fix.id} className="flex items-center justify-between px-3 py-2 rounded bg-[var(--app-surface-2)] text-xs text-slate-400">
                    <span>A definir</span>
                    <span>{fix.competitionRound || fix.stage} • aguardando classificação</span>
                    <span>A definir</span>
                  </div>
                );
                const home = gameState.clubs.find((c) => c.id === fix.homeClubId) || getAllClubs().find(c => c.id === fix.homeClubId);
                const away = gameState.clubs.find((c) => c.id === fix.awayClubId) || getAllClubs().find(c => c.id === fix.awayClubId);
                if (!home || !away) return null;
                const isUserMatch = home.id === userClub.id || away.id === userClub.id;

                return (
                  <div
                    key={fix.id}
                    className={`flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors ${
                      isUserMatch
                        ? 'bg-[var(--app-surface-2)] border border-[var(--app-border-highlight)] shadow-xs'
                        : 'bg-[var(--app-surface-2)]/60 border border-transparent hover:border-[var(--app-border-subtle)]'
                    }`}
                  >
                    {/* Home Club */}
                    <div 
                      onClick={() => viewClub(home.id)}
                      className="flex items-center space-x-2 w-[42%] justify-end min-w-0 cursor-pointer group hover:opacity-85 transition-opacity"
                      title={`Ver detalhes de ${home.name}`}
                    >
                      <span className={`font-semibold truncate group-hover:underline ${home.id === userClub.id ? 'text-[var(--app-text-accent)] font-bold' : 'text-slate-200'}`}>
                        {home.name}
                      </span>
                      <ClubCrest club={home} size="sm" preferMini={true} />
                    </div>

                    {/* Score / Time Badge */}
                    <div className="w-[16%] flex justify-center shrink-0">
                      {fix.played ? (
                        <span className="font-mono-numbers font-black px-2 py-0.5 bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] rounded text-[var(--app-text-accent)] text-xs">
                          {fix.homeScore} x {fix.awayScore}
                          {fix.penaltyScore && <span className="block text-[9px] text-amber-300">Pen. {fix.penaltyScore[0]} x {fix.penaltyScore[1]}</span>}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 bg-[var(--app-bg-deep)] px-2 py-0.5 rounded border border-[var(--app-border-subtle)]">
                          {selectedRound === gameState.currentRound ? 'Hoje' : 'A Jogar'}
                        </span>
                      )}
                    </div>

                    {/* Away Club */}
                    <div 
                      onClick={() => viewClub(away.id)}
                      className="flex items-center space-x-2 w-[42%] min-w-0 cursor-pointer group hover:opacity-85 transition-opacity"
                      title={`Ver detalhes de ${away.name}`}
                    >
                      <ClubCrest club={away} size="sm" preferMini={true} />
                      <span className={`font-semibold truncate group-hover:underline ${away.id === userClub.id ? 'text-[var(--app-text-accent)] font-bold' : 'text-slate-200'}`}>
                        {away.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FINANCES & STADIUM PANEL */}
          <div className="col-span-5 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-md">
            <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-highlight)] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-[var(--app-text-accent)]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Estádio & Finanças
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-slate-400 font-medium">Caixa:</span>
                <span className={`text-[11px] font-mono-numbers font-bold ${userClub.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatMoney(userClub.balance)}
                </span>
              </div>
            </div>


            <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
              {/* Feedback Alert Toast */}
              {actionFeedback && (
                <div
                  className={`p-2 rounded text-xs flex items-center space-x-2 border animate-in fade-in transition-all ${
                    actionFeedback.type === 'success'
                      ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200'
                      : 'bg-rose-950/80 border-rose-500/80 text-rose-200'
                  }`}
                >
                  {actionFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span className="font-medium text-[11px]">{actionFeedback.message}</span>
                </div>
              )}

              {/* STADIUM OVERVIEW & AVERAGE ATTENDANCE CARD */}
              <div className="bg-[var(--app-surface-2)] p-2.5 rounded border border-[var(--app-border-subtle)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-[var(--app-text-accent)]" />
                    <div>
                      <div className="font-bold text-white text-xs">{userClub.stadium}</div>
                      <div className="text-[10px] text-slate-400">Estádio Oficial</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono-numbers text-[var(--app-text-accent)] font-extrabold text-xs">
                      {userClub.capacity.toLocaleString('pt-BR')}
                    </div>
                    <div className="text-[10px] text-slate-400">capacidade atual</div>
                  </div>
                </div>

                {/* Average Attendance Bar */}
                <div className="bg-[var(--app-bg-deep)] p-2 rounded border border-[var(--app-border-subtle)] space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 flex items-center space-x-1">
                      <Users className="w-3 h-3 text-[var(--app-text-accent)]" />
                      <span>Média de Público:</span>
                    </span>
                    <span className="text-white font-mono-numbers font-bold">
                      {avgAttendance.toLocaleString('pt-BR')} pagantes{' '}
                      <span className="text-emerald-400 font-semibold">({occupancyRate}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-[var(--app-surface-1)] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(5, occupancyRate))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* TICKET PRICE CONTROL (PREÇO DO INGRESSO) */}
              <div className="bg-[var(--app-surface-2)] p-2.5 rounded border border-[var(--app-border-subtle)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-[11px] uppercase tracking-wider flex items-center space-x-1">
                    <DollarSign className="w-3.5 h-3.5 text-[var(--app-text-accent)]" />
                    <span>Preço do Ingresso (R$)</span>
                  </span>
                  <span className="text-sm font-mono-numbers font-black text-[var(--app-text-accent)] bg-[var(--app-bg-deep)] px-2 py-0.5 rounded border border-[var(--app-border-subtle)]">
                    R$ {userClub.ticketPrice},00
                  </span>
                </div>

                {/* Stepper and Slider */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setTicketPrice(Math.max(10, userClub.ticketPrice - 5))}
                    disabled={userClub.ticketPrice <= 10}
                    className="p-1.5 bg-[var(--app-bg-deep)] hover:bg-[var(--app-surface-1)] disabled:opacity-30 disabled:cursor-not-allowed border border-[var(--app-border-subtle)] rounded text-slate-200 font-bold active:scale-95 transition-all"
                    title="Diminuir R$ 5"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="range"
                    min="10"
                    max="150"
                    step="5"
                    value={userClub.ticketPrice}
                    onChange={(e) => setTicketPrice(Number(e.target.value))}
                    className="flex-1 accent-emerald-400 cursor-pointer h-1.5 bg-[var(--app-bg-deep)] rounded"
                  />

                  <button
                    onClick={() => setTicketPrice(Math.min(200, userClub.ticketPrice + 5))}
                    disabled={userClub.ticketPrice >= 200}
                    className="p-1.5 bg-[var(--app-bg-deep)] hover:bg-[var(--app-surface-1)] disabled:opacity-30 disabled:cursor-not-allowed border border-[var(--app-border-subtle)] rounded text-slate-200 font-bold active:scale-95 transition-all"
                    title="Aumentar R$ 5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>


                {/* Quick Presets */}
                <div className="flex items-center space-x-1 pt-0.5">
                  <span className="text-[10px] text-slate-400 mr-1">Atalhos:</span>
                  {[25, 40, 60, 80].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setTicketPrice(preset)}
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold transition-all ${
                        userClub.ticketPrice === preset
                          ? 'bg-emerald-500 text-black shadow-xs'
                          : 'bg-[#0a1510] text-slate-300 hover:bg-[#183424] border border-[#193526]'
                      }`}
                    >
                      R$ {preset}
                    </button>
                  ))}
                </div>

                {/* Impact Preview */}
                <div className="bg-[#0b1610] p-2 rounded border border-[#162e21] flex justify-between text-[11px] text-slate-300">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Ocupação Estimada:</span>
                    <span className="font-bold text-white font-mono-numbers">
                      {expectedOccupancy}% ({expectedAttendance.toLocaleString('pt-BR')} pag.)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block">Renda Estimada / Jogo:</span>
                    <span className="font-bold text-emerald-400 font-mono-numbers">
                      +{formatMoney(estimatedTicketIncome)}
                    </span>
                  </div>
                </div>
              </div>

              {/* STADIUM EXPANSION OPTIONS */}
              <div className="bg-[#122219] p-2.5 rounded border border-[#1d392a] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-[11px] uppercase tracking-wider flex items-center space-x-1">
                    <Hammer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Obras & Expansão de Lugares</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Débito do Caixa</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {/* +2.000 lugares */}
                  <button
                    onClick={() => handleExpand(2000)}
                    disabled={userClub.balance < 3000000}
                    className={`p-2 rounded border flex flex-col items-center justify-center transition-all ${
                      userClub.balance >= 3000000
                        ? 'bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border-[var(--app-border-subtle)] text-white hover:border-[var(--app-border-highlight)] active:scale-95 cursor-pointer shadow-xs'
                        : 'bg-[var(--app-bg-deep)] border-[var(--app-border-subtle)] text-slate-500 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <span className="font-black text-xs text-[var(--app-text-accent)]">+2.000</span>
                    <span className="text-[9px] text-slate-400 font-medium">lugares</span>
                    <span className="text-[10px] font-mono-numbers font-bold text-amber-300 mt-1">
                      R$ 3,0M
                    </span>
                  </button>

                  {/* +5.000 lugares */}
                  <button
                    onClick={() => handleExpand(5000)}
                    disabled={userClub.balance < 7000000}
                    className={`p-2 rounded border flex flex-col items-center justify-center transition-all ${
                      userClub.balance >= 7000000
                        ? 'bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border-[var(--app-border-subtle)] text-white hover:border-[var(--app-border-highlight)] active:scale-95 cursor-pointer shadow-xs'
                        : 'bg-[var(--app-bg-deep)] border-[var(--app-border-subtle)] text-slate-500 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <span className="font-black text-xs text-[var(--app-text-accent)]">+5.000</span>
                    <span className="text-[9px] text-slate-400 font-medium">lugares</span>
                    <span className="text-[10px] font-mono-numbers font-bold text-amber-300 mt-1">
                      R$ 7,0M
                    </span>
                  </button>

                  {/* +10.000 lugares */}
                  <button
                    onClick={() => handleExpand(10000)}
                    disabled={userClub.balance < 13000000}
                    className={`p-2 rounded border flex flex-col items-center justify-center transition-all ${
                      userClub.balance >= 13000000
                        ? 'bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border-[var(--app-border-subtle)] text-white hover:border-[var(--app-border-highlight)] active:scale-95 cursor-pointer shadow-xs'
                        : 'bg-[var(--app-bg-deep)] border-[var(--app-border-subtle)] text-slate-500 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <span className="font-black text-xs text-[var(--app-text-accent)]">+10.000</span>
                    <span className="text-[9px] text-slate-400 font-medium">lugares</span>
                    <span className="text-[10px] font-mono-numbers font-bold text-amber-300 mt-1">
                      R$ 13,0M
                    </span>
                  </button>
                </div>
              </div>

              {/* Financial Flow Breakdown */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Projeção por Partida em Casa
                </div>

                <div className="bg-[var(--app-surface-2)] p-2.5 rounded border border-[var(--app-border-subtle)] space-y-1">
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-300 flex items-center space-x-1">
                      <ArrowUpRight className="w-3 h-3 text-emerald-400" />

                      <span>Renda de Bilheteria (Estimada)</span>
                    </span>
                    <span className="text-emerald-400 font-mono-numbers font-semibold">
                      +{formatMoney(estimatedTicketIncome)}
                    </span>
                  </div>

                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-300 flex items-center space-x-1">
                      <ArrowDownRight className="w-3 h-3 text-rose-400" />
                      <span>Folha Salarial Semanal (Prof. + Base)</span>
                    </span>
                    <span className="text-rose-400 font-mono-numbers font-semibold">
                      -{formatMoney(weeklyPayroll)}
                    </span>
                  </div>

                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-300 flex items-center space-x-1">
                      <ArrowDownRight className="w-3 h-3 text-rose-400" />
                      <span>Manutenção do Estádio</span>
                    </span>
                    <span className="text-rose-400 font-mono-numbers font-semibold">
                      -{formatMoney(stadiumMaintenance)}
                    </span>
                  </div>

                  <div className="flex justify-between pt-1.5 border-t border-[#1a3628] font-bold">
                    <span className="text-white">Resultado Líquido</span>
                    <span className={`font-mono-numbers ${estimatedNetMatchIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {estimatedNetMatchIncome >= 0 ? '+' : ''}{formatMoney(estimatedNetMatchIncome)}
                    </span>
                  </div>
                </div>
              </div>

              {/* QUICK NAVIGATION HUB BUTTONS */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setScreen('news')}
                  className="p-2 bg-[#10241a] hover:bg-[#193a2b] border border-[#214a34] rounded flex items-center justify-center space-x-1.5 text-emerald-300 font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                >
                  <Newspaper className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Jornal da Rodada</span>
                </button>

                <button
                  onClick={() => setScreen('stats')}
                  className="p-2 bg-[#10241a] hover:bg-[#193a2b] border border-[#214a34] rounded flex items-center justify-center space-x-1.5 text-emerald-300 font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Estatísticas da Liga</span>
                </button>

                <button
                  onClick={() => setScreen('finances')}
                  className="p-2 bg-[#10241a] hover:bg-[#193a2b] border border-[#214a34] rounded flex items-center justify-center space-x-1.5 text-emerald-300 font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                >
                  <Landmark className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Painel de Finanças</span>
                </button>

                <button
                  onClick={() => setScreen('youth')}
                  className="p-2 bg-[#10241a] hover:bg-[#193a2b] border border-[#214a34] rounded flex items-center justify-center space-x-1.5 text-emerald-300 font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Juniores ({userClub.youth?.length || 0})</span>
                </button>
              </div>

              {/* Strength overview comparison */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Comparativo de Força dos Setores
                </div>
                <div className="bg-[#122219] p-2.5 rounded border border-[#1d392a] space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Defesa:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-emerald-400 font-bold font-mono-numbers">{userStrength.defStrength}</span>
                      <span className="text-slate-500">vs</span>
                      <span className="text-slate-400 font-mono-numbers">{opponentStrength.defStrength}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Meio-Campo:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-emerald-400 font-bold font-mono-numbers">{userStrength.midStrength}</span>
                      <span className="text-slate-500">vs</span>
                      <span className="text-slate-400 font-mono-numbers">{opponentStrength.midStrength}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Ataque:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-emerald-400 font-bold font-mono-numbers">{userStrength.attStrength}</span>
                      <span className="text-slate-500">vs</span>
                      <span className="text-slate-400 font-mono-numbers">{opponentStrength.attStrength}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
