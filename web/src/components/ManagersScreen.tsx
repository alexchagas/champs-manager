import React, { useState, useMemo } from 'react';
import { useGame } from '../state/GameContext';
import type { Manager } from '../types';
import { getClubTheme } from '../theme/clubTheme';
import { ClubCrest } from './ClubCrest';
import { Award, UserCheck, Shield, ChevronRight, Briefcase, Sparkles, Users, LogOut, AlertTriangle, Eye, Check } from 'lucide-react';
import { getReputationLevelLabel, getOpenJobVacancies } from '../engine/careerEconomy';
import { getClubById } from '../data/teamsDatabase';
import { sound } from '../audio/soundEngine';

const money = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);

export const ManagersScreen: React.FC = () => {
  const { gameState, userClub, acceptManagerJob, resignCurrentJob, viewClub } = useGame();
  const clubTheme = getClubTheme(userClub);
  const [divisionFilter, setDivisionFilter] = useState<number | 'all'>('all');
  const [managerSearchQuery, setManagerSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState<number | 'all'>(50);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs'>('overview');

  const managers = gameState.managers || [];
  const human = managers.find(m => m.id === gameState.humanManagerId) || managers.find(m => m.kind === 'human');

  const filteredManagers = useMemo(() => {
    let list = managers;
    if (divisionFilter !== 'all') {
      list = list.filter(m => {
        const c = gameState.clubs.find(club => club.id === m.currentClubId) || getClubById(m.currentClubId || -1);
        return c?.division === divisionFilter;
      });
    }
    if (managerSearchQuery.trim()) {
      const q = managerSearchQuery.toLowerCase().trim();
      list = list.filter(m => {
        const club = gameState.clubs.find(c => c.id === m.currentClubId) || getClubById(m.currentClubId || -1);
        return m.name.toLowerCase().includes(q) || (club?.name.toLowerCase().includes(q) ?? false);
      });
    }
    return list;
  }, [managers, divisionFilter, managerSearchQuery, gameState.clubs]);

  const sorted = (key: 'seasonScore' | 'careerScore') => [...filteredManagers].sort((a, b) => b[key] - a[key]);

  const vacancies = useMemo(() => {
    if (!human) return [];
    return getOpenJobVacancies(gameState, human);
  }, [gameState, human]);

  const repLevel = human?.reputationLevel ?? 1;
  const repLabel = getReputationLevelLabel(repLevel);
  const repStars = '★'.repeat(Math.max(1, repLevel));

  const ranking = (title: string, list: Manager[]) => {
    const displayed = displayLimit === 'all' ? list : list.slice(0, displayLimit);
    return (
      <section className="rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] p-4 shadow-md flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--app-border-subtle)]">
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-[var(--app-text-accent)]" />
            <h2 className="text-[var(--app-text-accent)] font-bold text-sm uppercase tracking-wider">
              Ranking: {title}
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono-numbers">
            {displayed.length} de {list.length} treinadores
          </span>
        </div>

        <div className="space-y-1 text-sm flex-1 max-h-[560px] overflow-y-auto pr-1">
          {displayed.map((m, i) => {
            const isHuman = m.id === human?.id;
            const club = gameState.clubs.find(c => c.id === m.currentClubId) || getClubById(m.currentClubId || -1);

            return (
              <div 
                key={m.id} 
                style={isHuman ? { 
                  borderLeft: `4px solid ${clubTheme.primaryAccent}`,
                  backgroundColor: clubTheme.subtleBg 
                } : undefined}
                className={`flex items-center justify-between border-b border-[var(--app-border-subtle)] py-1.5 px-2 rounded-r transition-colors ${
                  isHuman 
                    ? 'font-bold text-white shadow-xs' 
                    : 'text-slate-300 hover:bg-[var(--app-surface-2)]'
                }`}
              >
                <div className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
                  <span className="text-xs text-slate-400 font-mono-numbers w-6 shrink-0">{i + 1}º</span>
                  {club && <ClubCrest club={club} size="xs" preferMini={true} className="w-4 h-4 shrink-0" />}
                  <span className="truncate">
                    {m.name}
                    <span className="text-slate-400 text-xs ml-1 font-normal">
                      · {club?.name || 'Disponível'} {club?.divisionName ? `(${club.divisionName})` : ''}
                    </span>
                  </span>
                  {isHuman && (
                    <span 
                      className="text-[9px] px-1.5 py-0.2 rounded font-black tracking-wider uppercase shrink-0"
                      style={{ backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent }}
                    >
                      VOCÊ
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[10px] text-amber-400 font-bold hidden sm:inline">
                    {'★'.repeat(Math.max(1, m.reputationLevel || 1))}
                  </span>
                  <strong className="font-mono-numbers text-[var(--app-text-accent)] text-xs sm:text-sm">
                    {m[title === 'Temporada' ? 'seasonScore' : 'careerScore']} pts
                  </strong>
                </div>
              </div>
            );
          })}
          {displayed.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-400">
              Nenhum treinador encontrado para o filtro selecionado.
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="flex-1 overflow-auto bg-[var(--app-bg-deep)] text-slate-100 p-4 sm:p-5 space-y-4 select-none pb-8 md:pb-5 min-h-0">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-wide text-white">Carreira dos Técnicos</h1>
          <p className="text-xs text-slate-400">
            Acompanhe o prestígio dos treinadores e as vagas disponíveis no mercado
          </p>
        </div>

        {/* Tabs: Visão Geral vs Central de Empregos */}
        <div className="flex items-center gap-1.5 bg-[var(--app-surface-1)] p-1 rounded-lg border border-[var(--app-border-subtle)]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[var(--app-text-accent)] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Visão Geral & Rankings
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'jobs'
                ? 'bg-[var(--app-text-accent)] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Central de Empregos</span>
            {vacancies.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-emerald-500 text-slate-950 rounded-full font-mono font-bold">
                {vacancies.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Cartão de Carreira do Treinador Humano */}
      {human && (
        <section className="rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] p-4 space-y-3 relative overflow-hidden shadow-lg">
          {/* Kit Stripe Top Accent Line */}
          <div 
            className="h-1 w-full absolute top-0 left-0 right-0" 
            style={{ background: clubTheme.stripeGradient }} 
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center space-x-3">
              <ClubCrest club={userClub} size="lg" preferMini={true} className="w-10 h-10 shrink-0" />
              <div>
                <h2 className="font-bold text-lg text-white flex items-center space-x-2">
                  <span>{human.name}</span>
                  <span 
                    className="w-2 h-2 rounded-full inline-block" 
                    style={{ backgroundColor: clubTheme.primaryAccent }} 
                  />
                  <span className="text-sm text-slate-300 font-normal">
                    ({human.available ? 'Desempregado' : (gameState.clubs.find(c => c.id === human.currentClubId)?.name || 'Sem clube')})
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 mt-0.5">
                  <span>
                    Confiança Diretoria:{' '}
                    <strong className="text-[var(--app-text-accent)] font-mono-numbers">
                      {Math.max(0, Math.min(100, Math.round(human.boardRating ?? 95)))}%
                    </strong>
                  </span>
                  <span>
                    Apoio Torcida:{' '}
                    <strong className="text-cyan-300 font-mono-numbers">
                      {Math.max(0, Math.min(100, Math.round(human.fanRating ?? 85)))}%
                    </strong>
                  </span>
                  <span>
                    Reputação:{' '}
                    <strong className="text-amber-400 font-bold">
                      {repStars} {repLabel} ({Math.max(0, Math.min(100, Math.round(human.reputation ?? 50)))}%)
                    </strong>
                  </span>
                  <span>
                    Estilo: <strong className="text-slate-200">{human.riskProfile}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Ações do Treinador: Pedir Demissão */}
            {!human.available && human.currentClubId && (
              <div>
                {!showResignConfirm ? (
                  <button
                    onClick={() => setShowResignConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-700/50 hover:border-rose-500 text-rose-300 hover:text-white text-xs font-bold cursor-pointer transition-all active:scale-95"
                    title="Pedir demissão e rescindir contrato voluntariamente"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Pedir Demissão</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-rose-950/90 border border-rose-600 p-2 rounded-lg text-xs">
                    <span className="text-rose-200 font-semibold">Confirmar saída do clube?</span>
                    <button
                      onClick={() => {
                        try {
                          sound.playWarning?.();
                        } catch (_) {}
                        setShowResignConfirm(false);
                        resignCurrentJob();
                      }}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded cursor-pointer transition-all active:scale-95"
                    >
                      Sim, sair
                    </button>
                    <button
                      onClick={() => setShowResignConfirm(false)}
                      className="px-2.5 py-1 bg-[var(--app-surface-2)] text-slate-300 hover:text-white font-semibold rounded cursor-pointer transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-3 bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] rounded-lg text-xs space-y-1">
            <p className="font-semibold text-slate-200">
              Pontuação da temporada: <strong className="text-[var(--app-text-accent)] font-mono-numbers text-sm">{human.seasonScore} pts</strong> = resultados ({human.scoreComponents?.results ?? 0}) + competições ({human.scoreComponents?.competitions ?? 0}) + elenco ({human.scoreComponents?.squad ?? 0}) + finanças ({human.scoreComponents?.finances ?? 0})
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Resultados: 4 × (pontos obtidos − pontos esperados). Competições: até 16 por aproveitamento e bônus por títulos. Prestígio de carreira acumulado: <strong className="text-amber-300 font-mono-numbers">{human.prestigePoints ?? 0} pts</strong>.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300 mb-2">Histórico Profissional</h3>
            <div className="space-y-1.5 text-xs">
              {human.jobs.map((j, i) => (
                <div key={i} className="p-2 rounded bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] flex items-center justify-between">
                  <span>
                    <strong className="text-white">{j.clubName}</strong>: {j.startSeason}, rodada {j.startRound} {j.endRound ? `até ${j.endSeason}, rodada ${j.endRound}` : '— atual'}
                  </span>
                  <span className="text-slate-300 font-mono-numbers">
                    {j.wins}V {j.draws}E {j.losses}D · caixa inicial {money(j.initialBalance)} {j.reason ? `(${j.reason})` : ''}
                  </span>
                </div>
              ))}
              {human.titles.map((t, i) => (
                <p key={i} className="text-amber-300 font-semibold flex items-center space-x-1">
                  <span>🏆 Título Conquistado: {t}</span>
                </p>
              ))}
              {human.events.map((e, i) => (
                <p key={i} className="text-[11px] text-slate-400">{e}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Seção da Central de Empregos (a/gE.java) */}
      {activeTab === 'jobs' && (
        <section className="rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] p-4 space-y-3 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--app-border-subtle)]">
            <div className="flex items-center space-x-2">
              <Briefcase className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wide">
                  Central de Empregos
                </h2>
                <p className="text-xs text-slate-400">
                  Vagas abertas compatíveis com sua reputação atual ({repStars} {repLabel})
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400">
              {vacancies.length} {vacancies.length === 1 ? 'clube disponível' : 'clubes disponíveis'}
            </span>
          </div>

          {vacancies.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Nenhuma vaga disponível no momento para sua reputação atual. Avance rodadas para aguardar novas vagas.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {vacancies.map((v) => (
                <div
                  key={v.clubId}
                  className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] hover:border-emerald-500/50 rounded-lg p-3 flex items-center justify-between gap-3 transition-all shadow-sm"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] p-1 shrink-0">
                      <ClubCrest
                        club={{ name: v.clubName, crestUrl: v.clubCrest }}
                        className="w-7 h-7 object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <h3 className="text-sm font-bold text-white truncate">{v.clubName}</h3>
                        {v.clubReputation !== undefined && (
                          <span className="text-[10px] text-amber-400 font-bold shrink-0">
                            {'★'.repeat(Math.max(1, v.clubReputation))}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 space-x-1 mt-0.5 font-mono-numbers">
                        <span className="text-emerald-400 font-bold uppercase">{v.divisionName}</span>
                        <span>· {v.tablePosition}º colocado</span>
                        <span>· Força: {v.avgStrength}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => {
                        sound.playClick();
                        viewClub(v.clubId);
                      }}
                      className="p-1.5 rounded bg-[var(--app-bg-deep)] hover:bg-[var(--app-surface-1)] text-slate-300 hover:text-white cursor-pointer transition-all"
                      title="Ver Detalhes do Clube"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        sound.playClick();
                        acceptManagerJob(v.clubId);
                      }}
                      className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer shadow transition-all active:scale-95"
                    >
                      Assumir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Rankings e Filtro por Divisão (Visão Geral) */}
      {activeTab === 'overview' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-1 bg-[var(--app-surface-1)] p-3 rounded-lg border border-[var(--app-border-subtle)]">
            {/* Filtro por Divisão */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Divisão:</span>
              {[
                { label: 'Todas', val: 'all' as const },
                { label: 'Série A', val: 1 },
                { label: 'Série B', val: 2 },
                { label: 'Série C', val: 3 },
                { label: 'Série D', val: 4 },
              ].map((btn) => (
                <button
                  key={String(btn.val)}
                  onClick={() => setDivisionFilter(btn.val)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    divisionFilter === btn.val
                      ? 'bg-[var(--app-text-accent)] text-slate-950 shadow-sm'
                      : 'bg-[var(--app-surface-2)] text-slate-300 hover:text-white border border-[var(--app-border-subtle)]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Busca por Nome de Treinador ou Clube & Limite de Exibição */}
            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-lg justify-end">
              <input
                type="text"
                value={managerSearchQuery}
                onChange={(e) => setManagerSearchQuery(e.target.value)}
                placeholder="Buscar treinador ou clube..."
                className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-[var(--app-border-highlight)] w-48 sm:w-56"
              />

              <div className="flex items-center space-x-1 text-xs">
                <span className="text-slate-400 text-[11px] hidden sm:inline">Exibir:</span>
                {[
                  { label: 'Top 25', val: 25 as const },
                  { label: 'Top 50', val: 50 as const },
                  { label: 'Todos', val: 'all' as const },
                ].map((opt) => (
                  <button
                    key={String(opt.val)}
                    onClick={() => setDisplayLimit(opt.val)}
                    className={`px-2 py-1 text-[11px] font-bold rounded transition-all cursor-pointer ${
                      displayLimit === opt.val
                        ? 'bg-[var(--app-surface-3)] text-[var(--app-text-accent)] border border-[var(--app-text-accent)]/50'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ranking('Temporada', sorted('seasonScore'))}
            {ranking('Carreira', sorted('careerScore'))}
          </div>
        </>
      )}
    </div>
  );
};
