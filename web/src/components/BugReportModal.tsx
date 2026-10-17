import React, { useState } from 'react';
import { X, Send, Copy, Check, Bug, MessageSquare, AlertCircle } from 'lucide-react';
import { sound } from '../audio/soundEngine';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameStateContext?: {
    userClubName?: string;
    currentRound?: number;
    activeScreen?: string;
  };
  initialErrorMessage?: string;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({
  isOpen,
  onClose,
  gameStateContext,
  initialErrorMessage,
}) => {
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedDiag, setCopiedDiag] = useState(false);

  if (!isOpen) return null;

  const diagnosticPayload = {
    timestamp: new Date().toISOString(),
    author: authorName.trim() || 'Jogador Anônimo',
    description: description.trim(),
    initialError: initialErrorMessage || null,
    gameContext: gameStateContext || null,
    device: {
      userAgent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      platform: (navigator as any).userAgentData?.platform || navigator.platform,
    },
  };

  const handleCopyDiagnostics = () => {
    sound.playClick();
    const formatted = `=== CHAMPS MANAGER BUG REPORT ===\nData: ${diagnosticPayload.timestamp}\nJogador: ${diagnosticPayload.author}\nDescrição: ${diagnosticPayload.description || 'N/A'}\nDispositivo: ${diagnosticPayload.device.userAgent}\nContexto: Clube: ${gameStateContext?.userClubName || 'N/A'}, Rodada: ${gameStateContext?.currentRound || 'N/A'}, Tela: ${gameStateContext?.activeScreen || 'N/A'}\nErro: ${initialErrorMessage || 'Nenhum'}\n=================================`;
    navigator.clipboard.writeText(formatted).then(() => {
      setCopiedDiag(true);
      setTimeout(() => setCopiedDiag(false), 2500);
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() && !initialErrorMessage) {
      setErrorMessage('Por favor, descreva o que aconteceu.');
      return;
    }

    setIsSending(true);
    setErrorMessage('');

    try {
      sound.playClick();
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diagnosticPayload),
      });

      if (res.ok) {
        sound.playIntroChime();
        setSendSuccess(true);
        setTimeout(() => {
          onClose();
          setSendSuccess(false);
          setDescription('');
        }, 2000);
      } else {
        throw new Error('Falha no envio');
      }
    } catch {
      // Friendly fallback: if the Cloudflare function is not configured yet, invite user to copy
      setErrorMessage(
        'Servidor de envio indisponível no momento. Use o botão "Copiar Relatório" abaixo para colar no WhatsApp ou Discord.'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none animate-fadeIn">
      <div className="w-full max-w-lg bg-[#111e18] border border-[#234234] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#234234] flex items-center justify-between bg-[#15261f]">
          <div className="flex items-center gap-2 text-[#10b981]">
            <Bug className="w-5 h-5" />
            <h3 className="font-bold font-digital uppercase tracking-wider text-slate-100 text-sm">
              Reportar Bug / Feedback
            </h3>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {sendSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#10b981]/20 border border-[#10b981] mx-auto flex items-center justify-center text-[#10b981]">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-100 text-base">Relatório enviado!</h4>
              <p className="text-xs text-slate-400">
                Obrigado pelo seu feedback! Vamos analisar para melhorar o Champs Manager.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              {initialErrorMessage && (
                <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300 font-mono">
                  <div className="font-bold mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Erro capturado:
                  </div>
                  <div className="truncate">{initialErrorMessage}</div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 select-none">
                  Seu Nome ou Apelido (opcional)
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Ex: Treinador Alex"
                  className="w-full px-3 py-2 bg-[#0c1511] border border-[#234234] focus:border-[#10b981] rounded-xl text-slate-100 text-base sm:text-sm placeholder:text-slate-600 outline-none select-text cursor-text"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 select-none">
                  O que aconteceu? <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Descreva o que você estava fazendo e o que deu errado (ou deixe uma sugestão)..."
                  className="w-full px-3 py-2 bg-[#0c1511] border border-[#234234] focus:border-[#10b981] rounded-xl text-slate-100 text-base sm:text-sm placeholder:text-slate-600 outline-none resize-none select-text cursor-text"
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-amber-950/40 border border-amber-900/60 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#10b981] hover:bg-[#059669] text-black font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-[#10b981]/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? 'Enviando...' : 'Enviar Relatório'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyDiagnostics}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#15261f] hover:bg-[#1f382b] border border-[#2f5a46] text-slate-200 font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
                >
                  {copiedDiag ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#10b981]" />
                      <span className="text-[#10b981]">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copiar Diagnóstico</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
