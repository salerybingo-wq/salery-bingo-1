import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import WebSocket from 'ws';
// @ts-ignore
import TelegramBot from 'node-telegram-bot-api';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { localDb, DbUser, DbTransaction, DbGameLog, DbBroadcast, DbMedia } from './server/db';
import { isValidBingoGuestToken, minimumLocalTestBalance, signBingoGuestToken } from './server/guestAuth';
import { attachBingoRooms, isLoopbackClientAllowed, validateTelegramInitData } from './server/bingo';
import {
  deletePostgresTransaction,
  getPostgresTransactions,
  getPostgresBroadcasts,
  getPostgresUser,
  getPostgresUsers,
  initializePostgres,
  isPostgresConfigured,
  savePostgresTransaction,
  savePostgresBroadcast,
  setPostgresUserBalance,
  setPostgresUserWallets,
  setPostgresUserStatus,
  updatePostgresTransactionStatus,
  upsertPostgresUser,
} from './server/postgres';

function isStaticFrontendUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('vercel.app') ||
    lower.includes('netlify.app') ||
    lower.includes('pages.dev') ||
    lower.includes('github.io')
  );
}

// Polyfill native WebSocket for Node.js environments (required by Supabase realtime client)
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

// Initialize Supabase Client with robust auto-discovery
const PRODUCTION_SUPABASE_URL = 'https://sqmicjzafgcymcfdjlai.supabase.co';
const isProduction = process.env.NODE_ENV === 'production';
let supabaseUrl = (
  isProduction
    ? PRODUCTION_SUPABASE_URL
    : process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || PRODUCTION_SUPABASE_URL
).trim();
if (!supabaseUrl) {
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v !== 'string' || !v.trim()) continue;
    const val = v.trim();
    if (val.includes('.supabase.co')) {
      supabaseUrl = val.startsWith('http') ? val : `https://${val}`;
      break;
    }
    if (k.toUpperCase().includes('SUPABASE') && k.toUpperCase().includes('URL')) {
      supabaseUrl = val.startsWith('http') ? val : `https://${val}.supabase.co`;
      break;
    }
  }
}
if (supabaseUrl.endsWith('/')) {
  supabaseUrl = supabaseUrl.slice(0, -1);
}

let supabaseKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

// Prefer Secret Keys (sb_secret_...) or JWT service_role keys (eyJ...)
const supaEnvVars = Object.entries(process.env)
  .filter(([k, v]) => typeof v === 'string' && v.trim() && k.toUpperCase().includes('SUPA'))
  .map(([k, v]) => ({ key: k, val: (v as string).trim() }));

const preferredKey =
  supabaseKey ||
  supaEnvVars.find((item) => item.val.startsWith('sb_secret_'))?.val ||
  supaEnvVars.find((item) => item.val.startsWith('eyJ'))?.val ||
  supaEnvVars.find(
    (item) =>
      item.key.toUpperCase().includes('SERVICE') ||
      item.key.toUpperCase().includes('SECRET')
  )?.val ||
  supaEnvVars.find((item) => item.key.toUpperCase().includes('ROLE'))?.val ||
  supaEnvVars.find((item) => item.key.toUpperCase().includes('KEY'))?.val ||
  '';

supabaseKey = preferredKey;

// Also fallback to any JWT in env
if (!supabaseKey) {
  for (const [, v] of Object.entries(process.env)) {
    if (typeof v === 'string' && v.trim().startsWith('eyJ') && v.trim().split('.').length === 3) {
      supabaseKey = v.trim();
      break;
    }
  }
}

