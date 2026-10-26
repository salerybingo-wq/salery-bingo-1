import { Pool, PoolClient } from 'pg';

export interface PostgresUser {
  telegram_id: string;
  player_code?: string;
  first_name?: string;
  full_name?: string;
  username?: string;
  phone_number?: string;
  balance?: number;
  main_wallet?: number;
  play_wallet?: number;
  role?: string;
  status?: string;
  is_blocked?: boolean;
  ban_reason?: string;
  is_verified?: boolean;
  referred_by?: string;
  share_bonus_awarded?: boolean;
}

export interface PostgresTransaction {
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
  notes?: string;
  created_at?: string;
}

export interface BingoRoomPlayer {
  telegramId: string;
  name: string;
  cardIds: number[];
  stake: number;
  walletType?: 'main_wallet' | 'play_wallet';
  joinRequestId: string;
}

export interface BingoRoomState {
  gameId: string;
  stake: number;
  status: 'waiting' | 'in_progress' | 'finished';
  startsAt: number;
  nextBallAt?: number;
  deck: number[];
  called: number[];
  prizePool: number;
  players: BingoRoomPlayer[];
  winnerId?: string;
  winningCardId?: number;
  prize?: number;
}

let pool: Pool | null | undefined;
let schemaReady: Promise<void> | null = null;

