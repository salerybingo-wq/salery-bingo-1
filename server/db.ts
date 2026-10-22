import fs from 'fs';
import path from 'path';

export interface DbUser {
  id?: string | number;
  telegram_id: string;
  player_code: string;
  first_name: string;
  full_name?: string;
  username: string;
  phone_number: string;
  balance: number;
  main_wallet?: number;
  play_wallet?: number;
  role: 'admin' | 'user';
  status: 'active' | 'blocked';
  is_blocked: boolean;
  ban_reason?: string;
  is_verified: boolean;
  referred_by?: string;
  share_bonus_awarded?: boolean;
  referral_count: number;
  total_deposited: number;
  total_withdrawn: number;
  games_played: number;
  games_won: number;
  created_at: string;
  updated_at: string;
}

export interface DbTransaction {
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
  created_at: string;
}

export interface DbGameLog {
  id: string;
  telegram_id: string;
  game_code: string;
  timestamp: number;
  stake: number;
  cards_count: number;
  result: 'won' | 'lost';
  won_amount: number;
  pattern_name?: string;
  created_at: string;
}

export interface DbBroadcast {
  id: string;
  message: string;
  photo_url?: string;
  target: string;
  sent_count: number;
  created_at: string;
}

export interface DbMedia {
  id: string;
  url: string;
  title: string;
  category: string;
  created_at: string;
}

export interface DbBotConfig {
  bot_token: string;
  bot_username: string;
  web_app_url?: string;
  configured_at?: string;
}

export interface DbSupabaseConfig {
  url: string;
  key: string;
  is_connected?: boolean;
  configured_at?: string;
}

export interface DatabaseSchema {
  version: number;
  security_mode: 'local_isolated_secure';
  updated_at: string;
  users: Record<string, DbUser>;
  transactions: DbTransaction[];
  game_logs: DbGameLog[];
  broadcasts: DbBroadcast[];
  media: DbMedia[];
  bot_config: DbBotConfig;
  supabase_config?: DbSupabaseConfig;
  admin_revenue?: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'salery_bingo_db.json');

const INITIAL_MEDIA: DbMedia[] = [
  {
    id: 'med_bonus',
    url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80',
    title: 'የዕለቱ ቦነስ እና ጉርሻ (Daily Bonus)',
    category: 'bonus',
    created_at: new Date().toISOString(),
  },
  {
    id: 'med_bingo',
    url: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop&q=80',
    title: 'አዲስ የቢንጎ ዙር ጀምሯል (Game Started)',
    category: 'banner',
    created_at: new Date().toISOString(),
  },
  {
    id: 'med_winner',
    url: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=800&auto=format&fit=crop&q=80',
    title: 'ታላቅ አሸናፊዎች (Big Jackpot Winner)',
    category: 'winner',
    created_at: new Date().toISOString(),
  },
  {
    id: 'med_telebirr',
    url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80',
    title: 'የቴሌብር እና ባንክ ዲፖዚት (Telebirr & Bank)',
    category: 'payment',
    created_at: new Date().toISOString(),
  },
  {
    id: 'med_gold_coins',
    url: 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=800&auto=format&fit=crop&q=80',
    title: 'የወርቅ ሳንቲሞች እና ሽልማቶች (Gold Coins)',
    category: 'bonus',
    created_at: new Date().toISOString(),
  },
  {
    id: 'med_support',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
    title: 'የሳለሪ ቢንጎ ኦፊሴላዊ ድጋፍ (Official Support)',
    category: 'support',
    created_at: new Date().toISOString(),
  },
];

