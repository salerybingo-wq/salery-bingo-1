import { UserProfile, AdminUserRecord, TransactionRecord, PlayerGameHistory } from '../types';
import {
  getBrowserSupabaseClient,
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  testSupabaseConnection,
  supabaseFetchAllUsers,
  supabaseCreateTransaction,
  supabaseFetchTransactions,
  supabaseUpdateTransactionStatus,
  supabaseUpdateUserBalance,
  subscribeToSupabaseTable,
  SUPABASE_SQL_SCHEMA,
} from './supabase';

export {
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  testSupabaseConnection,
  subscribeToSupabaseTable,
  SUPABASE_SQL_SCHEMA,
};

function getAuthenticatedBackendUrls(): string[] {
  const urls: string[] = [];
  if (typeof window !== 'undefined' && !isStaticFrontendUrl(window.location.origin)) {
    urls.push(window.location.origin.replace(/\/$/, ''));
  }
  if (!urls.includes(PRIMARY_LIVE_BACKEND)) urls.push(PRIMARY_LIVE_BACKEND);
  return urls;
}

interface TelegramMiniAppUser {
  id: number;
  first_name?: string;
  username?: string;
}

function getTelegramMiniAppAuth() {
  if (typeof window === 'undefined') return null;
  const webApp = (window as Window & {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: { user?: TelegramMiniAppUser };
      };
    };
  }).Telegram?.WebApp;
  const initData = webApp?.initData?.trim();
  const user = webApp?.initDataUnsafe?.user;
  return initData && Number.isSafeInteger(user?.id) && Number(user?.id) > 0
    ? { initData, user: user! }
    : null;
}

function getTelegramAuthorizationHeaders(): Record<string, string> {
  const auth = getTelegramMiniAppAuth();
  return auth ? { Authorization: `tma ${auth.initData}` } : {};
}

/**
 * Utility to identify static frontend hosts (like Vercel, Netlify, Github Pages)
 * so they are NEVER accidentally queried as backend API endpoints.
 */
export function isStaticFrontendUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('vercel.app') ||
    lower.includes('netlify.app') ||
    lower.includes('pages.dev') ||
    lower.includes('github.io')
  );
}

export function getAutoDiscoveredRailwayUrl(): string {
  if (typeof window !== 'undefined') {
    const envBackend = (import.meta as any).env?.VITE_SERVER_URL || (import.meta as any).env?.VITE_BACKEND_URL;
    if (envBackend && typeof envBackend === 'string' && envBackend.startsWith('http')) {
      return envBackend.replace(/\/$/, '');
    }
  }
  return 'https://salery-bingo-1-production.up.railway.app';
}

/**
 * Real-time Cloud Backend Server URLs running the bot and local database
 */
export const LIVE_CLOUD_BACKENDS = [
  'https://salery-bingo-1-production.up.railway.app',
  'https://salery-bingo-backend-production.up.railway.app',
];

export const PRIMARY_LIVE_BACKEND = getAutoDiscoveredRailwayUrl();

const FALLBACK_BACKENDS = LIVE_CLOUD_BACKENDS;

/**
 * Get locally stored custom Backend Server URL
 */
export function getStoredBackendUrl(): string {
  if (typeof window === 'undefined') return PRIMARY_LIVE_BACKEND;
  try {
    const saved = localStorage.getItem('salery_bingo_backend_url');
    if (saved && saved.startsWith('http') && !isStaticFrontendUrl(saved)) {
      return saved;
    }
  } catch {}
  return PRIMARY_LIVE_BACKEND;
}

/**
 * Set locally stored custom Backend Server URL
 */
export function setStoredBackendUrl(url: string) {
  if (typeof window === 'undefined') return;
  try {
    const clean = (url || '').trim().replace(/\/$/, '');
    if (clean && !isStaticFrontendUrl(clean)) {
      localStorage.setItem('salery_bingo_backend_url', clean);
    }
  } catch {}
}

/**
 * Resolve candidate backend URLs in priority order
 */
export function getCandidateBackendUrls(): string[] {
  const candidates: string[] = [];

  // 1. Check URL query param e.g. ?backend=https://...
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const paramBackend = params.get('backend');
      if (paramBackend && paramBackend.startsWith('http') && !paramBackend.includes('ais-dev-') && !paramBackend.includes('ais-pre-')) {
        const cleanParam = paramBackend.replace(/\/$/, '');
        if (!candidates.includes(cleanParam)) {
          candidates.push(cleanParam);
        }
      }
    } catch {}

    if (window.location.hash) {
      try {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const hb = hashParams.get('backend');
        if (hb && hb.startsWith('http') && !hb.includes('ais-dev-') && !hb.includes('ais-pre-')) {
          const cleanHb = hb.replace(/\/$/, '');
          if (!candidates.includes(cleanHb)) {
            candidates.push(cleanHb);
          }
        }
      } catch {}
    }

    try {
      const saved = localStorage.getItem('salery_bingo_backend_url');
      if (saved && (saved.includes('ais-dev-') || saved.includes('ais-pre-'))) {
        localStorage.removeItem('salery_bingo_backend_url');
      } else if (saved && saved.startsWith('http') && !isStaticFrontendUrl(saved)) {
        const cleanSaved = saved.replace(/\/$/, '');
        if (!candidates.includes(cleanSaved)) {
          candidates.push(cleanSaved);
        }
      }
    } catch {}
  }

  // 2. Add current origin for APIs served alongside the frontend, excluding serverless Vercel hosts so the persistent Railway bot backend is always prioritized.
  if (typeof window !== 'undefined' && window.location.origin) {
    const origin = window.location.origin.replace(/\/$/, '');
    const isVercelHost = window.location.hostname.endsWith('.vercel.app');
    if (!isStaticFrontendUrl(origin) && !isVercelHost && !candidates.includes(origin)) {
      candidates.unshift(origin);
    }
  }

  // 3. Add stored backend URL
  const stored = getStoredBackendUrl();
  if (stored && !candidates.includes(stored)) {
    candidates.push(stored);
  }

  // 4. Always add all live cloud backend servers
  for (const fb of LIVE_CLOUD_BACKENDS) {
    const cleanFb = fb ? fb.replace(/\/$/, '') : '';
    if (cleanFb && !candidates.includes(cleanFb)) {
      candidates.push(cleanFb);
    }
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

/**
 * Get locally stored Telegram Bot Token
 */
export function getStoredBotToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('salery_bingo_bot_token') || '';
  } catch {
    return '';
  }
}

