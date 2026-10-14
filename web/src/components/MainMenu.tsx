import React, { useState, useMemo } from 'react';
import { useGame } from '../state/GameContext';
import { 
  Play, 
  FolderOpen, 
  Settings, 
  Save, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Check, 
  Search, 
  ArrowLeft,
  Shield,
  Award,
  Zap,
  Globe,
  Star,
  MapPin,
  Trophy,
  Sliders,
  Users,
  Sparkles,
  Heart,
  Info,
  Bug,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
  Menu as MenuIcon
} from 'lucide-react';
import { sound } from '../audio/soundEngine';
import { TeamEditorScreen } from './TeamEditorScreen';
import { ClubCrest } from './ClubCrest';
import { 
  getAllClubs, 
  getAllCountries, 
  getAllLeagues, 
  getAllStates, 
  getClubsByLeague,
  getClubById,
  registerClubs,
  registerCountries,
  registerLeagues
} from '../data/teamsDatabase';
import { getLeaguesMeta, loadClubsForActiveCountries, loadLeagueBundle, LeaguesMeta } from '../data/leagueBundleLoader';
import { getCountryFlag, POPULAR_COUNTRIES } from '../data/countryFlags';
import { AutoSaveMode, Club } from '../types';
import { getClubTheme, deriveClubAtmosphere } from '../theme/clubTheme';

