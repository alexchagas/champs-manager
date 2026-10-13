import React, { useState } from 'react';
import { useGame } from '../state/GameContext';
import { sound } from '../audio/soundEngine';
import { 
  Trophy, 
  Users, 
  ArrowLeftRight, 
  Landmark, 
  MoreHorizontal, 
  Newspaper, 
  BarChart3, 
  Shield, 
  GraduationCap, 
  Menu as MenuIcon,
  X,
  Bug,
  Globe
} from 'lucide-react';
import { isWorldCupYear, WORLD_CUP_FEATURE_ENABLED } from '../data/nationalTeamsData';

export const BottomNavBar: React.FC = () => {
  const { gameState, activeScreen, setScreen, userClub } = useGame();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // During World Cup Mode, hide the club bottom navigation bar for complete immersion
  if (WORLD_CUP_FEATURE_ENABLED && (activeScreen === 'world_cup' || gameState.isWorldCupMode)) {
    return null;
  }

  const pendingOffersCount = (gameState.transferOffers || []).length;
  const youthCount = (userClub.youth || []).length;
  const unreadNewsCount = (gameState.newsFeed || []).filter((art) => !art.read).length;
  const hasMoreNotification = youthCount > 0 || unreadNewsCount > 0;

  const handleNav = (screen: any) => {
    sound.playClick();
    setScreen(screen);
    setIsMoreOpen(false);
  };

  const primaryItems = [
    { id: 'overview', label: 'Geral', icon: Trophy },
    { id: 'tactics', label: 'Tática', icon: Users },
    { 
      id: 'transfers', 
      label: 'Mercado', 
      icon: ArrowLeftRight, 
      badge: pendingOffersCount > 0 ? pendingOffersCount : undefined 
    },
    { id: 'finances', label: 'Finanças', icon: Landmark },
  ];

  const secondaryItems = [
    { 
      id: 'news', 
      label: 'Notícias', 
      desc: 'Jornal e acontecimentos da rodada',
      icon: Newspaper, 
      badge: unreadNewsCount > 0 ? `${unreadNewsCount}` : undefined 
    },
    { 
      id: 'stats', 
      label: 'Estatísticas', 
      desc: 'Artilharia e classificação geral',
      icon: BarChart3 
    },
    { 
      id: 'managers', 
      label: 'Técnicos', 
      desc: 'Treinadores e demissões no país',
      icon: Shield 
    },
    { 
      id: 'youth', 
      label: 'Juniores', 
      desc: 'Promessas das categorias de base',
      icon: GraduationCap, 
      badge: youthCount > 0 ? `${youthCount}` : undefined 
    },
    ...(WORLD_CUP_FEATURE_ENABLED && isWorldCupYear(gameState.seasonYear) && (gameState.currentRound >= 18 || !!gameState.nationalJob) ? [{
      id: 'world_cup',
      label: 'Copa do Mundo',
      desc: 'Torneio de Seleções Nacionais e grupos',
      icon: Globe,
      badge: (gameState.nationalTeamOffers || []).filter(o => o.status === 'pending').length > 0 ? 'Convite' : undefined
    }] : []),
    { 
      id: 'menu', 
      label: 'Menu Principal', 
      desc: 'Salvar jogo, carregar e configurações',
      icon: MenuIcon 
    },
  ];

  return (
    <>
      {/* DRAWER / BOTTOM SHEET FOR "MAIS..." */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setIsMoreOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
          />

          {/* Sheet panel */}
          <div className="relative bg-[var(--app-surface-1)] border-t border-[var(--app-border-highlight)] rounded-t-2xl shadow-2xl p-4 pb-8 z-10 animate-in fade-in slide-in-from-bottom-8 duration-200">
            {/* Handle bar */}
            <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-3" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--app-border-subtle)]">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Mais Opções</h3>
                <p className="text-[11px] text-slate-400">Navegue pelas outras áreas do clube</p>
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white bg-[var(--app-surface-2)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid of secondary items */}
            <div className="grid grid-cols-1 gap-2">
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all text-left ${
                      isActive
                        ? 'bg-[var(--app-surface-2)] border-[var(--app-border-highlight)] text-[var(--app-text-accent)] font-bold'
                        : 'bg-[var(--app-bg-deep)]/60 border-[var(--app-border-subtle)] text-slate-200 hover:bg-[var(--app-surface-2)]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-[var(--app-text-accent)]/20 text-[var(--app-text-accent)]' : 'bg-[var(--app-surface-2)] text-slate-300'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-tight">{item.label}</div>
                        <div className="text-[10px] text-slate-400">{item.desc}</div>
                      </div>
                    </div>

                    {item.badge && (
                      <span className="bg-amber-400 text-black font-extrabold text-[10px] px-2 py-0.5 rounded-full font-mono">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bug Report & Feedback Action */}
            <button
              onClick={() => {
                sound.playClick();
                setIsMoreOpen(false);
                window.dispatchEvent(new CustomEvent('champs:open-bug-report'));
              }}
              className="w-full mt-3 flex items-center justify-center gap-2 p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 text-xs font-bold transition-all cursor-pointer"
            >
              <Bug className="w-4 h-4 text-emerald-400" />
              <span>Reportar Bug ou Sugestão</span>
            </button>
          </div>
        </div>
      )}

      {/* FIXED BOTTOM NAVIGATION BAR (< 768px) */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[var(--app-surface-1)] border-t border-[var(--app-border-subtle)] pb-safe shadow-2xl flex items-center justify-around h-14"
        role="navigation"
        aria-label="Navegação Principal Mobile"
      >
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`flex-1 flex flex-col items-center justify-center h-full relative transition-colors ${
                isActive 
                  ? 'text-[var(--app-text-accent)] font-bold' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Active top indicator pill */}
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-[var(--app-text-accent)] rounded-full shadow-[0_0_8px_var(--app-text-accent)]" />
              )}

              <div className="relative">
                <Icon className={`w-4 h-4 ${isActive ? 'scale-110' : ''} transition-transform`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 bg-amber-400 text-black font-extrabold text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none">
                    {item.badge}
                  </span>
                )}
              </div>

              <span className="text-[10px] tracking-tight mt-0.5">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Mais... Button */}
        <button
          onClick={() => {
            sound.playClick();
            setIsMoreOpen(!isMoreOpen);
          }}
          className={`flex-1 flex flex-col items-center justify-center h-full relative transition-colors ${
            isMoreOpen || ['news', 'stats', 'managers', 'youth'].includes(activeScreen)
              ? 'text-[var(--app-text-accent)] font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <MoreHorizontal className="w-4 h-4" />
            {hasMoreNotification && (
              <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">
            Mais
          </span>
        </button>
      </nav>
    </>
  );
};
