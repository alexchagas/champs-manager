import React, { useState } from 'react';
import { useGame } from '../state/GameContext';
import { 
  GraduationCap, 
  Users, 
  ArrowUpRight, 
  UserMinus, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Search,
  DollarSign,
  ChevronUp,
  ChevronDown,
  Info
} from 'lucide-react';
import { Player, Position } from '../types';
import { getClubTheme } from '../theme/clubTheme';
import { ClubCrest } from './ClubCrest';

export const YouthScreen: React.FC = () => {
  const { 
    userClub, 
    promoteYouthPlayer, 
    releaseYouthPlayer, 
    scoutYouthPlayer 
  } = useGame();

  const clubTheme = getClubTheme(userClub);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmDismissPlayer, setConfirmDismissPlayer] = useState<Player | null>(null);
  const [sortBy, setSortBy] = useState<'strength' | 'age' | 'salary' | 'marketValue' | 'position'>('strength');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const youthList = userClub.youth || [];

  // Squad and youth metrics
  const squadCount = userClub.squad.length;
  const isSeniorFull = squadCount >= 30;
  const weeklyYouthPayroll = Math.round(youthList.reduce((sum, p) => sum + p.salary, 0) / 4);
  const avgYouthStrength = youthList.length > 0 
    ? (youthList.reduce((sum, p) => sum + p.strength, 0) / youthList.length).toFixed(1)
    : '0';
  const avgYouthAge = youthList.length > 0 
    ? (youthList.reduce((sum, p) => sum + p.age, 0) / youthList.length).toFixed(1)
    : '0';

  const positionColors: Record<Position, string> = {
    GOL: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    LAT: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    ZAG: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    VOL: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    MEI: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    ATA: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  };

  const handlePromote = (player: Player) => {
    if (isSeniorFull) {
      setFeedback({
        type: 'error',
        message: 'O elenco profissional está lotado! O regulamento permite no máximo 30 atletas.',
      });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    const res = promoteYouthPlayer(player.id);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `${player.name} foi promovido ao elenco profissional com sucesso!`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Erro ao promover atleta.',
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleDismissConfirm = () => {
    if (!confirmDismissPlayer) return;
    const res = releaseYouthPlayer(confirmDismissPlayer.id);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `${confirmDismissPlayer.name} foi dispensado da base do clube.`,
      });
      setTimeout(() => setFeedback(null), 3500);
    }
    setConfirmDismissPlayer(null);
  };

  const handleScout = () => {
    if (youthList.length >= 15) {
      setFeedback({
        type: 'error',
        message: 'A base do clube já atingiu a capacidade máxima de 15 atletas.',
      });
      setTimeout(() => setFeedback(null), 3500);
      return;
    }

    const res = scoutYouthPlayer();
    if (res.success) {
      setFeedback({
        type: 'success',
        message: 'Novo jovem talento revelado pela peneira e integrado à base!',
      });
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Erro ao recrutar jovem atleta.',
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Sorting
  const sortedYouth = [...youthList].sort((a, b) => {
    let diff = 0;
    if (sortBy === 'strength') diff = b.strength - a.strength;
    else if (sortBy === 'age') diff = a.age - b.age;
    else if (sortBy === 'salary') diff = b.salary - a.salary;
    else if (sortBy === 'marketValue') diff = b.marketValue - a.marketValue;
    else if (sortBy === 'position') diff = a.position.localeCompare(b.position);
    return sortAsc ? -diff : diff;
  });

  const toggleSort = (field: 'strength' | 'age' | 'salary' | 'marketValue' | 'position') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:overflow-hidden bg-[var(--app-bg-deep)] p-3 gap-3 md:h-[calc(100vh-3.5rem)] md:min-h-0 select-none pb-6 md:pb-0">
      {/* TOP HEADER SUMMARY BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 shrink-0">
        {/* Atletas na Base */}
        <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Atletas na Base
            </span>
            <div className="text-lg font-black font-mono-numbers text-[var(--app-text-accent)]">
              {youthList.length} <span className="text-xs text-slate-400 font-normal">/ 15 vagas</span>
            </div>
            <span className="text-[10px] text-slate-400">
              Média de idade: {avgYouthAge} anos
            </span>
          </div>
          <div 
            className="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0"
            style={{ 
              backgroundColor: clubTheme.subtleBg, 
              borderColor: clubTheme.subtleBorder 
            }}
          >
            <GraduationCap className="w-5 h-5" style={{ color: clubTheme.primaryAccent }} />
          </div>
        </div>

        {/* Vagas no Profissional */}
        <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Elenco Profissional
            </span>
            <div className={`text-lg font-black font-mono-numbers ${isSeniorFull ? 'text-amber-400' : 'text-slate-100'}`}>
              {squadCount} <span className="text-xs text-slate-400 font-normal">/ 30 vagas</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {isSeniorFull ? 'Elenco lotado' : `${30 - squadCount} vagas livres para promoção`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-950/60 border border-sky-700/50 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-sky-400" />
          </div>
        </div>

        {/* Força Média da Base */}
        <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Força Média da Base
            </span>
            <div className="text-lg font-black text-amber-400 font-mono-numbers">
              {avgYouthStrength}
            </div>
            <span className="text-[10px] text-slate-400">
              Potencial de evolução alto
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-700/50 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        {/* Folha Salarial da Base */}
        <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-3 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Folha Semanal da Base
            </span>
            <div className="text-lg font-black text-rose-400 font-mono-numbers">
              -{formatMoney(weeklyYouthPayroll)}
            </div>
            <span className="text-[10px] text-slate-400">
              Debitado semanalmente no caixa
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-950/60 border border-rose-700/50 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-rose-400" />
          </div>
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

      {/* MAIN SQUAD TABLE CONTAINER */}
      <div className="flex-1 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-lg relative">
        {/* Kit Stripe Top Accent Line */}
        <div 
          className="h-1 w-full shrink-0" 
          style={{ background: clubTheme.stripeGradient }} 
        />

        {/* Table Toolbar Header */}
        <div className="px-3 py-2 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <ClubCrest club={userClub} size="sm" preferMini={true} className="w-4 h-4 shrink-0" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
              <span>Categorias de Base do {userClub.name}</span>
              <span 
                className="w-2 h-2 rounded-full inline-block" 
                style={{ backgroundColor: clubTheme.primaryAccent }} 
              />
              <span className="text-slate-400 text-[11px] font-normal">({youthList.length} Atletas)</span>
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            {/* Scouting Button */}
            <button
              onClick={handleScout}
              disabled={youthList.length >= 15 || userClub.balance < 50000}
              className="px-3 py-1 bg-[var(--app-surface-1)] hover:bg-[var(--app-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--app-border-highlight)] rounded text-[var(--app-text-accent)] font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Peneira de Novos Talentos (R$ 50k)</span>
            </button>
          </div>
        </div>

        {/* Dense Table */}
        <div className="flex-1 overflow-y-auto">
          {youthList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <GraduationCap className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="font-bold text-white text-sm">Nenhum atleta na base no momento.</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Realize uma peneira ou aguarde o relatório dos olheiros para recrutar novas promessas para o clube.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs brasfoot-table border-collapse">
              <thead>
                <tr className="sticky top-0 z-10 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)]">
                  <th 
                    onClick={() => toggleSort('position')}
                    className="w-14 text-center cursor-pointer hover:text-[var(--app-text-accent)]"
                  >
                    Pos {sortBy === 'position' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th>Nome do Atleta</th>
                  <th 
                    onClick={() => toggleSort('age')}
                    className="w-14 text-center cursor-pointer hover:text-[var(--app-text-accent)]"
                  >
                    Idade {sortBy === 'age' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th 
                    onClick={() => toggleSort('strength')}
                    className="w-20 text-center cursor-pointer hover:text-[var(--app-text-accent)]"
                  >
                    Força {sortBy === 'strength' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th className="w-12 text-center">Pé</th>
                  <th>Características</th>
                  <th 
                    onClick={() => toggleSort('salary')}
                    className="w-24 text-right cursor-pointer hover:text-emerald-300"
                  >
                    Salário {sortBy === 'salary' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th 
                    onClick={() => toggleSort('marketValue')}
                    className="w-28 text-right cursor-pointer hover:text-emerald-300"
                  >
                    Valor {sortBy === 'marketValue' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th className="w-56 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#14281f] font-mono-numbers">
                {sortedYouth.map((player) => {
                  const isTopWonderkid = player.strength >= 64;

                  return (
                    <tr 
                      key={player.id}
                      className="hover:bg-[#12241b] transition-colors"
                    >
                      {/* Position Badge */}
                      <td className="text-center py-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${positionColors[player.position]}`}>
                          {player.position}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-1.5 font-sans font-semibold text-slate-100">
                        <div className="flex items-center space-x-1.5">
                          <span>{player.name}</span>
                          {isTopWonderkid && (
                            <span className="px-1 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px] font-extrabold uppercase tracking-tight flex items-center space-x-0.5">
                              <Sparkles className="w-2.5 h-2.5 inline" />
                              <span>Joia</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Age */}
                      <td className="text-center py-1.5 text-slate-300 text-[11px]">
                        {player.age} anos
                      </td>

                      {/* Strength */}
                      <td className="text-center py-1.5">
                        <div className="flex items-center justify-center space-x-1.5">
                          <span className={`font-black text-xs ${
                            player.strength >= 65 ? 'text-emerald-300' : player.strength >= 50 ? 'text-white' : 'text-slate-300'
                          }`}>
                            {player.strength}
                          </span>
                          <div className="w-10 bg-[#0a1510] h-1.5 rounded-full overflow-hidden hidden sm:block">
                            <div 
                              className={`h-1.5 rounded-full ${
                                player.strength >= 65 ? 'bg-emerald-400' : player.strength >= 50 ? 'bg-sky-400' : 'bg-slate-500'
                              }`}
                              style={{ width: `${player.strength}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Foot */}
                      <td className="text-center py-1.5 text-slate-300 text-[11px]">
                        {player.foot}
                      </td>

                      {/* Skills */}
                      <td className="py-1.5 font-sans text-[11px] text-slate-300">
                        <span className="text-slate-200">{player.skill1}</span>
                        <span className="text-slate-500 mx-1">•</span>
                        <span className="text-slate-400">{player.skill2}</span>
                      </td>

                      {/* Salary */}
                      <td className="text-right py-1.5 text-slate-300 text-[11px]">
                        {formatMoney(player.salary)}/mês
                      </td>

                      {/* Market Value */}
                      <td className="text-right py-1.5 text-emerald-400 font-semibold text-[11px]">
                        {formatMoney(player.marketValue)}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-1.5 text-center">
                        <div className="flex items-center justify-center space-x-1.5 font-sans">
                          {/* Promote Button */}
                          <button
                            onClick={() => handlePromote(player)}
                            disabled={isSeniorFull}
                            style={!isSeniorFull ? { backgroundColor: clubTheme.primaryAccent, color: clubTheme.onPrimaryAccent } : undefined}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center space-x-1 transition-all ${
                              isSeniorFull
                                ? 'bg-[var(--app-surface-2)] text-slate-500 border border-[var(--app-border-subtle)] cursor-not-allowed'
                                : 'hover:brightness-110 active:scale-95 cursor-pointer shadow-xs'
                            }`}
                            title={isSeniorFull ? 'Elenco profissional lotado (30/30)' : 'Promover ao Profissional'}
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>Promover</span>
                          </button>

                          {/* Dismiss Button */}
                          <button
                            onClick={() => setConfirmDismissPlayer(player)}
                            className="px-2.5 py-1 rounded text-[11px] font-bold bg-[#1d1616] hover:bg-rose-900/80 text-rose-300 hover:text-white border border-[#3b2323] hover:border-rose-600 transition-all active:scale-95 cursor-pointer flex items-center space-x-1"
                            title="Dispensar da Base"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>Dispensar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Legend Footer */}
        <div className="px-3 py-1.5 bg-[#0a1510] border-t border-[#183225] flex items-center justify-between text-[10px] text-slate-400 shrink-0 font-sans">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <Info className="w-3 h-3 text-emerald-400" />
              <span>Atletas da base são promovidos com contrato profissional de 3 anos.</span>
            </span>
          </div>
          <div>
            <span>Limite máximo: <strong>15 atletas na base</strong> • <strong>30 no profissional</strong></span>
          </div>
        </div>
      </div>

      {/* DISMISS CONFIRMATION MODAL */}
      {confirmDismissPlayer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg max-w-sm w-full p-4 space-y-3 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center space-x-2 text-rose-400">
              <UserMinus className="w-5 h-5" />
              <h3 className="font-bold text-sm text-white">Dispensar Atleta da Base</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Deseja realmente dispensar o atleta <strong className="text-white">{confirmDismissPlayer.name}</strong> ({confirmDismissPlayer.position}, {confirmDismissPlayer.age} anos, Força {confirmDismissPlayer.strength}) das categorias de base?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[var(--app-border-subtle)]">
              <button
                onClick={() => setConfirmDismissPlayer(null)}
                className="px-3 py-1.5 bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] text-slate-300 rounded text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDismissConfirm}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold cursor-pointer shadow-md active:scale-95"
              >
                Confirmar Dispensa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
