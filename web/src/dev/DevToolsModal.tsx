import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { GameState } from '../types/index.ts';
import type { DevTab, BatchSimulationProgress } from './types.ts';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Trophy, 
  Calendar, 
  Zap, 
  X, 
  Globe, 
  Users, 
  Sliders, 
  Copy, 
  Check, 
  ShieldCheck,
  ChevronRight,
  Database
} from 'lucide-react';
import { runHeadlessSimulation } from './devBatchEngine.ts';
import { 
  jumpToCopaStage, 
  jumpToSecondSemester, 
  jumpToEndOfSeason, 
  jumpToWorldCupYear, 
  injectWorldCupInstant, 
  injectNationalTeamOffersInstant, 
  injectAiTransferOfferInstant,
  type CopaStage 
} from './devScenarios.ts';
import { 
  saveDevSnapshot, 
  getLastDevSnapshot, 
  getAllDevSnapshots, 
  exportDevStateJson 
} from './devSandboxStorage.ts';

interface DevToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  applyDevState: (updater: GameState | ((prev: GameState) => GameState)) => void;
  rustVersion?: string;
  isWasmEngine?: boolean;
}

export const DevToolsModal: React.FC<DevToolsModalProps> = ({
  isOpen,
  onClose,
  gameState,
  applyDevState,
  rustVersion = 'Rust WASM',
  isWasmEngine = true,
}) => {
  const [activeTab, setActiveTab] = useState<DevTab>('timetravel');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<BatchSimulationProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [customRounds, setCustomRounds] = useState<number>(5);
  const [forceWinKnockout, setForceWinKnockout] = useState<boolean>(true);
  const [selectedCopaStage, setSelectedCopaStage] = useState<CopaStage>('Oitavas de Final');
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [lastSnapshotInfo, setLastSnapshotInfo] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Update snapshot info on open
  useEffect(() => {
    if (isOpen) {
      const snap = getLastDevSnapshot();
      setLastSnapshotInfo(snap ? `${snap.label} (${snap.savedAt})` : null);
    }
  }, [isOpen]);

  const handleAbort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStatusMessage('Simulação cancelada pelo desenvolvedor.');
      setIsRunning(false);
    }
  }, []);

  const handleRollback = useCallback(() => {
    const snap = getLastDevSnapshot();
    if (!snap) {
      setStatusMessage('Nenhum snapshot de segurança disponível para desfazer.');
      return;
    }
    applyDevState(snap.state);
    setStatusMessage(`↩️ Revertido com sucesso para: ${snap.label} (${snap.savedAt})`);
  }, [applyDevState]);

  // Generic runner that automatically takes a safety snapshot first
  const executeWithSafetySnapshot = async (
    label: string,
    action: (signal: AbortSignal) => Promise<GameState | void>
  ) => {
    try {
      saveDevSnapshot(gameState, label);
      setLastSnapshotInfo(`${label} (${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`);

      setIsRunning(true);
      setStatusMessage(`Iniciando: ${label}...`);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const updated = await action(controller.signal);
      if (updated) {
        applyDevState(updated);
        setStatusMessage(`✅ Concluído: ${label}!`);
      }
    } catch (err: any) {
      setStatusMessage(`Erro durante simulação: ${err?.message || err}`);
    } finally {
      setIsRunning(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  };

  // Time Travel: Simulate X Rounds
  const handleSimulateRounds = (roundsToSimulate: number) => {
    executeWithSafetySnapshot(`Simulação de ${roundsToSimulate} rodadas`, async (signal) => {
      return await runHeadlessSimulation(gameState, {
        targetRounds: roundsToSimulate,
        forceUserWinKnockout: forceWinKnockout,
        onProgress: setProgress,
        signal,
      });
    });
  };

  // Scenarios Handlers
  const handleJumpCopa = () => {
    executeWithSafetySnapshot(`Avançar até ${selectedCopaStage} da Copa`, async (signal) => {
      return await jumpToCopaStage(gameState, selectedCopaStage, setProgress, signal);
    });
  };

  const handleJumpSemester2 = () => {
    executeWithSafetySnapshot('Avançar até 2º Semestre (Brasileirão)', async (signal) => {
      return await jumpToSecondSemester(gameState, setProgress, signal);
    });
  };

  const handleJumpEndOfSeason = () => {
    executeWithSafetySnapshot('Avançar até o Fim da Temporada', async (signal) => {
      return await jumpToEndOfSeason(gameState, setProgress, signal);
    });
  };

  const handleJumpWorldCupYear = () => {
    executeWithSafetySnapshot('Avançar até Ano de Copa do Mundo', async (signal) => {
      return await jumpToWorldCupYear(gameState, setProgress, signal);
    });
  };

  const handleInjectWorldCupInstant = () => {
    saveDevSnapshot(gameState, 'Antes de injetar Copa do Mundo');
    const updated = injectWorldCupInstant(gameState);
    applyDevState(updated);
    setStatusMessage('🏆 Torneio da Copa do Mundo injetado com sucesso!');
  };

  const handleInjectNationalOffer = () => {
    saveDevSnapshot(gameState, 'Antes de injetar Proposta de Seleção');
    const updated = injectNationalTeamOffersInstant(gameState);
    applyDevState(updated);
    setStatusMessage('👔 Propostas de Seleção Nacional adicionadas!');
  };

  const handleInjectAiTransfer = () => {
    saveDevSnapshot(gameState, 'Antes de injetar Proposta de Transferência');
    const updated = injectAiTransferOfferInstant(gameState);
    applyDevState(updated);
    setStatusMessage('💰 Proposta milionária da IA injetada com sucesso!');
  };

  const handleCopyJson = () => {
    const json = exportDevStateJson(gameState);
    navigator.clipboard.writeText(json);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  if (!isOpen) return null;

  const userClub = gameState.clubs.find((c) => c.id === gameState.userClubId);
  const currentCompetition = gameState.calendar.find(
    (f) => (f.fixtureDateIndex ?? f.round) === gameState.currentRound
  )?.competitionName || 'Campeonato Atual';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        role="dialog"
        aria-label="Champs Dev Tools"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-wide text-white uppercase">
                  Modo Desenvolvedor & Sandbox
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md uppercase">
                  Dev Only
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {rustVersion} · {isWasmEngine ? 'Motor WASM nativo ativo' : 'JS Fallback'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Rollback Banner */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {lastSnapshotInfo ? (
                <>Snapshot ativo: <strong className="text-white">{lastSnapshotInfo}</strong></>
              ) : (
                'Snapshots automáticos protegem seu save antes de qualquer simulação.'
              )}
            </span>
          </div>

          <button
            onClick={handleRollback}
            disabled={!lastSnapshotInfo || isRunning}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Desfazer Simulação
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 px-6 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('timetravel')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'timetravel'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Viagem no Tempo
          </button>

          <button
            onClick={() => setActiveTab('scenarios')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'scenarios'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Cenários & Injeções
          </button>

          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'inspector'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Inspetor de Estado
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Running Progress Bar */}
          {isRunning && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-xl space-y-3 animate-pulse">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-300">
                  {progress?.message || 'Simulando em lote no motor WASM...'}
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {progress?.percent ?? 0}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-150 ease-out"
                  style={{ width: `${progress?.percent ?? 10}%` }}
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAbort}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Abortar Simulação
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: TIME TRAVEL */}
          {activeTab === 'timetravel' && (
            <div className="space-y-6">
              {/* Quick Jump Buttons */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Avanço Rápido de Rodadas
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[1, 5, 10, 20].map((rounds) => (
                    <button
                      key={rounds}
                      onClick={() => handleSimulateRounds(rounds)}
                      disabled={isRunning}
                      className="flex flex-col items-center justify-center p-3.5 bg-slate-800/80 hover:bg-emerald-600/30 hover:border-emerald-500/50 border border-slate-700 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer group"
                    >
                      <span className="text-lg font-black text-white group-hover:text-emerald-300">
                        +{rounds}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {rounds === 1 ? 'Rodada' : 'Rodadas'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Number Input */}
              <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Simulação Personalizada
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label htmlFor="custom-rounds-input" className="text-xs text-slate-400">Quantidade:</label>
                    <input
                      id="custom-rounds-input"
                      type="number"
                      min={1}
                      max={100}
                      value={customRounds}
                      onChange={(e) => setCustomRounds(Math.max(1, parseInt(e.target.value) || 1))}
                      disabled={isRunning}
                      className="w-20 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono text-center focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-xs text-slate-400">rodadas</span>
                  </div>

                  <button
                    onClick={() => handleSimulateRounds(customRounds)}
                    disabled={isRunning}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-40 cursor-pointer ml-auto"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Simular Agora
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={forceWinKnockout}
                      onChange={(e) => setForceWinKnockout(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900"
                    />
                    <span>
                      <strong>Forçar classificação do meu time em mata-mata:</strong> Garante vitórias nas fases eliminatórias para não ser eliminado do teste.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCENARIOS & INJECTIONS */}
          {activeTab === 'scenarios' && (
            <div className="space-y-6">
              {/* Copa do Brasil Stage Jump */}
              <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Trophy className="w-4 h-4" />
                  <span>Chegar na Copa do Brasil (Mata-Mata)</span>
                </div>
                <p className="text-xs text-slate-400">
                  Simula automaticamente rodada a rodada garantindo vitórias do seu time até alcançar a fase desejada.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <select
                    value={selectedCopaStage}
                    onChange={(e) => setSelectedCopaStage(e.target.value as CopaStage)}
                    disabled={isRunning}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Oitavas de Final">Oitavas de Final</option>
                    <option value="Quartas de Final">Quartas de Final</option>
                    <option value="Semifinal">Semifinal</option>
                    <option value="Final">Final</option>
                  </select>

                  <button
                    onClick={handleJumpCopa}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                    Pular até {selectedCopaStage}
                  </button>
                </div>
              </div>

              {/* Calendar Milestones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>Início do 2º Semestre</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Avança até a transição para o Campeonato Brasileiro / Ligas Nacionais.
                  </p>
                  <button
                    onClick={handleJumpSemester2}
                    disabled={isRunning}
                    className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 border border-amber-500/30 rounded-lg transition-colors cursor-pointer"
                  >
                    Ir para o 2º Semestre
                  </button>
                </div>

                <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                    <RotateCcw className="w-4 h-4" />
                    <span>Fim da Temporada</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Avança até o encerramento do ano para testar rollover, prêmios e rebaixamento.
                  </p>
                  <button
                    onClick={handleJumpEndOfSeason}
                    disabled={isRunning}
                    className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-blue-300 border border-blue-500/30 rounded-lg transition-colors cursor-pointer"
                  >
                    Simular até Fim do Ano
                  </button>
                </div>
              </div>

              {/* Instant Injections & Mocks */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Injeções Instantâneas (Mock State)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleInjectWorldCupInstant}
                    disabled={isRunning}
                    className="p-3 bg-slate-800/60 hover:bg-emerald-600/20 border border-slate-700 hover:border-emerald-500/40 rounded-xl text-left transition-all cursor-pointer space-y-1"
                  >
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <div className="text-xs font-bold text-white">Injetar Copa do Mundo</div>
                    <div className="text-[11px] text-slate-400">
                      Cria torneio FIFA 32 seleções e abre a tela imediatamente.
                    </div>
                  </button>

                  <button
                    onClick={handleInjectNationalOffer}
                    disabled={isRunning}
                    className="p-3 bg-slate-800/60 hover:bg-amber-600/20 border border-slate-700 hover:border-amber-500/40 rounded-xl text-left transition-all cursor-pointer space-y-1"
                  >
                    <Users className="w-4 h-4 text-amber-400" />
                    <div className="text-xs font-bold text-white">Oferta de Seleção</div>
                    <div className="text-[11px] text-slate-400">
                      Dispara propostas de seleções nacionais (Brasil, Portugal, etc.).
                    </div>
                  </button>

                  <button
                    onClick={handleInjectAiTransfer}
                    disabled={isRunning}
                    className="p-3 bg-slate-800/60 hover:bg-purple-600/20 border border-slate-700 hover:border-purple-500/40 rounded-xl text-left transition-all cursor-pointer space-y-1"
                  >
                    <Zap className="w-4 h-4 text-purple-400" />
                    <div className="text-xs font-bold text-white">Oferta da IA por Titular</div>
                    <div className="text-[11px] text-slate-400">
                      Cria proposta milionária de clube rival pelo seu jogador chave.
                    </div>
                  </button>
                </div>

                <div className="mt-3">
                  <button
                    onClick={handleJumpWorldCupYear}
                    disabled={isRunning}
                    className="w-full py-2 px-3 bg-slate-800/50 hover:bg-slate-800 text-xs text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer text-center"
                  >
                    🌍 Avançar Temporadas Reais até o Próximo Ano de Copa do Mundo FIFA (Quadrienal)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STATE INSPECTOR */}
          {activeTab === 'inspector' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl space-y-1">
                  <span className="text-slate-400">Temporada</span>
                  <div className="text-base font-bold text-white">{gameState.seasonYear}</div>
                </div>
                <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl space-y-1">
                  <span className="text-slate-400">Rodada Atual</span>
                  <div className="text-base font-bold text-emerald-400">
                    {gameState.currentRound} / {Math.max(...gameState.calendar.map(f => f.fixtureDateIndex ?? f.round))}
                  </div>
                </div>
                <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl space-y-1">
                  <span className="text-slate-400">Semestre Ativo</span>
                  <div className="text-base font-bold text-white">{gameState.currentSemester ?? 1}º Semestre</div>
                </div>
                <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl space-y-1">
                  <span className="text-slate-400">Competição</span>
                  <div className="text-sm font-bold text-amber-300 truncate">{currentCompetition}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-700/60 pb-1.5">
                  <span className="text-slate-400">Clube do Usuário:</span>
                  <span className="font-bold text-white">{userClub?.name} (ID: {gameState.userClubId})</span>
                </div>
                <div className="flex justify-between border-b border-slate-700/60 pb-1.5">
                  <span className="text-slate-400">Saldo Financeiro:</span>
                  <span className="font-mono text-emerald-400">
                    R$ {(userClub?.balance ?? 0).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-700/60 pb-1.5">
                  <span className="text-slate-400">Total de Clubes no Banco:</span>
                  <span className="text-white">{gameState.clubs.length} clubes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Jogos no Calendário:</span>
                  <span className="text-white">
                    {gameState.calendar.filter(f => f.played).length} jogados / {gameState.calendar.length} total
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">
                  Exportar estado completo para debug ou compartilhamento:
                </span>
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar JSON do GameState
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Status Message Footer Banner */}
          {statusMessage && (
            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-emerald-300 font-medium animate-in fade-in">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-800/60 border-t border-slate-800 text-xs">
          <span className="text-slate-400">
            Dica: Pressione <kbd className="px-1.5 py-0.5 bg-slate-700 rounded font-mono text-[11px] text-slate-200">Ctrl+Shift+D</kbd> para abrir/fechar.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
