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
  ChevronUp,
  ChevronDown,
  Filter,
  Gavel,
  Tag
} from 'lucide-react';
import { Player, Position, MarketFilter, MarketSearchResult, TransferOffer } from '../types';
import { calculateAskingPrice, calculateDemandedSalary } from '../engine/wasmBridge';
import { calculateRescissionPenalty } from '../engine/careerEconomy';
import { sound } from '../audio/soundEngine';
import { getClubTheme } from '../theme/clubTheme';
import { ClubCrest } from './ClubCrest';
import { COUNTRY_FLAGS } from '../data/countryFlags';
import { getAllCountries } from '../data/teamsDatabase';

type TabType = 'auctions' | 'free_agents' | 'search' | 'offers' | 'contracts';

const POSITION_COLORS: Record<Position, { bg: string; text: string; border: string }> = {
  GOL: { bg: 'bg-amber-950/70', text: 'text-amber-400', border: 'border-amber-700/60' },
  ZAG: { bg: 'bg-blue-950/70', text: 'text-blue-400', border: 'border-blue-700/60' },
  LAT: { bg: 'bg-sky-950/70', text: 'text-sky-400', border: 'border-sky-700/60' },
  VOL: { bg: 'bg-teal-950/70', text: 'text-teal-400', border: 'border-teal-700/60' },
  MEI: { bg: 'bg-emerald-950/70', text: 'text-emerald-400', border: 'border-emerald-700/60' },
  ATA: { bg: 'bg-rose-950/70', text: 'text-rose-400', border: 'border-rose-700/60' },
};

// Ordenação das tabelas do Mercado (Passes Livres, Buscar Jogadores, Contratos do Elenco)
type ContractSortKey = 'name' | 'position' | 'age' | 'strength' | 'salary' | 'marketValue' | 'contractYears';
type FreeAgentSortKey = 'name' | 'position' | 'age' | 'foot' | 'strength' | 'demandedSalary' | 'marketValue';
type SearchSortKey = 'name' | 'club' | 'position' | 'age' | 'strength' | 'marketValue' | 'askingPrice';
const POSITION_ORDER: Position[] = ['GOL', 'LAT', 'ZAG', 'VOL', 'MEI', 'ATA'];

/** Ordena uma cópia da lista: texto por ordem alfabética (pt-BR), números pelo valor. */
function sortByValue<T>(list: T[], value: (item: T) => number | string, asc: boolean): T[] {
  return [...list].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const diff = typeof va === 'string' ? va.localeCompare(vb as string, 'pt-BR') : va - (vb as number);
    return asc ? diff : -diff;
  });
}