/**
 * Set locally stored Telegram Bot Token
 */
export function setStoredBotToken(token: string) {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem('salery_bingo_bot_token', token.trim());
    } else {
      localStorage.removeItem('salery_bingo_bot_token');
    }
  } catch {}
}

/**
 * Fetch current Telegram Bot connection status
 */
export async function fetchBotConfig(): Promise<{
  ok: boolean;
  isConfigured: boolean;
  botUsername?: string;
  maskedToken?: string;
  webAppUrl?: string;
}> {
  const candidateUrls = getCandidateBackendUrls();
  const localToken = getStoredBotToken();

  for (const baseUrl of candidateUrls) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (localToken) headers['x-bot-token'] = localToken;

      const res = await fetch(`${baseUrl}/api/admin/bot-config`, {
        headers,
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.ok) {
        if (localToken && !data.isConfigured) {
          return {
            ok: true,
            isConfigured: true,
            botUsername: typeof window !== 'undefined' ? localStorage.getItem('salery_bingo_bot_username') || undefined : undefined,
            maskedToken: `${localToken.slice(0, 6)}...${localToken.slice(-4)}`,
          };
        }
        return data;
      }
    } catch {}
  }

  return {
    ok: true,
    isConfigured: !!(localToken && localToken.length > 10),
    botUsername: typeof window !== 'undefined' ? localStorage.getItem('salery_bingo_bot_username') || undefined : undefined,
    maskedToken: localToken ? `${localToken.slice(0, 6)}...${localToken.slice(-4)}` : '',
  };
}

/**
 * Save & test Telegram Bot token on backend and localStorage
 */
export async function saveBotConfig(
  botToken: string,
  botUsername?: string,
  webAppUrl?: string
): Promise<{ ok: boolean; message?: string; error?: string; bot?: any; webAppUrl?: string }> {
  const cleanToken = (botToken || '').trim();
  if (!cleanToken && !webAppUrl) {
    return { ok: false, error: 'የቦት ቶከን ወይም የዌብአፕ አድራሻ ማስገባት አስፈላጊ ነው' };
  }

  const candidateUrls = getCandidateBackendUrls();
  let lastError = '';

  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/admin/bot-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ botToken: cleanToken, botUsername, webAppUrl }),
        signal: AbortSignal.timeout(3000),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        if (cleanToken) setStoredBotToken(cleanToken);
        if (data.bot?.username && typeof window !== 'undefined') {
          localStorage.setItem('salery_bingo_bot_username', data.bot.username);
        }
        if (data.webAppUrl && typeof window !== 'undefined') {
          localStorage.setItem('salery_bingo_webapp_url', data.webAppUrl);
        }
        return data;
      }
      if (data?.error) {
        lastError = data.error;
      }
    } catch (e: any) {
      lastError = e.message;
    }
  }

  // Fallback: Test directly against Telegram API
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const tgData: any = await tgRes.json();
    if (tgData && tgData.ok && tgData.result) {
      setStoredBotToken(cleanToken);
      if (typeof window !== 'undefined' && tgData.result.username) {
        localStorage.setItem('salery_bingo_bot_username', tgData.result.username);
      }
      return {
        ok: true,
        message: 'ቦቱ በተሳካ ሁኔታ ተገናኝቷል!',
        bot: tgData.result,
      };
    } else {
      return {
        ok: false,
        error: tgData?.description || 'የቴሌግራም ቦት ቶከን ልክ አይደለም',
      };
    }
  } catch {}

  return { ok: false, error: lastError || 'ቦቱን ማገናኘት አልተቻለም' };
}

/**
 * Fetch Supabase configuration from backend
 */
