export type Position = 'GOL' | 'LAT' | 'ZAG' | 'VOL' | 'MEI' | 'ATA';

export interface Player {
  id: number;
  name: string;
  age: number;
  position: Position;
  foot: 'D' | 'E' | 'A';
  strength: number; // 1-100
  energy: number; // 0-100
  salary: number;
  marketValue: number;
  isStarter: boolean;
  isStar: boolean;
  isWorldTop: boolean;
  skill1: string;
  skill2: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  injuryMatchesRemaining?: number;
  suspensionMatchesRemaining?: number;
  injured: boolean;
  suspended: boolean;
  contractYears?: number;
  listedForSale?: boolean;
  listedPrice?: number;
}

export type FormationType = '4-4-2' | '4-3-3' | '3-5-2' | '4-5-1' | '5-3-2';
export type Mentality = 'Muito Defensiva' | 'Defensiva' | 'Equilibrada' | 'Ofensiva' | 'Muito Ofensiva';
export type TacticalMentality = Mentality;

export interface ClubTactics {
  formation: FormationType;
  mentality: Mentality;
  penaltyTakerId: number;
  freeKickTakerId: number;
  cornerTakerId: number;
  captainId: number;
}

export interface CountryInfo {
  id: number;
  name: string;
  clubCount: number;
  divisionCount: number;
}

export interface LeagueInfo {
  countryId: number;
  countryName: string;
  name: string;
  division: number;
  divisionName: string;
  teamCount: number;
  clubIds: number[];
  relegated?: number;
}

export interface StateInfo {
  id: number;
  code: string;
  name: string;
  clubCount: number;
  clubIds: number[];
  divisions?: number;
}

export interface Club {
  id: number;
  name: string;
  fileRef?: string;
  countryId?: number;
  stateId?: number;
  stateCode?: string;
  stateName?: string;
  reputation: number; // 0 to 5 stars
  level?: number;
  stadium: string;
  capacity: number;
  coach: string;
  managerId?: string;
  boardPolicy?: 'cautious' | 'balanced' | 'ambitious';
  managerStrategy?: 'cautious' | 'balanced' | 'aggressive';
  overdueWages?: number;
  boardActions?: string[];
  primaryColor: string;
  secondaryColor: string;
  balance: number;
  ticketPrice: number;
  crestUrl: string;
  crestMiniUrl: string;
  division?: number;
  divisionName?: string;
  leagueName?: string;
  debt?: number;
  loans?: ClubLoan[];
  youth?: Player[];
  avgAttendance?: number;
  attendanceHistory?: number[];
  financialLedger?: FinancialEntry[];
  weeklyStatements?: WeeklyFinancialStatement[];
  namedSubstituteIds?: number[];
  squad: Player[];
  tactics: ClubTactics;
}

export interface ClubLoan {
  id: string;
  principal: number;
  totalToPay: number;
  remainingAmount: number;
  installmentAmount: number;
  remainingInstallments: number;
  totalInstallments: number;
  interestRate: number; // e.g. 0.08
  takenAtRound: number;
}

export interface FinancialEntry {
  id: string;
  round: number;
  type: 'income' | 'expense';
  category: 'bilheteria' | 'vendas_atletas' | 'compras_atletas' | 'salarios' | 'obras' | 'emprestimo' | 'manutencao' | 'outros';
  description: string;
  amount: number;
  timestamp?: number;
}

export interface WeeklyFinancialStatement {
  round: number;
  incomes: {
    bilheteria: number;
    vendasAtletas: number;
    emprestimos: number;
    total: number;
  };
  expenses: {
    salariosProfissional: number;
    salariosBase: number;
    obras: number;
    manutencao: number;
    parcelasEmprestimo: number;
    comprasAtletas: number;
    total: number;
  };
  net: number;
}


export interface StandingRow {
  clubId: number;
  clubName: string;
  primaryColor: string;
  group?: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  form: ('V' | 'E' | 'D')[];
}

export interface OtherLeagueStandings {
  id: string;
  countryId: number;
  countryName: string;
  countryFlag?: string;
  leagueName: string;
  division: number;
  seasonLabel: string;
  currentRound: number;
  totalRounds: number;
  standings: StandingRow[];
}

export type MatchEventType = 
  | 'goal' 
  | 'save' 
  | 'near_miss' 
  | 'yellow_card' 
  | 'red_card' 
  | 'corner' 
  | 'foul' 
  | 'halftime' 
  | 'fulltime' 
  | 'commentary' | 'injury' | 'substitution' | 'role_change' | 'penalty' | 'penalty_missed' | 'shootout_kick';

