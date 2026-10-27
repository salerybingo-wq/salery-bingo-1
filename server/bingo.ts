import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Server, Socket } from 'socket.io';
import { checkCardWinningPatterns, generateCartelaByNumber, generateShuffledDeck } from '../src/utils/bingoLogic';
import {
  awardPostgresBingoPrize,
  BingoRoomState,
  getPostgresBingoRoom,
  getPostgresUser,
  isPostgresConfigured,
  joinPostgresBingoRoom,
  listPostgresBingoRooms,
  mutatePostgresBingoRoom,
  savePostgresBingoRoom,
  upsertPostgresUser,
} from './postgres';
import { localDb } from './db';
import { isValidBingoGuestToken } from './guestAuth';

const GLOBAL_ROOM_ID = 'GLOBAL_ROOM';
let ROOM_JOIN_WINDOW_MS = 35_000;
const BALL_INTERVAL_MS = 3_000;
const JOIN_GRACE_MS = 10_000;
const JOIN_RETRY_MS = 250;
const MAX_INIT_DATA_AGE_SECONDS = 86_400;
const VALID_STAKES = new Set([10]);

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & { player: TelegramUser };
}

function createLocalMockUser(idValue?: string): TelegramUser | null {
  const id = Number(idValue || process.env.MOCK_TELEGRAM_USER_ID || 1000000001);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return {
    id,
    first_name: 'Player',
    username: `player_${String(id).slice(-4)}`,
  };
}

function isLoopbackAddress(address?: string): boolean {
  const normalized = (address || '').toLowerCase().replace(/^::ffff:/, '');
  return normalized === '::1' || normalized === '127.0.0.1' || normalized.startsWith('127.');
}

export function isLoopbackClientAllowed(origin?: string, remoteAddress?: string): boolean {
  if (!isLoopbackAddress(remoteAddress)) return false;
  try {
    const hostname = new URL(origin || '').hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
  } catch {
    return false;
  }
}

export function validateTelegramInitData(initData: string, botToken: string, allowLocalMock = false): TelegramUser | null {
  const rawInitData = typeof initData === 'string' ? initData.trim() : '';
  if (rawInitData.startsWith('mock:')) {
    return allowLocalMock ? createLocalMockUser(rawInitData.slice(5)) : null;
  }
  if (!rawInitData) return allowLocalMock ? createLocalMockUser() : null;
  if (!botToken) return null;

  try {
    const params = new URLSearchParams(rawInitData);
    const hash = params.get('hash') || '';
    const authDate = Number(params.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);
    if (!/^[a-f0-9]{64}$/i.test(hash) || !Number.isSafeInteger(authDate)) return null;
    if (authDate > now + 60 || now - authDate > MAX_INIT_DATA_AGE_SECONDS) return null;

    const dataCheckString = Array.from(params.entries())
      .filter(([key]) => key !== 'hash')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
    const suppliedHash = Buffer.from(hash, 'hex');
    if (suppliedHash.length !== expectedHash.length || !timingSafeEqual(suppliedHash, expectedHash)) return null;

    const userJson = params.get('user');
    if (!userJson) return null;
    const user = JSON.parse(userJson) as TelegramUser;
    if (!Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) return null;
    return {
      id: Number(user.id),
      first_name: user.first_name || 'Player',
      last_name: user.last_name,
      username: user.username || `user_${user.id}`,
    };
  } catch {
    return null;
  }
}

function getNextAlignedStartsAt(now = Date.now()): number {
  const cycleIndex = Math.floor(now / ROOM_JOIN_WINDOW_MS);
  const cycleStart = cycleIndex * ROOM_JOIN_WINDOW_MS;
  let target = cycleStart + ROOM_JOIN_WINDOW_MS;
  if (target <= now + 1500) {
    target = (cycleIndex + 1) * ROOM_JOIN_WINDOW_MS + ROOM_JOIN_WINDOW_MS;
  }
  return target;
}

function makeRoomState(stake: number, startsAt = getNextAlignedStartsAt()): BingoRoomState {
  const cycleIndex = Math.floor(startsAt / ROOM_JOIN_WINDOW_MS);
  return {
    gameId: `salery-live-${cycleIndex}`,
    stake,
    status: 'waiting',
    startsAt,
    selectionWindowMs: ROOM_JOIN_WINDOW_MS,
    deck: generateShuffledDeck().map((ball) => ball.number),
    called: [],
    prizePool: 0,
    players: [],
  };
}

function roomIdForStake(_stake = 10): string {
  return GLOBAL_ROOM_ID;
}

function publicRoomState(state: BingoRoomState, onlineIds = new Set<string>()) {
  const onlinePlayers = new Set(onlineIds);
  const playersWithCartelas = state.players.filter((player) => player.cardIds.length > 0);
  const totalCards = playersWithCartelas.reduce((total, player) => total + player.cardIds.length, 0);
  const collectedBets = totalCards * state.stake;
  const calculatedPrize = Math.floor(collectedBets * 0.8);
  const takenCartelas: Record<number, string> = {};
  state.players.forEach((p) => {
    p.cardIds?.forEach((cid) => {
      takenCartelas[cid] = p.name || 'Player';
    });
  });

  return {
    gameId: state.gameId,
    stake: state.stake,
    status: state.status,
    startsAt: state.startsAt,
    serverNow: Date.now(),
    called: state.called,
    prizePool: calculatedPrize,
    playerCount: playersWithCartelas.length,
    totalCards,
    takenCartelas,
    players: playersWithCartelas.map(({ telegramId, name, cardIds }) => ({
      name,
      cardsCount: cardIds.length,
      isOnline: onlinePlayers.has(telegramId),
    })),
    winnerId: state.winnerId,
    winnerName: state.players.find((player) => player.telegramId === state.winnerId)?.name,
    winningCardId: state.winningCardId,
    prize: state.prize ?? calculatedPrize,
  };
}

