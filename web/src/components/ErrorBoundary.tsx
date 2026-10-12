import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, MessageSquare } from 'lucide-react';
import { captureError } from '../observability/sentry';

interface Props {
  children: ReactNode;
  onOpenReport?: (errorDetails?: string) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureError(error, { componentStack: errorInfo.componentStack });
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0c1511] text-slate-100 p-6 select-none pt-safe pb-safe pl-safe pr-safe">
          <div className="w-full max-w-lg bg-[#111e18] border border-rose-900/60 rounded-2xl p-6 sm:p-8 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4 text-rose-400">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-digital uppercase text-slate-100">
                  Ops! Ocorreu um erro no jogo
                </h2>
                <p className="text-xs text-rose-300">
                  A simulação encontrou uma exceção inesperada.
                </p>
              </div>
            </div>

            <div className="bg-[#0c1511] border border-[#234234] rounded-xl p-3 text-xs font-mono text-slate-400 max-h-40 overflow-y-auto mb-6 whitespace-pre-wrap select-text">
              {this.state.error?.message || 'Erro desconhecido'}
              {this.state.errorInfo?.componentStack && (
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-800 pt-1">
                  {this.state.errorInfo.componentStack.slice(0, 300)}...
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#10b981] hover:bg-[#059669] text-black font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-[#10b981]/20 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recarregar Jogo</span>
              </button>

              {this.props.onOpenReport && (
                <button
                  onClick={() => this.props.onOpenReport?.(this.state.error?.message)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#15261f] hover:bg-[#1a3027] border border-[#2f5a46] text-slate-200 font-bold text-xs tracking-wider uppercase transition-all active:scale-95"
                >
                  <MessageSquare className="w-4 h-4 text-[#10b981]" />
                  <span>Reportar Bug</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