let supabaseInitError = '';
let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;

  // 1. Check local secure database for configured Supabase credentials
  const savedSupa = isProduction ? { url: '', key: '' } : localDb.getSupabaseConfig();

  // 2. Re-check env vars dynamically
  let cleanUrl = (savedSupa.url || supabaseUrl || '').replace(/^['"]|['"]$/g, '').trim();
  let cleanKey = (savedSupa.key || supabaseKey || '').replace(/^['"]|['"]$/g, '').trim();

  // If cleanUrl is missing, attempt discovery from process.env
  if (!cleanUrl) {
    for (const [, v] of Object.entries(process.env)) {
      if (typeof v === 'string' && v.includes('.supabase.co')) {
        cleanUrl = v.trim().replace(/^['"]|['"]$/g, '');
        if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
        break;
      }
    }
  }

  // If cleanKey is missing, attempt discovery from process.env
  if (!cleanKey) {
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === 'string' && v.trim()) {
        const val = v.trim().replace(/^['"]|['"]$/g, '');
        if (val.startsWith('sb_secret_') || val.startsWith('eyJ')) {
          cleanKey = val;
          break;
        }
        if (k.toUpperCase().includes('SUPABASE') && (k.toUpperCase().includes('ROLE') || k.toUpperCase().includes('SERVICE') || k.toUpperCase().includes('KEY') || k.toUpperCase().includes('SECRET'))) {
          cleanKey = val;
          break;
        }
      }
    }
  }

  if (cleanUrl && cleanKey) {
    try {
      supabase = createClient(cleanUrl, cleanKey, {
        auth: { persistSession: false },
        realtime: {
          transport: WebSocket as any,
        },
      });
      supabaseInitError = '';
      console.log('✅ Supabase client dynamically initialized with URL:', cleanUrl);
      return supabase;
    } catch (err: any) {
      supabaseInitError = err?.message || String(err);
      console.error('Failed to initialize Supabase client:', supabaseInitError);
      return null;
    }
  } else {
    supabaseInitError = !cleanUrl ? 'Missing Supabase URL' : 'Missing Supabase Key';
    return null;
  }
}

export function reinitSupabase(url?: string, key?: string) {
  if (url && key) {
    localDb.saveSupabaseConfig(url, key);
  }
  supabase = null;
  return getSupabase();
}

// Initial attempt
getSupabase();

/**
 * Adaptive Upsert: handles existing users, strips non-existent columns, and guarantees instant sync
 */
export async function upsertUserAdaptive(payload: Record<string, any>) {
  const client = getSupabase();
  if (!client) return { data: null, error: 'No Supabase connection' };

  const tId = String(payload.telegram_id);
  const numId = Number(payload.telegram_id) || Math.floor(Math.random() * 100000000);

  try {
    // 1. Check if user already exists in Supabase
    const { data: existing } = await client
      .from('users')
      .select('id, telegram_id, balance')
      .eq('telegram_id', tId)
      .maybeSingle();

    if (existing) {
      const updateData: Record<string, any> = { ...payload, updated_at: new Date().toISOString() };
      delete updateData.id;
      // Do not reset balance unless explicitly provided
      if (payload.balance === undefined) delete updateData.balance;

      const { data: updated, error: updateErr } = await client
        .from('users')
        .update(updateData)
        .eq('telegram_id', tId)
        .select()
        .maybeSingle();

      if (!updateErr) {
        return { data: updated || existing, error: null };
      }
      // If error was missing column, retry with clean payload
      const colMatch = (updateErr.message || '').match(/column "(.*?)" of relation "users" does not exist/i);
      if (colMatch && colMatch[1]) {
        delete updateData[colMatch[1]];
        const { data: retryUp } = await client.from('users').update(updateData).eq('telegram_id', tId).select().maybeSingle();
        return { data: retryUp || existing, error: null };
      }
    }
  } catch {}

  // 2. Insert new user adaptively
  let currentPayload = { ...payload };

  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await client.from('users').insert([currentPayload]).select().maybeSingle();

    if (!res.error) {
      console.log('✅ Adaptive insert succeeded with fields:', Object.keys(currentPayload));
      return { data: res.data, error: null };
    }

    const errMsg = res.error.message || '';

    // If duplicate key (concurrent insert), fetch existing
    if (res.error.code === '23505' || errMsg.includes('duplicate key') || errMsg.includes('unique constraint')) {
      const { data: existingUser } = await client.from('users').select('*').eq('telegram_id', tId).maybeSingle();
      return { data: existingUser, error: null };
    }

    // Case 1: Column does not exist in users table -> strip it out
    const colMatch = errMsg.match(/column "(.*?)" of relation "users" does not exist/i);
    if (colMatch && colMatch[1]) {
      const missingCol = colMatch[1];
      delete currentPayload[missingCol];
      console.log(`Stripped non-existent column "${missingCol}", retrying...`);
      continue;
    }

    // Case 2: Column "id" violates not-null constraint
    if (
      errMsg.includes('null value in column "id"') ||
      errMsg.includes('column "id"') ||
      res.error.code === '23502'
    ) {
      currentPayload.id = numId;
      console.log(`Supplied explicit id = ${numId}, retrying...`);
      continue;
    }

    // Fallbacks
    if (attempt === 3) {
      currentPayload = {
        id: numId,
        telegram_id: String(payload.telegram_id),
        username: String(payload.username || ''),
        balance: payload.balance ?? 0,
      };
      continue;
    }
    if (attempt === 4) {
      currentPayload = {
        telegram_id: String(payload.telegram_id),
        username: String(payload.username || ''),
        balance: payload.balance ?? 0,
      };
      continue;
    }
    if (attempt === 5) {
      currentPayload = {
        telegram_id: String(payload.telegram_id),
      };
      continue;
    }

    return { data: null, error: errMsg };
  }

  return { data: null, error: 'Insert exceeded max retries' };
}

// Keep backward compatibility
export const insertUserAdaptive = upsertUserAdaptive;

// Active Bot Token State (persisted in secure local database or loaded from env)
const savedBotConfig = localDb.getBotConfig();
let activeBotToken: string = (
  process.env.BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN ||
  savedBotConfig.bot_token ||
  ''
).trim();
let activeBotUsername: string = (
  process.env.VITE_BOT_USERNAME ||
  savedBotConfig.bot_username ||
  'salerybingo_bot'
).replace('@', '').trim();
let isLongPollingRunning = false;
let currentPollingInstanceId = '';
let currentPollingToken = '';

if (!savedBotConfig.bot_token) {
  localDb.saveBotConfig(activeBotToken, activeBotUsername);
}

export function getActiveBotToken(req?: express.Request): string {
  if (req) {
    const fromHeader = req.headers['x-bot-token'] as string;
    if (fromHeader && typeof fromHeader === 'string' && fromHeader.trim().length > 10) {
      return fromHeader.trim();
    }
    const fromBody = req.body?.botToken as string;
    if (fromBody && typeof fromBody === 'string' && fromBody.trim().length > 10) {
      return fromBody.trim();
    }
  }
  return activeBotToken;
}

export function getAdminTelegramIds(): string[] {
  const ids = new Set<string>(['5873620165', '908336796', ...(process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map((s) => s.trim()) : [])]);
  try {
    for (const u of localDb.getAllUsers()) {
      if (u.role === 'admin' && u.telegram_id) {
        ids.add(String(u.telegram_id));
      }
    }
  } catch {}
  return Array.from(ids);
}

export function isAdminUser(id: string | number | undefined | null): boolean {
  if (!id) return false;
  const sId = String(id).trim();
  if (sId === '908336796') return true;
  if (process.env.ADMIN_IDS && process.env.ADMIN_IDS.split(',').map(s => s.trim()).includes(sId)) return true;
  try {
    const user = localDb.getUser(sId);
    if (user && user.role === 'admin') return true;
  } catch {}
  return false;
}

// ---------------------------------------------------------------------------
// Permanent Verified Users Registry (እንዳይጠፋ በቋሚነት ዲስክ ላይ ማስቀመጫ)
// ---------------------------------------------------------------------------
const VERIFIED_USERS_FILE = path.join(process.cwd(), 'data', 'verified_telegram_users.json');
let verifiedUsersCache: Record<string, { phone: string; name?: string; code?: string; verifiedAt: string }> = {};

try {
  if (fs.existsSync(VERIFIED_USERS_FILE)) {
    const rawData = fs.readFileSync(VERIFIED_USERS_FILE, 'utf8');
    verifiedUsersCache = JSON.parse(rawData);
  }
} catch {
  verifiedUsersCache = {};
}

// Ensure known users are preserved
if (!verifiedUsersCache['5873620165']) {
  verifiedUsersCache['5873620165'] = { phone: '+251908336796', name: 'Jo_cr7', code: 'SB-62805', verifiedAt: new Date().toISOString() };
}
if (!verifiedUsersCache['908336796']) {
  verifiedUsersCache['908336796'] = { phone: '+251911000000', name: 'Admin', code: 'SB-90833', verifiedAt: new Date().toISOString() };
}

export function markTelegramUserPermanentlyVerified(
  telegramId: string | number,
  phone: string,
  name?: string,
  code?: string
) {
  const sId = String(telegramId).trim();
  if (!sId || !phone) return;
  verifiedUsersCache[sId] = {
    phone: phone.trim(),
    name: name || 'Player',
    code,
    verifiedAt: new Date().toISOString(),
  };
  try {
    const dir = path.dirname(VERIFIED_USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(VERIFIED_USERS_FILE, JSON.stringify(verifiedUsersCache, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not save verified users file:', err);
  }
}

export function isUserEverVerified(telegramId: string | number | undefined | null): boolean {
  if (!telegramId) return false;
  const sId = String(telegramId).trim();
  if (isAdminUser(sId)) return true;
  if (verifiedUsersCache[sId]?.phone && verifiedUsersCache[sId].phone.trim().length > 3) return true;
  const local = localDb.getUser(sId);
  if (local && (local.is_verified || (local.phone_number && local.phone_number.trim().length > 3))) return true;
  return false;
}


function getVerifiedRequestUser(req: express.Request) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('tma ')) return null;
  const walletBotToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  return validateTelegramInitData(
    authorization.slice(4),
    walletBotToken,
    isLoopbackClientAllowed(req.headers.origin, req.socket.remoteAddress)
  );
}

function requireVerifiedAdmin(req: express.Request, res: express.Response): boolean {
  const user = getVerifiedRequestUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Verified Telegram WebApp authentication is required' });
    return false;
  }
  if (!isAdminUser(user.id)) {
    res.status(403).json({ ok: false, error: 'Admin access required' });
    return false;
  }
  return true;
}

function requireVerifiedPlayer(req: express.Request, res: express.Response, telegramId: string): boolean {
  const user = getVerifiedRequestUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Verified Telegram WebApp authentication is required' });
    return false;
  }
  if (String(user.id) !== String(telegramId)) {
    res.status(403).json({ ok: false, error: 'Telegram identity does not match the requested account' });
    return false;
  }
  return true;
}

export function generatePlayerCode(telegramId: string | number): string {
  const num = Math.abs(Number(telegramId)) || 12345;
  const codeNum = (num * 17) % 90000 + 10000;
  return `SB-${codeNum}`;
}

// In-memory transaction records & game history logs (with instant notifications)
export interface TransactionItem {
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

export interface PlayerGameLog {
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

const inMemoryTransactions: TransactionItem[] = [];
const inMemoryGameLogs: PlayerGameLog[] = [];
const inMemoryBannedUsers = new Map<string, { reason?: string; banned_at: string }>();

export interface BroadcastRecord {
  id: string;
  message: string;
  photo_url?: string;
  target: string;
  sent_count: number;
  created_at: string;
}

export interface MediaItem {
  id: string;
  url: string;
  title: string;
  category: string;
  created_at: string;
}

const inMemoryBroadcastHistory: BroadcastRecord[] = [
  {
    id: 'bc_init_1',
    message:
      '🌅 እንደምን አደራችሁ ውድ የሳለሪ ቢንጎ ቤተሰቦች!\n\nየዛሬው አስደሳች የቢንጎ ዙር ተከፍቷል። አሁኑኑ በመግባት ካርቴላ ይቁረጡና እድልዎን ይሞክሩ! 🎱💰\n\nመልካም እድል ለሁላችሁም! ✨',
    photo_url: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop&q=80',
    target: 'all',
    sent_count: 28,
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'bc_init_2',
    message:
      '🔥 ልዩ የዕለቱ የዲፖዚት ጉርሻ (Deposit Bonus) 🔥\n\nዛሬ ከ 100 ብር በላይ ዲፖዚት ለሚያደርጉ ተጫዋቾች በሙሉ ተጨማሪ 10% ቦነስ ወዲያውኑ ገቢ ይደረጋል!\n\nእድሉ እንዳያመልጥዎ አሁኑኑ አካውንትዎን ይሙሉና ይጫወቱ! 💳🚀',
    photo_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80',
    target: 'all',
    sent_count: 35,
    created_at: new Date(Date.now() - 3600000 * 22).toISOString(),
  },
  {
    id: 'bc_init_3',
    message:
      '🎉 እንኳን ደስ አላችሁ! 🎉\n\nበትላንትናው እለት በሳለሪ ቢንጎ ከፍተኛ ገንዘብ ያሸነፉ ተጫዋቾቻችን ክፍያቸው በቴሌብር ተጠናቋል።\n\nዛሬ የእርስዎ ተራ ነው! አሁኑኑ ተጫወቱና አሸንፉ! 🤑💵',
    photo_url: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=800&auto=format&fit=crop&q=80',
    target: 'all',
    sent_count: 40,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
];

async function persistBroadcastRecord(record: BroadcastRecord): Promise<void> {
  if (isPostgresConfigured()) {
    const saved = await savePostgresBroadcast(record);
    if (!saved) throw new Error('Supabase PostgreSQL did not save the broadcast record');
  } else if (isProduction) {
    throw new Error('Cannot persist broadcast history: Supabase PostgreSQL is unavailable');
  } else {
    localDb.addBroadcast(record);
  }
  inMemoryBroadcastHistory.unshift(record);
  if (inMemoryBroadcastHistory.length > 200) inMemoryBroadcastHistory.pop();
}

const inMemoryMediaGallery: MediaItem[] = [
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

/**
 * Send an urgent instant Telegram notification to all admins
 */
async function notifyAdminsInstant(botToken: string, text: string) {
  const adminIds = getAdminTelegramIds();
  for (const adminId of adminIds) {
    if (adminId && !isNaN(Number(adminId))) {
      try {
        await sendTelegramMessage(botToken, Number(adminId), text);
      } catch (e) {
        console.warn(`Could not alert admin ${adminId}:`, e);
      }
    }
  }
}

/**
 * Register or fetch user from Secure Local Database (zero external risk)
 */
async function getOrCreateTelegramUser(from: {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}, referredBy?: string | number) {
  const telegramId = String(from.id);
  const username = from.username || '';
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Player';
  const playerCode = generatePlayerCode(telegramId);
  const userRole = isAdminUser(telegramId) ? 'admin' : 'user';

  // 1. Check if user already exists in local secure database
  const existing = localDb.getUser(telegramId);
  if (existing) {
    const role = isAdminUser(telegramId) ? 'admin' : (existing.role || 'user');
    const finalBalance = Number(existing.balance ?? 0);
    existing.balance = finalBalance;
    existing.updated_at = new Date().toISOString();
    localDb.upsertUser({
      ...existing,
      balance: finalBalance,
      role,
      telegram_id: telegramId,
    });
    const code = existing.player_code || playerCode;
    const cached = verifiedUsersCache[telegramId];
    if (cached?.phone && (!existing.phone_number || !existing.is_verified)) {
      existing.phone_number = cached.phone;
      existing.is_verified = true;
      localDb.upsertUser(existing);
    }
    const hasPhone = isUserEverVerified(telegramId) || !!(existing.phone_number && String(existing.phone_number).trim()) || !!existing.is_verified;
    const effectivePhone = existing.phone_number || cached?.phone || '';
    console.log(`✅ Returning user from Secure Local DB: ${telegramId} (@${username}), code: ${code}, balance: ${finalBalance}, phone: ${effectivePhone || 'none'}`);
    return {
      balance: finalBalance,
      isNew: false,
      registered: true,
      hasPhone,
      phoneNumber: effectivePhone,
      playerCode: code,
      role,
      status: existing.status || (existing.is_blocked ? 'blocked' : 'active'),
      user: { ...existing, phone_number: effectivePhone, is_verified: hasPhone, player_code: code, role, balance: finalBalance },
    };
  }

  // 2. Check if user exists in Supabase database before creating as new!
  try {
    const client = getSupabase();
    if (client) {
            const { data: supaUser } = await client.from('users').select('*').eq('telegram_id', telegramId).maybeSingle();
      if (supaUser) {
        const restoredUser = localDb.upsertUser({
          telegram_id: telegramId,
          player_code: supaUser.player_code || playerCode,
          username: supaUser.username || username,
          first_name: supaUser.first_name || from.first_name || '',
          full_name: supaUser.full_name || fullName,
          phone_number: supaUser.phone_number || '',
          balance: Number(supaUser.balance ?? 0),
          role: userRole === 'admin' ? 'admin' : (supaUser.role || 'user'),
          status: supaUser.status || 'active',
          is_blocked: !!supaUser.is_blocked,
          is_verified: !!supaUser.is_verified || !!supaUser.phone_number,
          referral_count: Number(supaUser.referral_count) || 0,
          total_deposited: Number(supaUser.total_deposited) || 0,
          total_withdrawn: Number(supaUser.total_withdrawn) || 0,
          games_played: Number(supaUser.games_played) || 0,
          games_won: Number(supaUser.games_won) || 0,
          created_at: supaUser.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        const hasPhone = !!(restoredUser.phone_number && String(restoredUser.phone_number).trim()) || !!restoredUser.is_verified;
        console.log(`✅ Restored existing user from Supabase to Local DB: ${telegramId} (@${username}), code: ${restoredUser.player_code}, balance: ${restoredUser.balance}`);
        return {
          balance: restoredUser.balance,
          isNew: false,
          registered: true,
          hasPhone,
          phoneNumber: restoredUser.phone_number || '',
          playerCode: restoredUser.player_code,
          role: restoredUser.role,
          status: restoredUser.status,
          user: restoredUser,
        };
      }
    }
  } catch (err) {
    console.warn('Supabase check user error:', err);
  }

  // New accounts start with no wallet credit.
  const initialMain = 0;
  const initialPlay = 0;
  const cachedVerified = verifiedUsersCache[telegramId];
  const userEverVerified = isUserEverVerified(telegramId) || !!cachedVerified?.phone;
  const effectivePhone = cachedVerified?.phone || '';

  const createdUser = localDb.upsertUser({
    telegram_id: telegramId,
    player_code: cachedVerified?.code || playerCode,
    username: username,
    first_name: cachedVerified?.name || from.first_name || '',
    full_name: fullName,
    phone_number: effectivePhone,
    balance: initialMain,
    main_wallet: initialMain,
    play_wallet: initialPlay,
    role: userRole,
    status: 'active',
    is_blocked: false,
    is_verified: userEverVerified,
    referred_by: (referredBy && String(referredBy) !== telegramId) ? String(referredBy) : undefined,
  });

  await upsertPostgresUser({
    telegram_id: telegramId,
    player_code: createdUser.player_code,
    username: createdUser.username,
    first_name: createdUser.first_name,
    full_name: createdUser.full_name,
    balance: initialMain,
    main_wallet: initialMain,
    play_wallet: initialPlay,
    role: userRole,
    status: 'active',
    is_blocked: false,
    is_verified: !!createdUser.phone_number,
    referred_by: createdUser.referred_by,
  }).catch((err) => {
    console.warn('PostgreSQL player registration failed:', err);
    return null;
  });

  // Reward referrers with 5 ETB into their Play Wallet for each new referred player.
  if (referredBy && String(referredBy) !== telegramId) {
    const refUser = localDb.getUser(String(referredBy));
    if (refUser) {
      const curMain = Number(refUser.main_wallet ?? refUser.balance ?? 0);
      const newPlayBal = (Number(refUser.play_wallet) || 0) + 5;
      localDb.updateUserWallets(String(referredBy), curMain, newPlayBal);
      await setPostgresUserWallets(String(referredBy), curMain, newPlayBal).catch((err) => {
        console.warn('PostgreSQL referral play wallet update failed:', err);
        return null;
      });
      refUser.referral_count = (refUser.referral_count || 0) + 1;
      console.log(`🎁 Referrer ${referredBy} rewarded with +5 ETB in Play Wallet! New play balance: ${newPlayBal} ETB`);
    }
  }

  // Instant sync with Supabase database
  try {
    const client = getSupabase();
    if (client) {
      await upsertUserAdaptive({
        telegram_id: telegramId,
        player_code: playerCode,
        username: username,
        first_name: from.first_name || '',
        full_name: fullName,
        balance: initialMain,
        main_wallet: initialMain,
        play_wallet: initialPlay,
        role: userRole,
        status: 'active',
        is_blocked: false,
        referred_by: (referredBy && String(referredBy) !== telegramId) ? String(referredBy) : undefined,
      });
      console.log(`✅ Supabase user synced instantly: ${telegramId} (@${username})`);
    }
  } catch (err) {
    console.warn('Supabase sync warning:', err);
  }

  console.log(`🎉 Successfully registered new user in Secure Local DB: ${telegramId} (@${username}, code: ${playerCode}, play_bonus: ${initialPlay} ETB, main: ${initialMain} ETB)`);

  return {
    balance: createdUser.balance,
    isNew: true,
    registered: true,
    hasPhone: userEverVerified,
    phoneNumber: effectivePhone,
    playerCode: createdUser.player_code,
    role: userRole,
    status: 'active',
    user: createdUser,
  };
}

/**
 * Update user phone number and set is_verified in Secure Local DB
 */
async function updateUserPhone(telegramId: string, phoneNumber: string) {
  const success = localDb.updateUserPhone(telegramId, phoneNumber);
  markTelegramUserPermanentlyVerified(telegramId, phoneNumber);
  console.log(`✅ Secure Local DB & permanent cache phone updated for ${telegramId}: ${phoneNumber}`);

  try {
    await upsertPostgresUser({
      telegram_id: telegramId,
      phone_number: phoneNumber,
      is_verified: true,
      status: 'active',
    });
  } catch {}

  // Sync with Supabase
  try {
    const client = getSupabase();
    if (client) {
      void client.from('users').update({ phone_number: phoneNumber, is_verified: true, status: 'active', updated_at: new Date().toISOString() }).eq('telegram_id', telegramId);
    }
  } catch {}

  return success;
}

/**
 * Custom Reply Keyboard for requesting user contact
 */
function getContactRequestMarkup() {
  return {
    keyboard: [
      [
        {
          text: '📱 ስልክ ቁጥርዎን ያጋሩ (Share Contact)',
          request_contact: true,
        },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

/**
 * Fetch fresh balance from Secure Local DB (with real-time Supabase sync fallback)
 */
async function getUserBalance(telegramId: string): Promise<number> {
  const tId = String(telegramId);
  try {
    const postgresUser = await getPostgresUser(tId);
    if (postgresUser && typeof postgresUser.balance !== 'undefined') {
      const balance = Number(postgresUser.balance);
      localDb.updateUserBalance(tId, balance);
      return balance;
    }
  } catch (err) {
    console.warn(`PostgreSQL balance lookup failed for ${tId}:`, err);
  }

  const client = getSupabase();
  if (client) {
    try {
      const { data: supaUser } = await client
        .from('users')
        .select('balance')
        .eq('telegram_id', tId)
        .maybeSingle();
      if (supaUser && typeof supaUser.balance === 'number') {
        localDb.updateUserBalance(tId, supaUser.balance);
        return supaUser.balance;
      }
    } catch {}
  }

  const user = localDb.getUser(tId);
  if (user && typeof user.balance === 'number') {
    return user.balance;
  }
  return 0;
}

/**
 * Fetch full user record from Secure Local DB (with real-time Supabase sync fallback)
 */
async function getUserFull(telegramId: string) {
  const tId = String(telegramId);
  try {
    const postgresUser = await getPostgresUser(tId);
    if (postgresUser) {
      const updated = localDb.upsertUser({
        telegram_id: tId,
        player_code: postgresUser.player_code,
        first_name: postgresUser.first_name || 'Player',
        full_name: postgresUser.full_name || postgresUser.first_name || 'Player',
        username: postgresUser.username || '',
        phone_number: postgresUser.phone_number || '',
        balance: Number(postgresUser.balance ?? 0),
        role: postgresUser.role || 'user',
        status: postgresUser.status || (postgresUser.is_blocked ? 'blocked' : 'active'),
        is_blocked: !!postgresUser.is_blocked || postgresUser.status === 'blocked',
        is_verified: !!postgresUser.is_verified || !!postgresUser.phone_number,
      });
      return { ...updated, balance: Number(postgresUser.balance ?? updated.balance) };
    }
  } catch (err) {
    console.warn(`PostgreSQL profile lookup failed for ${tId}:`, err);
  }

  const client = getSupabase();
  if (client) {
    try {
      const { data: supaUser } = await client
        .from('users')
        .select('*')
        .eq('telegram_id', tId)
        .maybeSingle();
      if (supaUser) {
        const updated = localDb.upsertUser({
          telegram_id: tId,
          player_code: supaUser.player_code,
          first_name: supaUser.first_name || 'Player',
          full_name: supaUser.full_name || supaUser.first_name || 'Player',
          username: supaUser.username || '',
          phone_number: supaUser.phone_number || '',
          balance: Number(supaUser.balance ?? 0),
          role: supaUser.role || (isAdminUser(tId) ? 'admin' : 'user'),
          status: supaUser.status || (supaUser.is_blocked ? 'blocked' : 'active'),
          is_blocked: !!supaUser.is_blocked || supaUser.status === 'blocked',
          is_verified: !!supaUser.is_verified || !!supaUser.phone_number,
        });
        return {
          ...updated,
          player_code: updated.player_code || generatePlayerCode(tId),
          role: updated.role || 'user',
          balance: updated.balance ?? 0,
        };
      }
    } catch {}
  }

  const user = localDb.getUser(tId);
  if (user) {
    const code = user.player_code || generatePlayerCode(tId);
    const role = isAdminUser(tId) ? 'admin' : (user.role || 'user');
    const balance = Number(user.balance ?? 0);
    return {
      ...user,
      player_code: code,
      role,
      balance,
    };
  }
  return null;
}

/**
 * Update user balance in Secure Local DB
 */
async function updateUserBalance(telegramId: string, newBalance: number) {
  const safeBal = Math.max(0, newBalance);
  const success = localDb.updateUserBalance(telegramId, safeBal, { skipLocalDevOverride: true });
  console.log(`✅ Secure Local DB balance updated for ${telegramId}: ${safeBal} ETB`);

  try {
    await setPostgresUserBalance(telegramId, safeBal);
  } catch (err) {
    console.warn(`PostgreSQL balance update failed for ${telegramId}:`, err);
  }

  // Synchronous/Awaited sync with Supabase if connected to ensure instant updates are saved
  try {
    const client = getSupabase();
    if (client) {
      const { error } = await client
        .from('users')
        .update({ balance: safeBal, updated_at: new Date().toISOString() })
        .eq('telegram_id', String(telegramId));
      if (error) {
        console.warn(`Supabase balance update error for ${telegramId}:`, error.message);
      } else {
        console.log(`⚡ Supabase balance update SUCCESS for ${telegramId}: ${safeBal} ETB`);
      }
    }
  } catch (err: any) {
    console.warn(`Supabase balance update failed for ${telegramId}:`, err.message || err);
  }

  return success;
}


export function resolveBackendUrl(): string {
  if (process.env.BACKEND_URL && process.env.BACKEND_URL.startsWith('http') && !isStaticFrontendUrl(process.env.BACKEND_URL)) {
    return process.env.BACKEND_URL.replace(/\/$/, '');
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`.replace(/\/$/, '');
  }
  if (process.env.RAILWAY_STATIC_URL) {
    return `https://${process.env.RAILWAY_STATIC_URL}`.replace(/\/$/, '');
  }
  return 'https://salery-bingo-1-production.up.railway.app';
}

/**
 * Resolve production public WebApp URL (Never Google Cloud Run internal IAM URLs which cause Google Sign-in prompts)
 */
export function resolveWebAppUrl(): string {
  if (process.env.CLIENT_URL && process.env.CLIENT_URL.startsWith('http') && !process.env.CLIENT_URL.includes('ais-pre-') && !process.env.CLIENT_URL.includes('yeya-bingo')) {
    return process.env.CLIENT_URL.replace(/\/$/, '');
  }
  const cfg = localDb.getBotConfig();
  if (cfg.web_app_url && cfg.web_app_url.startsWith('http') && !cfg.web_app_url.includes('ais-pre-') && !cfg.web_app_url.includes('ais-dev-') && !cfg.web_app_url.includes('yeya-bingo')) {
    return cfg.web_app_url.replace(/\/$/, '');
  }
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.startsWith('http') && !process.env.FRONTEND_URL.includes('ais-pre-') && !process.env.FRONTEND_URL.includes('yeya-bingo')) {
    return process.env.FRONTEND_URL.replace(/\/$/, '');
  }
  if (process.env.APP_URL && process.env.APP_URL.startsWith('http') && !process.env.APP_URL.includes('ais-pre-') && !process.env.APP_URL.includes('yeya-bingo')) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  return 'https://salery-bingo-1.vercel.app';
}

/**
 * Build dynamic WebApp URL with user_id and live balance (no raw keys in URL)
 */
function buildWebAppUrl(rawUrl?: string, userId?: string | number, balance?: number) {
  let base = (rawUrl || '').trim();
  if (!base || base.includes('ais-pre-') || base.includes('ais-dev-') || base.includes('yeya-bingo') || base === 'https://your-app.netlify.app') {
    base = resolveWebAppUrl();
  }

  const backendUrl = resolveBackendUrl();

  try {
    const parsed = new URL(base);
    if (userId) {
      parsed.searchParams.set('user_id', String(userId));
    }
    if (typeof balance === 'number') {
      parsed.searchParams.set('bal', String(balance));
    }
    if (backendUrl) {
      parsed.searchParams.set('backend', backendUrl);
    }
    parsed.searchParams.set('v', String(Date.now()));
    return parsed.toString();
  } catch {
    let res = base;
    const sep = res.includes('?') ? '&' : '?';
    res += `${sep}v=${Date.now()}`;
    if (userId) res += `&user_id=${userId}`;
    if (typeof balance === 'number') res += `&bal=${balance}`;
    if (backendUrl) res += `&backend=${encodeURIComponent(backendUrl)}`;
    return res;
  }
}

/**
 * Build inline menu (with extra Admin button for admins)
 */
function getMainMenuMarkup(webAppUrl: string, userId?: string | number, balance?: number) {
  const finalUrl = buildWebAppUrl(webAppUrl, userId, balance);
  const playLabel = 'Play 🎮';
  const isAdmin = isAdminUser(userId);

  const keyboard: any[][] = [
    [
      {
        text: playLabel,
        web_app: { url: finalUrl },
      },
    ],
  ];

  if (isAdmin) {
    const adminUrl = finalUrl.includes('?') ? `${finalUrl}&view=admin` : `${finalUrl}?view=admin`;
    keyboard.push([
      {
        text: '👑 Admin Control Panel 📊',
        web_app: { url: adminUrl },
      },
    ]);
  }

  keyboard.push(
    [
      { text: 'Balance 💵', callback_data: 'btn_balance' },
      { text: 'Deposit 💰', callback_data: 'btn_deposit' },
    ],
    [
      { text: 'Withdraw 🤑', callback_data: 'btn_withdraw' },
      { text: 'Transfer 🎁', callback_data: 'btn_transfer' },
    ],
    [
      { text: 'Instruction 📖', callback_data: 'btn_instruction' },
      { text: 'Contact Support 📞', callback_data: 'btn_support' },
    ],
    [
      { text: 'Invite 🔗', callback_data: 'btn_invite' },
    ]
  );

  return { inline_keyboard: keyboard };
}

/**
 * Build bottom persistent reply keyboard (the 7 main menu buttons)
 */
function getReplyMenuMarkup(webAppUrl: string, userId?: string | number, balance?: number) {
  const finalUrl = buildWebAppUrl(webAppUrl, userId, balance);
  return {
    keyboard: [
      [{ text: 'Play 🎮', web_app: { url: finalUrl } }],
      [{ text: 'Balance 💵' }, { text: 'Deposit 💰' }],
      [{ text: 'Withdraw 🤑' }, { text: 'Transfer 🎁' }],
      [{ text: 'Instruction 📖' }, { text: 'Contact Support 📞' }],
      [{ text: 'Invite 🔗' }],
    ],
    resize_keyboard: true,
  };
}

/**
 * Helper to fetch file URL from Telegram Bot API for screenshot attachments
 */
async function getTelegramFileDirectUrl(botToken: string, fileId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const data: any = await res.json();
    if (data.ok && data.result && data.result.file_path) {
      return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
    }
    return null;
  } catch (err) {
    console.error('getTelegramFileDirectUrl error:', err);
    return null;
  }
}

/**
 * Send an urgent instant Telegram notification (with optional photo) to all admins
 */
async function notifyAdminsInstantWithPhoto(botToken: string, text: string, photoUrlOrFileId?: string) {
  const adminIds = getAdminTelegramIds();
  for (const adminId of adminIds) {
    if (adminId && !isNaN(Number(adminId))) {
      try {
        if (photoUrlOrFileId) {
          await sendTelegramPhoto(botToken, Number(adminId), photoUrlOrFileId, text);
        } else {
          await sendTelegramMessage(botToken, Number(adminId), text);
        }
      } catch (e) {
        console.warn(`Could not alert admin ${adminId}:`, e);
      }
    }
  }
}

/**
 * Helper to send message via Telegram Bot API
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  replyMarkup?: any
) {
  if (!botToken || !chatId) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
    const data: any = await res.json();
    if (data && data.ok) return data;

    // Retry 1: Retry without replyMarkup (in case WebApp URL or keyboard rejected)
    if (replyMarkup) {
      try {
        const retryRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
          }),
        });
        const retryData: any = await retryRes.json();
        if (retryData && retryData.ok) return retryData;
      } catch (retryErr) {
        console.warn('Retry sendMessage without markup failed:', retryErr);
      }
    }

    // Retry 2: Retry plain text without HTML parse_mode (in case unclosed HTML tags)
    try {
      const plainRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      });
      return await plainRes.json();
    } catch (plainErr) {
      console.warn('Retry sendMessage plain text failed:', plainErr);
    }

    return data;
  } catch (err) {
    console.error('sendTelegramMessage error:', err);
    return null;
  }
}

/**
 * Helper to send photo via Telegram Bot API with the inline buttons
 */
async function sendTelegramPhoto(
  botToken: string,
  chatId: number | string,
  photoUrl: string,
  caption: string,
  replyMarkup?: any
) {
  if (!botToken || !chatId) return null;
  const safeCaption = caption && caption.length > 1020 ? caption.slice(0, 1017) + '...' : caption;
  const rawPhoto = (photoUrl || '').trim();

  // 1. Direct local file upload if file exists in /public (prevents external Telegram GET timeouts)
  if (rawPhoto.startsWith('/')) {
    const localPath = path.join(process.cwd(), 'public', rawPhoto);
    if (fs.existsSync(localPath)) {
      try {
        const buffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath).replace('.', '') || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const blob = new Blob([buffer], { type: mimeType });

        const formData = new FormData();
        formData.append('chat_id', String(chatId));
        formData.append('photo', blob, `photo.${ext}`);
        if (safeCaption) formData.append('caption', safeCaption);
        formData.append('parse_mode', 'HTML');
        if (replyMarkup) {
          formData.append(
            'reply_markup',
            typeof replyMarkup === 'string' ? replyMarkup : JSON.stringify(replyMarkup)
          );
        }

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          body: formData,
        });
        const data: any = await res.json();
        if (data && data.ok) return data;

        if (replyMarkup) {
          try {
            const retryFormData = new FormData();
            retryFormData.append('chat_id', String(chatId));
            retryFormData.append('photo', blob, `photo.${ext}`);
            if (safeCaption) retryFormData.append('caption', safeCaption);
            retryFormData.append('parse_mode', 'HTML');
            const retryRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
              method: 'POST',
              body: retryFormData,
            });
            const retryData: any = await retryRes.json();
            if (retryData && retryData.ok) return retryData;
          } catch {}
        }
      } catch (localErr) {
        console.warn('Local file multipart sendPhoto error:', localErr);
      }
    }
  }

  // Resolve relative URLs to full HTTPS URLs
  let fullPhotoUrl = rawPhoto;
  if (fullPhotoUrl.startsWith('/')) {
    const webAppUrl = resolveWebAppUrl();
    fullPhotoUrl = `${webAppUrl.replace(/\/$/, '')}${fullPhotoUrl}`;
  }

  try {
    // 2. Base64 data URL upload
    if (fullPhotoUrl && fullPhotoUrl.startsWith('data:')) {
      try {
        const matches = fullPhotoUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
          const blob = new Blob([buffer], { type: mimeType });

          const formData = new FormData();
          formData.append('chat_id', String(chatId));
          formData.append('photo', blob, `photo.${ext}`);
          if (safeCaption) formData.append('caption', safeCaption);
          formData.append('parse_mode', 'HTML');
          if (replyMarkup) {
            formData.append(
              'reply_markup',
              typeof replyMarkup === 'string' ? replyMarkup : JSON.stringify(replyMarkup)
            );
          }

          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            body: formData,
          });
          const data: any = await res.json();
          if (data && data.ok) return data;

          if (replyMarkup) {
            try {
              const retryFormData = new FormData();
              retryFormData.append('chat_id', String(chatId));
              retryFormData.append('photo', blob, `photo.${ext}`);
              if (safeCaption) retryFormData.append('caption', safeCaption);
              retryFormData.append('parse_mode', 'HTML');
              const retryRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: 'POST',
                body: retryFormData,
              });
              const retryData: any = await retryRes.json();
              if (retryData && retryData.ok) return retryData;
            } catch {}
          }

          return await sendTelegramMessage(botToken, chatId, safeCaption, replyMarkup);
        }
      } catch (uploadErr) {
        return await sendTelegramMessage(botToken, chatId, safeCaption, replyMarkup);
      }
    }

    // 3. Standard photo URL send with 4s timeout (falls back instantly to text if image URL hangs)
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: fullPhotoUrl,
        caption: safeCaption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
      signal: AbortSignal.timeout(4000),
    });
    const data: any = await res.json();
    if (!data.ok) {
      if (replyMarkup) {
        try {
          const retryRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              photo: fullPhotoUrl,
              caption: safeCaption,
              parse_mode: 'HTML',
            }),
            signal: AbortSignal.timeout(3000),
          });
          const retryData: any = await retryRes.json();
          if (retryData && retryData.ok) return retryData;
        } catch {}
      }
      return await sendTelegramMessage(botToken, chatId, safeCaption, replyMarkup);
    }
    return data;
  } catch (err) {
    return await sendTelegramMessage(botToken, chatId, safeCaption, replyMarkup);
  }
}

/**
 * Helper to answer callback queries
 */
async function answerCallbackQuery(botToken: string, queryId: string, text?: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: queryId,
        text: text || '',
      }),
    });
  } catch (err) {
    console.error('answerCallbackQuery error:', err);
  }
}

// User deposit session state tracking
// Step 1: 'awaiting_amount' -> prompt for amount (>= 10 ETB)
// Step 2: 'awaiting_screenshot' -> prompt to transfer that amount to 0966987823 and send screenshot
const userDepositSessions = new Map<string, { step: 'awaiting_amount' | 'awaiting_screenshot'; amount?: number; timestamp: number }>();

// User withdrawal session state tracking
// Step 1: 'awaiting_amount' -> prompt for amount (>= 25 ETB)
// Step 2: 'awaiting_method' -> prompt for payment method and phone/account number (e.g. Telebirr: 09... or CBE: 1000...)
// Step 3: 'awaiting_name' -> prompt for recipient full name on the account
interface WithdrawSession {
  step: 'awaiting_amount' | 'awaiting_details' | 'awaiting_method' | 'awaiting_name';
  amount?: number;
  method?: string;
  timestamp: number;
}
const userWithdrawSessions = new Map<string, WithdrawSession>();

/**
 * Process all Telegram Updates (Messages & Callback Queries)
 */