const INITIAL_BROADCASTS: DbBroadcast[] = [
  {
    id: 'bc_init_1',
    message:
      '🌅 እንደምን አደራችሁ ውድ የሳለሪ ቢንጎ ቤተሰቦች!\n\nየዛሬው አስደሳች የቢንጎ ዙር ተከፍቷል። አሁኑኑ በመግባት ካርቴላ ይቁረጡና እድልዎን ይሞክሩ! 🎱💰\n\nመልካም እድል ለሁላችሁም! ✨',
    photo_url: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop&q=80',
    target: 'all',
    sent_count: 32,
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'bc_init_2',
    message:
      '🔥 ልዩ የዕለቱ የዲፖዚት ጉርሻ (Deposit Bonus) 🔥\n\nዛሬ ከ 100 ብር በላይ ዲፖዚት ለሚያደርጉ ተጫዋቾች በሙሉ ተጨማሪ 10% ቦነስ ወዲያውኑ ገቢ ይደረጋል!\n\nእድሉ እንዳያመልጥዎ አሁኑኑ አካውንትዎን ይሙሉና ይጫወቱ! 💳🚀',
    photo_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80',
    target: 'all',
    sent_count: 45,
    created_at: new Date(Date.now() - 3600000 * 22).toISOString(),
  },
];

const INITIAL_TRANSACTIONS: DbTransaction[] = [];

export class LocalSecureDatabase {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;
  private persistedSignature: string | null = null;

  constructor() {
    this.ensureDirectory();
    this.data = this.loadData();
    this.persistedSignature = this.getDataSignature(this.data);
    this.ensureDefaultAdmin();
  }