export const MainMenu: React.FC = () => {
  const { 
    gameState, 
    userClub,
    hasActiveCareer,
    setScreen, 
    startNewGame, 
    loadGame, 
    saveGame, 
    deleteSave, 
    saveSlots, 
    updateOptions,
    isWasmEngine,
    rustVersion
  } = useGame();

  // 'hub' = menu inicial só com a lista de opções; as demais são as seções existentes
  type MenuTab = 'hub' | 'new_game' | 'load_game' | 'options' | 'editor' | 'credits';
  const [activeTab, setActiveTab] = useState<MenuTab>('hub');
  const [editorDirty, setEditorDirty] = useState(false);
  const changeTab = (tab: MenuTab) => {
    if (activeTab === 'editor' && tab !== 'editor' && editorDirty && !window.confirm('Há alterações não salvas. Sair do editor?')) return;
    setEditorDirty(false);
    sound.playClick();
    setActiveTab(tab);
  };
  const returnToGame = () => {
    if (activeTab === 'editor' && editorDirty && !window.confirm('Há alterações não salvas. Sair do editor?')) return;
    setScreen('overview');
  };
  
  // New Game settings
  const [managerName, setManagerName] = useState(gameState.managerName || 'Alex Chagas');
  const [selectedCountryId, setSelectedCountryId] = useState<number>(29); // Brasil
  const [selectedDivision, setSelectedDivision] = useState<number | 'all'>(1); // Série A
  const [selectedStateCode, setSelectedStateCode] = useState<string>('all');
  const [selectedClubId, setSelectedClubId] = useState<number>(gameState.userClubId || 255); // Flamengo
  const [searchFilter, setSearchFilter] = useState('');
  const [activeCountryIds, setActiveCountryIds] = useState<number[]>([29]); // Brasil padrão (1 a 5 países suportados)
  const [isStartingGame, setIsStartingGame] = useState<boolean>(false);
  const [leaguesMeta, setLeaguesMeta] = useState<LeaguesMeta | null>(null);
  const [loadedBundleVersion, setLoadedBundleVersion] = useState<number>(0);

  // In-game simulation options
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 5>(gameState.options.simSpeed || 2);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(gameState.options.soundEnabled ?? true);
  const [autoPauseOnGoal, setAutoPauseOnGoal] = useState<boolean>(gameState.options.autoPauseOnGoal ?? false);

  // Save/Load tab state
  const [saveTitle, setSaveTitle] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  // Floating feedback toast notification
  const [toast, setToast] = useState<{ type: 'warning' | 'error' | 'info' | 'success'; message: string } | null>(null);
  const showToast = (type: 'warning' | 'error' | 'info' | 'success', message: string) => {
    setToast({ type, message });
  };

  React.useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Pre-load lightweight league metadata index for snappy UI
  React.useEffect(() => {
    let mounted = true;
    getLeaguesMeta().then((meta) => {
      if (mounted && meta) {
        setLeaguesMeta(meta);
        if (meta.countries && meta.countries.length > 0) registerCountries(meta.countries);
        if (meta.leagues && meta.leagues.length > 0) registerLeagues(meta.leagues);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Database collections (with fallback to bundled static db)
  const allClubs = useMemo(() => {
    if (leaguesMeta && leaguesMeta.clubsIndex && leaguesMeta.clubsIndex.length > 0) {
      return leaguesMeta.clubsIndex as unknown as Club[];
    }
    return getAllClubs();
  }, [leaguesMeta]);

  const allCountries = useMemo(() => {
    if (leaguesMeta && leaguesMeta.countries && leaguesMeta.countries.length > 0) {
      return leaguesMeta.countries;
    }
    return getAllCountries();
  }, [leaguesMeta]);

  const allStates = useMemo(() => {
    if (leaguesMeta && leaguesMeta.states && leaguesMeta.states.length > 0) {
      return leaguesMeta.states;
    }
    return getAllStates();
  }, [leaguesMeta]);

  const allLeagues = useMemo(() => {
    if (leaguesMeta && leaguesMeta.leagues && leaguesMeta.leagues.length > 0) {
      return leaguesMeta.leagues;
    }
    return getAllLeagues();
  }, [leaguesMeta]);

  // Leagues for currently selected country
  const countryLeagues = useMemo(() => {
    return allLeagues.filter((l) => l.countryId === selectedCountryId);
  }, [allLeagues, selectedCountryId]);

  // Filtered clubs for selection list
  const filteredClubs = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();

    // Global search if query is 2+ chars
    if (query.length >= 2) {
      return allClubs
        .filter((c) =>
          c.name.toLowerCase().includes(query) ||
          c.stadium.toLowerCase().includes(query) ||
          (c.stateName && c.stateName.toLowerCase().includes(query)) ||
          (c.stateCode && c.stateCode.toLowerCase().includes(query)) ||
          c.coach.toLowerCase().includes(query)
        )
        .sort((a, b) => b.reputation - a.reputation || a.name.localeCompare(b.name));
    }

    let list: Club[] = [];

    if (selectedCountryId === 29) {
      // Brazil
      if (selectedDivision === 'all') {
        list = allClubs.filter((c) => c.countryId === 29);
      } else {
        const league = countryLeagues.find((l) => l.division === selectedDivision);
        if (league && league.clubIds && league.clubIds.length > 0) {
          const clubIdSet = new Set(league.clubIds);
          list = allClubs.filter((c) => clubIdSet.has(c.id));
        } else {
          list = allClubs.filter((c) => c.countryId === 29 && c.division === selectedDivision);
        }
      }

      // State sub-filter
      if (selectedStateCode !== 'all') {
        list = list.filter((c) => c.stateCode === selectedStateCode);
      }
    } else {
      // Other countries
      if (selectedDivision === 'all') {
        list = allClubs.filter((c) => c.countryId === selectedCountryId);
      } else {
        const league = countryLeagues.find((l) => l.division === selectedDivision);
        if (league && league.clubIds && league.clubIds.length > 0) {
          const clubIdSet = new Set(league.clubIds);
          list = allClubs.filter((c) => clubIdSet.has(c.id));
        } else {
          list = allClubs.filter((c) => c.countryId === selectedCountryId && c.division === selectedDivision);
        }
        if (list.length === 0) {
          list = allClubs.filter((c) => c.countryId === selectedCountryId);
        }
      }
    }

    return list.sort((a, b) => b.reputation - a.reputation || a.name.localeCompare(b.name));
  }, [allClubs, countryLeagues, selectedCountryId, selectedDivision, selectedStateCode, searchFilter, activeTab]);

  // Selected Club details (prioritize currently filtered list of the selected country)
  const selectedClub = useMemo(() => {
    const base = (
      filteredClubs.find((c) => c.id === selectedClubId) ||
      filteredClubs[0] ||
      allClubs.find((c) => c.id === selectedClubId) ||
      allClubs[0]
    );
    if (!base) return base;
    const full = getClubById(base.id);
    if (full && full.squad && full.squad.length > 0) {
      return { ...base, ...full, squad: full.squad };
    }
    return base;
  }, [selectedClubId, filteredClubs, allClubs, activeTab, loadedBundleVersion]);

  // Ensure full squad is loaded into memory for the selected club
  React.useEffect(() => {
    if (!selectedClub?.id) return;
    const full = getClubById(selectedClub.id);
    if (!full || !full.squad || full.squad.length === 0) {
      const item = leaguesMeta?.clubsIndex?.find((c) => c.id === selectedClub.id);
      const bundleKey = item?.bundleKey || (selectedClub.countryId === 29 ? 'brazil' : undefined);
      if (bundleKey) {
        loadLeagueBundle(bundleKey).then((clubs) => {
          registerClubs(clubs);
          setLoadedBundleVersion((v) => v + 1);
        });
      }
    }
  }, [selectedClub?.id, leaguesMeta]);

  const selectedClubTheme = useMemo(() => getClubTheme(selectedClub), [selectedClub]);
  const selectedClubAtmosphere = useMemo(() => deriveClubAtmosphere(selectedClub), [selectedClub]);

  // Average strength of starter squad (top 11)
  const selectedClubAvgStrength = useMemo(() => {
    if (!selectedClub.squad || selectedClub.squad.length === 0) {
      return Math.round(50 + (selectedClub.level || 10) * 1.8);
    }
    const starters = selectedClub.squad.filter((p) => p.isStarter);
    const pool = starters.length === 11 ? starters : selectedClub.squad.slice(0, 11);
    if (pool.length === 0) return 70;
    return Math.round(pool.reduce((acc, p) => acc + p.strength, 0) / pool.length);
  }, [selectedClub]);

  // Start new career with multi-league dynamic loading
  const handleStartGame = async () => {
    sound.playWhistle();
    setIsStartingGame(true);
    try {
      // Ensure primary league is always included
      const activeIds = Array.from(new Set([selectedClub.countryId || selectedCountryId, ...activeCountryIds]));
      const loadedClubs = await loadClubsForActiveCountries(activeIds);
      registerClubs(loadedClubs);
      startNewGame(
        selectedClub.id,
        managerName.trim() || 'Alex Chagas',
        {
          simSpeed,
          soundEnabled,
          autoPauseOnGoal,
        },
        activeIds,
        loadedClubs
      );
      setScreen('overview');
    } catch (err) {
      console.warn('Fallback starting game without extra bundles:', err);
      startNewGame(
        selectedClub.id,
        managerName.trim() || 'Alex Chagas',
        {
          simSpeed,
          soundEnabled,
          autoPauseOnGoal,
        },
        activeCountryIds
      );
      setScreen('overview');
    } finally {
      setIsStartingGame(false);
    }
  };

  // Com carreira em andamento, pede confirmação antes de substituí-la
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState<boolean>(false);
  const requestStartGame = () => {
    if (hasActiveCareer) {
      setConfirmReplaceOpen(true);
      return;
    }
    handleStartGame();
  };

  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleSaveCurrent = async () => {
    setSaveStatus(null);
    const res = await saveGame(saveTitle.trim() || undefined);
    if (res.success) {
      setSaveTitle('');
      setSaveStatus({ type: 'success', message: 'Jogo salvo com sucesso no navegador!' });
      setTimeout(() => setSaveStatus(null), 4000);
    } else {
      setSaveStatus({ type: 'error', message: res.error || 'Erro ao salvar o jogo.' });
    }
  };

  const handleLoadSlot = async (slotId: string) => {
    setLoadError(null);
    const res = await loadGame(slotId);
    if (res.success) {
      setScreen('overview');
    } else {
      setLoadError(res.error || 'Falha ao carregar o save selecionado.');
    }
  };

  const handleCountryChange = (cid: number) => {
    sound.playClick();
    setSelectedCountryId(cid);
    setSelectedDivision(1);
    setSelectedStateCode('all');

    // Automatically ensure the selected primary country is active
    if (!activeCountryIds.includes(cid)) {
      if (activeCountryIds.length === 1) {
        setActiveCountryIds([cid]);
      } else if (activeCountryIds.length >= 5) {
        setActiveCountryIds([cid, ...activeCountryIds.slice(0, 4)]);
      } else {
        setActiveCountryIds([cid, ...activeCountryIds]);
      }
    }

    // Pre-select first club of this country
    const firstClub = allClubs.find((c) => c.countryId === cid);
    if (firstClub) {
      setSelectedClubId(firstClub.id);
    }
  };

  const toggleActiveCountry = (cid: number) => {
    sound.playClick();
    if (activeCountryIds.includes(cid)) {
      if (cid === selectedCountryId) {
        showToast('info', 'A liga principal do seu clube de largada não pode ser desmarcada.');
        return; // Primary league cannot be deselected
      }
      if (activeCountryIds.length <= 1) {
        showToast('warning', 'Pelo menos 1 liga ativa deve permanecer selecionada.');
        return;
      }
      setActiveCountryIds((prev) => prev.filter((id) => id !== cid));
    } else {
      if (activeCountryIds.length >= 5) {
        showToast('warning', 'Máximo de 5 ligas ativas simultâneas permitido.');
        return;
      }
      setActiveCountryIds((prev) => [...prev, cid]);
    }
  };

  const handleDivisionChange = (div: number | 'all') => {
    sound.playClick();
    setSelectedDivision(div);
  };

  // Popular quick countries list with authentic emoji flags
  const popularCountries = useMemo(() => POPULAR_COUNTRIES, []);

  // Primary countries list: includes popular list plus currently selected country if not in popular
  const visiblePrimaryCountries = useMemo(() => {
    const list = [...popularCountries];
    if (!list.some((c) => c.id === selectedCountryId)) {
      const custom = allCountries.find((c) => c.id === selectedCountryId);
      if (custom) {
        list.push({ id: custom.id, name: custom.name, flag: getCountryFlag(custom.id) });
      }
    }
    return list;
  }, [popularCountries, allCountries, selectedCountryId]);

  return (
    <div className="flex-1 flex flex-col bg-[#09120e] text-slate-100 select-none overflow-hidden h-full relative">
      {/* Confirmação antes de substituir a carreira ativa */}
      {confirmReplaceOpen && hasActiveCareer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-replace-title"
          data-testid="confirm-replace-career"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-sm rounded-lg border border-[#2b5941] bg-[#0d1a14] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <h2 id="confirm-replace-title" className="text-sm font-extrabold text-white">
                Substituir carreira atual?
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              Você tem uma carreira em andamento ({userClub.name}, Rodada {gameState.currentRound}).
              Começar um novo jogo vai substituí-la. Para continuar com ela depois, salve antes em{' '}
              <strong className="text-emerald-300">Salvar / Carregar</strong>.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => setConfirmReplaceOpen(false)}
                className="min-h-[44px] px-4 rounded border border-[#2b5941] text-xs font-bold text-slate-200 hover:bg-[#152e22] cursor-pointer"
                data-testid="confirm-replace-cancel"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setConfirmReplaceOpen(false);
                  handleStartGame();
                }}
                className="min-h-[44px] px-4 rounded bg-amber-500 hover:bg-amber-400 text-xs font-black text-black cursor-pointer"
                data-testid="confirm-replace-accept"
              >
                Começar novo jogo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Feedback Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="mainmenu-toast"
          className="fixed top-16 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg border shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2"
          style={{
            backgroundColor:
              toast.type === 'warning'
                ? 'rgba(41, 26, 7, 0.95)'
                : toast.type === 'error'
                ? 'rgba(45, 11, 14, 0.95)'
                : 'rgba(9, 28, 19, 0.95)',
            borderColor:
              toast.type === 'warning'
                ? 'rgba(217, 119, 6, 0.7)'
                : toast.type === 'error'
                ? 'rgba(225, 29, 72, 0.7)'
                : 'rgba(16, 185, 129, 0.7)',
            color:
              toast.type === 'warning'
                ? '#fef3c7'
                : toast.type === 'error'
                ? '#ffe4e6'
                : '#d1fae5',
          }}
        >
          {toast.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5 rounded"
            aria-label="Fechar notificação"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner with Brand and Return Button */}
      <div className="h-14 bg-[#0d1a14] border-b border-[#1b3629] px-3 sm:px-6 flex items-center justify-between gap-2 shadow-md shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center font-digital font-black text-black text-lg shadow">
            CM
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm sm:text-base font-extrabold tracking-wider uppercase text-emerald-400">
              Champs Manager <span className="text-white text-xs font-normal">2026</span>
            </h1>
            <p className="hidden sm:block text-[10px] text-slate-400">O Clássico Gerenciador de Futebol • Base Real de 703 Clubes</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
        {/* Volta para o menu inicial (hub) a partir de qualquer seção */}
        {activeTab !== 'hub' && (
          <button
            onClick={() => changeTab('hub')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#12231a] hover:bg-[#1b3d2d] text-slate-200 border border-[#2b5941] rounded text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            data-testid="back-to-menu-btn"
          >
            <MenuIcon className="w-3.5 h-3.5" />
            <span>Menu</span>
          </button>
        )}

        {/* Continue playing button if career is running */}
        {hasActiveCareer && (
          <button
            onClick={returnToGame}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#152e22] hover:bg-[#1b3d2d] text-emerald-300 border border-[#2b5941] rounded text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            data-testid="return-to-game-header-btn"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span><span className="hidden sm:inline">Voltar ao </span>Jogo</span>
          </button>
        )}
        </div>
      </div>

      {activeTab === 'hub' ? (
      <div className="flex-1 overflow-y-auto px-4 py-6 flex items-start md:items-center justify-center">
        {/* MENU HUB START */}
        <nav aria-label="Menu principal" className="w-full max-w-sm space-y-3" data-testid="main-menu-hub">
          {/* Ação principal: continuar a carreira ativa ou começar um jogo novo */}
          {hasActiveCareer ? (
            <button
              onClick={returnToGame}
              className="w-full min-h-[44px] flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black shadow-lg transition-colors cursor-pointer"
              data-testid="hub-continue-career"
            >
              <span className="flex items-center gap-3 min-w-0 text-left">
                <Play className="w-5 h-5 fill-current shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-black">Continuar carreira</span>
                  <span className="block text-[11px] font-semibold text-emerald-950 truncate">
                    {userClub.name} · {gameState.seasonYear} · Rodada {gameState.currentRound}
                  </span>
                </span>
              </span>
              <ClubCrest club={userClub} size="sm" />
            </button>
          ) : (
            <button
              onClick={() => changeTab('new_game')}
              className="w-full min-h-[44px] flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black text-sm font-black shadow-lg transition-colors cursor-pointer"
              data-testid="hub-new-game-primary"
            >
              <Play className="w-5 h-5 fill-current shrink-0" />
              <span>Novo jogo</span>
            </button>
          )}

          {/* Seções principais */}
          <div className="rounded-lg border border-[#1b3629] bg-[#0d1a14] divide-y divide-[#1b3629] overflow-hidden">
            {hasActiveCareer && (
              <button
                onClick={() => changeTab('new_game')}
                className="w-full min-h-[44px] flex items-center gap-3 px-4 text-sm font-bold text-slate-200 hover:bg-[#152e22] hover:text-white transition-colors cursor-pointer text-left"
              >
                <Play className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Novo jogo</span>
              </button>
            )}
            <button
              onClick={() => changeTab('load_game')}
              className="w-full min-h-[44px] flex items-center gap-3 px-4 text-sm font-bold text-slate-200 hover:bg-[#152e22] hover:text-white transition-colors cursor-pointer text-left"
            >
              <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Salvar / Carregar</span>
            </button>
            <button
              onClick={() => changeTab('editor')}
              className="w-full min-h-[44px] flex items-center gap-3 px-4 text-sm font-bold text-slate-200 hover:bg-[#152e22] hover:text-white transition-colors cursor-pointer text-left"
            >
              <Users className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Editor de equipes</span>
            </button>
            <button
              onClick={() => changeTab('options')}
              className="w-full min-h-[44px] flex items-center gap-3 px-4 text-sm font-bold text-slate-200 hover:bg-[#152e22] hover:text-white transition-colors cursor-pointer text-left"
            >
              <Settings className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Opções & áudio</span>
            </button>
          </div>

          {/* Ações secundárias, menores */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => changeTab('credits')}
              className="min-h-[44px] flex items-center justify-center gap-2 px-3 rounded-lg border border-[#1b3629] text-xs font-bold text-slate-300 hover:bg-[#152e22] hover:text-white transition-colors cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Créditos</span>
            </button>
            <button
              onClick={() => {
                sound.playClick();
                window.dispatchEvent(new CustomEvent('champs:open-bug-report'));
              }}
              className="min-h-[44px] flex items-center justify-center gap-2 px-3 rounded-lg border border-[#1b3629] text-xs font-bold text-emerald-400 hover:bg-emerald-950/60 transition-colors cursor-pointer"
            >
              <Bug className="w-3.5 h-3.5 shrink-0" />
              <span>Reportar bug</span>
            </button>
          </div>
        </nav>
        {/* MENU HUB END */}
      </div>
      ) : (
      /* Main Content Layout */
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Mobile Navigation Tabs Bar (< md) */}
        <div className="flex md:hidden bg-[var(--app-surface-1)] border-b border-[var(--app-border-subtle)] px-2.5 py-2 overflow-x-auto no-scrollbar shrink-0 gap-1.5 items-center">
          <button
            onClick={() => changeTab('new_game')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              activeTab === 'new_game'
                ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                : 'bg-[#12231a] text-slate-300 border border-[#1e3c2d]'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Novo Jogo</span>
          </button>
          <button
            onClick={() => changeTab('load_game')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              activeTab === 'load_game'
                ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                : 'bg-[#12231a] text-slate-300 border border-[#1e3c2d]'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Salvar / Carregar</span>
          </button>
          <button
            onClick={() => changeTab('editor')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                : 'bg-[#12231a] text-slate-300 border border-[#1e3c2d]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>
          <button
            onClick={() => changeTab('options')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              activeTab === 'options'
                ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                : 'bg-[#12231a] text-slate-300 border border-[#1e3c2d]'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Opções</span>
          </button>
          <button
            onClick={() => changeTab('credits')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              activeTab === 'credits'
                ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                : 'bg-[#12231a] text-slate-300 border border-[#1e3c2d]'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Créditos</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              window.dispatchEvent(new CustomEvent('champs:open-bug-report'));
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 shrink-0 cursor-pointer"
          >
            <Bug className="w-3.5 h-3.5" />
            <span>Feedback</span>
          </button>
        </div>

        {/* Mobile Continue Career Banner (< md) */}
        {hasActiveCareer && (
          <div className="md:hidden px-3 pt-2">
            <button
              onClick={returnToGame}
              className="w-full flex items-center justify-between p-2.5 bg-gradient-to-r from-emerald-900/90 via-emerald-800 to-teal-900 border border-emerald-500/50 text-white rounded-lg text-xs font-black shadow-md cursor-pointer"
              data-testid="continue-career-mobile-btn"
            >
              <div className="flex items-center space-x-2 truncate">
                <Play className="w-4 h-4 fill-emerald-300 text-emerald-300 shrink-0 animate-pulse" />
                <div className="truncate text-left">
                  <div className="font-extrabold text-xs">Continuar Carreira Ativa</div>
                  <div className="text-[10px] text-emerald-200 truncate">
                    {userClub.name} · {gameState.seasonYear} · Rodada {gameState.currentRound}
                  </div>
                </div>
              </div>
              <ClubCrest club={userClub} size="sm" />
            </button>
          </div>
        )}

        {/* Left Sidebar Menu Options (>= md) */}
        <div className="hidden md:flex w-64 bg-[var(--app-surface-1)] border-r border-[var(--app-border-subtle)] p-3 flex-col justify-between shrink-0">
          <div className="space-y-2">
            {/* 1. SE HOUVER CARREIRA ATIVA: BOTÃO EM DESTAQUE "▶ Continuar Carreira" */}
            {hasActiveCareer && (
              <div className="mb-2 p-2.5 rounded-lg bg-gradient-to-br from-emerald-950/90 via-[#0f2a1d] to-[#0a1811] border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Carreira Ativa
                  </span>
                  <span className="font-mono text-emerald-300/80 text-[10px]">{gameState.seasonYear}</span>
                </div>
                <button
                  onClick={returnToGame}
                  className="w-full flex items-center justify-between p-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded text-xs font-black shadow-md transition-all cursor-pointer group"
                  data-testid="continue-career-btn"
                >
                  <div className="flex items-center space-x-2 text-left truncate mr-1.5">
                    <Play className="w-4 h-4 fill-white shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="truncate">
                      <div className="font-extrabold text-xs leading-none">Continuar Carreira</div>
                      <div className="text-[10px] text-emerald-100 font-medium truncate mt-0.5">
                        {userClub.name} · {gameState.seasonYear} · Rodada {gameState.currentRound}
                      </div>
                    </div>
                  </div>
                  <ClubCrest club={userClub} size="sm" />
                </button>
              </div>
            )}

            {/* 2. BOTÕES CLÁSSICOS BEM ORGANIZADOS E ACESSÍVEIS */}
            <div className="space-y-1">
              <button
                onClick={() => changeTab('new_game')}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'new_game'
                    ? 'bg-gradient-to-r from-emerald-700 to-emerald-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-[var(--app-surface-2)] hover:text-white'
                }`}
              >
                <Play className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>⚽ Novo Jogo</span>
              </button>

              <button
                onClick={() => changeTab('load_game')}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'load_game'
                    ? 'bg-gradient-to-r from-emerald-700 to-emerald-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-[var(--app-surface-2)] hover:text-white'
                }`}
              >
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                <span>💾 Salvar / Carregar</span>
              </button>

              <button
                onClick={() => changeTab('editor')}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'editor'
                    ? 'bg-gradient-to-r from-emerald-700 to-emerald-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-[var(--app-surface-2)] hover:text-white'
                }`}
              >
                <Users className="w-4 h-4 text-blue-400 shrink-0" />
                <span>🛠️ Editor de Equipes</span>
              </button>

              <button
                onClick={() => changeTab('options')}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'options'
                    ? 'bg-gradient-to-r from-emerald-700 to-emerald-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-[var(--app-surface-2)] hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                <span>⚙️ Opções & Áudio</span>
              </button>

              <button
                onClick={() => changeTab('credits')}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'credits'
                    ? 'bg-gradient-to-r from-emerald-700 to-emerald-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-[var(--app-surface-2)] hover:text-white'
                }`}
              >
                <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
                <span>🏆 Créditos (lekD Games)</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  window.dispatchEvent(new CustomEvent('champs:open-bug-report'));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs font-bold transition-all text-left cursor-pointer text-emerald-400 hover:bg-emerald-950/60 border border-emerald-500/20 hover:border-emerald-500/40"
              >
                <Bug className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>🐛 Reportar Bug / Feedback</span>
              </button>
            </div>
          </div>

          {/* Quick info footer */}
          <div className="p-3 bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] rounded text-[11px] text-slate-400 space-y-1">
            <div className="text-[var(--app-text-accent)] font-bold flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[var(--app-text-accent)]" />
              <span>Base Autêntica</span>
            </div>
            <div>703 Clubes Originais</div>
            <div>Séries A, B, C, D e Mundo</div>
            <div className="text-[10px] text-slate-500 font-mono">14.672 Atletas Reais</div>
          </div>
        </div>


        {/* Tab Content Panel */}
        <div className="flex-1 p-4 overflow-y-auto">
          {/* TAB 1: NOVO JOGO */}
          {activeTab === 'new_game' && (
            <div className="max-w-6xl mx-auto space-y-4">
              {/* Header Bar: Title + Manager Name Input */}
              <div className="bg-[#0e1c15] border border-[#1a3828] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div>
                  <h2 className="text-base font-extrabold text-emerald-400 tracking-wide flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-emerald-400" />
                    <span>Iniciar Nova Carreira</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Escolha qualquer clube do Brasil ou do mundo e monte seu império futebolístico
                  </p>
                </div>

                {/* Manager Name Input */}
                <div className="flex items-center space-x-2.5 bg-[#09140f] px-3 py-1.5 rounded-md border border-[#214332]">
                  <span className="text-xs text-slate-300 font-bold whitespace-nowrap">Seu Nome de Técnico:</span>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="Ex: Alex Chagas"
                    className="bg-[#12241b] border border-[#29543e] px-2.5 py-1 rounded text-xs text-white focus:outline-none focus:border-emerald-400 font-semibold w-44"
                  />
                </div>
              </div>

              {/* Navigation Filters: Country & Division Selectors */}
              <div className="bg-[#0e1c15] border border-[#1a3828] rounded-lg p-3.5 space-y-3 shadow-sm">
                {/* 1. Country Selector */}
                <div>
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      1. Selecione o País de Largada
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {allCountries.length} Países Disponíveis
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {visiblePrimaryCountries.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleCountryChange(c.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                          selectedCountryId === c.id
                            ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                            : 'bg-[#12231a] text-slate-300 hover:bg-[#183324] hover:text-white border border-[#1e3c2d]'
                        }`}
                      >
                        <span>{c.flag}</span>
                        <span>{c.name}</span>
                      </button>
                    ))}

                    {/* All other countries dropdown */}
                    <div className="relative inline-block">
                      <select
                        value={selectedCountryId}
                        onChange={(e) => handleCountryChange(Number(e.target.value))}
                        className="bg-[#12231a] border border-[#1e3c2d] text-slate-300 hover:text-white text-xs px-2.5 py-1.5 rounded cursor-pointer focus:outline-none focus:border-emerald-500 font-semibold"
                      >
                        <option value="" disabled>Outros Países ({allCountries.length})...</option>
                        {allCountries.map((c) => (
                          <option key={c.id} value={c.id} className="bg-[#0b1611] text-white">
                            {getCountryFlag(c.id)} {c.name} ({c.clubCount} {c.clubCount === 1 ? 'clube' : 'clubes'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 1.5 Active Leagues Selector (1 a 5 countries) */}
                <div className="pt-2 border-t border-[#162e21]">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Ligas Ativas Simultâneas (1 a 5 países)
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-emerald-950/80 text-emerald-400 border-emerald-600/40">
                      {activeCountryIds.length} de 5 selecionadas {activeCountryIds.length === 1 ? '· Modo Focado' : '· Multi-Liga'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2">
                    Ligas simuladas simultaneamente no calendário (torneios continentais ocorrem sempre). Você poderá receber ofertas e mudar de clube entre elas.
                  </p>

                  {/* Active Leagues Pills (expanded list showing all currently active countries) */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {activeCountryIds.map((cid) => {
                      const cObj = allCountries.find((c) => c.id === cid) || popularCountries.find((c) => c.id === cid);
                      const cName = cObj?.name || `País ${cid}`;
                      const isPrimary = cid === selectedCountryId;
                      return (
                        <span
                          key={`badge-active-${cid}`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border shadow-sm ${
                            isPrimary
                              ? 'bg-emerald-700 text-white border-emerald-400 font-bold'
                              : 'bg-[#193b29] text-emerald-300 border-emerald-600/60'
                          }`}
                        >
                          <span>{getCountryFlag(cid)}</span>
                          <span>{cName}</span>
                          {isPrimary ? (
                            <span className="text-[9px] bg-black/40 text-emerald-200 px-1 py-0.2 rounded font-mono font-bold">
                              Principal
                            </span>
                          ) : (
                            <button
                              onClick={() => toggleActiveCountry(cid)}
                              title={`Remover ${cName} das ligas ativas`}
                              className="hover:text-red-400 ml-1 text-slate-400 hover:text-white font-black cursor-pointer text-xs"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {/* Quick-add other leagues */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-bold mr-1">Adicionar rápida:</span>
                    {popularCountries.filter((c) => !activeCountryIds.includes(c.id)).map((c) => (
                      <button
                        key={`add-quick-${c.id}`}
                        onClick={() => toggleActiveCountry(c.id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#101e16] text-slate-400 border border-[#183324] hover:text-white hover:bg-[#152a20] cursor-pointer"
                      >
                        <span className="text-emerald-400 font-bold">+</span>
                        <span>{c.flag}</span>
                        <span>{c.name}</span>
                      </button>
                    ))}

                    {/* Add any other country to active set */}
                    <div className="relative inline-block">
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) toggleActiveCountry(Number(e.target.value));
                        }}
                        className="bg-[#101e16] border border-[#183324] text-slate-400 hover:text-white text-xs px-2 py-1 rounded cursor-pointer focus:outline-none focus:border-emerald-500 font-semibold"
                      >
                        <option value="" disabled>+ Outra Liga ({allCountries.filter(c => !activeCountryIds.includes(c.id)).length})...</option>
                        {allCountries.filter(c => !activeCountryIds.includes(c.id)).map((c) => (
                          <option key={`opt-active-${c.id}`} value={c.id} className="bg-[#0b1611] text-white">
                            + {getCountryFlag(c.id)} {c.name} ({c.clubCount} {c.clubCount === 1 ? 'clube' : 'clubes'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Division / League Selector */}
                <div className="pt-2 border-t border-[#162e21]">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      2. Selecione a Divisão / Campeonato
                    </span>
                    {selectedCountryId === 29 && (
                      <span className="text-[10px] text-emerald-400 font-mono font-medium">
                        Pirâmide Nacional do Brasil
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedCountryId === 29 ? (
                      <>
                        <button
                          onClick={() => handleDivisionChange(1)}
                          className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                            selectedDivision === 1
                              ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                              : 'bg-[#12231a] text-slate-300 hover:bg-[#183324] border border-[#1e3c2d]'
                          }`}
                        >
                          Série A (20 Clubes)
                        </button>
                        <button
                          onClick={() => handleDivisionChange(2)}
                          className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                            selectedDivision === 2
                              ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                              : 'bg-[#12231a] text-slate-300 hover:bg-[#183324] border border-[#1e3c2d]'
                          }`}
                        >
                          Série B (20 Clubes)
                        </button>
                        <button
                          onClick={() => handleDivisionChange(3)}
                          className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                            selectedDivision === 3
                              ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                              : 'bg-[#12231a] text-slate-300 hover:bg-[#183324] border border-[#1e3c2d]'
                          }`}
                        >
                          Série C (20 Clubes)
                        </button>
                        <button
                          onClick={() => handleDivisionChange(4)}
                          className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                            selectedDivision === 4
                              ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                              : 'bg-[#12231a] text-slate-300 hover:bg-[#183324] border border-[#1e3c2d]'
                          }`}
                        >
                          Série D (64 Clubes)
                        </button>
                        <button
                          onClick={() => handleDivisionChange(5)}
                          className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                            selectedDivision === 5
                              ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                              : 'bg-[#12231a] text-slate-300 hover:bg-[#183324] border border-[#1e3c2d]'
                          }`}
                        >
                          Estaduais / Acesso (72 Clubes)
                        </button>
                        <button
                          onClick={() => handleDivisionChange('all')}
                          className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                            selectedDivision === 'all'
                              ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                              : 'bg-[#12231a] text-slate-300 hover:bg-[#183324] border border-[#1e3c2d]'
                          }`}
                        >
                          Todos do Brasil (196 Clubes)
                        </button>

                        {/* State Filter for Brazil */}
                        <div className="ml-auto flex items-center space-x-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                          <select
                            value={selectedStateCode}
                            onChange={(e) => setSelectedStateCode(e.target.value)}
                            className="bg-[#12231a] border border-[#1e3c2d] text-slate-300 text-xs px-2 py-1.5 rounded cursor-pointer focus:outline-none focus:border-emerald-500 font-semibold"
                          >
                            <option value="all">Filtrar por Estado (Todos)</option>
                            {allStates.map((st) => (
                              <option key={st.code} value={st.code} className="bg-[#0b1611] text-white">
                                {st.name} ({st.code}) - {st.clubCount} clubes
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        {countryLeagues.map((l) => (
                          <button
                            key={l.division}
                            onClick={() => handleDivisionChange(l.division)}
                            className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                              selectedDivision === l.division
                                ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                              : 'bg-[#12231a] text-slate-300 hover:bg-[#183324] border border-[#1e3c2d]'
                            }`}
                          >
                            {l.divisionName || `Divisão ${l.division}`} ({l.teamCount} Clubes)
                          </button>
                        ))}
                        <button
                          onClick={() => handleDivisionChange('all')}
                          className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                            selectedDivision === 'all'
                              ? 'bg-emerald-600 text-black font-extrabold shadow-sm'
                              : 'bg-[#12231a] text-slate-300 hover:bg-[#183324] border border-[#1e3c2d]'
                          }`}
                        >
                          Todos os Clubes
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Main Selection Area: Club Grid (Left) + Selected Club Card (Right) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-20 md:pb-4">
                {/* 3. Club Grid / List */}
                <div className="col-span-1 md:col-span-7 bg-[#0f1d16] border border-[#1b3629] rounded-lg p-3 flex flex-col h-[380px] md:h-[460px] shadow-md">
                  {/* Search Bar + Results Counter */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        placeholder="Buscar por nome, estádio, cidade..."
                        className="w-full bg-[#09130f] border border-[#1e3b2d] pl-8 pr-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <span className="text-[11px] text-emerald-400 font-mono font-bold bg-[#0a1510] px-2 py-1 rounded border border-[#1b3628] whitespace-nowrap">
                      {filteredClubs.length} {filteredClubs.length === 1 ? 'time' : 'times'}
                    </span>
                  </div>

                  {/* Club List Scroll */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {filteredClubs.map((club) => {
                      const isSelected = club.id === selectedClub.id;

                      return (
                        <div
                          key={club.id}
                          onClick={() => { sound.playClick(); setSelectedClubId(club.id); }}
                          style={
                            isSelected
                              ? {
                                  borderLeft: `4px solid ${selectedClubTheme.primaryAccent}`,
                                  backgroundColor: selectedClubTheme.subtleBg,
                                  borderColor: selectedClubTheme.subtleBorder,
                                }
                              : undefined
                          }
                          className={`flex items-center justify-between p-2 rounded-md text-xs cursor-pointer transition-all border ${
                            isSelected
                              ? 'text-white shadow-sm ring-1 ring-white/10'
                              : 'bg-[#122119] border-[#162e21] hover:border-[#224835] hover:bg-[#152a20] text-slate-300'
                          }`}
                        >
                          {/* Crest + Name + Tags */}
                          <div className="flex items-center space-x-2.5 min-w-0">
                            {/* Official crest or fallback */}
                            <div className="w-7 h-7 flex items-center justify-center shrink-0">
                              <ClubCrest club={club} size="md" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-slate-100 truncate">{club.name}</span>
                                {club.stateCode && (
                                  <span 
                                    className="text-[9px] px-1 py-0.2 rounded font-mono font-bold border"
                                    style={
                                      isSelected
                                        ? {
                                            backgroundColor: selectedClubTheme.subtleBg,
                                            color: selectedClubTheme.primaryAccent,
                                            borderColor: selectedClubTheme.subtleBorder,
                                          }
                                        : {
                                            backgroundColor: '#0c1a13',
                                            color: '#34d399',
                                            borderColor: '#1c3a2a',
                                          }
                                    }
                                  >
                                    {club.stateCode}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {club.stadium} • {club.capacity.toLocaleString('pt-BR')} lug.
                              </div>
                            </div>
                          </div>

                          {/* Reputation Stars + Division Tag */}
                          <div className="flex items-center space-x-2.5 shrink-0">
                            {/* Stars */}
                            <div className="flex items-center text-amber-400 text-xs tracking-tighter" title={`Reputação: ${club.reputation} estrelas`}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star} className={star <= club.reputation ? 'text-amber-400' : 'text-slate-600'}>
                                  ★
                                </span>
                              ))}
                            </div>

                            {/* Division tag */}
                            <span 
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border"
                              style={
                                isSelected
                                  ? {
                                      backgroundColor: selectedClubTheme.subtleBg,
                                      color: selectedClubTheme.primaryAccent,
                                      borderColor: selectedClubTheme.subtleBorder,
                                    }
                                  : {
                                      backgroundColor: '#0b1711',
                                      color: '#34d399',
                                      borderColor: '#193526',
                                    }
                              }
                            >
                              {club.divisionName || 'Nacional'}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {filteredClubs.length === 0 && (
                      <div className="text-center py-12 text-slate-500 text-xs">
                        Nenhum clube encontrado com esses filtros. Tente buscar outro nome.
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Selected Club Preview Card & Options */}
                <div 
                  className="col-span-1 md:col-span-5 rounded-lg p-4 flex flex-col justify-between h-auto min-h-[380px] md:h-[460px] shadow-md relative overflow-hidden transition-all border"
                  style={{
                    backgroundColor: selectedClubAtmosphere.surface1,
                    borderColor: selectedClubAtmosphere.borderSubtle,
                    ['--scrollbar-track' as any]: 'transparent',
                    ['--scrollbar-thumb' as any]: selectedClubAtmosphere.borderHighlight,
                    ['--scrollbar-thumb-hover' as any]: selectedClubTheme.primaryAccent,
                    scrollbarColor: `${selectedClubAtmosphere.borderHighlight} transparent`,
                  }}
                >
                  {/* Kit color top stripe */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-1 z-10"
                    style={{ background: selectedClubTheme.stripeGradient }}
                  />

                  <div 
                    className="space-y-3.5 overflow-y-auto pr-1 flex-1 min-h-0"
                    style={{
                      ['--scrollbar-track' as any]: 'transparent',
                      ['--scrollbar-thumb' as any]: selectedClubAtmosphere.borderHighlight,
                      ['--scrollbar-thumb-hover' as any]: selectedClubTheme.primaryAccent,
                      scrollbarColor: `${selectedClubAtmosphere.borderHighlight} transparent`,
                    }}
                  >
                    {/* Club Header */}
                    <div 
                      className="flex items-center space-x-3.5 border-b pb-3"
                      style={{ borderColor: selectedClubAtmosphere.borderSubtle }}
                    >
                      <div 
                        className="w-14 h-14 rounded-lg border flex items-center justify-center p-1 shadow shrink-0 relative overflow-hidden"
                        style={{ 
                          backgroundColor: selectedClubAtmosphere.surface2,
                          borderColor: selectedClubTheme.subtleBorder,
                          boxShadow: `0 0 12px ${selectedClubTheme.subtleBg}`
                        }}
                      >
                        <ClubCrest club={selectedClub} size="xl" />
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-0.5"
                          style={{ background: selectedClubTheme.stripeGradient }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-black text-white text-base truncate">{selectedClub.name}</h3>
                          <div className="flex text-amber-400 text-xs">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span key={star} className={star <= selectedClub.reputation ? 'text-amber-400' : 'text-slate-600'}>
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-0.5">
                          <p 
                            className="text-xs font-semibold truncate"
                            style={{ color: selectedClubAtmosphere.textAccent }}
                          >
                            {selectedClub.leagueName || selectedClub.divisionName} • {selectedClub.coach}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stadium Info */}
                    <div 
                      className="p-2.5 rounded border flex items-center justify-between text-xs"
                      style={{
                        backgroundColor: selectedClubAtmosphere.surface2,
                        borderColor: selectedClubAtmosphere.borderSubtle,
                      }}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] text-slate-400 block">Estádio</span>
                        <span className="text-white font-bold truncate block">{selectedClub.stadium}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 block">Capacidade</span>
                        <span 
                          className="text-[11px] font-mono font-semibold"
                          style={{ color: selectedClubAtmosphere.textAccent }}
                        >
                          {(selectedClub.capacity || 0).toLocaleString('pt-BR')} pessoas
                        </span>
                      </div>
                    </div>

                    {/* Squad List */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Elenco ({selectedClub.squad?.length || 0})</span>
                        <span 
                          className="text-[10px] font-mono font-semibold"
                          style={{ color: selectedClubAtmosphere.textAccent }}
                        >
                          Força Média: {selectedClubAvgStrength}
                        </span>
                      </div>
                      <div 
                        className="space-y-1 rounded border p-1"
                        style={{
                          backgroundColor: selectedClubAtmosphere.surface2,
                          borderColor: selectedClubAtmosphere.borderSubtle,
                        }}
                      >
                        {(selectedClub.squad && selectedClub.squad.length > 0) ? (
                          selectedClub.squad.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                <span 
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0"
                                  style={{
                                    backgroundColor: selectedClubTheme.subtleBg,
                                    color: selectedClubAtmosphere.textAccent,
                                    border: `1px solid ${selectedClubAtmosphere.borderSubtle}`
                                  }}
                                >
                                  {p.position}
                                </span>
                                <span className="text-slate-200 truncate font-semibold text-[11px]">
                                  {p.name}
                                </span>
                                {p.age ? (
                                  <span className="text-[10px] text-slate-500 shrink-0">
                                    {p.age}a
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex items-center space-x-1 shrink-0 ml-2">
                                <span className="text-[9px] text-slate-400 font-medium">FOR</span>
                                <span 
                                  className="font-bold font-mono text-[11px]"
                                  style={{ color: selectedClubAtmosphere.textAccent }}
                                >
                                  {p.strength}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-3 text-xs text-slate-400">
                            Carregando elenco...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Start Button */}
                  <div 
                    className="pt-3 border-t shrink-0"
                    style={{ borderColor: selectedClubAtmosphere.borderSubtle }}
                  >
                    <button
                      onClick={requestStartGame}
                      disabled={isStartingGame || activeCountryIds.length < 1}
                      className={`w-full py-3 font-black rounded-lg shadow-xl text-xs uppercase tracking-wider transition-all transform active:scale-98 cursor-pointer flex items-center justify-center space-x-2 ${
                        isStartingGame || activeCountryIds.length < 1 ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                      style={{
                        backgroundColor: selectedClubTheme.primaryAccent,
                        color: selectedClubTheme.onPrimaryAccent,
                        boxShadow: `0 4px 16px ${selectedClubTheme.subtleBg}`,
                      }}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {isStartingGame
                          ? 'Carregando Ligas Ativas...'
                          : `Iniciar Carreira com o ${selectedClub.name} (${activeCountryIds.length} Ligas)`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile Sticky CTA to start career */}
              <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-[#0c1511]/95 backdrop-blur-md border-t border-[#1b3629] pb-safe z-30 shadow-2xl">
                <button
                  onClick={requestStartGame}
                  disabled={isStartingGame || activeCountryIds.length < 1}
                  className={`w-full py-3 font-black rounded-lg shadow-xl text-xs uppercase tracking-wider transition-all transform active:scale-98 cursor-pointer flex items-center justify-center space-x-2 ${
                    isStartingGame || activeCountryIds.length < 1 ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  style={{
                    backgroundColor: selectedClubTheme.primaryAccent,
                    color: selectedClubTheme.onPrimaryAccent,
                    boxShadow: `0 4px 16px ${selectedClubTheme.subtleBg}`,
                  }}
                  data-testid="start-career-mobile-sticky-btn"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span className="truncate">
                    {isStartingGame
                      ? 'Carregando Ligas Ativas...'
                      : `Iniciar Carreira com ${selectedClub.name} (${activeCountryIds.length} Ligas)`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CARREGAR / SALVAR */}
          {activeTab === 'load_game' && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Save current game card */}
              <div className="bg-[#0f1d16] border border-[#1b3629] rounded p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Salvar Jogo Atual
                </h3>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder={`Ex: ${selectedClub.name} - Rodada ${gameState.currentRound}`}
                    className="flex-1 bg-[#09130f] border border-[#1e3b2d] px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleSaveCurrent}
                    className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded text-xs cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Agora</span>
                  </button>
                </div>
                {saveStatus && (
                  <p className={`text-xs font-semibold flex items-center space-x-1.5 ${saveStatus.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {saveStatus.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 text-center">✕</span>}
                    <span>{saveStatus.message}</span>
                  </p>
                )}
              </div>

              {/* Load existing saves */}
              <div className="bg-[#0f1d16] border border-[#1b3629] rounded p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Jogos Salvos no Navegador ({saveSlots.length})
                  </h3>
                </div>

                {loadError && (
                  <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded text-rose-200 text-xs flex items-center justify-between">
                    <span>{loadError}</span>
                    <button onClick={() => setLoadError(null)} className="text-rose-400 hover:text-white font-bold ml-2">✕</button>
                  </div>
                )}

                {saveSlots.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    Nenhum save encontrado. Inicie um novo jogo e salve seu progresso.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {saveSlots.map((slot) => {
                      const isAuto = slot.isAutoSave || slot.id.startsWith('autosave') || slot.title.startsWith('[Auto-save]');
                      const slotClub = allClubs.find((c) => c.id === slot.userClubId) || allClubs.find((c) => c.name === slot.userClubName);
                      const slotTheme = getClubTheme(slotClub);

                      return (
                        <div
                          key={slot.id}
                          style={{ borderLeft: `4px solid ${slotTheme.primaryAccent}` }}
                          className="flex items-center justify-between p-3 bg-[#122119] border border-[#1b3829] hover:border-emerald-700/50 rounded transition-all relative overflow-hidden"
                        >
                          {/* Club kit stripe subtle header indicator */}
                          <div
                            className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
                            style={{ background: slotTheme.stripeGradient }}
                          />

                          <div className="flex items-center space-x-3 min-w-0 pr-3">
                            {/* Club Crest */}
                            <div 
                              className="w-9 h-9 rounded flex items-center justify-center bg-[#091510] border shrink-0 p-0.5"
                              style={{ borderColor: slotTheme.subtleBorder }}
                            >
                              <ClubCrest club={slotClub || { name: slot.userClubName }} size="md" preferMini={true} />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-xs text-white truncate">{slot.title}</span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                                  isAuto
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                    : 'bg-[#152e20] text-emerald-300 border border-[#2b5941]'
                                }`}>
                                  {isAuto ? 'Auto-save' : 'Manual'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center space-x-1.5">
                                <span className="font-semibold text-slate-200">{slot.userClubName}</span>
                                <span>•</span>
                                <span>Treinador: {slot.managerName}</span>
                                <span>•</span>
                                <span>Rodada {slot.currentRound} ({slot.savedAt})</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => handleLoadSlot(slot.id)}
                              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-bold transition-colors cursor-pointer"
                            >
                              Carregar
                            </button>
                            <button
                              onClick={() => deleteSave(slot.id)}
                              className="p-1 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                              title="Excluir save"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'editor' && <TeamEditorScreen onBack={() => changeTab('new_game')} onDirtyChange={setEditorDirty} />}

          {/* TAB 3: OPÇÕES DO JOGO */}
          {activeTab === 'options' && (
            <div className="max-w-2xl mx-auto bg-[#0f1d16] border border-[#1b3629] rounded p-6 space-y-6">
              <div>
                <h2 className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider">
                  Configurações Gerais do Champs Manager
                </h2>
                <p className="text-xs text-slate-400">Ajuste o comportamento do motor de simulação e áudio</p>
              </div>

              <div className="space-y-4 text-xs">
                {/* Sound On/Off */}
                <div className="flex items-center justify-between py-2 border-b border-[#162e21]">
                  <div>
                    <div className="font-bold text-white">Efeitos Sonoros & Torcida</div>
                    <div className="text-[11px] text-slate-400">Apito, gols, bola na trave e cartões com Web Audio sintetizado</div>
                  </div>
                  <button
                    onClick={() => updateOptions({ soundEnabled: !gameState.options.soundEnabled })}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded font-bold cursor-pointer ${
                      gameState.options.soundEnabled
                        ? 'bg-emerald-600 text-black'
                        : 'bg-[#182a20] text-slate-400'
                    }`}
                  >
                    {gameState.options.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{gameState.options.soundEnabled ? 'Ativado' : 'Mudo'}</span>
                  </button>
                </div>

                {/* Simulation Speed */}
                <div className="flex items-center justify-between py-2 border-b border-[#162e21]">
                  <div>
                    <div className="font-bold text-white">Velocidade da Partida ao Vivo</div>
                    <div className="text-[11px] text-slate-400">Tempo de intervalo entre lances do motor Rust/JS</div>
                  </div>
                  <div className="flex space-x-1.5">
                    {([1, 2, 5] as const).map((spd) => (
                      <button
                        key={spd}
                        onClick={() => updateOptions({ simSpeed: spd })}
                        className={`px-3 py-1 rounded font-bold cursor-pointer ${
                          gameState.options.simSpeed === spd
                            ? 'bg-emerald-600 text-black'
                            : 'bg-[#14261d] text-slate-300 hover:bg-[#1a3326]'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto Pause on Goal */}
                <div className="flex items-center justify-between py-2 border-b border-[#162e21]">
                  <div>
                    <div className="font-bold text-white">Pausa Automática em Gols</div>
                    <div className="text-[11px] text-slate-400">Congela a partida para comemoração e replays quando sair um gol</div>
                  </div>
                  <button
                    onClick={() => updateOptions({ autoPauseOnGoal: !gameState.options.autoPauseOnGoal })}
                    className={`px-3 py-1.5 rounded font-bold cursor-pointer ${
                      gameState.options.autoPauseOnGoal
                        ? 'bg-emerald-600 text-black'
                        : 'bg-[#182a20] text-slate-400'
                    }`}
                  >
                    {gameState.options.autoPauseOnGoal ? 'Sim' : 'Não'}
                  </button>
                </div>

                {/* Brasfoot Auto-Save Modes */}
                <div className="py-2 border-b border-[#162e21] space-y-2.5">
                  <div>
                    <div className="font-bold text-white">Gravação Automática (Auto-save)</div>
                    <div className="text-[11px] text-slate-400">
                      Selecione o modo de salvamento periódico desta carreira (pertence ao save e é persistido)
                    </div>
                  </div>

                  {gameState.options.autoSaveMode === 'legacy_continuous' && (
                    <div className="p-2 bg-amber-950/70 border border-amber-800/80 rounded text-[11px] text-amber-300">
                      ⚠️ Carreira carregada sem configuração de auto-save: o comportamento automático anterior foi preservado. Escolha um dos 4 modos oficiais abaixo para migrar definitivamente esta carreira.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { mode: 'disabled' as const, label: 'Não usar auto-save', desc: 'Salva apenas quando o jogador clicar em Salvar Agora' },
                      { mode: 'every_3_matches' as const, label: 'A cada 3 jogos', desc: `Grava após concluir 3 partidas (${gameState.autoSaveMatchCounter ?? 0}/3 concluídas)` },
                      { mode: 'every_match' as const, label: 'A cada jogo', desc: 'Grava após cada partida/rodada concluída' },
                      { mode: 'start_of_year' as const, label: 'Início do ano', desc: 'Grava no início do jogo e nas viradas de temporada' },
                    ].map((opt) => {
                      const isSelected = gameState.options.autoSaveMode === opt.mode;
                      return (
                        <button
                          key={opt.mode}
                          onClick={() => updateOptions({ autoSaveMode: opt.mode })}
                          className={`p-2.5 rounded border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#193a29] border-emerald-500 text-emerald-200 shadow-sm'
                              : 'bg-[#0c1812] border-[#183325] text-slate-300 hover:border-[#224835] hover:bg-[#12241b]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-bold text-xs ${isSelected ? 'text-emerald-300' : 'text-white'}`}>
                              {opt.label}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          </div>
                          <div className="text-[10px] text-slate-400 leading-tight">
                            {opt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Diagnostics Panel */}
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-200">Diagnóstico do Motor & Sistema</div>
                      <div className="text-[11px] text-slate-400">Informações técnicas mantidas para verificação e diagnóstico</div>
                    </div>
                    <span className="text-[10px] bg-[#0c1812] text-emerald-300 border border-[#1b3d2b] px-2 py-0.5 rounded font-mono font-bold">
                      {isWasmEngine ? 'Rust WASM' : 'Motor JS Fallback'}
                    </span>
                  </div>
                  <div className="p-3 bg-[#0a1410] border border-[#152e20] rounded space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Motor de Simulação:</span>
                      <span className="text-emerald-400">{rustVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Modo Auto-save Ativo:</span>
                      <span className="text-emerald-400">
                        {gameState.options.autoSaveMode === 'disabled'
                          ? 'Não usar auto-save'
                          : gameState.options.autoSaveMode === 'every_3_matches'
                          ? `A cada 3 jogos (${gameState.autoSaveMatchCounter ?? 0}/3 concluídas)`
                          : gameState.options.autoSaveMode === 'every_match'
                          ? 'A cada jogo'
                          : gameState.options.autoSaveMode === 'start_of_year'
                          ? 'Início do ano'
                          : 'Legado contínuo'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Carreira ID:</span>
                      <span className="text-slate-300 truncate max-w-[240px]">{gameState.careerId || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Temporada & Rodada:</span>
                      <span className="text-slate-300">{gameState.seasonYear} • Rodada {gameState.currentRound}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CRÉDITOS (lekD Games) */}
          {activeTab === 'credits' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
              {/* Header do Estúdio lekD Games */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-sky-500/30 shadow-[0_0_25px_rgba(56,189,248,0.15)] flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                <div className="relative shrink-0">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-900/40 border border-sky-400/40 shadow-[0_0_30px_rgba(56,189,248,0.3)] flex items-center justify-center">
                    <Shield className="w-12 h-12 text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
                  </div>
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 text-sky-300 fill-sky-300/80 drop-shadow-[0_0_4px_rgba(56,189,248,0.9)] animate-pulse" />
                    ))}
                  </div>
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <h2 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-100 to-blue-400">
                      lekD <span className="font-mono text-xl tracking-[0.3em] uppercase text-sky-300 font-bold">GAMES</span>
                    </h2>
                    <span className="self-center sm:self-auto px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 font-mono text-xs font-semibold">
                      Estúdio Criador
                    </span>
                  </div>
                  <p className="text-sm font-semibold tracking-wider text-cyan-300/90 uppercase">
                    Futebol Tático Raiz
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed pt-1">
                    Projeto concebido com paixão por futebol, estratégia tática e a nostalgia dos clássicos gerenciadores de PC dos anos 90 e 2000.
                  </p>
                </div>

                <button
                  onClick={() => setScreen('splash')}
                  className="px-3.5 py-2 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-500/40 text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-sm hover:scale-105"
                  title="Ver abertura oficial novamente"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>Ver Abertura</span>
                </button>
              </div>

              {/* Filosofia do Jogo */}
              <div className="p-5 rounded-xl bg-[#0e1c15] border border-[#1a3828] space-y-2.5 shadow-md">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  <span>A Essência do Gerenciamento de Futebol</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  O <strong className="text-white">Champs Manager 2026</strong> foi desenhado para proporcionar a experiência pura, dinâmica e estratégica de um simulador de futebol autêntico: abrir o jogo, escalar seus 11 titulares, ajustar a tática, acompanhar as rodadas lance a lance e construir um legado vitorioso com o seu clube.
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Simplicidade envolvente, ritmo ágil, densidade de informações em tela única sem poluição visual e determinismo matemático absoluto em cada resultado.
                </p>
              </div>

              {/* Ficha Técnica & Tecnologias */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span>Motor Matemático (Rust 1.85+ & WASM)</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    <li>Simulação 90 minutos determinística e lance a lance</li>
                    <li>Algoritmo anti-goleada calibrado e decisões em tempo real</li>
                    <li>Regra oficial de 5 substituições em 3 janelas</li>
                    <li>Cobranças de pênaltis e lesões graves interativas</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span>Base Autêntica e Longevidade</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    <li>3.216 clubes reais (Séries A, B, C, D e ligas em 224 países)</li>
                    <li>Mais de 76.500 atletas com atributos e contratos</li>
                    <li>Theming dinâmico por cores de clube (Atmosferas)</li>
                    <li>100% Offline-First para Web e Desktop (Tauri v2)</li>
                  </ul>
                </div>
              </div>

              {/* Aviso Legal / Disclaimer de Projeto para Amigos */}
              <div className="p-5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Aviso Legal & Termo de Isenção (Patch Recreativo Fechado)</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-semibold">
                    Sem Fins Lucrativos • Acesso Limitado
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                  <p>
                    <strong className="text-amber-200">Finalidade Recreativa entre Amigos:</strong> Este projeto é desenvolvido exclusivamente para uso pessoal, lazer e experimentação técnica entre amigos próximos. Não possui qualquer fim comercial, não gera receita, doação ou lucro, e não contém publicidade. O acesso a este software é restrito e de caráter estritamente privado.
                  </p>
                  <p>
                    <strong className="text-amber-200">Propriedade Intelectual & Marcas:</strong> Todos os nomes de agremiações esportivas, escudos, emblemas, uniformes, marcas registradas e nomes de atletas profissionais mencionados pertencem com exclusividade aos seus respectivos clubes, federações e detentores de direitos. O Champs Manager não é afiliado, patrocinado ou licenciado por nenhuma entidade desportiva. Trata-se de um <em>fan patch</em> não oficial construído como homenagem à história dos jogos de gerenciamento esportivo.
                  </p>
                  <p className="text-slate-400 text-[11px] pt-1 border-t border-amber-500/20">
                    <strong className="text-slate-300">Arquitetura de Dados & Patches da Comunidade:</strong> O motor do jogo funciona como uma plataforma técnica e simulador neutro. As funcionalidades de importação de arquivos permitirão que cada usuário configure, baixe e instale seus próprios pacotes de dados, elencos e escudos customizados de forma independente.
                  </p>
                </div>
              </div>

              {/* Rodapé de Versão */}
              <div className="text-center pt-2 text-[11px] text-slate-500 font-mono">
                Champs Manager 2026 • Desenvolvido com carinho por lekD Games • Versão 0.1.0 • Patch Recreativo para Amigos
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