export async function fetchSupabaseBackendConfig(): Promise<{
  ok: boolean;
  url?: string;
  isConfigured?: boolean;
  isConnected?: boolean;
  maskedKey?: string;
}> {
  const candidateUrls = getCandidateBackendUrls();
  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/admin/supabase-config`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) return data;
      }
    } catch {}
  }
  const localCfg = getStoredSupabaseConfig();
  return {
    ok: true,
    url: localCfg.url,
    isConfigured: localCfg.isConfigured,
    isConnected: localCfg.isConfigured,
    maskedKey: localCfg.maskedKey,
  };
}

/**
 * Save Supabase configuration to backend and localStorage
 */
export async function saveSupabaseBackendConfig(
  url: string,
  key: string
): Promise<{ ok: boolean; message?: string; error?: string; tablesExist?: boolean }> {
  const cleanUrl = (url || '').trim().replace(/\/+$/, '');
  const cleanKey = (key || '').trim();

  // Save to localStorage immediately
  saveStoredSupabaseConfig(cleanUrl, cleanKey);

  // Test client-side directly
  const clientTest = await testSupabaseConnection(cleanUrl, cleanKey);

  // Also send to backend
  const candidateUrls = getCandidateBackendUrls();
  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/admin/supabase-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, key: cleanKey }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {}
  }

  return {
    ok: clientTest.ok,
    tablesExist: clientTest.tablesExist,
    message: clientTest.message,
    error: clientTest.ok ? undefined : clientTest.message,
  };
}

/**
 * Return primary backend URL
 */
export function getBackendBaseUrl(): string {
  const list = getCandidateBackendUrls();
  return list[0] || '';
}

export interface BingoGuestSession {
  playerId: number;
  token: string;
  balance: number;
  mainWallet: number;
  playWallet: number;
  playerCode?: string;
}

export async function getBingoGuestSession(): Promise<BingoGuestSession> {
  if (typeof window === 'undefined') throw new Error('Guest sessions are only available in a browser');

  let savedSession: Partial<BingoGuestSession> | null = null;
  try {
    const saved = JSON.parse(localStorage.getItem('salery_bingo_guest_session') || 'null');
    if (
      Number.isSafeInteger(saved?.playerId) &&
      saved.playerId > 0 &&
      typeof saved.token === 'string' &&
      /^[a-f0-9]{64}$/i.test(saved.token)
    ) {
      savedSession = { playerId: saved.playerId, token: saved.token };
    }
  } catch (error) {
    console.warn('Could not read the saved guest session:', error);
  }

  let lastError: Error | null = null;
  for (const baseUrl of getCandidateBackendUrls()) {
    try {
      const response = await fetch(`${baseUrl}/api/bingo/guest-session`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(savedSession || {}),
        signal: AbortSignal.timeout(5000),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) {
        lastError = new Error(result?.error || `Guest session request failed (${response.status})`);
        continue;
      }
      if (
        !Number.isSafeInteger(result.playerId) ||
        typeof result.token !== 'string' ||
        typeof result.balance !== 'number' ||
        typeof result.mainWallet !== 'number' ||
        typeof result.playWallet !== 'number'
      ) {
        lastError = new Error('Guest session response was invalid');
        continue;
      }

      const session: BingoGuestSession = {
        playerId: result.playerId,
        token: result.token,
        balance: result.balance,
        mainWallet: result.mainWallet,
        playWallet: result.playWallet,
        playerCode: typeof result.playerCode === 'string' ? result.playerCode : undefined,
      };
      localStorage.setItem('salery_bingo_guest_session', JSON.stringify(session));
      localStorage.setItem('salery_bingo_player_id', String(session.playerId));
      localStorage.setItem('salery_bingo_unique_id', String(session.playerId));
      return session;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError || new Error('No backend could issue a guest session');
}

/**
 * Instant Player Registration & Sync across Supabase and Backend
 * Ensures player is recorded immediately in a split second
 */
export async function syncUserRegistration(): Promise<{ ok: boolean; user?: any; balance?: number }> {
  const auth = getTelegramMiniAppAuth();
  if (!auth) return { ok: false };
  const tId = String(auth.user.id);

  const candidateUrls = getAuthenticatedBackendUrls();
  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/user/sync`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `tma ${auth.initData}`,
        },
        body: JSON.stringify({
          telegramId: tId,
        }),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.ok) {
        return {
          ok: true,
          user: data.user,
          balance: typeof data.balance === 'number' ? data.balance : undefined,
        };
      }
      console.warn('Telegram Mini App user registration failed:', data?.error || res.statusText);
    } catch (error) {
      console.warn(`Could not register the Telegram Mini App user with ${baseUrl}:`, error);
    }
  }

  return { ok: false };
}

/**
 * Fetch fresh user profile and balance from Supabase / Backend API
 */