  private getDataSignature(data: DatabaseSchema): string {
    const { updated_at, ...rest } = data as DatabaseSchema & { updated_at?: string };
    return JSON.stringify(rest);
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create data directory:', e);
    }
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            version: parsed.version || 1,
            security_mode: 'local_isolated_secure',
            updated_at: parsed.updated_at || new Date().toISOString(),
            users: parsed.users || {},
            transactions: Array.isArray(parsed.transactions) && parsed.transactions.length > 0 ? parsed.transactions : INITIAL_TRANSACTIONS,
            game_logs: Array.isArray(parsed.game_logs) ? parsed.game_logs : [],
            broadcasts: Array.isArray(parsed.broadcasts) ? parsed.broadcasts : INITIAL_BROADCASTS,
            media: Array.isArray(parsed.media) && parsed.media.length > 0 ? parsed.media : INITIAL_MEDIA,
            bot_config: parsed.bot_config || { bot_token: '', bot_username: '' },
            admin_revenue: Number(parsed.admin_revenue) || 0,
          };
        }
      }
    } catch (err) {
      console.warn('Could not read existing DB file, creating fresh secure store:', err);
    }

    const defaultDb: DatabaseSchema = {
      version: 1,
      security_mode: 'local_isolated_secure',
      updated_at: new Date().toISOString(),
      users: {},
      transactions: INITIAL_TRANSACTIONS,
      game_logs: [],
      broadcasts: INITIAL_BROADCASTS,
      media: INITIAL_MEDIA,
      bot_config: {
        bot_token: process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '8938320220:AAHFhv8peXf9CEjGgPYBD8d-ipjRynj-nAQ',
        bot_username: 'salerybingo_bot',
        web_app_url: process.env.APP_URL || process.env.FRONTEND_URL || 'https://salery-bingo-1.vercel.app',
      },
      admin_revenue: 0,
    };

    this.persistSync(defaultDb);
    return defaultDb;
  }

  private persistSync(targetData = this.data) {
    try {
      const signature = this.getDataSignature(targetData);
      if (this.persistedSignature === signature) return;

      this.ensureDirectory();
      targetData.updated_at = new Date().toISOString();
      const serialized = JSON.stringify(targetData, null, 2);
      const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, serialized, 'utf8');
      fs.renameSync(tempPath, DB_FILE);
      this.persistedSignature = this.getDataSignature(targetData);
    } catch (err) {
      console.error('Failed to persist database synchronously:', err);
    }
  }

  private scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.persistSync();
      this.saveTimeout = null;
    }, 150);
  }

  private ensureDefaultAdmin() {
    const adminId = '908336796';
    if (!this.data.users[adminId]) {
      this.data.users[adminId] = {
        id: 1,
        telegram_id: adminId,
        player_code: 'SB-90833',
        first_name: 'Admin',
        full_name: 'ሳለሪ አድሚን (Admin)',
        username: 'salery_admin',
        phone_number: '+251911000000',
        balance: 0,
        role: 'admin',
        status: 'active',
        is_blocked: false,
        is_verified: true,
        referral_count: 0,
        total_deposited: 0,
        total_withdrawn: 0,
        games_played: 15,
        games_won: 8,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Restore and ensure Jo_cr7 user is preserved
    const initialPlayers: Array<Partial<DbUser> & { telegram_id: string }> = [
      {
        id: 102,
        telegram_id: '5873620165',
        player_code: 'SB-62805',
        first_name: 'Jo_cr7',
        full_name: 'Jo_cr7 (@jo_cr7)',
        username: 'jo_cr7',
        phone_number: '+251908336796',
        balance: 0,
        role: 'user',
        status: 'active',
        is_blocked: false,
        is_verified: true,
        total_deposited: 346,
        total_withdrawn: 0,
        games_played: 1,
        games_won: 0,
        created_at: '2026-09-25T21:38:00.000Z',
        updated_at: '2026-09-25T21:38:00.000Z',
      },
    ];

    // Purge fake mock seed users
    const fakeIds = ['554192831', '666120888', '778901234', '889012345', '990123456', '806558124', '712394012', '698301921', '541209381', '498102931', '389102931'];
    for (const fId of fakeIds) {
      delete this.data.users[fId];
    }

    for (const p of initialPlayers) {
      if (!this.data.users[p.telegram_id]) {
        this.data.users[p.telegram_id] = {
          id: p.id || Date.now(),
          telegram_id: p.telegram_id,
          player_code: p.player_code || `SB-${Math.floor(10000 + Math.random() * 90000)}`,
          first_name: p.first_name || 'Player',
          full_name: p.full_name || p.first_name || 'Player',
          username: p.username || '',
          phone_number: p.phone_number || '',
          balance: p.balance ?? 0,
          role: 'user',
          status: 'active',
          is_blocked: false,
          is_verified: !!p.is_verified,
          referral_count: 0,
          total_deposited: p.total_deposited || 0,
          total_withdrawn: p.total_withdrawn || 0,
          games_played: p.games_played || 0,
          games_won: p.games_won || 0,
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString(),
        };
      }
    }

    this.persistSync();
  }

  // --- Users Operations ---

  getUser(telegramId: string | number): DbUser | null {
    const key = String(telegramId);
    const user = this.data.users[key];
    if (!user) return null;
    return user;
  }

  getAllUsers(): DbUser[] {
    return Object.values(this.data.users).sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }

  upsertUser(user: Partial<DbUser> & { telegram_id: string }): DbUser {
    const key = String(user.telegram_id);
    const existing = this.data.users[key];

    if (existing) {
      const updated: DbUser = {
        ...existing,
        ...user,
        balance: user.balance !== undefined ? user.balance : (user.main_wallet !== undefined ? user.main_wallet : existing.balance),
        main_wallet: user.main_wallet !== undefined ? user.main_wallet : (existing.main_wallet ?? existing.balance),
        play_wallet: user.play_wallet !== undefined ? user.play_wallet : (existing.play_wallet ?? 0),
        updated_at: new Date().toISOString(),
      };
      this.data.users[key] = updated;
      this.scheduleSave();
      return updated;
    } else {
      const initialMain = user.main_wallet !== undefined
        ? user.main_wallet
        : (user.balance !== undefined ? user.balance : 0);
      const initialPlay = user.play_wallet !== undefined ? user.play_wallet : 0;
      const newUser: DbUser = {
        id: Date.now(),
        telegram_id: key,
        player_code: user.player_code || `SB-${Math.floor(10000 + Math.random() * 90000)}`,
        first_name: user.first_name || 'Player',
        full_name: user.full_name || user.first_name || 'Player',
        username: user.username || '',
        phone_number: user.phone_number || '',
        balance: initialMain,
        main_wallet: initialMain,
        play_wallet: initialPlay,
        role: user.role || 'user',
        status: user.status || 'active',
        is_blocked: !!user.is_blocked,
        ban_reason: user.ban_reason,
        is_verified: !!user.is_verified || !!user.phone_number,
        referred_by: user.referred_by,
        referral_count: 0,
        total_deposited: 0,
        total_withdrawn: 0,
        games_played: 0,
        games_won: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.data.users[key] = newUser;
      this.scheduleSave();
      return newUser;
    }
  }

  updateUserWallets(
    telegramId: string | number,
    mainWallet: number,
    playWallet: number
  ): boolean {
    const key = String(telegramId);
    const user = this.data.users[key];
    if (user) {
      user.main_wallet = Math.max(0, Math.floor(mainWallet));
      user.play_wallet = Math.max(0, Math.floor(playWallet));
      user.balance = user.main_wallet;
      user.updated_at = new Date().toISOString();
      this.scheduleSave();
      return true;
    }
    return false;
  }

  updateUserBalance(
    telegramId: string | number,
    newBalance: number,
    _options?: { skipLocalDevOverride?: boolean }
  ): boolean {
    const key = String(telegramId);
    const user = this.data.users[key];
    if (user) {
      user.balance = Math.max(0, Math.floor(newBalance));
      user.main_wallet = user.balance;
      user.updated_at = new Date().toISOString();
      this.scheduleSave();
      return true;
    }
    return false;
  }

  updateUserPhone(telegramId: string | number, phone: string): boolean {
    const key = String(telegramId);
    let user = this.data.users[key];
    if (user) {
      user.phone_number = phone;
      user.is_verified = true;
      user.updated_at = new Date().toISOString();
    } else {
      user = this.upsertUser({
        telegram_id: key,
        phone_number: phone,
        is_verified: true,
      });
    }
    this.persistSync();
    return true;
  }

  setUserStatus(telegramId: string | number, status: 'active' | 'blocked', reason?: string): boolean {
    const key = String(telegramId);
    const user = this.data.users[key];
    if (user) {
      user.status = status;
      user.is_blocked = status === 'blocked';
      user.ban_reason = status === 'blocked' ? (reason || 'የአገልግሎት ደንብ መጣስ') : undefined;
      user.updated_at = new Date().toISOString();
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // --- Transactions Operations ---

  getTransactions(filter?: { type?: string; status?: string }): DbTransaction[] {
    let list = [...this.data.transactions];
    if (filter?.type) {
      list = list.filter((t) => t.type === filter.type);
    }
    if (filter?.status) {
      list = list.filter((t) => t.status === filter.status);
    }
    return list;
  }

  addTransaction(tx: DbTransaction): DbTransaction {
    this.data.transactions.unshift(tx);
    // keep max 2000 transactions
    if (this.data.transactions.length > 2000) {
      this.data.transactions.pop();
    }
    this.scheduleSave();
    return tx;
  }

  updateTransactionStatus(id: string, status: 'approved' | 'rejected', note?: string): DbTransaction | null {
    const tx = this.data.transactions.find((t) => t.id === id);
    if (tx) {
      tx.status = status;
      if (note) tx.notes = note;
      this.scheduleSave();
      return tx;
    }
    return null;
  }

  deleteTransaction(id: string): boolean {
    const idx = this.data.transactions.findIndex((t) => t.id === id);
    if (idx !== -1) {
      this.data.transactions.splice(idx, 1);
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // --- Game Logs ---

  getGameLogs(telegramId?: string): DbGameLog[] {
    if (telegramId) {
      return this.data.game_logs.filter((g) => g.telegram_id === telegramId);
    }
    return this.data.game_logs;
  }

  addGameLog(log: DbGameLog): DbGameLog {
    this.data.game_logs.unshift(log);
    if (this.data.game_logs.length > 1000) {
      this.data.game_logs.pop();
    }
    // Calculate 20% commission from game stake and accumulate into admin_revenue
    const stake = Number(log.stake) || 10;
    const cardsCount = Number(log.cards_count) || 1;
    const totalStake = stake * cardsCount;
    const commission = totalStake * 0.20;
    this.data.admin_revenue = (this.data.admin_revenue || 0) + commission;

    // Update player game stats
    const user = this.data.users[log.telegram_id];
    if (user) {
      user.games_played = (user.games_played || 0) + 1;
      if (log.result === 'won') {
        user.games_won = (user.games_won || 0) + 1;
      }
    }
    this.scheduleSave();
    return log;
  }

  // --- Broadcasts ---

  getBroadcasts(): DbBroadcast[] {
    return this.data.broadcasts;
  }

  addBroadcast(bc: DbBroadcast): DbBroadcast {
    this.data.broadcasts.unshift(bc);
    if (this.data.broadcasts.length > 200) {
      this.data.broadcasts.pop();
    }
    this.scheduleSave();
    return bc;
  }

  // --- Media ---

  getMedia(): DbMedia[] {
    return this.data.media;
  }

  addMedia(item: DbMedia): DbMedia {
    this.data.media.unshift(item);
    if (this.data.media.length > 200) {
      this.data.media.pop();
    }
    this.scheduleSave();
    return item;
  }

  // --- Bot Config ---

  getBotConfig(): DbBotConfig {
    return this.data.bot_config || { bot_token: '', bot_username: '' };
  }

  saveBotConfig(token: string, username: string, webAppUrl?: string) {
    this.data.bot_config = {
      bot_token: token.trim(),
      bot_username: username.replace('@', '').trim(),
      web_app_url: webAppUrl ? webAppUrl.trim() : (this.data.bot_config?.web_app_url || 'https://salery-bingo-1.vercel.app'),
      configured_at: new Date().toISOString(),
    };
    this.persistSync();
  }

  // --- Supabase Config ---

  getSupabaseConfig(): DbSupabaseConfig {
    return this.data.supabase_config || { url: '', key: '' };
  }

  saveSupabaseConfig(url: string, key: string) {
    this.data.supabase_config = {
      url: url.trim(),
      key: key.trim(),
      is_connected: true,
      configured_at: new Date().toISOString(),
    };
    this.persistSync();
  }

  // --- Backup & Restore ---

  exportBackup(): string {
    return JSON.stringify(this.data, null, 2);
  }

  importBackup(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object' && parsed.users) {
        this.data = {
          version: parsed.version || 1,
          security_mode: 'local_isolated_secure',
          updated_at: new Date().toISOString(),
          users: parsed.users || {},
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
          game_logs: Array.isArray(parsed.game_logs) ? parsed.game_logs : [],
          broadcasts: Array.isArray(parsed.broadcasts) ? parsed.broadcasts : INITIAL_BROADCASTS,
          media: Array.isArray(parsed.media) ? parsed.media : INITIAL_MEDIA,
          bot_config: parsed.bot_config || this.data.bot_config,
        };
        this.persistSync();
        return true;
      }
    } catch (err) {
      console.error('Failed to import backup:', err);
    }
    return false;
  }

  getStatus() {
    const users = Object.values(this.data.users);
    const totalBalance = users.reduce((sum, u) => sum + (u.balance || 0), 0);
    const activeUsers = users.filter((u) => u.status !== 'blocked').length;
    return {
      ok: true,
      storageType: 'local_isolated_secure',
      isSecure: true,
      description: '100% ራሱን የቻለ የተጠበቀ ሰርቨር ዳታቤዝ (Zero Third-Party Dependency - Supabase አያስፈልገውም)',
      totalUsers: users.length,
      activeUsers,
      blockedUsers: users.length - activeUsers,
      totalBalance,
      admin_revenue: this.data.admin_revenue || 0,
      totalTransactions: this.data.transactions.length,
      pendingTransactions: this.data.transactions.filter((t) => t.status === 'pending').length,
      lastUpdated: this.data.updated_at,
    };
  }
}

export const localDb = new LocalSecureDatabase();