export interface MatchEvent {
  id: string;
  minute: number;
  type: MatchEventType;
  team: 'home' | 'away';
  title?: string;
  description: string;
  scorerName?: string;
  assistName?: string;
  scorerId?: number;
  assistId?: number;
  incomingId?: number;
  clock?: MatchClock;
}

export type CompetitionType = 'estadual' | 'nacional' | 'copa' | 'libertadores' | 'sulamericana' | 'champions' | 'copa_do_mundo' | 'supermundial' | 'intercontinental';
export type MatchDay = 'domingo' | 'segunda' | 'terça' | 'quarta' | 'quinta' | 'sexta' | 'sábado';

export interface WorldCupHostInfo {
  seasonYear: number;
  hosts: { countryId: number; name: string; flag: string; code: string }[];
  hostTitle: string;
  hostSlogan: string;
  logoTheme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    badgeStyle: string;
  };
  famousStadiums: string[];
}

export interface NationalTeam {
  id: number;
  name: string;
  countryId: number;
  code: string;
  reputation: number; // 1-5
  confederation?: 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC';
  flag: string;
  shirtUrl: string;
  shirt2Url?: string;
  isElite?: boolean;
  coach: string;
  squad: Player[];
  tactics?: ClubTactics;
}

export interface WorldCupGroup {
  groupLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  teamIds: number[];
  teams: NationalTeam[];
  standings: StandingRow[];
  fixtures: MatchFixture[];
}

export interface WorldCupTournament {
  seasonYear: number;
  status: 'upcoming' | 'groups' | 'round_of_16' | 'quarter_finals' | 'semi_finals' | 'final' | 'finished';
  drawCompleted?: boolean;
  hostInfo?: WorldCupHostInfo;
  groups: WorldCupGroup[];
  fixtures: MatchFixture[];
  champion?: { id: number; name: string; flag: string };
  runnerUp?: { id: number; name: string; flag: string };
  bestPlayer?: { id: number; name: string; nationalTeam: string };
  topScorer?: { id: number; name: string; goals: number; nationalTeam: string };
}

export interface SuperClubWorldCup {
  seasonYear: number;
  status: 'upcoming' | 'groups' | 'knockout' | 'finished';
  participantClubIds: number[];
  fixtures: MatchFixture[];
  champion?: { id: number; name: string };
  runnerUp?: { id: number; name: string };
}

export interface IntercontinentalCup {
  seasonYear: number;
  status: 'upcoming' | 'in_progress' | 'finished';
  participantClubIds: number[];
  fixtures: MatchFixture[];
  champion?: { id: number; name: string };
  runnerUp?: { id: number; name: string };
}