export async function fetchUserProfile(telegramId: number | string): Promise<{
  ok: boolean;
  balance: number;
  mainWallet?: number;
  playWallet?: number;
  user?: Partial<UserProfile>;
  phoneNumber?: string;
  backendUrl?: string;
  status?: 'active' | 'blocked';
  isBlocked?: boolean;
  ban_reason?: string;
  supabaseConnected?: boolean;
} | null> {
  if (!telegramId) return null;
  const tId = String(telegramId);
  const candidateUrls = getAuthenticatedBackendUrls();

  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/user/${telegramId}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', ...getTelegramAuthorizationHeaders() },
        signal: AbortSignal.timeout(2500),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) continue;

      const data = await res.json();
      if (!data || data.ok === false) continue;
      const rawUser = data.user || {};
      const finalBalance = Number(data.mainWallet ?? rawUser.main_wallet ?? data.balance);
      const playWallet = Number(data.playWallet ?? rawUser.play_wallet ?? 0);
      if (!Number.isFinite(finalBalance) || !Number.isFinite(playWallet)) continue;

      // We found a working backend! Save it to localStorage (unless static frontend host)
      if (typeof window !== 'undefined' && baseUrl.startsWith('http') && !isStaticFrontendUrl(baseUrl)) {
        try {
          localStorage.setItem('salery_bingo_backend_url', baseUrl);
        } catch {}
      }

      const isBlocked = !!(
        data.isBlocked ||
        data.status === 'blocked' ||
        rawUser.is_blocked ||
        rawUser.status === 'blocked'
      );
      const banReason = data.ban_reason || rawUser.ban_reason;

      return {
        ok: true,
        balance: finalBalance,
        mainWallet: finalBalance,
        playWallet,
        phoneNumber: rawUser.phone_number || '',
        backendUrl: baseUrl,
        status: isBlocked ? 'blocked' : 'active',
        isBlocked,
        ban_reason: banReason,
        supabaseConnected: data.supabaseConnected,
        user: {
          telegramId: Number(telegramId),
          firstName: rawUser.first_name || rawUser.full_name || '',
          username: rawUser.username || '',
          phoneNumber: rawUser.phone_number || '',
          balance: finalBalance,
          mainWallet: finalBalance,
          playWallet,
          role: data.role || rawUser.role || (tId === '908336796' ? 'admin' : 'user'),
          playerCode: data.playerCode || rawUser.player_code || '',
          status: isBlocked ? 'blocked' : 'active',
          is_blocked: isBlocked,
          ban_reason: banReason,
        },
      };
    } catch {}
  }

  return null;
}

/**
 * Sync balance change to backend & Supabase
 */
export async function syncBalanceWithBackend(
  telegramId: number | string,
  payload: { balance?: number; delta?: number; reason?: string }
): Promise<number | null> {
  if (!telegramId) return null;

  // Sync to Supabase directly
  if (typeof payload.balance === 'number') {
    supabaseUpdateUserBalance(telegramId, payload.balance).then(() => {}, () => {});
  } else if (typeof payload.delta === 'number') {
    // Fetch and apply delta directly in Supabase for rock-solid sync on both web and bot
    const supaClient = getBrowserSupabaseClient();
    if (supaClient) {
      supaClient
        .from('users')
        .select('balance')
        .eq('telegram_id', String(telegramId))
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) {
            const current = Number(data.balance ?? 10);
            const target = Math.max(0, current + (payload.delta || 0));
            supabaseUpdateUserBalance(telegramId, target).then(() => {}, () => {});
          }
        }, () => {});
    }
  }

  const candidateUrls = getCandidateBackendUrls();

  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/user/${telegramId}/balance`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2500),
      });

      if (!res.ok) continue;

      const data = await res.json();
      if (typeof data.balance === 'number') {
        return data.balance;
      }
    } catch {}
  }

  return payload.balance ?? null;
}

const FALLBACK_DEFAULT_USERS: AdminUserRecord[] = [];

export const OLD_PURGED_TX_IDS = new Set([
  'dep_tg_1790490110823_281',
  'dep_tg_1790371969546_479',
  'dep_tg_1790370320646_753',
]);

const FALLBACK_DEFAULT_TRANSACTIONS: TransactionRecord[] = [];

export function getDeletedTxIds(): Set<string> {
  try {
    const list = JSON.parse(localStorage.getItem('salery_deleted_tx_ids') || '[]');
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function saveDeletedTxId(txId: string) {
  try {
    const set = getDeletedTxIds();
    set.add(txId);
    localStorage.setItem('salery_deleted_tx_ids', JSON.stringify(Array.from(set)));
  } catch {}
}

/**
 * Fetch all registered players from Supabase and Backend for Admin Panel
 */
export async function fetchAdminUsers(): Promise<{
  ok: boolean;
  users: AdminUserRecord[];
  totalUsers: number;
  totalBalance: number;
  totalActive: number;
  totalBlocked: number;
  supabaseConnected?: boolean;
}> {
  let supaUsers: AdminUserRecord[] = [];
  const supaClient = getBrowserSupabaseClient();

  // 1. Fetch from Supabase directly
  try {
    const directUsers = await supabaseFetchAllUsers();
    if (directUsers && Array.isArray(directUsers)) {
      supaUsers = directUsers.filter((u) => u.role !== 'admin' && String(u.telegram_id) !== '908336796');
    }
  } catch (e) {
    console.warn('Direct Supabase fetchAdminUsers error:', e);
  }

  // 2. Fetch from backend API
  const candidateUrls = getCandidateBackendUrls();
  let backendUsers: AdminUserRecord[] = [];
  let isConnected = !!supaClient;

  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/admin/users`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', ...getTelegramAuthorizationHeaders() },
        signal: AbortSignal.timeout(2500),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) continue;

      const data = await res.json();
      if (data && Array.isArray(data.users)) {
        backendUsers = data.users;
        if (data.supabaseConnected !== undefined) {
          isConnected = isConnected || !!data.supabaseConnected;
        }
        break;
      }
    } catch {}
  }

  // 3. Merge Supabase & Backend users (Supabase takes precedence for real-time accuracy)
  const userMap = new Map<string, AdminUserRecord>();

  for (const bu of backendUsers) {
    if (bu.telegram_id) userMap.set(String(bu.telegram_id), bu);
  }

  for (const su of supaUsers) {
    if (su.telegram_id) userMap.set(String(su.telegram_id), su);
  }

  let combined = Array.from(userMap.values());

  // Fallback if no users returned from backend/supabase
  if (combined.length === 0) {
    combined = FALLBACK_DEFAULT_USERS;
  }

  const totalBalance = combined.reduce((sum, u) => sum + (u.balance || 0), 0);
  const totalActive = combined.filter((u) => u.status !== 'blocked').length;

  return {
    ok: true,
    users: combined,
    totalUsers: combined.length,
    totalBalance,
    totalActive,
    totalBlocked: combined.length - totalActive,
    supabaseConnected: isConnected,
  };
}

