import React, { useState } from 'react';
import { useGame } from '../state/GameContext';
import { 
  Landmark, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Building2, 
  Users, 
  Hammer, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  AlertCircle,
  Percent,
  Wallet,
  Receipt,
  PiggyBank,
  ChevronRight,
  Minus,
  Plus
} from 'lucide-react';
import { sound } from '../audio/soundEngine';
import { getClubTheme } from '../theme/clubTheme';
import { ClubCrest } from './ClubCrest';

export const FinancesScreen: React.FC = () => {
  const { 
    gameState, 
    userClub, 
    takeLoan, 
    payOffLoan, 
    expandStadium,
    setTicketPrice,
    setScreen 
  } = useGame();

  const clubTheme = getClubTheme(userClub);

  const [loanAmount, setLoanAmount] = useState<number>(5000000);
  const [loanInstallments, setLoanInstallments] = useState<number>(10);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'stadium' | 'statement' | 'ledger'>('stadium');

  const [mobileFinanceTab, setMobileFinanceTab] = useState<'loans' | 'stadium'>('loans');

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Credit limit calculations
  const squadVal = userClub.squad.reduce((sum, p) => sum + p.marketValue, 0);
  const maxCreditLimit = Math.max(10000000, Math.round(userClub.capacity * 350 + squadVal * 0.25));
  const currentDebt = userClub.debt || 0;
  const availableCredit = Math.max(0, maxCreditLimit - currentDebt);

  // Interest rate based on installments
  const rate = loanInstallments === 10 ? 0.08 : loanInstallments === 15 ? 0.12 : 0.15;
  const totalToPay = Math.round(loanAmount * (1 + rate));
  const weeklyInstallment = Math.round(totalToPay / loanInstallments);

  // Wage bill calculations
  const weeklySeniorPayroll = Math.round(userClub.squad.reduce((acc, p) => acc + p.salary, 0) / 4);
  const weeklyYouthPayroll = Math.round((userClub.youth || []).reduce((acc, p) => acc + p.salary, 0) / 4);
  const weeklyTotalPayroll = weeklySeniorPayroll + weeklyYouthPayroll;
  const stadiumMaintenance = Math.round(userClub.capacity * 2.2);

  // Active loans
  const activeLoans = userClub.loans || [];
  const projectedCash = userClub.balance + Math.round((userClub.avgAttendance || userClub.capacity * 0.65) * userClub.ticketPrice / 2) - weeklyTotalPayroll - stadiumMaintenance - activeLoans.reduce((sum, l) => sum + Math.min(l.installmentAmount, l.remainingAmount), 0);

  // Most recent weekly statement
  const latestStatement = userClub.weeklyStatements && userClub.weeklyStatements.length > 0
    ? userClub.weeklyStatements[0]
    : {
        round: gameState.currentRound,
        incomes: {
          bilheteria: Math.round(userClub.capacity * 0.76 * (userClub.ticketPrice || 40)),
          vendasAtletas: 0,
          emprestimos: 0,
          total: Math.round(userClub.capacity * 0.76 * (userClub.ticketPrice || 40)),
        },
        expenses: {
          salariosProfissional: weeklySeniorPayroll,
          salariosBase: weeklyYouthPayroll,
          obras: 0,
          manutencao: stadiumMaintenance,
          parcelasEmprestimo: activeLoans.reduce((sum, l) => sum + l.installmentAmount, 0),
          comprasAtletas: 0,
          total: weeklySeniorPayroll + weeklyYouthPayroll + stadiumMaintenance + activeLoans.reduce((sum, l) => sum + l.installmentAmount, 0),
        },
        net: Math.round(userClub.capacity * 0.76 * (userClub.ticketPrice || 40)) - (weeklySeniorPayroll + weeklyYouthPayroll + stadiumMaintenance + activeLoans.reduce((sum, l) => sum + l.installmentAmount, 0)),
      };

  const handleTakeLoan = () => {
    if (loanAmount <= 0) return;
    const res = takeLoan(loanAmount, loanInstallments);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Empréstimo de ${formatMoney(loanAmount)} creditado com sucesso em ${loanInstallments}x!`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Erro ao contratar empréstimo.',
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handlePayOff = (loanId: string) => {
    const res = payOffLoan(loanId);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: 'Empréstimo quitado antecipadamente com desconto de 5%!',
      });
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Erro ao quitar empréstimo.',
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Stadium & Match-day projections
  const avgAttendance = userClub.avgAttendance ?? Math.round(userClub.capacity * 0.76);
  const occupancyRate = Math.min(100, Math.round((avgAttendance / userClub.capacity) * 100));

  const currentTicketPrice = userClub.ticketPrice || 40;
  const priceElasticity = Math.max(0.2, Math.min(0.98, 1.15 - (currentTicketPrice / 125)));
  const expectedAttendance = Math.min(userClub.capacity, Math.round(userClub.capacity * priceElasticity));
  const expectedOccupancy = Math.round((expectedAttendance / userClub.capacity) * 100);
  const estimatedTicketIncome = Math.round(expectedAttendance * currentTicketPrice);

  const handleExpand = (seats: 2000 | 5000 | 10000) => {
    sound.playClick();
    const res = expandStadium(seats);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Estádio expandido com sucesso! (+${seats.toLocaleString('pt-BR')} lugares)`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Erro ao expandir estádio.',
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--app-bg-deep)] p-3 gap-3 h-[calc(100vh-3.5rem)] select-none">
      <div className="rounded border border-amber-800/80 bg-amber-950/40 px-3 py-2 text-xs text-amber-100 shrink-0 shadow-xs">
        <strong>Obrigações:</strong> salários atrasados {formatMoney(userClub.overdueWages || 0)} · dívida {formatMoney(currentDebt)} · próxima folha e manutenção {formatMoney(weeklyTotalPayroll + stadiumMaintenance)} · caixa projetado por rodada {formatMoney(projectedCash)}.
        {(userClub.boardActions || []).length > 0 && <span> Diretoria: {(userClub.boardActions || []).join('; ')}.</span>}
      </div>
      {/* TOP HEADER SUMMARY BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 shrink-0">
        {/* Saldo em Caixa */}
        <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider truncate">
              Saldo em Caixa
            </span>
            <div className="w-7 h-7 rounded-md bg-emerald-950/70 border border-emerald-700/50 flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
          <div className={`text-base sm:text-lg xl:text-xl font-black font-mono-numbers truncate py-0.5 ${userClub.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} title={formatMoney(userClub.balance)}>
            {formatMoney(userClub.balance)}
          </div>
          <span className="text-[10px] text-slate-400 truncate block">
            Disponível para operações
          </span>
        </div>

        {/* Dívida Bancária Total */}
        <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider truncate">
              Dívida Bancária
            </span>
            <div className="w-7 h-7 rounded-md bg-amber-950/70 border border-amber-700/50 flex items-center justify-center shrink-0">
              <Landmark className="w-3.5 h-3.5 text-amber-400" />
            </div>
          </div>
          <div className={`text-base sm:text-lg xl:text-xl font-black font-mono-numbers truncate py-0.5 ${currentDebt > 0 ? 'text-amber-400' : 'text-slate-300'}`} title={formatMoney(currentDebt)}>
            {formatMoney(currentDebt)}
          </div>
          <span className="text-[10px] text-slate-400 truncate block">
            {activeLoans.length} {activeLoans.length === 1 ? 'empréstimo ativo' : 'empréstimos ativos'}
          </span>
        </div>

        {/* Folha Salarial Semanal */}
        <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider truncate">
              Folha Semanal
            </span>
            <div className="w-7 h-7 rounded-md bg-rose-950/70 border border-rose-700/50 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-rose-400" />
            </div>
          </div>
          <div className="text-base sm:text-lg xl:text-xl font-black text-rose-400 font-mono-numbers truncate py-0.5" title={formatMoney(weeklyTotalPayroll)}>
            -{formatMoney(weeklyTotalPayroll)}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 font-mono-numbers truncate">
            <span>Prof: {formatMoney(weeklySeniorPayroll)}</span>
            <span>•</span>
            <span>Base: {formatMoney(weeklyYouthPayroll)}</span>
          </div>
        </div>

        {/* Limite de Crédito Disponível */}
        <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider truncate">
              Crédito Disponível
            </span>
            <div className="w-7 h-7 rounded-md bg-sky-950/70 border border-sky-700/50 flex items-center justify-center shrink-0">
              <CreditCard className="w-3.5 h-3.5 text-sky-400" />
            </div>
          </div>
          <div className="text-base sm:text-lg xl:text-xl font-black text-sky-400 font-mono-numbers truncate py-0.5" title={formatMoney(availableCredit)}>
            {formatMoney(availableCredit)}
          </div>
          <span className="text-[10px] text-slate-400 truncate block">
            Teto máximo: {formatMoney(maxCreditLimit)}
          </span>
        </div>
      </div>

      {/* FEEDBACK TOAST */}
      {feedback && (
        <div
          className={`px-3 py-2 rounded text-xs flex items-center space-x-2 border shrink-0 animate-in fade-in transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/80 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="font-semibold">{feedback.message}</span>
        </div>
      )}

      {/* MOBILE / TABLET PANEL SWITCHER (< 1024px) */}
      <div className="lg:hidden flex bg-[var(--app-surface-2)] p-1 rounded-lg border border-[var(--app-border-subtle)] shrink-0 gap-1">
        <button
          onClick={() => { setMobileFinanceTab('loans'); sound.playClick(); }}
          className={`flex-1 min-h-[40px] px-3 py-1.5 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
            mobileFinanceTab === 'loans'
              ? 'shadow-xs border border-[var(--app-border-highlight)]'
              : 'text-slate-400 hover:text-white'
          }`}
          style={mobileFinanceTab === 'loans' ? { color: clubTheme.onPrimaryAccent, backgroundColor: clubTheme.primaryAccent } : undefined}
        >
          <Landmark className="w-4 h-4" />
          <span>Empréstimos & Dívidas</span>
        </button>

        <button
          onClick={() => { setMobileFinanceTab('stadium'); sound.playClick(); }}
          className={`flex-1 min-h-[40px] px-3 py-1.5 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
            mobileFinanceTab === 'stadium'
              ? 'shadow-xs border border-[var(--app-border-highlight)]'
              : 'text-slate-400 hover:text-white'
          }`}
          style={mobileFinanceTab === 'stadium' ? { color: clubTheme.onPrimaryAccent, backgroundColor: clubTheme.primaryAccent } : undefined}
        >
          <Building2 className="w-4 h-4" />
          <span>Estádio & Finanças</span>
        </button>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE (TABS ON TABLET/MOBILE, SIDE-BY-SIDE ON DESKTOP >= 1024px) */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-3 overflow-hidden min-h-0">
        {/* COLUMN 1: SISTEMA DE EMPRÉSTIMO BANCÁRIO (COL 1-6) */}
        <div className={`col-span-12 lg:col-span-6 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-lg relative min-h-0 ${mobileFinanceTab === 'loans' ? 'flex flex-1' : 'hidden lg:flex'}`}>
          <div className="h-1 w-full shrink-0" style={{ background: clubTheme.stripeGradient }} />
          <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <Landmark className="w-4 h-4 text-[var(--app-text-accent)]" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Empréstimos Bancários & Financiamentos
              </h2>
            </div>
            <span className="text-[10px] text-[var(--app-text-accent)] font-mono-numbers font-semibold">
              Taxas: 8% a 15%
            </span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3.5 text-xs">
            {/* NOVO EMPRÉSTIMO BOX */}
            <div className="bg-[var(--app-surface-2)] p-3 rounded-lg border border-[var(--app-border-subtle)] space-y-3 shadow-inner">
              <div className="flex items-center justify-between border-b border-[var(--app-border-subtle)] pb-1.5">
                <span className="font-bold text-slate-100 flex items-center space-x-1.5">
                  <PiggyBank className="w-4 h-4 text-amber-400" />
                  <span>Simulador de Novo Empréstimo</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  Limite: <strong className="text-sky-300 font-mono-numbers">{formatMoney(availableCredit)}</strong>
                </span>
              </div>

              {/* Slider & Quick Buttons for Amount */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 text-[11px]">Valor a Solicitar:</span>
                  <span className="font-black font-mono-numbers text-sm text-[var(--app-text-accent)] bg-[var(--app-surface-1)] px-2 py-0.5 rounded border border-[var(--app-border-subtle)]">
                    {formatMoney(loanAmount)}
                  </span>
                </div>

                <input
                  type="range"
                  min="500000"
                  max={Math.max(1000000, availableCredit)}
                  step="500000"
                  value={loanAmount}
                  disabled={availableCredit <= 0}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full cursor-pointer h-1.5 bg-[var(--app-surface-1)] rounded"
                  style={{ accentColor: clubTheme.primaryAccent }}
                />

                <div className="flex items-center gap-1.5 pt-1">
                  {[1000000, 3000000, 5000000, 10000000].map((val) => (
                    <button
                      key={val}
                      onClick={() => setLoanAmount(Math.min(val, availableCredit))}
                      disabled={availableCredit < val}
                      className={`text-[10px] px-2 py-1 rounded font-mono font-bold transition-all ${
                        loanAmount === val
                          ? 'shadow-xs'
                          : 'bg-[var(--app-surface-1)] text-slate-300 hover:bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] disabled:opacity-30 disabled:cursor-not-allowed'
                      }`}
                      style={
                        loanAmount === val
                          ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent }
                          : undefined
                      }
                    >
                      {val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}k`}
                    </button>
                  ))}
                  <button
                    onClick={() => setLoanAmount(availableCredit)}
                    disabled={availableCredit <= 0}
                    className="text-[10px] px-2 py-1 rounded font-mono font-extrabold bg-[var(--app-surface-1)] text-[var(--app-text-accent)] hover:border-[var(--app-border-highlight)] border border-[var(--app-border-subtle)] ml-auto disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Máximo
                  </button>
                </div>
              </div>

              {/* Installments Option */}
              <div className="space-y-1.5 pt-1">
                <span className="text-slate-300 text-[11px] block">Plano de Pagamento:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { count: 10, juros: '8% juros', label: '10 Semanas' },
                    { count: 15, juros: '12% juros', label: '15 Semanas' },
                    { count: 20, juros: '15% juros', label: '20 Semanas' },
                  ].map((plan) => (
                    <button
                      key={plan.count}
                      onClick={() => setLoanInstallments(plan.count)}
                      className={`p-2 rounded border text-center transition-all ${
                        loanInstallments === plan.count
                          ? 'border-2 shadow-xs'
                          : 'bg-[var(--app-surface-1)] border-[var(--app-border-subtle)] text-slate-300 hover:bg-[var(--app-surface-2)]'
                      }`}
                      style={
                        loanInstallments === plan.count
                          ? { borderColor: clubTheme.primaryAccent, backgroundColor: clubTheme.subtleBg }
                          : undefined
                      }
                    >
                      <div className="font-bold text-[11px]">{plan.label}</div>
                      <div className="text-[10px] text-amber-300 font-mono font-semibold">{plan.juros}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculation Summary Box */}
              <div className="bg-[var(--app-surface-1)] p-2.5 rounded border border-[var(--app-border-subtle)] space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total a Pagar (com juros):</span>
                  <span className="font-mono-numbers font-bold text-white">{formatMoney(totalToPay)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Parcela Semanal (por rodada):</span>
                  <span className="font-mono-numbers font-bold text-amber-300">
                    {formatMoney(weeklyInstallment)} / sem
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleTakeLoan}
                disabled={availableCredit <= 0 || loanAmount <= 0 || loanAmount > availableCredit}
                className="w-full min-h-[44px] py-2.5 disabled:opacity-40 disabled:cursor-not-allowed font-extrabold rounded text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                style={
                  availableCredit > 0 && loanAmount > 0 && loanAmount <= availableCredit
                    ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent }
                    : { backgroundColor: '#162d20', color: '#64748b' }
                }
              >
                <Landmark className="w-4 h-4" />
                <span>Contratar Empréstimo de {formatMoney(loanAmount)}</span>
              </button>
            </div>

            {/* EMPRÉSTIMOS ATIVOS SECTION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Empréstimos Bancários Ativos ({activeLoans.length})</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Dívida restante: <strong className="text-rose-400 font-mono-numbers">{formatMoney(currentDebt)}</strong>
                </span>
              </div>

              {activeLoans.length === 0 ? (
                <div className="bg-[var(--app-surface-2)] p-4 rounded border border-[var(--app-border-subtle)] text-center text-slate-400 space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                  <div className="font-semibold text-slate-200">Sem dívidas ativas</div>
                  <div className="text-[11px]">Seu clube está com a saúde financeira em dia!</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeLoans.map((loan) => {
                    const paidCount = loan.totalInstallments - loan.remainingInstallments;
                    const progressPct = Math.round((paidCount / loan.totalInstallments) * 100);
                    const payoffCost = Math.round(loan.remainingAmount * 0.95);
                    const canPayoff = userClub.balance >= payoffCost;

                    return (
                      <div
                        key={loan.id}
                        className="bg-[var(--app-surface-2)] p-2.5 rounded border border-[var(--app-border-subtle)] space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-bold text-white text-xs">
                              Empréstimo de {formatMoney(loan.principal)}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Tomado na Rodada {loan.takenAtRound} • Juros: {(loan.interestRate * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono-numbers font-bold text-amber-300 block">
                              {formatMoney(loan.remainingAmount)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono-numbers">
                              {loan.remainingInstallments}x de {formatMoney(loan.installmentAmount)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar of Installments */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono-numbers">
                            <span>Parcelas: {paidCount} / {loan.totalInstallments} pagas</span>
                            <span>{progressPct}% quitado</span>
                          </div>
                          <div className="w-full bg-[var(--app-surface-1)] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-400 h-1.5 rounded-full transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Quitação Antecipada CTA */}
                        <div className="pt-1 flex justify-between items-center border-t border-[var(--app-border-subtle)]">
                          <span className="text-[10px] text-slate-400">
                            Quitar agora: <strong className="text-emerald-300 font-mono-numbers">{formatMoney(payoffCost)}</strong> (-5% desconto)
                          </span>
                          <button
                            onClick={() => handlePayOff(loan.id)}
                            disabled={!canPayoff}
                            className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                              canPayoff
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs active:scale-95'
                                : 'bg-[var(--app-surface-1)] text-slate-500 border border-[var(--app-border-subtle)] cursor-not-allowed'
                            }`}
                          >
                            Quitar Antecipado
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2: ESTÁDIO, DEMONSTRATIVO SEMANAL E EXTRATO (COL 7-12) */}
        <div className={`col-span-12 lg:col-span-6 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-lg relative min-h-0 ${mobileFinanceTab === 'stadium' ? 'flex flex-1' : 'hidden lg:flex'}`}>
          <div className="h-1 w-full shrink-0" style={{ background: clubTheme.stripeGradient }} />
          <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center space-x-2 truncate">
              {activeTab === 'stadium' ? (
                <Building2 className="w-4 h-4 text-[var(--app-text-accent)] shrink-0" />
              ) : activeTab === 'statement' ? (
                <Receipt className="w-4 h-4 text-[var(--app-text-accent)] shrink-0" />
              ) : (
                <CreditCard className="w-4 h-4 text-[var(--app-text-accent)] shrink-0" />
              )}
              <h2 className="text-xs font-bold text-white uppercase tracking-wider truncate">
                {activeTab === 'stadium'
                  ? 'Estádio, Ingressos & Expansão'
                  : activeTab === 'statement'
                  ? 'Demonstrativo Semanal & Balancete'
                  : 'Extrato Financeiro Recente'}
              </h2>
            </div>
            <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar shrink-0">
              <button
                onClick={() => setActiveTab('stadium')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  activeTab === 'stadium'
                    ? 'shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                style={
                  activeTab === 'stadium'
                    ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent }
                    : undefined
                }
              >
                Estádio & Ingressos
              </button>
              <button
                onClick={() => setActiveTab('statement')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  activeTab === 'statement'
                    ? 'shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                style={
                  activeTab === 'statement'
                    ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent }
                    : undefined
                }
              >
                Demonstrativo
              </button>
              <button
                onClick={() => setActiveTab('ledger')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                style={
                  activeTab === 'ledger'
                    ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent }
                    : undefined
                }
              >
                Extrato
              </button>
            </div>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
            {activeTab === 'stadium' ? (
              <div className="space-y-3">
                {/* STADIUM OVERVIEW & AVERAGE ATTENDANCE CARD */}
                <div className="bg-[var(--app-surface-2)] p-3 rounded-lg border border-[var(--app-border-subtle)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded bg-[var(--app-bg-deep)] border border-[var(--app-border-subtle)] flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-[var(--app-text-accent)]" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs">{userClub.stadium}</div>
                        <div className="text-[10px] text-slate-400">Estádio Oficial</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono-numbers text-[var(--app-text-accent)] font-extrabold text-sm">
                        {userClub.capacity.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-[10px] text-slate-400">capacidade atual</div>
                    </div>
                  </div>

                  {/* Average Attendance Bar */}
                  <div className="bg-[var(--app-bg-deep)] p-2 rounded border border-[var(--app-border-subtle)] space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-300 flex items-center space-x-1">
                        <Users className="w-3 h-3 text-[var(--app-text-accent)]" />
                        <span>Média de Público Recente:</span>
                      </span>
                      <span className="text-white font-mono-numbers font-bold">
                        {avgAttendance.toLocaleString('pt-BR')} pagantes{' '}
                        <span className="text-emerald-400 font-semibold">({occupancyRate}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-[var(--app-surface-1)] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(5, occupancyRate))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* TICKET PRICE CONTROL (PREÇO DO INGRESSO) */}
                <div className="bg-[var(--app-surface-2)] p-3 rounded-lg border border-[var(--app-border-subtle)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                      <DollarSign className="w-4 h-4 text-[var(--app-text-accent)]" />
                      <span>Preço do Ingresso (R$)</span>
                    </span>
                    <span className="text-sm font-mono-numbers font-black text-[var(--app-text-accent)] bg-[var(--app-bg-deep)] px-2.5 py-0.5 rounded border border-[var(--app-border-subtle)]">
                      R$ {currentTicketPrice},00
                    </span>
                  </div>

                  {/* Stepper and Slider */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setTicketPrice(Math.max(10, currentTicketPrice - 5))}
                      disabled={currentTicketPrice <= 10}
                      className="p-1.5 bg-[var(--app-bg-deep)] hover:bg-[var(--app-surface-1)] disabled:opacity-30 disabled:cursor-not-allowed border border-[var(--app-border-subtle)] rounded text-slate-200 font-bold active:scale-95 transition-all cursor-pointer"
                      title="Diminuir R$ 5"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="range"
                      min="10"
                      max="150"
                      step="5"
                      value={currentTicketPrice}
                      onChange={(e) => setTicketPrice(Number(e.target.value))}
                      className="flex-1 cursor-pointer h-1.5 bg-[var(--app-bg-deep)] rounded"
                      style={{ accentColor: clubTheme.primaryAccent }}
                    />

                    <button
                      onClick={() => setTicketPrice(Math.min(200, currentTicketPrice + 5))}
                      disabled={currentTicketPrice >= 200}
                      className="p-1.5 bg-[var(--app-bg-deep)] hover:bg-[var(--app-surface-1)] disabled:opacity-30 disabled:cursor-not-allowed border border-[var(--app-border-subtle)] rounded text-slate-200 font-bold active:scale-95 transition-all cursor-pointer"
                      title="Aumentar R$ 5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center space-x-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 mr-1">Atalhos:</span>
                    {[25, 40, 60, 80].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setTicketPrice(preset)}
                        className={`text-[10px] px-2.5 py-1 rounded font-mono font-bold transition-all cursor-pointer ${
                          currentTicketPrice === preset
                            ? 'shadow-xs'
                            : 'bg-[var(--app-bg-deep)] text-slate-300 hover:bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)]'
                        }`}
                        style={
                          currentTicketPrice === preset
                            ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent }
                            : undefined
                        }
                      >
                        R$ {preset}
                      </button>
                    ))}
                  </div>

                  {/* Impact Preview */}
                  <div className="bg-[var(--app-bg-deep)] p-2.5 rounded border border-[var(--app-border-subtle)] flex justify-between text-[11px] text-slate-300">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Ocupação Estimada:</span>
                      <span className="font-bold text-white font-mono-numbers">
                        {expectedOccupancy}% ({expectedAttendance.toLocaleString('pt-BR')} pagantes)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 text-[10px] block">Renda Estimada / Partida:</span>
                      <span className="font-bold text-emerald-400 font-mono-numbers">
                        +{formatMoney(estimatedTicketIncome)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* STADIUM EXPANSION OPTIONS */}
                <div className="bg-[var(--app-surface-2)] p-3 rounded-lg border border-[var(--app-border-subtle)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                      <Hammer className="w-4 h-4 text-amber-400" />
                      <span>Obras & Expansão de Lugares</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Débito Direto do Caixa</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* +2.000 lugares */}
                    <button
                      onClick={() => handleExpand(2000)}
                      disabled={userClub.balance < 3000000}
                      className={`p-2.5 rounded border flex flex-col items-center justify-center transition-all ${
                        userClub.balance >= 3000000
                          ? 'bg-[var(--app-surface-1)] hover:bg-[var(--app-surface-2)] border-[var(--app-border-subtle)] text-white hover:border-[var(--app-border-highlight)] active:scale-95 cursor-pointer shadow-xs'
                          : 'bg-[var(--app-bg-deep)] border-[var(--app-border-subtle)] text-slate-500 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <span className="font-black text-xs text-[var(--app-text-accent)]">+2.000</span>
                      <span className="text-[10px] text-slate-400 font-medium">lugares</span>
                      <span className="text-[11px] font-mono-numbers font-bold text-amber-300 mt-1">
                        R$ 3,0M
                      </span>
                    </button>

                    {/* +5.000 lugares */}
                    <button
                      onClick={() => handleExpand(5000)}
                      disabled={userClub.balance < 7000000}
                      className={`p-2.5 rounded border flex flex-col items-center justify-center transition-all ${
                        userClub.balance >= 7000000
                          ? 'bg-[var(--app-surface-1)] hover:bg-[var(--app-surface-2)] border-[var(--app-border-subtle)] text-white hover:border-[var(--app-border-highlight)] active:scale-95 cursor-pointer shadow-xs'
                          : 'bg-[var(--app-bg-deep)] border-[var(--app-border-subtle)] text-slate-500 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <span className="font-black text-xs text-[var(--app-text-accent)]">+5.000</span>
                      <span className="text-[10px] text-slate-400 font-medium">lugares</span>
                      <span className="text-[11px] font-mono-numbers font-bold text-amber-300 mt-1">
                        R$ 7,0M
                      </span>
                    </button>

                    {/* +10.000 lugares */}
                    <button
                      onClick={() => handleExpand(10000)}
                      disabled={userClub.balance < 13000000}
                      className={`p-2.5 rounded border flex flex-col items-center justify-center transition-all ${
                        userClub.balance >= 13000000
                          ? 'bg-[var(--app-surface-1)] hover:bg-[var(--app-surface-2)] border-[var(--app-border-subtle)] text-white hover:border-[var(--app-border-highlight)] active:scale-95 cursor-pointer shadow-xs'
                          : 'bg-[var(--app-bg-deep)] border-[var(--app-border-subtle)] text-slate-500 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <span className="font-black text-xs text-[var(--app-text-accent)]">+10.000</span>
                      <span className="text-[10px] text-slate-400 font-medium">lugares</span>
                      <span className="text-[11px] font-mono-numbers font-bold text-amber-300 mt-1">
                        R$ 13,0M
                      </span>
                    </button>
                  </div>
                </div>

                {/* Financial Flow Breakdown */}
                <div className="bg-[var(--app-surface-2)] p-3 rounded-lg border border-[var(--app-border-subtle)] space-y-2">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider border-b border-[var(--app-border-subtle)] pb-1">
                    Projeção por Partida em Casa
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-300 flex items-center space-x-1.5">
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Renda de Bilheteria (Estimada):</span>
                      </span>
                      <span className="text-emerald-400 font-mono-numbers font-semibold">
                        +{formatMoney(estimatedTicketIncome)}
                      </span>
                    </div>

                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-300 flex items-center space-x-1.5">
                        <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                        <span>Folha Salarial Semanal (Prof. + Base):</span>
                      </span>
                      <span className="text-rose-400 font-mono-numbers font-semibold">
                        -{formatMoney(weeklyTotalPayroll)}
                      </span>
                    </div>

                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-300 flex items-center space-x-1.5">
                        <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                        <span>Manutenção do Estádio:</span>
                      </span>
                      <span className="text-rose-400 font-mono-numbers font-semibold">
                        -{formatMoney(stadiumMaintenance)}
                      </span>
                    </div>

                    <div className="pt-1.5 border-t border-[var(--app-border-subtle)] flex justify-between font-bold text-xs">
                      <span className="text-white">Resultado Líquido Estimado:</span>
                      <span className={`font-mono-numbers ${estimatedTicketIncome - weeklyTotalPayroll - stadiumMaintenance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {estimatedTicketIncome - weeklyTotalPayroll - stadiumMaintenance >= 0 ? '+' : ''}{formatMoney(estimatedTicketIncome - weeklyTotalPayroll - stadiumMaintenance)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'statement' ? (
              <div className="space-y-3">
                {/* Statement Header Card */}
                <div className="bg-[var(--app-surface-2)] p-3 rounded-lg border border-[var(--app-border-subtle)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Demonstrativo Financeiro da Rodada {latestStatement.round}
                    </span>
                    <div className="text-xs text-slate-300">
                      Competência da semana atual
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Resultado Semanal:</span>
                    <span className={`text-sm font-black font-mono-numbers ${latestStatement.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {latestStatement.net >= 0 ? '+' : ''}{formatMoney(latestStatement.net)}
                    </span>
                  </div>
                </div>

                {/* INFLOWS / RECEITAS */}
                <div className="bg-[var(--app-surface-2)] p-3 rounded-lg border border-[var(--app-border-subtle)] space-y-2">
                  <div className="flex items-center justify-between border-b border-[var(--app-border-subtle)] pb-1">
                    <span className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center space-x-1">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Receitas da Semana</span>
                    </span>
                    <span className="font-mono-numbers font-extrabold text-emerald-400">
                      +{formatMoney(latestStatement.incomes.total)}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-300">Renda de Bilheteria (Partida em Casa):</span>
                      <span className="font-mono-numbers text-emerald-400 font-semibold">
                        +{formatMoney(latestStatement.incomes.bilheteria)}
                      </span>
                    </div>

                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-300">Venda de Jogadores:</span>
                      <span className="font-mono-numbers text-emerald-400 font-semibold">
                        +{formatMoney(latestStatement.incomes.vendasAtletas)}
                      </span>
                    </div>

                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-300">Empréstimos Bancários Contratados:</span>
                      <span className="font-mono-numbers text-emerald-400 font-semibold">
                        +{formatMoney(latestStatement.incomes.emprestimos)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* OUTFLOWS / DESPESAS */}
                <div className="bg-[var(--app-surface-2)] p-3 rounded-lg border border-[var(--app-border-subtle)] space-y-2">
                  <div className="flex items-center justify-between border-b border-[var(--app-border-subtle)] pb-1">
                    <span className="font-bold text-rose-400 uppercase tracking-wider text-[11px] flex items-center space-x-1">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span>Despesas da Semana</span>
                    </span>
                    <span className="font-mono-numbers font-extrabold text-rose-400">
                      -{formatMoney(latestStatement.expenses.total)}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-300">Salários do Elenco Profissional:</span>
                      <span className="font-mono-numbers text-rose-400 font-semibold">
                        -{formatMoney(latestStatement.expenses.salariosProfissional)}
                      </span>
                    </div>

                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-300">Salários das Categorias de Base (Juniores):</span>
                      <span className="font-mono-numbers text-rose-400 font-semibold">
                        -{formatMoney(latestStatement.expenses.salariosBase)}
                      </span>
                    </div>

                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-300">Obras & Expansão do Estádio:</span>
                      <span className="font-mono-numbers text-rose-400 font-semibold">
                        -{formatMoney(latestStatement.expenses.obras)}
                      </span>
                    </div>

                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-300">Manutenção & Operação do Estádio:</span>
                      <span className="font-mono-numbers text-rose-400 font-semibold">
                        -{formatMoney(latestStatement.expenses.manutencao)}
                      </span>
                    </div>

                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-300">Parcelas de Empréstimos Bancários:</span>
                      <span className="font-mono-numbers text-rose-400 font-semibold">
                        -{formatMoney(latestStatement.expenses.parcelasEmprestimo)}
                      </span>
                    </div>

                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-300">Contratação de Atletas:</span>
                      <span className="font-mono-numbers text-rose-400 font-semibold">
                        -{formatMoney(latestStatement.expenses.comprasAtletas)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* NET RESULT BANNER */}
                <div className={`p-3 rounded-lg border flex items-center justify-between ${
                  latestStatement.net >= 0 
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200' 
                    : 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                }`}>
                  <div>
                    <span className="font-black uppercase tracking-wider text-xs block">
                      {latestStatement.net >= 0 ? 'Superávit Semanal' : 'Déficit Semanal'}
                    </span>
                    <span className="text-[10px] text-slate-300">
                      Variação líquida aplicada no caixa ao término da rodada
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-base font-mono-numbers">
                      {latestStatement.net >= 0 ? '+' : ''}{formatMoney(latestStatement.net)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* TRANSACTION LEDGER VIEW */
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Extrato Financeiro Recente
                </span>

                {(userClub.financialLedger || []).length === 0 ? (
                  <div className="bg-[var(--app-surface-2)] p-4 rounded border border-[var(--app-border-subtle)] text-center text-slate-400">
                    Nenhuma transação financeira registrada nesta temporada ainda.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {(userClub.financialLedger || []).map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-[var(--app-surface-2)] p-2 rounded border border-[var(--app-border-subtle)] flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <span
                            className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                              entry.type === 'income'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60'
                                : 'bg-rose-950 text-rose-400 border border-rose-700/60'
                            }`}
                          >
                            {entry.type === 'income' ? (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-200 text-[11px] truncate block">
                              {entry.description}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Rodada {entry.round} • {entry.category.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`font-mono-numbers font-bold text-xs shrink-0 ${
                            entry.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {entry.type === 'income' ? '+' : '-'}{formatMoney(entry.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
