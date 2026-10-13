import React, { useState, useMemo } from 'react';
import { useGame } from '../state/GameContext';
import { 
  Users, 
  DollarSign, 
  Search, 
  ArrowLeftRight, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Check, 
  X, 
  TrendingUp, 
  Shield, 
  Clock, 
  UserMinus, 
  Sparkles,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Player, Position, MarketFilter, MarketSearchResult, TransferOffer } from '../types';
import { calculateAskingPrice, calculateDemandedSalary } from '../engine/wasmBridge';
import { sound } from '../audio/soundEngine';
import { getClubTheme } from '../theme/clubTheme';
import { ClubCrest } from './ClubCrest';

type TabType = 'free_agents' | 'search' | 'offers' | 'contracts';

const POSITION_COLORS: Record<Position, { bg: string; text: string; border: string }> = {
  GOL: { bg: 'bg-amber-950/70', text: 'text-amber-400', border: 'border-amber-700/60' },
  ZAG: { bg: 'bg-blue-950/70', text: 'text-blue-400', border: 'border-blue-700/60' },
  LAT: { bg: 'bg-sky-950/70', text: 'text-sky-400', border: 'border-sky-700/60' },
  VOL: { bg: 'bg-teal-950/70', text: 'text-teal-400', border: 'border-teal-700/60' },
  MEI: { bg: 'bg-emerald-950/70', text: 'text-emerald-400', border: 'border-emerald-700/60' },
  ATA: { bg: 'bg-rose-950/70', text: 'text-rose-400', border: 'border-rose-700/60' },
};

