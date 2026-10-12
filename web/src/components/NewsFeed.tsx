import React, { useState } from 'react';
import { useGame } from '../state/GameContext';
import { 
  Newspaper, 
  Flame, 
  Activity, 
  UserMinus, 
  ArrowLeftRight, 
  Trophy, 
  Calendar, 
  ArrowLeft, 
  Play, 
  Zap,
  TrendingUp,
  AlertTriangle,
  Award,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { NewsArticle, NewsCategory } from '../types';
import { sound } from '../audio/soundEngine';
import { getClubTheme } from '../theme/clubTheme';

export const NewsFeed: React.FC = () => {
  const { gameState, userClub, setScreen } = useGame();
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | 'all'>('all');
  const clubTheme = getClubTheme(userClub);

  const newsList = gameState.newsFeed || [];
  const currentRound = gameState.currentRound;

  const filteredNews = newsList.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const headlineArticle = filteredNews.find((a) => a.isHeadline) || filteredNews[0];
  const secondaryArticles = filteredNews.filter((a) => a.id !== headlineArticle?.id);

  const getCategoryMeta = (cat: NewsCategory) => {
    switch (cat) {
      case 'classico':
        return {
          label: 'Clássico & Rodada',
          icon: Flame,
          color: 'text-amber-400 bg-amber-950/70 border-amber-600/70',
        };
      case 'lesao':
        return {
          label: 'Depto. Médico',
          icon: Activity,
          color: 'text-rose-400 bg-rose-950/70 border-rose-600/70',
        };
      case 'demissao':
        return {
          label: 'Troca de Técnico',
          icon: UserMinus,
          color: 'text-orange-400 bg-orange-950/70 border-orange-600/70',
        };
      case 'transferencia':
        return {
          label: 'Mercado da Bola',
          icon: ArrowLeftRight,
          color: 'text-sky-400 bg-sky-950/70 border-sky-600/70',
        };
      default:
        return {
          label: 'Geral',
          icon: Newspaper,
          color: 'text-emerald-400 bg-emerald-950/70 border-emerald-600/70',
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--app-bg-deep)] p-4 h-[calc(100vh-3.5rem)] select-none overflow-hidden font-sans">
      {/* TRADITIONAL NEWSPAPER MASTHEAD */}
      <div className="bg-[var(--app-surface-1)] border-2 border-[var(--app-border-highlight)] rounded-lg p-3.5 shadow-xl mb-3 shrink-0 relative overflow-hidden">
        {/* Kit Stripe Top Accent Line */}
        <div 
          className="absolute top-0 left-0 right-0 h-1" 
          style={{ background: clubTheme.stripeGradient }} 
        />

        {/* Subtle Newspaper Vintage Border Lines */}
        <div className="border-b border-[var(--app-border-subtle)] pb-2 mb-2 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-3">
            <span className="font-mono-numbers font-bold text-[var(--app-text-accent)]">EDIÇÃO Nº {currentRound}</span>
            <span>•</span>
            <span>ANO XXIV • Nº 8.420</span>
            <span>•</span>
            <span>PREÇO DO EXEMPLAR: R$ 2,50</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => { sound.playClick(); setScreen('overview'); }}
              className="px-2 py-0.5 rounded bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] text-slate-300 hover:text-white border border-[var(--app-border-subtle)] text-[11px] font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Voltar (Esc)</span>
            </button>
            <button
              onClick={() => { sound.playClick(); setScreen('stats'); }}
              className="px-2.5 py-0.5 rounded bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] text-[var(--app-text-accent)] hover:text-white border border-[var(--app-border-highlight)] text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <Trophy className="w-3 h-3 text-[var(--app-text-accent)]" />
              <span>Ver Artilharia</span>
            </button>
            <button
              onClick={() => { sound.playWhistle(); setScreen('live_match'); }}
              className="px-3 py-0.5 rounded bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 text-black text-[11px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-md cursor-pointer active:scale-95 transition-all"
            >
              <Play className="w-3 h-3 fill-black" />
              <span>Jogar (Espaço)</span>
            </button>
          </div>
        </div>

        {/* Newspaper Big Header Banner */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-highlight)] flex items-center justify-center text-[var(--app-text-accent)] shadow-inner">
              <Newspaper className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-widest uppercase font-serif drop-shadow-sm">
                A GAZETA ESPORTIVA
              </h1>
              <p className="text-[11px] text-[var(--app-text-accent)] font-bold tracking-wider uppercase">
                O Jornal Oficial da Rodada • Cobertura Completa dos {gameState.clubs.length || 20} Clubes
              </p>
            </div>
          </div>

          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs bg-[var(--app-surface-2)] text-[var(--app-text-accent)] border border-[var(--app-border-highlight)] px-2 py-0.5 rounded font-mono font-bold">
              {gameState.divisionName || 'Série A'} • Temporada {gameState.seasonYear}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Rodada {currentRound} de {gameState.calendar.length > 0 ? Math.max(...gameState.calendar.map((f) => f.round)) : 38}
            </span>
          </div>
        </div>
      </div>

      {/* FILTER BUTTONS ROW */}
      <div className="bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg p-1.5 flex items-center space-x-1 shadow-xs mb-3 shrink-0 overflow-x-auto">
        {[
          { id: 'all', label: 'Todas as Notícias', icon: Newspaper },
          { id: 'classico', label: '🔥 Clássicos & Goleadas', icon: Flame },
          { id: 'lesao', label: '🚑 Departamento Médico', icon: Activity },
          { id: 'demissao', label: '👔 Troca de Técnicos', icon: UserMinus },
          { id: 'transferencia', label: '💼 Mercado da Bola', icon: ArrowLeftRight },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { sound.playClick(); setSelectedCategory(tab.id as any); }}
              style={
                isActive 
                  ? { 
                      backgroundColor: clubTheme.primaryAccent, 
                      color: clubTheme.onPrimaryAccent 
                    } 
                  : undefined
              }
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'shadow-inner'
                  : 'text-slate-300 hover:bg-[var(--app-surface-2)] hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* NEWSPAPER CONTENT: LEAD ARTICLE + SECONDARY ARTICLES */}
      <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
        {/* COLUMN 1 (7 COLS): LEAD HEADLINE ARTICLE */}
        <div className="col-span-12 lg:col-span-7 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-lg">
          {headlineArticle ? (
            <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-3">
              {/* Category & Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {(() => {
                    const meta = getCategoryMeta(headlineArticle.category);
                    const CatIcon = meta.icon;
                    return (
                      <span className={`flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded border ${meta.color}`}>
                        <CatIcon className="w-3 h-3" />
                        <span>{headlineArticle.badgeText || meta.label}</span>
                      </span>
                    );
                  })()}
                  <span className="text-[11px] text-slate-400 font-mono-numbers">
                    {headlineArticle.date}
                  </span>
                </div>

                {headlineArticle.statsHighlight && (
                  <span className="text-xs bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-[var(--app-text-accent)] font-mono font-bold px-2.5 py-0.5 rounded">
                    {headlineArticle.statsHighlight}
                  </span>
                )}
              </div>

              {/* Title & Subtitle */}
              <div>
                <h2 className="text-lg md:text-xl font-black text-white leading-tight font-serif uppercase tracking-tight">
                  {headlineArticle.title}
                </h2>
                <p className="text-xs md:text-sm text-[var(--app-text-accent)]/90 font-semibold mt-1 leading-snug">
                  {headlineArticle.subtitle}
                </p>
              </div>

              {/* Club Banner if applicable */}
              {(headlineArticle.clubName || headlineArticle.secondaryClubName) && (
                <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] rounded-lg p-3 flex items-center justify-around shadow-inner">
                  {headlineArticle.clubName && (
                    <div className="flex items-center space-x-2.5">
                      {headlineArticle.clubCrest ? (
                        <img
                          src={headlineArticle.clubCrest}
                          alt={headlineArticle.clubName}
                          className="w-10 h-10 object-contain drop-shadow"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[var(--app-surface-1)] border border-[var(--app-border-highlight)] flex items-center justify-center font-bold text-xs text-white">
                          {headlineArticle.clubName.substring(0, 3)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-white text-xs">{headlineArticle.clubName}</div>
                        <div className="text-[10px] text-slate-400">Destaque da Rodada</div>
                      </div>
                    </div>
                  )}

                  {headlineArticle.secondaryClubName && (
                    <>
                      <span className="font-serif font-black text-slate-500 text-sm">VS</span>
                      <div className="flex items-center space-x-2.5">
                        {headlineArticle.secondaryClubCrest ? (
                          <img
                            src={headlineArticle.secondaryClubCrest}
                            alt={headlineArticle.secondaryClubName}
                            className="w-10 h-10 object-contain drop-shadow"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                            {headlineArticle.secondaryClubName.substring(0, 3)}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white text-xs">{headlineArticle.secondaryClubName}</div>
                          <div className="text-[10px] text-slate-400">Adversário</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Main Body Text */}
              <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] rounded-lg p-3.5 space-y-2.5">
                <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-sans first-letter:text-2xl first-letter:font-bold first-letter:text-[var(--app-text-accent)] first-letter:mr-0.5">
                  {headlineArticle.content}
                </p>
              </div>

              {/* Editorial Quote Box */}
              <div 
                className="border-l-4 p-3 rounded-r-lg italic text-xs text-slate-300"
                style={{ 
                  borderLeftColor: clubTheme.primaryAccent,
                  backgroundColor: clubTheme.subtleBg 
                }}
              >
                "A disputa da Série A segue em ritmo alucinante. Quem vacilar nas próximas rodadas sentirá o peso da cobrança das arquibancadas."
                <div className="text-[10px] font-bold not-italic mt-1" style={{ color: clubTheme.primaryAccent }}>
                  — Redação Champs Manager
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              Nenhuma manchete disponível para esta categoria.
            </div>
          )}
        </div>

        {/* COLUMN 2 (5 COLS): SECONDARY ARTICLES FEED */}
        <div className="col-span-12 lg:col-span-5 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col overflow-hidden shadow-lg">
          <div className="px-3.5 py-2.5 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-[var(--app-text-accent)]" />
              <span>Outras Notícias da Semana ({secondaryArticles.length})</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono-numbers">Rodada {currentRound}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {secondaryArticles.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8 italic">
                Nenhum outro artigo publicado nesta rodada.
              </div>
            ) : (
              secondaryArticles.map((art) => {
                const meta = getCategoryMeta(art.category);
                const CatIcon = meta.icon;
                const isUserClub = art.clubName === userClub.name;

                return (
                  <div
                    key={art.id}
                    style={isUserClub ? { borderLeft: `3px solid ${clubTheme.primaryAccent}` } : undefined}
                    className="p-3 bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] hover:border-[var(--app-border-highlight)] rounded-lg transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center space-x-1 text-[10px] font-bold px-1.5 py-0.2 rounded border ${meta.color}`}>
                        <CatIcon className="w-2.5 h-2.5" />
                        <span>{art.badgeText || meta.label}</span>
                      </span>

                      <span className="text-[10px] text-slate-400 font-mono-numbers">
                        {art.date}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-xs leading-snug">
                      {art.title}
                    </h3>

                    <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                      {art.content}
                    </p>

                    {art.clubName && (
                      <div className="flex items-center space-x-1.5 pt-1 text-[10px] font-medium border-t border-[var(--app-border-subtle)]" style={{ color: isUserClub ? clubTheme.primaryAccent : undefined }}>
                        {art.clubCrest && (
                          <img src={art.clubCrest} alt="" className="w-3.5 h-3.5 object-contain" />
                        )}
                        <span className={isUserClub ? 'font-bold' : 'text-slate-300'}>{art.clubName}</span>
                        {art.relatedPlayerName && (
                          <>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-300">{art.relatedPlayerName} ({art.relatedPlayerPosition})</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
