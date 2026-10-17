import React, { useState } from 'react';
import { useGame } from '../state/GameContext';
import { Trophy, ArrowRight, X, AlertCircle, Flame, ShieldAlert, FileText } from 'lucide-react';
import { sound } from '../audio/soundEngine';
import { ClubCrest } from './ClubCrest';
import { getStateByCode, getStateById, findLeagueForClub } from '../data/teamsDatabase';
import { getCompetitionZones, getZoneForPosition } from '../engine/competitionZones';
import { MatchFixture, MatchEvent } from '../types';
import { formatMatchDate } from '../utils/dateFormatter';

export const RoundResultsScreen: React.FC = () => {
  const { gameState, userClub, advanceRound, viewClub } = useGame();
  const [selectedFixture, setSelectedFixture] = useState<MatchFixture | null>(null);

  const currentRoundMatches = gameState.calendar.filter(
    (f) => (f.fixtureDateIndex ?? f.round) === gameState.currentRound
  );

  const nextDateStr = gameState.calendar.find(
    (f) => (f.fixtureDateIndex ?? f.round) === gameState.currentRound + 1
  )?.date;

  const totalRounds = gameState.calendar.length > 0 
    ? Math.max(...gameState.calendar.map((f) => f.fixtureDateIndex ?? f.round)) 
    : 38;

  const handleAdvance = () => {
    sound.playClick();
    advanceRound();
  };

  // Helper to extract goals and cards from fixture events
  const getFixtureSummary = (fix: MatchFixture) => {
    const events: MatchEvent[] = fix.events || [];
    const goalsHome: string[] = [];
    const goalsAway: string[] = [];
    const cardsHome: { type: 'yellow' | 'red'; text: string }[] = [];
    const cardsAway: { type: 'yellow' | 'red'; text: string }[] = [];

    for (const ev of events) {
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

    return { goalsHome, goalsAway, cardsHome, cardsAway };
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--app-bg-deep)] p-3 sm:p-4 lg:h-full lg:overflow-hidden lg:min-h-0 w-full select-none pb-6 lg:pb-0">
      {/* Súmula / Detalhes da Partida Modal */}
      {selectedFixture && (() => {
        const home = gameState.clubs.find((c) => c.id === selectedFixture.homeClubId);
        const away = gameState.clubs.find((c) => c.id === selectedFixture.awayClubId);
        const { goalsHome, goalsAway, cardsHome, cardsAway } = getFixtureSummary(selectedFixture);

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div 
              role="dialog" 
              aria-label="Súmula da Partida"
              className="w-full max-w-xl rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-4 py-3 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="font-extrabold text-xs uppercase tracking-wider text-slate-200">
                    Súmula da Partida • {selectedFixture.competitionName || 'Campeonato'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedFixture(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Placar e Clubes */}
              <div className="p-4 bg-[var(--app-surface-2)]/40 border-b border-[var(--app-border-subtle)] flex items-center justify-between gap-3">
                {/* Mandante */}
                <div className="flex-1 flex items-center justify-end space-x-2 min-w-0">
                  <span className="font-extrabold text-xs sm:text-sm text-right truncate text-white">
                    {home?.name}
                  </span>
                  <ClubCrest club={home} size="sm" preferMini className="w-7 h-7 shrink-0" />
                </div>

                {/* Placar Central */}
                <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-center shrink-0">
                  <span className="font-mono font-black text-xl sm:text-2xl text-emerald-400 tracking-wider">
                    {selectedFixture.homeScore ?? 0} : {selectedFixture.awayScore ?? 0}
                  </span>
                  {selectedFixture.penaltyScore && (
                    <span className="block text-[10px] text-amber-300 font-mono font-bold mt-0.5">
                      Pên: {selectedFixture.penaltyScore.join(' : ')}
                    </span>
                  )}
                </div>

                {/* Visitante */}
                <div className="flex-1 flex items-center justify-start space-x-2 min-w-0">
                  <ClubCrest club={away} size="sm" preferMini className="w-7 h-7 shrink-0" />
                  <span className="font-extrabold text-xs sm:text-sm text-left truncate text-white">
                    {away?.name}
                  </span>
                </div>
              </div>

              {/* Linha do Tempo e Eventos */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
                {/* Gols */}
                <div className="space-y-2">
                  <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px] flex items-center space-x-1.5">
                    <span>⚽ Gols da Partida</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 bg-[var(--app-surface-2)]/60 p-3 rounded-lg border border-[var(--app-border-subtle)]">
                    <div className="space-y-1">
                      {goalsHome.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic block">Nenhum gol</span>
                      ) : (
                        goalsHome.map((g, i) => (
                          <div key={i} className="text-[11px] font-semibold text-emerald-300">
                            {g}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="space-y-1 border-l border-slate-800/80 pl-3">
                      {goalsAway.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic block">Nenhum gol</span>
                      ) : (
                        goalsAway.map((g, i) => (
                          <div key={i} className="text-[11px] font-semibold text-emerald-300">
                            {g}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Cartões */}
                <div className="space-y-2">
                  <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                    Cartões & Disciplina
                  </h4>
                  <div className="grid grid-cols-2 gap-3 bg-[var(--app-surface-2)]/60 p-3 rounded-lg border border-[var(--app-border-subtle)]">
                    <div className="space-y-1">
                      {cardsHome.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic block">Sem advertências</span>
                      ) : (
                        cardsHome.map((c, i) => (
                          <div key={i} className={`text-[11px] font-semibold flex items-center space-x-1 ${
                            c.type === 'red' ? 'text-rose-400 font-bold' : 'text-amber-300'
                          }`}>
                            <span>{c.type === 'red' ? '🟥' : '🟨'}</span>
                            <span>{c.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="space-y-1 border-l border-slate-800/80 pl-3">
                      {cardsAway.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic block">Sem advertências</span>
                      ) : (
                        cardsAway.map((c, i) => (
                          <div key={i} className={`text-[11px] font-semibold flex items-center space-x-1 ${
                            c.type === 'red' ? 'text-rose-400 font-bold' : 'text-amber-300'
                          }`}>
                            <span>{c.type === 'red' ? '🟥' : '🟨'}</span>
                            <span>{c.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 bg-[var(--app-surface-2)] border-t border-[var(--app-border-subtle)] flex justify-end">
                <button
                  onClick={() => setSelectedFixture(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors"
                >
                  Fechar Súmula
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header Banner Exclusivo: Resultados da Rodada */}
      <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-md mb-3 shrink-0">
        <div>
          <h2 className="text-sm font-extrabold text-[var(--app-text-accent)] uppercase tracking-wider">
            Resultados Finais • {currentRoundMatches[0]?.competitionName || 'Rodada'} • {formatMatchDate(currentRoundMatches[0]?.date, 'weekday')}
          </h2>
          <p className="text-xs text-slate-400">
            Todos os {currentRoundMatches.length} jogos desta data foram concluídos. Toque no placar para ver a súmula.
          </p>
        </div>

        {/* Único botão de avanço autorizado na tela pós-jogo */}
        <button
          onClick={handleAdvance}
          className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider rounded-lg shadow-lg cursor-pointer transition-transform active:scale-95"
          title="Avançar calendário para a próxima data (Espaço)"
        >
          <span>Avançar Calendário {nextDateStr ? `(${formatMatchDate(nextDateStr, 'short')})` : ''}</span>
          <kbd className="hidden sm:inline-block bg-black/20 text-black/90 px-1.5 py-0.5 rounded text-[10px] font-mono lowercase tracking-normal font-black">
            espaço
          </kbd>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Split: Round Scores on Left + Standings Summary on Right */}
      <div className="flex-1 grid grid-cols-12 gap-3 lg:overflow-hidden min-h-0">
        {/* MATCH RESULTS OF THE ROUND */}
        <div className="col-span-12 lg:col-span-6 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col shadow-md lg:overflow-hidden min-h-[320px] lg:min-h-0">
          <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Placares dos Jogos
            </span>
            <span className="text-[11px] text-[var(--app-text-accent)] font-mono-numbers">
              {currentRoundMatches.length} Partidas
            </span>
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
                  className={`flex flex-col px-3 py-2 rounded-lg text-xs transition-all ${
                    isUserMatch
                      ? 'bg-[var(--app-surface-2)] border border-[var(--app-border-highlight)] font-bold shadow-xs'
                      : 'bg-[var(--app-surface-2)]/50 border border-transparent hover:border-[var(--app-border-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 border-b border-[var(--app-border-subtle)]/50 pb-0.5">
                    <span className="text-[var(--app-text-accent)] font-semibold truncate max-w-[70%]">
                      {fix.competitionRound?.includes('Grupo') 
                        ? `${fix.competitionName || 'Continental'} • ${fix.competitionRound}` 
                        : `${fix.competitionName || 'Campeonato'} ${fix.stage ? `• ${fix.stage}` : ''}`}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Toque no placar para súmula
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    {/* Mandante */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        viewClub(home.id);
                      }}
                      className="flex items-center space-x-2 w-[40%] justify-end min-w-0 cursor-pointer group hover:opacity-85 transition-opacity"
                      title={`Ver detalhes de ${home.name}`}
                    >
                      <span className={`truncate group-hover:underline ${home.id === userClub.id ? 'text-[var(--app-text-accent)] font-bold' : 'text-slate-200'}`}>
                        {home.name}
                      </span>
                      <ClubCrest club={home} size="sm" preferMini={true} />
                    </div>

                    {/* Placar Clicável para abrir Súmula */}
                    <div 
                      onClick={() => {
                        sound.playClick();
                        setSelectedFixture(fix);
                      }}
                      className="w-[20%] flex justify-center shrink-0 cursor-pointer group"
                      title="Clique para ver a súmula com gols e cartões"
                    >
                      <span className="whitespace-nowrap font-mono-numbers font-black px-2.5 py-1 bg-[var(--app-surface-1)] group-hover:bg-emerald-950/80 border border-[var(--app-border-subtle)] group-hover:border-emerald-500/70 rounded-md text-[var(--app-text-accent)] text-xs shadow-xs transition-all active:scale-95">
                        {fix.played ? `${fix.homeScore ?? 0} x ${fix.awayScore ?? 0}` : 'A definir'}
                        {fix.aggregateScore && <span className="block text-[9px] text-slate-400">Ag. {fix.aggregateScore[0]} x {fix.aggregateScore[1]}</span>}
                        {fix.penaltyScore && <span className="block text-[9px] text-amber-300">Pen. {fix.penaltyScore[0]} x {fix.penaltyScore[1]}</span>}
                      </span>
                    </div>

                    {/* Visitante */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        viewClub(away.id);
                      }}
                      className="flex items-center space-x-2 w-[40%] min-w-0 cursor-pointer group hover:opacity-85 transition-opacity"
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

          const enrichedStandingsList = isContinental
            ? standingsList.map(row => {
                if (row.group) return row;
                const fix = gameState.calendar.find(f => (f.homeClubId === row.clubId || f.awayClubId === row.clubId) && f.competitionRound?.startsWith('Grupo '));
                const g = fix?.competitionRound?.match(/Grupo ([A-Z]+)(?:\s|$)/)?.[1];
                return g ? { ...row, group: g } : row;
              })
            : standingsList;

          const continentalGroups = isContinental
            ? Array.from(new Set(enrichedStandingsList.map(r => r.group).filter(Boolean))).sort() as string[]
            : [];

          const userStateInfo = getStateByCode(userClub.stateCode) || getStateById(userClub.stateId);
          const userLeagueInfo = findLeagueForClub(userClub.id);

          const competitionZones = getCompetitionZones({
            competitionType: currentCompetition || (isEstadual ? 'estadual' : isContinental ? 'libertadores' : 'nacional'),
            totalTeams: isContinental ? Math.max(4, standingsList.filter(row => row.group === (continentalGroups[0] || row.group)).length) : standingsList.length,
            division: userClub.division ?? 1,
            countryId: userClub.countryId ?? 29,
            stateCode: userClub.stateCode,
            stateDivisions: userStateInfo?.divisions,
            totalClubsInState: userStateInfo?.clubCount,
            customRelegated: userLeagueInfo?.relegated,
          });

          return (
            <div className="col-span-12 lg:col-span-6 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col shadow-md lg:overflow-hidden min-h-[320px] lg:min-h-0">
              <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <Trophy className="w-3.5 h-3.5 text-[var(--app-text-accent)]" />
                  <span>Classificação Atualizada</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono-numbers">
                  Atualizada em {formatMatchDate(currentRoundMatches[0]?.date, 'short')}
                </span>
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
                    {isContinental && continentalGroups.length > 0 ? (
                      continentalGroups.map(grp => {
                        const groupRows = enrichedStandingsList.filter(r => r.group === grp);
                        return (
                          <React.Fragment key={grp}>
                            <tr className="bg-[var(--app-surface-2)] border-y border-[var(--app-border-subtle)]">
                              <td colSpan={8} className="py-1 px-3 text-[11px] font-bold text-[var(--app-text-accent)] uppercase tracking-wider">
                                Grupo {grp}
                              </td>
                            </tr>
                            {groupRows.map((row, idxInGroup) => {
                              const pos = idxInGroup + 1;
                              const isUser = row.clubId === userClub.id;
                              const isQualified = pos <= 2;
                              const posColor = isQualified ? 'text-emerald-400 font-bold' : 'text-slate-400';
                              const rowBg = isQualified ? 'hover:bg-emerald-950/20' : '';

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
                          </React.Fragment>
                        );
                      })
                    ) : (
                      standingsList.map((row, idx) => {
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
                      })
                    )}
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
