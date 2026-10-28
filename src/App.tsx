import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BingoBall,
  BingoCardModel,
  GameSettings,
  GameStatus,
  UserProfile,
  WinValidationResult
} from './types';
import {
  generateBingoCard,
  generateCartelaByNumber,
  checkCardWinningPatterns,
  calculateNumbersNeeded,
  getLetterForNumber,
  getGlobalBingoCycle,
  getDeterministicRoundDeck
} from './utils/bingoLogic';
import { sounds } from './utils/audio';
import { translations } from './utils/translations';
import { Header } from './components/Header';
import { CallerBoard } from './components/CallerBoard';
import { BingoCardView } from './components/BingoCardView';
import { GameControls } from './components/GameControls';
import { WinModal } from './components/WinModal';
import { RulesModal } from './components/RulesModal';
import { StatsModal } from './components/StatsModal';
import { LobbyView } from './components/LobbyView';
import { CartelaSelectionView } from './components/CartelaSelectionView';
import { GamePlayView } from './components/GamePlayView';
import { BottomNav, NavTab } from './components/BottomNav';
import { ScoresView } from './components/ScoresView';
import { HistoryView, GameHistoryItem } from './components/HistoryView';
import { WalletView } from './components/WalletView';
import { ProfileView } from './components/ProfileView';
import { AdminPanelView } from './components/AdminPanelView';
import { BannedUserView } from './components/BannedUserView';
import { AlertCircle, ArrowLeft, Flame } from 'lucide-react';
import { BingoRoomSnapshot, BingoSocket, connectBingoSocket, emitBingoWithAck, BingoJoinResult, BingoClaimResult, GLOBAL_BINGO_ROOM_ID } from './utils/bingoSocket';
import { clearLegacyLocalRoomId } from './utils/roomStorage';
import { getBingoGuestSession, syncUserRegistration } from './utils/api';

const STORAGE_KEY = 'salery_bingo_user_profile';
const HISTORY_KEY = 'salery_bingo_game_history';

function readStoredRoomTicket() {
  if (typeof window === 'undefined') {
    return { joined: false, requested: false, cardIds: [] as number[], walletType: 'main_wallet' as const, joinRequestId: null as string | null };
  }
  try {
    const storedCardIds = JSON.parse(localStorage.getItem('salery_bingo_room_card_ids') || '[]');
    return {
      joined: localStorage.getItem('salery_bingo_has_joined_room_once') === 'true',
      requested: localStorage.getItem('salery_bingo_active_room_requested') === 'true',
      cardIds: Array.isArray(storedCardIds)
        ? storedCardIds.filter((id): id is number => Number.isInteger(id) && id >= 1 && id <= 400)
        : [],
      walletType: localStorage.getItem('salery_bingo_room_wallet_type') === 'play_wallet' ? 'play_wallet' as const : 'main_wallet' as const,
      joinRequestId: localStorage.getItem('salery_bingo_room_join_request_id'),
    };
  } catch (error) {
    console.error('Could not restore the saved bingo ticket:', error);
    return { joined: false, requested: false, cardIds: [] as number[], walletType: 'main_wallet' as const, joinRequestId: null as string | null };
  }
}

