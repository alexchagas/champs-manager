import React, { useEffect } from 'react';
import { Trophy, Medal, Award, ArrowRight, DollarSign } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { ChampionshipRecord } from '../types/index';
import { ClubCrest } from './ClubCrest';
import { sound } from '../audio/soundEngine';

interface Props {
  record: ChampionshipRecord;
  userClubId: number;
  onClose: () => void;
}

export const TournamentConclusionModal: React.FC<Props> = ({ record, userClubId, onClose }) => {
  const isChampion = record.championClubId === userClubId;
  const isRunnerUp = record.runnerUpClubId === userClubId;

  useEffect(() => {
    if (isChampion) {
      sound.playFanfare();
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        const timeout = setTimeout(() => {
          confetti({
            particleCount: 60,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
          });
          confetti({
            particleCount: 60,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
          });
        }, 300);
        return () => clearTimeout(timeout);
      } catch (e) {
        // Safe fallback if canvas not available
      }
    }
  }, [isChampion]);

  const formatCurrency = (val?: number) => {
    if (!val) return 'R$ 0';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div 
        className="relative w-full max-w-lg overflow-y-auto max-h-[90dvh] rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] shadow-2xl transition-all"
        style={
          isChampion
            ? { borderColor: 'var(--app-border-highlight)', boxShadow: '0 0 30px rgba(16, 185, 129, 0.15)' }
            : undefined
        }
      >
        {/* Glow Header Accent Strip */}
        <div 
          className={`h-1.5 w-full ${
            isChampion ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500' :
            isRunnerUp ? 'bg-gradient-to-r from-slate-300 via-zinc-100 to-slate-400' :
            'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
          }`} 
        />

        <div className="p-4 sm:p-6 space-y-4">
          {/* Header Tag & Title */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-slate-300">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>{record.competitionName} • Edição {record.seasonYear}</span>
            </div>

            {isChampion ? (
              <div className="space-y-0.5">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-400 drop-shadow uppercase">
                  É CAMPEÃO! 🏆
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-300">
                  Parabéns! Sua equipe conquistou a glória eterna com o título da competição!
                </p>
              </div>
            ) : isRunnerUp ? (
              <div className="space-y-0.5">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-200 uppercase">
                  VICE-CAMPEÃO! 🥈
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-300">
                  Grande campanha! Sua equipe chegou à grande final!
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
                  Torneio Concluído 🏆
                </h2>
                <p className="text-xs text-slate-400">
                  A disputa pelo título da competição foi encerrada.
                </p>
              </div>
            )}
          </div>

          {/* Winner Card Podium Banner */}
          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-around w-full">
              {/* Champion Column */}
              <div className="flex flex-col items-center text-center space-y-1.5">
                <div className="relative">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-[var(--app-bg-deep)] border border-amber-500/40 p-2 shadow-md">
                    <ClubCrest
                      club={{ name: record.championClubName, crestUrl: record.championClubCrest }}
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xs shadow-md">
                    1º
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-400 block">Campeão</span>
                  <h3 className="text-xs sm:text-sm font-bold text-white leading-tight max-w-[130px] truncate">{record.championClubName}</h3>
                </div>
              </div>

              {/* Final Score or VS */}
              <div className="flex flex-col items-center justify-center px-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Decisão</span>
                <div className="px-2.5 py-1 rounded bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] font-mono text-xs font-bold text-amber-300 whitespace-nowrap">
                  {record.finalScoreText || 'Final'}
                </div>
              </div>

              {/* Runner-up Column */}
              <div className="flex flex-col items-center text-center space-y-1.5 opacity-90">
                <div className="relative">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] p-2 shadow-sm">
                    <ClubCrest
                      club={{ name: record.runnerUpClubName, crestUrl: record.runnerUpClubCrest }}
                      className="w-10 h-10 object-contain"
                    />
                  </div>
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-400 text-slate-950 flex items-center justify-center font-bold text-[10px] shadow">
                    2º
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Vice</span>
                  <h4 className="text-xs font-semibold text-slate-300 leading-tight max-w-[120px] truncate">{record.runnerUpClubName}</h4>
                </div>
              </div>
            </div>
          </div>

          {/* Highlights & Top Scorer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {record.topScorerName && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)]">
                <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400 text-[10px] uppercase block font-semibold">Artilheiro</span>
                  <p className="text-slate-200 font-bold truncate">
                    {record.topScorerName} <span className="text-amber-400 font-mono">({record.topScorerGoals}g)</span>
                  </p>
                  {record.topScorerClubName && (
                    <span className="text-slate-400 text-[10px] truncate block">{record.topScorerClubName}</span>
                  )}
                </div>
              </div>
            )}

            {record.userPrizeMoney ? (
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-600/40">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-emerald-300 text-[10px] uppercase block font-semibold">Premiação</span>
                  <p className="text-emerald-100 font-bold text-xs sm:text-sm">
                    +{formatCurrency(record.userPrizeMoney)}
                  </p>
                  <span className="text-emerald-400 text-[10px]">Creditado no caixa</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)]">
                <div className="w-8 h-8 rounded-lg bg-[var(--app-bg-deep)] text-[var(--app-text-accent)] flex items-center justify-center shrink-0 border border-[var(--app-border-subtle)]">
                  <Medal className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block font-semibold">Desempenho</span>
                  <p className="text-slate-200 font-bold">
                    {record.userPositionText || 'Participante'}
                  </p>
                  <span className="text-slate-400 text-[10px]">{record.competitionName}</span>
                </div>
              </div>
            )}
          </div>

          {/* Continue Action */}
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="w-full py-2.5 px-6 rounded-lg font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 bg-[var(--app-text-accent)] hover:brightness-110 text-slate-950 shadow-md transition-all active:scale-98 cursor-pointer"
          >
            <span>Continuar Temporada</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TournamentConclusionModal;
