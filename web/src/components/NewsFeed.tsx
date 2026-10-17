import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../state/GameContext';
import { 
  Newspaper, 
  Flame, 
  Activity, 
  UserMinus, 
  ArrowLeftRight, 
  Zap,
  TrendingUp,
  AlertTriangle,
  Award,
  Sparkles,
  ExternalLink,
  CheckCheck,
  Check,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { NewsArticle, NewsCategory } from '../types';
import { sound } from '../audio/soundEngine';
import { getClubTheme } from '../theme/clubTheme';
import { ClubCrest } from './ClubCrest';

export const NewsFeed: React.FC = () => {
  const { gameState, userClub, markNewsAsRead, markAllNewsAsRead } = useGame();
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | 'all'>('all');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const mainArticleRef = useRef<HTMLDivElement>(null);
  const clubTheme = getClubTheme(userClub);

  const newsList = gameState.newsFeed || [];
  const currentRound = gameState.currentRound;

  const filteredNews = newsList.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const totalUnreadAll = newsList.filter((a) => !a.read).length;

  // Active article to show in full detail
  const activeArticle = 
    filteredNews.find((a) => a.id === selectedArticleId) ||
    filteredNews.find((a) => a.isHeadline) ||
    filteredNews[0];

  const secondaryArticles = filteredNews.filter((a) => a.id !== activeArticle?.id);

  // Automatically mark the viewed article as read
  useEffect(() => {
    if (activeArticle && !activeArticle.read) {
      markNewsAsRead(activeArticle.id);
    }
  }, [activeArticle?.id, activeArticle?.read, markNewsAsRead]);

  const handleSelectArticle = (art: NewsArticle) => {
    sound.playClick();
    setSelectedArticleId(art.id);
    markNewsAsRead(art.id);
    mainArticleRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCategoryChange = (cat: NewsCategory | 'all') => {
    sound.playClick();
    setSelectedCategory(cat);
    if (selectedArticleId && cat !== 'all') {
      const art = newsList.find((a) => a.id === selectedArticleId);
      if (art && art.category !== cat) {
        setSelectedArticleId(null);
      }
    }
  };

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
    <div className="flex-1 flex flex-col bg-[var(--app-bg-deep)] p-3 sm:p-4 md:h-[calc(100vh-3.5rem)] select-none md:overflow-hidden md:min-h-0 font-sans pb-6 md:pb-0">
      {/* TRADITIONAL NEWSPAPER MASTHEAD */}
      <div className="bg-[var(--app-surface-1)] border-2 border-[var(--app-border-highlight)] rounded-lg p-3.5 shadow-xl mb-3 shrink-0 relative overflow-hidden">
        {/* Kit Stripe Top Accent Line */}
        <div 
          className="absolute top-0 left-0 right-0 h-1" 
          style={{ background: clubTheme.stripeGradient }} 
        />

        {/* Subtle Newspaper Vintage Border Lines */}
        <div className="border-b border-[var(--app-border-subtle)] pb-2 mb-2 flex flex-wrap gap-y-1.5 items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-3">
            <span className="font-mono-numbers font-bold text-[var(--app-text-accent)]">EDIÇÃO Nº {currentRound}</span>
            <span>•</span>
            <span>ANO XXIV • Nº 8.420</span>
            <span>•</span>
            <span>PREÇO DO EXEMPLAR: R$ 2,50</span>
          </div>

          <div className="flex items-center space-x-2">
            {totalUnreadAll > 0 ? (
              <span className="text-[11px] font-semibold text-amber-300 bg-amber-950/70 border border-amber-600/50 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>{totalUnreadAll} não lida{totalUnreadAll > 1 ? 's' : ''}</span>
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-600/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCheck className="w-3 h-3 text-emerald-400" />
                <span>Todas as notícias lidas</span>
              </span>
            )}

            {totalUnreadAll > 0 && (
              <button
                onClick={() => { sound.playClick(); markAllNewsAsRead(); }}
                className="px-2.5 py-0.5 rounded bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] text-slate-200 hover:text-white border border-[var(--app-border-subtle)] hover:border-[var(--app-border-highlight)] text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                title="Marcar todas as notícias como lidas e zerar as notificações do menu"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Marcar todas como lidas</span>
              </button>
            )}
          </div>
        </div>

        {/* Newspaper Big Header Banner */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-highlight)] flex items-center justify-center text-[var(--app-text-accent)] shadow-inner">
              <Newspaper className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-wider sm:tracking-widest uppercase font-serif drop-shadow-sm">
                A GAZETA ESPORTIVA
              </h1>
              <p className="text-[11px] text-[var(--app-text-accent)] font-bold tracking-wider uppercase">
                O Jornal Oficial da Rodada • Cobertura Completa dos {gameState.clubs.length || 20} Clubes
              </p>
            </div>
          </div>

          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs text-[var(--app-text-accent)] font-serif italic font-bold">
              "O diário mais lido dos gramados"
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
              onClick={() => handleCategoryChange(tab.id as any)}
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
      <div className="flex-1 grid grid-cols-12 gap-3 md:overflow-hidden md:min-h-0">
        {/* COLUMN 1 (7 COLS): LEAD / ACTIVELY OPEN ARTICLE */}
        <div 
          ref={mainArticleRef}
          className="col-span-12 lg:col-span-7 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col md:overflow-hidden md:min-h-0 shadow-lg"
        >
          {activeArticle ? (
            <div className="flex-1 flex flex-col md:overflow-y-auto p-4 space-y-3">
              {/* Category, Badge, Date & Read status */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  {(() => {
                    const meta = getCategoryMeta(activeArticle.category);
                    const CatIcon = meta.icon;
                    return (
                      <span className={`flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded border ${meta.color}`}>
                        <CatIcon className="w-3 h-3" />
                        <span>{activeArticle.badgeText || meta.label}</span>
                      </span>
                    );
                  })()}
                  <span className="text-[11px] text-slate-400 font-mono-numbers">
                    {activeArticle.date}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1 bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Notícia lida</span>
                  </span>

                  {activeArticle.statsHighlight && (
                    <span className="text-xs bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] text-[var(--app-text-accent)] font-mono font-bold px-2.5 py-0.5 rounded">
                      {activeArticle.statsHighlight}
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h2 className="text-xl md:text-xl font-black text-white leading-tight font-serif uppercase tracking-tight">
                  {activeArticle.title}
                </h2>
                <p className="text-sm text-[var(--app-text-accent)]/90 font-semibold mt-1 leading-snug">
                  {activeArticle.subtitle}
                </p>
              </div>

              {/* Club Banner if applicable */}
              {(activeArticle.clubName || activeArticle.secondaryClubName) && (
                <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] rounded-lg p-3 flex items-center justify-around shadow-inner">
                  {activeArticle.clubName && (
                    <div className="flex items-center space-x-2.5">
                      {activeArticle.clubCrest ? (
                        <ClubCrest
                          club={{ name: activeArticle.clubName, crestMiniUrl: activeArticle.clubCrest }}
                          preferMini
                          size="lg"
                          className="w-10 h-10"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[var(--app-surface-1)] border border-[var(--app-border-highlight)] flex items-center justify-center font-bold text-xs text-white">
                          {activeArticle.clubName.substring(0, 3)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-white text-xs">{activeArticle.clubName}</div>
                        <div className="text-[10px] text-slate-400">Destaque da Matéria</div>
                      </div>
                    </div>
                  )}

                  {activeArticle.secondaryClubName && (
                    <>
                      <span className="font-serif font-black text-slate-500 text-sm">VS</span>
                      <div className="flex items-center space-x-2.5">
                        {activeArticle.secondaryClubCrest ? (
                          <ClubCrest
                            club={{ name: activeArticle.secondaryClubName, crestMiniUrl: activeArticle.secondaryClubCrest }}
                            preferMini
                            size="lg"
                            className="w-10 h-10"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                            {activeArticle.secondaryClubName.substring(0, 3)}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white text-xs">{activeArticle.secondaryClubName}</div>
                          <div className="text-[10px] text-slate-400">Adversário</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Main Body Text (unclipped full story) */}
              <div className="bg-[var(--app-surface-2)] border border-[var(--app-border-subtle)] rounded-lg p-3.5 space-y-2.5">
                <p className="text-sm md:text-sm text-slate-200 leading-relaxed font-sans first-letter:text-2xl first-letter:font-bold first-letter:text-[var(--app-text-accent)] first-letter:mr-0.5 whitespace-pre-line">
                  {activeArticle.content}
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
                "A temporada segue a todo vapor nos gramados nacionais. Continue acompanhando cada lance e bastidor na Gazeta Esportiva."
                <div className="text-[10px] font-bold not-italic mt-1" style={{ color: clubTheme.primaryAccent }}>
                  — Redação Champs Manager
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              Nenhuma matéria disponível para esta categoria.
            </div>
          )}
        </div>

        {/* COLUMN 2 (5 COLS): SECONDARY ARTICLES FEED (CLICKABLE TO OPEN) */}
        <div className="col-span-12 lg:col-span-5 bg-[var(--app-surface-1)] border border-[var(--app-border-subtle)] rounded-lg flex flex-col md:overflow-hidden md:min-h-0 shadow-lg">
          <div className="px-3.5 py-2.5 bg-[var(--app-surface-2)] border-b border-[var(--app-border-subtle)] flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-[var(--app-text-accent)]" />
              <span>Outras Notícias da Semana ({secondaryArticles.length})</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono-numbers">Rodada {currentRound}</span>
          </div>

          <div className="flex-1 md:overflow-y-auto p-2.5 space-y-2">
            {secondaryArticles.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8 italic">
                {filteredNews.length <= 1 
                  ? 'Você está visualizando a única notícia publicada nesta categoria.' 
                  : 'Nenhum outro artigo publicado nesta categoria.'}
              </div>
            ) : (
              secondaryArticles.map((art) => {
                const meta = getCategoryMeta(art.category);
                const CatIcon = meta.icon;
                const isUserClub = art.clubName === userClub.name;
                const isRead = !!art.read;

                return (
                  <div
                    key={art.id}
                    onClick={() => handleSelectArticle(art)}
                    style={isUserClub ? { borderLeft: `3px solid ${clubTheme.primaryAccent}` } : undefined}
                    className={`p-3 rounded-lg transition-all space-y-1.5 cursor-pointer group border active:scale-[0.99] ${
                      isRead
                        ? 'bg-[var(--app-surface-2)]/60 hover:bg-[var(--app-surface-2)] border-[var(--app-border-subtle)] opacity-90 hover:opacity-100'
                        : 'bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-1)] border-[var(--app-border-highlight)] shadow-sm'
                    }`}
                    title="Clique para abrir e ler a notícia completa"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className={`inline-flex items-center space-x-1 text-[10px] font-bold px-1.5 py-0.2 rounded border ${meta.color}`}>
                          <CatIcon className="w-2.5 h-2.5" />
                          <span>{art.badgeText || meta.label}</span>
                        </span>

                        {!isRead ? (
                          <span className="inline-flex items-center space-x-1 text-[9px] font-black text-amber-300 bg-amber-950/80 border border-amber-600/50 px-1.5 py-0.2 rounded animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>NOVA</span>
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-semibold flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            <span>Lida</span>
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono-numbers">
                        {art.date}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-sm md:text-xs leading-snug group-hover:text-[var(--app-text-accent)] transition-colors">
                      {art.title}
                    </h3>

                    <p className="text-xs md:text-[11px] text-slate-300 leading-relaxed line-clamp-3 md:line-clamp-2">
                      {art.content}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[10px] border-t border-[var(--app-border-subtle)]">
                      {art.clubName ? (
                        <div className="flex items-center space-x-1.5 font-medium" style={{ color: isUserClub ? clubTheme.primaryAccent : undefined }}>
                          {art.clubCrest && (
                            <ClubCrest club={{ name: art.clubName, crestMiniUrl: art.clubCrest }} preferMini size="sm" className="w-3.5 h-3.5" />
                          )}
                          <span className={isUserClub ? 'font-bold' : 'text-slate-300'}>{art.clubName}</span>
                          {art.relatedPlayerName && (
                            <>
                              <span className="text-slate-500">•</span>
                              <span className="text-slate-300">{art.relatedPlayerName}</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-serif italic">Giro da Rodada</span>
                      )}

                      <span className="text-[10px] text-[var(--app-text-accent)] font-bold flex items-center space-x-0.5 group-hover:translate-x-0.5 transition-transform">
                        <span>Abrir</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
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
