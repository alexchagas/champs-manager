import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Zap, Star, Shield, Play } from 'lucide-react';
import { sound } from '../audio/soundEngine';
import { preloadPriorityAtlases } from '../utils/spriteManager';

export interface SplashScreenProps {
  onFinish: () => void;
  rustVersion?: string;
  isWasmReady?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  rustVersion = 'Rust 1.85+ · WASM Ativo',
  isWasmReady = true,
}) => {
  // Preload priority spritesheets during splash screen
  useEffect(() => {
    preloadPriorityAtlases();
  }, []);

  // Phase 1: 'studio' (lekD Games) -> Phase 2: 'game' (Champs Manager 2026)
  const [phase, setPhase] = useState<'studio' | 'game'>('studio');
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');
  const finishedRef = useRef(false);

  const handleFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    sound.playClick();
    onFinish();
  }, [onFinish]);

  // Keyboard listener for Space, Enter or Escape to skip immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        handleFinish();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFinish]);

  // Phase transition timers:
  // Phase 1: 1.8s (1800ms) with fade out beginning at 1550ms
  // Phase 2: 1.8s (1800ms) with auto-finish at 3600ms
  useEffect(() => {
    // 1. Fade out studio at 1550ms
    const fadeOutStudioTimer = setTimeout(() => {
      if (!finishedRef.current) {
        setFadeState('out');
      }
    }, 1550);

    // 2. Switch to game logo at 1800ms with subtle kickoff sound
    const switchPhaseTimer = setTimeout(() => {
      if (!finishedRef.current) {
        setPhase('game');
        setFadeState('in');
        try {
          sound.playIntroChime();
        } catch {
          sound.playKick();
        }
      }
    }, 1800);

    // 3. Auto-finish after Phase 2 (at 3600ms total)
    const autoFinishTimer = setTimeout(() => {
      if (!finishedRef.current) {
        handleFinish();
      }
    }, 3600);

    return () => {
      clearTimeout(fadeOutStudioTimer);
      clearTimeout(switchPhaseTimer);
      clearTimeout(autoFinishTimer);
    };
  }, [handleFinish]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleFinish}
      onKeyDown={(e) => {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
          handleFinish();
        }
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-slate-100 select-none cursor-pointer overflow-hidden outline-none"
      data-testid="splash-screen"
    >
      {/* Background Ambient Glow & Scanline Effect */}
      <div 
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          phase === 'studio' 
            ? 'opacity-100' 
            : 'opacity-0'
        }`}
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.18) 0%, rgba(2, 6, 23, 0.9) 65%, #020617 100%)',
        }}
      />
      <div 
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          phase === 'game' 
            ? 'opacity-100' 
            : 'opacity-0'
        }`}
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.16) 0%, rgba(15, 23, 42, 0.9) 65%, #030712 100%)',
        }}
      />

      {/* Decorative Subtle Grid Lines for Retro Feel */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Content Container with Smooth Fade In/Out */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center text-center px-6 transition-all duration-300 transform ${
          fadeState === 'in' 
            ? 'opacity-100 scale-100' 
            : 'opacity-0 scale-95'
        }`}
      >
        {/* ========================================================
            FASE 1: Vinheta do Estúdio "lekD Games" (1.8s)
           ======================================================== */}
        {phase === 'studio' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
            {/* Brasão Retrô-Estelar Celeste */}
            <div className="relative mb-5 flex items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-900/40 border border-sky-400/40 shadow-[0_0_35px_rgba(56,189,248,0.3)] flex items-center justify-center">
                <Shield className="w-10 h-10 text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              </div>
              {/* 5 Estrelas Soltas Decorativas */}
              <div className="absolute -top-3 flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className="w-3 h-3 text-sky-300 fill-sky-300/80 drop-shadow-[0_0_4px_rgba(56,189,248,0.9)] animate-pulse" 
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>

            {/* Nome do Estúdio: lekD Games */}
            <div className="flex flex-col items-center">
              <h1 className="text-5xl sm:text-6xl font-black tracking-tight font-sans text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-100 to-blue-400 drop-shadow-[0_4px_16px_rgba(56,189,248,0.4)]">
                lekD
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-[1px] w-6 bg-gradient-to-r from-transparent to-sky-400" />
                <span className="text-sm sm:text-base font-bold tracking-[0.45em] text-sky-300 font-mono uppercase">
                  GAMES
                </span>
                <span className="h-[1px] w-6 bg-gradient-to-l from-transparent to-sky-400" />
              </div>
            </div>

            {/* Slogan */}
            <p className="mt-5 text-xs sm:text-sm font-semibold tracking-[0.25em] text-slate-400 uppercase">
              Futebol Tático Raiz
            </p>
          </div>
        )}

        {/* ========================================================
            FASE 2: Logo Oficial "Champs Manager 2026" (1.8s)
           ======================================================== */}
        {phase === 'game' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
            {/* Ícone Troféu Oficial */}
            <div className="relative mb-4 flex items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-800/30 to-slate-900 border border-emerald-400/40 shadow-[0_0_35px_rgba(16,185,129,0.35)] flex items-center justify-center">
                <Trophy className="w-10 h-10 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
              </div>
            </div>

            {/* Título Principal */}
            <div className="flex flex-col items-center">
              <h1 className="text-4xl sm:text-6xl font-black tracking-wider uppercase font-sans text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-emerald-200 to-teal-300 drop-shadow-[0_4px_18px_rgba(16,185,129,0.45)]">
                Champs Manager
              </h1>
              <div className="mt-2 flex items-center gap-2">
                <span className="px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-mono text-sm font-bold tracking-widest shadow-inner">
                  2026
                </span>
              </div>
            </div>

            {/* Subtítulo */}
            <p className="mt-3 text-sm sm:text-base text-slate-300 font-medium tracking-wide">
              O clássico gerenciador de futebol
            </p>

            {/* Badge de Status do Motor Rust / WASM */}
            <div className="mt-6 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/70 shadow-sm backdrop-blur-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono font-medium text-slate-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                {isWasmReady ? rustVersion : 'Motor WASM Inicializado'}
              </span>
            </div>

            {/* Indicação para Continuar (Piscando) */}
            <div className="mt-8 flex items-center gap-2 text-xs sm:text-sm text-slate-400 tracking-widest uppercase animate-pulse font-medium">
              <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
              <span>Pressione Espaço ou clique para continuar</span>
            </div>
          </div>
        )}
      </div>

      {/* Botão de Pular no canto inferior direito */}
      <div className="absolute bottom-4 right-4 z-20">
        <span className="text-[11px] font-mono tracking-wider text-slate-500 hover:text-slate-300 transition-colors uppercase bg-slate-900/40 px-2 py-1 rounded border border-slate-800">
          Pular [ESC]
        </span>
      </div>
    </div>
  );
};
