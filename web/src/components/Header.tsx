import React from 'react';
import { useGame } from '../state/GameContext';
import { ClubCrest } from './ClubCrest';
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
  BarChart3
} from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    gameState, 
    activeScreen, 
    setScreen, 
    userClub, 
    userFixture, 
    nextOpponent, 
    updateOptions,
    lastSavedText
  } = useGame();

  const clubTheme = getClubTheme(userClub);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const pendingOffersCount = (gameState.transferOffers || []).length;
  const youthCount = (userClub.youth || []).length;
  const newsCount = (gameState.newsFeed || []).length;

  const navItems = [
    { id: 'overview', label: 'Visão Geral', icon: Trophy },
    { 
      id: 'news', 
      label: 'Jornal', 
      icon: Newspaper, 
      badgeText: newsCount > 0 ? `${newsCount}` : undefined 
    },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
    { id: 'managers', label: 'Técnicos', icon: Shield },
    { id: 'tactics', label: 'Tática', icon: Users },
    { 
      id: 'youth', 
      label: 'Juniores', 
      icon: GraduationCap, 
      badgeText: youthCount > 0 ? `${youthCount}` : undefined 
    },
    { 
      id: 'transfers', 
      label: 'Mercado', 
      icon: ArrowLeftRight, 
      badge: pendingOffersCount > 0 ? pendingOffersCount : undefined 
    },
    { id: 'finances', label: 'Finanças', icon: Landmark },
  ];

  const saveStatusColor = 
    lastSavedText === 'Salvando...' ? 'bg-amber-400 animate-pulse' :
    lastSavedText === 'Erro ao salvar' ? 'bg-rose-500' : 'bg-emerald-400';

  const saveStatusTextClass =
    lastSavedText === 'Salvando...' ? 'text-amber-300' :
    lastSavedText === 'Erro ao salvar' ? 'text-rose-300' : 'text-emerald-400';

  return (
    <header className="h-14 bg-[var(--app-surface-1)] border-b border-[var(--app-border-subtle)] flex items-center justify-between px-4 select-none shrink-0 z-20 shadow-md">
      {/* Left: Club & Manager Info */}
      <div className="flex items-center space-x-3">
        <div 
          className="w-9 h-9 rounded flex items-center justify-center font-bold text-sm shadow bg-[var(--app-bg-deep)] shrink-0 p-0.5 relative overflow-hidden"
          style={{ 
            border: `1.5px solid ${clubTheme.subtleBorder}`,
            boxShadow: `0 0 10px ${clubTheme.subtleBg}`
          }}
        >
          <ClubCrest club={userClub} size="lg" className="w-8 h-8" preferMini={true} />
          <div 
            className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ background: clubTheme.stripeGradient }}
          />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-100 text-sm tracking-wide flex items-center gap-1.5">
              <span>{userClub.name}</span>
              <span 
                className="w-2 h-2 rounded-full inline-block shadow-xs shrink-0" 
                style={{ backgroundColor: clubTheme.primaryAccent }}
                title={`Cores do ${userClub.name}`}
              />
            </span>
            {gameState.divisionName && (
              <span className="text-[10px] bg-[var(--app-bg-deep)] text-[var(--app-text-accent)] border border-[var(--app-border-subtle)] px-1.5 py-0.2 rounded font-mono font-bold">
                {gameState.divisionName}
              </span>
            )}
            <span className="text-[11px] bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] px-1.5 py-0.2 rounded font-mono-numbers">
              {gameState.managerName}
            </span>
            {lastSavedText && (
              <span 
                className={`hidden md:inline-flex items-center gap-1 text-[10px] bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] px-1.5 py-0.5 rounded font-mono ${saveStatusTextClass}`}
                title="Status de gravação da carreira"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${saveStatusColor}`}></span>
                <span>{lastSavedText}</span>
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <span className="text-[var(--app-text-accent)] font-semibold font-mono-numbers">
              Rodada {gameState.currentRound} / {gameState.calendar.length > 0 ? Math.max(...gameState.calendar.map((f) => f.round)) : 38}
            </span>
            <span>•</span>
            <span className="text-slate-300 font-mono-numbers">
              Saldo: <strong className={userClub.balance >= 0 ? "text-emerald-400" : "text-rose-400"}>{formatMoney(userClub.balance)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Middle: Navigation Tabs */}
      <nav className="flex items-center space-x-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id as any)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all relative ${
                isActive
                  ? 'bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] shadow-inner'
                  : 'text-slate-300 hover:bg-[var(--app-surface-2)] hover:text-white border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
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

      {/* Right: Sound toggle & Menu button */}
      <div className="flex items-center space-x-3">
        {/* Next match pill */}
        {nextOpponent && (
          <div className="hidden lg:flex items-center space-x-2 bg-[var(--app-surface-2)] px-2.5 py-1 rounded border border-[var(--app-border-subtle)] text-xs">
            <span className="text-slate-400">Próximo:</span>
            <span className="font-semibold text-slate-200">{nextOpponent.name}</span>
            <span className="text-[10px] text-[var(--app-text-accent)] bg-[var(--app-bg-deep)] px-1 rounded">
              {userFixture?.homeClubId === userClub.id ? 'CASA' : 'FORA'}
            </span>
          </div>
        )}

        {/* Audio Mute/Unmute */}
        <button
          onClick={() => updateOptions({ soundEnabled: !gameState.options.soundEnabled })}
          title={gameState.options.soundEnabled ? 'Silenciar Áudio' : 'Ativar Áudio'}
          className="p-1.5 rounded text-slate-400 hover:text-[var(--app-text-accent)] hover:bg-[var(--app-surface-2)] transition-colors"
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
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] flex items-center space-x-1"
          title="Menu Principal / Opções (Esc)"
        >
          <MenuIcon className="w-4 h-4" />
          <kbd className="hidden 2xl:inline-block text-[9px] text-slate-400 font-mono">esc</kbd>
        </button>
      </div>
    </header>
  );
};
