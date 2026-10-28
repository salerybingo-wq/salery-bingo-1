export type BingoLetter = 'B' | 'I' | 'N' | 'G' | 'O';

export interface BingoBall {
  number: number;
  letter: BingoLetter;
  id: string;
  calledAt?: number;
}

export interface CardCell {
  row: number;
  col: number;
  number: number;
  letter: BingoLetter;
  isFree: boolean;
  isDaubed: boolean;
  isWinningCell?: boolean;
}

export interface BingoCardModel {
  id: string;
  cardIndex: number;
  cells: CardCell[][];
  hasWon: boolean;
  winningPatternName?: string;
  numbersNeeded: number;
}

export type WinPatternType = 'line' | 'corners' | 'plus' | 'fullHouse';

export interface WinValidationResult {
  hasWon: boolean;
  patternType?: WinPatternType;
  patternName: string;
  winningCoordinates: Array<{ row: number; col: number }>;
  multiplier: number;
}

export type GameStatus = 'idle' | 'cartela_select' | 'countdown' | 'starting' | 'in_progress' | 'paused' | 'game_over';

export interface CompetitorPlayer {
  id: string;
  name: string;
  avatar: string;
  cardsCount: number;
  remainingToWin: number;
  hasWon?: boolean;
  winTime?: number;
}

export interface GameSettings {
  autoDaub: boolean;
  soundEnabled: boolean;
  voiceEnabled: boolean;
  callSpeedMs: number; // 2500, 4000, 6000
  selectedStake: number; // 10 Birr fixed per cartela
  cardsCount: number; // 1, 2, 3, 4
  language: 'am' | 'en' | 'om';
}

export interface UserProfile {
  telegramId: number;
  shareBonusAwarded?: boolean;
  firstName: string;
  username: string;
  phoneNumber?: string;
  balance: number;
  mainWallet?: number;
  playWallet?: number;
  totalGames: number;
  totalWins: number;
  totalWonAmount: number;
  role?: string;
  is_admin?: boolean;
  playerCode?: string;
  status?: 'active' | 'blocked';
  is_blocked?: boolean;
  ban_reason?: string;
}

export interface AdminUserRecord {
  id?: string | number;
  telegram_id: string | number;
  player_code: string;
  first_name?: string;
  full_name?: string;
  username?: string;
  phone_number?: string;
  balance: number;
  role?: string;
  status?: 'active' | 'blocked';
  is_blocked?: boolean;
  ban_reason?: string;
  is_verified?: boolean;
  total_games?: number;
  total_wins?: number;
  created_at?: string;
  updated_at?: string;
  recent_games?: PlayerGameHistory[];
}

export interface PlayerGameHistory {
  id: string;
  timestamp: number | string;
  game_code?: string;
  stake: number;
  cards_count: number;
  result: 'won' | 'lost';
  won_amount: number;
  pattern_name?: string;
  created_at?: string;
}

export interface TransactionRecord {
  id: string;
  telegram_id: string;
  player_name: string;
  player_code: string;
  phone_number?: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  reference?: string;
  screenshot_url?: string;
  photo_file_id?: string;
  created_at: string;
  notes?: string;
}
