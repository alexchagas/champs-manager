import React, { useEffect } from 'react';
import { AlertTriangle, UserX, UserCheck, ArrowRight, ShieldAlert } from 'lucide-react';
import type { PendingDismissal } from '../types';
import { ClubCrest } from './ClubCrest';
import { sound } from '../audio/soundEngine';

interface Props {
  dismissal: PendingDismissal;
  onClose: () => void;
}

export const DismissalModal: React.FC<Props> = ({ dismissal, onClose }) => {
  useEffect(() => {
    try {
      sound.playWarning?.();
    } catch (_) {}
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-rose-600/50 bg-[var(--app-surface-1)] shadow-2xl transition-all">
        {/* Glow Header Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-600 via-red-500 to-rose-700" />

        <div className="p-4 sm:p-6 space-y-4">
          {/* Header */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-rose-950/80 border border-rose-600/40 text-rose-300">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Decisão da Diretoria • Rodada {dismissal.round}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-rose-400 drop-shadow uppercase">
              Demitido!
            </h2>
          </div>

          {/* Club Info & Reason (fiel ao diálogo a/dm_0.java) */}
          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] rounded-lg p-3 sm:p-4 space-y-3">
            <div className="flex items-center space-x-3 pb-3 border-b border-[var(--app-border-subtle)]">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-[var(--app-bg-deep)] border border-rose-900/50 p-1.5 shrink-0">
                <ClubCrest
                  club={{ name: dismissal.clubName, crestUrl: dismissal.clubCrest }}
                  className="w-9 h-9 object-contain"
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-white leading-tight truncate">
                  {dismissal.clubName}
                </h3>
                <span className="text-xs text-rose-400 font-semibold flex items-center gap-1 mt-0.5">
                  <UserX className="w-3.5 h-3.5" />
                  Contrato rescindido
                </span>
              </div>
            </div>

            <div className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-2">
              <p>
                Você foi demitido. A razão foi:{' '}
                <strong className="text-rose-300 font-bold">{dismissal.reason}</strong>
              </p>
              <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-[var(--app-bg-deep)] p-2 rounded border border-[var(--app-border-subtle)]">
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Para o seu lugar foi contratado:{' '}
                  <strong className="text-white">{dismissal.newManagerName}</strong>.
                </span>
              </div>
              {dismissal.statsSummary && (
                <p className="text-[11px] text-slate-400 font-mono-numbers">
                  Campanha final no comando: <strong>{dismissal.statsSummary}</strong>
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-center text-slate-400 leading-normal">
            Agora você está desempregado. Avance as rodadas para acompanhar as competições e aguardar convites oficiais de outros clubes.
          </p>

          {/* Action Button */}
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 font-black text-white text-sm uppercase tracking-wider cursor-pointer shadow-lg active:scale-98 transition-all"
          >
            <span>Entendido / Continuar Carreira</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