/**
 * Admin: Change player balance (set exact or apply delta)
 */
export async function adminChangePlayerBalance(
  telegramId: string | number,
  params: { balance?: number; delta?: number; reason?: string }
): Promise<{ ok: boolean; balance?: number }> {
  let updatedBalance: number | undefined;

  // 1. Direct Supabase update
  const supaClient = getBrowserSupabaseClient();
  if (supaClient) {
    try {
      const tId = String(telegramId);
      const { data: u } = await supaClient.from('users').select('balance, main_wallet').eq('telegram_id', tId).maybeSingle();
      const current = Number(u?.main_wallet ?? u?.balance ?? 0);
      let nextBal = current;
      if (typeof params.balance === 'number') {
        nextBal = params.balance;
      } else if (typeof params.delta === 'number') {
        nextBal = Math.max(0, current + params.delta);
      }
      updatedBalance = nextBal;
      await supaClient.from('users').update({
        balance: nextBal,
        main_wallet: nextBal,
        updated_at: new Date().toISOString(),
      }).eq('telegram_id', tId);
    } catch (e) {
      console.warn('Supabase balance update error:', e);
    }
  }

  // 2. Authenticated backend update
  const candidateUrls = getAuthenticatedBackendUrls();
  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/admin/user/${telegramId}/balance`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      if (data && data.ok) {
        return data;
      }
    } catch {}
  }

  return { ok: true, balance: updatedBalance };
}

/**
 * Admin: Block or Unblock a player (Ban system)
 */
export async function adminChangePlayerStatus(
  telegramId: string | number,
  status: 'active' | 'blocked',
  reason?: string
): Promise<{ ok: boolean; status?: string; reason?: string }> {
  // Sync to Supabase directly
  const supaClient = getBrowserSupabaseClient();
  if (supaClient) {
    Promise.resolve(
      supaClient
        .from('users')
        .update({
          status,
          is_blocked: status === 'blocked',
          ban_reason: status === 'blocked' ? (reason || 'የአገልግሎት ደንብ መጣስ') : null,
          updated_at: new Date().toISOString(),
        })
        .eq('telegram_id', String(telegramId))
    ).catch(() => {});
  }

  const candidateUrls = getCandidateBackendUrls();

  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/admin/user/${telegramId}/status`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ status, reason }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      if (data && data.ok) {
        return data;
      }
    } catch {}
  }

  return { ok: true, status, reason };
}

/**
 * Submit Deposit Request (Dual-written instantly to Supabase + Telegram Admin Notification)
 */