const schemaSql = `
  CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    telegram_id TEXT UNIQUE NOT NULL,
    player_code TEXT,
    first_name TEXT,
    full_name TEXT,
    username TEXT,
    phone_number TEXT,
    balance NUMERIC DEFAULT 0,
    main_wallet NUMERIC DEFAULT 0,
    play_wallet NUMERIC DEFAULT 0,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    is_blocked BOOLEAN DEFAULT false,
    ban_reason TEXT,
    is_verified BOOLEAN DEFAULT false,
    referred_by TEXT,
    share_bonus_awarded BOOLEAN DEFAULT false,
    referral_count INTEGER DEFAULT 0,
    total_deposited NUMERIC DEFAULT 0,
    total_withdrawn NUMERIC DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS main_wallet NUMERIC;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS play_wallet NUMERIC;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS share_bonus_awarded BOOLEAN DEFAULT false;
  UPDATE public.users
    SET main_wallet = COALESCE(main_wallet, balance, 0),
        play_wallet = COALESCE(play_wallet, 0);
  ALTER TABLE public.users ALTER COLUMN main_wallet SET DEFAULT 0;
  ALTER TABLE public.users ALTER COLUMN play_wallet SET DEFAULT 0;
  UPDATE public.users SET share_bonus_awarded = false WHERE share_bonus_awarded IS NULL;
  ALTER TABLE public.users ALTER COLUMN share_bonus_awarded SET DEFAULT false;
  CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    player_name TEXT,
    player_code TEXT,
    phone_number TEXT,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    reference TEXT,
    screenshot_url TEXT,
    photo_file_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.deposits (
    id TEXT PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    player_name TEXT,
    player_code TEXT,
    phone_number TEXT,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    reference TEXT,
    screenshot_url TEXT,
    photo_file_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.withdrawals (
    id TEXT PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    player_name TEXT,
    player_code TEXT,
    phone_number TEXT,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS photo_file_id TEXT;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
  ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS photo_file_id TEXT;
  ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  CREATE INDEX IF NOT EXISTS deposits_created_idx ON public.deposits (created_at DESC);
  CREATE INDEX IF NOT EXISTS withdrawals_created_idx ON public.withdrawals (created_at DESC);
  CREATE INDEX IF NOT EXISTS transactions_telegram_created_idx
    ON public.transactions (telegram_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS public.bingo_rooms (
    room_id TEXT PRIMARY KEY,
    state JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.bingo_broadcasts (
    id TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    photo_url TEXT,
    target TEXT NOT NULL,
    sent_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.bingo_wallet_ledger (
    idempotency_key TEXT PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('stake', 'prize')),
    wallet_type TEXT NOT NULL DEFAULT 'main_wallet' CHECK (wallet_type IN ('main_wallet', 'play_wallet')),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE public.bingo_wallet_ledger ADD COLUMN IF NOT EXISTS wallet_type TEXT NOT NULL DEFAULT 'main_wallet';
  CREATE TABLE IF NOT EXISTS public.bingo_platform_commission_ledger (
    idempotency_key TEXT PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

function getPool(): Pool | null {
  if (pool !== undefined) return pool;
  const connectionString = (process.env.SUPABASE_DB_URL || '').trim();
  pool = connectionString
    ? new Pool({
        connectionString,
        max: 3,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
        ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
      })
    : null;
  return pool;
}

export function isPostgresConfigured(): boolean {
  return !!getPool();
}

export async function initializePostgres(): Promise<boolean> {
  const client = getPool();
  if (!client) return false;
  await ensureSchema(client);
  return true;
}

export async function savePostgresBroadcast(broadcast: {
  id: string;
  message: string;
  photo_url?: string;
  target: string;
  sent_count: number;
  created_at?: string;
}): Promise<Record<string, any> | null> {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query(
    `INSERT INTO public.bingo_broadcasts (id, message, photo_url, target, sent_count, created_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))
     ON CONFLICT (id) DO UPDATE SET
       message = EXCLUDED.message,
       photo_url = EXCLUDED.photo_url,
       target = EXCLUDED.target,
       sent_count = EXCLUDED.sent_count
     RETURNING *`,
    [broadcast.id, broadcast.message, broadcast.photo_url || null, broadcast.target, broadcast.sent_count, broadcast.created_at || null]
  );
  return result.rows[0] || null;
}

export async function getPostgresBroadcasts(limit = 200): Promise<Record<string, any>[] | null> {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query(
    'SELECT id, message, photo_url, target, sent_count, created_at FROM public.bingo_broadcasts ORDER BY created_at DESC LIMIT $1',
    [Math.max(1, Math.min(500, Math.floor(limit)))]
  );
  return result.rows;
}

async function ensureSchema(client: Pool | PoolClient): Promise<void> {
  if (!schemaReady) {
    schemaReady = client.query(schemaSql).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export async function getPostgresUser(telegramId: string | number): Promise<Record<string, any> | null> {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query('SELECT * FROM public.users WHERE telegram_id = $1 LIMIT 1', [String(telegramId)]);
  return result.rows[0] || null;
}

export async function getPostgresUsers(): Promise<Record<string, any>[] | null> {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query('SELECT * FROM public.users ORDER BY created_at DESC');
  return result.rows;
}

export async function upsertPostgresUser(user: PostgresUser): Promise<Record<string, any> | null> {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query(
    `INSERT INTO public.users (
      telegram_id, player_code, first_name, full_name, username, phone_number, balance, main_wallet, play_wallet,
      role, status, is_blocked, ban_reason, is_verified, referred_by, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
    ON CONFLICT (telegram_id) DO UPDATE SET
      player_code = COALESCE(NULLIF(EXCLUDED.player_code, ''), users.player_code),
      first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), users.first_name),
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), users.full_name),
      username = COALESCE(NULLIF(EXCLUDED.username, ''), users.username),
      phone_number = COALESCE(NULLIF(EXCLUDED.phone_number, ''), users.phone_number),
      role = COALESCE(EXCLUDED.role, users.role),
      status = COALESCE(EXCLUDED.status, users.status),
      is_blocked = COALESCE(EXCLUDED.is_blocked, users.is_blocked),
      ban_reason = COALESCE(EXCLUDED.ban_reason, users.ban_reason),
      is_verified = COALESCE(EXCLUDED.is_verified, users.is_verified),
      referred_by = COALESCE(EXCLUDED.referred_by, users.referred_by),
      updated_at = NOW()
    RETURNING *`,
    [
      String(user.telegram_id), user.player_code || '', user.first_name || '', user.full_name || '',
      user.username || '', user.phone_number || '', Number(user.main_wallet ?? user.balance ?? 0),
      Number(user.main_wallet ?? user.balance ?? 0), Number(user.play_wallet ?? 0), user.role || 'user',
      user.status || 'active', user.is_blocked ?? false, user.ban_reason || null,
      user.is_verified ?? false, user.referred_by || null,
    ]
  );
  return result.rows[0] || null;
}

export async function setPostgresUserBalance(telegramId: string | number, balance: number): Promise<number | null> {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query(
    'UPDATE public.users SET balance = $2, main_wallet = $2, updated_at = NOW() WHERE telegram_id = $1 RETURNING balance',
    [String(telegramId), Math.max(0, balance)]
  );
  return result.rows[0] ? Number(result.rows[0].balance) : null;
}

export async function setPostgresUserWallets(
  telegramId: string | number,
  mainWallet: number,
  playWallet: number
): Promise<{ balance: number; mainWallet: number; playWallet: number } | null> {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query(
    'UPDATE public.users SET balance = $2, main_wallet = $2, play_wallet = $3, updated_at = NOW() WHERE telegram_id = $1 RETURNING balance, main_wallet, play_wallet',
    [String(telegramId), Math.max(0, Math.floor(mainWallet)), Math.max(0, Math.floor(playWallet))]
  );
  if (!result.rows[0]) return null;
  return {
    balance: Number(result.rows[0].balance),
    mainWallet: Number(result.rows[0].main_wallet),
    playWallet: Number(result.rows[0].play_wallet),
  };
}

export async function getPostgresBingoRoom(roomId: string): Promise<BingoRoomState | null> {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query('SELECT state FROM public.bingo_rooms WHERE room_id = $1', [roomId]);
  return result.rows[0]?.state as BingoRoomState || null;
}

export async function savePostgresBingoRoom(roomId: string, state: BingoRoomState): Promise<void> {
  const client = getPool();
  if (!client) throw new Error('PostgreSQL is not configured');
  await ensureSchema(client);
  await client.query(
    'INSERT INTO public.bingo_rooms (room_id, state, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (room_id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()',
    [roomId, JSON.stringify(state)]
  );
}

export async function listPostgresBingoRooms(): Promise<Array<{ roomId: string; state: BingoRoomState }>> {
  const client = getPool();
  if (!client) return [];
  await ensureSchema(client);
  const result = await client.query("SELECT room_id, state FROM public.bingo_rooms WHERE state->>'status' IN ('waiting', 'in_progress', 'finished')");
  return result.rows.map((row) => ({ roomId: row.room_id, state: row.state as BingoRoomState }));
}

export async function joinPostgresBingoRoom(input: {
  roomId: string;
  telegramId: string;
  name: string;
  joinRequestId: string;
  stake: number;
  walletType: 'main_wallet' | 'play_wallet';
  cardIds: number[];
  initialState: BingoRoomState;
}): Promise<{ state: BingoRoomState; balance: number; mainWallet: number; playWallet: number; duplicate: boolean; spectator?: boolean } | null> {
  const poolClient = getPool();
  if (!poolClient) return null;
  await ensureSchema(poolClient);
  const client = await poolClient.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO public.bingo_rooms (room_id, state) VALUES ($1, $2::jsonb) ON CONFLICT (room_id) DO NOTHING',
      [input.roomId, JSON.stringify(input.initialState)]
    );
    const roomResult = await client.query('SELECT state FROM public.bingo_rooms WHERE room_id = $1 FOR UPDATE', [input.roomId]);
    let state = roomResult.rows[0]?.state as BingoRoomState;
    if (!state) throw new Error('Room unavailable');
    if (state.status === 'finished') {
      const previousPlayer = state.players.find((player) => player.telegramId === input.telegramId);
      if (previousPlayer?.joinRequestId === input.joinRequestId) {
        const userResult = await client.query('SELECT balance, main_wallet, play_wallet FROM public.users WHERE telegram_id = $1', [input.telegramId]);
        if (!userResult.rows[0]) throw new Error('Wallet unavailable');
        await client.query('COMMIT');
        return {
          state,
          balance: Number(userResult.rows[0].main_wallet ?? userResult.rows[0].balance),
          mainWallet: Number(userResult.rows[0].main_wallet ?? userResult.rows[0].balance),
          playWallet: Number(userResult.rows[0].play_wallet ?? 0),
          duplicate: true,
        };
      }
      state = input.initialState;
    }
    if (state.status === 'waiting' && state.players.length === 0 && state.stake !== input.stake) {
      state = input.initialState;
    }
    const existingPlayer = state.players.find((player) => player.telegramId === input.telegramId);
    if (existingPlayer) {
      const userResult = await client.query('SELECT balance, main_wallet, play_wallet FROM public.users WHERE telegram_id = $1', [input.telegramId]);
      if (!userResult.rows[0]) throw new Error('Wallet unavailable');
      await client.query('COMMIT');
      return {
        state,
        balance: Number(userResult.rows[0].main_wallet ?? userResult.rows[0].balance),
        mainWallet: Number(userResult.rows[0].main_wallet ?? userResult.rows[0].balance),
        playWallet: Number(userResult.rows[0].play_wallet ?? 0),
        duplicate: true,
      };
    }
    if (state.status === 'in_progress') {
      const userResult = await client.query(
        'SELECT balance, main_wallet, play_wallet FROM public.users WHERE telegram_id = $1',
        [input.telegramId]
      );
      await client.query('COMMIT');
      const account = userResult.rows[0];
      return {
        state,
        balance: Number(account?.main_wallet ?? account?.balance ?? 0),
        mainWallet: Number(account?.main_wallet ?? account?.balance ?? 0),
        playWallet: Number(account?.play_wallet ?? 0),
        duplicate: false,
        spectator: true,
      };
    }
    if (state.status !== 'waiting') {
      throw new Error('This game has already started');
    }

    const reserved = new Set(state.players.flatMap((player) => player.cardIds));
    if (input.cardIds.some((cardId) => reserved.has(cardId))) throw new Error('A selected card was just taken');

    const cost = input.stake * input.cardIds.length;
    const walletColumn = input.walletType === 'play_wallet' ? 'play_wallet' : 'main_wallet';
    const walletFallback = input.walletType === 'play_wallet' ? '0' : 'balance';
    const wallet = await client.query(
      `UPDATE public.users
      SET ${walletColumn} = COALESCE(${walletColumn}, ${walletFallback}) - $2,
          balance = CASE WHEN $3 = 'main_wallet' THEN COALESCE(main_wallet, balance, 0) - $2 ELSE COALESCE(main_wallet, balance, 0) END,
          updated_at = NOW()
       WHERE telegram_id = $1 AND COALESCE(${walletColumn}, ${walletFallback}, 0) >= $2
         AND COALESCE(status, 'active') = 'active' AND COALESCE(is_blocked, false) = false
       RETURNING balance, main_wallet, play_wallet`,
      [input.telegramId, cost, input.walletType]
    );
    if (!wallet.rows[0]) throw new Error('Insufficient balance or account unavailable');

    state.players.push({
      telegramId: input.telegramId,
      name: input.name,
      cardIds: input.cardIds,
      stake: cost,
      walletType: input.walletType,
      joinRequestId: input.joinRequestId,
    });
    const commission = input.walletType === 'main_wallet' ? Math.floor(cost * 0.2) : 0;
    state.prizePool += cost;
    await client.query(
      'INSERT INTO public.bingo_wallet_ledger (idempotency_key, telegram_id, game_id, kind, wallet_type, amount) VALUES ($1, $2, $3, \'stake\', $4, $5)',
      [`stake:${state.gameId}:${input.telegramId}`, input.telegramId, state.gameId, input.walletType, cost]
    );
    if (commission > 0) {
      await client.query(
        'INSERT INTO public.bingo_platform_commission_ledger (idempotency_key, telegram_id, game_id, amount) VALUES ($1, $2, $3, $4)',
        [`commission:${state.gameId}:${input.telegramId}`, input.telegramId, state.gameId, commission]
      );
    }
    await client.query(
      'INSERT INTO public.bingo_rooms (room_id, state, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (room_id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()',
      [input.roomId, JSON.stringify(state)]
    );
    await client.query('COMMIT');
    return {
      state,
      balance: Number(wallet.rows[0].main_wallet ?? wallet.rows[0].balance),
      mainWallet: Number(wallet.rows[0].main_wallet ?? wallet.rows[0].balance),
      playWallet: Number(wallet.rows[0].play_wallet ?? 0),
      duplicate: false,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function mutatePostgresBingoRoom(
  roomId: string,
  mutate: (state: BingoRoomState) => BingoRoomState
): Promise<BingoRoomState | null> {
  const poolClient = getPool();
  if (!poolClient) return null;
  await ensureSchema(poolClient);
  const client = await poolClient.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT state FROM public.bingo_rooms WHERE room_id = $1 FOR UPDATE', [roomId]);
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const nextState = mutate(result.rows[0].state as BingoRoomState);
    await client.query('UPDATE public.bingo_rooms SET state = $2::jsonb, updated_at = NOW() WHERE room_id = $1', [roomId, JSON.stringify(nextState)]);
    await client.query('COMMIT');
    return nextState;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function awardPostgresBingoPrize(
  roomId: string,
  telegramId: string,
  cardId: number,
  prize: number
): Promise<{ state: BingoRoomState; balance: number; mainWallet: number; playWallet: number } | null> {
  const poolClient = getPool();
  if (!poolClient) return null;
  await ensureSchema(poolClient);
  const client = await poolClient.connect();
  try {
    await client.query('BEGIN');
    const roomResult = await client.query('SELECT state FROM public.bingo_rooms WHERE room_id = $1 FOR UPDATE', [roomId]);
    const state = roomResult.rows[0]?.state as BingoRoomState | undefined;
    const player = state?.players.find((entry) => entry.telegramId === telegramId && entry.cardIds.includes(cardId));
    const finalDrawClaim = state?.status === 'finished' && !state.winnerId && state.called.length === 75;
    if (!state || (state.status !== 'in_progress' && !finalDrawClaim) || !player || prize < 0 || prize > state.prizePool) {
      await client.query('ROLLBACK');
      return null;
    }
    const wallet = await client.query(
      'UPDATE public.users SET main_wallet = COALESCE(main_wallet, balance, 0) + $2, balance = COALESCE(main_wallet, balance, 0) + $2, updated_at = NOW() WHERE telegram_id = $1 RETURNING balance, main_wallet, play_wallet',
      [telegramId, prize]
    );
    if (!wallet.rows[0]) throw new Error('Winner wallet unavailable');
    await client.query(
      'INSERT INTO public.bingo_wallet_ledger (idempotency_key, telegram_id, game_id, kind, wallet_type, amount) VALUES ($1, $2, $3, \'prize\', \'main_wallet\', $4)',
      [`prize:${state.gameId}`, telegramId, state.gameId, prize]
    );
    const finished: BingoRoomState = {
      ...state,
      status: 'finished',
      winnerId: telegramId,
      winningCardId: cardId,
      prize,
    };
    await client.query('UPDATE public.bingo_rooms SET state = $2::jsonb, updated_at = NOW() WHERE room_id = $1', [roomId, JSON.stringify(finished)]);
    await client.query('COMMIT');
    return {
      state: finished,
      balance: Number(wallet.rows[0].main_wallet ?? wallet.rows[0].balance),
      mainWallet: Number(wallet.rows[0].main_wallet ?? wallet.rows[0].balance),
      playWallet: Number(wallet.rows[0].play_wallet ?? 0),
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setPostgresUserStatus(
  telegramId: string | number,
  status: 'active' | 'blocked',
  reason?: string
): Promise<boolean | null> {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query(
    `UPDATE public.users
     SET status = $2, is_blocked = $3, ban_reason = $4, updated_at = NOW()
     WHERE telegram_id = $1`,
    [String(telegramId), status, status === 'blocked', status === 'blocked' ? (reason || 'Terms violation') : null]
  );
  return (result.rowCount || 0) > 0;
}

export async function savePostgresTransaction(transaction: PostgresTransaction): Promise<Record<string, any> | null> {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const connection = await client.connect();
  try {
    await connection.query('BEGIN');
    const result = await connection.query(
      `INSERT INTO public.transactions (
        id, telegram_id, player_name, player_code, phone_number, type, amount, status,
        reference, screenshot_url, photo_file_id, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, NOW()), NOW())
      ON CONFLICT (id) DO NOTHING
      RETURNING *`,
      [
        transaction.id, String(transaction.telegram_id), transaction.player_name, transaction.player_code,
        transaction.phone_number || '', transaction.type, Number(transaction.amount), transaction.status,
        transaction.reference || '', transaction.screenshot_url || '', transaction.photo_file_id || '',
        transaction.notes || '', transaction.created_at || null,
      ]
    );
    const table = transaction.type === 'deposit' ? 'deposits' : 'withdrawals';
    await connection.query(
      `INSERT INTO public.${table} (
        id, telegram_id, player_name, player_code, phone_number, amount, status, reference,
        ${transaction.type === 'deposit' ? 'screenshot_url, photo_file_id, ' : ''}notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        ${transaction.type === 'deposit' ? '$9, $10, ' : ''}$11, COALESCE($12::timestamptz, NOW()), NOW()
      ) ON CONFLICT (id) DO NOTHING`,
      transaction.type === 'deposit'
        ? [transaction.id, String(transaction.telegram_id), transaction.player_name, transaction.player_code, transaction.phone_number || '', Number(transaction.amount), transaction.status, transaction.reference || '', transaction.screenshot_url || '', transaction.photo_file_id || '', transaction.notes || '', transaction.created_at || null]
        : [transaction.id, String(transaction.telegram_id), transaction.player_name, transaction.player_code, transaction.phone_number || '', Number(transaction.amount), transaction.status, transaction.reference || '', transaction.notes || '', transaction.created_at || null]
    );
    const stored = result.rows[0] || (await connection.query('SELECT * FROM public.transactions WHERE id = $1', [transaction.id])).rows[0];
    await connection.query('COMMIT');
    return stored || null;
  } catch (error) {
    await connection.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function getPostgresTransactions(filters?: { type?: string; status?: string }): Promise<Record<string, any>[] | null> {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const conditions: string[] = [];
  const values: string[] = [];
  if (filters?.type === 'deposit' || filters?.type === 'withdraw') {
    values.push(filters.type);
    conditions.push(`type = $${values.length}`);
  }
  if (filters?.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await client.query(`SELECT * FROM public.transactions ${where} ORDER BY created_at DESC`, values);
  return result.rows;
}

export async function updatePostgresTransactionStatus(
  id: string,
  status: 'approved' | 'rejected',
  note?: string
): Promise<{ transaction: Record<string, any>; balance: number | null; balanceChanged: boolean } | null> {
  const poolClient = getPool();
  if (!poolClient) return null;
  await ensureSchema(poolClient);
  const client = await poolClient.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM public.transactions WHERE id = $1 FOR UPDATE', [id]);
    const transaction = found.rows[0];
    if (!transaction) {
      await client.query('ROLLBACK');
      return null;
    }

    const balanceChanged = status === 'approved' && transaction.status !== 'approved';
    let balance: number | null = null;
    if (balanceChanged) {
      const delta = transaction.type === 'deposit' ? Number(transaction.amount) : -Number(transaction.amount);
      const updatedUser = await client.query(
        `UPDATE public.users
         SET main_wallet = GREATEST(0, COALESCE(main_wallet, balance, 0) + $2),
             balance = GREATEST(0, COALESCE(main_wallet, balance, 0) + $2),
             updated_at = NOW()
         WHERE telegram_id = $1
         RETURNING balance, main_wallet, play_wallet`,
        [String(transaction.telegram_id), delta]
      );
      if (updatedUser.rows[0]) balance = Number(updatedUser.rows[0].balance);
    } else {
      const user = await client.query('SELECT balance, main_wallet, play_wallet FROM public.users WHERE telegram_id = $1', [String(transaction.telegram_id)]);
      if (user.rows[0]) balance = Number(user.rows[0].balance);
    }

    const updated = await client.query(
      `UPDATE public.transactions
       SET status = $2, notes = CASE WHEN $3::text IS NULL OR $3 = '' THEN notes ELSE CONCAT_WS(' ', NULLIF(notes, ''), $3) END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, note || null]
    );
    const table = transaction.type === 'deposit' ? 'deposits' : 'withdrawals';
    await client.query(
      `UPDATE public.${table}
       SET status = $2, notes = CASE WHEN $3::text IS NULL OR $3 = '' THEN notes ELSE CONCAT_WS(' ', NULLIF(notes, ''), $3) END,
           updated_at = NOW()
       WHERE id = $1`,
      [id, status, note || null]
    );
    await client.query('COMMIT');
    return { transaction: updated.rows[0], balance, balanceChanged };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePostgresTransaction(id: string): Promise<boolean | null> {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const connection = await client.connect();
  try {
    await connection.query('BEGIN');
    const result = await connection.query('DELETE FROM public.transactions WHERE id = $1', [id]);
    await connection.query('DELETE FROM public.deposits WHERE id = $1', [id]);
    await connection.query('DELETE FROM public.withdrawals WHERE id = $1', [id]);
    await connection.query('COMMIT');
    return (result.rowCount || 0) > 0;
  } catch (error) {
    await connection.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}