/** Cabeçalho clicável: 1º clique ordena, 2º inverte. Mostra a seta da direção atual. */
function SortableTh<K extends string>({ label, sortKey, sort, onSort, className, justify }: {
  label: string;
  sortKey: K;
  sort: { key: K; asc: boolean } | null;
  onSort: (key: K) => void;
  className: string;
  justify: 'justify-start' | 'justify-center' | 'justify-end';
}) {
  const active = sort?.key === sortKey;
  return (
    <th className={className} aria-sort={active ? (sort!.asc ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`w-full inline-flex items-center gap-1 ${justify} uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors ${active ? 'text-slate-100' : ''}`}
      >
        <span>{label}</span>
        {active && (sort!.asc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>
    </th>
  );
}

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
    sellPlayerAuction,
    listPlayerForSale,
    delistPlayerForSale,
    bidOnRoundAuction,
    concludeRoundAuction,
    generateAiOffers, 
    searchPlayers 
  } = useGame();

  const clubTheme = getClubTheme(userClub);

  const [activeTab, setActiveTab] = useState<TabType>('auctions');
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

  const [sellingPlayer, setSellingPlayer] = useState<Player | null>(null);
  const [sellMode, setSellMode] = useState<'auction' | 'list'>('auction');
  const [sellPrice, setSellPrice] = useState<number>(0);

  const [counterOfferModal, setCounterOfferModal] = useState<{
    player: Player;
    years: number;
    demanded: number;
  } | null>(null);

  const [roundBidInputs, setRoundBidInputs] = useState<Record<number, number>>({});

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
    countryId: userClub.countryId || 29,
    division: 'all',
  });

  const availableCountryOptions = useMemo(() => {
    const list = getAllCountries();
    // Exclui Brasil pois já é uma opção dedicada no topo
    return list.filter(c => c.id !== 29);
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const formatMoney = (val: number | undefined | null) => {
    const num = typeof val === 'number' && !isNaN(val) ? val : 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const squadCount = userClub.squad.length;
  const isSquadFull = squadCount >= 30;
  const isSquadAtMin = squadCount <= 16;
  // Para contratar, o elenco precisa ficar abaixo de 30 (alguns clubes já começam acima)
  const playersToFreeUp = Math.max(0, squadCount - 29);
  const squadFullHint = `Elenco cheio (${squadCount}/30). Dispense ou venda ${playersToFreeUp} jogador(es) para abrir vaga.`;

  // Ordenação da tabela de contratos (null = ordem atual do elenco)
  const [contractSort, setContractSort] = useState<{ key: ContractSortKey; asc: boolean } | null>(null);
  const toggleContractSort = (key: ContractSortKey) => {
    sound.playClick();
    setContractSort((prev) =>
      prev && prev.key === key ? { key, asc: !prev.asc } : { key, asc: key === 'name' || key === 'position' }
    );
  };
  const sortedContractsSquad = useMemo(() => {
    if (!contractSort) return userClub.squad;
    const value = (p: Player): number | string => {
      switch (contractSort.key) {
        case 'name': return p.name;
        case 'position': return POSITION_ORDER.indexOf(p.position);
        case 'age': return p.age;
        case 'strength': return p.strength;
        case 'salary': return p.salary;
        case 'marketValue': return p.marketValue;
        case 'contractYears': return p.contractYears ?? 3;
      }
    };
    return sortByValue(userClub.squad, value, contractSort.asc);
  }, [userClub.squad, contractSort]);
  const freeAgentsList = gameState.freeAgents || [];
  const transferOffersList = gameState.transferOffers || [];

  // Filtered Free Agents
  const filteredFreeAgents = useMemo(() => {
    return freeAgentsList.filter((p) => {
      if (faPosition !== 'TODOS' && p.position !== faPosition) return false;
      if (faMinStrength > 0 && p.strength < faMinStrength) return false;
      if (faSearch.trim() && !p.name.toLowerCase().includes(faSearch.toLowerCase().trim())) return false;
      return true;
    });
  }, [freeAgentsList, faPosition, faMinStrength, faSearch]);

  // Ordenação de "Passes Livres" (começa por Força, maior primeiro, como antes)
  const [freeAgentSort, setFreeAgentSort] = useState<{ key: FreeAgentSortKey; asc: boolean } | null>({ key: 'strength', asc: false });
  const toggleFreeAgentSort = (key: FreeAgentSortKey) => {
    sound.playClick();
    setFreeAgentSort((prev) =>
      prev && prev.key === key ? { key, asc: !prev.asc } : { key, asc: key === 'name' || key === 'position' || key === 'foot' }
    );
  };
  const sortedFreeAgents = useMemo(() => {
    if (!freeAgentSort) return filteredFreeAgents;
    const value = (p: Player): number | string => {
      switch (freeAgentSort.key) {
        case 'name': return p.name;
        case 'position': return POSITION_ORDER.indexOf(p.position);
        case 'age': return p.age;
        case 'foot': return p.foot;
        case 'strength': return p.strength;
        case 'demandedSalary': return calculateDemandedSalary(p.salary, p.marketValue);
        case 'marketValue': return p.marketValue;
      }
    };
    return sortByValue(filteredFreeAgents, value, freeAgentSort.asc);
  }, [filteredFreeAgents, freeAgentSort]);

  // Search Results
  const searchResults = useMemo(() => {
    return searchPlayers(searchFilter);
  }, [searchFilter, gameState.clubs, searchPlayers]);

  // Ordenação de "Buscar Jogadores" (começa na ordem da busca)
  const [searchSort, setSearchSort] = useState<{ key: SearchSortKey; asc: boolean } | null>(null);
  const toggleSearchSort = (key: SearchSortKey) => {
    sound.playClick();
    setSearchSort((prev) =>
      prev && prev.key === key ? { key, asc: !prev.asc } : { key, asc: key === 'name' || key === 'club' || key === 'position' }
    );
  };
  const sortedSearchResults = useMemo(() => {
    if (!searchSort) return searchResults;
    const value = (item: MarketSearchResult): number | string => {
      switch (searchSort.key) {
        case 'name': return item.player.name;
        case 'club': return item.clubName;
        case 'position': return POSITION_ORDER.indexOf(item.player.position);
        case 'age': return item.player.age;
        case 'strength': return item.player.strength;
        case 'marketValue': return item.player.marketValue;
        case 'askingPrice': return item.askingPrice;
      }
    };
    return sortByValue(searchResults, value, searchSort.asc);
  }, [searchResults, searchSort]);

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
      setCounterOfferModal(null);
    } else if (res.counterOffer != null) {
      const demandedSalary = typeof res.counterOffer === 'number'
        ? res.counterOffer
        : Number((res.counterOffer as any).demandedSalary ?? (res.counterOffer as any).demanded ?? (res.counterOffer as any)) || 0;
      setCounterOfferModal({
        player: renewingPlayer,
        years: renewingYears,
        demanded: demandedSalary,
      });
      setRenewingSalary(demandedSalary);
    } else {
      showToast('error', res.error || 'Falha ao renovar contrato.');
    }
  };

  // Open Sell Modal
  const handleOpenSell = (player: Player) => {
    setSellingPlayer(player);
    setSellMode('auction');
    setSellPrice(player.marketValue);
    sound.playClick();
  };

  const handleConfirmSell = () => {
    if (!sellingPlayer) return;
    if (sellMode === 'auction') {
      const res = sellPlayerAuction(sellingPlayer.id);
      if (res.success) {
        showToast(
          'success',
          `Leilão concluído! ${sellingPlayer.name} vendido para o ${res.buyerName || 'outro clube'} por ${formatMoney(res.finalBid || 0)}!`
        );
        setSellingPlayer(null);
      } else {
        showToast('error', res.error || 'Falha ao leiloar jogador.');
      }
    } else {
      const res = listPlayerForSale(sellingPlayer.id, sellPrice);
      if (res.success) {
        showToast('success', `${sellingPlayer.name} colocado à venda por ${formatMoney(sellPrice)}.`);
        setSellingPlayer(null);
      } else {
        showToast('error', res.error || 'Falha ao colocar jogador à venda.');
      }
    }
  };

  const handleDelist = (player: Player) => {
    const res = delistPlayerForSale(player.id);
    if (res.success) {
      showToast('success', `${player.name} removido da lista de transferências.`);
    } else {
      showToast('error', res.error || 'Falha ao remover da lista.');
    }
  };

  const handleBidRoundAuction = (auctionId: number, minBid: number) => {
    const amount = roundBidInputs[auctionId] ?? minBid;
    if (amount > userClub.balance) {
      showToast('error', 'Saldo insuficiente para este lance.');
      return;
    }
    const res = bidOnRoundAuction(auctionId, amount);
    if (res.success) {
      showToast('success', `Lance de ${formatMoney(amount)} registrado com sucesso!`);
    } else {
      showToast('error', res.error || 'Falha ao enviar lance.');
    }
  };

  const handleConcludeRoundAuction = (auctionId: number) => {
    if (isSquadFull) {
      showToast('error', 'Seu elenco já atingiu o limite de 30 atletas.');
      return;
    }
    const res = concludeRoundAuction(auctionId);
    if (res.success) {
      showToast('success', 'Leilão concluído com sucesso!');
    } else {
      showToast('error', res.error || 'Falha ao concluir leilão.');
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
            onClick={() => { setActiveTab('auctions'); sound.playClick(); }}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'auctions'
                ? 'border-[var(--app-border-highlight)] text-[var(--app-text-accent)] bg-[var(--app-surface-2)]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[var(--app-surface-2)]/60'
            }`}
          >
            <Gavel className="w-3.5 h-3.5" />
            <span>Leilão da Rodada</span>
            {gameState.roundAuctions && gameState.roundAuctions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-500 text-black font-extrabold font-mono">
                {gameState.roundAuctions.length}
              </span>
            )}
          </button>

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
        {/* Aviso: elenco cheio bloqueia contratações */}
        {isSquadFull && (activeTab === 'free_agents' || activeTab === 'search') && (
          <div
            className="max-w-7xl mx-auto mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-amber-950/60 border border-amber-700/60 text-amber-100"
            data-testid="squad-full-notice"
          >
            <div className="flex items-start gap-2 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-amber-300">Elenco cheio ({squadCount}/30).</strong>{' '}
                Para contratar, o elenco precisa ter menos de 30 jogadores. Dispense ou venda pelo menos{' '}
                <strong className="text-amber-300">{playersToFreeUp}</strong> para abrir vaga.
              </span>
            </div>
            <button
              onClick={() => { setActiveTab('contracts'); sound.playClick(); }}
              className="min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
              data-testid="squad-full-go-contracts"
            >
              Ver contratos do elenco
            </button>
          </div>
        )}

        {/* ================= TAB 0: LEILÃO DA RODADA ================= */}
        {activeTab === 'auctions' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <Gavel className="w-4 h-4 text-emerald-400" />
                  <span>Leilão Oficial de Jogadores da Rodada</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  A cada rodada, clubes com elenco excedente disponibilizam até 5 atletas em leilão aberto (Brasfoot clássico).
                </p>
              </div>
              <div className="text-xs font-mono text-slate-400">
                Rodada <span className="text-white font-bold">{gameState.currentRound}</span>
              </div>
            </div>

            {(!gameState.roundAuctions || gameState.roundAuctions.length === 0) ? (
              <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-12 text-center text-slate-400">
                <Gavel className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                <p className="text-sm font-semibold">Nenhum atleta em leilão nesta rodada.</p>
                <p className="text-xs text-slate-500 mt-1">Avance a rodada para novos atletas irem a leilão.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gameState.roundAuctions.map((item) => {
                  const posStyle = POSITION_COLORS[item.player.position] || POSITION_COLORS.MEI;
                  const isUserLeading = item.highestBidderClubId === userClub.id;
                  const currentInputBid = roundBidInputs[item.id] ?? item.minNextBid;

                  return (
                    <div
                      key={item.id}
                      className={`bg-[var(--app-surface-1)] border rounded-xl p-4 flex flex-col justify-between transition-all ${
                        item.completed
                          ? 'opacity-60 border-[var(--app-border-subtle)]'
                          : isUserLeading
                          ? 'border-emerald-600/80 shadow-md shadow-emerald-950/30'
                          : 'border-[var(--app-border-subtle)] hover:border-[var(--app-border-highlight)]'
                      }`}
                    >
                      <div>
                        {/* Top info: Club seller and status */}
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-slate-400 font-semibold truncate max-w-[160px]">
                            {item.sellerClubName}
                          </span>
                          {item.completed ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              ENCERRADO
                            </span>
                          ) : isUserLeading ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800 animate-pulse">
                              SEU LANCE LIDERA
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/60">
                              EM DISPUTA
                            </span>
                          )}
                        </div>

                        {/* Player Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-sm text-slate-100">{item.player.name}</h3>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {item.player.age} anos • Perna {item.player.foot}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}>
                            {item.player.position}
                          </span>
                        </div>

                        {/* Player Attributes & Values */}
                        <div className="grid grid-cols-3 gap-2 my-3 p-2 rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-center text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">Força</span>
                            <span className="font-mono font-bold text-emerald-400 text-sm">{item.player.strength}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">Salário</span>
                            <span className="font-mono font-medium text-slate-200 text-[11px]">{formatMoney(item.player.salary)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">Avaliação</span>
                            <span className="font-mono font-medium text-slate-300 text-[11px]">{formatMoney(item.player.marketValue)}</span>
                          </div>
                        </div>

                        {/* Current Auction State */}
                        <div className="space-y-1.5 text-xs py-2 border-t border-[var(--app-border-subtle)]">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Lance Atual:</span>
                            <span className="font-mono font-bold text-emerald-400 text-sm">
                              {formatMoney(item.currentBid)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">Maior Oferta:</span>
                            <span className="font-semibold text-slate-300">
                              {item.highestBidderName || 'Nenhum lance'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">Preço Inicial:</span>
                            <span className="font-mono text-slate-400">{formatMoney(item.startingPrice)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Auction Actions */}
                      {!item.completed && (
                        <div className="mt-3 pt-3 border-t border-[var(--app-border-subtle)] space-y-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              step="10000"
                              min={item.minNextBid}
                              value={currentInputBid}
                              onChange={(e) => {
                                const val = Number(e.target.value) || item.minNextBid;
                                setRoundBidInputs((prev) => ({ ...prev, [item.id]: val }));
                              }}
                              className="flex-1 bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-[var(--app-text-accent)] text-xs font-mono font-bold rounded px-2.5 py-1.5 focus:outline-none focus:border-[var(--app-border-highlight)]"
                            />
                            <button
                              disabled={isSquadFull || currentInputBid < item.minNextBid || currentInputBid > userClub.balance}
                              onClick={() => handleBidRoundAuction(item.id, item.minNextBid)}
                              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                                isSquadFull || currentInputBid < item.minNextBid || currentInputBid > userClub.balance
                                  ? 'opacity-40 bg-slate-800 text-slate-500 cursor-not-allowed'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-black shadow cursor-pointer'
                              }`}
                            >
                              Dar Lance
                            </button>
                          </div>
                          <button
                            disabled={isSquadFull}
                            onClick={() => handleConcludeRoundAuction(item.id)}
                            className={`w-full py-1.5 rounded text-xs font-semibold border transition-all ${
                              isSquadFull
                                ? 'opacity-40 bg-slate-800 text-slate-500 border-transparent cursor-not-allowed'
                                : 'bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border-[var(--app-border-subtle)] text-slate-300 hover:text-white cursor-pointer'
                            }`}
                          >
                            Finalizar Leilão
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
                    <SortableTh label="Nome" sortKey="name" sort={freeAgentSort} onSort={toggleFreeAgentSort} className="py-2.5 px-3" justify="justify-start" />
                    <SortableTh label="Pos" sortKey="position" sort={freeAgentSort} onSort={toggleFreeAgentSort} className="py-2.5 px-2 text-center" justify="justify-center" />
                    <SortableTh label="Idade" sortKey="age" sort={freeAgentSort} onSort={toggleFreeAgentSort} className="py-2.5 px-2 text-center" justify="justify-center" />
                    <SortableTh label="Perna" sortKey="foot" sort={freeAgentSort} onSort={toggleFreeAgentSort} className="py-2.5 px-2 text-center" justify="justify-center" />
                    <SortableTh label="Força" sortKey="strength" sort={freeAgentSort} onSort={toggleFreeAgentSort} className="py-2.5 px-3 text-center" justify="justify-center" />
                    <SortableTh label="Salário Pedido" sortKey="demandedSalary" sort={freeAgentSort} onSort={toggleFreeAgentSort} className="py-2.5 px-3 text-right" justify="justify-end" />
                    <SortableTh label="Valor Mercado" sortKey="marketValue" sort={freeAgentSort} onSort={toggleFreeAgentSort} className="py-2.5 px-3 text-right" justify="justify-end" />
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
                    sortedFreeAgents.map((p) => {
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
                              title={isSquadFull ? squadFullHint : undefined}
                              onClick={() => handleOpenSign(p)}
                              style={!isSquadFull ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent } : undefined}
                              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                isSquadFull
                                  ? 'bg-[var(--app-surface-2)] text-slate-500 border border-transparent cursor-not-allowed'
                                  : 'shadow hover:brightness-110 active:scale-95'
                              }`}
                            >
                              {isSquadFull ? 'Elenco cheio' : 'Contratar'}
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
                {/* País */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">País:</span>
                  <select
                    value={searchFilter.countryId ?? (userClub.countryId || 29)}
                    onChange={(e) => setSearchFilter({ ...searchFilter, countryId: Number(e.target.value) })}
                    className="w-full lg:w-auto bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-[var(--app-border-highlight)]"
                  >
                    <option value={0}>Todos os Países</option>
                    <option value={29}>🇧🇷 Brasil</option>
                    {availableCountryOptions.map(c => (
                      <option key={c.id} value={c.id}>
                        {COUNTRY_FLAGS[c.id] || '🌐'} {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Divisão */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">Divisão:</span>
                  <select
                    value={searchFilter.division ?? 'all'}
                    onChange={(e) => setSearchFilter({ ...searchFilter, division: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
                    className="w-full lg:w-auto bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-[var(--app-border-highlight)]"
                  >
                    <option value="all">Todas as Divisões</option>
                    <option value={1}>Série A (Elite)</option>
                    <option value={2}>Série B</option>
                    <option value={3}>Série C</option>
                    <option value={4}>Série D</option>
                    <option value={5}>Estaduais / Acesso</option>
                  </select>
                </div>

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
                  onClick={() => setSearchFilter({ position: 'TODOS', minStrength: 50, maxStrength: 100, minAge: 17, maxAge: 40, nameQuery: '', countryId: userClub.countryId || 29, division: 'all' })}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 cursor-pointer underline text-center sm:text-right"
                >
                  Limpar
                </button>
              </div>

              {/* Informações da busca */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[var(--app-border-subtle)]">
                <span>
                  Encontrados <strong className="text-[var(--app-text-accent)] font-mono-numbers">{sortedSearchResults.length}</strong> jogadores
                </span>
                <span className="text-[10px] text-slate-500">
                  Ordenado por força técnica decrescente
                </span>
              </div>
            </div>

            {/* Results Table */}
            <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg overflow-x-auto shadow">
              <table className="w-full text-left text-xs text-slate-300 min-w-[680px] md:min-w-0">
                <thead className="bg-[var(--app-surface-2)] text-slate-400 text-[11px] uppercase tracking-wider border-b border-[var(--app-border-subtle)]">
                  <tr>
                    <SortableTh label="Atleta" sortKey="name" sort={searchSort} onSort={toggleSearchSort} className="py-2.5 px-3" justify="justify-start" />
                    <SortableTh label="Clube Atual" sortKey="club" sort={searchSort} onSort={toggleSearchSort} className="py-2.5 px-3" justify="justify-start" />
                    <SortableTh label="Pos" sortKey="position" sort={searchSort} onSort={toggleSearchSort} className="py-2.5 px-2 text-center" justify="justify-center" />
                    <SortableTh label="Idade" sortKey="age" sort={searchSort} onSort={toggleSearchSort} className="py-2.5 px-2 text-center" justify="justify-center" />
                    <SortableTh label="Força" sortKey="strength" sort={searchSort} onSort={toggleSearchSort} className="py-2.5 px-3 text-center" justify="justify-center" />
                    <SortableTh label="Valor Mercado" sortKey="marketValue" sort={searchSort} onSort={toggleSearchSort} className="py-2.5 px-3 text-right" justify="justify-end" />
                    <SortableTh label="Preço Pedido" sortKey="askingPrice" sort={searchSort} onSort={toggleSearchSort} className="py-2.5 px-3 text-right" justify="justify-end" />
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
                    sortedSearchResults.map((item) => {
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
                              title={isSquadFull ? squadFullHint : undefined}
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
                              {isSquadFull ? 'Elenco cheio' : 'Comprar'}
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
                    <SortableTh label="Atleta" sortKey="name" sort={contractSort} onSort={toggleContractSort} className="py-2.5 px-3" justify="justify-start" />
                    <SortableTh label="Pos" sortKey="position" sort={contractSort} onSort={toggleContractSort} className="py-2.5 px-2 text-center" justify="justify-center" />
                    <SortableTh label="Idade" sortKey="age" sort={contractSort} onSort={toggleContractSort} className="py-2.5 px-2 text-center" justify="justify-center" />
                    <SortableTh label="Força" sortKey="strength" sort={contractSort} onSort={toggleContractSort} className="py-2.5 px-3 text-center" justify="justify-center" />
                    <SortableTh label="Salário Atual" sortKey="salary" sort={contractSort} onSort={toggleContractSort} className="py-2.5 px-3 text-right" justify="justify-end" />
                    <SortableTh label="Valor Mercado" sortKey="marketValue" sort={contractSort} onSort={toggleContractSort} className="py-2.5 px-3 text-right" justify="justify-end" />
                    <SortableTh label="Contrato Restante" sortKey="contractYears" sort={contractSort} onSort={toggleContractSort} className="py-2.5 px-3 text-center" justify="justify-center" />
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#173022]">
                  {sortedContractsSquad.map((p) => {
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
                          {p.listedForSale && (
                            <span className="text-[10px] text-amber-400 bg-amber-950/70 border border-amber-800/60 px-1 rounded">
                              À VENDA
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
                            {p.listedForSale ? (
                              <button
                                onClick={() => handleDelist(p)}
                                className="px-2 py-1 rounded text-xs font-semibold bg-amber-950/70 border border-amber-800 text-amber-300 hover:bg-amber-900 transition-all cursor-pointer"
                                title="Remover da lista de transferências"
                              >
                                À Venda
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenSell(p)}
                                className="px-2 py-1 rounded text-xs font-semibold bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-300 hover:text-white hover:border-[var(--app-border-highlight)] transition-all cursor-pointer"
                                title="Vender em leilão ou colocar à venda"
                              >
                                Vender
                              </button>
                            )}
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

      {/* ================= MODAL: SELL PLAYER ================= */}
      {sellingPlayer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--app-border-subtle)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Vender Atleta</h3>
                <p className="text-xs text-slate-400">Escolha como negociar o jogador</p>
              </div>
              <button 
                onClick={() => setSellingPlayer(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Player Info */}
            <div className="bg-[var(--app-surface-2)] p-3 rounded-lg flex items-center justify-between border border-[var(--app-border-subtle)]">
              <div>
                <div className="font-bold text-sm text-slate-100">{sellingPlayer.name}</div>
                <div className="text-xs text-slate-400 font-mono">
                  {sellingPlayer.age} anos • {sellingPlayer.position} • Força {sellingPlayer.strength}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Valor de Mercado</span>
                <div className="text-xs font-bold font-mono text-emerald-400">{formatMoney(sellingPlayer.marketValue)}</div>
              </div>
            </div>

            {/* Rescission penalty warning if remaining contract */}
            {((sellingPlayer.contractYears ?? 3) > 0) && (
              <div className="bg-amber-950/40 border border-amber-800/60 rounded p-2.5 text-xs text-amber-300 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  <strong>Multa rescisória / indenização:</strong> Por regulamento (Brasfoot), 
                  {' '}{Math.round(calculateRescissionPenalty(sellingPlayer.contractYears ?? 3) * 100)}% 
                  do valor da venda será retido como indenização contratual ao atleta.
                </span>
              </div>
            )}

            {/* Mode selection: Auction vs Listing */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Método de Venda:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSellMode('auction')}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    sellMode === 'auction'
                      ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                      : 'bg-[var(--app-surface-2)] border-[var(--app-border-subtle)] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold text-xs">
                    <Gavel className="w-4 h-4" />
                    <span>Leilão Imediato</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Venda instantânea! Clubes da CPU disputam lances imediatos pelo atleta.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSellMode('list')}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    sellMode === 'list'
                      ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                      : 'bg-[var(--app-surface-2)] border-[var(--app-border-subtle)] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold text-xs">
                    <Tag className="w-4 h-4" />
                    <span>Colocar à Venda</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Define um preço fixo. Outros clubes podem enviar propostas a cada rodada.
                  </p>
                </button>
              </div>
            </div>

            {/* Price input if listing */}
            {sellMode === 'list' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Preço Pedido:</label>
                <input
                  type="number"
                  step="10000"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-[var(--app-text-accent)] text-sm font-mono font-bold rounded px-3 py-2 focus:outline-none focus:border-[var(--app-border-highlight)]"
                />
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setSellingPlayer(null)}
                className="flex-1 py-2 rounded text-xs font-semibold bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] text-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSell}
                className="flex-1 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-black shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                {sellMode === 'auction' ? 'Iniciar Leilão' : 'Confirmar Anúncio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: COUNTER OFFER ================= */}
      {counterOfferModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--app-border-subtle)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Contraproposta Salarial</h3>
                <p className="text-xs text-amber-400">O jogador exige melhores condições</p>
              </div>
              <button 
                onClick={() => setCounterOfferModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[var(--app-surface-2)] p-3 rounded-lg border border-[var(--app-border-subtle)] text-xs text-slate-200 space-y-2">
              <p>
                <strong>{counterOfferModal.player.name}</strong> recusou a oferta inicial de renovação.
              </p>
              <div className="flex justify-between items-center py-1 border-t border-[var(--app-border-subtle)]">
                <span className="text-slate-400">Salário Exigido:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {formatMoney(counterOfferModal.demanded)}/mês
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-[var(--app-border-subtle)]">
                <span className="text-slate-400">Prazo Solicitado:</span>
                <span className="font-mono font-bold text-slate-100">
                  {counterOfferModal.years} {counterOfferModal.years === 1 ? 'ano' : 'anos'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {(counterOfferModal.player.contractYears ?? 3) === 0
                ? 'Como o contrato atual encerra nesta temporada, caso a negociação seja encerrada, o jogador será automaticamente vendido em leilão regulamentar.'
                : 'Você pode aceitar as exigências do atleta ou tentar negociar novamente mais tarde.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => {
                  if ((counterOfferModal.player.contractYears ?? 3) === 0) {
                    const res = sellPlayerAuction(counterOfferModal.player.id);
                    if (res.success) {
                      showToast('success', `Contrato expirado: ${counterOfferModal.player.name} foi leiloado para ${res.buyerName} por ${formatMoney(res.finalBid || 0)}.`);
                    }
                  }
                  setCounterOfferModal(null);
                  setRenewingPlayer(null);
                }}
                className="flex-1 py-2 rounded text-xs font-semibold bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] text-slate-300 transition-colors cursor-pointer"
              >
                {(counterOfferModal.player.contractYears ?? 3) === 0 ? 'Recusar e Leiloar' : 'Recusar'}
              </button>
              <button
                onClick={() => {
                  const res = renewContract(counterOfferModal.player.id, counterOfferModal.years, counterOfferModal.demanded);
                  if (res.success) {
                    showToast('success', `Contrato renovado com sucesso nos termos do atleta!`);
                    setCounterOfferModal(null);
                    setRenewingPlayer(null);
                  } else {
                    showToast('error', res.error || 'Falha ao renovar contrato.');
                  }
                }}
                className="flex-1 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-black shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                Aceitar Contraproposta
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