export async function submitDepositRequest(payload: {
  telegramId: string | number;
  playerName: string;
  playerCode: string;
  phoneNumber?: string;
  amount: number;
  reference?: string;
  screenshotUrl?: string;
  photoFileId?: string;
  notes?: string;
}): Promise<{ ok: boolean; transaction?: any; message?: string }> {
  const txId = 'dep_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const newTx = {
    id: txId,
    telegram_id: String(payload.telegramId),
    player_name: payload.playerName,
    player_code: payload.playerCode,
    phone_number: payload.phoneNumber || '',
    type: 'deposit' as const,
    amount: payload.amount,
    status: 'pending' as const,
    reference: payload.reference || 'Telebirr Transfer',
    screenshot_url: payload.screenshotUrl || '',
    photo_file_id: payload.photoFileId || '',
    notes: payload.notes || '',
  };

  // 1. Instant write to local cache & event dispatch for real-time UI
  try {
    const raw = localStorage.getItem('salery_cached_transactions');
    const existingList = raw ? JSON.parse(raw) : [];
    const filtered = (Array.isArray(existingList) ? existingList : []).filter(
      (t: any) => t.id !== newTx.id && !OLD_PURGED_TX_IDS.has(t.id)
    );
    filtered.unshift(newTx);
    localStorage.setItem('salery_cached_transactions', JSON.stringify(filtered));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('salery_new_transaction', { detail: newTx }));
    }
  } catch {}

  // 2. Direct Telegram notification to Admin
  const botToken = getStoredBotToken() || '8938320220:AAHFhv8peXf9CEjGgPYBD8d-ipjRynj-nAQ';
  const adminChatId = '908336796';
  const adminUrl = typeof window !== 'undefined' ? `${window.location.origin}/admin` : 'https://salery-bingo-1.vercel.app/admin';
  try {
    const textMsg =
      `🔔 <b>አዲስ የዲፖዚት ጥያቄ ቀርቧል!</b>\n\n` +
      `👤 <b>ተጫዋች፦</b> ${payload.playerName} (<code>${payload.playerCode}</code>)\n` +
      `💰 <b>የተጠየቀው መጠን፦</b> <b>${payload.amount} ETB</b>\n` +
      `📱 <b>ስልክ፦</b> <code>${payload.phoneNumber || 'ያልተገለጸ'}</code>\n` +
      `📝 <b>ማስታወሻ፦</b> ${payload.notes || 'የቴሌብር ማረጋገጫ'}\n\n` +
      `👉 <a href="${adminUrl}">በአድሚን ፓነል ለማጽደቅ እዚህ ይጫኑ</a>`;
    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: textMsg,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '👑 አድሚን ፓነል ክፈት (Open Admin)', url: adminUrl }],
          ],
        },
      }),
    }).catch(() => {});
  } catch {}

  // 3. Instant write to Supabase transactions table
  supabaseCreateTransaction(newTx).catch((e) => console.warn('Supabase deposit write warning:', e));

  // 4. Submit to backend API for admin Telegram notification
  const candidateUrls = getCandidateBackendUrls();
  let localFallbackResponse: any = null;

  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/transactions/deposit`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ ...payload, id: txId }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.ok) {
        if (data.storageType === 'local_fallback' && isStaticFrontendUrl(baseUrl)) {
          localFallbackResponse = data;
          continue;
        }
        return data;
      }
    } catch {}
  }

  return localFallbackResponse || { ok: true, transaction: newTx, message: 'Deposit request recorded instantly.' };
}

/**
 * Submit Withdrawal Request (Dual-written instantly to Supabase + Telegram Admin Notification)
 */
export async function submitWithdrawalRequest(payload: {
  telegramId: string | number;
  playerName: string;
  playerCode: string;
  phoneNumber?: string;
  amount: number;
  paymentMethod?: string;
  recipientName?: string;
  notes?: string;
}): Promise<{ ok: boolean; transaction?: any; message?: string; error?: string }> {
  const txId = 'wth_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const methodStr = payload.paymentMethod || 'Telebirr';
  const finalRef = payload.recipientName
    ? `${methodStr}: ${payload.phoneNumber || 'Not provided'} | ስም: ${payload.recipientName}`
    : `${methodStr}: ${payload.phoneNumber || 'Not provided'}`;

  const newTx = {
    id: txId,
    telegram_id: String(payload.telegramId),
    player_name: payload.playerName,
    player_code: payload.playerCode,
    phone_number: payload.phoneNumber || '',
    type: 'withdraw' as const,
    amount: payload.amount,
    status: 'pending' as const,
    reference: finalRef,
    notes: payload.notes || (payload.recipientName ? `የመክፈያ ዘዴ: ${methodStr} | የሚወጣበት ስም: ${payload.recipientName}` : `የመክፈያ ዘዴ: ${methodStr}`),
  };

  // 1. Instant write to local cache & event dispatch for real-time UI
  try {
    const raw = localStorage.getItem('salery_cached_transactions');
    const existingList = raw ? JSON.parse(raw) : [];
    const filtered = (Array.isArray(existingList) ? existingList : []).filter(
      (t: any) => t.id !== newTx.id && !OLD_PURGED_TX_IDS.has(t.id)
    );
    filtered.unshift(newTx);
    localStorage.setItem('salery_cached_transactions', JSON.stringify(filtered));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('salery_new_transaction', { detail: newTx }));
    }
  } catch {}

  // 2. Direct Telegram notification to Admin
  const botToken = getStoredBotToken() || '8938320220:AAHFhv8peXf9CEjGgPYBD8d-ipjRynj-nAQ';
  const adminChatId = '908336796';
  const adminUrl = typeof window !== 'undefined' ? `${window.location.origin}/admin` : 'https://salery-bingo-1.vercel.app/admin';
  try {
    const textMsg =
      `🔔 <b>አዲስ የገንዘብ ማውጣት (Withdrawal) ጥያቄ!</b>\n\n` +
      `👤 <b>ተጫዋች፦</b> ${payload.playerName} (<code>${payload.playerCode}</code>)\n` +
      `💰 <b>የተጠየቀው መጠን፦</b> <b>${payload.amount} ETB</b>\n` +
      `📱 <b>ስልክ / አካውንት፦</b> <code>${payload.phoneNumber || 'ያልተገለጸ'}</code>\n` +
      `📝 <b>ዝርዝር፦</b> ${finalRef}\n\n` +
      `👉 <a href="${adminUrl}">በአድሚን ፓነል ለመመልከት እዚህ ይጫኑ</a>`;
    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: textMsg,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '👑 አድሚን ፓነል ክፈት (Open Admin)', url: adminUrl }],
          ],
        },
      }),
    }).catch(() => {});
  } catch {}

  // 3. Instant write to Supabase transactions table
  supabaseCreateTransaction(newTx).catch((e) => console.warn('Supabase withdraw write warning:', e));

  // 4. Submit to backend API for admin Telegram notification
  const candidateUrls = getCandidateBackendUrls();
  let localFallbackResponse: any = null;

  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/transactions/withdraw`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ ...payload, id: txId }),
        signal: AbortSignal.timeout(3000),
      });
      const data = await res.json().catch(() => null);
      if (data && data.ok) {
        if (data.storageType === 'local_fallback' && isStaticFrontendUrl(baseUrl)) {
          localFallbackResponse = data;
          continue;
        }
        return data;
      }
    } catch {}
  }

  return localFallbackResponse || { ok: true, transaction: newTx, message: 'Withdrawal request recorded instantly.' };
}

