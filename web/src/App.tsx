import React, { useEffect } from 'react';
import { GameProvider, useGame } from './state/GameContext';
import { Header } from './components/Header';
import { MainMenu } from './components/MainMenu';
import { ClubOverview } from './components/ClubOverview';
import { TacticsScreen } from './components/TacticsScreen';
import { LiveMatchScreen } from './components/LiveMatchScreen';
import { RoundResultsScreen } from './components/RoundResultsScreen';
import { TransfersScreen } from './components/TransfersScreen';
import { FinancesScreen } from './components/FinancesScreen';
import { YouthScreen } from './components/YouthScreen';
import { NewsFeed } from './components/NewsFeed';
import { LeagueStatsScreen } from './components/LeagueStatsScreen';
import { ManagersScreen } from './components/ManagersScreen';
import { ClubViewer } from './components/ClubViewer';
import { SplashScreen } from './components/SplashScreen';
import { sound } from './audio/soundEngine';
import { deriveClubAtmosphere } from './theme/clubTheme';

export interface AppShellProps {
  children?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { userClub } = useGame();
  const atmosphere = deriveClubAtmosphere(userClub);

  return (
    <div
      id="app-shell"
      data-testid="app-shell"
      data-club-family={atmosphere.family}
      className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--app-bg-deep)] text-slate-100 select-none transition-colors duration-300"
      style={atmosphere.style as React.CSSProperties}
    >
      {children}
    </div>
  );
};

export const GameLayout = AppShell;

const MainAppContent: React.FC = () => {

  const { 
    gameState,
    matchError,
    activeScreen, 
    setScreen, 
    advanceRound, 
    completeRound, 
    userFixture,
    viewedClubId,
    closeClubViewer,
    rustVersion,
    isWasmEngine,
    hasActiveCareer,
  } = useGame();

  // Global Keyboard Shortcuts (Space to advance / play, Esc to back)
  useEffect(() => {
    // If on splash screen, let SplashScreen handle keyboard shortcuts
    if (activeScreen === 'splash') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is inside an input, textarea or select
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl && (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      if (e.code === 'Space') {
        if (viewedClubId !== null) { e.preventDefault(); return; }
        // Space advances:
        // - on 'overview': launches match ('live_match')
        // - on 'round_results': advances to next round
        // - on 'news' or 'stats': returns to 'overview'
        if (activeScreen === 'overview') {
          e.preventDefault();
          if (userFixture) {
            sound.playWhistle();
            setScreen('live_match');
          } else {
            completeRound();
          }
        } else if (activeScreen === 'round_results') {
          e.preventDefault();
          sound.playClick();
          advanceRound();
        } else if (activeScreen === 'news' || activeScreen === 'stats') {
          e.preventDefault();
          sound.playClick();
          setScreen('overview');
        }
      } else if (e.code === 'Escape') {
        // Esc goes back:
        // - if club viewer is open: closes club viewer
        // - on sub-screens: returns to 'overview'
        // - on 'overview': opens 'menu'
        // - on 'menu': closes menu / back to 'overview' ONLY if career was started
        e.preventDefault();
        sound.playClick();
        if (viewedClubId !== null) {
          closeClubViewer();
        } else if (activeScreen === 'overview') {
          setScreen('menu');
        } else if (activeScreen === 'menu') {
          if (hasActiveCareer) {
            setScreen('overview');
          }
        } else if (activeScreen !== 'live_match') {
          setScreen('overview');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeScreen, advanceRound, completeRound, setScreen, userFixture, viewedClubId, closeClubViewer, hasActiveCareer]);

  return (
    <AppShell>
      {/* Header is visible in all gameplay screens except menu and splash */}
      {activeScreen !== 'menu' && activeScreen !== 'splash' && <Header />}

      {gameState.activeMatch && gameState.activeMatch.phase !== 'committed' && activeScreen !== 'live_match' && activeScreen !== 'splash' && <div className="bg-emerald-950 border-b border-emerald-700 px-4 py-2 flex justify-between text-sm">
        <span>Partida pausada · {gameState.activeMatch.clock.minute}{gameState.activeMatch.clock.added ? '+'+gameState.activeMatch.clock.added : ''}′ · {gameState.activeMatch.score.join(' : ')}</span>
        <button onClick={() => setScreen('live_match')} className="font-bold text-emerald-300">Voltar à partida</button>
      </div>}
      {matchError && activeScreen !== 'live_match' && activeScreen !== 'splash' && <p role="alert" className="p-2 text-amber-300">{matchError}</p>}
      {/* Screen Views */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeScreen === 'splash' && (
          <SplashScreen 
            onFinish={() => setScreen('menu')} 
            rustVersion={rustVersion} 
            isWasmReady={isWasmEngine} 
          />
        )}
        {activeScreen === 'menu' && <MainMenu />}
        {activeScreen === 'overview' && <ClubOverview />}
        {activeScreen === 'tactics' && <TacticsScreen />}
        {activeScreen === 'youth' && <YouthScreen />}
        {activeScreen === 'transfers' && <TransfersScreen />}
        {activeScreen === 'finances' && <FinancesScreen />}
        {activeScreen === 'news' && <NewsFeed />}
        {activeScreen === 'stats' && <LeagueStatsScreen />}
        {activeScreen === 'managers' && <ManagersScreen />}
        {activeScreen === 'live_match' && <LiveMatchScreen />}
        {activeScreen === 'round_results' && <RoundResultsScreen />}

        {/* Club Viewer (Inspecionar Clube Externo / Adversário) */}
        {viewedClubId !== null && (
          <ClubViewer
            clubId={viewedClubId}
            onClose={closeClubViewer}
          />
        )}
      </main>
    </AppShell>
  );
};



export const App: React.FC = () => {
  return (
    <GameProvider>
      <MainAppContent />
    </GameProvider>
  );
};

export default App;