export function checkIsAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const rawPath = window.location.pathname || '';
    const cleanPath = rawPath.toLowerCase().replace(/\/+$/, '');
    const rawHash = (window.location.hash || '').toLowerCase();
    const href = (window.location.href || '').toLowerCase();
    const params = new URLSearchParams(window.location.search || '');

    if (
      href.includes('view=admin') ||
      href.includes('/admin') ||
      href.includes('#admin') ||
      href.includes('tab=admin') ||
      href.includes('panel=admin') ||
      href.includes('admin=true') ||
      href.includes('admin=1')
    ) {
      return true;
    }

    if (
      cleanPath === '/admin' ||
      cleanPath.startsWith('/admin/') ||
      cleanPath.endsWith('/admin')
    ) {
      return true;
    }

    if (
      rawHash === '#admin' ||
      rawHash === '#/admin' ||
      rawHash.startsWith('#admin') ||
      rawHash.startsWith('#/admin') ||
      rawHash.includes('admin')
    ) {
      return true;
    }

    if (
      params.get('admin') === 'true' ||
      params.get('admin') === '1' ||
      params.get('view') === 'admin' ||
      params.get('tab') === 'admin' ||
      params.get('panel') === 'admin'
    ) {
      return true;
    }
  } catch {}
  return false;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('game');
  const [showAdminPanel, setShowAdminPanel] = useState(() => checkIsAdminRoute());

  const handleOpenAdminPanel = () => {
    if (!isAdmin) return;
    sounds.playBeep(true);
    setShowAdminPanel(true);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '#admin');
    }
  };

  const handleCloseAdminPanel = () => {
    sounds.playBeep(false);
    setShowAdminPanel(false);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '#');
    }
  };

  // 1. User Account State (Loaded from localStorage or initialized with persistent unique ID)
  const [user, setUser] = useState<UserProfile>(() => {
    let persistentId = 1000000001;
    if (typeof window !== 'undefined') {
      const storedPlayerId = localStorage.getItem('salery_bingo_player_id') || localStorage.getItem('salery_bingo_unique_id');
      const parsedPlayerId = Number(storedPlayerId);
      if (storedPlayerId && Number.isSafeInteger(parsedPlayerId) && parsedPlayerId > 0) {
        persistentId = parsedPlayerId;
      } else {
        const randomValues = new Uint32Array(2);
        crypto.getRandomValues(randomValues);
        const randomValue = (randomValues[0] & 0x001fffff) * 0x100000000 + randomValues[1];
        persistentId = 1000000000000000 + (randomValue % 8000000000000000);
        localStorage.setItem('salery_bingo_unique_id', String(persistentId));
      }
      localStorage.setItem('salery_bingo_player_id', String(persistentId));
    }

    const defaultPlayerCode = `SB-${((Math.abs(persistentId) * 17) % 90000) + 10000}`;
    const defaultBalance = 0;

    let initialProfile: UserProfile = {
      telegramId: persistentId,
      firstName: 'Player',
      username: `player_${String(persistentId).slice(-4)}`,
      playerCode: defaultPlayerCode,
      phoneNumber: '',
      balance: defaultBalance,
      mainWallet: defaultBalance,
      playWallet: 0,
      shareBonusAwarded: false,
      role: 'user',
      status: 'active',
      is_blocked: false,
      totalGames: 0,
      totalWins: 0,
      totalWonAmount: 0
    };

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        initialProfile = {
          ...initialProfile,
          ...parsed,
          telegramId: persistentId,
          firstName: 'Player',
          username: `player_${String(persistentId).slice(-4)}`,
          playerCode: defaultPlayerCode,
          balance: 0,
          mainWallet: 0,
          playWallet: 0,
          shareBonusAwarded: parsed.shareBonusAwarded ?? false,
          role: 'user',
          status: 'active',
          is_blocked: false,
          ban_reason: undefined,
        };
      } catch {}
    }
    return initialProfile;
  });
  const isAdmin =
    String(user.telegramId) === '5873620165' ||
    String(user.telegramId) === '908336796' ||
    user.role === 'admin';

  useEffect(() => {
    const handleHashChange = () => {
      setShowAdminPanel(isAdmin && checkIsAdminRoute());
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, [isAdmin]);

  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  const refreshUserData = useCallback(async () => {
    setIsRefreshingBalance(true);
    try {
      const session = await getBingoGuestSession();
      setUser((previous) => ({
        ...previous,
        telegramId: session.playerId,
        balance: session.mainWallet,
        mainWallet: session.mainWallet,
        playWallet: session.playWallet,
        playerCode: session.playerCode || previous.playerCode,
      }));
    } catch (error) {
      console.error('Could not refresh the server-authoritative wallet balance:', error);
    } finally {
      setIsRefreshingBalance(false);
    }
  }, []);

  // 2. Game History State
  const [history, setHistory] = useState<GameHistoryItem[]>(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  // Save profile and history changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  // 3. Game Settings
  const [settings, setSettings] = useState<GameSettings>({
    autoDaub: true,
    soundEnabled: true,
    voiceEnabled: true,
    callSpeedMs: 3000,
    selectedStake: 10, // Default to 10 as shown in screenshot
    cardsCount: 2,
    language: 'am'
  });

  // Sync sounds singleton with settings
  useEffect(() => {
    sounds.soundEnabled = settings.soundEnabled;
    sounds.voiceEnabled = settings.voiceEnabled;
  }, [settings.soundEnabled, settings.voiceEnabled]);

  // 4. Game Engine State
  const [status, setStatus] = useState<GameStatus>('idle');
  const [isSpectator, setIsSpectator] = useState(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [currentBall, setCurrentBall] = useState<BingoBall | null>(null);
  const [calledBalls, setCalledBalls] = useState<BingoBall[]>([]);
  const [calledSet, setCalledSet] = useState<Set<number>>(new Set());
  const [cards, setCards] = useState<BingoCardModel[]>([]);
  const [prizePool, setPrizePool] = useState<number>(0);
  const [activeGameId, setActiveGameId] = useState(GLOBAL_BINGO_ROOM_ID);
  const [roomStartsAt, setRoomStartsAt] = useState<number>(0);
  const [roomPlayers, setRoomPlayers] = useState<Array<{ name: string; cardsCount: number; isOnline?: boolean }>>([]);

  // 5. Modals State
  const [showWinModal, setShowWinModal] = useState(false);
  const [winResult, setWinResult] = useState<WinValidationResult | null>(null);
  const [wonAmount, setWonAmount] = useState(0);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [winnerInfo, setWinnerInfo] = useState<{
    winnerId?: string;
    winnerName?: string;
    cardId?: number;
    prize?: number;
    isMe?: boolean;
  } | null>(null);
  const claimInFlightRef = useRef(false);
  const lastProcessedWinnerGameIdRef = useRef<string | null>(null);

  const t = translations[settings.language];
  const [socketInstance, setSocketInstance] = useState<BingoSocket | null>(null);
  const gameSocketRef = useRef<BingoSocket | null>(null);
  const storedRoomTicket = readStoredRoomTicket();
  const activeRoomRequestedRef = useRef(storedRoomTicket.requested && storedRoomTicket.cardIds.length > 0);
  const hasJoinedRoomOnceRef = useRef(storedRoomTicket.joined && storedRoomTicket.cardIds.length > 0);
  const roomCardIdsRef = useRef(storedRoomTicket.cardIds);
  const roomWalletTypeRef = useRef<'main_wallet' | 'play_wallet'>(storedRoomTicket.walletType);
  const roomJoinRequestIdRef = useRef<string | null>(storedRoomTicket.joinRequestId);
  const currentPlayerIdRef = useRef(user.telegramId);
  const settingsRef = useRef(settings);
  const lastCalledNumberRef = useRef<number | null>(null);
  const lastReceivedDrawRef = useRef<string | null>(null);
  const hasPlayedBingoAudioThisRoundRef = useRef(false);
  const lastCreditedWinnerGameIdRef = useRef<string | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  settingsRef.current = settings;
  currentPlayerIdRef.current = user.telegramId;
  const handleClaimBingoRef = useRef<((card: BingoCardModel) => void) | null>(null);

  useEffect(() => {
    clearLegacyLocalRoomId();
  }, []);

  useEffect(() => {
    void syncUserRegistration().then((result) => {
      if (result.ok) {
        console.info('Telegram Mini App user profile synchronized.');
      }
    }).catch((error: unknown) => {
      console.error('Could not synchronize the Telegram Mini App user profile:', error);
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Generate initial cards whenever cardsCount changes or game resets
  const initCards = useCallback((count: number) => {
    const newCards: BingoCardModel[] = [];
    for (let i = 0; i < count; i++) {
      newCards.push(generateBingoCard(i));
    }
    setCards(newCards);
  }, []);

  useEffect(() => {
    if (status === 'idle' && !activeRoomRequestedRef.current && !hasJoinedRoomOnceRef.current && cards.length === 0) {
      initCards(settings.cardsCount);
    }
  }, [settings.cardsCount, status, initCards, cards.length]);

  // Daub a specific cell
  const handleCellClick = (cardIndex: number, row: number, col: number) => {
    sounds.playDaub();

    setCards((prevCards) => {
      const card = prevCards[cardIndex];
      if (!card) return prevCards;
      const targetCell = card.cells[row]?.[col];
      if (!targetCell || targetCell.isFree) return prevCards;
      // Allow marking if number was drawn in this round
      const isDrawn = calledSet.has(targetCell.number) || calledBalls.some((b) => b.number === targetCell.number);
      if (!isDrawn) return prevCards;

      let winningCardToClaim: BingoCardModel | null = null;

      const updatedCards = prevCards.map((c, cIdx) => {
        if (cIdx !== cardIndex) return c;
        const newCells = c.cells.map((rList, r) =>
          rList.map((curCell, cl) => {
            if (r === row && cl === col) {
              return { ...curCell, isDaubed: !curCell.isDaubed };
            }
            return curCell;
          })
        );
        const tempCard = { ...c, cells: newCells };
        const win = checkCardWinningPatterns(tempCard, settings.language);
        const updated = {
          ...tempCard,
          numbersNeeded: calculateNumbersNeeded(tempCard),
          hasWon: win.hasWon,
          winningPatternName: win.patternName,
        };
        if (win.hasWon) {
          winningCardToClaim = updated;
        }
        return updated;
      });

      if (winningCardToClaim && statusRef.current === 'in_progress') {
        setTimeout(() => {
          if (handleClaimBingoRef.current) {
            handleClaimBingoRef.current(winningCardToClaim!);
          }
        }, 0);
      }

      return updatedCards;
    });
  };

  const handleProcessWinner = useCallback((payload: {
    gameId?: string;
    winnerId?: string;
    winnerName?: string;
    cardId?: number;
    prize?: number;
    balance?: number;
    mainWallet?: number;
    playWallet?: number;
    win?: WinValidationResult;
  }) => {
    const gameId = payload.gameId || activeGameId;
    const isWinner = Boolean(payload.winnerId && String(payload.winnerId) === String(currentPlayerIdRef.current));
    const hasAuthoritativeWallet =
      typeof payload.balance === 'number' &&
      Number.isFinite(payload.balance) &&
      typeof payload.mainWallet === 'number' &&
      Number.isFinite(payload.mainWallet);
    if (gameId && lastProcessedWinnerGameIdRef.current === gameId) {
      if (isWinner && hasAuthoritativeWallet && lastCreditedWinnerGameIdRef.current !== gameId) {
        lastCreditedWinnerGameIdRef.current = gameId;
        const prize = payload.prize ?? prizePool;
        setUser((previous) => ({
          ...previous,
          balance: payload.balance!,
          mainWallet: payload.mainWallet!,
          playWallet: payload.playWallet ?? previous.playWallet ?? 0,
          totalWins: previous.totalWins + 1,
          totalWonAmount: previous.totalWonAmount + prize,
        }));
        setHistory((previous) => previous.some((entry) => entry.id === `game-${gameId}`) ? previous : [{
          id: `game-${gameId}`,
          timestamp: Date.now(),
          stake: settingsRef.current.selectedStake,
          cardsCount: settingsRef.current.cardsCount,
          result: 'won',
          wonAmount: prize,
          patternName: payload.win?.patternName || 'Bingo Win',
        }, ...previous]);
      }
      return;
    }
    lastProcessedWinnerGameIdRef.current = gameId || 'game-finished';

    statusRef.current = 'game_over';
    claimInFlightRef.current = false;
    setStatus('game_over');
    sounds.stopAllAudio();

    const winDetails = payload.win || {
      hasWon: true,
      patternType: 'line',
      patternName: 'ቢንጎ አሸናፊ (Bingo Win)',
      winningCoordinates: [],
      multiplier: 1.8,
    };

    const finalPrize = payload.prize ?? prizePool;
    setWonAmount(finalPrize);
    setWinResult(winDetails);
    setWinnerInfo({
      winnerId: payload.winnerId,
      winnerName: payload.winnerName || (isWinner ? (user.firstName || user.username || 'You') : 'ተጫዋች'),
      cardId: payload.cardId,
      prize: finalPrize,
      isMe: isWinner,
    });
    setShowWinModal(Boolean(payload.winnerId));

    activeRoomRequestedRef.current = false;
    hasJoinedRoomOnceRef.current = false;
    roomJoinRequestIdRef.current = null;
    setIsSpectator(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('salery_bingo_has_joined_room_once');
      localStorage.removeItem('salery_bingo_active_room_requested');
      localStorage.removeItem('salery_bingo_room_card_ids');
      localStorage.removeItem('salery_bingo_room_wallet_type');
      localStorage.removeItem('salery_bingo_room_join_request_id');
      localStorage.removeItem(`salery_bingo_pending_room_${currentPlayerIdRef.current}`);
    }

    if (isWinner) {
      if (!hasPlayedBingoAudioThisRoundRef.current) {
        hasPlayedBingoAudioThisRoundRef.current = true;
        sounds.playBingo();
      }
      if (hasAuthoritativeWallet && lastCreditedWinnerGameIdRef.current !== gameId) {
        lastCreditedWinnerGameIdRef.current = gameId || 'game-finished';
        setUser((previous) => ({
          ...previous,
          balance: payload.balance!,
          mainWallet: payload.mainWallet!,
          playWallet: payload.playWallet ?? previous.playWallet ?? 0,
          totalWins: previous.totalWins + 1,
          totalWonAmount: previous.totalWonAmount + finalPrize,
        }));
      }

      if (payload.cardId) {
        setCards((previous) => previous.map((card) => card.cardIndex !== payload.cardId ? card : ({
          ...card,
          hasWon: true,
          winningPatternName: winDetails.patternName,
          cells: card.cells.map((row) => row.map((cell) => ({
            ...cell,
            isWinningCell: winDetails.winningCoordinates.some((coord) => coord.row === cell.row && coord.col === cell.col),
          }))),
        })));
      }

      if (hasAuthoritativeWallet) {
        setHistory((previous) => [{
          id: `game-${gameId}`,
          timestamp: Date.now(),
          stake: settingsRef.current.selectedStake,
          cardsCount: settingsRef.current.cardsCount,
          result: 'won',
          wonAmount: finalPrize,
          patternName: winDetails.patternName,
        }, ...previous]);
      }
    } else {
      sounds.playBeep(false);
      if (payload.winnerName) {
        showToast(`🏆 ጨዋታው ተጠናቋል! አሸናፊ: ${payload.winnerName}`);
      }
    }
  }, [user.telegramId, user.firstName, user.username, activeGameId, prizePool]);

  const applyRoomSnapshot = useCallback((room: BingoRoomSnapshot) => {
    if (statusRef.current === 'game_over' && room.status !== 'finished' && room.status !== 'waiting') {
      return;
    }
    const balls = room.called.map((number) => ({
      number,
      letter: getLetterForNumber(number),
      id: `ball-${number}`,
    }));
    const newestBall = balls[balls.length - 1] || null;
    const calledNumbers = new Set(room.called);
    setCalledBalls([...balls].reverse());
    setCalledSet(calledNumbers);
    setCurrentBall(newestBall);
    setPrizePool(room.prizePool);
    setRoomPlayers(room.players);
    setActiveGameId(room.gameId);
    if (typeof room.startsAt === 'number' && room.startsAt > 0) {
      setRoomStartsAt(room.startsAt);
    }

    setCards((previousCards) => previousCards.map((card) => {
      const cells = card.cells.map((row) => row.map((cell) => ({
        ...cell,
        isDaubed: cell.isFree || (calledNumbers.has(cell.number) && (settingsRef.current.autoDaub || cell.isDaubed)),
      })));
      const updatedCard = { ...card, cells };
      const win = checkCardWinningPatterns(updatedCard, settingsRef.current.language);
      return {
        ...updatedCard,
        numbersNeeded: calculateNumbersNeeded(updatedCard),
        hasWon: win.hasWon,
        winningPatternName: win.patternName,
      };
    }));

    if (room.status === 'finished') {
      handleProcessWinner({
        gameId: room.gameId,
        winnerId: room.winnerId,
        winnerName: room.winnerName,
        cardId: room.winningCardId,
        prize: room.prize || room.prizePool,
      });
    } else if (room.status === 'in_progress') {
      if (statusRef.current !== 'game_over') {
        if (statusRef.current === 'cartela_select' || roomCardIdsRef.current.length === 0) {
          // Player is currently picking cartelas for the upcoming round
          return;
        }
        setStatus('in_progress');
      }
    } else if (room.status === 'waiting') {
      setIsSpectator(false);
      setWinnerInfo(null);
      setShowWinModal(false);
      setWinResult(null);
      lastProcessedWinnerGameIdRef.current = null;
      claimInFlightRef.current = false;
      hasPlayedBingoAudioThisRoundRef.current = false;
      setCalledBalls([]);
      setCalledSet(new Set());
      setCurrentBall(null);
      // Clean all cards completely for the fresh round!
      setCards((prev) =>
        prev.map((c) => ({
          ...c,
          hasWon: false,
          winningPatternName: undefined,
          numbersNeeded: 4,
          cells: c.cells.map((row) =>
            row.map((cell) => ({
              ...cell,
              isDaubed: cell.isFree,
              isWinningCell: false,
            }))
          ),
        }))
      );
      if (statusRef.current === 'in_progress' || statusRef.current === 'game_over') {
        setStatus('cartela_select');
      }
    }
  }, [cards.length, handleProcessWinner]);

  const handleClaimBingo = useCallback(async (winningCard: BingoCardModel) => {
    if (statusRef.current !== 'in_progress' || claimInFlightRef.current) return;
    claimInFlightRef.current = true;
    const win = checkCardWinningPatterns(winningCard, settings.language);
    if (!win.hasWon) {
      claimInFlightRef.current = false;
      return;
    }

    const socket = gameSocketRef.current;
    if (!socket?.connected) {
      claimInFlightRef.current = false;
      showToast('Could not verify Bingo with the server. Your wallet was not changed.');
      return;
    }

    // Release the claim lock if the server fails to respond; never settle a win locally.
    const safetyTimer = setTimeout(() => {
      if (statusRef.current === 'in_progress') {
        claimInFlightRef.current = false;
        showToast('Bingo verification timed out. Your wallet was not changed.');
      }
    }, 10_000);

    try {
      socket.emit('room:claim', { cardId: winningCard.cardIndex, stake: settings.selectedStake }, (ackRes: any) => {
        clearTimeout(safetyTimer);
        if (ackRes?.ok) {
          handleProcessWinner({
            gameId: ackRes.state?.gameId || activeGameId,
            winnerId: String(user.telegramId),
            winnerName: user.firstName || user.username || 'You',
            cardId: winningCard.cardIndex,
            prize: ackRes.state?.prize ?? prizePool,
            balance: ackRes.balance,
            mainWallet: ackRes.mainWallet,
            playWallet: ackRes.playWallet,
            win: ackRes.win || win,
          });
        } else {
          claimInFlightRef.current = false;
          showToast(ackRes?.error || 'The server could not verify Bingo.');
        }
      });
    } catch (error) {
      clearTimeout(safetyTimer);
      claimInFlightRef.current = false;
      console.error('Could not submit Bingo claim:', error);
      showToast('Could not verify Bingo with the server. Your wallet was not changed.');
    }
  }, [settings.language, settings.selectedStake, activeGameId, user.telegramId, user.firstName, user.username, prizePool, cards.length, handleProcessWinner]);

  handleClaimBingoRef.current = handleClaimBingo;

  // Check if any card has won (instant automatic Bingo alert & claim)
  useEffect(() => {
    if (status === 'in_progress') {
      const winningCard = cards.find((c) => {
        const win = checkCardWinningPatterns(c, settings.language);
        return win.hasWon;
      });

      if (winningCard) {
        handleClaimBingo(winningCard);
      }
    }
  }, [cards, status, settings.language]);



  const getOrCreateSocket = useCallback(() => {
    let socket = gameSocketRef.current;
    if (!socket) {
      socket = connectBingoSocket(user.telegramId, (session) => {
        setUser((previous) => ({
          ...previous,
          telegramId: session.playerId,
          balance: session.mainWallet,
          mainWallet: session.mainWallet,
          playWallet: session.playWallet,
          playerCode: session.playerCode || previous.playerCode,
        }));
      });
      socket.on('connect', () => {
        console.log('[SOCKET] Connected:', socket.id);
      });
      socket.on('room:state', applyRoomSnapshot);
      socket.on('admin:broadcast', (payload: { message?: string; photoUrl?: string }) => {
        const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
        showToast(message || (payload?.photoUrl ? 'New Salery Bingo announcement' : 'New system notification'));
      });
      socket.on('gameStarted', ({ gameId, startedAt }) => {
        if (!activeRoomRequestedRef.current || roomCardIdsRef.current.length === 0) return;
        setActiveGameId(gameId || activeGameId);
        setCountdown(0);
        setStatus('in_progress');
        if (typeof startedAt === 'number') {
          const delta = Math.max(0, startedAt - Date.now());
          if (delta > 0) {
            setTimeout(() => setStatus('in_progress'), Math.min(delta, 250));
          }
        }
      });
      socket.on('room:number_drawn', (payload) => {
        console.log('[SOCKET] Received room:number_drawn:', payload);
        const number = typeof payload?.ball?.number === 'number'
          ? payload.ball.number
          : payload?.number;
        const calledNumbers = Array.isArray(payload?.calledNumbers)
          ? payload.calledNumbers
          : payload?.called;
        const gameId = payload?.gameId || payload?.ball?.gameId;
        if (!number) return;
        if (!activeRoomRequestedRef.current || roomCardIdsRef.current.length === 0) return;
        if (statusRef.current === 'game_over') return;
        const drawId = `${gameId || ''}:${number}:${payload?.drawnAt ?? payload?.ball?.drawnAt ?? ''}`;
        if (lastReceivedDrawRef.current === drawId) return;
        lastReceivedDrawRef.current = drawId;

        if (statusRef.current === 'starting') {
          statusRef.current = 'in_progress';
          setStatus('in_progress');
        }
        const ball = { number, letter: getLetterForNumber(number), id: `ball-${number}` };
        setCurrentBall(ball);
        setActiveGameId(gameId || activeGameId);

        const nextCalledList: number[] = Array.isArray(calledNumbers) ? calledNumbers : [number];
        const nextSet = new Set(nextCalledList);
        setCalledSet(nextSet);
        setCalledBalls(Array.from(nextSet).reverse().map((n: number) => ({
          number: n,
          letter: getLetterForNumber(n),
          id: `ball-${n}`,
        })));

        // Automatically mark matching cells across all player cards!
        setCards((prevCards) => {
          let winningCardToClaim: BingoCardModel | null = null;
          const nextCards = prevCards.map((card) => {
            const cells = card.cells.map((row) =>
              row.map((cell) => ({
                ...cell,
                isDaubed:
                  cell.isFree ||
                  (nextSet.has(cell.number) && (settingsRef.current.autoDaub || cell.isDaubed)),
              }))
            );
            const updatedCard = { ...card, cells };
            const win = checkCardWinningPatterns(updatedCard, settingsRef.current.language);
            const updated = {
              ...updatedCard,
              numbersNeeded: calculateNumbersNeeded(updatedCard),
              hasWon: win.hasWon,
              winningPatternName: win.patternName,
            };
            if (win.hasWon && !winningCardToClaim) {
              winningCardToClaim = updated;
            }
            return updated;
          });

          if (winningCardToClaim && statusRef.current === 'in_progress') {
            setTimeout(() => {
              if (handleClaimBingoRef.current) {
                handleClaimBingoRef.current(winningCardToClaim!);
              }
            }, 0);
          }

          return nextCards;
        });

        if (statusRef.current === 'in_progress') {
          sounds.playCalledNumber({ letter: ball.letter, number: ball.number });
        }
      });
      const rejoinRoom = () => {
        if (!hasJoinedRoomOnceRef.current || !activeRoomRequestedRef.current) return;
        void emitBingoWithAck<BingoJoinResult>(socket!, 'room:join', {
          stake: settingsRef.current.selectedStake,
          roomId: GLOBAL_BINGO_ROOM_ID,
          cardIds: roomCardIdsRef.current,
          joinRequestId: roomJoinRequestIdRef.current,
          walletType: roomWalletTypeRef.current,
          rejoin: true,
        }, 0).then((rejoined) => {
          if (rejoined.spectator && rejoined.state) {
            setIsSpectator(true);
            activeRoomRequestedRef.current = false;
            hasJoinedRoomOnceRef.current = false;
            roomCardIdsRef.current = [];
            setCards([]);
            applyRoomSnapshot(rejoined.state);
            setActiveTab('game');
            setStatus(rejoined.state.status === 'finished' ? 'game_over' : 'in_progress');
            return;
          }
          if (!rejoined.ok || !rejoined.state || !rejoined.cards) {
            console.error('Could not restore the bingo room after reconnecting:', rejoined.error);
            if (rejoined.error?.includes('No active cartela ticket')) {
              activeRoomRequestedRef.current = false;
              hasJoinedRoomOnceRef.current = false;
              roomCardIdsRef.current = [];
              roomJoinRequestIdRef.current = null;
              localStorage.removeItem('salery_bingo_has_joined_room_once');
              localStorage.removeItem('salery_bingo_active_room_requested');
              localStorage.removeItem('salery_bingo_room_card_ids');
              localStorage.removeItem('salery_bingo_room_wallet_type');
              localStorage.removeItem('salery_bingo_room_join_request_id');
              socket!.emit('cartela:room_enter', {
                roomId: GLOBAL_BINGO_ROOM_ID,
                stake: settingsRef.current.selectedStake,
              }, (roomEntry: any) => {
                if (roomEntry?.ok && roomEntry.state?.status === 'in_progress') {
                  setIsSpectator(true);
                  setCards([]);
                  applyRoomSnapshot(roomEntry.state);
                  setActiveTab('game');
                  setStatus('in_progress');
                } else {
                  setIsSpectator(false);
                  setStatus('cartela_select');
                }
              });
            } else {
              showToast(rejoined.error || 'Could not restore the bingo room. Please try again.');
            }
            return;
          }
          setIsSpectator(false);
          // Preserve existing marks so they NEVER disappear!
          setCards((currentCards) => {
            const calledNums = new Set(rejoined.state?.called || []);
            return rejoined.cards!.map((newCard) => {
              const prevCard = currentCards.find((c) => c.cardIndex === newCard.cardIndex);
              const prevDaubs = new Set<string>();
              if (prevCard) {
                prevCard.cells.forEach((row, r) => {
                  row.forEach((cell, cl) => {
                    if (cell.isDaubed) prevDaubs.add(`${r}-${cl}`);
                  });
                });
              }
              const cells = newCard.cells.map((row, r) =>
                row.map((cell, cl) => ({
                  ...cell,
                  isDaubed:
                    cell.isFree ||
                    prevDaubs.has(`${r}-${cl}`) ||
                    (settingsRef.current.autoDaub && calledNums.has(cell.number)),
                }))
              );
              const updated = { ...newCard, cells };
              const win = checkCardWinningPatterns(updated, settingsRef.current.language);
              return {
                ...updated,
                numbersNeeded: calculateNumbersNeeded(updated),
                hasWon: win.hasWon,
                winningPatternName: win.patternName,
              };
            });
          });
          if (typeof rejoined.balance === 'number') {
            setUser((previous) => ({
              ...previous,
              balance: rejoined.mainWallet ?? rejoined.balance!,
              mainWallet: rejoined.mainWallet ?? rejoined.balance!,
              playWallet: rejoined.playWallet ?? previous.playWallet ?? 0,
            }));
          }
          applyRoomSnapshot(rejoined.state);
          setStatus(
            rejoined.state.status === 'in_progress'
              ? 'in_progress'
              : rejoined.state.status === 'finished' ? 'game_over' : 'starting'
          );
        }).catch((error: unknown) => {
          console.error('Could not restore the bingo room after reconnecting:', error);
          showToast('Could not restore the bingo room. Reconnecting...');
        });
      };
      socket.on('connect', rejoinRoom);
      socket.on('wallet:balance', (wallets: number | { balance?: number; mainWallet?: number; playWallet?: number }) => {
        const balance = typeof wallets === 'number' ? wallets : wallets.mainWallet ?? wallets.balance;
        if (typeof balance === 'number' && Number.isFinite(balance)) {
          setUser((previous) => ({
            ...previous,
            balance,
            mainWallet: balance,
            playWallet: typeof wallets === 'number' ? previous.playWallet ?? 0 : wallets.playWallet ?? previous.playWallet ?? 0,
          }));
        }
      });
      socket.on('room:winner', (result: any) => {
        handleProcessWinner(result);
      });
      socket.on('connect_error', (error) => {
        console.warn('Socket connection retry:', error.message);
      });
      gameSocketRef.current = socket;
      setSocketInstance(socket);
      socket.connect();
    }
    return socket;
  }, [applyRoomSnapshot, handleProcessWinner, user.telegramId]);

  // Keep a socket connected so open clients receive live admin announcements.
  useEffect(() => {
    getOrCreateSocket();
  }, [getOrCreateSocket]);

  // Real-time synchronized ball calling loop when in progress
  useEffect(() => {
    if (status !== 'in_progress') return;

    const cycle = getGlobalBingoCycle();
    const deck = getDeterministicRoundDeck(cycle.cycleIndex);
    const roundStartedAt = cycle.selectionEndsAt;
    const initialElapsed = Math.max(0, Date.now() - roundStartedAt);
    let ballIdx = Math.floor(initialElapsed / 2800);

    // If game was joined midway, pre-populate already called numbers
    if (ballIdx > 0) {
      const alreadyDrawn = deck.slice(0, Math.min(ballIdx, deck.length));
      const alreadySet = new Set(alreadyDrawn);
      setCalledSet(alreadySet);
      setCalledBalls(alreadyDrawn.map((n) => ({ number: n, letter: getLetterForNumber(n), id: `ball-${n}` })).reverse());
      if (alreadyDrawn.length > 0) {
        const last = alreadyDrawn[alreadyDrawn.length - 1];
        setCurrentBall({ number: last, letter: getLetterForNumber(last), id: `ball-${last}` });
      }
    }

    const interval = setInterval(() => {
      // A connected room uses the server's draw events as its only source of called numbers.
      if (gameSocketRef.current?.connected && activeRoomRequestedRef.current) {
        return;
      }

      if (statusRef.current !== 'in_progress') {
        clearInterval(interval);
        return;
      }

      const currentElapsed = Math.max(0, Date.now() - roundStartedAt);
      const targetIdx = Math.floor(currentElapsed / 2800);
      if (targetIdx <= ballIdx && ballIdx > 0) {
        return;
      }
      ballIdx = targetIdx;

      if (ballIdx >= deck.length) {
        clearInterval(interval);
        return;
      }

      const number = deck[ballIdx];
      if (!number) return;

      const ball = { number, letter: getLetterForNumber(number), id: `ball-${number}` };
      setCurrentBall(ball);
      setCalledSet((prev) => {
        const next = new Set(prev);
        next.add(number);
        return next;
      });
      setCalledBalls((prev) => [ball, ...prev]);

      setCards((prevCards) => {
        let winningCardToClaim: BingoCardModel | null = null;
        const nextCards = prevCards.map((card) => {
          const cells = card.cells.map((row) =>
            row.map((cell) => ({
              ...cell,
              isDaubed: cell.isFree || (cell.number === number ? (settingsRef.current.autoDaub || cell.isDaubed) : cell.isDaubed),
            }))
          );
          const updatedCard = { ...card, cells };
          const win = checkCardWinningPatterns(updatedCard, settingsRef.current.language);
          const updated = {
            ...updatedCard,
            numbersNeeded: calculateNumbersNeeded(updatedCard),
            hasWon: win.hasWon,
            winningPatternName: win.patternName,
          };
          if (win.hasWon && !winningCardToClaim) winningCardToClaim = updated;
          return updated;
        });

        if (winningCardToClaim && statusRef.current === 'in_progress') {
          setTimeout(() => {
            if (handleClaimBingoRef.current) {
              handleClaimBingoRef.current(winningCardToClaim!);
            }
          }, 0);
        }

        return nextCards;
      });

      sounds.playCalledNumber({ letter: ball.letter, number: ball.number });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Step 1: Open Cartela Selection View or Resume Active Game
  const handleOpenCartelaSelection = () => {
    setActiveTab('game');
    roomCardIdsRef.current = [];
    hasJoinedRoomOnceRef.current = false;
    activeRoomRequestedRef.current = false;
    setIsSpectator(false);
    setStatus('cartela_select');

    const socket = getOrCreateSocket();
    socket.emit('cartela:room_enter', { roomId: GLOBAL_BINGO_ROOM_ID, stake: settings.selectedStake }, (res: any) => {
      if (res && res.ok && res.state) {
        if (typeof res.state.startsAt === 'number' && res.state.startsAt > Date.now()) {
          setRoomStartsAt(res.state.startsAt);
        }
        const ticketCardIds = res.joinedPlayer?.cardIds;
        if (res.state.status === 'in_progress') {
          if (Array.isArray(ticketCardIds) && ticketCardIds.length > 0) {
            const ticketIds = ticketCardIds.filter((id: number) => Number.isInteger(id) && id >= 1 && id <= 400);
            if (ticketIds.length > 0) {
              const walletType = res.joinedPlayer.walletType === 'play_wallet' ? 'play_wallet' : 'main_wallet';
              const joinRequestId = localStorage.getItem('salery_bingo_room_join_request_id');
              roomCardIdsRef.current = ticketIds;
              roomWalletTypeRef.current = walletType;
              roomJoinRequestIdRef.current = joinRequestId;
              hasJoinedRoomOnceRef.current = true;
              activeRoomRequestedRef.current = true;
              localStorage.setItem('salery_bingo_has_joined_room_once', 'true');
              localStorage.setItem('salery_bingo_active_room_requested', 'true');
              localStorage.setItem('salery_bingo_room_card_ids', JSON.stringify(ticketIds));
              localStorage.setItem('salery_bingo_room_wallet_type', walletType);
              void emitBingoWithAck<BingoJoinResult>(socket, 'room:join', {
                roomId: GLOBAL_BINGO_ROOM_ID,
                stake: settingsRef.current.selectedStake,
                cardIds: ticketIds,
                walletType,
                joinRequestId,
                rejoin: true,
              }).then((ticket) => {
                if (ticket.spectator && ticket.state) {
                  setIsSpectator(true);
                  activeRoomRequestedRef.current = false;
                  hasJoinedRoomOnceRef.current = false;
                  roomCardIdsRef.current = [];
                  setCards([]);
                  applyRoomSnapshot(ticket.state);
                  setStatus('in_progress');
                  return;
                }
                if (!ticket.ok || !ticket.state || !ticket.cards) {
                  showToast(ticket.error || 'Could not restore your active cartela.');
                  return;
                }
                setIsSpectator(false);
                roomCardIdsRef.current = ticket.cards.map((card) => card.cardIndex);
                hasJoinedRoomOnceRef.current = true;
                activeRoomRequestedRef.current = true;
                const called = new Set(ticket.state.called);
                setCards(ticket.cards.map((card) => {
                  const restored = {
                    ...card,
                    cells: card.cells.map((row) => row.map((cell) => ({
                      ...cell,
                      isDaubed: cell.isFree || cell.isDaubed || (settingsRef.current.autoDaub && called.has(cell.number)),
                    }))),
                  };
                  const win = checkCardWinningPatterns(restored, settingsRef.current.language);
                  return {
                    ...restored,
                    numbersNeeded: calculateNumbersNeeded(restored),
                    hasWon: win.hasWon,
                    winningPatternName: win.patternName,
                  };
                }));
                if (typeof ticket.balance === 'number') {
                  setUser((previous) => ({
                    ...previous,
                    balance: ticket.mainWallet ?? ticket.balance!,
                    mainWallet: ticket.mainWallet ?? ticket.balance!,
                    playWallet: ticket.playWallet ?? previous.playWallet ?? 0,
                  }));
                }
                applyRoomSnapshot(ticket.state);
                setStatus('in_progress');
              }).catch((error: unknown) => {
                console.error('Could not restore the active cartela:', error);
                showToast('Could not restore your active cartela.');
              });
              return;
            }
          }
          setIsSpectator(true);
          setCards([]);
          applyRoomSnapshot(res.state);
          setStatus('in_progress');
          return;
        }
        setIsSpectator(false);
      }
    });
  };

  // Step 2: Confirm Selected Cartelas and Launch Round
  const handleConfirmCartelaSelection = async (
    selectedCards: BingoCardModel[],
    walletType: 'main_wallet' | 'play_wallet' = 'main_wallet'
  ) => {
    if (selectedCards.length === 0) return false;
    const availableBalance = walletType === 'play_wallet' ? user.playWallet ?? 0 : user.mainWallet ?? user.balance;
    const cost = settings.selectedStake * selectedCards.length;
    if (availableBalance < cost) {
      showToast('Insufficient balance to join with the selected cartelas.');
      return false;
    }
    setActiveTab('game');
    setCountdown(0);
    setStatus('starting');
    hasJoinedRoomOnceRef.current = true;
    activeRoomRequestedRef.current = true;
    lastProcessedWinnerGameIdRef.current = null;
    roomCardIdsRef.current = selectedCards.map((c) => c.cardIndex);
    setCards(selectedCards);
    setRoomPlayers([{ name: user.firstName || 'Player', cardsCount: selectedCards.length, isOnline: true }]);
    setPrizePool(Math.floor(selectedCards.length * settings.selectedStake * 0.8));
    setActiveGameId(GLOBAL_BINGO_ROOM_ID);
    roomWalletTypeRef.current = walletType;
    hasPlayedBingoAudioThisRoundRef.current = false;
    const joinRequestId = crypto.randomUUID();
    roomJoinRequestIdRef.current = joinRequestId;
    const joinKey = `salery_bingo_pending_room_${user.telegramId}`;
    localStorage.setItem(joinKey, joinRequestId);
    try {
      const socket = getOrCreateSocket();
      if (!socket.connected && !socket.active) socket.connect();

      const result = await emitBingoWithAck<BingoJoinResult>(socket, 'room:join', {
        stake: settings.selectedStake,
        roomId: GLOBAL_BINGO_ROOM_ID,
        cardIds: selectedCards.map((card) => card.cardIndex),
        joinRequestId,
        walletType,
      }, 0);
      if (result.spectator && result.state) {
        setIsSpectator(true);
        activeRoomRequestedRef.current = false;
        hasJoinedRoomOnceRef.current = false;
        roomCardIdsRef.current = [];
        setCards([]);
        applyRoomSnapshot(result.state);
        setStatus('in_progress');
        return true;
      }
      if (!result.ok || !result.state || !result.cards || typeof result.balance !== 'number') {
        throw new Error(result.error || 'Could not join the live room');
      }

      setIsSpectator(false);
      const initialCalled = new Set(result.state.called || []);
      const readyCards = result.cards.map((card) => {
        const cells = card.cells.map((row) =>
          row.map((cell) => ({
            ...cell,
            isDaubed:
              cell.isFree ||
              cell.isDaubed ||
              (settingsRef.current.autoDaub && initialCalled.has(cell.number)),
          }))
        );
        const updated = { ...card, cells };
        const win = checkCardWinningPatterns(updated, settingsRef.current.language);
        return {
          ...updated,
          numbersNeeded: calculateNumbersNeeded(updated),
          hasWon: win.hasWon,
          winningPatternName: win.patternName,
        };
      });
      setCards(readyCards);
      roomCardIdsRef.current = result.cards.map((card) => card.cardIndex);
      hasJoinedRoomOnceRef.current = true;
      activeRoomRequestedRef.current = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('salery_bingo_has_joined_room_once', 'true');
        localStorage.setItem('salery_bingo_active_room_requested', 'true');
        localStorage.setItem('salery_bingo_room_card_ids', JSON.stringify(result.cards.map((c) => c.cardIndex)));
        localStorage.setItem('salery_bingo_room_wallet_type', walletType);
        localStorage.setItem('salery_bingo_room_join_request_id', roomJoinRequestIdRef.current || '');
      }
      setUser((previous) => ({
        ...previous,
        balance: result.balance!,
        mainWallet: result.mainWallet ?? result.balance!,
        playWallet: result.playWallet ?? previous.playWallet ?? 0,
        totalGames: previous.totalGames + (result.duplicate ? 0 : 1),
      }));
      lastCalledNumberRef.current = null;
      applyRoomSnapshot(result.state);
      sounds.playBeep(true);
      setStatus(
        result.state.status === 'finished'
          ? 'game_over'
          : result.state.status === 'in_progress' ? 'in_progress' : 'starting'
      );
      return true;
    } catch (error) {
      activeRoomRequestedRef.current = false;
      hasJoinedRoomOnceRef.current = false;
      localStorage.removeItem(joinKey);
      setStatus('cartela_select');
      setIsSpectator(false);
      roomCardIdsRef.current = [];
      console.error('Could not join the global bingo room:', error);
      showToast(error instanceof Error ? error.message : 'Could not join the global bingo room.');
      return false;
    }
  };

  const handleResetGame = () => {
    if (statusRef.current === 'in_progress') {
      gameSocketRef.current?.emit('room:leave', { stake: settings.selectedStake });
      activeRoomRequestedRef.current = false;
      hasJoinedRoomOnceRef.current = false;
      roomCardIdsRef.current = [];
      roomJoinRequestIdRef.current = null;
      setIsSpectator(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('salery_bingo_has_joined_room_once');
        localStorage.removeItem('salery_bingo_active_room_requested');
        localStorage.removeItem('salery_bingo_room_card_ids');
        localStorage.removeItem('salery_bingo_room_wallet_type');
        localStorage.removeItem('salery_bingo_room_join_request_id');
      }
      setStatus('idle');
      return;
    }
    gameSocketRef.current?.emit('room:leave', { stake: settings.selectedStake });
    activeRoomRequestedRef.current = false;
    hasJoinedRoomOnceRef.current = false;
    setIsSpectator(false);
    lastProcessedWinnerGameIdRef.current = null;
    claimInFlightRef.current = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('salery_bingo_has_joined_room_once');
      localStorage.removeItem('salery_bingo_active_room_requested');
      localStorage.removeItem('salery_bingo_room_card_ids');
      localStorage.removeItem('salery_bingo_room_wallet_type');
      localStorage.removeItem('salery_bingo_room_join_request_id');
    }
    setStatus('idle');
    setCalledBalls([]);
    setCalledSet(new Set());
    setCurrentBall(null);
    setPrizePool(0);
    setRoomPlayers([]);
    setActiveGameId(GLOBAL_BINGO_ROOM_ID);
    setWinnerInfo(null);
    setShowWinModal(false);
    setWinResult(null);
    initCards(settings.cardsCount);
  };

  const handleReturnToCartelaSelect = useCallback(() => {
    gameSocketRef.current?.emit('room:leave', { stake: settings.selectedStake });
    activeRoomRequestedRef.current = false;
    hasJoinedRoomOnceRef.current = false;
    setIsSpectator(false);
    lastProcessedWinnerGameIdRef.current = null;
    claimInFlightRef.current = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('salery_bingo_has_joined_room_once');
      localStorage.removeItem('salery_bingo_active_room_requested');
      localStorage.removeItem('salery_bingo_room_card_ids');
      localStorage.removeItem('salery_bingo_room_wallet_type');
      localStorage.removeItem('salery_bingo_room_join_request_id');
      localStorage.removeItem(`salery_bingo_pending_room_${currentPlayerIdRef.current}`);
    }
    sounds.stopAllAudio();
    hasPlayedBingoAudioThisRoundRef.current = false;
    setCalledBalls([]);
    setCalledSet(new Set());
    setCurrentBall(null);
    setPrizePool(0);
    setRoomPlayers([]);
    setActiveGameId(GLOBAL_BINGO_ROOM_ID);
    setWinnerInfo(null);
    setShowWinModal(false);
    setWinResult(null);
    // Completely wipe all card states to clean slate
    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        hasWon: false,
        winningPatternName: undefined,
        numbersNeeded: 4,
        cells: c.cells.map((row) =>
          row.map((cell) => ({
            ...cell,
            isDaubed: cell.isFree,
            isWinningCell: false,
          }))
        ),
      }))
    );
    initCards(settings.cardsCount);
    setActiveTab('game');
    setStatus('cartela_select');
    getOrCreateSocket();
  }, [settings.selectedStake, settings.cardsCount, initCards, getOrCreateSocket]);

  const isLiveGameActive = status === 'starting' || status === 'in_progress' || status === 'paused' || status === 'countdown' || status === 'game_over';

  if (showAdminPanel && isAdmin) {
    return (
      <div className="min-h-screen bg-[#040810] text-slate-100">
        <AdminPanelView
          onBack={handleCloseAdminPanel}
          adminTelegramId={user.telegramId}
          onRefreshUserBalance={() => refreshUserData()}
        />
      </div>
    );
  }

  if (user.is_blocked || user.status === 'blocked') {
    return (
      <BannedUserView
        user={user}
        onRefresh={async () => {
          await refreshUserData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#110c22] text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 font-sans pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 py-2.5 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce border border-amber-300">
          <AlertCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Countdown Overlay */}
      {status === 'countdown' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md">
          <div className="text-center space-y-2 animate-pulse">
            <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">
              {t.gameStartsIn}
            </span>
            <div className="text-8xl sm:text-9xl font-black font-mono text-amber-400">
              {countdown}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: GAME TAB */}
      {activeTab === 'game' && (
        <>
          {status === 'idle' && (
            /* EXACT FIRST PAGE FROM SCREENSHOT: STAKE SELECTION */
            <div className="flex-1 flex flex-col justify-center">
              <LobbyView
                user={user}
                settings={settings}
                onUpdateSettings={(newVals) => setSettings((s) => ({ ...s, ...newVals }))}
                onStartGame={handleOpenCartelaSelection}
                onOpenRules={() => setRulesModalOpen(true)}
                onOpenAdmin={handleOpenAdminPanel}
              />
            </div>
          )}

          {status === 'cartela_select' && (
            /* EXACT SECOND PAGE FROM SCREENSHOT: CARTELA SELECTION & PREVIEW */
            <div className="flex-1 flex flex-col justify-center">
              <CartelaSelectionView
                user={user}
                settings={settings}
                onBack={() => setStatus('idle')}
                onConfirmSelection={handleConfirmCartelaSelection}
                socket={socketInstance || gameSocketRef.current}
                roomStartsAt={roomStartsAt}
              />
            </div>
          )}

          {isLiveGameActive && (
            /* ACTIVE LIVE BINGO GAME ARENA (Exact match to Screenshot 2439) */
            <div className="flex-1 flex flex-col justify-center">
              <GamePlayView
                user={user}
                settings={settings}
                currentBall={currentBall}
                calledBalls={calledBalls}
                calledSet={calledSet}
                cards={cards}
                onCellClick={handleCellClick}
                onClaimBingo={handleClaimBingo}
                onLeave={handleResetGame}
                onRefresh={handleResetGame}
                onToggleAutoDaub={(enabled) =>
                  setSettings((prev) => ({ ...prev, autoDaub: enabled }))
                }
                autoDaubEnabled={settings.autoDaub}
                gameId={activeGameId}
                roomPlayers={roomPlayers}
                status={status}
                spectatorMode={isSpectator}
                winnerInfo={winnerInfo}
                onPlayAgain={handleReturnToCartelaSelect}
              />
            </div>
          )}
        </>
      )}

      {/* TAB 2: HISTORY TAB (Matching Screenshot 1) */}
      {activeTab === 'history' && (
        <HistoryView
          history={history}
          totalGamesCount={user.totalGames}
        />
      )}

      {/* TAB 3: WALLET TAB (Matching Screenshot 2) */}
      {activeTab === 'wallet' && (
        <WalletView
          user={user}
          isRefreshing={isRefreshingBalance}
          onRefresh={() => refreshUserData()}
        />
      )}

      {/* TAB 4: PROFILE TAB (Matching Screenshot 3) */}
      {activeTab === 'profile' && (
        <ProfileView
          user={user}
          settings={settings}
          onUpdateSettings={(newSettings) => setSettings((s) => ({ ...s, ...newSettings }))}
          onOpenAdminPanel={isAdmin ? handleOpenAdminPanel : undefined}
        />
      )}

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* RULES MODAL POPUP */}
      {rulesModalOpen && (
        <RulesModal
          language={settings.language}
          onClose={() => setRulesModalOpen(false)}
        />
      )}

      {/* LEADERBOARDS & STATS MODAL POPUP */}
      {statsModalOpen && (
        <StatsModal
          user={user}
          language={settings.language}
          onClose={() => setStatsModalOpen(false)}
        />
      )}

      {/* WIN CELEBRATION MODAL OVERLAY */}
      {showWinModal && (
        <WinModal
          user={user}
          winResult={winResult}
          winningCard={cards.find((c) => c.cardIndex === winnerInfo?.cardId) || cards.find((c) => c.hasWon) || null}
          wonAmount={wonAmount}
          language={settings.language}
          winnerId={winnerInfo?.winnerId}
          winnerName={winnerInfo?.winnerName}
          cardId={winnerInfo?.cardId}
          isMe={winnerInfo?.isMe}
          onClose={handleReturnToCartelaSelect}
          onPlayAgain={handleReturnToCartelaSelect}
        />
      )}

    </div>
  );
}