/**
 * Admin: Fetch transactions (deposit / withdraw requests) from Supabase and Backend
 */
export async function fetchAdminTransactions(type?: 'deposit' | 'withdraw', status?: string): Promise<{
  ok: boolean;
  transactions: TransactionRecord[];
  totalCount: number;
  pendingCount: number;
  supabaseConnected?: boolean;
}> {
  const txMap = new Map<string, TransactionRecord>();
  const supaClient = getBrowserSupabaseClient();

  // 0. Auto-import from URL parameter if opened via Telegram bot link (e.g. ?new_tx=...)
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTxRaw = params.get('new_tx');
      if (urlTxRaw) {
        const parsed = JSON.parse(decodeURIComponent(urlTxRaw));
        if (parsed && parsed.id && !OLD_PURGED_TX_IDS.has(parsed.id)) {
          txMap.set(parsed.id, parsed);
        }
      }
    } catch {}
  }

  // 1. Load cached transactions from localStorage and purge old 100/300 mock ones
  try {
    const raw = localStorage.getItem('salery_cached_transactions');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const t of parsed) {
          if (t && t.id && !OLD_PURGED_TX_IDS.has(t.id)) {
            txMap.set(t.id, t);
          }
        }
      }
    }
  } catch {}

  // 2. Pull directly from Supabase
  try {
    const supaTxs = await supabaseFetchTransactions(type, status);
    if (supaTxs && Array.isArray(supaTxs)) {
      for (const st of supaTxs) {
        if (!OLD_PURGED_TX_IDS.has(st.id)) {
          txMap.set(st.id, st);
        }
      }
    }
  } catch (e) {
    console.warn('Direct Supabase fetchAdminTransactions error:', e);
  }

  // 3. Pull from backend API
  const candidateUrls = getCandidateBackendUrls();

  for (const baseUrl of candidateUrls) {
    let url = `${baseUrl}/api/admin/transactions`;
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    if (params.toString()) url += `?${params.toString()}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2500),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) continue;

      const data = await res.json();
      if (data && Array.isArray(data.transactions)) {
        for (const bt of data.transactions) {
          if (!OLD_PURGED_TX_IDS.has(bt.id)) {
            txMap.set(bt.id, bt);
          }
        }
      }
    } catch {}
  }

  const deletedSet = getDeletedTxIds();
  let list = Array.from(txMap.values()).filter(
    (t) => !OLD_PURGED_TX_IDS.has(t.id) && (t.status === 'pending' || !deletedSet.has(t.id))
  );

  // Save back to localStorage cache with old ones purged
  try {
    localStorage.setItem('salery_cached_transactions', JSON.stringify(list));
  } catch {}

  if (type) {
    list = list.filter((t) => t.type === type);
  }
  if (status) {
    list = list.filter((t) => t.status === status);
  }

  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    ok: true,
    transactions: list,
    totalCount: list.length,
    pendingCount: list.filter((t) => t.status === 'pending').length,
    supabaseConnected: !!supaClient,
  };
}

/**
 * Admin: Update transaction status (Approve or Reject) in Supabase and Backend
 */
export async function adminUpdateTransactionStatus(
  txId: string,
  status: 'approved' | 'rejected',
  note?: string,
  extraParams?: { telegramId?: string | number; amount?: number; type?: 'deposit' | 'withdraw'; balance?: number }
): Promise<{ ok: boolean; transaction?: any }> {
  // Update local cached transactions immediately for instantaneous UI feedback
  try {
    const raw = localStorage.getItem('salery_cached_transactions');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const updated = parsed.map((t: any) =>
          t.id === txId ? { ...t, status, notes: note || t.notes } : t
        );
        localStorage.setItem('salery_cached_transactions', JSON.stringify(updated));
      }
    }
  } catch {}

  // 1. Update directly in Supabase
  try {
    const supaRes = await supabaseUpdateTransactionStatus(txId, status, note);
    if (supaRes && supaRes.ok) {
      if (extraParams && extraParams.telegramId && extraParams.balance !== undefined) {
        await supabaseUpdateUserBalance(extraParams.telegramId, extraParams.balance);
      }
    }
  } catch (e) {
    console.warn('Direct Supabase updateTransaction error:', e);
  }

  // 2. Update in the authenticated backend
  const candidateUrls = getAuthenticatedBackendUrls();

  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/admin/transactions/${txId}/status`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ status, note }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.ok) return data;
    } catch {}
  }

  return { ok: true };
}

/**
 * Admin: Fetch all financial movements ledger
 */
