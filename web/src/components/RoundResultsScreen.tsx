import React from 'react';
import { useGame } from '../state/GameContext';
import { Trophy, ArrowRight, DollarSign, Award, CheckCircle, Newspaper, BarChart3 } from 'lucide-react';
import { sound } from '../audio/soundEngine';
import { ClubCrest } from './ClubCrest';
import { getStateByCode, getStateById, findLeagueForClub } from '../data/teamsDatabase';
import { getCompetitionZones, getZoneForPosition } from '../engine/competitionZones';

export const RoundResultsScreen: React.FC = () => {
  const { gameState, userClub, advanceRound, setScreen, viewClub } = useGame();

  const currentRoundMatches = gameState.calendar.filter(
    (f) => (f.fixtureDateIndex ?? f.round) === gameState.currentRound
  );

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const totalRounds = gameState.calendar.length > 0 ? Math.max(...gameState.calendar.map((f) => f.fixtureDateIndex ?? f.round)) : 38;

  const handleAdvance = () => {
    sound.playClick();
    advanceRound();
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--app-bg-deep)] p-4 h-[calc(100vh-3.5rem)] select-none overflow-hidden">
      {/* Header Banner */}
      <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 shadow-md mb-3 shrink-0">
        <div>
          <h2 className="text-sm font-extrabold text-[var(--app-text-accent)] uppercase tracking-wider">
            Resultados Finais • Data {gameState.currentRound} de {totalRounds}
          </h2>
          <p className="text-xs text-slate-400">Todos os {currentRoundMatches.length} jogos da rodada foram concluídos</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => { sound.playClick(); setScreen('news'); }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] text-slate-200 hover:text-white border border-[var(--app-border-subtle)] font-bold text-xs rounded transition-all cursor-pointer shadow-xs"
          >
            <Newspaper className="w-3.5 h-3.5 text-[var(--app-text-accent)]" />
            <span>Ler Jornal da Rodada</span>
          </button>

          <button
            onClick={() => { sound.playClick(); setScreen('stats'); }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] text-slate-200 hover:text-white border border-[var(--app-border-subtle)] font-bold text-xs rounded transition-all cursor-pointer shadow-xs"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[var(--app-text-accent)]" />
            <span>Artilharia Global</span>
          </button>

          <button
            onClick={handleAdvance}
            className="flex items-center space-x-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-extrabold text-xs uppercase tracking-wider rounded shadow-lg cursor-pointer transition-transform active:scale-95"
            title="Avançar para a próxima rodada (Espaço)"
          >
            <span>Avançar para Rodada {Math.min(totalRounds, gameState.currentRound + 1)}</span>
            <kbd className="hidden sm:inline-block bg-black/20 text-black/90 px-1 py-0.2 rounded text-[9px] font-mono lowercase tracking-normal font-bold">
              espaço
            </kbd>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split: Round Scores on Left + Standings Summary on Right */}
      <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
        {/* MATCH RESULTS OF THE ROUND */}
        <div className="col-span-6 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-md">
          <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Placares dos Jogos
            </span>
            <span className="text-[11px] text-[var(--app-text-accent)] font-mono-numbers">{currentRoundMatches.length} Partidas</span>
          </div>

          <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
            {currentRoundMatches.map((fix) => {
              const home = gameState.clubs.find((c) => c.id === fix.homeClubId);
              const away = gameState.clubs.find((c) => c.id === fix.awayClubId);
              if (!home || !away) return null;
              const isUserMatch = home.id === userClub.id || away.id === userClub.id;

              return (
                <div
                  key={fix.id}
                  className={`flex flex-col px-3 py-1.5 rounded text-xs transition-colors ${
                    isUserMatch
                      ? 'bg-[var(--app-surface-2)] border border-[var(--app-border-highlight)] font-bold shadow-xs'
                      : 'bg-[var(--app-surface-2)]/50 border border-transparent hover:border-[var(--app-border-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 border-b border-[var(--app-border-subtle)]/50 pb-0.5">
                    <span className="text-[var(--app-text-accent)] font-semibold truncate max-w-[70%]">
                      {fix.competitionName || 'Campeonato'} {fix.stage ? `• ${fix.stage}` : ''}
                    </span>
                    <span className={`text-[9px] font-bold px-1 rounded ${fix.dayOfWeek === 'quarta' ? 'bg-amber-950 text-amber-300' : 'text-slate-400'}`}>
                      {fix.dayOfWeek === 'quarta' ? 'Quarta' : 'Fim de semana'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div 
                      onClick={() => viewClub(home.id)}
                      className="flex items-center space-x-2 w-[42%] justify-end min-w-0 cursor-pointer group hover:opacity-85 transition-opacity"
                      title={`Ver detalhes de ${home.name}`}
                    >
                      <span className={`truncate group-hover:underline ${home.id === userClub.id ? 'text-[var(--app-text-accent)] font-bold' : 'text-slate-200'}`}>
                        {home.name}
                      </span>
                      <ClubCrest club={home} size="sm" preferMini={true} />
                    </div>

                    <div className="w-[16%] flex justify-center shrink-0">
                      <span className="whitespace-nowrap font-mono-numbers font-black px-2.5 py-0.5 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded text-[var(--app-text-accent)] text-xs">
                        {fix.played ? `${fix.homeScore ?? 0} x ${fix.awayScore ?? 0}` : 'A definir'}
                        {fix.aggregateScore && <span className="block text-[9px] text-slate-400">Ag. {fix.aggregateScore[0]} x {fix.aggregateScore[1]}</span>}
                        {fix.penaltyScore && <span className="block text-[9px] text-amber-300">Pen. {fix.penaltyScore[0]} x {fix.penaltyScore[1]}</span>}
                      </span>
                    </div>

                    <div 
                      onClick={() => viewClub(away.id)}
                      className="flex items-center space-x-2 w-[42%] min-w-0 cursor-pointer group hover:opacity-85 transition-opacity"
                      title={`Ver detalhes de ${away.name}`}
                    >
                      <ClubCrest club={away} size="sm" preferMini={true} />
                      <span className={`truncate group-hover:underline ${away.id === userClub.id ? 'text-[var(--app-text-accent)] font-bold' : 'text-slate-200'}`}>
                        {away.name}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STANDINGS SNAPSHOT */}
        {(() => {
          const currentCompetition = currentRoundMatches[0]?.competitionType;
          const isEstadual = currentCompetition === 'estadual';
          const isContinental = currentCompetition === 'libertadores' || currentCompetition === 'sulamericana' || currentCompetition === 'champions';
          const standingsList = isEstadual
            ? gameState.standingsEstadual || gameState.standings
            : isContinental
            ? gameState.standingsContinental || gameState.standings
            : gameState.standingsNacional || gameState.standings;

          const userStateInfo = getStateByCode(userClub.stateCode) || getStateById(userClub.stateId);
          const userLeagueInfo = findLeagueForClub(userClub.id);

          const competitionZones = getCompetitionZones({
            competitionType: currentCompetition || (isEstadual ? 'estadual' : isContinental ? 'libertadores' : 'nacional'),
            totalTeams: standingsList.length,
            division: userClub.division ?? 1,
            countryId: userClub.countryId ?? 29,
            stateCode: userClub.stateCode,
            stateDivisions: userStateInfo?.divisions,
            totalClubsInState: userStateInfo?.clubCount,
            customRelegated: userLeagueInfo?.relegated,
          });

          return (
            <div className="col-span-6 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-md">
              <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <Trophy className="w-3.5 h-3.5 text-[var(--app-text-accent)]" />
                  <span>Classificação Atualizada</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono-numbers">Após Rodada {gameState.currentRound}</span>
              </div>

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
                      <th className="w-8 text-center">SG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border-subtle)] font-mono-numbers">
                    {standingsList.map((row, idx) => {
                      const pos = idx + 1;
                      const isUser = row.clubId === userClub.id;
                      const zone = getZoneForPosition(competitionZones, pos);
                      const posColor = zone ? zone.colorClass : 'text-slate-400 font-bold';
                      const rowBg = zone ? zone.bgHoverClass : '';

                      return (
                        <tr
                          key={row.clubId}
                          onClick={() => viewClub(row.clubId)}
                          className={`transition-colors ${rowBg} cursor-pointer ${
                            isUser
                              ? 'bg-[var(--app-surface-2)] text-[var(--app-text-accent)] font-bold border-l-4 border-l-[var(--app-text-accent)]'
                              : 'text-slate-300 hover:bg-[var(--app-surface-2)]/60'
                          }`}
                          title={isUser ? 'Seu clube' : `Ver detalhes de ${row.clubName}`}
                        >
                          <td className={`text-center py-1 text-[11px] ${posColor}`}>
                            {pos}
                          </td>
                          <td className="py-1 font-sans text-xs">
                            <div className="flex items-center space-x-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: row.primaryColor }}
                              />
                              <span className="truncate max-w-[130px]">{row.clubName}</span>
                              {isUser && (
                                <span className="text-[8px] bg-emerald-500 text-black px-1 rounded font-bold uppercase">
                                  VOCÊ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-center font-bold text-white text-xs bg-[#11231a]">
                            {row.points}
                          </td>
                          <td className="text-center text-slate-400 text-[11px]">{row.played}</td>
                          <td className="text-center text-emerald-300 text-[11px]">{row.won}</td>
                          <td className="text-center text-slate-400 text-[11px]">{row.drawn}</td>
                          <td className="text-center text-rose-300 text-[11px]">{row.lost}</td>
                          <td className="text-center text-[11px]">
                            {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
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
          );
        })()}
      </div>
    </div>
  );
};