function getOnlinePlayerIds(io: Server, roomId: string) {
  const socketIds = io.sockets.adapter.rooms.get(roomId) || new Set<string>();
  const onlineIds = new Set<string>();
  socketIds.forEach((socketId) => {
    const client = io.sockets.sockets.get(socketId) as AuthenticatedSocket | undefined;
    if (client?.data.player?.id) onlineIds.add(String(client.data.player.id));
  });
  return onlineIds;
}

function sendRoomState(io: Server, roomId: string, state: BingoRoomState) {
  const publicState = publicRoomState(state, getOnlinePlayerIds(io, roomId));
  io.to(roomId).emit('room:state', publicState);
  io.to(roomId).emit('room:selection_state', publicState);
}

export function attachBingoRooms(io: Server) {
  const localRooms = new Map<string, BingoRoomState>();
  const activeTimers = new Map<string, NodeJS.Timeout>();
  const countdownTimers = new Map<string, NodeJS.Timeout>();
  const activeDrawTimers = new Map<string, NodeJS.Timeout>();
  let globalRoomInitialization: Promise<BingoRoomState> | null = null;

  // Temporary selections are held by player ID until they are bought or released.
  const cartelaReservations: Record<number, Record<number, { playerId: string; name: string }>> = {
    10: {}, 25: {}, 50: {}, 100: {}, 250: {},
  };

  const broadcastCartelaReservations = (stake: number) => {
    const roomId = roomIdForStake(stake);
    const takenCartelas: Record<number, string> = {};
    const state = localRooms.get(roomId);
    state?.players.forEach((joinedPlayer) => {
      joinedPlayer.cardIds.forEach((cardId) => {
        takenCartelas[cardId] = joinedPlayer.name || 'Player';
      });
    });
    Object.entries(cartelaReservations[stake] || {}).forEach(([cardId, reservation]) => {
      if (!takenCartelas[Number(cardId)]) takenCartelas[Number(cardId)] = reservation.name;
    });
    const reservedList = {
      stake,
      takenCartelas,
      totalCards: Object.keys(takenCartelas).length,
      playerCount: new Set(
        Object.values(cartelaReservations[stake] || {}).map(({ playerId }) => playerId)
          .concat((state?.players || []).map(({ telegramId }) => telegramId))
      ).size,
      prizePool: Math.floor(
        Object.keys(takenCartelas).length * (state?.stake ?? stake) * 0.8
      ),
    };
    io.to(roomId).emit('cartela:reserved_list', reservedList);
  };

  function findRoomWinner(room: BingoRoomState) {
    const calledSet = new Set(room.called);
    for (const player of room.players) {
      for (const cardId of player.cardIds) {
        const card = generateCartelaByNumber(cardId);
        const verifiedCells = card.cells.map((row) =>
          row.map((cell) => ({
            ...cell,
            isDaubed: cell.isFree || calledSet.has(cell.number),
          }))
        );
        const verifiedCard = { ...card, cells: verifiedCells };
        const winResult = checkCardWinningPatterns(verifiedCard, 'am');
        if (winResult.hasWon) {
          return { player, cardId, win: winResult };
        }
      }
    }
    return null;
  }

  const resetTimers = new Map<string, NodeJS.Timeout>();

  const startSelectionRound = async (roomId: string, stake: number) => {
    const activeTimer = activeTimers.get(roomId);
    if (activeTimer) {
      clearTimeout(activeTimer);
      activeTimers.delete(roomId);
    }
    const countdown = countdownTimers.get(roomId);
    if (countdown) {
      clearInterval(countdown);
      countdownTimers.delete(roomId);
    }
    const drawTimer = activeDrawTimers.get(roomId);
    if (drawTimer) {
      clearInterval(drawTimer);
      activeDrawTimers.delete(roomId);
    }

    const nextState = makeRoomState(stake, Date.now() + ROOM_JOIN_WINDOW_MS);
    if (await isPostgresConfigured()) {
      await savePostgresBingoRoom(roomId, nextState);
    }
    localRooms.set(roomId, nextState);
    cartelaReservations[stake] = {};
    broadcastCartelaReservations(stake);
    sendRoomState(io, roomId, nextState);
    scheduleRoom(roomId, nextState);
  };

  const scheduleRoomReset = (roomId: string) => {
    if (resetTimers.has(roomId)) {
      clearTimeout(resetTimers.get(roomId)!);
      resetTimers.delete(roomId);
    }
    const timer = setTimeout(() => {
      resetTimers.delete(roomId);
      const currentRoom = localRooms.get(roomId);
      if (currentRoom && currentRoom.status === 'finished') {
        void startSelectionRound(roomId, currentRoom.stake).catch((error) => {
          console.error(`Could not start the next selection round for ${roomId}:`, error);
        });
      }
    }, 5000);
    resetTimers.set(roomId, timer);
  };

  const startRoomGame = async (roomId: string, latest: BingoRoomState) => {
    console.log('[DRAW] startRoomGame requested:', {
      roomId,
      status: latest.status,
      playerCount: latest.players.length,
      calledCount: latest.called.length,
    });
    if (latest.status === 'finished' || latest.players.length === 0) {
      console.log('[DRAW] Not starting loop: room is finished or has no players.', roomId);
      return;
    }
    if (activeDrawTimers.has(roomId)) {
      console.log('[DRAW] Draw loop already active:', roomId);
      return;
    }

    if (activeTimers.has(roomId)) {
      clearTimeout(activeTimers.get(roomId)!);
      activeTimers.delete(roomId);
    }
    if (resetTimers.has(roomId)) {
      clearTimeout(resetTimers.get(roomId)!);
      resetTimers.delete(roomId);
    }
    if (countdownTimers.has(roomId)) {
      clearInterval(countdownTimers.get(roomId)!);
      countdownTimers.delete(roomId);
    }

    // Rule: Only real players who joined via Telegram with an assigned ID can play and win
    const totalRoomCards = latest.players.reduce((total, player) => total + player.cardIds.length, 0);
    latest.prizePool = totalRoomCards * latest.stake;

    const alreadyInProgress = String(latest.status).toLowerCase() === 'in_progress';
    if (!alreadyInProgress) {
      latest.status = 'in_progress';
      latest.startsAt = Date.now();
    }
    localRooms.set(roomId, latest);

    if (!alreadyInProgress) {
      io.to(roomId).emit('gameStarted', {
        gameId: latest.gameId,
        startedAt: latest.startsAt,
      });
    }

    sendRoomState(io, roomId, latest);

    if (!alreadyInProgress && isPostgresConfigured()) {
      void mutatePostgresBingoRoom(roomId, () => latest).catch((error) => {
        console.error(`Could not persist game start for ${roomId}; continuing with the active room state:`, error);
      });
    }

    const startDrawLoop = (drawRoomId: string, roomState: BingoRoomState) => {
      console.log('[DRAW] Starting draw loop:', {
        roomId: drawRoomId,
        status: roomState.status,
        playerCount: roomState.players.length,
      });
      if (activeDrawTimers.has(drawRoomId)) {
        console.log('[DRAW] Draw loop already active:', drawRoomId);
        return;
      }

      const drawBall = async () => {
        let room = localRooms.get(drawRoomId);
        if (!room || room.status !== 'in_progress') {
          const currentTimer = activeDrawTimers.get(drawRoomId);
          if (currentTimer) clearInterval(currentTimer);
          activeDrawTimers.delete(drawRoomId);
          return;
        }

        if (room.deck.length === 0) {
          room.status = 'finished';
          localRooms.set(drawRoomId, room);
          const finishedTimer = activeDrawTimers.get(drawRoomId);
          if (finishedTimer) clearInterval(finishedTimer);
          activeDrawTimers.delete(drawRoomId);
          sendRoomState(io, drawRoomId, room);
          scheduleRoomReset(drawRoomId);
          return;
        }

        const currentBall = room.deck.shift()!;
        room.called.push(currentBall);
        localRooms.set(drawRoomId, room);

        const ball = {
          number: currentBall,
          gameId: room.gameId,
          drawnAt: Date.now(),
        };
        console.log('[DRAW] Ball drawn; broadcasting:', {
          roomId: drawRoomId,
          ball,
          calledCount: room.called.length,
        });
        const payload = {
          ball,
          number: currentBall,
          calledNumbers: [...room.called],
          called: [...room.called],
          gameId: room.gameId,
          drawnAt: ball.drawnAt,
        };
        io.to(drawRoomId).emit('room:number_drawn', payload);
        io.emit('room:number_drawn', payload);

        if (isPostgresConfigured()) {
          void mutatePostgresBingoRoom(drawRoomId, () => room).catch((error) => {
            console.error(`Could not persist drawn number ${currentBall} for ${drawRoomId}; continuing the draw:`, error);
          });
        }

        // Rule: If any card hits Bingo, the round is OVER immediately! Never pass or draw another ball!
        const winner = findRoomWinner(room);
        if (winner) {
          room.status = 'finished';
          const winnerTimer = activeDrawTimers.get(drawRoomId);
          if (winnerTimer) clearInterval(winnerTimer);
          activeDrawTimers.delete(drawRoomId);
          room.winnerId = String(winner.player.telegramId);
          room.winningCardId = winner.cardId;

          const totalCardsNow = room.players.reduce((total, player) => total + player.cardIds.length, 0);
          const prize = Math.floor(totalCardsNow * room.stake * 0.8);
          room.prize = prize;

          let finalBal = 0;
          let finalMain = 0;
          let finalPlay = 0;
          let payoutVerified = false;

          try {
            if (await isPostgresConfigured()) {
              const pgResult = await awardPostgresBingoPrize(roomId, String(winner.player.telegramId), winner.cardId, prize);
              if (pgResult) {
                finalBal = pgResult.balance;
                finalMain = pgResult.mainWallet;
                finalPlay = pgResult.playWallet;
                room = pgResult.state;
                payoutVerified = true;
              }
            } else {
              let localUser = localDb.getUser(String(winner.player.telegramId));
              if (!localUser) {
                localUser = localDb.upsertUser({
                  telegram_id: String(winner.player.telegramId),
                  first_name: winner.player.name || 'Player',
                  username: `player_${winner.player.telegramId}`,
                  balance: 0,
                  main_wallet: 0,
                  play_wallet: 0,
                });
              }
              if (localUser) {
                const mainWallet = (localUser.main_wallet ?? localUser.balance ?? 0) + prize;
                const playWallet = localUser.play_wallet ?? 0;
                localDb.upsertUser({
                  ...localUser,
                  balance: mainWallet,
                  main_wallet: mainWallet,
                  games_won: (localUser.games_won || 0) + 1,
                });
                finalBal = mainWallet;
                finalMain = mainWallet;
                finalPlay = playWallet;
                payoutVerified = true;
              }
            }
          } catch (err) {
            console.error('Error awarding bingo in loop:', err);
          }

          localRooms.set(drawRoomId, room);

          // Release all cartelas so the new game starts fresh
          cartelaReservations[room.stake] = {};
          broadcastCartelaReservations(room.stake);

          io.to(roomId).emit('room:winner', {
            gameId: room.gameId,
            winnerId: String(winner.player.telegramId),
            winnerName: winner.player.name || 'Winner',
            cardId: winner.cardId,
            prize,
            ...(payoutVerified ? {
              balance: finalBal,
              mainWallet: finalMain,
              playWallet: finalPlay,
            } : {}),
            win: winner.win,
          });

          sendRoomState(io, drawRoomId, room);
          scheduleRoomReset(drawRoomId);
          return;
        }

        sendRoomState(io, drawRoomId, room);
      };

      const drawTimer = setInterval(() => {
        void drawBall();
      }, BALL_INTERVAL_MS);
      activeDrawTimers.set(drawRoomId, drawTimer);
      void drawBall();
    };

    startDrawLoop(roomId, latest);
  };

  const scheduleRoom = (roomId: string, state: BingoRoomState) => {
    if (activeTimers.has(roomId)) return;

    const broadcastTick = () => {
      const latest = localRooms.get(roomId);
      if (!latest || latest.status !== 'waiting') return;
      io.to(roomId).emit('room:tick', {
        gameId: latest.gameId,
        status: latest.status,
        startsAt: latest.startsAt,
        serverNow: Date.now(),
        secondsRemaining: Math.max(0, Math.ceil((latest.startsAt - Date.now()) / 1000)),
      });
    };
    broadcastTick();
    const countdown = setInterval(broadcastTick, 1000);
    countdownTimers.set(roomId, countdown);

    const finalizeSelection = async () => {
      const latest = localRooms.get(roomId);
      if (!latest || latest.status === 'finished') return;
      if (latest.status === 'in_progress') {
        await startRoomGame(roomId, latest);
        return;
      }
      if (latest.players.length > 0) {
        await startRoomGame(roomId, latest);
        return;
      }

      const hasPendingReservations = Object.keys(cartelaReservations[latest.stake] || {}).length > 0;
      if (hasPendingReservations && Date.now() < latest.startsAt + JOIN_GRACE_MS) {
        const retry = setTimeout(() => {
          activeTimers.delete(roomId);
          void finalizeSelection();
        }, JOIN_RETRY_MS);
        activeTimers.set(roomId, retry);
        return;
      }

      await startSelectionRound(roomId, latest.stake);
    };

    const delay = Math.max(0, state.startsAt - Date.now());
    const timer = setTimeout(async () => {
      activeTimers.delete(roomId);
      const currentCountdown = countdownTimers.get(roomId);
      if (currentCountdown) {
        clearInterval(currentCountdown);
        countdownTimers.delete(roomId);
      }

      try {
        await finalizeSelection();
      } catch (error) {
        console.error(`Could not finalize the selection round for ${roomId}:`, error);
      }
    }, delay);

    activeTimers.set(roomId, timer);
  };

  const ensureGlobalRoom = () => {
    if (!localRooms.has(GLOBAL_ROOM_ID)) {
      globalRoomInitialization ??= getPostgresBingoRoom(GLOBAL_ROOM_ID)
        .catch((error) => {
          console.error('Could not restore the global bingo room:', error);
          throw error;
        })
        .then(async (storedState) => {
          if (!storedState) {
            await startSelectionRound(GLOBAL_ROOM_ID, 10);
            return localRooms.get(GLOBAL_ROOM_ID)!;
          }

          if (Number.isInteger(storedState.selectionWindowMs) &&
              storedState.selectionWindowMs! >= 10_000 &&
              storedState.selectionWindowMs! <= 120_000) {
            ROOM_JOIN_WINDOW_MS = storedState.selectionWindowMs!;
          }
          const hasNoPlayers = !Array.isArray(storedState?.players) || storedState.players.length === 0;
          const hasExpiredSelection = storedState?.status === 'waiting' &&
            (!Number.isFinite(storedState.startsAt) || storedState.startsAt <= Date.now());
          if (hasExpiredSelection && hasNoPlayers) {
            await startSelectionRound(GLOBAL_ROOM_ID, storedState?.stake || 10);
            return localRooms.get(GLOBAL_ROOM_ID)!;
          }

          const initialState = storedState || makeRoomState(10, Date.now() + ROOM_JOIN_WINDOW_MS);
          if (initialState.status === 'waiting' && !Number.isFinite(initialState.startsAt)) {
            initialState.startsAt = Date.now();
          }
          localRooms.set(GLOBAL_ROOM_ID, initialState);
          if (initialState.status === 'waiting') scheduleRoom(GLOBAL_ROOM_ID, initialState);
          else if (initialState.status === 'in_progress') void startRoomGame(GLOBAL_ROOM_ID, initialState);
          else if (initialState.status === 'finished') scheduleRoomReset(GLOBAL_ROOM_ID);
          return initialState;
        }).catch((error) => {
          globalRoomInitialization = null;
          throw error;
        });
    }
    return Promise.resolve(localRooms.get(GLOBAL_ROOM_ID) || globalRoomInitialization!);
  };

  const getAdminRoomState = async () => {
    const state = await ensureGlobalRoom();
    return publicRoomState(state, getOnlinePlayerIds(io, GLOBAL_ROOM_ID));
  };

  const resetSelectionRound = async () => {
    const state = await ensureGlobalRoom();
    if (state.status !== 'finished' && state.players.length > 0) {
      throw new Error('Cannot reset a round while players have joined');
    }
    await startSelectionRound(GLOBAL_ROOM_ID, state?.stake || 10);
    return getAdminRoomState();
  };

  const setSelectionWindow = async (durationMs: number) => {
    if (!Number.isInteger(durationMs) || durationMs < 10_000 || durationMs > 120_000) {
      throw new Error('Selection countdown must be between 10000 and 120000 milliseconds');
    }
    const state = await ensureGlobalRoom();
    const nextState = {
      ...state,
      selectionWindowMs: durationMs,
      ...(state.status === 'waiting' ? { startsAt: Date.now() + durationMs } : {}),
    };
    if (await isPostgresConfigured()) await savePostgresBingoRoom(GLOBAL_ROOM_ID, nextState);
    ROOM_JOIN_WINDOW_MS = durationMs;
    localRooms.set(GLOBAL_ROOM_ID, nextState);
    if (state.status === 'waiting') {
      const activeTimer = activeTimers.get(GLOBAL_ROOM_ID);
      if (activeTimer) clearTimeout(activeTimer);
      activeTimers.delete(GLOBAL_ROOM_ID);
      const countdown = countdownTimers.get(GLOBAL_ROOM_ID);
      if (countdown) clearInterval(countdown);
      countdownTimers.delete(GLOBAL_ROOM_ID);
      sendRoomState(io, GLOBAL_ROOM_ID, nextState);
      scheduleRoom(GLOBAL_ROOM_ID, nextState);
    }
    return { selectionWindowMs: ROOM_JOIN_WINDOW_MS, state: await getAdminRoomState() };
  };

  io.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    const playerId = Number(auth.playerId);
    if (!Number.isSafeInteger(playerId) || playerId <= 0 || !isValidBingoGuestToken(playerId, auth.guestToken)) {
      return next(new Error('A valid signed bingo guest session is required'));
    }

    const client = socket as AuthenticatedSocket;
    client.data = {
      player: {
        id: playerId,
        first_name: 'Player',
        username: `player_${String(playerId).slice(-4)}`,
      },
    };
    next();
  });

  io.on('connection', (socket) => {
    const client = socket as AuthenticatedSocket;
    const player = client.data.player;
    const playerIdentifier = String(player.id);
    console.log('[SOCKET] Client connected:', {
      socketId: client.id,
      playerId: playerIdentifier,
      roomId: GLOBAL_ROOM_ID,
    });
    const roomMembership = Promise.resolve(client.join(GLOBAL_ROOM_ID));
    void Promise.all([roomMembership, ensureGlobalRoom()])
      .then(([, state]) => {
        console.log('[SOCKET] Global room synchronized:', {
          socketId: client.id,
          roomId: GLOBAL_ROOM_ID,
          status: state.status,
          playerCount: state.players.length,
        });
        if (state.status === 'in_progress') {
          void startRoomGame(GLOBAL_ROOM_ID, state);
        }
        sendRoomState(io, GLOBAL_ROOM_ID, state);
      })
      .catch((error) => {
        console.error(`Could not initialize ${GLOBAL_ROOM_ID} for socket ${client.id}:`, error);
      });

    client.on('cartela:room_enter', async (payload: { roomId?: string; stake?: number }, ack) => {
      await Promise.all([roomMembership, ensureGlobalRoom()]);
      const stake = Number(payload?.stake) || 10;
      const roomId = roomIdForStake(stake);

      let state = localRooms.get(roomId);
      if (!state || state.status === 'finished') {
        state = makeRoomState(stake, Date.now() + ROOM_JOIN_WINDOW_MS);
        localRooms.set(roomId, state);
        scheduleRoom(roomId, state);
      }

      sendRoomState(io, roomId, state);
      broadcastCartelaReservations(stake);

      const existingPlayer = state.players.find((p) => String(p.telegramId) === String(player.id));
      const userRes = cartelaReservations[stake] || {};
      const myReservedCardIds = Object.entries(userRes)
        .filter(([, reservation]) => reservation.playerId === playerIdentifier)
        .map(([cid]) => Number(cid));

      if (typeof ack === 'function') {
        ack({
          ok: true,
          joinedPlayer: existingPlayer ? {
            cardIds: existingPlayer.cardIds,
            cards: existingPlayer.cardIds.map((id) => generateCartelaByNumber(id)),
            walletType: existingPlayer.walletType,
          } : null,
          myReservedCardIds,
          state: publicRoomState(state, getOnlinePlayerIds(io, roomId)),
        });
      }
    });

    client.on('cartela:reserve', async (payload: { stake: number; cardIds: number[] }, ack) => {
      await Promise.all([roomMembership, ensureGlobalRoom()]);
      const stake = Number(payload.stake);
      const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds : [];

      if (!VALID_STAKES.has(stake)) {
        if (typeof ack === 'function') ack({ ok: false, acceptedIds: [], error: 'Invalid stake' });
        return;
      }
      const state = localRooms.get(GLOBAL_ROOM_ID);
      if (!state || state.status !== 'waiting') {
        if (typeof ack === 'function') ack({ ok: false, acceptedIds: [], error: 'Cartela selection is closed' });
        return;
      }
      const userRes = cartelaReservations[stake] || {};
      const validCardIds = Array.from(new Set(cardIds.filter((id) =>
        Number.isInteger(id) && id >= 1 && id <= 400
      )));
      for (const [cidStr, reservation] of Object.entries(userRes)) {
        if (reservation.playerId === playerIdentifier && !validCardIds.includes(Number(cidStr))) {
          delete userRes[Number(cidStr)];
        }
      }

      const purchasedCardIds = new Set(state.players.flatMap((roomPlayer) => roomPlayer.cardIds));
      const acceptedIds: number[] = [];
      const rejectedIds: number[] = [];
      validCardIds.forEach((id) => {
        const reservation = userRes[id];
        if (purchasedCardIds.has(id) || (reservation && reservation.playerId !== playerIdentifier)) {
          rejectedIds.push(id);
          return;
        }
        userRes[id] = {
          playerId: playerIdentifier,
          name: player.first_name || player.username || 'Player',
        };
        acceptedIds.push(id);
      });

      cartelaReservations[stake] = userRes;
      broadcastCartelaReservations(stake);
      sendRoomState(io, GLOBAL_ROOM_ID, state);
      if (typeof ack === 'function') ack({ ok: true, acceptedIds, rejectedIds });
    });

    client.on('cartela:release', (payload: { stake: number }) => {
      const stake = Number(payload.stake);
      if (!VALID_STAKES.has(stake)) return;

      const userRes = cartelaReservations[stake] || {};
      for (const [cidStr, reservation] of Object.entries(userRes)) {
        if (reservation.playerId === playerIdentifier) {
          delete userRes[Number(cidStr)];
        }
      }

      cartelaReservations[stake] = userRes;
      broadcastCartelaReservations(stake);
      const state = localRooms.get(GLOBAL_ROOM_ID);
      if (state) sendRoomState(io, GLOBAL_ROOM_ID, state);
    });

    client.on('room:join', async (payload: {
      stake?: number;
      roomId?: string;
      cardIds?: number[];
      joinRequestId?: string;
      rejoin?: boolean;
      walletType?: 'main_wallet' | 'play_wallet';
    }, ack) => {
      await Promise.all([roomMembership, ensureGlobalRoom()]);
      const stake = Number(payload?.stake) || 10;
      const cardIds = Array.isArray(payload?.cardIds) ? payload.cardIds : [];
      console.log('[ROOM] Join request received:', {
        socketId: client.id,
        playerId: playerIdentifier,
        roomId: GLOBAL_ROOM_ID,
        stake,
        cardIds,
      });
      if (!VALID_STAKES.has(stake)) {
        return ack({ ok: false, error: 'Invalid stake or cartela selection' });
      }
      const walletType = payload?.walletType || 'main_wallet';
      const roomId = roomIdForStake(stake);

      let state = localRooms.get(roomId);
      if (!state || state.status === 'finished') {
        state = makeRoomState(stake, Date.now() + ROOM_JOIN_WINDOW_MS);
        localRooms.set(roomId, state);
        scheduleRoom(roomId, state);
      }

      const existingJoin = state.players.find((p) => String(p.telegramId) === String(player.id));
      if (existingJoin) {
        let mainWallet = 0;
        let playWallet = 0;
        if (await isPostgresConfigured()) {
          const account = await getPostgresUser(String(player.id));
          if (!account) return ack({ ok: false, error: 'Local player wallet is unavailable' });
          mainWallet = Number(account.main_wallet ?? account.balance ?? 0);
          playWallet = Number(account.play_wallet ?? 0);
        } else {
          const account = localDb.getUser(String(player.id));
          if (!account) return ack({ ok: false, error: 'Local player wallet is unavailable' });
          mainWallet = Number(account.main_wallet ?? account.balance ?? 0);
          playWallet = Number(account.play_wallet ?? 0);
        }

        const clientCards = existingJoin.cardIds.map((id) => generateCartelaByNumber(id));
        if (state.status === 'in_progress') void startRoomGame(roomId, state);
        return ack({
          ok: true,
          duplicate: true,
          state: publicRoomState(state, getOnlinePlayerIds(io, roomId)),
          cards: clientCards,
          balance: mainWallet,
          mainWallet,
          playWallet,
        });
      }

      if (state.status === 'in_progress') {
        void startRoomGame(roomId, state);
        return ack({
          ok: true,
          spectator: true,
          state: publicRoomState(state, getOnlinePlayerIds(io, roomId)),
        });
      }
      if (payload?.rejoin) {
        return ack({ ok: false, error: 'No active cartela ticket exists for this round' });
      }
      if (cardIds.length === 0) return ack({ ok: false, error: 'Select at least one cartela' });
      if (cardIds.some((id) => !Number.isInteger(id) || id < 1 || id > 400) || new Set(cardIds).size !== cardIds.length) {
        return ack({ ok: false, error: 'Invalid stake or cartela selection' });
      }
      if (state.status !== 'waiting') {
        return ack({ ok: false, error: 'Cartela selection is closed' });
      }
      const cost = stake * cardIds.length;

      // Deduct cost and save player
      try {
        let finalBal = 0;
        let finalMain = 0;
        let finalPlay = 0;

        if (await isPostgresConfigured()) {
          const account = await getPostgresUser(String(player.id));
          if (!account) {
            await upsertPostgresUser({
              telegram_id: String(player.id),
              first_name: player.first_name || player.username || 'Player',
              full_name: player.first_name || player.username || 'Player',
              username: player.username || `player_${player.id}`,
              balance: 0,
              main_wallet: 0,
              play_wallet: 0,
            });
          }

          const pgResult = await joinPostgresBingoRoom({
            roomId,
            telegramId: String(player.id),
            name: player.first_name || player.username || 'Player',
            joinRequestId: payload?.joinRequestId || crypto.randomUUID(),
            stake,
            walletType,
            cardIds,
            initialState: state,
          });

          if (!pgResult) return ack({ ok: false, error: 'Could not join room' });
          finalBal = pgResult.balance;
          finalMain = pgResult.mainWallet;
          finalPlay = pgResult.playWallet;
          state = pgResult.state;
          if (pgResult.spectator) {
            localRooms.set(roomId, state);
            void startRoomGame(roomId, state);
            return ack({
              ok: true,
              spectator: true,
              state: publicRoomState(state, getOnlinePlayerIds(io, roomId)),
            });
          }
        } else {
          // Local JSON DB fallback
          let localUser = localDb.getUser(String(player.id));
          if (!localUser) {
            localUser = localDb.upsertUser({
              telegram_id: String(player.id),
              first_name: player.first_name || player.username || 'Player',
              username: player.username || `player_${player.id}`,
              balance: 0,
              main_wallet: 0,
              play_wallet: 0,
            });
          }

          let mainWallet = Number(localUser.main_wallet ?? localUser.balance ?? 0);
          let playWallet = Number(localUser.play_wallet ?? 0);

          if (walletType === 'play_wallet') {
            if (playWallet < cost) return ack({ ok: false, error: 'Insufficient balance or account unavailable' });
            playWallet -= cost;
          } else {
            if (mainWallet < cost) return ack({ ok: false, error: 'Insufficient balance or account unavailable' });
            mainWallet -= cost;
          }

          localUser.balance = mainWallet;
          localUser.main_wallet = mainWallet;
          localUser.play_wallet = playWallet;
          localUser.games_played = (localUser.games_played || 0) + 1;
          (localDb as any).scheduleSave();

          finalBal = mainWallet;
          finalMain = mainWallet;
          finalPlay = playWallet;

          state.players.push({
            telegramId: String(player.id),
            name: player.first_name || player.username || 'Player',
            cardIds,
            walletType,
            stake,
            joinRequestId: payload?.joinRequestId || crypto.randomUUID(),
          });

          const totalCards = state.players.reduce((total, joinedPlayer) => total + joinedPlayer.cardIds.length, 0);
          state.prizePool = totalCards * state.stake;
          localRooms.set(roomId, state);
        }

        // Keep cartela reservation active for this user across game rounds
        const userRes = cartelaReservations[stake] || {};
        for (const [cardId, reservation] of Object.entries(userRes)) {
          if (reservation.playerId === playerIdentifier) delete userRes[Number(cardId)];
        }
        cardIds.forEach((id) => {
          userRes[id] = {
            playerId: playerIdentifier,
            name: player.first_name || player.username || 'Player',
          };
        });
        cartelaReservations[stake] = userRes;
        broadcastCartelaReservations(stake);

        sendRoomState(io, roomId, state);

        const clientCards = cardIds.map((id) => generateCartelaByNumber(id));
        ack({
          ok: true,
          state: publicRoomState(state, getOnlinePlayerIds(io, roomId)),
          cards: clientCards,
          balance: finalBal,
          mainWallet: finalMain,
          playWallet: finalPlay,
        });
      } catch (err: any) {
        ack({ ok: false, error: err.message || 'Error joining the game' });
      }
    });

    client.on('room:claim', async (payload: { cardId: number; stake?: number }, ack) => {
      const cardId = Number(payload?.cardId);
      if (isNaN(cardId)) return typeof ack === 'function' && ack({ ok: false, error: 'Invalid card ID' });

      // Find which room this socket is actively in
      let foundRoomId = '';
      let state: BingoRoomState | undefined;

      if (payload?.stake && VALID_STAKES.has(Number(payload.stake))) {
        const rId = roomIdForStake(Number(payload.stake));
        if (localRooms.has(rId)) {
          foundRoomId = rId;
          state = localRooms.get(rId);
        }
      }

      if (!state) {
        for (const [rId, room] of localRooms.entries()) {
          if (room.players.some((p) => String(p.telegramId) === String(player.id))) {
            foundRoomId = rId;
            state = room;
            break;
          }
        }
      }

      if (!state) {
        // Fallback: look for any room currently in progress
        for (const [rId, room] of localRooms.entries()) {
          if (room.status === 'in_progress') {
            foundRoomId = rId;
            state = room;
            break;
          }
        }
      }

      if (!state) {
        const defaultRoomId = roomIdForStake(10);
        state = localRooms.get(defaultRoomId);
        foundRoomId = defaultRoomId;
      }

      if (!state || !foundRoomId) {
        return typeof ack === 'function' && ack({ ok: false, error: 'No active room found for this player' });
      }

      if (state.status !== 'in_progress') {
        return typeof ack === 'function' && ack({ ok: false, error: 'Game is not currently active' });
      }

      const roomPlayer = state.players.find((p) => String(p.telegramId) === String(player.id));
      if (!roomPlayer || !roomPlayer.cardIds.includes(cardId)) {
        return typeof ack === 'function' && ack({ ok: false, error: 'A purchased cartela is required to claim Bingo' });
      }

      // Authoritatively generate and check the winning card
      const card = generateCartelaByNumber(cardId);
      const calledSet = new Set(state.called);

      // Verify the daubs
      const verifiedCells = card.cells.map((row) =>
        row.map((cell) => ({
          ...cell,
          isDaubed: cell.isFree || calledSet.has(cell.number),
        }))
      );
      const verifiedCard = { ...card, cells: verifiedCells };
      const winResult = checkCardWinningPatterns(verifiedCard, 'am');

      if (!winResult.hasWon) {
        return ack({ ok: false, error: 'This card does not have a complete winning pattern' });
      }

      // Claim Bingo! Complete the game
      state.status = 'finished';
      state.winnerId = String(player.id);
      state.winningCardId = cardId;

      const totalCards = state.players.reduce((total, joinedPlayer) => total + joinedPlayer.cardIds.length, 0);
      const prize = Math.floor(totalCards * state.stake * 0.8);
      state.prize = prize;

      let finalBal = 0;
      let finalMain = 0;
      let finalPlay = 0;

      try {
        if (await isPostgresConfigured()) {
          const pgResult = await awardPostgresBingoPrize(foundRoomId, String(player.id), cardId, prize);
          if (!pgResult) {
            state.status = 'in_progress';
            state.winnerId = undefined;
            state.winningCardId = undefined;
            state.prize = undefined;
            localRooms.set(foundRoomId, state);
            return ack({ ok: false, error: 'Could not verify or award the prize' });
          }
          finalBal = pgResult.balance;
          finalMain = pgResult.mainWallet;
          finalPlay = pgResult.playWallet;
          state = pgResult.state;
        } else {
          // Local fallback
          let localUser = localDb.getUser(String(player.id));
          if (!localUser) {
            localUser = localDb.upsertUser({
              telegram_id: String(player.id),
              first_name: player.first_name || player.username || 'Player',
              username: player.username || `player_${player.id}`,
              balance: 0,
              main_wallet: 0,
              play_wallet: 0,
            });
          }

          const mainWallet = Number(localUser.main_wallet ?? localUser.balance ?? 0) + prize;
          const playWallet = Number(localUser.play_wallet ?? 0);

          localDb.upsertUser({
            ...localUser,
            balance: mainWallet,
            main_wallet: mainWallet,
            games_won: (localUser.games_won || 0) + 1,
          });

          finalBal = mainWallet;
          finalMain = mainWallet;
          finalPlay = playWallet;
        }

        localRooms.set(foundRoomId, state);

        // Cancel the ball calling loop timer
        const drawTimer = activeDrawTimers.get(foundRoomId);
        if (drawTimer) {
          clearInterval(drawTimer);
          activeDrawTimers.delete(foundRoomId);
        }

        // Release all cartelas so the new game starts fresh
        cartelaReservations[state.stake] = {};
        broadcastCartelaReservations(state.stake);

        // Broadcast the winner and updated room state
        io.to(foundRoomId).emit('room:winner', {
          gameId: state.gameId,
          winnerId: String(player.id),
          winnerName: player.first_name || player.username || 'Winner',
          cardId,
          prize,
          balance: finalBal,
          mainWallet: finalMain,
          playWallet: finalPlay,
          win: winResult,
        });

        const publicState = publicRoomState(state, getOnlinePlayerIds(io, foundRoomId));
        io.to(foundRoomId).emit('room:state', publicState);
        scheduleRoomReset(foundRoomId);

        // Broadcast updated balance to the winner socket
        socket.emit('wallet:balance', {
          balance: finalBal,
          mainWallet: finalMain,
          playWallet: finalPlay,
        });

        ack({
          ok: true,
          state: publicState,
          balance: finalBal,
          mainWallet: finalMain,
          playWallet: finalPlay,
          win: winResult,
        });
      } catch (err: any) {
        ack({ ok: false, error: err.message || 'Error processing victory payout' });
      }
    });

    client.on('room:leave', (payload: { stake: number }) => {
      const stake = Number(payload.stake);
      if (!VALID_STAKES.has(stake)) return;
      const userRes = cartelaReservations[stake] || {};
      for (const [cardId, reservation] of Object.entries(userRes)) {
        if (reservation.playerId === playerIdentifier) delete userRes[Number(cardId)];
      }
      cartelaReservations[stake] = userRes;
      broadcastCartelaReservations(stake);
    });

    client.on('disconnect', () => {
      const userRes = cartelaReservations[10] || {};
      for (const [cardId, reservation] of Object.entries(userRes)) {
        if (reservation.playerId === playerIdentifier) delete userRes[Number(cardId)];
      }
      cartelaReservations[10] = userRes;
      broadcastCartelaReservations(10);
      const state = localRooms.get(GLOBAL_ROOM_ID);
      if (state) sendRoomState(io, GLOBAL_ROOM_ID, state);
    });

    void Promise.all([roomMembership, ensureGlobalRoom()])
      .then(([, globalState]) => {
        if (!client.connected) return;
        sendRoomState(io, GLOBAL_ROOM_ID, globalState);
        broadcastCartelaReservations(globalState.stake);
        client.emit('room:ready');
      })
      .catch((error) => {
        console.error('Could not initialize the global bingo connection:', error);
      });
  });

  void ensureGlobalRoom().catch((error) => {
    console.error('Could not initialize the global bingo room at server startup:', error);
  });
  return {
    getAdminRoomState,
    resetSelectionRound,
    setSelectionWindow,
  };
}