import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../state/GameContext';
import { getClubTheme } from '../theme/clubTheme';

import { 
  Trophy, 
  Users, 
  Menu as MenuIcon, 
  Volume2, 
  VolumeX, 
  Shield, 
  ArrowLeftRight, 
  GraduationCap, 
  Landmark, 
  Newspaper, 
  BarChart3,
  ChevronDown,
  MoreHorizontal,
  Globe
} from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    gameState, 
    activeScreen, 
    setScreen, 
    userClub, 
    updateOptions,
    lastSavedText
  } = useGame();

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    if (isMoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMoreMenuOpen]);

  const clubTheme = getClubTheme(userClub);

  const pendingOffersCount = (gameState.transferOffers || []).length;
  const youthCount = (userClub.youth || []).length;
  const unreadNewsCount = (gameState.newsFeed || []).filter((art) => !art.read).length;

  interface HeaderNavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeText?: string;
  }

  const primaryNavItems: HeaderNavItem[] = [
    { id: 'overview', label: 'Visão Geral', icon: Trophy },
    { id: 'tactics', label: 'Tática', icon: Users },
    { 
      id: 'transfers', 
      label: 'Mercado', 
      icon: ArrowLeftRight, 
      badge: pendingOffersCount > 0 ? pendingOffersCount : undefined 
    },
    { id: 'finances', label: 'Finanças', icon: Landmark },
  ];

  const secondaryNavItems: HeaderNavItem[] = [
    { 
      id: 'news', 
      label: 'Jornal', 
      icon: Newspaper, 
      badgeText: unreadNewsCount > 0 ? `${unreadNewsCount}` : undefined 
    },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
    { id: 'managers', label: 'Técnicos', icon: Shield },
    { 
      id: 'youth', 
      label: 'Juniores', 
      icon: GraduationCap, 
      badgeText: youthCount > 0 ? `${youthCount}` : undefined 
    },
    {
      id: 'world_cup',
      label: 'Copa do Mundo',
      icon: Globe,
      badgeText: (gameState.nationalTeamOffers || []).filter(o => o.status === 'pending').length > 0 ? 'Convite' : undefined
    },
  ];

  const allNavItems: HeaderNavItem[] = [
    primaryNavItems[0], // Visão Geral
    secondaryNavItems[0], // Jornal
    secondaryNavItems[1], // Estatísticas
    secondaryNavItems[2], // Técnicos
    primaryNavItems[1], // Tática
    secondaryNavItems[3], // Juniores
    primaryNavItems[2], // Mercado
    primaryNavItems[3], // Finanças
    secondaryNavItems[4], // Copa do Mundo
  ];

  const isSecondaryActive = secondaryNavItems.some((item) => item.id === activeScreen);
  const secondaryTotalNotifications = (youthCount > 0 ? youthCount : 0) + (unreadNewsCount > 0 ? unreadNewsCount : 0);

  const saveStatusColor = 
    lastSavedText === 'Salvando...' ? 'bg-amber-400 animate-pulse' :
    lastSavedText === 'Erro ao salvar' ? 'bg-rose-500' : 'bg-emerald-400';

  const saveStatusTextClass =
    lastSavedText === 'Salvando...' ? 'text-amber-300' :
    lastSavedText === 'Erro ao salvar' ? 'text-rose-300' : 'text-emerald-400';

  return (
    <header className="h-14 bg-[var(--app-surface-1)] border-b border-[var(--app-border-subtle)] flex items-center justify-between px-3 sm:px-4 select-none shrink-0 z-20 shadow-md pt-safe">
      {/* Left: Game Logo Brand Anchor */}
      <div 
        onClick={() => setScreen('overview')}
        className="flex items-center space-x-2 sm:space-x-2.5 shrink-0 cursor-pointer group"
        title="Champs Manager - Ir para a Visão Geral"
      >
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow shrink-0 p-0.5 relative overflow-hidden group-hover:scale-105 transition-transform"
          style={{
            background: `linear-gradient(135deg, ${clubTheme.subtleBg}, rgba(15, 23, 42, 0.85))`,
            border: `1.5px solid ${clubTheme.subtleBorder}`,
            boxShadow: `0 0 12px ${clubTheme.subtleBg}`,
          }}
        >
          <Trophy 
            className="w-4 h-4 transition-colors" 
            style={{ 
              color: clubTheme.primaryAccent,
              filter: `drop-shadow(0 0 6px ${clubTheme.primaryAccent}80)`
            }} 
          />
          <div 
            className="absolute bottom-0 left-0 right-0 h-0.5" 
            style={{ background: clubTheme.stripeGradient }} 
          />
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="font-black text-slate-100 text-xs sm:text-sm tracking-wider uppercase truncate">
            Champs <span style={{ color: clubTheme.primaryAccent }}>Manager</span>
          </span>
          <span 
            className="w-1.5 h-1.5 rounded-full inline-block shrink-0 shadow-xs" 
            style={{ backgroundColor: clubTheme.primaryAccent }}
            title={`Tema do clube: ${userClub.name}`}
          />
        </div>
        {lastSavedText && (
          <span 
            className={`hidden 2xl:inline-flex items-center gap-1 text-[10px] bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] px-1.5 py-0.5 rounded font-mono ${saveStatusTextClass}`}
            title="Status de gravação da carreira"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${saveStatusColor}`}></span>
            <span>{lastSavedText}</span>
          </span>
        )}
      </div>


      {/* Middle Desktop (>= 1280px): All 8 Navigation Tabs Flat */}
      <nav className="hidden xl:flex items-center space-x-1 overflow-x-hidden flex-1 min-w-0 mx-3 py-1 justify-center">
        {allNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id as any)}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all relative shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] shadow-sm'
                  : 'text-slate-300 hover:bg-[var(--app-surface-2)]/70 hover:text-white border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
              {item.badge !== undefined && (
                <span className="bg-amber-400 text-black font-extrabold text-[10px] px-1.5 py-0.2 rounded-full leading-none animate-pulse">
                  {item.badge}
                </span>
              )}
              {item.badgeText !== undefined && (
                <span className="bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] font-mono font-bold text-[10px] px-1.5 py-0.2 rounded-full leading-none">
                  {item.badgeText}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Middle Medium Screens (768px - 1279px, e.g. notebook split / tablet): 4 Core Tabs + Mais Dropdown (Zero Scrolling, Never Clips!) */}
      <nav className="hidden md:flex xl:hidden items-center space-x-1 flex-1 min-w-0 mx-2 py-1 justify-center">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id as any)}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all relative shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] shadow-sm'
                  : 'text-slate-300 hover:bg-[var(--app-surface-2)]/70 hover:text-white border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
              {item.badge !== undefined && (
                <span className="bg-amber-400 text-black font-extrabold text-[10px] px-1.5 py-0.2 rounded-full leading-none animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Dropdown Menu "Mais..." for secondary screens */}
        <div className="relative shrink-0" ref={moreMenuRef}>
          <button
            onClick={() => setIsMoreMenuOpen((prev) => !prev)}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              isSecondaryActive || isMoreMenuOpen
                ? 'bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] shadow-sm'
                : 'text-slate-300 hover:bg-[var(--app-surface-2)]/70 hover:text-white border border-transparent'
            }`}
            title="Outras seções (Jornal, Estatísticas, Técnicos, Juniores)"
          >
            <MoreHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isSecondaryActive
                ? secondaryNavItems.find((i) => i.id === activeScreen)?.label || 'Mais'
                : 'Mais'}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
            {secondaryTotalNotifications > 0 && !isSecondaryActive && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
          </button>

          {/* Dropdown Popover */}
          {isMoreMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--app-surface-1)] border border-[var(--app-border-highlight)] rounded-lg shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-[var(--app-border-subtle)] mb-1">
                Outras Seções
              </div>
              {secondaryNavItems.map((sec) => {
                const SecIcon = sec.icon;
                const isSecActive = activeScreen === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      setScreen(sec.id as any);
                      setIsMoreMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      isSecActive
                        ? 'bg-[var(--app-surface-2)] text-[var(--app-text-accent)] font-bold'
                        : 'text-slate-200 hover:bg-[var(--app-surface-2)]/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <SecIcon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{sec.label}</span>
                    </div>
                    {sec.badgeText && (
                      <span className="bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] font-mono font-bold text-[10px] px-1.5 py-0.2 rounded-full leading-none">
                        {sec.badgeText}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Right: Sound toggle & Menu button */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        {/* Audio Mute/Unmute */}
        <button
          onClick={() => updateOptions({ soundEnabled: !gameState.options.soundEnabled })}
          title={gameState.options.soundEnabled ? 'Silenciar Áudio' : 'Ativar Áudio'}
          className="p-1.5 rounded text-slate-400 hover:text-[var(--app-text-accent)] hover:bg-[var(--app-surface-2)] transition-colors cursor-pointer"
        >
          {gameState.options.soundEnabled ? (
            <Volume2 className="w-4 h-4 text-[var(--app-text-accent)]" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {/* Menu Principal */}
        <button
          onClick={() => setScreen('menu')}
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] flex items-center justify-center cursor-pointer"
          title="Menu Principal / Opções"
        >
          <MenuIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
