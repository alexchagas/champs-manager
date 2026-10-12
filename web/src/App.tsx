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
import { BottomNavBar } from './components/BottomNavBar';
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
      className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--app-bg-deep)] text-slate-100 select-none transition-colors duration-300 pl-safe pr-safe"
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
        // - on 'overview': navigates to match preparation ('tactics') if fixture exists, or completes round
        // - on 'tactics': launches live match ('live_match') if fixture exists
        // - on 'round_results': advances to next round
        // - on 'news' or 'stats': returns to 'overview'
        if (activeScreen === 'overview') {
          e.preventDefault();
          if (userFixture) {
            sound.playClick();
            setScreen('tactics');
          } else {
            completeRound();
          }
        } else if (activeScreen === 'tactics') {
          if (userFixture) {
            e.preventDefault();
            sound.playWhistle();
            setScreen('live_match');
          }
        } else if (activeScreen === 'round_results') {
          e.preventDefault();
          sound.playClick();
          advanceRound();
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

  const showChrome = activeScreen !== 'menu' && activeScreen !== 'splash' && activeScreen !== 'live_match' && activeScreen !== 'round_results';

  return (
    <AppShell>
      {/* Header is visible in all gameplay screens except menu, splash, live match and round results */}
      {showChrome && <Header />}

      {gameState.activeMatch && gameState.activeMatch.phase !== 'committed' && activeScreen !== 'live_match' && activeScreen !== 'splash' && activeScreen !== 'round_results' && (
        <div className="bg-emerald-950 border-b border-emerald-700 px-3 sm:px-4 py-2 flex items-center justify-between text-xs sm:text-sm shrink-0">
          <span>Partida pausada · {gameState.activeMatch.clock.minute}{gameState.activeMatch.clock.added ? '+'+gameState.activeMatch.clock.added : ''}′ · {gameState.activeMatch.score.join(' : ')}</span>
          <button onClick={() => setScreen('live_match')} className="font-bold text-emerald-300 hover:text-emerald-200 cursor-pointer">Voltar à partida</button>
        </div>
      )}
      {matchError && activeScreen !== 'live_match' && activeScreen !== 'splash' && activeScreen !== 'round_results' && <p role="alert" className="p-2 text-amber-300 shrink-0">{matchError}</p>}
      {/* Screen Views */}
      <main className={`flex-1 flex overflow-hidden relative ${showChrome ? 'pb-14 md:pb-0' : ''}`}>
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

      {/* Bottom Navigation Bar on Mobile (< 768px) */}
      {showChrome && <BottomNavBar />}
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
