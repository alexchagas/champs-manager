import React, { useState, useEffect } from 'react';
import { Shield, KeyRound, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { sound } from '../audio/soundEngine';

// Default SHA-256 hash for 'CHAMPS2026'
// Can be customized via VITE_ACCESS_HASH in .env or Cloudflare environment variables
const DEFAULT_HASH = '4c7d4c3e0e024e04a6c41ba1932ec71b991bef21b3e0a90659de092e1baddc51';
const STORAGE_KEY = 'champs_access_granted_v1';

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface AccessGatekeeperProps {
  children: React.ReactNode;
}

export const AccessGatekeeper: React.FC<AccessGatekeeperProps> = ({ children }) => {
  const [isGranted, setIsGranted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [inputKey, setInputKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const targetHash = (import.meta.env.VITE_ACCESS_HASH as string) || DEFAULT_HASH;

  // Auto-unlock if ?key=... or ?access=... is present in URL
  useEffect(() => {
    if (isGranted) return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlKey = urlParams.get('key') || urlParams.get('access') || urlParams.get('beta');
      if (urlKey) {
        verifyKey(urlKey, true);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, [isGranted]);

  const verifyKey = async (rawKey: string, fromUrl: boolean = false) => {
    if (!rawKey.trim()) {
      setErrorMsg('Por favor, digite a chave de acesso.');
      return;
    }

    setIsChecking(true);
    setErrorMsg('');

    try {
      const computed = await sha256(rawKey);
      if (computed.toLowerCase() === targetHash.toLowerCase()) {
        try {
          localStorage.setItem(STORAGE_KEY, 'true');
        } catch {}
        sound.playIntroChime();
        setIsGranted(true);

        if (fromUrl) {
          // Clean URL so the key is not kept in browser history
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      } else {
        sound.playWhistle();
        setErrorMsg('Chave de acesso incorreta. Tente novamente.');
      }
    } catch {
      setErrorMsg('Erro ao validar chave. Tente novamente.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick();
    verifyKey(inputKey);
  };

  if (isGranted) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0c1511] text-slate-100 p-4 select-none pt-safe pb-safe pl-safe pr-safe">
      <div className="w-full max-w-md bg-[#111e18] border border-[#234234] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
        {/* Glow ambient effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#10b981]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#10b981]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[#15261f] border border-[#2f5a46] flex items-center justify-center mb-3 shadow-inner">
            <Shield className="w-8 h-8 text-[#10b981]" />
          </div>
          <h1 className="text-2xl font-bold font-digital tracking-wider text-slate-100 uppercase">
            Champs Manager
          </h1>
          <div className="flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Acesso Antecipado • Beta Fechado</span>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-3">
            Este jogo está em fase de testes fechada. Insira sua chave de acesso para jogar no seu aparelho.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Chave de Acesso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="••••••••••••"
                autoFocus
                disabled={isChecking}
                className="w-full pl-10 pr-4 py-3 bg-[#0c1511] border border-[#234234] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] rounded-xl text-slate-100 text-sm placeholder:text-slate-600 outline-none transition-all"
              />
            </div>
            {errorMsg && (
              <div className="flex items-center gap-1.5 mt-2 text-rose-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isChecking}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#10b981] hover:bg-[#059669] active:scale-[0.98] text-black font-bold text-sm tracking-wide transition-all shadow-lg shadow-[#10b981]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isChecking ? 'Verificando...' : 'Entrar no Jogo'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#234234]/60 text-center">
          <p className="text-[11px] text-slate-500">
            Acesso liberado permanentemente neste aparelho após a validação.
          </p>
        </div>
      </div>
    </div>
  );
};