export const TransfersScreen: React.FC = () => {
  const { 
    gameState, 
    userClub, 
    buyPlayer, 
    signFreeAgent, 
    releasePlayer, 
    acceptAiOffer, 
    rejectAiOffer, 
    renewContract, 
    generateAiOffers, 
    searchPlayers 
  } = useGame();

  const clubTheme = getClubTheme(userClub);

  const [activeTab, setActiveTab] = useState<TabType>('free_agents');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [signingPlayer, setSigningPlayer] = useState<Player | null>(null);
  const [signingYears, setSigningYears] = useState<number>(3);
  const [signingSalary, setSigningSalary] = useState<number>(0);

  const [buyingTarget, setBuyingTarget] = useState<MarketSearchResult | null>(null);
  const [buyingOfferFee, setBuyingOfferFee] = useState<number>(0);

  const [renewingPlayer, setRenewingPlayer] = useState<Player | null>(null);
  const [renewingYears, setRenewingYears] = useState<number>(3);
  const [renewingSalary, setRenewingSalary] = useState<number>(0);

  const [releasingPlayer, setReleasingPlayer] = useState<Player | null>(null);

  // Free Agents local filters
  const [faPosition, setFaPosition] = useState<string>('TODOS');
  const [faSearch, setFaSearch] = useState<string>('');
  const [faMinStrength, setFaMinStrength] = useState<number>(0);

  // Search players filters
  const [searchFilter, setSearchFilter] = useState<MarketFilter>({
    position: 'TODOS',
    minStrength: 50,
    maxStrength: 100,
    minAge: 17,
    maxAge: 40,
    nameQuery: '',
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const squadCount = userClub.squad.length;
  const isSquadFull = squadCount >= 30;
  const isSquadAtMin = squadCount <= 16;
  const freeAgentsList = gameState.freeAgents || [];
  const transferOffersList = gameState.transferOffers || [];

  // Filtered Free Agents
  const filteredFreeAgents = useMemo(() => {
    return freeAgentsList.filter((p) => {
      if (faPosition !== 'TODOS' && p.position !== faPosition) return false;
      if (faMinStrength > 0 && p.strength < faMinStrength) return false;
      if (faSearch.trim() && !p.name.toLowerCase().includes(faSearch.toLowerCase().trim())) return false;
      return true;
    }).sort((a, b) => b.strength - a.strength);
  }, [freeAgentsList, faPosition, faMinStrength, faSearch]);

  // Search Results
  const searchResults = useMemo(() => {
    return searchPlayers(searchFilter);
  }, [searchFilter, gameState.clubs, searchPlayers]);

  // Open Sign Free Agent Modal
  const handleOpenSign = (player: Player) => {
    if (isSquadFull) {
      showToast('error', 'Seu elenco já atingiu o limite máximo de 30 atletas.');
      return;
    }
    const demanded = calculateDemandedSalary(player.salary, player.marketValue);
    setSigningPlayer(player);
    setSigningYears(3);
    setSigningSalary(demanded);
    sound.playClick();
  };

  const handleConfirmSign = () => {
    if (!signingPlayer) return;
    const res = signFreeAgent(signingPlayer.id, signingYears, signingSalary);
    if (res.success) {
      showToast('success', `Contratação de ${signingPlayer.name} confirmada com sucesso!`);
      setSigningPlayer(null);
    } else {
      showToast('error', res.error || 'Falha ao contratar jogador.');
    }
  };

  // Open Buy Player Modal
  const handleOpenBuy = (item: MarketSearchResult) => {
    if (isSquadFull) {
      showToast('error', 'Seu elenco já atingiu o limite máximo de 30 atletas.');
      return;
    }
    setBuyingTarget(item);
    setBuyingOfferFee(item.askingPrice);
    sound.playClick();
  };

  const handleConfirmBuy = () => {
    if (!buyingTarget) return;
    const res = buyPlayer(buyingTarget.player.id, buyingOfferFee);
    if (res.success) {
      showToast('success', `Transferência de ${buyingTarget.player.name} (${buyingTarget.clubName}) realizada com sucesso!`);
      setBuyingTarget(null);
    } else {
      showToast('error', res.error || 'Falha ao concretizar compra.');
    }
  };

  // Open Renew Modal
  const handleOpenRenew = (player: Player) => {
    const demanded = calculateDemandedSalary(player.salary, player.marketValue);
    setRenewingPlayer(player);
    setRenewingYears(player.contractYears ? Math.min(5, player.contractYears + 2) : 3);
    setRenewingSalary(Math.max(player.salary, demanded));
    sound.playClick();
  };

  const handleConfirmRenew = () => {
    if (!renewingPlayer) return;
    const res = renewContract(renewingPlayer.id, renewingYears, renewingSalary);
    if (res.success) {
      showToast('success', `Contrato de ${renewingPlayer.name} renovado com sucesso por ${renewingYears} anos!`);
      setRenewingPlayer(null);
    } else {
      showToast('error', res.error || 'Falha ao renovar contrato.');
    }
  };

  // Open Release Dialog
  const handleOpenRelease = (player: Player) => {
    if (isSquadAtMin) {
      showToast('error', 'Você não pode dispensar este atleta pois ficaria abaixo do limite regulamentar de 16 jogadores.');
      return;
    }
    setReleasingPlayer(player);
    sound.playClick();
  };

  const handleConfirmRelease = () => {
    if (!releasingPlayer) return;
    const res = releasePlayer(releasingPlayer.id);
    if (res.success) {
      showToast('success', `${releasingPlayer.name} teve o contrato rescindido e agora é um agente livre.`);
      setReleasingPlayer(null);
    } else {
      showToast('error', res.error || 'Falha ao dispensar jogador.');
    }
  };

  // AI Offer handlers
  const handleAcceptOffer = (offer: TransferOffer) => {
    if (isSquadAtMin) {
      showToast('error', 'Não é possível aceitar a proposta: seu elenco ficaria abaixo do mínimo de 16 jogadores.');
      return;
    }
    const res = acceptAiOffer(offer.id);
    if (res.success) {
      showToast('success', `Venda de ${offer.playerName} para o ${offer.fromClubName} concluída por ${formatMoney(offer.fee)}!`);
    } else {
      showToast('error', res.error || 'Falha ao aceitar proposta.');
    }
  };

  const handleRejectOffer = (offerId: number) => {
    const res = rejectAiOffer(offerId);
    if (res.success) {
      showToast('success', 'Proposta recusada com sucesso.');
    } else {
      showToast('error', res.error || 'Falha ao recusar proposta.');
    }
  };

  const expiringContractsCount = userClub.squad.filter((p) => (p.contractYears ?? 3) <= 1).length;

  return (
    <div className="flex-1 flex flex-col md:h-[calc(100vh-3.5rem)] md:overflow-hidden md:min-h-0 bg-[var(--app-bg-deep)] select-none pb-6 md:pb-0">
      {/* Top Banner / Market Overview Bar */}
      <div className="bg-[var(--app-surface-1)] border-b border-[var(--app-border-subtle)] px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row gap-2 sm:items-center justify-between shrink-0 shadow-sm relative overflow-hidden">
        {/* Kit Stripe Top Accent Line */}
        <div 
          className="h-1 w-full absolute top-0 left-0 right-0" 
          style={{ background: clubTheme.stripeGradient }} 
        />

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-0.5">
          <div className="flex items-center space-x-2">
            <ClubCrest club={userClub} size="sm" preferMini={true} className="w-5 h-5 shrink-0" />
            <h1 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
              <span>Mercado de Transferências</span>
              <span 
                className="w-2 h-2 rounded-full inline-block" 
                style={{ backgroundColor: clubTheme.primaryAccent }} 
              />
            </h1>
          </div>

          <div className="hidden sm:block h-4 w-px bg-[var(--app-border-subtle)]" />

          {/* Squad Limit Indicator */}
          <div className="flex items-center space-x-1.5 text-xs">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300">Elenco:</span>
            <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
              isSquadFull ? 'bg-amber-950 text-amber-400 border border-amber-800' :
              isSquadAtMin ? 'bg-rose-950 text-rose-400 border border-rose-800' :
              'bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-subtle)]'
            }`}>
              {squadCount} / 30 atletas
            </span>
            <span className="hidden md:inline text-[11px] text-slate-500">
              (Mín: 16 | Máx: 30)
            </span>
          </div>
        </div>

        {/* Club Finances Summary */}
        <div className="flex items-center justify-between sm:justify-end">
          <div className="text-xs">
            <span className="text-slate-400 mr-1.5">Saldo Disponível:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {formatMoney(userClub.balance)}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-[var(--app-surface-1)] border-b border-[var(--app-border-subtle)] px-2 sm:px-4 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex space-x-1 min-w-max">
          <button
            onClick={() => { setActiveTab('free_agents'); sound.playClick(); }}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'free_agents'
                ? 'border-[var(--app-border-highlight)] text-[var(--app-text-accent)] bg-[var(--app-surface-2)]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[var(--app-surface-2)]/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Passes Livres</span>
            <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-subtle)] font-mono">
              {freeAgentsList.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('search'); sound.playClick(); }}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'border-[var(--app-border-highlight)] text-[var(--app-text-accent)] bg-[var(--app-surface-2)]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[var(--app-surface-2)]/60'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar Jogadores</span>
          </button>

          <button
            onClick={() => { setActiveTab('offers'); sound.playClick(); }}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
              activeTab === 'offers'
                ? 'border-[var(--app-border-highlight)] text-[var(--app-text-accent)] bg-[var(--app-surface-2)]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[var(--app-surface-2)]/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Propostas Recebidas</span>
            {transferOffersList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500 text-black font-extrabold font-mono animate-pulse">
                {transferOffersList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('contracts'); sound.playClick(); }}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'contracts'
                ? 'border-[var(--app-border-highlight)] text-[var(--app-text-accent)] bg-[var(--app-surface-2)]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[var(--app-surface-2)]/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Contratos do Elenco</span>
            {expiringContractsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-rose-500 text-white font-extrabold font-mono">
                {expiringContractsCount}
              </span>
            )}
          </button>
        </div>

        {/* Global Action / Refresh AI offers */}
        {activeTab === 'offers' && (
          <button
            onClick={() => {
              generateAiOffers();
              sound.playClick();
              showToast('success', 'Sondagens de mercado atualizadas!');
            }}
            className="flex items-center space-x-1.5 bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border border-[var(--app-border-highlight)] text-[var(--app-text-accent)] text-xs px-2.5 py-1 rounded cursor-pointer font-semibold transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Buscar Novas Propostas</span>
          </button>
        )}
      </div>

      {/* Toast Notification Alert */}
      {feedback && (
        <div className={`px-4 py-2 flex items-center justify-between text-xs font-medium transition-all ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/90 border-b border-emerald-700/60 text-emerald-200' 
            : 'bg-rose-950/90 border-b border-rose-700/60 text-rose-200'
        }`}>
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)} 
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* ================= TAB 1: PASSES LIVRES ================= */}
        {activeTab === 'free_agents' && (
          <div className="space-y-3 max-w-7xl mx-auto">
            {/* Filter Bar */}
            <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center gap-2.5 sm:gap-3">
              <div className="grid grid-cols-2 md:flex md:items-center gap-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">Posição:</span>
                  <select
                    value={faPosition}
                    onChange={(e) => setFaPosition(e.target.value)}
                    className="w-full md:w-auto bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-[var(--app-border-highlight)]"
                  >
                    <option value="TODOS">Todas</option>
                    <option value="GOL">Goleiro (GOL)</option>
                    <option value="ZAG">Zagueiro (ZAG)</option>
                    <option value="LAT">Lateral (LAT)</option>
                    <option value="VOL">Volante (VOL)</option>
                    <option value="MEI">Meia (MEI)</option>
                    <option value="ATA">Atacante (ATA)</option>
                  </select>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">Força Mín:</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={faMinStrength || ''}
                    onChange={(e) => setFaMinStrength(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full md:w-16 bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded px-2 py-1.5 text-center font-mono focus:outline-none focus:border-[var(--app-border-highlight)]"
                  />
                </div>
              </div>

              <div className="flex-1 min-w-[180px] relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={faSearch}
                  onChange={(e) => setFaSearch(e.target.value)}
                  placeholder="Buscar atleta por nome..."
                  className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded pl-8 pr-3 py-1.5 focus:outline-none focus:border-[var(--app-border-highlight)]"
                />
              </div>

              <span className="text-xs text-slate-400 md:ml-auto font-mono text-right">
                {filteredFreeAgents.length} atleta(s) encontrado(s)
              </span>
            </div>

            {/* Free Agents Table */}
            <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg overflow-x-auto shadow">
              <table className="w-full text-left text-xs text-slate-300 min-w-[620px] md:min-w-0">
                <thead className="bg-[var(--app-surface-2)] text-slate-400 text-[11px] uppercase tracking-wider border-b border-[var(--app-border-subtle)]">
                  <tr>
                    <th className="py-2.5 px-3">Nome</th>
                    <th className="py-2.5 px-2 text-center">Pos</th>
                    <th className="py-2.5 px-2 text-center">Idade</th>
                    <th className="py-2.5 px-2 text-center">Perna</th>
                    <th className="py-2.5 px-3 text-center">Força</th>
                    <th className="py-2.5 px-3 text-right">Salário Pedido</th>
                    <th className="py-2.5 px-3 text-right">Valor Mercado</th>
                    <th className="py-2.5 px-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#173022]">
                  {filteredFreeAgents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhum jogador sem contrato encontrado com esses filtros.
                      </td>
                    </tr>
                  ) : (
                    filteredFreeAgents.map((p) => {
                      const posStyle = POSITION_COLORS[p.position] || POSITION_COLORS.MEI;
                      const demanded = calculateDemandedSalary(p.salary, p.marketValue);
                      return (
                        <tr key={p.id} className="hover:bg-[#142b1f]/60 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-100 flex items-center space-x-2">
                            <span>{p.name}</span>
                            {p.isStar && (
                              <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1 rounded">
                                CRAQUE
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}>
                              {p.position}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono">{p.age}</td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400">{p.foot}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono font-bold text-emerald-300">
                              {p.strength}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-200">
                            {formatMoney(demanded)}/mês
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            {formatMoney(p.marketValue)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              disabled={isSquadFull}
                              onClick={() => handleOpenSign(p)}
                              style={!isSquadFull ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent } : undefined}
                              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                isSquadFull
                                  ? 'bg-[var(--app-surface-2)] text-slate-500 border border-transparent cursor-not-allowed'
                                  : 'shadow hover:brightness-110 active:scale-95'
                              }`}
                            >
                              Contratar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 2: BUSCAR JOGADORES ================= */}
        {activeTab === 'search' && (
          <div className="space-y-3 max-w-7xl mx-auto">
            {/* Search Filter Panel */}
            <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-stretch lg:items-center gap-2.5 sm:gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">Posição:</span>
                  <select
                    value={searchFilter.position || 'TODOS'}
                    onChange={(e) => setSearchFilter({ ...searchFilter, position: e.target.value })}
                    className="w-full lg:w-auto bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-[var(--app-border-highlight)]"
                  >
                    <option value="TODOS">Todas</option>
                    <option value="GOL">Goleiro (GOL)</option>
                    <option value="ZAG">Zagueiro (ZAG)</option>
                    <option value="LAT">Lateral (LAT)</option>
                    <option value="VOL">Volante (VOL)</option>
                    <option value="MEI">Meia (MEI)</option>
                    <option value="ATA">Atacante (ATA)</option>
                  </select>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">Força:</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={searchFilter.minStrength ?? ''}
                    onChange={(e) => setSearchFilter({ ...searchFilter, minStrength: Number(e.target.value) || 0 })}
                    placeholder="Min"
                    className="w-full lg:w-14 bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded px-1.5 py-1.5 text-center font-mono focus:outline-none focus:border-[var(--app-border-highlight)]"
                  />
                  <span className="text-slate-500">-</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={searchFilter.maxStrength ?? ''}
                    onChange={(e) => setSearchFilter({ ...searchFilter, maxStrength: Number(e.target.value) || 100 })}
                    placeholder="Max"
                    className="w-full lg:w-14 bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded px-1.5 py-1.5 text-center font-mono focus:outline-none focus:border-[var(--app-border-highlight)]"
                  />
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">Idade:</span>
                  <input
                    type="number"
                    min={15}
                    max={45}
                    value={searchFilter.minAge ?? ''}
                    onChange={(e) => setSearchFilter({ ...searchFilter, minAge: Number(e.target.value) || 15 })}
                    placeholder="Min"
                    className="w-full lg:w-14 bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded px-1.5 py-1.5 text-center font-mono focus:outline-none focus:border-[var(--app-border-highlight)]"
                  />
                  <span className="text-slate-500">-</span>
                  <input
                    type="number"
                    min={15}
                    max={45}
                    value={searchFilter.maxAge ?? ''}
                    onChange={(e) => setSearchFilter({ ...searchFilter, maxAge: Number(e.target.value) || 45 })}
                    placeholder="Max"
                    className="w-full lg:w-14 bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded px-1.5 py-1.5 text-center font-mono focus:outline-none focus:border-[var(--app-border-highlight)]"
                  />
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">Valor Máx:</span>
                  <select
                    value={searchFilter.maxValue ?? ''}
                    onChange={(e) => setSearchFilter({ ...searchFilter, maxValue: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full lg:w-auto bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-[var(--app-border-highlight)]"
                  >
                    <option value="">Qualquer Valor</option>
                    <option value="2000000">Até R$ 2M</option>
                    <option value="5000000">Até R$ 5M</option>
                    <option value="15000000">Até R$ 15M</option>
                    <option value="35000000">Até R$ 35M</option>
                    <option value="70000000">Até R$ 70M</option>
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2 lg:flex-1 min-w-[180px] relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchFilter.nameQuery || ''}
                    onChange={(e) => setSearchFilter({ ...searchFilter, nameQuery: e.target.value })}
                    placeholder="Buscar nome do atleta..."
                    className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded pl-8 pr-3 py-1.5 focus:outline-none focus:border-[var(--app-border-highlight)]"
                  />
                </div>

                <button
                  onClick={() => setSearchFilter({ position: 'TODOS', minStrength: 50, maxStrength: 100, minAge: 17, maxAge: 40, nameQuery: '' })}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 cursor-pointer underline text-center sm:text-right"
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Results Table */}
            <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg overflow-x-auto shadow">
              <table className="w-full text-left text-xs text-slate-300 min-w-[680px] md:min-w-0">
                <thead className="bg-[var(--app-surface-2)] text-slate-400 text-[11px] uppercase tracking-wider border-b border-[var(--app-border-subtle)]">
                  <tr>
                    <th className="py-2.5 px-3">Atleta</th>
                    <th className="py-2.5 px-3">Clube Atual</th>
                    <th className="py-2.5 px-2 text-center">Pos</th>
                    <th className="py-2.5 px-2 text-center">Idade</th>
                    <th className="py-2.5 px-3 text-center">Força</th>
                    <th className="py-2.5 px-3 text-right">Valor Mercado</th>
                    <th className="py-2.5 px-3 text-right">Preço Pedido</th>
                    <th className="py-2.5 px-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#173022]">
                  {searchResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhum jogador encontrado com esses filtros.
                      </td>
                    </tr>
                  ) : (
                    searchResults.map((item) => {
                      const p = item.player;
                      const posStyle = POSITION_COLORS[p.position] || POSITION_COLORS.MEI;
                      const canAfford = userClub.balance >= item.askingPrice;

                      return (
                        <tr key={`${item.clubId}-${p.id}`} className="hover:bg-[#142b1f]/60 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-100 flex items-center space-x-2">
                            <span>{p.name}</span>
                            {p.isStar && (
                              <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1 rounded">
                                CRAQUE
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-medium">{item.clubName}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}>
                              {p.position}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono">{p.age}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono font-bold text-emerald-300">
                              {p.strength}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            {formatMoney(p.marketValue)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatMoney(item.askingPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              disabled={isSquadFull}
                              onClick={() => handleOpenBuy(item)}
                              style={!isSquadFull && canAfford ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent } : undefined}
                              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                isSquadFull
                                  ? 'bg-[var(--app-surface-2)] text-slate-500 border border-transparent cursor-not-allowed'
                                  : !canAfford
                                  ? 'bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] hover:bg-[var(--app-surface-1)]'
                                  : 'shadow hover:brightness-110 active:scale-95'
                              }`}
                            >
                              Comprar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 3: PROPOSTAS RECEBIDAS ================= */}
        {activeTab === 'offers' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                  Propostas de Clubes da IA
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Outras equipes monitorando e enviando ofertas de compra para atletas do seu elenco.
                </p>
              </div>
              <div className="text-xs font-mono font-semibold text-slate-300">
                {transferOffersList.length} proposta(s) pendente(s)
              </div>
            </div>

            {transferOffersList.length === 0 ? (
              <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-12 text-center space-y-3">
                <TrendingUp className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">Nenhuma Proposta Pendente</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Clubes adversários costumam sondar atletas durante o campeonato. Clique no botão acima para prospectar novas ofertas ou aguarde o avanço das rodadas.
                </p>
                <button
                  onClick={() => {
                    generateAiOffers();
                    sound.playClick();
                    showToast('success', 'Sondagens de mercado consultadas com sucesso!');
                  }}
                  className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs px-4 py-2 rounded shadow cursor-pointer transition-colors"
                >
                  Buscar Ofertas Agora
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {transferOffersList.map((offer) => {
                  const player = userClub.squad.find((p) => p.id === offer.playerId);
                  const posStyle = POSITION_COLORS[offer.playerPosition] || POSITION_COLORS.MEI;
                  const ratio = player && player.marketValue > 0 
                    ? Math.round(((offer.fee - player.marketValue) / player.marketValue) * 100) 
                    : 0;

                  return (
                    <div 
                      key={offer.id}
                      className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md hover:border-[var(--app-border-highlight)] transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-emerald-400 font-mono">
                            OFERTA #{offer.id}
                          </span>
                          <span className="text-slate-400 text-xs">•</span>
                          <span className="text-xs text-slate-300">
                            De: <strong className="text-white font-semibold">{offer.fromClubName}</strong>
                          </span>
                        </div>

                        <div className="flex items-center space-x-2.5 pt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}>
                            {offer.playerPosition}
                          </span>
                          <span className="text-sm font-bold text-slate-100">
                            {offer.playerName}
                          </span>
                          <span className="text-xs font-mono text-emerald-300">
                            (Força {offer.playerStrength})
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-400 pt-1">
                          <span>
                            Valor da Oferta: <strong className="font-mono text-emerald-300 text-sm">{formatMoney(offer.fee)}</strong>
                          </span>
                          {ratio !== 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                              ratio > 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {ratio > 0 ? `+${ratio}%` : `${ratio}%`} do valor de mercado
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 pt-2 sm:pt-0 border-t border-[var(--app-border-subtle)] sm:border-t-0">
                        <button
                          onClick={() => handleRejectOffer(offer.id)}
                          className="flex-1 sm:flex-initial min-h-[38px] px-3.5 py-2 rounded text-xs font-bold bg-[#1b2b22] hover:bg-rose-950 hover:text-rose-300 text-slate-300 border border-[#274534] hover:border-rose-800 transition-colors cursor-pointer"
                        >
                          Recusar
                        </button>
                        <button
                          disabled={isSquadAtMin}
                          onClick={() => handleAcceptOffer(offer)}
                          title={isSquadAtMin ? 'Elenco atingiu o limite mínimo de 16 atletas' : 'Aceitar e transferir atleta'}
                          className={`flex-1 sm:flex-initial min-h-[38px] px-4 py-2 rounded text-xs font-bold transition-all cursor-pointer ${
                            isSquadAtMin
                              ? 'bg-[#1a2f24] text-slate-500 cursor-not-allowed border border-transparent'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-black shadow-lg shadow-emerald-950/50 active:scale-95'
                          }`}
                        >
                          Aceitar Proposta
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: CONTRATOS DO ELENCO ================= */}
        {activeTab === 'contracts' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3.5">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  Total de Atletas
                </span>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className="text-xl font-bold font-mono text-slate-100">{squadCount}</span>
                  <span className="text-xs text-slate-500">/ 30 vagas (mín. 16)</span>
                </div>
              </div>

              <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3.5">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  Folha Salarial Mensal
                </span>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {formatMoney(userClub.squad.reduce((sum, p) => sum + p.salary, 0))}
                  </span>
                  <span className="text-xs text-slate-500">/mês</span>
                </div>
              </div>

              <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3.5">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  Contratos Urgentes (≤ 1 ano)
                </span>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className={`text-xl font-bold font-mono ${expiringContractsCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {expiringContractsCount}
                  </span>
                  <span className="text-xs text-slate-500">atleta(s)</span>
                </div>
              </div>
            </div>

            {/* Contracts Table */}
            <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg overflow-x-auto shadow">
              <table className="w-full text-left text-xs text-slate-300 min-w-[680px] md:min-w-0">
                <thead className="bg-[var(--app-surface-2)] text-slate-400 text-[11px] uppercase tracking-wider border-b border-[var(--app-border-subtle)]">
                  <tr>
                    <th className="py-2.5 px-3">Atleta</th>
                    <th className="py-2.5 px-2 text-center">Pos</th>
                    <th className="py-2.5 px-2 text-center">Idade</th>
                    <th className="py-2.5 px-3 text-center">Força</th>
                    <th className="py-2.5 px-3 text-right">Salário Atual</th>
                    <th className="py-2.5 px-3 text-right">Valor Mercado</th>
                    <th className="py-2.5 px-3 text-center">Contrato Restante</th>
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#173022]">
                  {userClub.squad.map((p) => {
                    const posStyle = POSITION_COLORS[p.position] || POSITION_COLORS.MEI;
                    const years = p.contractYears ?? 3;
                    const isExpiring = years <= 1;

                    return (
                      <tr key={p.id} className="hover:bg-[#142b1f]/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-100 flex items-center space-x-2">
                          <span>{p.name}</span>
                          {p.isStarter && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-1 rounded">
                              TITULAR
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}>
                            {p.position}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">{p.age}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-mono font-bold text-emerald-300">
                            {p.strength}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-200">
                          {formatMoney(p.salary)}/mês
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                          {formatMoney(p.marketValue)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            isExpiring 
                              ? 'bg-rose-950/80 text-rose-300 border-rose-800 animate-pulse'
                              : years === 2
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                              : 'bg-[#153123] text-emerald-300 border-[#225039]'
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>{years} {years === 1 ? 'ano' : 'anos'}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleOpenRenew(p)}
                              style={{ backgroundColor: clubTheme.subtleBg, borderColor: clubTheme.subtleBorder, color: clubTheme.primaryAccent }}
                              className="px-2.5 py-1 rounded text-xs font-semibold border hover:brightness-125 transition-all cursor-pointer"
                            >
                              Renovar
                            </button>
                            <button
                              disabled={isSquadAtMin}
                              onClick={() => handleOpenRelease(p)}
                              title={isSquadAtMin ? 'Mínimo de 16 atletas no elenco atingido' : 'Dispensar atleta'}
                              className={`p-1 rounded text-slate-400 transition-colors ${
                                isSquadAtMin 
                                  ? 'opacity-40 cursor-not-allowed' 
                                  : 'hover:text-rose-400 hover:bg-rose-950/60 cursor-pointer'
                              }`}
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: SIGN FREE AGENT ================= */}
      {signingPlayer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--app-border-subtle)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Contratar Agente Livre</h3>
                <p className="text-xs text-slate-400">Negociação direta de salário e luvas</p>
              </div>
              <button 
                onClick={() => setSigningPlayer(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Player Quick Info */}
            <div className="bg-[var(--app-surface-2)] p-3 rounded-lg flex items-center justify-between border border-[var(--app-border-subtle)]">
              <div>
                <div className="font-bold text-sm text-slate-100">{signingPlayer.name}</div>
                <div className="text-xs text-slate-400 font-mono">
                  {signingPlayer.age} anos • {signingPlayer.position} • Perna {signingPlayer.foot}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Força</span>
                <div className="text-base font-bold font-mono text-[var(--app-text-accent)]">{signingPlayer.strength}</div>
              </div>
            </div>

            {/* Demands */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Duração do Contrato:</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((y) => (
                    <button
                      key={y}
                      onClick={() => setSigningYears(y)}
                      className={`py-1.5 rounded text-xs font-mono font-bold border transition-all cursor-pointer ${
                        signingYears === y
                          ? 'bg-emerald-600 text-black border-emerald-500 shadow'
                          : 'bg-[var(--app-surface-2)] text-slate-300 border-[var(--app-border-subtle)] hover:border-[var(--app-border-highlight)]'
                      }`}
                    >
                      {y} {y === 1 ? 'ano' : 'anos'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-400 font-semibold">Salário Mensal Proposto:</label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Mínimo: {formatMoney(calculateDemandedSalary(signingPlayer.salary, signingPlayer.marketValue))}
                  </span>
                </div>
                <input
                  type="number"
                  step="500"
                  value={signingSalary}
                  onChange={(e) => setSigningSalary(Number(e.target.value) || 0)}
                  className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-[var(--app-text-accent)] text-sm font-mono font-bold rounded px-3 py-2 focus:outline-none focus:border-[var(--app-border-highlight)]"
                />
              </div>

              {/* Financial Impact */}
              <div className="bg-[var(--app-surface-2)]/50 p-3 rounded border border-[var(--app-border-subtle)] space-y-1.5 text-[11px] font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Luvas de Assinatura (1 mês):</span>
                  <span className="text-slate-200">{formatMoney(signingSalary)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Saldo Atual:</span>
                  <span className="text-emerald-400">{formatMoney(userClub.balance)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--app-border-subtle)] pt-1 text-slate-300 font-bold">
                  <span>Saldo Pós-Contratação:</span>
                  <span className={userClub.balance >= signingSalary ? 'text-emerald-400' : 'text-rose-400'}>
                    {formatMoney(userClub.balance - signingSalary)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setSigningPlayer(null)}
                className="flex-1 py-2 rounded text-xs font-semibold bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] text-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                disabled={userClub.balance < signingSalary}
                onClick={handleConfirmSign}
                className={`flex-1 py-2 rounded text-xs font-bold transition-all cursor-pointer ${
                  userClub.balance < signingSalary
                    ? 'bg-rose-950 text-rose-400 border border-rose-800 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-black shadow-lg shadow-emerald-950/50'
                }`}
              >
                {userClub.balance < signingSalary ? 'Saldo Insuficiente' : 'Assinar Contrato'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: BUY PLAYER ================= */}
      {buyingTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--app-border-subtle)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Comprar Jogador</h3>
                <p className="text-xs text-slate-400">Proposta de transferência entre clubes</p>
              </div>
              <button 
                onClick={() => setBuyingTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Player and Seller Club */}
            <div className="bg-[var(--app-surface-2)] p-3 rounded-lg space-y-1.5 border border-[var(--app-border-subtle)]">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm text-slate-100">{buyingTarget.player.name}</div>
                  <div className="text-xs text-slate-400">
                    Clube: <strong className="text-white">{buyingTarget.clubName}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Força</span>
                  <div className="text-base font-bold font-mono text-[var(--app-text-accent)]">{buyingTarget.player.strength}</div>
                </div>
              </div>
              <div className="text-xs text-slate-400 font-mono pt-1">
                {buyingTarget.player.age} anos • {buyingTarget.player.position} • Valor de Mercado: {formatMoney(buyingTarget.player.marketValue)}
              </div>
            </div>

            {/* Transfer Fee input */}
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-400 font-semibold">Valor da Proposta (R$):</label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Preço Pedido: {formatMoney(buyingTarget.askingPrice)}
                  </span>
                </div>
                <input
                  type="number"
                  step="50000"
                  value={buyingOfferFee}
                  onChange={(e) => setBuyingOfferFee(Number(e.target.value) || 0)}
                  className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-[var(--app-text-accent)] text-sm font-mono font-bold rounded px-3 py-2 focus:outline-none focus:border-[var(--app-border-highlight)]"
                />
                {buyingOfferFee < buyingTarget.askingPrice && (
                  <p className="text-[11px] text-amber-400 mt-1 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Atenção: Propostas abaixo do preço pedido de {formatMoney(buyingTarget.askingPrice)} serão recusadas pelo clube vendedor.</span>
                  </p>
                )}
              </div>

              {/* Financial Impact */}
              <div className="bg-[var(--app-surface-2)]/50 p-3 rounded border border-[var(--app-border-subtle)] space-y-1.5 text-[11px] font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Saldo Atual:</span>
                  <span className="text-emerald-400">{formatMoney(userClub.balance)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--app-border-subtle)] pt-1 text-slate-300 font-bold">
                  <span>Saldo Pós-Compra:</span>
                  <span className={userClub.balance >= buyingOfferFee ? 'text-emerald-400' : 'text-rose-400'}>
                    {formatMoney(userClub.balance - buyingOfferFee)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setBuyingTarget(null)}
                className="flex-1 py-2 rounded text-xs font-semibold bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] text-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                disabled={userClub.balance < buyingOfferFee}
                onClick={handleConfirmBuy}
                className={`flex-1 py-2 rounded text-xs font-bold transition-all cursor-pointer ${
                  userClub.balance < buyingOfferFee
                    ? 'bg-rose-950 text-rose-400 border border-rose-800 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-black shadow-lg shadow-emerald-950/50'
                }`}
              >
                {userClub.balance < buyingOfferFee ? 'Saldo Insuficiente' : 'Efetuar Compra'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: RENEW CONTRACT ================= */}
      {renewingPlayer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--app-border-subtle)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Renovação de Contrato</h3>
                <p className="text-xs text-slate-400">Extensão salarial e contratual</p>
              </div>
              <button 
                onClick={() => setRenewingPlayer(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Player Info */}
            <div className="bg-[var(--app-surface-2)] p-3 rounded-lg flex items-center justify-between border border-[var(--app-border-subtle)]">
              <div>
                <div className="font-bold text-sm text-slate-100">{renewingPlayer.name}</div>
                <div className="text-xs text-slate-400 font-mono">
                  {renewingPlayer.age} anos • {renewingPlayer.position} • Atual: {renewingPlayer.contractYears ?? 3} anos
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Salário Atual</span>
                <div className="text-xs font-bold font-mono text-slate-200">{formatMoney(renewingPlayer.salary)}/mês</div>
              </div>
            </div>

            {/* Renewal terms */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Novo Prazo de Contrato:</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((y) => (
                    <button
                      key={y}
                      onClick={() => setRenewingYears(y)}
                      className={`py-1.5 rounded text-xs font-mono font-bold border transition-all cursor-pointer ${
                        renewingYears === y
                          ? 'bg-emerald-600 text-black border-emerald-500 shadow'
                          : 'bg-[var(--app-surface-2)] text-slate-300 border-[var(--app-border-subtle)] hover:border-[var(--app-border-highlight)]'
                      }`}
                    >
                      {y} {y === 1 ? 'ano' : 'anos'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-400 font-semibold">Novo Salário Mensal:</label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Mínimo Exigido: {formatMoney(calculateDemandedSalary(renewingPlayer.salary, renewingPlayer.marketValue))}
                  </span>
                </div>
                <input
                  type="number"
                  step="500"
                  value={renewingSalary}
                  onChange={(e) => setRenewingSalary(Number(e.target.value) || 0)}
                  className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-[var(--app-text-accent)] text-sm font-mono font-bold rounded px-3 py-2 focus:outline-none focus:border-[var(--app-border-highlight)]"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setRenewingPlayer(null)}
                className="flex-1 py-2 rounded text-xs font-semibold bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] text-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRenew}
                className="flex-1 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-black shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                Confirmar Renovação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIRM RELEASE ================= */}
      {releasingPlayer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--app-border-subtle)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Rescindir Contrato</h3>
                <p className="text-xs text-rose-400">Dispensar atleta do clube</p>
              </div>
              <button 
                onClick={() => setReleasingPlayer(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tem certeza que deseja rescindir o contrato de <strong className="text-white font-bold">{releasingPlayer.name}</strong>? Ele deixará seu clube imediatamente e ficará disponível como passe livre no mercado.
            </p>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setReleasingPlayer(null)}
                className="flex-1 py-2 rounded text-xs font-semibold bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] text-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRelease}
                className="flex-1 py-2 rounded text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50 cursor-pointer"
              >
                Sim, Dispensar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransfersScreen;