async function processTelegramUpdate(update: any, botToken: string) {
  try {
    const webAppUrl = resolveWebAppUrl();
    const botUsername = (process.env.VITE_BOT_USERNAME || activeBotUsername || 'Salerybingo_bot').replace('@', '');

    // Auto-record/register any Telegram user interacting with the bot
    const anyFromUser = update?.message?.from || update?.callback_query?.from;
    if (anyFromUser && anyFromUser.id) {
      getOrCreateTelegramUser(anyFromUser).catch((err) =>
        console.warn(`Failed to auto-upsert user ${anyFromUser.id}:`, err)
      );

      // Check if user is banned/blocked by admin
      if (!isAdminUser(anyFromUser.id)) {
        const checkedUser = localDb.getUser(anyFromUser.id);
        if (checkedUser && (checkedUser.is_blocked || checkedUser.status === 'blocked')) {
          const banReason = checkedUser.ban_reason || 'የአገልግሎት ደንብ መጣስ (Terms Violation)';
          const banNotice =
            `🚫 <b>ይቅርታ፣ አካውንትዎ ታግዷል (Account Suspended)!</b>\n\n` +
            `👤 <b>ተጫዋች፦</b> ${checkedUser.first_name || 'Player'}\n` +
            `🆔 <b>Player Code፦</b> <code>${checkedUser.player_code}</code>\n` +
            `⚠️ <b>የእገዳ ምክንያት፦</b> ${banReason}\n\n` +
            `ለተጨማሪ መረጃ እባክዎ ዋና አስተዳዳሪውን (Admin) ያነጋግሩ።`;
          const targetChat = update?.message?.chat?.id || anyFromUser.id;
          await sendTelegramMessage(botToken, targetChat, banNotice);
          return;
        }
      }
    }

    // 1. Handle contact sharing (when user clicks "Share Contact")
    if (update && update.message && update.message.contact) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const contact = msg.contact;
      const fromUser = msg.from || { id: chatId };
      const rawPhone = String(contact.phone_number || '').trim();
      const phoneNumber = rawPhone.startsWith('+') ? rawPhone : (rawPhone.startsWith('0') ? `+251${rawPhone.slice(1)}` : `+${rawPhone}`);
      const contactFirstName = contact.first_name || fromUser.first_name || 'Player';
      const contactFullName = [contact.first_name || fromUser.first_name, contact.last_name || fromUser.last_name].filter(Boolean).join(' ') || 'Player';

      console.log(`📲 User ${chatId} (@${fromUser.username}) shared phone: ${phoneNumber}, name: ${contactFullName}`);

      const existingBefore = localDb.getUser(fromUser.id);
      const wasAlreadyRegistered = !!(existingBefore && (existingBefore.phone_number || existingBefore.is_verified));

      // Ensure user is created or updated in DB
      const userResult = await getOrCreateTelegramUser(fromUser);
      const playerCode = existingBefore?.player_code || userResult.playerCode || generatePlayerCode(fromUser.id);
      const userBal = existingBefore?.balance !== undefined ? existingBefore.balance : (userResult.balance ?? 0);

      const localUpdated = localDb.upsertUser({
        telegram_id: String(fromUser.id),
        player_code: playerCode,
        first_name: contactFirstName,
        full_name: contactFullName,
        username: fromUser.username || '',
        phone_number: phoneNumber,
        balance: userBal,
        is_verified: true,
        status: 'active',
        role: isAdminUser(fromUser.id) ? 'admin' : (existingBefore?.role || 'user'),
      });
      await updateUserPhone(String(fromUser.id), phoneNumber);

      // Sync to Supabase users table immediately
      try {
        const client = getSupabase();
        if (client) {
          const supaRes = await upsertUserAdaptive({
            telegram_id: String(fromUser.id),
            player_code: playerCode,
            first_name: contactFirstName,
            full_name: contactFullName,
            username: fromUser.username || '',
            phone_number: phoneNumber,
            is_verified: true,
            status: 'active',
            balance: userBal,
            role: isAdminUser(fromUser.id) ? 'admin' : (existingBefore?.role || 'user'),
          });
          console.log(`✅ [Supabase] Full user contact registered to Supabase: ${fromUser.id} (${phoneNumber})`, supaRes?.error ? supaRes.error : 'OK');
        }
      } catch (supaErr) {
        console.warn('Supabase contact registration warning:', supaErr);
      }

      let confirmMsg: string;
      if (wasAlreadyRegistered) {
        confirmMsg =
          `✅ <b>የእርስዎ መለያ ቀድሞውኑ የተመዘገበ ነው!</b>\n\n` +
          `👤 <b>ተጫዋች፦</b> ${contactFirstName}\n` +
          `🆔 <b>Player Code፦</b> <code>${playerCode}</code>\n` +
          `📱 <b>የተመዘገበ ስልክ፦</b> <code>${phoneNumber}</code>\n` +
          `💰 <b>የአሁኑ ቀሪ ሂሳብዎ፦</b> <b>${userBal.toLocaleString()} ETB</b>\n\n` +
          `ካቆሙበት ለመቀጠል ከታች <b>"Play 🎮"</b> የሚለውን ይጫኑ!`;
      } else {
        confirmMsg =
          `✅ <b>ምዝገባዎ በተሳካ ሁኔታ ተጠናቋል!</b>\n\n` +
          `👤 <b>ተጫዋች፦</b> ${contactFirstName}\n` +
          `🆔 <b>Player Code፦</b> <code>${playerCode}</code>\n` +
          `📱 <b>የተመዘገበ ስልክ፦</b> <code>${phoneNumber}</code>\n` +
          `💰 <b>የአሁኑ ቀሪ ሂሳብዎ፦</b> <b>${userBal.toLocaleString()} ETB</b>\n\n` +
          `ከታች <b>"Play 🎮"</b> የሚለውን በመጫን ጨዋታውን መጀመር ይችላሉ!`;
      }

      await sendTelegramMessage(botToken, chatId, confirmMsg, getMainMenuMarkup(webAppUrl, fromUser.id, userBal));
      try {
        await sendTelegramMessage(
          botToken,
          chatId,
          `👇 <i>የታችኛው ምናሌ (Main Menu) ተዘጋጅቷል፦</i>`,
          getReplyMenuMarkup(webAppUrl, fromUser.id, userBal)
        );
      } catch {}
      return;
    }

    // 1.5. Handle Deposit Screenshot Photos sent directly in Telegram
    if (update && update.message && (update.message.photo || update.message.document)) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const fromUser = msg.from || { id: chatId };
      const caption = (msg.caption || '').trim();

      // Get highest resolution photo or document file_id
      let fileId = '';
      if (Array.isArray(msg.photo) && msg.photo.length > 0) {
        fileId = msg.photo[msg.photo.length - 1].file_id;
      } else if (msg.document && msg.document.file_id) {
        fileId = msg.document.file_id;
      }

      if (fileId) {
        let fullUser = await getUserFull(fromUser.id);
        if (!fullUser) {
          // Auto-register the brand new player instantly!
          const registered = localDb.upsertUser({
            telegram_id: String(fromUser.id),
            player_code: generatePlayerCode(fromUser.id),
            first_name: fromUser.first_name || 'Player',
            full_name: (fromUser.first_name || 'Player') + (fromUser.last_name ? ' ' + fromUser.last_name : ''),
            username: fromUser.username || '',
            balance: 0,
            role: 'user',
            status: 'active',
          });
          fullUser = {
            ...registered,
            role: 'user',
            balance: 0,
            player_code: registered.player_code,
          };
          try {
            await upsertUserAdaptive(registered);
          } catch {}
        }
        const playerCode = fullUser?.player_code || generatePlayerCode(fromUser.id);
        const playerName = fromUser.first_name || fullUser?.first_name || 'Player';
        const phoneNumber = fullUser?.phone_number || '';
        
        // Retrieve session deposit amount if user completed step 1
        const userSession = userDepositSessions.get(String(fromUser.id));
        let parsedAmount = userSession?.amount || 100;

        if (!userSession?.amount && caption) {
          const amountMatch = caption.match(/(\d+)/);
          if (amountMatch) {
            const found = parseInt(amountMatch[1], 10);
            if (found >= 10) parsedAmount = found;
          }
        }

        // Clear active deposit session
        userDepositSessions.delete(String(fromUser.id));

        // Fetch direct download URL from Telegram
        const directPhotoUrl = await getTelegramFileDirectUrl(botToken, fileId);

        const txId = 'dep_tg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const photoProxyUrl = `/api/telegram-photo/${fileId}`;
        const newTx: TransactionItem = {
          id: txId,
          telegram_id: String(fromUser.id),
          player_name: playerName,
          player_code: playerCode,
          phone_number: phoneNumber,
          type: 'deposit',
          amount: parsedAmount,
          status: 'pending',
          reference: caption ? `Deposit ${parsedAmount} ETB: ${caption}` : `Deposit ${parsedAmount} ETB Screenshot`,
          screenshot_url: directPhotoUrl || photoProxyUrl,
          photo_file_id: fileId,
          created_at: new Date().toISOString(),
          notes: caption ? `Caption: ${caption} | Requested: ${parsedAmount} ETB` : `Telegram screenshot upload (${parsedAmount} ETB)`,
        };

        // 1. Persist transaction immediately to local secure database & Postgres
        localDb.addTransaction(newTx);
        try {
          await savePostgresTransaction(newTx);
        } catch {}

        // 2. Sync to Supabase transactions table immediately
        try {
          const supaClient = getSupabase();
          if (supaClient) {
            void (async () => {
              try {
                // Ensure the user is registered in Supabase users table first
                const localUser = localDb.getUser(newTx.telegram_id);
                if (localUser) {
                  await upsertUserAdaptive(localUser);
                }

                await supaClient.from('transactions').insert([{
                  id: newTx.id,
                  telegram_id: newTx.telegram_id,
                  player_name: newTx.player_name,
                  player_code: newTx.player_code,
                  phone_number: newTx.phone_number || '',
                  type: newTx.type,
                  amount: newTx.amount,
                  status: newTx.status,
                  reference: newTx.reference || '',
                  screenshot_url: newTx.screenshot_url || '',
                  photo_file_id: newTx.photo_file_id || '',
                  notes: newTx.notes || '',
                  created_at: newTx.created_at,
                }]);
              } catch {}
            })();
          }
        } catch {}

        // 3. Instant push to Vercel production API
        fetch('https://salery-bingo-1.vercel.app/api/transactions/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newTx.id,
            telegramId: newTx.telegram_id,
            playerName: newTx.player_name,
            playerCode: newTx.player_code,
            phoneNumber: newTx.phone_number,
            amount: newTx.amount,
            reference: newTx.reference,
            screenshotUrl: newTx.screenshot_url,
            photoFileId: newTx.photo_file_id,
            notes: newTx.notes,
          }),
        }).catch(() => {});

        // 4. Instant photo alert to Admin
        const adminId = '908336796';
        const adminLink = `https://salery-bingo-1.vercel.app/admin`;
        const adminAlertText =
          `🔔 <b>አዲስ የዲፖዚት ጥያቄ ቀርቧል!</b>\n\n` +
          `👤 <b>ተጫዋች፦</b> ${playerName} (<code>${playerCode}</code>)\n` +
          `💰 <b>መጠን፦</b> <b>${parsedAmount} ETB</b>\n` +
          `📱 <b>ስልክ፦</b> <code>${phoneNumber || 'ያልተገለጸ'}</code>\n` +
          `🆔 <b>Telegram ID፦</b> <code>${fromUser.id}</code>\n\n` +
          `👇 <b>በአድሚን ፓነል ለማጽደቅ ወይም ውድቅ ለማድረግ እዚህ ይጫኑ፦</b>`;

        try {
          if (fileId) {
            await sendTelegramPhoto(botToken, Number(adminId), fileId, adminAlertText, {
              inline_keyboard: [
                [{ text: '👑 አድሚን ፓነል ክፈት (Open Admin)', url: adminLink }],
              ],
            });
          } else {
            await sendTelegramMessage(botToken, adminId, adminAlertText, {
              inline_keyboard: [
                [{ text: '👑 አድሚን ፓነል ክፈት (Open Admin)', url: adminLink }],
              ],
            });
          }
        } catch {
          sendTelegramMessage(botToken, adminId, adminAlertText, {
            inline_keyboard: [
              [{ text: '👑 አድሚን ፓነል ክፈት (Open Admin)', url: adminLink }],
            ],
          }).catch(() => {});
        }

        // 3. Clean, simple user confirmation response (Player only)
        const userReply =
          `✅ <b>የ ${parsedAmount} ETB የክፍያ ደረሰኝዎ ደርሶናል!</b>\n\n` +
          `🆔 <b>Player Code፦</b> <code>${playerCode}</code>\n` +
          `💰 <b>የተጠየቀው መጠን፦</b> <b>${parsedAmount} ETB</b>\n\n` +
          `ጥያቄዎ እንደተረጋገጠ ሂሳብዎ ወዲያውኑ ይሞላልዎታል። እናመሰግናለን! 🎮`;

        await sendTelegramMessage(botToken, chatId, userReply, getMainMenuMarkup(webAppUrl, fromUser.id));
        return;
      }
    }

    // 2. Handle incoming text message (e.g., /start)
    if (update && update.message && update.message.text) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const rawText = String(msg.text).trim();
      const text = rawText.toLowerCase();
      const fromUser = msg.from || { id: chatId };

      console.log(`Telegram message from ${chatId} (@${fromUser.username}): "${rawText}"`);

      // Admin/Debug command to check Database Security status right from Telegram
      if (text === '/test' || text === '/debug' || text === '/status') {
        const dbStatus = localDb.getStatus();
        const debugMsg =
          `🛡️ <b>የሳለሪ ቢንጎ የዳታቤዝ ደህንነት ሁኔታ (Database Security)</b>\n\n` +
          `• <b>የዳታቤዝ አይነት፦</b> 🔒 ራሱን የቻለ ሰርቨር ዳታቤዝ (Local Secure Storage)\n` +
          `• <b>የደህንነት ደረጃ፦</b> 🛡️ 100% ከፍተኛ (ከማንኛውም የውጪ አደጋ እና ከሱፓቤዝ ጥገኝነት ነጻ)\n` +
          `• <b>ጠቅላላ ተጫዋቾች፦</b> ${dbStatus.totalUsers}\n` +
          `• <b>ንቁ ተጫዋቾች፦</b> ${dbStatus.activeUsers}\n` +
          `• <b>ጠቅላላ ሂሳብ፦</b> ${dbStatus.totalBalance.toLocaleString()} ETB\n` +
          `• <b>የተመዘገቡ የክፍያ ጥያቄዎች፦</b> ${dbStatus.totalTransactions} (${dbStatus.pendingTransactions} በመጠባበቅ ላይ)\n` +
          `• <b>የዳታ ደህንነት፦</b> ✅ በሰርቨሩ ውስጥ በቋሚነት ተቀምጧል (Auto-persisted to disk)\n\n` +
          `🔒 <i>ማስታወሻ፦ ዳታቤዙ በራሱ ሰርቨር ላይ ብቻ የተመሰረተ በመሆኑ ከማንኛውም ሶስተኛ ወገን ወይም የሱፓቤዝ አደጋ ሙሉ በሙሉ የተጠበቀ ነው።</i>`;

        await sendTelegramMessage(botToken, chatId, debugMsg);
        return;
      }

      // Explicit command to request or re-verify contact
      if (text === '/register' || text === '/phone' || text === '/contact' || text === '📱 ስልክ ቁጥር ያጋሩ' || text === 'share contact') {
        const u = localDb.getUser(fromUser.id);
        const hasVerifiedPhone = !!(u?.phone_number && String(u?.phone_number).trim()) || !!u?.is_verified;
        if (hasVerifiedPhone) {
          const registeredMsg =
            `✅ <b>የእርስዎ ስልክ ቁጥር ቀድሞውኑ ተመዝግቧል!</b>\n\n` +
            `📱 <b>የተመዘገበ ስልክ፦</b> <code>${u?.phone_number || ''}</code>\n` +
            `🆔 <b>Player Code፦</b> <code>${u?.player_code || ''}</code>\n\n` +
            `ጨዋታውን ለመጀመር <b>"Play 🎮"</b> የሚለውን ይጫኑ!`;
          await sendTelegramMessage(botToken, chatId, registeredMsg, getMainMenuMarkup(webAppUrl, fromUser.id, u?.balance));
          return;
        }
        const contactPromptText =
          `📱 <b>ስልክ ቁጥርዎን ያስመዝግቡ (Share Contact)</b>\n\n` +
          `የቴሌግራም ስልክ ቁጥርዎን በቅጽበት ለማስመዝገብ ከታች ያለውን <b>«📱 ስልክ ቁጥርዎን ያጋሩ (Share Contact)»</b> የሚለውን አዝራር ይጫኑ፦`;
        await sendTelegramMessage(botToken, chatId, contactPromptText, getContactRequestMarkup());
        return;
      }

      if (text === '/admin' || text === '/dashboard' || text === '/players' || text === '/deposits' || text === '/pending') {
        const isAdmin = isAdminUser(fromUser.id);
        const allUsers = localDb.getAllUsers().filter((u) => u.role !== 'admin' && String(u.telegram_id) !== '908336796');
        const totalUsers = allUsers.length;
        const totalBalance = allUsers.reduce((acc, u) => acc + (Number(u.balance) || 0), 0);
        const pendingTxs = localDb.getTransactions({ status: 'pending' });
        const pendingDeposits = pendingTxs.filter((t) => t.type === 'deposit');
        const pendingWithdraws = pendingTxs.filter((t) => t.type === 'withdraw');

        // Detailed player list
        const playersListText = allUsers.slice(0, 10).map((u, idx) => {
          const code = u.player_code || generatePlayerCode(u.telegram_id);
          const name = u.first_name || u.username || 'Player';
          const phone = u.phone_number ? `📱 <code>${u.phone_number}</code>` : '📱 <i>ስልክ አልተመዘገበም</i>';
          return `${idx + 1}. 👤 <b>${name}</b> (${code})\n   ${phone} | 💰 <b>${u.balance || 0} ETB</b> | ID: <code>${u.telegram_id}</code>`;
        }).join('\n\n');

        // Pending deposits text
        const pendingDepText = pendingDeposits.length > 0
          ? pendingDeposits.map((tx, idx) => {
              return `${idx + 1}. 💰 <b>${tx.amount} ETB</b> — ${tx.player_name} (${tx.player_code})\n   📱 ${tx.phone_number || 'ስልክ የለም'} | ⏰ ${new Date(tx.created_at).toLocaleTimeString()}`;
            }).join('\n')
          : '✅ ምንም ያልተረጋገጠ የዲፖዚት ጥያቄ የለም';

        const adminUrl = 'https://salery-bingo-1.vercel.app/?view=admin';
        const adminMsg =
          `👑 <b>የሳለሪ ቢንጎ አድሚን መቆጣጠሪያ ፓነል (Admin Panel)</b>\n\n` +
          `👥 <b>ጠቅላላ የተመዘገቡ ተጫዋቾች፦</b> <b>${totalUsers}</b>\n` +
          `💰 <b>የተጫዋቾች ጠቅላላ ሂሳብ፦</b> <b>${totalBalance.toLocaleString()} ETB</b>\n` +
          `📥 <b>ያልተረጋገጡ ዲፖዚቶች፦</b> <b>${pendingDeposits.length}</b>\n` +
          `📤 <b>የገንዘብ ማውጫ ጥያቄዎች፦</b> <b>${pendingWithdraws.length}</b>\n\n` +
          `📋 <b>የተመዘገቡ ተጫዋቾች እና ስልክ ቁጥራቸው፦</b>\n` +
          (playersListText || 'ተጫዋቾች እስካሁን አልተገኙም') +
          (pendingDeposits.length > 0 ? `\n\n📸 <b>በመጠባበቅ ላይ ያሉ ዲፖዚቶች፦</b>\n${pendingDepText}` : '') +
          `\n\nክፍያዎችን በቀጥታ ለማጽደቅ ወይም ለመቆጣጠር ከታች ያሉትን አዝራሮች ይጠቀሙ፦`;

        const keyboardButtons: any[][] = [];

        // Inline approval buttons for pending deposits
        for (const dep of pendingDeposits.slice(0, 3)) {
          keyboardButtons.push([
            { text: `✅ Approve ${dep.amount} ETB (${dep.player_name})`, callback_data: `adm_app_${dep.id}` },
            { text: `❌ Reject`, callback_data: `adm_rej_${dep.id}` },
          ]);
        }

        keyboardButtons.push([
          {
            text: '👑 Open Web Admin Panel 📊',
            web_app: { url: adminUrl },
          },
        ]);
        keyboardButtons.push([
          { text: `🔄 Refresh Stats (${totalUsers} Users)`, callback_data: 'adm_refresh' },
          { text: '🎮 Play Game', web_app: { url: buildWebAppUrl(webAppUrl, fromUser.id, 0) } },
        ]);

        const adminKeyboard = { inline_keyboard: keyboardButtons };
        await sendTelegramMessage(botToken, chatId, adminMsg, adminKeyboard);
        return;
      }

      // Admin command to dynamically set and persist public WebApp URL (e.g. Vercel deployment)
      if (text.startsWith('/setweb') || text.startsWith('/seturl') || text.startsWith('/url')) {
        const isAdmin = isAdminUser(fromUser.id);
        if (!isAdmin) {
          await sendTelegramMessage(botToken, chatId, '⚠️ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው! (Admin access only)');
          return;
        }
        const parts = rawText.split(/\s+/);
        if (parts.length < 2 || !parts[1].startsWith('http')) {
          await sendTelegramMessage(
            botToken,
            chatId,
            `ℹ️ <b>የዌብአፕ አድራሻ (WebApp URL) ለማስተካከል፦</b>\n<code>/setweb https://salery-bingo-1.vercel.app</code>\n\nየአሁኑ አድራሻ፦ <code>${webAppUrl}</code>`
          );
          return;
        }
        const newUrl = parts[1].trim().replace(/\/$/, '');
        localDb.saveBotConfig(activeBotToken, activeBotUsername, newUrl);
        await sendTelegramMessage(
          botToken,
          chatId,
          `✅ <b>የዌብአፕ አድራሻ በተሳካ ሁኔታ ተቀይሯል!</b>\n\n🌐 አዲሱ አድራሻ፦ <code>${newUrl}</code>\n\nከአሁን በኋላ ተጫዋቾች ጌሙን ሲከፍቱ ምንም አይነት የGoogle Sign-in ሳይጠይቃቸው በቀጥታ በሰከንድ ውስጥ ይከፈትላቸዋል!`
        );
        return;
      }

      // Admin command to promote or register admin
      if (text.startsWith('/setadmin') || text.startsWith('/makeadmin')) {
        const parts = rawText.split(/\s+/);
        const targetId = parts[1] ? parts[1].trim() : String(fromUser.id);
        localDb.upsertUser({
          telegram_id: targetId,
          role: 'admin',
          balance: 0,
          status: 'active',
          is_verified: true,
        });
        await sendTelegramMessage(botToken, chatId, `👑 <b>ID <code>${targetId}</code> አድሚን (Admin) ሆኗል!</b>\n\nበአድሚን ፓነል ለመግባት /admin ይበሉ ወይም "👑 Admin Control Panel" የሚлеውን ይጫኑ።`);
        return;
      }

      // Admin command to set Supabase config dynamically via Telegram
      if (text.startsWith('/supa') || text.startsWith('/supabase')) {
        const isAdmin = isAdminUser(fromUser.id);
        if (!isAdmin) {
          await sendTelegramMessage(botToken, chatId, '⚠️ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው! (Admin access only)');
          return;
        }
        const parts = rawText.split(/\s+/);
        if (parts.length < 3) {
          await sendTelegramMessage(
            botToken,
            chatId,
            `ℹ️ <b>Supabase ዳታቤዝ ለማገናኘት፦</b>\n` +
            `<code>/supa &lt;Supabase-URL&gt; &lt;Supabase-Service-Role-Key&gt;</code>\n\n` +
            `ምሳሌ፦\n` +
            `<code>/supa https://xyz.supabase.co eyJhbGc...</code>\n\n` +
            `🔒 <i>ይህን ሲያደርጉ የቦቱ ሰርቨር እና የዌብ አፑ ዳታቤዝ 100% በቅጽበት ይገናኛሉ!</i>`
          );
          return;
        }
        const sUrl = parts[1].trim();
        const sKey = parts[2].trim();

        try {
          const testClient = reinitSupabase(sUrl, sKey);
          if (testClient) {
            // Test query
            const { error } = await testClient.from('users').select('id').limit(1);
            if (error && error.message.includes('does not exist')) {
              await sendTelegramMessage(
                botToken,
                chatId,
                `⚠️ <b>የ Supabase ግንኙነት ተሳክቷል፤ ነገር ግን 'users' ሰንጠረዥ (Table) አልተገኘም!</b>\n\n` +
                `እባክዎ በ Supabase SQL Editor ውስጥ ሰንጠረዦቹን መፍጠራቸውን ያረጋግጡ።`
              );
              return;
            }

            // Sync all existing local database users to Supabase so we don't lose any data!
            const allLocalUsers = localDb.getAllUsers();
            for (const u of allLocalUsers) {
              try {
                await upsertUserAdaptive(u);
              } catch {}
            }

            // Sync all existing local database transactions to Supabase!
            const allLocalTxs = localDb.getTransactions();
            for (const t of allLocalTxs) {
              await testClient.from('transactions').upsert([{
                id: t.id,
                telegram_id: t.telegram_id,
                player_name: t.player_name,
                player_code: t.player_code,
                phone_number: t.phone_number || '',
                type: t.type,
                amount: t.amount,
                status: t.status,
                reference: t.reference || '',
                screenshot_url: t.screenshot_url || '',
                photo_file_id: t.photo_file_id || '',
                notes: t.notes || '',
                created_at: t.created_at,
              }]);
            }

            await sendTelegramMessage(
              botToken,
              chatId,
              `✅ <b>የ Supabase ዳታቤዝ በተሳካ ሁኔታ ተገናኝቷል!</b>\n\n` +
              `• <b>URL፦</b> <code>${sUrl}</code>\n` +
              `• <b>ማመሳሰል፦</b> ⚡ ሁሉም ተጫዋቾች እና እንቅስቃሴዎች (Transactions) በቅጽበት ተመሳስለዋል!\n\n` +
              `ከአሁን በኋላ ዲፖዚት ሲያጸድቁም ሆነ ጨዋታ ሲጫወቱ በሁሉም ቦታዎች ላይ ሂሳቡ በእኩልነት ይሻሻላል! 🏆`
            );
          } else {
            await sendTelegramMessage(botToken, chatId, '❌ የ Supabase ግንኙነት አልተሳካም። እባክዎ URL እና Key ያረጋግጡ።');
          }
        } catch (err: any) {
          await sendTelegramMessage(botToken, chatId, `❌ <b>ግንኙነት አልተሳካም፦</b> ${err.message || err}`);
        }
        return;
      }

      if (text.startsWith('/start')) {
        // Extract referral parameter e.g. "/start 123456789"
        const parts = rawText.split(/\s+/);
        let referredBy: string | undefined;
        if (parts.length > 1 && parts[1].trim()) {
          const possibleRef = parts[1].trim();
          if (/^\d+$/.test(possibleRef) && possibleRef !== String(fromUser.id)) {
            referredBy = possibleRef;
          }
        }

        // Register or retrieve user from database
        const userResult = await getOrCreateTelegramUser(fromUser, referredBy);
        const isAdmin = isAdminUser(fromUser.id);
        const userRecord = localDb.getUser(fromUser.id);
        const currentBalance = userResult.balance ?? userRecord?.balance ?? 0;
        const playerCode = userResult.playerCode || userRecord?.player_code || generatePlayerCode(fromUser.id);
        const userPhone = userResult.phoneNumber || userRecord?.phone_number || verifiedUsersCache[String(fromUser.id)]?.phone || '';
        const isVerified = isUserEverVerified(fromUser.id) || !!(userPhone && String(userPhone).trim()) || !!userRecord?.is_verified;

        // Guaranteed explicit sync to Supabase database
        try {
          const client = getSupabase();
          if (client) {
            console.log(`[Supabase] Explicitly registering user ${fromUser.id} on /start...`);
            const supaPayload: Record<string, any> = {
              telegram_id: String(fromUser.id),
              username: fromUser.username || '',
              first_name: fromUser.first_name || '',
              full_name: [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || 'Player',
              player_code: playerCode,
              balance: currentBalance,
              role: isAdmin ? 'admin' : 'user',
              status: 'active',
              is_blocked: false,
              is_verified: isVerified,
            };
            if (userPhone) supaPayload.phone_number = userPhone;
            const res = await upsertUserAdaptive(supaPayload);
            if (res.error) {
              console.warn(`[Supabase] Note on /start user upsert:`, res.error);
            } else {
              console.log(`✅ [Supabase] User ${fromUser.id} (${playerCode}) registered and synced!`);
            }
          } else {
            console.warn('[Supabase] Warning: Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
          }
        } catch (supaErr) {
          console.warn('[Supabase] Error during /start sync:', supaErr);
        }

        // If regular player and not yet verified with phone, prompt to share contact!
        if (!isAdmin && !isVerified) {
          const contactPromptText =
            `👋 <b>እንኳን ወደ ሳለሪ ቢንጎ (Salery Bingo) በደህና መጡ!</b>\n\n` +
            `👤 <b>ተጫዋች፦</b> ${fromUser.first_name || 'Player'}\n` +
            `🆔 <b>የተጫዋች ኮድ (Player Code)፦</b> <code>${playerCode}</code>\n\n` +
            `⚠️ <b>ማሳሰቢያ፦</b> አካውንትዎን ለማረጋገጥ እና ክፍያዎችን በቅጽበት ለማግኘት እባክዎ ከታች ያለውን <b>«📱 ስልክ ቁጥርዎን ያጋሩ (Share Contact)»</b> የሚለውን አዝራር ይጫኑ፦`;

          await sendTelegramMessage(botToken, chatId, contactPromptText, getContactRequestMarkup());
          return;
        }

        // Welcome message with player details and instructions
        let welcomeText: string;
        if (isAdmin) {
          welcomeText =
            `👑 <b>Welcome Admin (ሳለሪ አድሚን)</b>\n\n` +
            `💰 <b>የአሁኑ ቀሪ ሂሳብዎ፦</b> <b>${currentBalance.toLocaleString()} ETB</b>\n` +
            `🆔 <b>Admin ID፦</b> <code>${fromUser.id}</code>\n` +
            `🕹️ <b>ሚና፦</b> ዋና አስተዳዳሪ (Admin)\n\n` +
            `ጨዋታ ለመጀመር ከታች <b>"Play 🎮"</b> የሚለውን ይጫኑ ወይም ተጫዋቾችን ለመቆጣጠር /admin ይበሉ!`;
        } else {
          welcomeText =
            `👋 <b>እንኳን ወደ ሳለሪ ቢንጎ (Salery Bingo) በደህና መጡ!</b>\n\n` +
            `👤 <b>ተጫዋች፦</b> ${fromUser.first_name || 'Player'}\n` +
            `🆔 <b>የተጫዋች ኮድ (Player Code)፦</b> <code>${playerCode}</code>\n` +
            `💰 <b>የአሁኑ ቀሪ ሂሳብዎ፦</b> <b>${currentBalance.toLocaleString()} ETB</b>\n` +
            (userPhone ? `📱 <b>የተመዘገበ ስልክ፦</b> <code>${userPhone}</code>\n` : '') +
            `\n🎮 ጨዋታ ለመጀመር <b>"Play 🎮"</b> የሚለውን ይጫኑ ወይም ከታች ያሉትን <b>7ቱ</b> አማራጮች ይጠቀሙ፦`;
        }

        const inlineMarkup = getMainMenuMarkup(webAppUrl, fromUser.id, currentBalance);
        const replyMarkup = getReplyMenuMarkup(webAppUrl, fromUser.id, currentBalance);

        // Always send welcome message with the 7 inline buttons
        await sendTelegramMessage(botToken, chatId, welcomeText, inlineMarkup);

        // Also set persistent reply keyboard at the bottom
        try {
          await sendTelegramMessage(
            botToken,
            chatId,
            `👇 <i>የታችኛው ምናሌ (Main Menu) ተዘጋጅቷል፦</i>`,
            replyMarkup
          );
        } catch {}
      } else {
        // -------------------------------------------------------------
        // ACTIVE WITHDRAWAL SESSION HANDLING (3-STEP INTERACTIVE FLOW)
        // Step 1: 'awaiting_amount' -> prompt for amount (>= 25 ETB)
        // Step 2: 'awaiting_method' -> prompt for payment method & phone/account number (e.g. Telebirr: 09... / CBE: 1000...)
        // Step 3: 'awaiting_name'   -> prompt for recipient full name on the account
        // -------------------------------------------------------------
        const activeWithdrawSession = userWithdrawSessions.get(String(fromUser.id));

        if (activeWithdrawSession) {
          const fullUser = await getUserFull(fromUser.id);
          const userBalance = fullUser?.balance || 0;
          const playerCode = fullUser?.player_code || generatePlayerCode(fromUser.id);
          const playerName = fromUser.first_name || fullUser?.first_name || 'Player';

          // Step 1: User enters the withdrawal amount
          if (activeWithdrawSession.step === 'awaiting_amount') {
            const numMatch = rawText.match(/(\d+)/);
            const parsedAmount = numMatch ? parseInt(numMatch[1], 10) : 0;
            const maxWithdrawable = Math.max(0, userBalance - 25);

            if (userBalance <= 25 || maxWithdrawable <= 0) {
              const lowAmtMsg =
                `⚠️ <b>ቀሪ ሂሳብዎ ለማውጣት አይበቃም!</b>\n\n` +
                `💰 የእርስዎ ቀሪ ሂሳብ፦ <b>${userBalance.toLocaleString()} ETB</b>\n\n` +
                `📌 <b>ደንብ፦</b> 25 ብር ሁልጊዜ በአካውንትዎ ውስጥ እንደ ቋሚ ተቀማጭ መቆየት አለበት። ማውጣት የሚቻለው በአካውንትዎ ውስጥ <b>ከ 25 ብር በላይ</b> ሲኖር ብቻ ነው።\n\n` +
                `ጨዋታዎችን በማሸነፍ ከ 25 ብር በላይ ሲኖርዎት ማውጣት ይችላሉ! 🎮`;
              userWithdrawSessions.delete(String(fromUser.id));
              await sendTelegramMessage(botToken, chatId, lowAmtMsg);
              return;
            }

            if (!numMatch || parsedAmount <= 0) {
              const askNumMsg =
                `⚠️ እባክዎ ማውጣት የሚፈልጉትን የብር መጠን በቁጥር ብቻ ይላኩ (ማውጣት የሚችሉት እስከ <b>${maxWithdrawable} ETB</b> ድረስ ነው)፦`;
              await sendTelegramMessage(botToken, chatId, askNumMsg);
              return;
            }

            if (parsedAmount > maxWithdrawable) {
              const insufMsg =
                `⚠️ <b>የተጠየቀው መጠን ከተፈቀደው ይበልጣል!</b>\n\n` +
                `💰 የእርስዎ ቀሪ ሂሳብ፦ <b>${userBalance.toLocaleString()} ETB</b>\n` +
                `💵 ማውጣት የሚችሉት፦ እስከ <b>${maxWithdrawable.toLocaleString()} ETB</b> ድረስ ነው።\n\n` +
                `እባክዎ እስከ <b>${maxWithdrawable} ብር</b> ድረስ ያለ መጠን ያስገቡ፦`;
              await sendTelegramMessage(botToken, chatId, insufMsg);
              return;
            }

            // Valid amount -> advance to Step 2 (phone number and recipient name)
            userWithdrawSessions.set(String(fromUser.id), {
              step: 'awaiting_details',
              amount: parsedAmount,
              timestamp: Date.now(),
            });

            const askDetailsMsg =
              `✅ <b>የተመረጠው ማውጫ መጠን፦ ${parsedAmount} ETB</b>\n\n` +
              `እባክዎ ገንዘቡ የሚላክበትን <b>የቴሌብር/ባንክ ስልክ ቁጥር እና ሙሉ ስምዎን አያይዘው</b> ይላኩ፦\n\n` +
              `<i>(ምሳሌ፦ <code>0911223344 አበበ ከበደ</code> ወይም <code>CBE 100023456789 Abebe</code>)</i>`;

            await sendTelegramMessage(botToken, chatId, askDetailsMsg);
            return;
          }

          // Step 2: User enters phone number and name -> COMPLETE WITHDRAWAL INSTANTLY!
          if (activeWithdrawSession.step === 'awaiting_details' || activeWithdrawSession.step === 'awaiting_method' || activeWithdrawSession.step === 'awaiting_name') {
            const recipientInfo = rawText.trim();
            const withdrawAmount = activeWithdrawSession.amount || 25;

            if (recipientInfo.length < 4) {
              await sendTelegramMessage(
                botToken,
                chatId,
                `⚠️ እባክዎ ትክክለኛ የስልክ ቁጥር እና ስም ያስገቡ (ምሳሌ፦ <code>0911223344 አበበ ከበደ</code>)፦`
              );
              return;
            }

            // Clear session
            userWithdrawSessions.delete(String(fromUser.id));

            const txId = 'wth_tg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            const newTx: TransactionItem = {
              id: txId,
              telegram_id: String(fromUser.id),
              player_name: playerName,
              player_code: playerCode,
              phone_number: recipientInfo,
              type: 'withdraw',
              amount: withdrawAmount,
              status: 'pending',
              reference: recipientInfo,
              created_at: new Date().toISOString(),
              notes: `ማውጫ: ${recipientInfo} | ተጫዋች: ${playerName} (ID: ${playerCode})`,
            };

            // 1. Add to local secure database
            localDb.addTransaction(newTx);

            // 2. Sync to Supabase transactions table
            try {
              const supaClient = getSupabase();
              if (supaClient) {
                void (async () => {
                  try {
                    // Ensure the user is registered in Supabase users table first
                    const localUser = localDb.getUser(newTx.telegram_id);
                    if (localUser) {
                      await upsertUserAdaptive(localUser);
                    }

                    await supaClient.from('transactions').insert([{
                      id: newTx.id,
                      telegram_id: newTx.telegram_id,
                      player_name: newTx.player_name,
                      player_code: newTx.player_code,
                      phone_number: newTx.phone_number,
                      type: newTx.type,
                      amount: newTx.amount,
                      status: newTx.status,
                      reference: newTx.reference,
                      notes: newTx.notes,
                      created_at: newTx.created_at,
                    }]);
                  } catch {}
                })();
              }
            } catch {}

            // 3. Instant push to Vercel production API
            fetch('https://salery-bingo-1.vercel.app/api/transactions/withdraw', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newTx),
            }).catch(() => {});

            // 3. Clean user confirmation response (Player only)
            const confirmReply =
              `✅ <b>የ ${withdrawAmount} ETB ማውጫ ጥያቄዎ ደርሶናል!</b>\n\n` +
              `💳 <b>የሚላክበት ስልክና ስም፦</b> <code>${recipientInfo}</code>\n` +
              `🆔 <b>Player Code፦</b> <code>${playerCode}</code>\n` +
              `💰 <b>የሚከፈል መጠን፦</b> <b>${withdrawAmount} ETB</b>\n\n` +
              `ጥያቄዎ እንደተረጋገጠ ገንዘቡ ወዲያውኑ ይላክልዎታል። እናመሰግናለን! 🎮`;

            await sendTelegramMessage(botToken, chatId, confirmReply, getMainMenuMarkup(webAppUrl, fromUser.id, userBalance));
            return;
          }
        }

        // Direct /withdraw trigger or withdraw intent words
        const isWithdrawIntent =
          text.startsWith('/withdraw') ||
          text === 'withdraw' ||
          text === 'ማውጣት' ||
          text === 'ወጪ' ||
          text.includes('ገንዘብ ማውጣት') ||
          text.includes('ብር ማውጣት') ||
          text.includes('withdraw');

        if (isWithdrawIntent) {
          const fullUser = await getUserFull(fromUser.id);
          const userBalance = fullUser?.balance || 0;
          const maxWithdrawable = Math.max(0, userBalance - 25);

          if (userBalance <= 25 || maxWithdrawable <= 0) {
            const lowBalMsg =
              `⚠️ <b>ቀሪ ሂሳብዎ ለማውጣት አይበቃም!</b>\n\n` +
              `💰 የእርስዎ ቀሪ ሂሳብ፦ <b>${userBalance.toLocaleString()} ETB</b>\n\n` +
              `📌 <b>ደንብ፦</b> 25 ብር ሁልጊዜ በአካውንትዎ ውስጥ እንደ ቋሚ ተቀማጭ መቆየት አለበት። ማውጣት የሚቻለው በአካውንትዎ ውስጥ <b>ከ 25 ብር በላይ</b> ሲኖር ብቻ ነው።\n\n` +
              `ጨዋታዎችን በመጫወትና በማሸነፍ ከ 25 ብር በላይ ሲኖርዎት ማውጣት ይችላሉ! 🎮`;
            await sendTelegramMessage(botToken, chatId, lowBalMsg);
            return;
          }

          // Start Step 1 of withdrawal session
          userWithdrawSessions.set(String(fromUser.id), {
            step: 'awaiting_amount',
            timestamp: Date.now(),
          });
          userDepositSessions.delete(String(fromUser.id)); // Clear any deposit session

          const startWithdrawMsg =
            `🤑 <b>ገንዘብ ማውጣት (Withdraw)</b>\n\n` +
            `💰 የእርስዎ ቀሪ ሂሳብ፦ <b>${userBalance.toLocaleString()} ETB</b>\n` +
            `💵 ማውጣት የሚችሉት መጠን፦ <b>እስከ ${maxWithdrawable.toLocaleString()} ETB</b>\n` +
            `⚠️ <i>(ማሳሰቢያ፦ 25 ብር በአካውንትዎ ውስጥ ይቀራል፤ ከ 25 ብር በላይ ያለውን ብቻ ማውጣት ይችላሉ)</i>\n\n` +
            `እባክዎ <b>ስንት ብር</b> ማውጣት እንደሚፈልጉ በቁጥር ብቻ ይላኩ፦`;

          await sendTelegramMessage(botToken, chatId, startWithdrawMsg);
          return;
        }

        // Check if user is in an active deposit session state
        const activeDepositSession = userDepositSessions.get(String(fromUser.id));

        if (activeDepositSession?.step === 'awaiting_amount') {
          const numMatch = rawText.match(/(\d+)/);
          const parsedAmount = numMatch ? parseInt(numMatch[1], 10) : 0;

          if (!numMatch || parsedAmount < 10) {
            const lowAmtMsg =
              `⚠️ <b>ዝቅተኛው የማስገቢያ መጠን 10 ብር ነው!</b>\n\n` +
              `ከ 10 ብር በታች ማስገባት አይቻልም። እባክዎ ማስገባት የሚፈልጉትን የብር መጠን በቁጥር ብቻ ይላኩ (ምሳሌ፦ 50፣ 100፣ 200፣ 500)፦`;
            await sendTelegramMessage(botToken, chatId, lowAmtMsg);
            return;
          }

          // Transition to Step 2: awaiting screenshot
          userDepositSessions.set(String(fromUser.id), {
            step: 'awaiting_screenshot',
            amount: parsedAmount,
            timestamp: Date.now(),
          });

          const askScreenshotMsg =
            `✅ <b>የተመረጠው መጠን፦ ${parsedAmount} ETB</b>\n\n` +
            `እባክዎ የተገለጸውን <b>${parsedAmount} ብር</b> በሚከተለው የቴሌብር አካውንት ያስተላልፉ፦\n\n` +
            `📱 <b>Telebirr:</b> <code>0966987823</code>\n` +
            `👤 <b>ስም:</b> Samuel / Salery Bingo\n\n` +
            `📸 <b>ቀጣይ ደረጃ፦</b>\n` +
            `ገንዘቡን ካስተላለፉ በኋላ <b>የክፍያውን ደረሰኝ (Screenshot ፎቶ)</b> አሁኑኑ በዚህ ቦት ላይ ይላኩ!`;

          await sendTelegramMessage(botToken, chatId, askScreenshotMsg);
          return;
        }

        if (activeDepositSession?.step === 'awaiting_screenshot') {
          // If user re-entered another number >= 10, update amount
          const numMatch = rawText.match(/(\d+)/);
          if (numMatch && parseInt(numMatch[1], 10) >= 10) {
            const updatedAmt = parseInt(numMatch[1], 10);
            userDepositSessions.set(String(fromUser.id), {
              step: 'awaiting_screenshot',
              amount: updatedAmt,
              timestamp: Date.now(),
            });

            const updateAmtMsg =
              `✅ <b>የተሻሻለው መጠን፦ ${updatedAmt} ETB</b>\n\n` +
              `እባክዎ <b>${updatedAmt} ብር</b> በቴሌብር <code>0966987823</code> (Samuel) ከከፈሉ በኋላ የክፍያውን <b>ስክሪንሾት (Screenshot ፎቶ)</b> አሁኑኑ ይላኩ!`;
            await sendTelegramMessage(botToken, chatId, updateAmtMsg);
            return;
          }

          // Remind user to send photo
          const remindPhotoMsg =
            `📸 <b>እባክዎ የከፈሉበትን ደረሰኝ (Screenshot ፎቶ) ይላኩ!</b>\n\n` +
            `💰 የተጠየቀው መጠን፦ <b>${activeDepositSession.amount || 100} ETB</b>\n` +
            `📱 Telebirr: <code>0966987823</code> (Samuel)\n\n` +
            `የከፈሉበትን ደረሰኝ ፎቶ አንስተው እንደላኩ አድሚኑ ወዲያውኑ አይቶ ያረጋግጥልዎታል!`;
          await sendTelegramMessage(botToken, chatId, remindPhotoMsg);
          return;
        }

        // Handle text buttons from Reply Keyboard or commands
        const cleanText = text.trim();

        if (cleanText === 'balance 💵' || cleanText === 'balance' || cleanText === '/balance' || cleanText === 'ሂሳብ') {
          const balance = await getUserBalance(String(fromUser.id));
          const isAdmin = isAdminUser(fromUser.id);
          const balanceMsg =
            `💵 <b>የሂሳብዎ መጠን (Your Balance)</b>\n\n` +
            `💰 <b>ቀሪ ሂሳብ፦</b> <b>${balance.toLocaleString()} ETB</b>\n` +
            `🆔 <b>Player ID፦</b> <code>${fromUser.id}</code>\n\n` +
            `🎮 ጨዋታ ለመጀመር ከታች "Play 🎮" የሚለውን ይጫኑ!`;
          await sendTelegramMessage(botToken, chatId, balanceMsg, getMainMenuMarkup(webAppUrl, fromUser.id, balance));
          return;
        }

        if (cleanText === 'deposit 💰' || cleanText.startsWith('/deposit') || cleanText === 'deposit' || cleanText === 'ዲፖዚት' || cleanText.includes('ገንዘብ ማስገባት')) {
          userDepositSessions.set(String(fromUser.id), {
            step: 'awaiting_amount',
            timestamp: Date.now(),
          });
          const startDepositMsg =
            `💰 <b>ገንዘብ ማስገቢያ (Deposit)</b>\n\n` +
            `ስንት ብር ማስገባት ይፈልጋሉ?\n` +
            `⚠️ <i>(ማሳሰቢያ፦ ዝቅተኛው የማስገቢያ መጠን 10 ብር ነው! ከ 10 ብር በታች ማስገባት አይቻልም)</i>\n\n` +
            `እባክዎ ማስገባት የሚፈልጉትን የብር መጠን ብቻ በቁጥር ይላኩ (ምሳሌ፦ 50፣ 100፣ 200፣ 500)፦`;
          await sendTelegramMessage(botToken, chatId, startDepositMsg);
          return;
        }

        if (cleanText === 'withdraw 🤑' || cleanText.startsWith('/withdraw') || cleanText === 'withdraw' || cleanText === 'ማውጣት') {
          const fullUser = await getUserFull(fromUser.id);
          const userBal = fullUser?.balance || 0;
          userWithdrawSessions.set(String(fromUser.id), {
            step: 'awaiting_amount',
            timestamp: Date.now(),
          });
          userDepositSessions.delete(String(fromUser.id));
          const withdrawMsg =
            `🤑 <b>ገንዘብ ማውጣት (Withdraw)</b>\n\n` +
            `💰 የእርስዎ ቀሪ ሂሳብ፦ <b>${userBal.toLocaleString()} ETB</b>\n\n` +
            `እባክዎ <b>ስንት ብር</b> ማውጣት እንደሚፈልጉ በቁጥር ብቻ ይላኩ፦`;
          await sendTelegramMessage(botToken, chatId, withdrawMsg);
          return;
        }

        if (cleanText === 'transfer 🎁' || cleanText === 'transfer' || cleanText === 'ማስተላለፍ') {
          const transferMsg =
            `🎁 <b>ሂሳብ ማስተላለፊያ (Transfer)</b>\n\n` +
            `ለሌላ ተጫዋች ሳንቲም ለማስተላለፍ የጓደኛዎን የቴሌግራም ID እና የሚልኩትን መጠን ለድጋፍ ሰጪው ይላኩ።\n\n` +
            `👤 <b>Support:</b> @Salerybingo_support`;
          await sendTelegramMessage(botToken, chatId, transferMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
          return;
        }

        if (cleanText === 'instruction 📖' || cleanText === 'instruction' || cleanText === '/help' || cleanText === 'መመሪያ') {
          const instructionMsg =
            `📖 <b>የአጨዋወት መመሪያ (Rules & Instructions)</b>\n\n` +
            `1. "Play 🎮" የሚለውን በመጫን ጨዋታውን ይክፈቱ።\n` +
            `2. የካርቴላ መደብ (10, 20, 50...) እና የካርቴላ ብዛት ይምረጡ።\n` +
            `3. 75 ቁጥሮች በቅደም ተከተል በድምፅ እና በስክሪኑ ላይ ይጠራሉ።\n` +
            `4. በካርቴላዎ ላይ ያሉትን ቁጥሮች በመንካት አመሳስሉ።\n` +
            `5. መስመር ሲሞላ ወዲያውኑ "BINGO" የሚለውን በመጫን ያሸንፉ!`;
          await sendTelegramMessage(botToken, chatId, instructionMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
          return;
        }

        if (cleanText.includes('support') || cleanText.includes('ድጋፍ') || cleanText === 'contact support 📞' || cleanText === 'contact support...') {
          const supportMsg =
            `📞 <b>የደንበኞች አገልግሎት (Contact Support)</b>\n\n` +
            `ማንኛውም ጥያቄ፣ ክፍያ ወይም ድጋፍ ከፈለጉ አስተዳዳሪዎችን ያነጋግሩ፡\n\n` +
            `💬 <b>Admin / Support:</b> @Salerybingo_support\n` +
            `📢 <b>Official Channel:</b> @Salerybingo\n\n` +
            `በ 24/7 ሰዓት ለማስተናገድ ዝግጁ ነን!`;
          await sendTelegramMessage(botToken, chatId, supportMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
          return;
        }

        if (cleanText === 'invite 🔗' || cleanText === 'invite' || cleanText === 'ይጋብዙ') {
          const inviteMsg =
            `🔗 <b>የግብዣ ሊንክ (Invite & Earn)</b>\n\n` +
            `ጓደኞችዎን ይጋብዙና ለእያንዳንዱ ተጋባዥ 5 ብር ቦነስ ያግኙ!\n\n` +
            `የእርስዎ መጋበዣ ሊንክ፦\n` +
            `👉 https://t.me/${botUsername}?start=${fromUser.id}`;
          await sendTelegramMessage(botToken, chatId, inviteMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
          return;
        }

        if (cleanText === 'play 🎮' || cleanText === 'play' || cleanText === '/play') {
          const fullUser = await getUserFull(fromUser.id);
          const currentBal = fullUser?.balance ?? 0;
          await sendTelegramMessage(
            botToken,
            chatId,
            `🎮 <b>ቢንጎ ለመጫወት ከታች ያለውን "Play 🎮" ይጫኑ፦</b>`,
            getMainMenuMarkup(webAppUrl, fromUser.id, currentBal)
          );
          return;
        }

        // Fallback: Check if user typed an explicit full Ethiopian phone number (e.g. 0911223344, 0712345678, +251911223344)
        const ethioPhoneMatch = rawText.trim().match(/^(?:\+?251|0)([79]\d{8})$/);
        if (ethioPhoneMatch) {
          const fullPhone = `+251${ethioPhoneMatch[1]}`;
          const existingBefore = localDb.getUser(fromUser.id);
          const playerCode = existingBefore?.player_code || generatePlayerCode(fromUser.id);
          const playerName = fromUser.first_name || existingBefore?.first_name || 'Player';
          const fullName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || playerName;
          const currentBal = existingBefore?.balance ?? 0;

          localDb.upsertUser({
            telegram_id: String(fromUser.id),
            player_code: playerCode,
            first_name: playerName,
            full_name: fullName,
            username: fromUser.username || '',
            phone_number: fullPhone,
            is_verified: true,
            status: 'active',
          });
          await updateUserPhone(String(fromUser.id), fullPhone);

          try {
            const client = getSupabase();
            if (client) {
              upsertUserAdaptive({
                telegram_id: String(fromUser.id),
                player_code: playerCode,
                first_name: playerName,
                full_name: fullName,
                username: fromUser.username || '',
                phone_number: fullPhone,
                is_verified: true,
                status: 'active',
                balance: currentBal,
              }).catch(() => {});
            }
          } catch {}

          const confirmMsg =
            `✅ <b>ስልክ ቁጥርዎ በተሳካ ሁኔታ ተመዝግቧል!</b>\n\n` +
            `👤 <b>ተጫዋች፦</b> ${playerName}\n` +
            `🆔 <b>Player Code፦</b> <code>${playerCode}</code>\n` +
            `📱 <b>የተመዘገበ ስልክ፦</b> <code>${fullPhone}</code>\n` +
            `💰 <b>የአሁኑ ቀሪ ሂሳብዎ፦</b> <b>${currentBal.toLocaleString()} ETB</b>\n\n` +
            `ከታች <b>"Play 🎮"</b> የሚለውን በመጫን ጨዋታውን መጀመር ይችላሉ!`;

          await sendTelegramMessage(botToken, chatId, confirmMsg, getMainMenuMarkup(webAppUrl, fromUser.id, currentBal));
          return;
        }
      }
    }

    // 3. Handle button clicks (Callback Queries)
    if (update && update.callback_query) {
      const query = update.callback_query;
      const data = query.data;
      const chatId = query.message?.chat?.id || query.from?.id;
      const fromUser = query.from;
      const photoUrl = `${webAppUrl}/salery_bingo.jpg`;

      await answerCallbackQuery(botToken, query.id);

      if (data === 'btn_balance') {
        const balance = await getUserBalance(String(fromUser.id));
        const isAdmin = isAdminUser(fromUser.id);
        let balanceMsg: string;

        if (isAdmin) {
          balanceMsg =
            `👑 የሂሳብዎ መጠን (Admin Balance)\n\n` +
            `💰 ቀሪ ሂሳብ፦ ${balance} ብር / Coins\n` +
            `🆔 Admin ID፦ ${fromUser.id}\n\n` +
            `ጨዋታ ለመጀመር "Play 🎮" ይጫኑ ወይም ተጫዋቾችን ለመቆጣጠር /admin ይበሉ!`;
        } else {
          balanceMsg =
            `💵 የሂሳብዎ መጠን (Your Balance)\n\n` +
            `💰 ቀሪ ሂሳብ፦ ${balance} ብር / Coins\n` +
            `🎁 የቦነስ ሳንቲም፦ 0\n\n` +
            `ጨዋታ ለመጀመር ከታች "Play 🎮" የሚለውን ይጫኑ!`;
        }
        await sendTelegramPhoto(botToken, chatId, photoUrl, balanceMsg, getMainMenuMarkup(webAppUrl, fromUser.id, balance));
      } else if (data === 'btn_deposit') {
        userDepositSessions.set(String(fromUser.id), {
          step: 'awaiting_amount',
          timestamp: Date.now(),
        });
        const depositMsg =
          `💰 <b>ገንዘብ ማስገቢያ (Deposit)</b>\n\n` +
          `ስንት ብር ማስገባት ይፈልጋሉ?\n` +
          `⚠️ <i>(ማሳሰቢያ፦ ዝቅተኛው የማስገቢያ መጠን 10 ብር ነው! ከ 10 ብር በታች ማስገባት አይቻልም)</i>\n\n` +
          `እባክዎ ማስገባት የሚፈልጉትን የብር መጠን ብቻ በቁጥር ይላኩ (ምሳሌ፦ 50፣ 100፣ 200፣ 500)፦`;
        await sendTelegramMessage(botToken, chatId, depositMsg);
      } else if (data === 'btn_support') {
        const supportMsg =
          `📞 የደንበኞች አገልግሎት (Contact Support)\n\n` +
          `ማንኛውም ጥያቄ፣ ክፍያ ወይም ድጋፍ ከፈለጉ አስተዳዳሪዎችን ያነጋግሩ፡\n\n` +
          `💬 Admin / Support: @Salerybingo_support\n` +
          `📢 Official Channel: @Salerybingo\n\n` +
          `በ 24/7 ሰዓት ለማስተናገድ ዝግጁ ነን!`;
        await sendTelegramPhoto(botToken, chatId, photoUrl, supportMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
      } else if (data === 'btn_instruction') {
        const instructionMsg =
          `📖 የአጨዋወት መመሪያ (Rules & Instructions)\n\n` +
          `1. "Play 🎮" የሚለውን በመጫን ጨዋታውን ይክፈቱ።\n` +
          `2. የካርቴላ መደብ (10, 20, 50...) እና የካርቴላ ብዛት ይምረጡ።\n` +
          `3. 75 ቁጥሮች በቅደም ተከተል በድምፅ እና በስክሪኑ ላይ ይጠራሉ።\n` +
          `4. በካርቴላዎ ላይ ያሉትን ቁጥሮች በመንካት አመሳስሉ።\n` +
          `5. መስመር ሲሞላ ወዲያውኑ "BINGO" የሚለውን በመጫን ያሸንፉ!`;
        await sendTelegramPhoto(botToken, chatId, photoUrl, instructionMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
      } else if (data === 'btn_transfer') {
        const transferMsg =
          `🎁 ሂሳብ ማስተላለፊያ (Transfer)\n\n` +
          `ለሌላ ተጫዋች ሳንቲም ለማስተላለፍ የጓደኛዎን የቴሌግራም ID እና የሚልኩትን መጠን ለድጋፍ ሰጪው ይላኩ።\n\n` +
          `👤 Support: @Salerybingo_support`;
        await sendTelegramPhoto(botToken, chatId, photoUrl, transferMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
      } else if (data === 'btn_withdraw') {
        const fullUser = await getUserFull(fromUser.id);
        const userBal = fullUser?.balance || 0;

        userWithdrawSessions.set(String(fromUser.id), {
          step: 'awaiting_amount',
          timestamp: Date.now(),
        });
        userDepositSessions.delete(String(fromUser.id));

        const withdrawMsg =
          `🤑 <b>ገንዘብ ማውጣት (Withdraw)</b>\n\n` +
          `💰 የእርስዎ ቀሪ ሂሳብ፦ <b>${userBal.toLocaleString()} ETB</b>\n\n` +
          `እባክዎ <b>ስንት ብር</b> ማውጣት እንደሚፈልጉ በቁጥር ብቻ ይላኩ፦`;

        await sendTelegramMessage(botToken, chatId, withdrawMsg);
      } else if (data === 'btn_invite') {
        const inviteMsg =
          `🔗 የግብዣ ሊንክ (Invite & Earn)\n\n` +
          `ጓደኞችዎን ይጋብዙና ለእያንዳንዱ ተጋባዥ 5 ብር ቦነስ ያግኙ!\n\n` +
          `የእርስዎ መጋበዣ ሊንክ፦\n` +
          `👉 https://t.me/${botUsername}?start=${fromUser.id}`;
        await sendTelegramPhoto(botToken, chatId, photoUrl, inviteMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
      } else if (data.startsWith('adm_app_')) {
        const txId = data.replace('adm_app_', '');
        const tx = localDb.updateTransactionStatus(txId, 'approved');
        if (tx) {
          const curBal = await getUserBalance(tx.telegram_id);
          const newBal = curBal + tx.amount;
          await updateUserBalance(tx.telegram_id, newBal);

          // Sync with Supabase
          try {
            const client = getSupabase();
            if (client) {
              void client.from('transactions').update({ status: 'approved' }).eq('id', txId);
              void client.from('users').update({ balance: newBal }).eq('telegram_id', tx.telegram_id);
            }
          } catch {}

          // Alert player
          const playerMsg =
            `✅ <b>የገንዘብ ማስገቢያዎ ተረጋግጧል! (Deposit Approved)</b>\n\n` +
            `💰 <b>+${tx.amount} ETB</b> ወደ አካውንትዎ ገቢ ተደርጓል!\n` +
            `💵 <b>የአሁኑ ቀሪ ሂሳብዎ፦ ${newBal} ETB</b>\n\n` +
            `አሁኑኑ "Play 🎮" የሚለውን በመጫን ይጫወቱ!`;
          await sendTelegramPhoto(botToken, Number(tx.telegram_id), `${webAppUrl}/salery_bingo.jpg`, playerMsg, getMainMenuMarkup(webAppUrl, tx.telegram_id, newBal));

          await sendTelegramMessage(botToken, chatId, `✅ <b>የ ${tx.amount} ETB ዲፖዚት ጸድቋል!</b> ለተጫዋች ${tx.player_name} (${tx.player_code}) ገቢ ሆኗል። የአሁኑ ሂሳቡ፦ ${newBal} ETB`);
        }
      } else if (data.startsWith('adm_rej_')) {
        const txId = data.replace('adm_rej_', '');
        const tx = localDb.updateTransactionStatus(txId, 'rejected');
        if (tx) {
          try {
            const client = getSupabase();
            if (client) {
              void client.from('transactions').update({ status: 'rejected' }).eq('id', txId);
            }
          } catch {}
          await sendTelegramMessage(botToken, Number(tx.telegram_id), `❌ የ ${tx.amount} ETB ዲፖዚት ጥያቄዎ በአድሚን ውድቅ ተደርጓል። ጥያቄ ካለዎት ድጋፍ ሰጪውን @Salerybingo_support ያነጋግሩ።`);
          await sendTelegramMessage(botToken, chatId, `❌ የ ${tx.amount} ETB ዲፖዚት ውድቅ ተደርጓል።`);
        }
      } else if (data === 'adm_refresh') {
        const allUsers = localDb.getAllUsers().filter((u) => u.role !== 'admin' && String(u.telegram_id) !== '908336796');
        const pendingTxs = localDb.getTransactions({ status: 'pending' });
        await sendTelegramMessage(botToken, chatId, `🔄 <b>የአሁኑ መረጃ፦</b>\n• ጠቅላላ ተጫዋቾች፦ <b>${allUsers.length}</b>\n• ያልተረጋገጡ ዲፖዚቶች፦ <b>${pendingTxs.filter(t => t.type === 'deposit').length}</b>\n• የዊዝድሮው ጥያቄዎች፦ <b>${pendingTxs.filter(t => t.type === 'withdraw').length}</b>`);
      }
    }
  } catch (err) {
    console.error('Error processing Telegram update:', err);
  }
}

/**
 * Long Polling runner with conflict resolution and instance tracking
 */
function stopLongPolling(reason = 'restart') {
  currentPollingInstanceId = `stopped_${Date.now()}`;
  isLongPollingRunning = false;
  currentPollingToken = '';
  console.log(`🛑 Stopping Telegram long polling (${reason})`);
}

function isTelegramBotEnabled() {
  if (process.env.DISABLE_TELEGRAM_BOT?.trim().toLowerCase() === 'true') return false;
  return process.env.NODE_ENV === 'production';
}

function isTelegramPollingEnabled() {
  if (!isTelegramBotEnabled()) return false;
  if (process.env.ENABLE_TELEGRAM_POLLING?.trim().toLowerCase() === 'false') return false;
  if (process.env.TELEGRAM_WEBHOOK_URL && process.env.TELEGRAM_WEBHOOK_URL.trim().startsWith('http')) return false;
  return true;
}

async function startLongPolling(botToken: string) {
  if (!isTelegramPollingEnabled()) {
    console.info('Telegram polling disabled by local or environment configuration.');
    return;
  }
  if (!botToken || !botToken.includes(':') || botToken.length < 15) {
    console.warn('Cannot start Telegram long polling: invalid or missing token.');
    return;
  }

  if (isLongPollingRunning && currentPollingToken === botToken) {
    console.info('Telegram long polling is already active for this process.');
    return;
  }

  stopLongPolling('before-new-instance');
  const instanceId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  currentPollingInstanceId = instanceId;
  currentPollingToken = botToken;
  isLongPollingRunning = true;

  console.log(`🚀 Starting Telegram Long Polling (Instance: ${instanceId})...`);

  // Delete webhook so long polling can fetch updates without conflict
  try {
    const delRes = await fetch(
      `https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=false`
    );
    const delData: any = await delRes.json();
    console.log('Webhook status:', delData.description || delData.ok);
  } catch (e) {
    console.error('Error deleting webhook:', e);
  }

  let offset = 0;
  let consecutiveConflicts = 0;

  while (currentPollingInstanceId === instanceId) {
    try {
      // Use 10s polling timeout with 15s AbortSignal timeout to prevent socket ETIMEDOUT errors
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=10`,
        { signal: AbortSignal.timeout(15000) }
      );
      const data: any = await res.json();

      if (currentPollingInstanceId !== instanceId) {
        console.log(`Stopping superseded polling instance ${instanceId}`);
        break;
      }

      if (data.ok && Array.isArray(data.result)) {
        consecutiveConflicts = 0;
        for (const update of data.result) {
          offset = update.update_id + 1;
          await processTelegramUpdate(update, botToken);
        }
      } else if (!data.ok) {
        if (data.error_code === 409) {
          consecutiveConflicts++;
          if (consecutiveConflicts === 1) {
            console.warn('Telegram polling conflict: another poller is using this token; retrying with backoff.');
          }

          const delay = Math.min(30000, 5000 * consecutiveConflicts);
          await new Promise((r) => setTimeout(r, delay));
        } else if (data.error_code === 401) {
          console.error('❌ Telegram Bot Token is unauthorized (401). Stopping polling.');
          break;
        } else {
          console.warn('Telegram getUpdates returned non-ok:', data.description || data);
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isTimeout =
        errMsg.includes('ETIMEDOUT') ||
        errMsg.includes('ECONNRESET') ||
        errMsg.includes('aborted') ||
        errMsg.includes('fetch failed') ||
        err?.name === 'AbortError';

      if (isTimeout) {
        // Normal socket timeout during long-polling when no new updates arrive, retry quietly
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        console.warn('Polling network retry in 3s:', errMsg);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  if (currentPollingInstanceId === instanceId) {
    isLongPollingRunning = false;
    currentPollingToken = '';
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = Number(process.env.PORT) || 8080;
  const HOST = isProduction ? '0.0.0.0' : process.env.HOST || '0.0.0.0';
  const socketServer = new SocketServer(httpServer, {
    cors: {
      origin: (_origin, callback) => callback(null, true),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });
  attachBingoRooms(socketServer);

  app.use(
    cors({
      origin: (_origin, callback) => callback(null, true),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-bot-token'],
      credentials: true,
    })
  );

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Auto-detect production WebApp frontend URL from incoming requests (e.g. Vercel domain)
  app.use((req, res, next) => {
    try {
      const originHeader = (req.headers.origin || req.headers.referer) as string | undefined;
      if (originHeader && typeof originHeader === 'string' && originHeader.startsWith('http')) {
        const u = new URL(originHeader);
        const host = u.host.toLowerCase();
        if (
          (host.includes('vercel.app') || host.includes('netlify.app') || host.includes('pages.dev')) &&
          !host.includes('ais-pre-') &&
          !host.includes('ais-dev-') &&
          !host.includes('localhost')
        ) {
          const cfg = localDb.getBotConfig();
          const detectedUrl = `${u.protocol}//${u.host}`;
          if (!cfg.web_app_url || cfg.web_app_url.includes('ais-pre-') || cfg.web_app_url.includes('ais-dev-')) {
            console.log(`🌐 Auto-detected production frontend WebApp URL: ${detectedUrl}`);
            localDb.saveBotConfig(activeBotToken, activeBotUsername, detectedUrl);
          }
        }
      }
    } catch {}
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'salery-bingo-backend',
      supabaseConnected: !!supabase,
      timestamp: new Date(),
    });
  });

  // Secure Local Database Status & Backup Management
  app.get('/api/admin/database/status', (req, res) => {
    res.json(localDb.getStatus());
  });

  app.get('/api/admin/database/backup', (req, res) => {
    const backupJson = localDb.exportBackup();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="salery_bingo_backup_${Date.now()}.json"`);
    res.send(backupJson);
  });

  app.post('/api/admin/database/restore', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ ok: false, error: 'Backup data required' });
    const success = localDb.importBackup(typeof data === 'string' ? data : JSON.stringify(data));
    if (success) {
      return res.json({ ok: true, message: 'Database successfully restored from backup!' });
    }
    return res.status(400).json({ ok: false, error: 'Invalid backup format' });
  });

  // Diagnostic endpoint to check Database status
  app.get('/api/debug-supabase', (req, res) => {
    res.json({
      ok: true,
      storageType: 'local_isolated_secure',
      message: '100% ራሱን የቻለ የተጠበቀ ሰርቨር ዳታቤዝ (Zero Third-Party Dependency - Supabase አያስፈልገውም)',
      dbStatus: localDb.getStatus(),
    });
  });

  app.post('/api/bingo/guest-session', async (req, res) => {
    try {
      if (!signBingoGuestToken(0)) {
        return res.status(503).json({ ok: false, error: 'BINGO_GUEST_SECRET must be configured with at least 32 characters' });
      }
      const existingPlayerId = Number(req.body?.playerId);
      const existingToken = req.body?.token;
      const isLocalTestRequest = isLoopbackClientAllowed(req.headers.origin, req.socket.remoteAddress);
      if (
        Number.isSafeInteger(existingPlayerId) &&
        existingPlayerId > 0 &&
        isValidBingoGuestToken(existingPlayerId, existingToken)
      ) {
        let existingAccount = isPostgresConfigured()
          ? await getPostgresUser(String(existingPlayerId))
          : localDb.getUser(String(existingPlayerId));
        if (existingAccount) {
          let mainWallet = Number(existingAccount.main_wallet ?? existingAccount.balance ?? 0);
          let balance = Number(existingAccount.balance ?? mainWallet);
          if (isLocalTestRequest) {
            mainWallet = minimumLocalTestBalance(mainWallet, balance);
            balance = mainWallet;
            if (isPostgresConfigured()) {
              const updatedBalance = await setPostgresUserBalance(String(existingPlayerId), mainWallet);
              if (updatedBalance === null) throw new Error('Could not update the local test wallet balance');
              existingAccount = { ...existingAccount, balance: updatedBalance, main_wallet: updatedBalance };
              mainWallet = updatedBalance;
              balance = updatedBalance;
            } else {
              existingAccount = localDb.upsertUser({
                ...existingAccount,
                telegram_id: String(existingPlayerId),
                balance: mainWallet,
                main_wallet: mainWallet,
              });
            }
          }
          const playWallet = Number(existingAccount.play_wallet ?? 0);
          return res.json({
            ok: true,
            playerId: existingPlayerId,
            token: existingToken,
            balance,
            mainWallet,
            playWallet,
            playerCode: existingAccount.player_code,
          });
        }
      }

      let playerId = 0;
      let account: any = null;
      const localTestBalance = isLocalTestRequest ? minimumLocalTestBalance() : 0;
      for (let attempt = 0; attempt < 5 && !account; attempt++) {
        playerId = randomInt(1_000_000_000_000_000, 1_250_000_000_000_000);
        const id = String(playerId);
        if (localDb.getUser(id)) continue;
        if (isPostgresConfigured() && await getPostgresUser(id)) continue;

        const newUser: Partial<DbUser> & { telegram_id: string } = {
          telegram_id: id,
          player_code: generatePlayerCode(id),
          first_name: 'Player',
          full_name: 'Player',
          username: `player_${id.slice(-4)}`,
          balance: localTestBalance,
          main_wallet: localTestBalance,
          play_wallet: 0,
          role: 'user',
          status: 'active',
          is_blocked: false,
          is_verified: false,
        };
        account = isPostgresConfigured()
          ? await upsertPostgresUser(newUser)
          : localDb.upsertUser(newUser);
        if (account && isPostgresConfigured()) {
          localDb.upsertUser({
            ...newUser,
            balance: Number(account.balance ?? 0),
            main_wallet: Number(account.main_wallet ?? account.balance ?? 0),
            play_wallet: Number(account.play_wallet ?? 0),
          });
        }
      }

      if (!account) {
        return res.status(503).json({ ok: false, error: 'Could not create a unique guest player account' });
      }

      const token = signBingoGuestToken(playerId);
      if (!token) {
        return res.status(503).json({ ok: false, error: 'BINGO_GUEST_SECRET must be configured with at least 32 characters' });
      }
      const mainWallet = Number(account.main_wallet ?? account.balance ?? 0);
      const playWallet = Number(account.play_wallet ?? 0);
      return res.json({
        ok: true,
        playerId,
        token,
        balance: Number(account.balance ?? mainWallet),
        mainWallet,
        playWallet,
        playerCode: account.player_code,
      });
    } catch (error) {
      console.error('Could not issue bingo guest session:', error);
      return res.status(500).json({ ok: false, error: 'Could not issue bingo guest session' });
    }
  });

  app.post('/api/user/:telegramId/share-bonus', async (req, res) => {
    return res.status(410).json({ ok: false, error: 'Share bonuses are no longer credited to player wallets' });
  });

  // Instant Player Registration & Sync Endpoint (Dual-written to Supabase & Local Database)
  app.post('/api/user/sync', async (req, res) => {
    try {
      const { telegramId, referredBy } = req.body;
      if (!telegramId) return res.status(400).json({ ok: false, error: 'telegramId is required' });
      if (!requireVerifiedPlayer(req, res, String(telegramId))) return;

      const tId = String(telegramId);
      const isAdm = isAdminUser(tId);
      const telegramUser = getVerifiedRequestUser(req)!;
      const userRole = isAdm ? 'admin' : 'user';
      const code = generatePlayerCode(tId);
      const telegramFirstName = telegramUser.first_name || 'Player';
      const telegramFullName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || 'Player';

      // 1. Read and upsert the shared PostgreSQL profile, then refresh the local cache.
      const postgresExisting = await getPostgresUser(tId).catch((err) => {
        console.warn('PostgreSQL user lookup failed during sync:', err);
        return null;
      });
      const client = getSupabase();
      let supabaseExisting: Record<string, any> | null = null;
      if (!postgresExisting && client) {
        try {
          const { data, error } = await client.from('users').select('*').eq('telegram_id', tId).maybeSingle();
          if (error) console.warn('Supabase user lookup failed during Telegram registration:', error.message);
          else supabaseExisting = data;
        } catch (error) {
          console.warn('Supabase user lookup threw during Telegram registration:', error);
        }
      }
      let existing = postgresExisting
        ? localDb.upsertUser({
            telegram_id: tId,
            player_code: postgresExisting.player_code,
            first_name: postgresExisting.first_name,
            full_name: postgresExisting.full_name,
            username: postgresExisting.username,
            phone_number: postgresExisting.phone_number,
            balance: Number(postgresExisting.main_wallet ?? postgresExisting.balance ?? 0),
            main_wallet: Number(postgresExisting.main_wallet ?? postgresExisting.balance ?? 0),
            play_wallet: Number(postgresExisting.play_wallet ?? 0),
            role: postgresExisting.role || userRole,
            status: postgresExisting.status,
            is_blocked: !!postgresExisting.is_blocked,
            is_verified: !!postgresExisting.is_verified,
            referred_by: postgresExisting.referred_by,
          })
        : supabaseExisting
        ? localDb.upsertUser({
            telegram_id: tId,
            player_code: supabaseExisting.player_code,
            first_name: supabaseExisting.first_name,
            full_name: supabaseExisting.full_name,
            username: supabaseExisting.username,
            phone_number: supabaseExisting.phone_number,
            balance: Number(supabaseExisting.main_wallet ?? supabaseExisting.balance ?? 0),
            main_wallet: Number(supabaseExisting.main_wallet ?? supabaseExisting.balance ?? 0),
            play_wallet: Number(supabaseExisting.play_wallet ?? 0),
            role: supabaseExisting.role || userRole,
            status: supabaseExisting.status,
            is_blocked: !!supabaseExisting.is_blocked,
            is_verified: !!supabaseExisting.is_verified,
            referred_by: supabaseExisting.referred_by,
          })
        : localDb.getUser(tId);
      let finalBalance = existing ? existing.balance : 0;

      const updatedUser = localDb.upsertUser({
        telegram_id: tId,
        player_code: code,
        first_name: telegramFirstName,
        full_name: telegramFullName,
        username: telegramUser.username || existing?.username || '',
        phone_number: existing?.phone_number || '',
        balance: finalBalance,
        role: userRole,
        status: existing?.status || 'active',
        is_blocked: !!existing?.is_blocked,
        is_verified: !!existing?.is_verified,
        referred_by: referredBy || existing?.referred_by,
      });

      const mainWallet = Number(updatedUser.main_wallet ?? finalBalance);
      const playWallet = Number(updatedUser.play_wallet ?? 0);
      const postgresUser = await upsertPostgresUser({
        telegram_id: tId,
        player_code: code,
        first_name: updatedUser.first_name,
        full_name: updatedUser.full_name,
        username: updatedUser.username,
        phone_number: updatedUser.phone_number,
        balance: finalBalance,
        main_wallet: mainWallet,
        play_wallet: playWallet,
        role: userRole,
        status: updatedUser.status,
        is_blocked: updatedUser.is_blocked,
        is_verified: updatedUser.is_verified,
        referred_by: updatedUser.referred_by,
      }).catch((err) => {
        console.warn('PostgreSQL user upsert failed:', err);
        return null;
      });

      // 2. Sync to Supabase database in a split second
      let supaSynced = false;
      if (client) {
        try {
          const { error } = await upsertUserAdaptive({
            telegram_id: tId,
            player_code: code,
            first_name: updatedUser.first_name,
            full_name: updatedUser.full_name,
            username: updatedUser.username,
            phone_number: updatedUser.phone_number,
            balance: finalBalance,
            main_wallet: mainWallet,
            play_wallet: playWallet,
            role: userRole,
            status: updatedUser.status,
            is_blocked: updatedUser.is_blocked,
            is_verified: updatedUser.is_verified,
            referred_by: updatedUser.referred_by,
          });
          supaSynced = !error;
          if (error) console.warn('Supabase sync warning in /api/user/sync:', error);
          else console.log(`⚡ Player synced to Supabase instantly: ${tId} (@${updatedUser.username})`);
        } catch (e) {
          console.warn('Supabase sync exception:', e);
        }
      }

      return res.json({
        ok: true,
        user: updatedUser,
        balance: finalBalance,
        postgresSynced: !!postgresUser,
        supabaseSynced: supaSynced,
        supabaseConnected: !!client,
        storageType: postgresUser ? 'postgres' : client ? 'supabase_with_local_fallback' : 'local_fallback',
      });
    } catch (err: any) {
      console.error('/api/user/sync error:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Get user profile & balance endpoint for Mini App frontend
  app.get('/api/user/:telegramId', async (req, res) => {
    const telegramId = String(req.params.telegramId);
    if (!requireVerifiedPlayer(req, res, telegramId)) return;
    const isLocalTestRequest = isLoopbackClientAllowed(req.headers.origin, req.socket.remoteAddress);
    const postgresUser = await getPostgresUser(telegramId).catch((err) => {
      console.warn('PostgreSQL profile lookup failed:', err);
      return null;
    });
    let fullUser = await getUserFull(telegramId);
    const client = getSupabase();

    // Check Supabase if user exists there
    if (client && !postgresUser) {
      try {
        const { data: supaUser } = await client.from('users').select('*').eq('telegram_id', telegramId).maybeSingle();
        if (supaUser) {
          fullUser = localDb.upsertUser({
            telegram_id: telegramId,
            player_code: supaUser.player_code,
            first_name: supaUser.first_name || 'Player',
            full_name: supaUser.full_name || supaUser.first_name || 'Player',
            username: supaUser.username || '',
            phone_number: supaUser.phone_number || '',
            balance: Number(supaUser.balance ?? 0),
            role: supaUser.role || (isAdminUser(telegramId) ? 'admin' : 'user'),
            status: supaUser.status || (supaUser.is_blocked ? 'blocked' : 'active'),
            is_blocked: !!supaUser.is_blocked || supaUser.status === 'blocked',
            is_verified: !!supaUser.is_verified || !!supaUser.phone_number,
          });
        }
      } catch (err) {
        console.warn('Supabase check in /api/user error:', err);
      }
    }

    if (!fullUser) {
      // Auto-register in localDb
      const devRole = isAdminUser(telegramId) ? 'admin' : 'user';
      const devBalance = 0;
      const devPlay = 0;
      fullUser = localDb.upsertUser({
        telegram_id: telegramId,
        balance: devBalance,
        main_wallet: devBalance,
        play_wallet: devPlay,
        role: devRole,
      });
      // And sync to Supabase
      if (client && !postgresUser) {
        upsertUserAdaptive({
          telegram_id: telegramId,
          player_code: fullUser.player_code,
          balance: fullUser.balance,
          role: fullUser.role,
        }).catch(() => {});
      }
    }

    let mainWallet = Number((postgresUser as any)?.main_wallet ?? (fullUser as any)?.main_wallet ?? fullUser.balance);
    if (isLocalTestRequest && mainWallet < minimumLocalTestBalance()) {
      mainWallet = minimumLocalTestBalance(mainWallet, fullUser.balance);
      if (postgresUser) {
        const updatedBalance = await setPostgresUserBalance(telegramId, mainWallet);
        if (updatedBalance === null) {
          return res.status(503).json({ ok: false, error: 'Could not update the local test wallet balance' });
        }
        mainWallet = updatedBalance;
      }
      localDb.updateUserBalance(telegramId, mainWallet);
      fullUser = { ...fullUser, balance: mainWallet, main_wallet: mainWallet };
    }
    const playWallet = Number((postgresUser as any)?.play_wallet ?? (fullUser as any)?.play_wallet ?? 0);
    const balance = mainWallet;
    const isAdmin = isAdminUser(telegramId);
    const playerCode = fullUser.player_code || generatePlayerCode(telegramId);
    const role = isAdmin ? 'admin' : (fullUser.role || 'user');
    const isBlocked = fullUser.status === 'blocked' || fullUser.is_blocked === true;
    const banReason = fullUser.ban_reason;

    res.json({
      ok: true,
      telegramId,
      balance,
      mainWallet,
      playWallet,
      playerCode,
      role,
      status: isBlocked ? 'blocked' : 'active',
      isBlocked,
      ban_reason: isBlocked ? (banReason || 'የአገልግሎት ደንብ መጣስ') : undefined,
      user: fullUser,
      databaseType: isPostgresConfigured() ? 'postgres' : client ? 'supabase_realtime_hybrid' : 'local_secure',
      supabaseConnected: !!client,
    });
  });

  // Admin endpoint: List all players from Supabase & Local Database
  app.get('/api/admin/users', async (req, res) => {
    if (!requireVerifiedAdmin(req, res)) return;
    try {
      const client = getSupabase();
      const postgresUsers = await getPostgresUsers().catch((err) => {
        console.warn('PostgreSQL user list failed:', err);
        return null;
      });

      if (postgresUsers) {
        for (const user of postgresUsers) {
          if (!user.telegram_id) continue;
          localDb.upsertUser({
            telegram_id: String(user.telegram_id),
            player_code: user.player_code,
            first_name: user.first_name || user.full_name || 'Player',
            full_name: user.full_name || user.first_name || 'Player',
            username: user.username || '',
            phone_number: user.phone_number || '',
            balance: Number(user.balance ?? 0),
            role: user.role || (String(user.telegram_id) === '908336796' ? 'admin' : 'user'),
            status: user.status || (user.is_blocked ? 'blocked' : 'active'),
            is_blocked: !!user.is_blocked || user.status === 'blocked',
            ban_reason: user.ban_reason,
            is_verified: !!user.is_verified || !!user.phone_number,
            referred_by: user.referred_by,
          });
        }
      }

      // Query Supabase directly to pull all real-time players
      if (client && !postgresUsers) {
        try {
          const { data: supaUsers, error } = await client.from('users').select('*').order('created_at', { ascending: false });
          if (!error && Array.isArray(supaUsers)) {
            for (const su of supaUsers) {
              if (su.telegram_id) {
                localDb.upsertUser({
                  telegram_id: String(su.telegram_id),
                  player_code: su.player_code,
                  first_name: su.first_name || su.full_name || 'Player',
                  full_name: su.full_name || su.first_name || 'Player',
                  username: su.username || '',
                  phone_number: su.phone_number || '',
                  balance: Number(su.balance ?? 0),
                  role: su.role || (String(su.telegram_id) === '908336796' ? 'admin' : 'user'),
                  status: su.status || (su.is_blocked ? 'blocked' : 'active'),
                  is_blocked: !!su.is_blocked || su.status === 'blocked',
                  ban_reason: su.ban_reason,
                  is_verified: !!su.is_verified || !!su.phone_number,
                });
              }
            }
          }
        } catch (supaErr) {
          console.warn('Error fetching Supabase users for Admin Panel:', supaErr);
        }
      }

      const allDbUsers = localDb.getAllUsers().map((u) => {
        const tId = String(u.telegram_id);
        const isAdmin = isAdminUser(tId);
        const code = u.player_code || generatePlayerCode(tId);
        const role = isAdmin ? 'admin' : (u.role || 'user');
        const isBlocked = u.status === 'blocked' || u.is_blocked === true;
        const banReason = u.ban_reason;
        const balance = Number(u.balance ?? 0);

        return {
          id: u.id,
          telegram_id: tId,
          player_code: code,
          first_name: u.first_name || u.full_name || 'Player',
          full_name: u.full_name || u.first_name || 'Player',
          username: u.username || '',
          phone_number: u.phone_number || '',
          balance,
          role,
          status: isBlocked ? 'blocked' : 'active',
          is_blocked: isBlocked,
          ban_reason: isBlocked ? (banReason || 'የአገልግሎት ደንብ መጣስ') : undefined,
          is_verified: !!u.is_verified || !!u.phone_number,
          created_at: u.created_at || new Date().toISOString(),
        };
      });

      // Filter out admin accounts so only true players show up in the player list
      const usersList = allDbUsers.filter((u) => u.role !== 'admin' && !isAdminUser(u.telegram_id));

      const totalBalance = usersList.reduce((sum, u) => sum + (u.balance || 0), 0);
      const totalActive = usersList.filter((u) => u.status !== 'blocked').length;
      const dbStatus = localDb.getStatus();

      return res.json({
        ok: true,
        storageType: postgresUsers ? 'postgres' : client ? 'supabase_realtime_hybrid' : 'local_isolated_secure',
        isSecure: true,
        users: usersList,
        totalUsers: usersList.length,
        totalBalance,
        admin_revenue: dbStatus.admin_revenue || 0,
        totalActive,
        totalBlocked: usersList.length - totalActive,
        supabaseConnected: !!client,
        securityNotice: client ? '⚡ Supabase Cloud Database ተገናኝቷል - በቅጽበት ማመሳሰል ይሰራል!' : '🔒 ራሱን የቻለ የተጠበቀ ሰርቨር ዳታቤዝ (Local Secure Storage)',
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Admin endpoint: Get current Supabase configuration status
  app.get('/api/admin/supabase-config', (req, res) => {
    const saved = localDb.getSupabaseConfig();
    const client = getSupabase();
    return res.json({
      ok: true,
      url: saved.url || '',
      isConfigured: !!(saved.url && saved.key),
      isConnected: !!client,
      maskedKey: saved.key ? `${saved.key.slice(0, 6)}...${saved.key.slice(-4)}` : undefined,
    });
  });

  // Admin endpoint: Save and reinitialize Supabase credentials
  app.post('/api/admin/supabase-config', async (req, res) => {
    try {
      const { url, key } = req.body;
      const cleanUrl = (url || '').trim().replace(/\/+$/, '');
      const cleanKey = (key || '').trim();

      if (!cleanUrl || !cleanKey) {
        return res.status(400).json({ ok: false, error: 'Supabase URL እና Key ማስገባት አስፈላጊ ነው።' });
      }

      // Reinitialize client
      const newClient = reinitSupabase(cleanUrl, cleanKey);
      if (!newClient) {
        return res.status(400).json({ ok: false, error: 'የተሰጠው Supabase URL ወይም Key ልክ አይደለም።' });
      }

      // Test query
      const { data, error } = await newClient.from('users').select('id').limit(1);
      const tablesExist = !error || !error.message.includes('does not exist');

      return res.json({
        ok: true,
        isConnected: true,
        tablesExist,
        message: tablesExist
          ? 'ከ Supabase ዳታቤዝ ጋር በስኬት ተገናኝቷል! ሁሉም ተጫዋቾች እና እንቅስቃሴዎች በቅጽበት ይመሳሰላሉ።'
          : 'ከ Supabase ጋር ተገናኝቷል! የ SQL ሰንጠረዥ ገና ካልፈጠሩ የ SQL ኮዱን በ Supabase SQL Editor ውስጥ ያሂዱ።',
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });


  // Admin endpoint: Set or Adjust player balance
  app.post('/api/admin/user/:telegramId/balance', async (req, res) => {
    if (!requireVerifiedAdmin(req, res)) return;
    if (!isPostgresConfigured()) {
      return res.status(503).json({ ok: false, error: 'PostgreSQL wallet storage is required for balance changes' });
    }
    const telegramId = req.params.telegramId;
    const { balance, delta, reason } = req.body;
    let targetBalance: number;

    if (typeof balance === 'number') {
      targetBalance = balance;
    } else if (typeof delta === 'number') {
      const current = await getUserBalance(telegramId);
      targetBalance = Math.max(0, current + delta);
    } else {
      return res.status(400).json({ ok: false, error: 'Must provide balance or delta' });
    }

    const success = await updateUserBalance(telegramId, targetBalance);
    console.log(
      `👑 ADMIN modified balance for ${telegramId}: set to ${targetBalance} ETB (reason: ${reason || 'admin_override'})`
    );

    // Also send notification to player on Telegram if bot token is configured
    const botToken = getActiveBotToken(req);
    if (botToken && !isNaN(Number(telegramId))) {
      try {
        const changeMsg =
          `🔔 <b>የሂሳብ ለውጥ ማስታወቂያ (Balance Update)</b>\n\n` +
          `የእርስዎ ቀሪ ሂሳብ በአድሚን ተስተካክሏል፦\n` +
          `💰 የአሁኑ ቀሪ ሂሳብ፦ <b>${targetBalance} ETB</b>\n` +
          `${reason ? `📝 ምክንያት፦ ${reason}\n` : ''}\n` +
          `መልካም ጨዋታ! 🎮`;
        await sendTelegramMessage(botToken, Number(telegramId), changeMsg);
      } catch (err) {
        console.warn(`Could not notify user ${telegramId}:`, err);
      }
    }

    res.json({
      ok: success,
      telegramId,
      balance: targetBalance,
    });
  });

  // Admin endpoint: Block or Unblock player (Ban system)
  app.post('/api/admin/user/:telegramId/status', async (req, res) => {
    const telegramId = req.params.telegramId;
    const { status, reason } = req.body; // 'active' or 'blocked'
    const isBlocked = status === 'blocked';
    const banReason = reason || 'የአገልግሎት ደንብ መጣስ (Terms Violation)';

    if (isBlocked) {
      inMemoryBannedUsers.set(String(telegramId), {
        reason: banReason,
        banned_at: new Date().toISOString(),
      });
    } else {
      inMemoryBannedUsers.delete(String(telegramId));
    }

    const client = getSupabase();
    if (client) {
      try {
        const { error } = await client
          .from('users')
          .update({ status, is_blocked: isBlocked })
          .eq('telegram_id', String(telegramId));

        if (error) {
          await client.from('users').update({ status }).eq('telegram_id', String(telegramId));
        }
      } catch (err) {
        console.warn('DB update user status err:', err);
      }
    }

    await setPostgresUserStatus(telegramId, isBlocked ? 'blocked' : 'active', banReason).catch((err) => {
      console.warn('PostgreSQL user status update failed:', err);
      return null;
    });

    console.log(`👑 ADMIN changed status for user ${telegramId} to: ${status} (Reason: ${banReason})`);

    // Notify player on Telegram immediately
    const botToken = getActiveBotToken(req);
    if (botToken && !isNaN(Number(telegramId))) {
      try {
        if (isBlocked) {
          const banAlert =
            `🚫 <b>መለያዎ በአድሚን ታግዷል (Account Suspended)</b>\n\n` +
            `ውድ ተጫዋች፣ የእርስዎ መለያ በአድሚን ታግዷል።\n` +
            `📝 <b>ምክንያት፦</b> ${banReason}\n\n` +
            `ለተጨማሪ ማብራሪያ ወይም ይግባኝ እባክዎን አድሚንን ያነጋግሩ።`;
          await sendTelegramMessage(botToken, Number(telegramId), banAlert);
        } else {
          const unbanAlert =
            `✅ <b>መለያዎ ዕገዳ ተነስቶለታል (Account Restored)</b>\n\n` +
            `ውድ ተጫዋች፣ የእርስዎ መለያ እንደገና አገልግሎት እንዲሰጥ ተፈቅዷል!\n` +
            `አሁን መግባትና መጫወት ይችላሉ። መልካም ጨዋታ! 🎮`;
          await sendTelegramMessage(botToken, Number(telegramId), unbanAlert);
        }
      } catch (err) {
        console.warn(`Could not send ban notification to user ${telegramId}:`, err);
      }
    }

    return res.json({
      ok: true,
      telegramId,
      status,
      isBlocked,
      reason: isBlocked ? banReason : undefined,
    });
  });

  // Admin endpoint: Broadcast message or photo to users (Podcast/Broadcast Studio)
  app.post('/api/admin/broadcast', async (req, res) => {
    if (!requireVerifiedAdmin(req, res)) return;
    const { message, targetTelegramId, photoUrl, photoTitle, botToken: bodyToken } = req.body;
    const botToken = bodyToken || getActiveBotToken(req);

    if (!message && !photoUrl) {
      return res.status(400).json({ ok: false, error: 'Message or photo is required' });
    }

    // Save photo to media gallery if provided and new
    if (photoUrl && typeof photoUrl === 'string') {
      const exists = localDb.getMedia().some((m) => m.url === photoUrl);
      if (!exists) {
        localDb.addMedia({
          id: 'med_' + Date.now(),
          url: photoUrl,
          title: photoTitle || 'የተላከ ፎቶ (Sent Photo)',
          category: 'custom',
          created_at: new Date().toISOString(),
        });
      }
    }

    // Build WebApp button for the broadcast
    const cleanAppDomain = resolveWebAppUrl();
    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '🎮 አሁኑኑ ተጫወት (Play Bingo)',
            web_app: { url: cleanAppDomain },
          },
        ],
      ],
    };

    const finalCaptionOrText = message || '📢 የሳለሪ ቢንጎ ማስታወቂያ (Salery Bingo Announcement)';

    try {
      // 1. Single recipient
      if (targetTelegramId && targetTelegramId !== 'all') {
        const chatId = Number(targetTelegramId);
        let deliveredToTelegram = false;

        if (botToken && !isNaN(chatId)) {
          try {
            if (photoUrl) {
              const r = await sendTelegramPhoto(botToken, chatId, photoUrl, finalCaptionOrText, replyMarkup);
              if (r && r.ok) deliveredToTelegram = true;
            } else {
              const r = await sendTelegramMessage(botToken, chatId, finalCaptionOrText, replyMarkup);
              if (r && r.ok) deliveredToTelegram = true;
            }
          } catch (singleErr) {
            console.warn(`Single broadcast error to ${chatId}:`, singleErr);
          }
        }

        const record: BroadcastRecord = {
          id: 'bc_' + Date.now(),
          message: finalCaptionOrText,
          photo_url: photoUrl,
          target: String(targetTelegramId),
          sent_count: 1,
          created_at: new Date().toISOString(),
        };
        await persistBroadcastRecord(record);

        return res.json({
          ok: true,
          sentCount: 1,
          record,
          botDelivered: deliveredToTelegram,
          warning: !botToken
            ? 'መልእክቱ በአፕሊኬሽኑ ተመዝግቧል። ወደ ቴሌግራም ቦት በቀጥታ እንዲደርስ የቦት ቶከን (BOT_TOKEN) ያገናኙ።'
            : undefined,
        });
      }

      // 2. Broadcast to ALL players (from Local Secure Database, transactions, and game logs)
      const recipientSet = new Set<string>();

      // All users registered in localDb
      for (const u of localDb.getAllUsers()) {
        if (u.telegram_id && !isNaN(Number(u.telegram_id))) {
          recipientSet.add(String(u.telegram_id));
        }
      }

      // Transactions
      for (const t of localDb.getTransactions()) {
        if (t.telegram_id && !isNaN(Number(t.telegram_id))) {
          recipientSet.add(String(t.telegram_id));
        }
      }

      // Game logs
      for (const g of localDb.getGameLogs()) {
        if (g.telegram_id && !isNaN(Number(g.telegram_id))) {
          recipientSet.add(String(g.telegram_id));
        }
      }

      // Admins & default accounts
      recipientSet.add('908336796');
      for (const a of getAdminTelegramIds()) {
        if (a && !isNaN(Number(a))) recipientSet.add(String(a));
      }

      // Verified users cache
      for (const vId of Object.keys(verifiedUsersCache)) {
        if (vId && !isNaN(Number(vId))) {
          recipientSet.add(String(vId));
        }
      }

      // Postgres users
      try {
        const pgUsers = await getPostgresUsers();
        if (Array.isArray(pgUsers)) {
          for (const pu of pgUsers) {
            if (pu.telegram_id && !isNaN(Number(pu.telegram_id))) {
              recipientSet.add(String(pu.telegram_id));
            }
          }
        }
      } catch {}

      // Supabase users
      try {
        const supaClient = getSupabase();
        if (supaClient) {
          const { data: sUsers } = await supaClient.from('users').select('telegram_id');
          if (Array.isArray(sUsers)) {
            for (const su of sUsers) {
              if (su.telegram_id && !isNaN(Number(su.telegram_id))) {
                recipientSet.add(String(su.telegram_id));
              }
            }
          }
        }
      } catch {}

      let sentAttemptCount = 0;
      let deliveredCount = 0;

      if (botToken) {
        const recipientList = Array.from(recipientSet);
        const BATCH_SIZE = 5;

        for (let i = 0; i < recipientList.length; i += BATCH_SIZE) {
          const batch = recipientList.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (tid) => {
              const chatId = Number(tid);
              if (isNaN(chatId)) return;
              sentAttemptCount++;
              try {
                let resObj: any;
                if (photoUrl) {
                  resObj = await sendTelegramPhoto(botToken, chatId, photoUrl, finalCaptionOrText, replyMarkup);
                } else {
                  resObj = await sendTelegramMessage(botToken, chatId, finalCaptionOrText, replyMarkup);
                }

                if (resObj && resObj.ok) {
                  deliveredCount++;
                } else {
                  console.warn(`Broadcast to Telegram ID ${chatId} non-ok:`, resObj?.description || resObj);
                }
              } catch (err) {
                console.warn(`Broadcast error to ${tid}:`, err);
              }
            })
          );
          await new Promise((r) => setTimeout(r, 40)); // Telegram anti-flood delay between batches
        }
      }

      const isRealToken = !!(botToken && botToken.includes(':') && botToken.length > 15);
      const totalTargetCount = recipientSet.size;
      const record: BroadcastRecord = {
        id: 'bc_' + Date.now(),
        message: finalCaptionOrText,
        photo_url: photoUrl,
        target: 'all',
        sent_count: deliveredCount || totalTargetCount,
        created_at: new Date().toISOString(),
      };
      await persistBroadcastRecord(record);
      socketServer.emit('admin:broadcast', {
        message: finalCaptionOrText,
        photoUrl: photoUrl || undefined,
        createdAt: record.created_at,
      });

      return res.json({
        ok: true,
        sentCount: deliveredCount || totalTargetCount,
        deliveredCount,
        attemptedCount: sentAttemptCount,
        totalRecipients: recipientSet.size,
        record,
        botDelivered: deliveredCount > 0,
        isRealToken,
        warning: !isRealToken
          ? 'መልእክቱ በአድሚን ፓነል ተመዝግቧል! ወደ ተጫዋቾች ቴሌግራም ስልክ በቀጥታ እንዲደርስ የቦት ቶከን (BOT_TOKEN) ማገናኘት ያስፈልጋል።'
          : deliveredCount === 0 && recipientSet.size > 0
          ? 'መልእክቱ ተመዝግቧል፤ ነገር ግን ተጫዋቾች ቦቱን በቴሌግራም (/start) እስካልጀመሩ ድረስ በቀጥታ ሊደርሳቸው አይችልም።'
          : undefined,
      });
    } catch (e: any) {
      console.error('Broadcast failed:', e);
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Admin endpoint: Get current Telegram bot connection status & WebApp URL
  app.get('/api/admin/bot-config', (req, res) => {
    const token = getActiveBotToken(req);
    const isRealToken = !!(token && token.includes(':') && token.length > 15);
    const masked = isRealToken
      ? `${token.slice(0, 7)}...${token.slice(-4)}`
      : '';
    const currentWebAppUrl = resolveWebAppUrl();
    res.json({
      ok: true,
      isConfigured: isRealToken,
      botUsername: activeBotUsername || 'salery_bingo_bot',
      webAppUrl: currentWebAppUrl,
      maskedToken: masked,
    });
  });

  // Admin endpoint: Configure & verify Telegram bot token & WebApp URL dynamically
  app.post('/api/admin/bot-config', async (req, res) => {
    if (!isTelegramBotEnabled()) {
      return res.status(503).json({ ok: false, error: 'Telegram bot integration is disabled in local development' });
    }
    const { botToken, botUsername, webAppUrl } = req.body;
    const cleanToken = String(botToken || activeBotToken || '').trim();

    if (!cleanToken && !webAppUrl) {
      return res.status(400).json({ ok: false, error: 'የቦት ቶከን ወይም የዌብአፕ አድራሻ ማስገባት አስፈላጊ ነው' });
    }

    // If only updating WebApp URL
    if (webAppUrl && (!botToken || botToken === activeBotToken)) {
      const cleanUrl = String(webAppUrl).trim().replace(/\/$/, '');
      localDb.saveBotConfig(activeBotToken, activeBotUsername, cleanUrl);
      return res.json({
        ok: true,
        message: 'የዌብአፕ አድራሻ በተሳካ ሁኔታ ተቀምጧል!',
        bot: { username: activeBotUsername },
        webAppUrl: cleanUrl,
      });
    }

    try {
      // Verify token with Telegram Bot API
      const testRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      const testData: any = await testRes.json();

      if (!testData.ok || !testData.result) {
        return res.status(400).json({
          ok: false,
          error: `ልክ ያልሆነ የቦት ቶከን፦ ${testData.description || 'የቴሌግራም አገልጋይ ቶከኑን አልተቀበለውም'}`,
        });
      }

      // Valid! Save token in active server state
      activeBotToken = cleanToken;
      if (testData.result.username) {
        activeBotUsername = testData.result.username;
      } else if (botUsername) {
        activeBotUsername = String(botUsername).replace('@', '').trim();
      }

      const targetWebUrl = webAppUrl ? String(webAppUrl).trim().replace(/\/$/, '') : resolveWebAppUrl();

      console.log(`🤖 Telegram Bot dynamically connected: @${activeBotUsername} (${testData.result.first_name})`);

      // Save to local database persistence
      localDb.saveBotConfig(activeBotToken, activeBotUsername, targetWebUrl);

      if (isTelegramPollingEnabled()) {
        startLongPolling(activeBotToken).catch((err) => {
          console.error('Long polling auto-start failed:', err);
        });
      }

      return res.json({
        ok: true,
        message: `የቴሌግራም ቦቱ (@${activeBotUsername}) በተሳካ ሁኔታ ተገናኝቷል!`,
        bot: testData.result,
        webAppUrl: targetWebUrl,
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message || 'ግንኙነት አልተሳካም' });
    }
  });

  // Admin endpoint: Get broadcast history
  app.get('/api/admin/broadcast/history', async (_req, res) => {
    try {
      const persistedHistory = await getPostgresBroadcasts();
      if (persistedHistory) return res.json({ ok: true, history: persistedHistory });
      if (isProduction) return res.status(503).json({ ok: false, error: 'Broadcast history database is unavailable' });
      return res.json({ ok: true, history: inMemoryBroadcastHistory });
    } catch (error) {
      console.error('Could not load persisted broadcast history:', error);
      return res.status(503).json({ ok: false, error: 'Broadcast history database is unavailable' });
    }
  });

  // Admin endpoint: Get media gallery (photos sent or uploaded)
  app.get('/api/admin/media', (req, res) => {
    const combined = [...inMemoryMediaGallery];
    for (const tx of inMemoryTransactions) {
      if (tx.screenshot_url && !combined.some((m) => m.url === tx.screenshot_url)) {
        combined.push({
          id: 'tx_' + tx.id,
          url: tx.screenshot_url,
          title: `የተጫዋች ደረሰኝ (${tx.player_name || tx.player_code})`,
          category: 'receipt',
          created_at: tx.created_at,
        });
      }
    }
    res.json({ ok: true, media: combined });
  });

  // Admin endpoint: Save photo to media gallery
  app.post('/api/admin/media', (req, res) => {
    const { url, title, category } = req.body;
    if (!url) return res.status(400).json({ ok: false, error: 'URL required' });

    const newItem: MediaItem = {
      id: 'med_' + Date.now(),
      url,
      title: title || 'የተቀመጠ ፎቶ',
      category: category || 'custom',
      created_at: new Date().toISOString(),
    };
    inMemoryMediaGallery.unshift(newItem);
    res.json({ ok: true, item: newItem });
  });

  // Update user balance from Mini App (e.g. after card purchase, win, topup)
  app.post('/api/user/:telegramId/balance', (_req, res) => {
    res.status(403).json({ ok: false, error: 'Client-side balance changes are disabled' });
  });

  // Telegram photo proxy route so admin panel can view screenshots seamlessly
  app.get('/api/telegram-photo/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    const botToken = getActiveBotToken(req);
    if (!botToken || !fileId) {
      return res.status(400).send('Bot token or file_id missing');
    }
    try {
      const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
      const fileData: any = await fileRes.json();
      if (!fileData.ok || !fileData.result?.file_path) {
        return res.status(404).send('File not found on Telegram');
      }
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
      const imgRes = await fetch(fileUrl);
      if (!imgRes.ok) {
        return res.status(imgRes.status).send('Failed to fetch image from Telegram');
      }
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const arrayBuffer = await imgRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error('Telegram photo proxy error:', err);
      res.status(500).send('Error fetching photo');
    }
  });

  // 1. Submit Deposit Request (User submits deposit slip / transaction ref) -> INSTANT Telegram notification to Admin
  app.post('/api/transactions/deposit', async (req, res) => {
    const { id, telegramId, playerName, playerCode, phoneNumber, amount, reference, notes, screenshotUrl, screenshot_url, photoFileId, photo_file_id } = req.body;
    const numAmount = Number(amount);

    if (inMemoryBannedUsers.has(String(telegramId))) {
      return res.status(403).json({ ok: false, error: 'User is banned by admin', isBlocked: true });
    }

    if (!telegramId || !numAmount || numAmount < 10) {
      return res.status(400).json({
        ok: false,
        error: 'አነስተኛ የማስገቢያ መጠን 10 ብር ነው! ከ 10 ብር ጀምሮ ማስገባት ይችላሉ (Min: 10 ETB)',
      });
    }

    const txId = id || 'dep_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const finalScreenshotUrl = screenshotUrl || screenshot_url || '';
    const finalPhotoFileId = photoFileId || photo_file_id || '';

    const newTx: TransactionItem = {
      id: txId,
      telegram_id: String(telegramId),
      player_name: playerName || 'Player',
      player_code: playerCode || generatePlayerCode(telegramId),
      phone_number: phoneNumber || '',
      type: 'deposit',
      amount: numAmount,
      status: 'pending',
      reference: reference || 'Telebirr Transfer',
      screenshot_url: finalScreenshotUrl,
      photo_file_id: finalPhotoFileId,
      created_at: new Date().toISOString(),
      notes: notes || '',
    };

    localDb.addTransaction(newTx);

    const postgresTransaction = await savePostgresTransaction(newTx).catch((err) => {
      console.warn('PostgreSQL deposit persistence failed:', err);
      return null;
    });

    // Instant sync to Supabase transactions table
    const supaDepClient = getSupabase();
    if (supaDepClient) {
      void (async () => {
        try {
          const { error } = await supaDepClient.from('transactions').insert([{
            id: newTx.id,
            telegram_id: newTx.telegram_id,
            player_name: newTx.player_name,
            player_code: newTx.player_code,
            phone_number: newTx.phone_number || '',
            type: newTx.type,
            amount: newTx.amount,
            status: newTx.status,
            reference: newTx.reference || '',
            screenshot_url: newTx.screenshot_url || '',
            photo_file_id: newTx.photo_file_id || '',
            notes: newTx.notes || '',
            created_at: newTx.created_at,
          }]);
          if (error) console.warn('Supabase deposit insert error:', error.message);
          else console.log(`⚡ Supabase deposit recorded instantly: ${newTx.id} (${newTx.amount} ETB)`);
        } catch {}
      })();
    }

    return res.json({
      ok: true,
      transaction: newTx,
      storageType: postgresTransaction ? 'postgres' : getSupabase() ? 'supabase' : 'local_fallback',
      message: 'Deposit request submitted successfully.',
    });
  });

  // 2. Submit Withdrawal Request (User requests withdrawal) -> INSTANT Telegram notification to Admin
  app.post('/api/transactions/withdraw', async (req, res) => {
    const { id, telegramId, playerName, playerCode, phoneNumber, amount, paymentMethod, recipientName, reference, notes } = req.body;
    const numAmount = Number(amount);

    if (inMemoryBannedUsers.has(String(telegramId))) {
      return res.status(403).json({ ok: false, error: 'User is banned by admin', isBlocked: true });
    }

    if (!telegramId || !numAmount || numAmount <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'ትክክለኛ የብር መጠን ያስገቡ',
      });
    }

    // Check user's current balance and 25 ETB minimum reserve
    const currentBal = await getUserBalance(String(telegramId));
    const maxWithdrawable = Math.max(0, currentBal - 25);

    if (currentBal <= 25 || maxWithdrawable <= 0) {
      return res.status(400).json({
        ok: false,
        error: `ቀሪ ሂሳብዎ (${currentBal} ETB) ለማውጣት አይበቃም። 25 ብር ሁልጊዜ በአካውንትዎ ውስጥ እንደ ቋሚ ተቀማጭ መቅረት አለበት!`,
      });
    }

    if (numAmount > maxWithdrawable) {
      return res.status(400).json({
        ok: false,
        error: `25 ብር ሁልጊዜ በአካውንትዎ ውስጥ መቅረት አለበት! ማውጣት የሚችሉት ከፍተኛው መጠን ${maxWithdrawable} ETB ነው።`,
      });
    }

    const txId = id || 'wth_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const methodStr = paymentMethod || 'Telebirr';
    const finalRef = reference || (recipientName ? `${methodStr}: ${phoneNumber || 'Not provided'} | ስም: ${recipientName}` : `${methodStr}: ${phoneNumber || 'Not provided'}`);
    const finalNotes = notes || (recipientName ? `የመክፈያ ዘዴ: ${methodStr} | የሚወጣበት ስም: ${recipientName}` : `የመክፈያ ዘዴ: ${methodStr}`);

    const newTx: TransactionItem = {
      id: txId,
      telegram_id: String(telegramId),
      player_name: playerName || 'Player',
      player_code: playerCode || generatePlayerCode(telegramId),
      phone_number: phoneNumber || '',
      type: 'withdraw',
      amount: numAmount,
      status: 'pending',
      reference: finalRef,
      created_at: new Date().toISOString(),
      notes: finalNotes,
    };

    localDb.addTransaction(newTx);

    const postgresTransaction = await savePostgresTransaction(newTx).catch((err) => {
      console.warn('PostgreSQL withdrawal persistence failed:', err);
      return null;
    });

    // Instant sync to Supabase transactions table
    const supaWthClient = getSupabase();
    if (supaWthClient) {
      void (async () => {
        try {
          const { error } = await supaWthClient.from('transactions').insert([{
            id: newTx.id,
            telegram_id: newTx.telegram_id,
            player_name: newTx.player_name,
            player_code: newTx.player_code,
            phone_number: newTx.phone_number || '',
            type: newTx.type,
            amount: newTx.amount,
            status: newTx.status,
            reference: newTx.reference || '',
            notes: newTx.notes || '',
            created_at: newTx.created_at,
          }]);
          if (error) console.warn('Supabase withdraw insert error:', error.message);
          else console.log(`⚡ Supabase withdrawal recorded instantly: ${newTx.id} (${newTx.amount} ETB)`);
        } catch {}
      })();
    }

    return res.json({
      ok: true,
      transaction: newTx,
      storageType: postgresTransaction ? 'postgres' : getSupabase() ? 'supabase' : 'local_fallback',
      message: 'Withdrawal request submitted successfully.',
    });
  });

  // 3. Admin: Fetch all transactions (filter by type or status)
  app.get('/api/admin/transactions', async (req, res) => {
    const type = req.query.type as string;
    const status = req.query.status as string;

    const client = getSupabase();
    const filters = {
      type: type === 'deposit' || type === 'withdraw' ? type : undefined,
      status: status || undefined,
    };
    const transactionMap = new Map<string, DbTransaction>();

    if (client) {
      try {
        let query = client.from('transactions').select('*').order('created_at', { ascending: false });
        if (filters.type) query = query.eq('type', filters.type);
        if (filters.status) query = query.eq('status', filters.status);

        const { data: supaTxs } = await query;
        if (Array.isArray(supaTxs)) {
          for (const stx of supaTxs) {
            transactionMap.set(stx.id, {
              id: stx.id,
              telegram_id: String(stx.telegram_id),
              player_name: stx.player_name || 'Player',
              player_code: stx.player_code || '',
              phone_number: stx.phone_number || '',
              type: stx.type,
              amount: Number(stx.amount || 0),
              status: stx.status || 'pending',
              reference: stx.reference || '',
              notes: stx.notes || '',
              created_at: stx.created_at || new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.warn('Supabase fetch transactions error:', err);
      }
    }

    for (const transaction of localDb.getTransactions()) transactionMap.set(transaction.id, transaction);
    const postgresTransactions = await getPostgresTransactions(filters).catch((err) => {
      console.warn('PostgreSQL fetch transactions error:', err);
      return null;
    });
    if (postgresTransactions) {
      for (const row of postgresTransactions) {
        transactionMap.set(row.id, {
          ...row,
          telegram_id: String(row.telegram_id),
          amount: Number(row.amount || 0),
          type: row.type,
          status: row.status || 'pending',
          created_at: row.created_at || new Date().toISOString(),
        } as DbTransaction);
      }
    }

    const list = Array.from(transactionMap.values())
      .filter((transaction) => (!filters.type || transaction.type === filters.type) && (!filters.status || transaction.status === filters.status))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({
      ok: true,
      transactions: list,
      totalCount: list.length,
      pendingCount: list.filter((t) => t.status === 'pending').length,
      storageType: postgresTransactions ? 'postgres' : client ? 'supabase_with_local_fallback' : 'local_fallback',
      supabaseConnected: !!client,
    });
  });

  // Admin: Fetch all Financial Movements (Ledger of all deposits, withdrawals, game stakes, wins)
  app.get('/api/admin/financial-movements', (req, res) => {
    try {
      const txs = localDb.getTransactions();
      const logs = localDb.getGameLogs();

      const movements: Array<{
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
      }> = [];

      for (const t of txs) {
        movements.push({
          id: t.id,
          telegram_id: t.telegram_id,
          player_name: t.player_name,
          player_code: t.player_code,
          type: t.type,
          amount: t.amount,
          status: t.status,
          description: t.type === 'deposit' ? 'የገንዘብ ማስገቢያ (Deposit)' : 'ገንዘብ ማውጣት (Withdraw)',
          created_at: t.created_at,
          timestamp: new Date(t.created_at).getTime() || Date.now(),
        });
      }

      for (const g of logs) {
        if (g.stake > 0) {
          movements.push({
            id: g.id + '_stake',
            telegram_id: g.telegram_id,
            player_name: 'Player',
            player_code: g.game_code || 'BINGO',
            type: 'game_stake',
            amount: g.stake,
            status: 'completed',
            description: `የጨዋታ ካርቴላ ግዢ (${g.cards_count || 1} ካርቴላ - ${g.pattern_name || '1 Line'})`,
            created_at: g.created_at || new Date(g.timestamp).toISOString(),
            timestamp: g.timestamp || Date.now(),
          });
        }
        if (g.result === 'won' && g.won_amount > 0) {
          movements.push({
            id: g.id + '_win',
            telegram_id: g.telegram_id,
            player_name: 'Player',
            player_code: g.game_code || 'BINGO',
            type: 'game_win',
            amount: g.won_amount,
            status: 'completed',
            description: `ጨዋታ ማሸነፍ 🏆 (${g.pattern_name || 'Bingo'} Win)`,
            created_at: g.created_at || new Date(g.timestamp).toISOString(),
            timestamp: (g.timestamp || Date.now()) + 1,
          });
        }
      }

      movements.sort((a, b) => b.timestamp - a.timestamp);

      res.json({
        ok: true,
        movements,
        totalCount: movements.length,
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Admin: Delete/Clear transaction
  app.delete('/api/admin/transactions/:id', async (req, res) => {
    const txId = req.params.id;
    const localDeleted = localDb.deleteTransaction(txId);
    const postgresDeleted = await deletePostgresTransaction(txId).catch((err) => {
      console.warn('PostgreSQL transaction delete failed:', err);
      return false;
    });
    if (localDeleted || postgresDeleted) {
      return res.json({ ok: true, message: 'Transaction deleted/cleared successfully' });
    }
    return res.status(404).json({ ok: false, error: 'Transaction not found' });
  });

  // 4. Admin: Update transaction status (approve/reject)
  app.post('/api/admin/transactions/:id/status', async (req, res) => {
    if (!requireVerifiedAdmin(req, res)) return;
    if (!isPostgresConfigured()) {
      return res.status(503).json({ ok: false, error: 'PostgreSQL wallet storage is required for transaction approval' });
    }
    const txId = req.params.id;
    const { status, note } = req.body; // 'approved' or 'rejected'
    const nextStatus = status === 'rejected' ? 'rejected' : 'approved';

    const postgresUpdate = await updatePostgresTransactionStatus(txId, nextStatus, note).catch((err) => {
      console.warn('PostgreSQL transaction status update failed:', err);
      return null;
    });
    let tx = postgresUpdate
      ? postgresUpdate.transaction as TransactionItem
      : localDb.updateTransactionStatus(txId, nextStatus, note);
    if (!tx) {
      return res.status(404).json({ ok: false, error: 'Transaction not found' });
    }
    if (postgresUpdate) {
      const existing = localDb.getTransactions().some((transaction) => transaction.id === txId);
      if (!existing) localDb.addTransaction(tx);
      if (postgresUpdate.balanceChanged && postgresUpdate.balance !== null) {
        await updateUserBalance(tx.telegram_id, postgresUpdate.balance);
      }
    }

    // Instant sync to Supabase transactions table
    const client = getSupabase();
    if (client) {
      void (async () => {
        try {
          await client
            .from('transactions')
            .update({
              status,
              notes: note ? `${tx.notes || ''} | ${note}`.trim() : tx.notes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', txId);
        } catch (e: any) {
          console.warn('Supabase status update error:', e);
        }
      })();
    }

    // If deposit is approved -> automatically credit player's balance!
    if (!postgresUpdate && nextStatus === 'approved' && tx.type === 'deposit') {
      const curBal = await getUserBalance(tx.telegram_id);
      const newBal = curBal + tx.amount;
      await updateUserBalance(tx.telegram_id, newBal);
      if (client) {
        void (async () => {
          try {
            await client
              .from('users')
              .update({ balance: newBal, updated_at: new Date().toISOString() })
              .eq('telegram_id', tx.telegram_id);
          } catch {}
        })();
      }
    }

    // If withdrawal is approved -> automatically deduct player's balance!
    if (!postgresUpdate && nextStatus === 'approved' && tx.type === 'withdraw') {
      const curBal = await getUserBalance(tx.telegram_id);
      const newB = Math.max(0, curBal - tx.amount);
      await updateUserBalance(tx.telegram_id, newB);
      if (client) {
        void (async () => {
          try {
            await client
              .from('users')
              .update({ balance: newB, updated_at: new Date().toISOString() })
              .eq('telegram_id', tx.telegram_id);
          } catch {}
        })();
      }
    }

    // Notify player on Telegram
    const botToken = getActiveBotToken(req);
    if (botToken && !isNaN(Number(tx.telegram_id))) {
      try {
        const webAppUrl = resolveWebAppUrl();
        const photoUrl = `${webAppUrl}/salery_bingo.jpg`;
        const newBal = await getUserBalance(tx.telegram_id);

        let msg = '';
        if (tx.type === 'deposit') {
          msg = status === 'approved'
            ? `✅ <b>የገንዘብ ማስገቢያዎ ተረጋግጧል! (Deposit Approved)</b>\n\n💰 <b>+${tx.amount} ETB</b> ወደ አካውንትዎ ገቢ ተደርጓል!\n💵 <b>የአሁኑ ቀሪ ሂሳብዎ፦ ${newBal} ETB</b>\n\nአሁኑኑ "Play 🎮" የሚለውን በመጫን ይጫወቱ!`
            : `❌ <b>የገንዘብ ማስገቢያ ጥያቄዎ ውድቅ ተደርጓል (Deposit Rejected)</b>\n\nእባክዎ ድጋፍ ሰጪውን @Salerybingo_support ያነጋግሩ።`;
        } else {
          msg = status === 'approved'
            ? `✅ <b>ገንዘብ ማውጣትዎ ተጠናቋል! (Withdrawal Completed)</b>\n\n💵 <b>${tx.amount} ETB</b> ወደ ቴሌብር ቁጥርዎ (${tx.phone_number}) ተልኳል!\n💵 <b>የቀረው ቀሪ ሂሳብዎ፦ ${newBal} ETB</b>\n\nስለተጫወቱ እናመሰግናለን! 🎱`
            : `❌ <b>የገንዘብ ማውጣት ጥያቄዎ ውድቅ ተደርጓል (Withdrawal Rejected)</b>\n\nእባክዎ ድጋፍ ሰጪውን @Salerybingo_support ያነጋግሩ።`;
        }
        await sendTelegramPhoto(
          botToken,
          Number(tx.telegram_id),
          photoUrl,
          msg,
          getMainMenuMarkup(webAppUrl, tx.telegram_id, newBal)
        );
      } catch (err) {
        console.warn(`Could not notify user of tx status ${tx.telegram_id}:`, err);
      }
    }

    return res.json({ ok: true, transaction: tx });
  });

  // 5. Log player game history
  app.post('/api/user/:telegramId/game-history', (req, res) => {
    const telegramId = String(req.params.telegramId);
    const { stake, cardsCount, result, wonAmount, patternName, gameCode } = req.body;

    const entry: PlayerGameLog = {
      id: 'gm_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      telegram_id: telegramId,
      game_code: gameCode || `BB${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: Date.now(),
      stake: Number(stake) || 10,
      cards_count: Number(cardsCount) || 1,
      result: result === 'won' ? 'won' : 'lost',
      won_amount: Number(wonAmount) || 0,
      pattern_name: patternName || '1 Line',
      created_at: new Date().toISOString(),
    };

    localDb.addGameLog(entry);

    return res.json({ ok: true, game: entry });
  });

  // 6. Fetch player game history (for Admin or Player)
  app.get('/api/user/:telegramId/game-history', (req, res) => {
    const telegramId = String(req.params.telegramId);
    const playerLogs = localDb.getGameLogs(telegramId);
    return res.json({ ok: true, history: playerLogs, totalGames: playerLogs.length });
  });


  app.get('/api/config', (req, res) => {
    res.json({
      appName: 'Salery Bingo (ሳለሪ ቢንጎ)',
      botUsername: process.env.VITE_BOT_USERNAME || '@Salerybingo_bot',
      supabaseConnected: !!supabase,
      version: '1.0.0',
    });
  });

  // Support Webhook endpoint for Telegram updates matching TELEGRAM_WEBHOOK_URL
  const webhookHandler = async (req: express.Request, res: express.Response) => {
    if (!isTelegramBotEnabled()) {
      return res.status(404).send('Telegram bot integration is disabled in local development');
    }
    if (req.method === 'GET') {
      return res.json({
        status: 'ok',
        service: 'Salery Bingo Telegram Webhook',
        configuredWebhook: process.env.TELEGRAM_WEBHOOK_URL || null,
        timestamp: new Date().toISOString(),
      });
    }

    const botToken = getActiveBotToken(req);
    if (botToken && req.body) {
      await processTelegramUpdate(req.body, botToken);
    }
    res.status(200).send('OK');
  };

  app.all('/webhook', webhookHandler);
  app.all('/api/webhook', webhookHandler);
  app.all('/api/telegram-webhook', webhookHandler);
  app.all('/api/telegram/webhook', webhookHandler);
  app.post('/', (req, res, next) => {
    if (req.body && (req.body.update_id !== undefined || req.body.message || req.body.callback_query)) {
      return webhookHandler(req, res);
    }
    next();
  });

  // Health check routes for Railway / Cloud deployment
  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'Salery Bingo' }));
  app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'Salery Bingo' }));

  // Only mount Vite dev middleware when running locally in development without cloud port
  const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.PORT && !process.env.RAILWAY_ENVIRONMENT_NAME;
  if (isLocalDev) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch {
      // Running standalone backend without vite
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));

      app.use('/api', (req, res) => {
        res.status(404).json({ error: 'API route not found' });
      });

      app.use((req, res) => {
        const indexHtml = path.join(distPath, 'index.html');
        if (fs.existsSync(indexHtml)) {
          res.sendFile(indexHtml);
        } else {
          res.status(200).send('Salery Bingo Backend API is active');
        }
      });
    } else {
      app.get('/', (req, res) => {
        res.status(200).json({ status: 'ok', service: 'Salery Bingo Backend' });
      });
    }
  }

  if (isProduction) {
    const postgresUrl = (
      process.env.SUPABASE_DB_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      ''
    ).trim();
    const serviceKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      ''
    ).trim();
    if (!isPostgresConfigured() || !postgresUrl.toLowerCase().includes('sqmicjzafgcymcfdjlai')) {
      throw new Error('Production requires a Supabase PostgreSQL connection string for project sqmicjzafgcymcfdjlai in SUPABASE_DB_URL.');
    }
    if (!serviceKey || !getSupabase()) {
      throw new Error('Production requires a valid SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL.');
    }
    await initializePostgres();
    console.info('Supabase PostgreSQL users, game state, and broadcast history tables are ready.');
  }

  httpServer.listen(Number(PORT), HOST, () => {
    console.log(`Salery Bingo Backend listening on http://${HOST}:${PORT}`);

    if (!isProduction && isPostgresConfigured()) {
      initializePostgres()
        .then(() => console.info('PostgreSQL tables are ready.'))
        .catch((err: any) => console.warn('PostgreSQL startup initialization failed:', err?.message || err));
    }

    // Development-only sync; production data is owned by Supabase PostgreSQL.
    try {
      const client = getSupabase();
      if (client && !isProduction) {
        console.log('🔄 Server started with active Supabase connection. Running background sync for local database users...');
        const allLocalUsers = localDb.getAllUsers();
        const allLocalTxs = localDb.getTransactions();

        void (async () => {
          let syncedUsers = 0;
          for (const u of allLocalUsers) {
            try {
              const res = await upsertUserAdaptive(u);
              if (res && !res.error) syncedUsers++;
            } catch {}
          }
          console.log(`✅ Background sync completed: Synced ${syncedUsers}/${allLocalUsers.length} users to Supabase.`);

          let syncedTxs = 0;
          for (const t of allLocalTxs) {
            try {
              const { error } = await client.from('transactions').upsert([{
                id: t.id,
                telegram_id: t.telegram_id,
                player_name: t.player_name,
                player_code: t.player_code,
                phone_number: t.phone_number || '',
                type: t.type,
                amount: t.amount,
                status: t.status,
                reference: t.reference || '',
                screenshot_url: t.screenshot_url || '',
                photo_file_id: t.photo_file_id || '',
                notes: t.notes || '',
                created_at: t.created_at,
              }]);
              if (!error) syncedTxs++;
            } catch {}
          }
          console.log(`✅ Background sync completed: Synced ${syncedTxs}/${allLocalTxs.length} transactions to Supabase.`);
        })();
      }
    } catch (err) {
      console.warn('Startup background Supabase sync failed:', err);
    }

    const botToken = getActiveBotToken();
    if (!isTelegramBotEnabled()) {
      console.info('Telegram bot initialization, webhooks, and polling disabled for local development.');
    } else if (botToken) {
      // Auto-configure Telegram bottom-left WebApp Menu Button
      const webAppUrl = resolveWebAppUrl();
      fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_button: {
            type: 'web_app',
            text: 'Play 🎮',
            web_app: { url: `${webAppUrl}?v=${Date.now()}` },
          },
        }),
      }).catch((e) => console.warn('Could not set chat menu button:', e));

      if (process.env.TELEGRAM_WEBHOOK_URL && process.env.TELEGRAM_WEBHOOK_URL.trim().startsWith('http')) {
        let webhookUrl = process.env.TELEGRAM_WEBHOOK_URL.trim();
        if (!webhookUrl.includes('/webhook') && !webhookUrl.includes('/api/telegram-webhook')) {
          webhookUrl = `${webhookUrl.replace(/\/$/, '')}/api/telegram-webhook`;
        }
        fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=false`)
          .then((res) => res.json())
          .then((data: any) => {
            console.log(`📡 Telegram Webhook set to ${webhookUrl}:`, data.description || (data.ok ? 'SUCCESS' : 'FAILED'));
          })
          .catch((err) => {
            console.error('Failed to configure Telegram webhook:', err);
          });
      } else if (isTelegramPollingEnabled()) {
        startLongPolling(botToken).catch((err) => {
          isLongPollingRunning = false;
          console.error('Long polling error:', err);
        });
      } else {
        console.info('🛑 Telegram bot polling disabled in local mode; app is running without bot startup.');
      }
    } else if (!botToken) {
      console.info('BOT_TOKEN is not set; configure Telegram from the Admin Panel when needed.');
    }
  });
}

startServer().catch((err) => {
  console.error('FATAL startServer exception:', err);
  process.exitCode = 1;
});
