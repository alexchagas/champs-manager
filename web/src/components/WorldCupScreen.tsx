import React, { useState } from 'react';
import { useGame } from '../state/GameContext';
import { Trophy, Globe, Users, ArrowRight, Award, CheckCircle2, ChevronRight, ShieldCheck, Star } from 'lucide-react';
import type { WorldCupGroup, MatchFixture, NationalCallup } from '../types/index.ts';

export const WorldCupScreen: React.FC = () => {
  const { gameState, advanceRound, setScreen, acceptNationalTeamOffer, rejectNationalTeamOffer } = useGame();
  const [activeTab, setActiveTab] = useState<'groups' | 'knockout' | 'callups' | 'offers'>('groups');
  const [selectedGroup, setSelectedGroup] = useState<string>('A');

  const worldCup = gameState.worldCup;
  const nationalJob = gameState.nationalJob;
  const offers = gameState.nationalTeamOffers?.filter(o => o.status === 'pending') || [];
  const callups = gameState.nationalCallups || [];

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
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition"
        >
          Voltar à Carreira
        </button>
      </div>
    );
  }

  const currentGroup = worldCup.groups.find(g => g.groupLetter === selectedGroup) || worldCup.groups[0];

  const r16Matches = worldCup.fixtures.filter(f => f.round === 4);
  const qfMatches = worldCup.fixtures.filter(f => f.round === 5);
  const sfMatches = worldCup.fixtures.filter(f => f.round === 6);
  const finalMatch = worldCup.fixtures.find(f => f.round === 7);

  const getTeamName = (id: number): { name: string; flag: string; shirtUrl: string } => {
    for (const group of worldCup.groups) {
      const found = group.teams.find(t => t.id === id);
      if (found) return { name: found.name, flag: found.flag, shirtUrl: found.shirtUrl };
    }
    return { name: 'A definir', flag: '🏳️', shirtUrl: '' };
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/30 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  Torneio Quadrienal
                </span>
                <span className="text-xs text-slate-400">Ciclo Oficial FIFA</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight">
                Copa do Mundo FIFA {worldCup.seasonYear}
              </h1>
              <p className="text-sm text-slate-300">
                32 Seleções Nacionais • 8 Grupos • Mata-mata em Jogo Único
              </p>
            </div>
          </div>

          {/* Current Job or Offers Alert */}
          {nationalJob ? (
            <div className="bg-emerald-900/40 border border-emerald-500/40 rounded-xl p-3 flex items-center gap-3">
              <img
                src={`/selecoes/camisas/${nationalJob.code}.png`}
                alt={nationalJob.nationalTeamName}
                className="w-10 h-10 object-contain drop-shadow"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
              <div>
                <span className="text-xs uppercase font-bold text-emerald-400">Você comanda:</span>
                <p className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  Seleção {nationalJob.nationalTeamName}
                </p>
              </div>
            </div>
          ) : offers.length > 0 ? (
            <button
              onClick={() => setActiveTab('offers')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2 text-sm animate-pulse"
            >
              <Award className="w-4 h-4" />
              {offers.length} Convite(s) de Seleção Disponível(eis)
            </button>
          ) : null}
        </div>

        {/* Champion Celebration Banner if finished */}
        {worldCup.champion && (
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{worldCup.champion.flag}</span>
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Campeã Mundial</span>
                <h3 className="text-xl font-black text-amber-200">
                  {worldCup.champion.name} é Campeã da Copa do Mundo FIFA {worldCup.seasonYear}!
                </h3>
              </div>
            </div>
            {worldCup.runnerUp && (
              <div className="text-right text-xs text-slate-400">
                Vice-campeã: <span className="font-semibold text-slate-200">{worldCup.runnerUp.flag} {worldCup.runnerUp.name}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === 'groups'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Globe className="w-4 h-4" />
          Fase de Grupos
        </button>
        <button
          onClick={() => setActiveTab('knockout')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === 'knockout'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Chaveamento Mata-Mata
        </button>
        <button
          onClick={() => setActiveTab('callups')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === 'callups'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          Convocados do Seu Clube ({callups.length})
        </button>
        {offers.length > 0 && (
          <button
            onClick={() => setActiveTab('offers')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition flex items-center gap-2 ${
              activeTab === 'offers'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Award className="w-4 h-4" />
            Convites de Seleção ({offers.length})
          </button>
        )}
      </div>

      {/* Tab: Fase de Grupos */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Group Letters Selector */}
          <div className="flex flex-wrap gap-2">
            {(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const).map(letter => {
              const grp = worldCup.groups.find(g => g.groupLetter === letter);
              const isSelected = selectedGroup === letter;
              return (
                <button
                  key={letter}
                  onClick={() => setSelectedGroup(letter)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/30'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                  }`}
                >
                  <span>Grupo {letter}</span>
                  <span className="text-xs opacity-75 font-normal">
                    ({grp?.teams.map(t => t.flag).join('')})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Group Table and Matches */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Standings Table */}
            <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Classificação • Grupo {currentGroup.groupLetter}
                </h3>
                <span className="text-xs text-slate-400">Top 2 avançam às Oitavas</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-3">Pos</th>
                      <th className="py-2.5 px-3">Seleção</th>
                      <th className="py-2.5 px-2 text-center">PTS</th>
                      <th className="py-2.5 px-2 text-center">J</th>
                      <th className="py-2.5 px-2 text-center">V</th>
                      <th className="py-2.5 px-2 text-center">E</th>
                      <th className="py-2.5 px-2 text-center">D</th>
                      <th className="py-2.5 px-2 text-center">GP</th>
                      <th className="py-2.5 px-2 text-center">GC</th>
                      <th className="py-2.5 px-2 text-center">SG</th>
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
                          <td className="py-3 px-3 font-bold text-slate-300">
                            <span className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-xs ${
                              isTop2 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-500'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-200 flex items-center gap-2.5">
                            <span className="text-lg">{nt?.flag || '🏳️'}</span>
                            <span>{row.clubName}</span>
                            {nt?.code && (
                              <span className="text-xs text-slate-500 uppercase font-mono">({nt.code})</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-emerald-400">{row.points}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{row.played}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{row.won}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{row.drawn}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{row.lost}</td>
                          <td className="py-3 px-2 text-center text-slate-400">{row.goalsFor}</td>
                          <td className="py-3 px-2 text-center text-slate-400">{row.goalsAgainst}</td>
                          <td className={`py-3 px-2 text-center font-semibold ${
                            row.goalDiff > 0 ? 'text-emerald-400' : row.goalDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Group Fixtures */}
            <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="text-lg font-bold text-slate-100">
                Confrontos • Grupo {currentGroup.groupLetter}
              </h3>

              <div className="space-y-3">
                {currentGroup.fixtures.map((fix) => {
                  const home = getTeamName(fix.homeClubId);
                  const away = getTeamName(fix.awayClubId);
                  return (
                    <div
                      key={fix.id}
                      className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-sm"
                    >
                      <div className="flex-1 flex items-center justify-end gap-2 text-right">
                        <span className="font-semibold text-slate-200">{home.name}</span>
                        <span className="text-base">{home.flag}</span>
                      </div>

                      <div className="px-3 py-1 mx-2 rounded-lg bg-slate-950 font-bold font-mono text-center min-w-[60px]">
                        {fix.played ? (
                          <span className="text-slate-100">{fix.homeScore} - {fix.awayScore}</span>
                        ) : (
                          <span className="text-xs text-slate-400 uppercase">{fix.date?.slice(5) || 'VS'}</span>
                        )}
                      </div>

                      <div className="flex-1 flex items-center justify-start gap-2 text-left">
                        <span className="text-base">{away.flag}</span>
                        <span className="font-semibold text-slate-200">{away.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Chaveamento Mata-Mata */}
      {activeTab === 'knockout' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Oitavas de Final */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h4 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Oitavas de Final</h4>
              </div>
              <div className="space-y-2.5">
                {r16Matches.map((fix) => {
                  const home = getTeamName(fix.homeClubId);
                  const away = getTeamName(fix.awayClubId);
                  return (
                    <div key={fix.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5 shadow">
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
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                <h4 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Quartas de Final</h4>
              </div>
              <div className="space-y-2.5">
                {qfMatches.map((fix) => {
                  const home = getTeamName(fix.homeClubId);
                  const away = getTeamName(fix.awayClubId);
                  return (
                    <div key={fix.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5 shadow">
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
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                <h4 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Semifinais</h4>
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
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-amber-500/40">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-sm text-amber-300 uppercase tracking-wider">Grande Final</h4>
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
                    {worldCup.champion && (
                      <div className="pt-2 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs">
                          <Trophy className="w-3.5 h-3.5" /> Campeã: {worldCup.champion.name}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })() : null}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Convocados do Clube */}
      {activeTab === 'callups' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Atletas Convocados do {gameState.clubs.find(c => c.id === gameState.userClubId)?.name}
              </h3>
              <p className="text-sm text-slate-400">
                Atletas que disputam a Copa do Mundo valorizam substancialmente seu passe no mercado internacional.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30">
              {callups.length} Convocado(s)
            </span>
          </div>

          {callups.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-600" />
              <p>Nenhum atleta do elenco atingiu critérios de convocação para esta edição.</p>
              <p className="text-xs text-slate-500">
                Atletas com atributos de estrela (isStar, isWorldTop ou força &gt;= 80) são selecionados pelas seleções.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {callups.map((c) => (
                <div
                  key={c.playerId}
                  className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-3 shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-100">{c.playerName}</h4>
                      <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Convocado pela Seleção {c.nationalTeamName}
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
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Propostas Oficiais para Comandar Seleções
              </h3>
              <p className="text-sm text-slate-400">
                Você pode assumir uma Seleção Nacional em paralelo com seu clube durante as competições de seleções.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700 p-5 space-y-4 shadow-lg flex flex-col justify-between"
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
                      setActiveTab('groups');
                    }}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition shadow-lg flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Aceitar Proposta
                  </button>
                  <button
                    onClick={() => rejectNationalTeamOffer(offer.id)}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
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
