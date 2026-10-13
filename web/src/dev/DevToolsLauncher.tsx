import React, { useState, useEffect } from 'react';
import { useGame } from '../state/GameContext.tsx';
import { DevToolsModal } from './DevToolsModal.tsx';
import { isDevModeEnabled } from './devSandboxStorage.ts';
import { Zap } from 'lucide-react';

export const DevToolsLauncher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => isDevModeEnabled());

  const { 
    gameState, 
    rustVersion, 
    isWasmEngine,
    applyDevState,
  } = useGame();

  // Listen for global keyboard shortcut: Ctrl+Shift+D or Cmd+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle modal with Ctrl+Shift+D or Cmd+Shift+D
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const handleOpenDevTools = () => setIsOpen(true);
    window.addEventListener('champs:open-dev-tools', handleOpenDevTools);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('champs:open-dev-tools', handleOpenDevTools);
    };
  }, []);

  // Check if active or enabled
  if (!enabled && !import.meta.env.DEV) {
    return null;
  }

  // Fallback if applyDevState is not yet directly mounted on GameContext
  const safeApplyDevState = applyDevState || ((_next: any) => {
    console.warn('applyDevState não está disponível no GameContext atual.');
  });

  return (
    <>
      {/* Floating Dev Mode Trigger Button (posicionado acima da BottomNavBar no mobile para não sobrepor o menu Mais) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900/95 hover:bg-emerald-950 border border-emerald-500/50 hover:border-emerald-400 text-emerald-400 hover:text-emerald-300 rounded-full shadow-2xl text-[11px] font-bold tracking-wider uppercase transition-all backdrop-blur-md cursor-pointer group"
        title="Abrir Modo Desenvolvedor & Sandbox (Ctrl+Shift+D)"
        data-testid="dev-tools-launcher-btn"
      >
        <Zap className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
        <span className="hidden sm:inline">DEV</span>
      </button>

      {/* Dev Tools Modal */}
      <DevToolsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        gameState={gameState}
        applyDevState={safeApplyDevState}
        rustVersion={rustVersion}
        isWasmEngine={isWasmEngine}
      />
    </>
  );
};