export interface NationalTeamOffer {
  id: number;
  nationalTeamId: number;
  nationalTeamName: string;
  countryId: number;
  code: string;
  flag: string;
  reputation: number;
  date: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface NationalCallup {
  playerId: number;
  playerName: string;
  clubId: number;
  countryId: number;
  nationalTeamName: string;
  tournamentName: string;
  marketValueBoostPercent: number;
  originalMarketValue: number;
  boostedMarketValue: number;
  date: string;
}

export interface MatchFixture {
  id: number;
  round: number;
  date?: string;
  fixtureDateIndex?: number;
  competitionRound?: string;
  pendingQualification?: boolean;
  homeClubId: number;
  awayClubId: number;
  homeScore?: number;
  awayScore?: number;
  played: boolean;
  events?: MatchEvent[];
  competitionType?: CompetitionType;
  competitionName?: string;
  stage?: string;
  dayOfWeek?: MatchDay;
  leg?: 1 | 2;
  aggregateScore?: [number, number];
  penaltyScore?: [number, number];
  matchRules?: Partial<MatchRules>;
}

export type AutoSaveMode = 'disabled' | 'every_3_matches' | 'every_match' | 'start_of_year' | 'legacy_continuous';

export interface GameOptions {
  soundEnabled: boolean;
  soundVolume: number; // 0.0 - 1.0
  simSpeed: 1 | 2 | 5; // 1x, 2x, 5x
  autoPauseOnGoal: boolean;
  autoSaveMode?: AutoSaveMode;
  liveScores?: 'hidden' | 'competition' | 'date';
}

export type NewsCategory = 'classico' | 'lesao' | 'demissao' | 'transferencia' | 'geral';

export interface NewsArticle {
  id: string;
  round: number;
  category: NewsCategory;
  title: string;
  subtitle: string;
  content: string;
  clubId?: number;
  clubName?: string;
  clubCrest?: string;
  secondaryClubName?: string;
  secondaryClubCrest?: string;
  relatedPlayerName?: string;
  relatedPlayerPosition?: Position;
  date: string;
  isHeadline?: boolean;
  badgeText?: string;
  statsHighlight?: string;
  read?: boolean;
}

export type ActiveScreen = 
  | 'splash'
  | 'menu' 
  | 'new_game' 
  | 'load_game' 
  | 'options' 
  | 'overview' 
  | 'tactics' 
  | 'transfers' 
  | 'live_match' 
  | 'round_results'
  | 'finances'
  | 'youth'
  | 'news'
  | 'stats'
  | 'managers'
  | 'club_viewer'
  | 'world_cup'
  | 'national_team_offer'
  | 'season_review'
  | 'champions_history';

export interface ChampionshipRecord {
  id: string;
  seasonYear: number;
  competitionType: 'estadual' | 'nacional' | 'copa' | 'libertadores' | 'sulamericana' | 'champions' | 'supercopa' | 'recopa' | 'mundial' | string;
  competitionName: string;
  championClubId: number;
  championClubName: string;
  championClubCrest?: string;
  runnerUpClubId: number;
  runnerUpClubName: string;
  runnerUpClubCrest?: string;
  topScorerName?: string;
  topScorerClubName?: string;
  topScorerGoals?: number;
  managerName?: string;
  finalScoreText?: string;
  userPositionText?: string;
  userPrizeMoney?: number;
  promotedClubNames?: string[];
  relegatedClubNames?: string[];
  promotedClubIds?: number[];
  relegatedClubIds?: number[];
}

export interface TransferOffer {
  id: number;
  fromClubId: number;
  fromClubName: string;
  toClubId: number;
  playerId: number;
  playerName: string;
  playerPosition: Position;
  playerStrength: number;
  fee: number;
  expiresRound?: number;
}

export interface RoundAuctionPlayer {
  id: number;
  player: Player;
  sellerClubId: number;
  sellerClubName: string;
  sellerClubCrest?: string;
  startingPrice: number;
  currentBid: number;
  highestBidderClubId?: number;
  highestBidderName?: string;
  minNextBid: number;
  completed?: boolean;
}

export interface ManagerJob {
  clubId: number;
  clubName: string;
  startSeason: number;
  startRound: number;
  endSeason?: number;
  endRound?: number;
  reason?: string;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  initialBalance: number;
  initialSquadValue: number;
  initialExpectation: number;
  initialOverdueWages: number;
  finalScore?: number;
}

export interface Manager {
  id: string;
  name: string;
  kind: 'human' | 'ai';
  reputation: number; // 0-100 percentage
  reputationLevel?: number; // 0 to 5 stars (0: Municipal, 1: Estadual, 2: Regional, 3: Nacional, 4: Continental, 5: Mundial)
  prestigePoints?: number; // internal prestige accumulator (nu in Brasfoot)
  boardRating: number; // 0-100, default initial 95
  fanRating?: number; // 0-100, default initial 85
  riskProfile: 'cautious' | 'balanced' | 'aggressive';
  currentClubId?: number;
  available: boolean;
  jobs: ManagerJob[];
  titles: string[];
  events: string[];
  seasonScore: number;
  careerScore: number;
  scoreComponents: { results: number; competitions: number; squad: number; finances: number };
  lastFiredClubId?: number | string;
  lastDivision?: number;
  unemployedRounds?: number;
}

export interface PendingDismissal {
  clubId: number;
  clubName: string;
  clubCrest?: string;
  reason: string;
  newManagerName: string;
  statsSummary?: string;
  round: number;
  seasonYear: number;
}

export interface ClubJobOffer {
  clubId: number;
  clubName: string;
  clubCrest?: string;
  division?: number;
  divisionName?: string;
  wage: number;
  prestigeRequirement?: number;
  expiresInRounds: number;
  clubReputation?: number;
  balance?: number;
  stadiumCapacity?: number;
  squadCount?: number;
  avgStrength?: number;
  tablePosition?: number;
}


export interface MarketFilter {
  position?: string;
  minStrength?: number;
  maxStrength?: number;
  minAge?: number;
  maxAge?: number;
  maxValue?: number;
  nameQuery?: string;
}

export interface MarketSearchResult {
  player: Player;
  clubId: number;
  clubName: string;
  askingPrice: number;
}

export interface SaveGameSlot {
  id: string;
  title: string;
  savedAt: string;
  userClubId: number;
  userClubName: string;
  managerName: string;
  seasonYear: number;
  currentRound: number;
  isAutoSave?: boolean;
  careerId?: string;
}

export interface GameState {
  careerId?: string;
  userClubId: number;
  managerName: string;
  humanManagerId?: string;
  managers?: Manager[];
  schemaVersion?: number;
  seasonYear: number;
  currentRound: number;
  currentSemester?: 1 | 2;
  autoSaveMatchCounter?: number;
  leagueName?: string;
  divisionName?: string;
  countryName?: string;
  activeCountryIds?: number[];
  stateChampionshipName?: string;
  nationalLeagueName?: string;
  continentalCupName?: string;
  clubs: Club[];
  calendar: MatchFixture[];
  standings: StandingRow[];
  standingsEstadual?: StandingRow[];
  standingsNacional?: StandingRow[];
  standingsContinental?: StandingRow[];
  nationalDivisions?: OtherLeagueStandings[];
  stateDivisions?: OtherLeagueStandings[];
  continentalCompetitions?: OtherLeagueStandings[];
  otherLeagues?: OtherLeagueStandings[];
  stateTier?: 1 | 2;
  promotedStateClubIds?: number[];
  relegatedStateClubIds?: number[];
  options: GameOptions;
  activeScreen: ActiveScreen;
  activeMatchFixtureId?: number;
  activeMatch?: ActiveMatchSession;
  freeAgents?: Player[];
  transferOffers?: TransferOffer[];
  roundAuctions?: RoundAuctionPlayer[];
  newsFeed?: NewsArticle[];
  nationalJob?: { nationalTeamId: number; nationalTeamName: string; countryId: number; code: string };
  isWorldCupMode?: boolean;
  worldCup?: WorldCupTournament;
  superClubWorldCup?: SuperClubWorldCup;
  intercontinentalCup?: IntercontinentalCup;
  nationalTeamOffers?: NationalTeamOffer[];
  nationalCallups?: NationalCallup[];
  championshipHistory?: ChampionshipRecord[];
  pendingTournamentConclusion?: ChampionshipRecord;
  pendingDismissal?: PendingDismissal;
  clubJobOffers?: ClubJobOffer[];
}

export interface MatchClock { period: number; minute: number; added: number; elapsed: number }
export interface MatchRules { benchLimit: number; substitutionLimit: number; opportunityLimit: number; extraTime: boolean; shootout: boolean; aggregate: [number, number] }
export interface MatchPlayer { id: number; name: string; position: Position; strength: number; energy: number; eligible: boolean }
export interface MatchSide {
  clubId: number; name: string; formation: FormationType; players: MatchPlayer[];
  starterIds: number[]; namedSubstituteIds: number[]; offSheetIds: number[];
  onFieldRoleByPlayerId: Record<string, Position>; temporaryGoalkeeperId: number | null;
  substitutionsUsed: number; opportunitiesUsed: number; lastOpportunity: number | null;
  unavailableIds: number[]; injuredIds: number[]; sentOffIds: number[]; usedSubstituteIds: number[];
  minutesPlayed: Record<string, number>; yellowCards: Record<string, number>;
  penaltyTakerId: number; freeKickTakerId: number; cornerTakerId: number;
}
export interface PendingMatchDecision {
  kind: 'injury' | 'penalty'; side: number; playerId: number | null;
  eligibleIds: number[]; defaultTakerId: number | null; severity: string | null;
}
export interface ActiveMatchSession {
  schemaVersion: number; fixtureId: number;
  phase: 'first_half' | 'halftime' | 'second_half' | 'extra_time' | 'shootout' | 'full_time' | 'committed';
  clock: MatchClock; paused: boolean; speed: 1 | 2 | 5; seed: number; rngState: number;
  humanSide: number | null; teams: [MatchSide, MatchSide]; rules: MatchRules;
  events: MatchEvent[]; score: [number, number];
  stats: { shots: [number, number]; shotsOnTarget: [number, number]; possession: [number, number]; corners: [number, number]; fouls: [number, number] };
  pendingDecision: PendingMatchDecision | null; parallelMatches: ActiveMatchSession[];
  penaltyScore: [number, number]; penaltyAttempts: [number, number]; shootoutUsedIds: [number[], number[]];
  committedAt: string | null;
}
export type MatchCommand = { type: 'start'; fixture_id: number } | { type: 'set_bench'; ids: number[] }
  | { type: 'advance' | 'pause' | 'resume' | 'finish' | 'fast_forward' | 'commit' | 'continue_without_replacement' | 'complete_cpu_date' }
  | { type: 'speed'; speed: number } | { type: 'substitute'; side: number; outgoing: number; incoming: number }
  | { type: 'choose_penalty_taker' | 'select_penalty_taker'; player_id: number };