export async function fetchAdminFinancialMovements(): Promise<{
  ok: boolean;
  movements: Array<{
    id: string;
    telegram_id: string;
    player_name: string;
    player_code: string;
    type: 'deposit' | 'withdraw' | 'game_stake' | 'game_win';
    amount: number;
    status: string;
    description: string;
    created_at: string;
    timestamp: number;
  }>;
  totalCount: number;
}> {
  const candidateUrls = getCandidateBackendUrls();

  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/admin/financial-movements`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.movements)) return data;
    } catch {}
  }

  return { ok: true, movements: [], totalCount: 0 };
}

/**
 * Record a played match for a player's game history
 */
export async function logGameHistory(
  telegramId: string | number,
  gameData: {
    stake: number;
    cardsCount: number;
    result: 'won' | 'lost';
    wonAmount: number;
    patternName?: string;
    gameCode?: string;
  }
): Promise<boolean> {
  const candidateUrls = getCandidateBackendUrls();

  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/user/${telegramId}/game-history`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(gameData),
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) return true;
    } catch {}
  }
  return false;
}

/**
 * Admin or User: Fetch game history for a specific player
 */
export async function fetchPlayerGameHistory(telegramId: string | number): Promise<{
  ok: boolean;
  history: any[];
  totalGames: number;
}> {
  const candidateUrls = getCandidateBackendUrls();

  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/user/${telegramId}/game-history`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.history)) return data;
    } catch {}
  }

  return { ok: true, history: [], totalGames: 0 };
}

/**
 * Admin: Broadcast announcement to players
 */
export async function adminBroadcastMessage(
  message: string,
  targetTelegramId?: string | number,
  photoUrl?: string,
  photoTitle?: string
): Promise<{
  ok: boolean;
  sentCount?: number;
  record?: any;
  error?: string;
  warning?: string;
  botDelivered?: boolean;
}> {
  const candidateUrls = getCandidateBackendUrls();
  const localBotToken = getStoredBotToken();
  let lastError = '';

  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/admin/broadcast`;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getTelegramAuthorizationHeaders(),
      };
      if (localBotToken) {
        headers['x-bot-token'] = localBotToken;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          targetTelegramId,
          photoUrl,
          photoTitle,
          botToken: localBotToken || undefined,
        }),
        signal: AbortSignal.timeout(3500),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data && data.ok) {
        return data;
      }

      if (data && (data.error || data.warning)) {
        lastError = data.error || data.warning;
      }
    } catch (e: any) {
      lastError = e.message;
    }
  }

  // Fallback: local storage backup
  const fallbackRecord = {
    id: 'bc_local_' + Date.now(),
    message: message || 'የሳለሪ ቢንጎ ማስታወቂያ',
    photo_url: photoUrl,
    target: targetTelegramId ? String(targetTelegramId) : 'all',
    sent_count: 1,
    created_at: new Date().toISOString(),
  };

  try {
    const existing = JSON.parse(localStorage.getItem('salery_local_broadcasts') || '[]');
    existing.unshift(fallbackRecord);
    localStorage.setItem('salery_local_broadcasts', JSON.stringify(existing.slice(0, 50)));
  } catch {}

  return {
    ok: true,
    sentCount: 1,
    record: fallbackRecord,
    warning: lastError || 'መልእክቱ ተመዝግቧል። ወደ ቴሌግራም ቦት በቀጥታ ለመላክ የቦት ቶከን (BOT_TOKEN) ያገናኙ።',
  };
}

/**
 * Admin: Fetch broadcast message history
 */
export async function fetchBroadcastHistory(): Promise<{
  ok: boolean;
  history: Array<{
    id: string;
    message: string;
    photo_url?: string;
    target: string;
    sent_count: number;
    created_at: string;
  }>;
}> {
  const candidateUrls = getCandidateBackendUrls();

  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/admin/broadcast/history`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.history)) {
        return data;
      }
    } catch {}
  }
  try {
    const localList = JSON.parse(localStorage.getItem('salery_local_broadcasts') || '[]');
    return { ok: true, history: localList };
  } catch {
    return { ok: true, history: [] };
  }
}

/**
 * Admin: Fetch media gallery
 */
export async function fetchMediaGallery(): Promise<{
  ok: boolean;
  media: Array<{
    id: string;
    url: string;
    title: string;
    category: string;
    created_at: string;
  }>;
}> {
  const candidateUrls = getCandidateBackendUrls();

  for (const baseUrl of candidateUrls) {
    const url = `${baseUrl}/api/admin/media`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.media)) return data;
    } catch {}
  }
  return { ok: true, media: [] };
}

/**
 * Admin: Save photo to media gallery
 */
export async function saveMediaItem(
  url: string,
  title?: string,
  category?: string
): Promise<{ ok: boolean; item?: any }> {
  const candidateUrls = getCandidateBackendUrls();

  for (const baseUrl of candidateUrls) {
    const endpoint = `${baseUrl}/api/admin/media`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ url, title, category }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.ok) return data;
    } catch {}
  }
  return { ok: false };
}

/**
 * Admin: Delete/Clear transaction record
 */
export async function deleteAdminTransaction(txId: string): Promise<{ ok: boolean }> {
  saveDeletedTxId(txId);
  const supaClient = getBrowserSupabaseClient();
  if (supaClient) {
    Promise.resolve(supaClient.from('transactions').delete().eq('id', txId)).catch(() => {});
  }

  const candidateUrls = getCandidateBackendUrls();
  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/admin/transactions/${txId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
  }
  return { ok: true };
}
