import React from 'react';
import { Briefcase, Building2, Users, DollarSign, Check, X, Eye, Trophy, Sparkles } from 'lucide-react';
import type { ClubJobOffer } from '../types';
import { ClubCrest } from './ClubCrest';
import { sound } from '../audio/soundEngine';

interface Props {
  offers: ClubJobOffer[];
  onAccept: (clubId: number) => void;
  onRejectAll: () => void;
  onInspectClub?: (clubId: number) => void;
  isUnemployed?: boolean;
}

export const ClubJobOffersModal: React.FC<Props> = ({
  offers,
  onAccept,
  onRejectAll,
  onInspectClub,
  isUnemployed = false,
}) => {
  const formatMoney = (val?: number) => {
    if (!val) return 'R$ 0';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden rounded-xl border border-emerald-500/40 bg-[var(--app-surface-1)] shadow-2xl transition-all">
        {/* Glow Header Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        <div className="p-4 sm:p-6 flex flex-col flex-1 min-h-0 space-y-4">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-950/80 border border-emerald-600/40 text-emerald-300">
              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mercado de Treinadores • Convites Oficiais</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
              Propostas de Clubes
            </h2>
            <p className="text-xs text-slate-300">
              {isUnemployed
                ? 'Clubes interessados em contratar seus serviços para a sequência da temporada.'
                : 'Pela sua grande campanha, outros clubes enviaram propostas para você assumir o comando técnico.'}
            </p>
          </div>

          {/* Offers list */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
            {offers.map((offer) => (
              <div
                key={offer.clubId}
                className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] hover:border-emerald-500/50 rounded-lg p-3 sm:p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
              >
                {/* Left: Club Crest & Details */}
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] p-1.5 shrink-0">
                    <ClubCrest
                      club={{ name: offer.clubName, crestUrl: offer.clubCrest }}
                      className="w-9 h-9 object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-black text-white leading-tight truncate">
                        {offer.clubName}
                      </h3>
                      {offer.clubReputation !== undefined && (
                        <span className="text-[10px] text-amber-400 font-bold flex items-center shrink-0">
                          {'★'.repeat(Math.max(1, offer.clubReputation))}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-300 mt-1">
                      <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                        {offer.divisionName || `Série ${offer.division || 'A'}`}
                      </span>
                      {offer.tablePosition && (
                        <span className="text-slate-400 font-mono-numbers">
                          · {offer.tablePosition}º colocado
                        </span>
                      )}
                      {offer.avgStrength && (
                        <span className="text-slate-400 font-mono-numbers">
                          · Força média: {offer.avgStrength}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-mono-numbers flex items-center gap-2">
                      <span>Salário oferecido: <strong className="text-emerald-300 font-bold">{formatMoney(offer.wage)}/mês</strong></span>
                      {offer.stadiumCapacity && (
                        <span>· Estádio: {offer.stadiumCapacity.toLocaleString('pt-BR')} lug.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Action Buttons */}
                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  {onInspectClub && (
                    <button
                      onClick={() => {
                        sound.playClick();
                        onInspectClub(offer.clubId);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[var(--app-bg-deep)] hover:bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] text-xs text-slate-300 font-semibold cursor-pointer active:scale-95 transition-all"
                      title="Inspecionar clube, elenco e classificação"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ver Clube</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      sound.playClick();
                      onAccept(offer.clubId);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs cursor-pointer shadow active:scale-95 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Assumir Clube</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Action: Reject All */}
          <div className="pt-2 border-t border-[var(--app-border-subtle)] flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {isUnemployed
                ? 'Se recusar, você permanecerá desempregado aguardando mais rodadas.'
                : 'Se recusar, você permanecerá no comando técnico da sua equipe atual.'}
            </span>
            <button
              onClick={() => {
                sound.playClick();
                onRejectAll();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-[var(--app-surface-2)] hover:bg-rose-950/60 border border-[var(--app-border-subtle)] hover:border-rose-700/50 text-slate-300 hover:text-rose-200 text-xs font-bold cursor-pointer active:scale-95 transition-all"
            >
              <X className="w-3.5 h-3.5" />
              <span>{isUnemployed ? 'Recusar Todas e Aguardar' : 'Permanecer no Clube Atual'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
