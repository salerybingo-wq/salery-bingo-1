// server.ts
import dotenv from "dotenv";
import fs2 from "fs";
import { createServer } from "node:http";
import { randomInt } from "node:crypto";
import express from "express";
import cors from "cors";
import { Server as SocketServer } from "socket.io";
import path2 from "path";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";

// server/db.ts
import fs from "fs";
import path from "path";
var DATA_DIR = path.join(process.cwd(), "data");
var DB_FILE = path.join(DATA_DIR, "salery_bingo_db.json");
var INITIAL_MEDIA = [
  {
    id: "med_bonus",
    url: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80",
    title: "\u12E8\u12D5\u1208\u1271 \u1266\u1290\u1235 \u12A5\u1293 \u1309\u122D\u123B (Daily Bonus)",
    category: "bonus",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "med_bingo",
    url: "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop&q=80",
    title: "\u12A0\u12F2\u1235 \u12E8\u1262\u1295\u130E \u12D9\u122D \u1300\u121D\u122F\u120D (Game Started)",
    category: "banner",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "med_winner",
    url: "https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=800&auto=format&fit=crop&q=80",
    title: "\u1273\u120B\u1245 \u12A0\u1238\u1293\u134A\u12CE\u127D (Big Jackpot Winner)",
    category: "winner",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "med_telebirr",
    url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80",
    title: "\u12E8\u1274\u120C\u1265\u122D \u12A5\u1293 \u1263\u1295\u12AD \u12F2\u1356\u12DA\u1275 (Telebirr & Bank)",
    category: "payment",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "med_gold_coins",
    url: "https://images.unsplash.com/photo-1618042164219-62c820f10723?w=800&auto=format&fit=crop&q=80",
    title: "\u12E8\u12C8\u122D\u1245 \u1233\u1295\u1272\u121E\u127D \u12A5\u1293 \u123D\u120D\u121B\u1276\u127D (Gold Coins)",
    category: "bonus",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "med_support",
    url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
    title: "\u12E8\u1233\u1208\u122A \u1262\u1295\u130E \u12A6\u134A\u1234\u120B\u12CA \u12F5\u130B\u134D (Official Support)",
    category: "support",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var INITIAL_BROADCASTS = [
  {
    id: "bc_init_1",
    message: "\u{1F305} \u12A5\u1295\u12F0\u121D\u1295 \u12A0\u12F0\u122B\u127D\u1201 \u12CD\u12F5 \u12E8\u1233\u1208\u122A \u1262\u1295\u130E \u1264\u1270\u1230\u1266\u127D!\n\n\u12E8\u12DB\u122C\u12CD \u12A0\u1235\u12F0\u1233\u127D \u12E8\u1262\u1295\u130E \u12D9\u122D \u1270\u12A8\u134D\u1277\u120D\u1362 \u12A0\u1201\u1291\u1291 \u1260\u1218\u130D\u1263\u1275 \u12AB\u122D\u1274\u120B \u12ED\u1241\u1228\u1321\u1293 \u12A5\u12F5\u120D\u12CE\u1295 \u12ED\u121E\u12AD\u1229! \u{1F3B1}\u{1F4B0}\n\n\u1218\u120D\u12AB\u121D \u12A5\u12F5\u120D \u1208\u1201\u120B\u127D\u1201\u121D! \u2728",
    photo_url: "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop&q=80",
    target: "all",
    sent_count: 32,
    created_at: new Date(Date.now() - 36e5 * 6).toISOString()
  },
  {
    id: "bc_init_2",
    message: "\u{1F525} \u120D\u12E9 \u12E8\u12D5\u1208\u1271 \u12E8\u12F2\u1356\u12DA\u1275 \u1309\u122D\u123B (Deposit Bonus) \u{1F525}\n\n\u12DB\u122C \u12A8 100 \u1265\u122D \u1260\u120B\u12ED \u12F2\u1356\u12DA\u1275 \u1208\u121A\u12EB\u12F0\u122D\u1309 \u1270\u132B\u12CB\u127E\u127D \u1260\u1219\u1209 \u1270\u1328\u121B\u122A 10% \u1266\u1290\u1235 \u12C8\u12F2\u12EB\u12CD\u1291 \u1308\u1262 \u12ED\u12F0\u1228\u130B\u120D!\n\n\u12A5\u12F5\u1209 \u12A5\u1295\u12F3\u12EB\u1218\u120D\u1325\u12CE \u12A0\u1201\u1291\u1291 \u12A0\u12AB\u12CD\u1295\u1275\u12CE\u1295 \u12ED\u1219\u1209\u1293 \u12ED\u132B\u12C8\u1271! \u{1F4B3}\u{1F680}",
    photo_url: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80",
    target: "all",
    sent_count: 45,
    created_at: new Date(Date.now() - 36e5 * 22).toISOString()
  }
];
var INITIAL_TRANSACTIONS = [];
var LocalSecureDatabase = class {
  constructor() {
    this.saveTimeout = null;
    this.persistedSignature = null;
    this.ensureDirectory();
    this.data = this.loadData();
    this.persistedSignature = this.getDataSignature(this.data);
    this.ensureDefaultAdmin();
  }
  getDataSignature(data) {
    const { updated_at, ...rest } = data;
    return JSON.stringify(rest);
  }
  ensureDirectory() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      console.error("Failed to create data directory:", e);
    }
  }
  loadData() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return {
            version: parsed.version || 1,
            security_mode: "local_isolated_secure",
            updated_at: parsed.updated_at || (/* @__PURE__ */ new Date()).toISOString(),
            users: parsed.users || {},
            transactions: Array.isArray(parsed.transactions) && parsed.transactions.length > 0 ? parsed.transactions : INITIAL_TRANSACTIONS,
            game_logs: Array.isArray(parsed.game_logs) ? parsed.game_logs : [],
            broadcasts: Array.isArray(parsed.broadcasts) ? parsed.broadcasts : INITIAL_BROADCASTS,
            media: Array.isArray(parsed.media) && parsed.media.length > 0 ? parsed.media : INITIAL_MEDIA,
            bot_config: parsed.bot_config || { bot_token: "", bot_username: "" },
            admin_revenue: Number(parsed.admin_revenue) || 0
          };
        }
      }
    } catch (err) {
      console.warn("Could not read existing DB file, creating fresh secure store:", err);
    }
    const defaultDb = {
      version: 1,
      security_mode: "local_isolated_secure",
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      users: {},
      transactions: INITIAL_TRANSACTIONS,
      game_logs: [],
      broadcasts: INITIAL_BROADCASTS,
      media: INITIAL_MEDIA,
      bot_config: {
        bot_token: process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "8938320220:AAHFhv8peXf9CEjGgPYBD8d-ipjRynj-nAQ",
        bot_username: "salerybingo_bot",
        web_app_url: process.env.APP_URL || process.env.FRONTEND_URL || "https://salery-bingo-1.vercel.app"
      },
      admin_revenue: 0
    };
    this.persistSync(defaultDb);
    return defaultDb;
  }
  persistSync(targetData = this.data) {
    try {
      const signature = this.getDataSignature(targetData);
      if (this.persistedSignature === signature) return;
      this.ensureDirectory();
      targetData.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      const serialized = JSON.stringify(targetData, null, 2);
      const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, serialized, "utf8");
      fs.renameSync(tempPath, DB_FILE);
      this.persistedSignature = this.getDataSignature(targetData);
    } catch (err) {
      console.error("Failed to persist database synchronously:", err);
    }
  }
  scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.persistSync();
      this.saveTimeout = null;
    }, 150);
  }
  ensureDefaultAdmin() {
    const adminId = "908336796";
    if (!this.data.users[adminId]) {
      this.data.users[adminId] = {
        id: 1,
        telegram_id: adminId,
        player_code: "SB-90833",
        first_name: "Admin",
        full_name: "\u1233\u1208\u122A \u12A0\u12F5\u121A\u1295 (Admin)",
        username: "salery_admin",
        phone_number: "+251911000000",
        balance: 0,
        role: "admin",
        status: "active",
        is_blocked: false,
        is_verified: true,
        referral_count: 0,
        total_deposited: 0,
        total_withdrawn: 0,
        games_played: 15,
        games_won: 8,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const initialPlayers = [
      {
        id: 102,
        telegram_id: "5873620165",
        player_code: "SB-62805",
        first_name: "Jo_cr7",
        full_name: "Jo_cr7 (@jo_cr7)",
        username: "jo_cr7",
        phone_number: "+251908336796",
        balance: 0,
        role: "user",
        status: "active",
        is_blocked: false,
        is_verified: true,
        total_deposited: 346,
        total_withdrawn: 0,
        games_played: 1,
        games_won: 0,
        created_at: "2026-09-25T21:38:00.000Z",
        updated_at: "2026-09-25T21:38:00.000Z"
      }
    ];
    const fakeIds = ["554192831", "666120888", "778901234", "889012345", "990123456", "806558124", "712394012", "698301921", "541209381", "498102931", "389102931"];
    for (const fId of fakeIds) {
      delete this.data.users[fId];
    }
    for (const p of initialPlayers) {
      if (!this.data.users[p.telegram_id]) {
        this.data.users[p.telegram_id] = {
          id: p.id || Date.now(),
          telegram_id: p.telegram_id,
          player_code: p.player_code || `SB-${Math.floor(1e4 + Math.random() * 9e4)}`,
          first_name: p.first_name || "Player",
          full_name: p.full_name || p.first_name || "Player",
          username: p.username || "",
          phone_number: p.phone_number || "",
          balance: p.balance ?? 0,
          role: "user",
          status: "active",
          is_blocked: false,
          is_verified: !!p.is_verified,
          referral_count: 0,
          total_deposited: p.total_deposited || 0,
          total_withdrawn: p.total_withdrawn || 0,
          games_played: p.games_played || 0,
          games_won: p.games_won || 0,
          created_at: p.created_at || (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: p.updated_at || (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    }
    this.persistSync();
  }
  // --- Users Operations ---
  getUser(telegramId) {
    const key = String(telegramId);
    const user = this.data.users[key];
    if (!user) return null;
    return user;
  }
  getAllUsers() {
    return Object.values(this.data.users).sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }
  upsertUser(user) {
    const key = String(user.telegram_id);
    const existing = this.data.users[key];
    if (existing) {
      const updated = {
        ...existing,
        ...user,
        balance: user.balance !== void 0 ? user.balance : user.main_wallet !== void 0 ? user.main_wallet : existing.balance,
        main_wallet: user.main_wallet !== void 0 ? user.main_wallet : existing.main_wallet ?? existing.balance,
        play_wallet: user.play_wallet !== void 0 ? user.play_wallet : existing.play_wallet ?? 0,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.data.users[key] = updated;
      this.scheduleSave();
      return updated;
    } else {
      const initialMain = user.main_wallet !== void 0 ? user.main_wallet : user.balance !== void 0 ? user.balance : 0;
      const initialPlay = user.play_wallet !== void 0 ? user.play_wallet : 0;
      const newUser = {
        id: Date.now(),
        telegram_id: key,
        player_code: user.player_code || `SB-${Math.floor(1e4 + Math.random() * 9e4)}`,
        first_name: user.first_name || "Player",
        full_name: user.full_name || user.first_name || "Player",
        username: user.username || "",
        phone_number: user.phone_number || "",
        balance: initialMain,
        main_wallet: initialMain,
        play_wallet: initialPlay,
        role: user.role || "user",
        status: user.status || "active",
        is_blocked: !!user.is_blocked,
        ban_reason: user.ban_reason,
        is_verified: !!user.is_verified || !!user.phone_number,
        referred_by: user.referred_by,
        referral_count: 0,
        total_deposited: 0,
        total_withdrawn: 0,
        games_played: 0,
        games_won: 0,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.data.users[key] = newUser;
      this.scheduleSave();
      return newUser;
    }
  }
  updateUserWallets(telegramId, mainWallet, playWallet) {
    const key = String(telegramId);
    const user = this.data.users[key];
    if (user) {
      user.main_wallet = Math.max(0, Math.floor(mainWallet));
      user.play_wallet = Math.max(0, Math.floor(playWallet));
      user.balance = user.main_wallet;
      user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      this.scheduleSave();
      return true;
    }
    return false;
  }
  updateUserBalance(telegramId, newBalance, _options) {
    const key = String(telegramId);
    const user = this.data.users[key];
    if (user) {
      user.balance = Math.max(0, Math.floor(newBalance));
      user.main_wallet = user.balance;
      user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      this.scheduleSave();
      return true;
    }
    return false;
  }
  updateUserPhone(telegramId, phone) {
    const key = String(telegramId);
    let user = this.data.users[key];
    if (user) {
      user.phone_number = phone;
      user.is_verified = true;
      user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    } else {
      user = this.upsertUser({
        telegram_id: key,
        phone_number: phone,
        is_verified: true
      });
    }
    this.persistSync();
    return true;
  }
  setUserStatus(telegramId, status, reason) {
    const key = String(telegramId);
    const user = this.data.users[key];
    if (user) {
      user.status = status;
      user.is_blocked = status === "blocked";
      user.ban_reason = status === "blocked" ? reason || "\u12E8\u12A0\u1308\u120D\u130D\u120E\u1275 \u12F0\u1295\u1265 \u1218\u1323\u1235" : void 0;
      user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      this.scheduleSave();
      return true;
    }
    return false;
  }
  // --- Transactions Operations ---
  getTransactions(filter) {
    let list = [...this.data.transactions];
    if (filter?.type) {
      list = list.filter((t) => t.type === filter.type);
    }
    if (filter?.status) {
      list = list.filter((t) => t.status === filter.status);
    }
    return list;
  }
  addTransaction(tx) {
    this.data.transactions.unshift(tx);
    if (this.data.transactions.length > 2e3) {
      this.data.transactions.pop();
    }
    this.scheduleSave();
    return tx;
  }
  updateTransactionStatus(id, status, note) {
    const tx = this.data.transactions.find((t) => t.id === id);
    if (tx) {
      tx.status = status;
      if (note) tx.notes = note;
      this.scheduleSave();
      return tx;
    }
    return null;
  }
  deleteTransaction(id) {
    const idx = this.data.transactions.findIndex((t) => t.id === id);
    if (idx !== -1) {
      this.data.transactions.splice(idx, 1);
      this.scheduleSave();
      return true;
    }
    return false;
  }
  // --- Game Logs ---
  getGameLogs(telegramId) {
    if (telegramId) {
      return this.data.game_logs.filter((g) => g.telegram_id === telegramId);
    }
    return this.data.game_logs;
  }
  addGameLog(log) {
    this.data.game_logs.unshift(log);
    if (this.data.game_logs.length > 1e3) {
      this.data.game_logs.pop();
    }
    const stake = Number(log.stake) || 10;
    const cardsCount = Number(log.cards_count) || 1;
    const totalStake = stake * cardsCount;
    const commission = totalStake * 0.2;
    this.data.admin_revenue = (this.data.admin_revenue || 0) + commission;
    const user = this.data.users[log.telegram_id];
    if (user) {
      user.games_played = (user.games_played || 0) + 1;
      if (log.result === "won") {
        user.games_won = (user.games_won || 0) + 1;
      }
    }
    this.scheduleSave();
    return log;
  }
  // --- Broadcasts ---
  getBroadcasts() {
    return this.data.broadcasts;
  }
  addBroadcast(bc) {
    this.data.broadcasts.unshift(bc);
    if (this.data.broadcasts.length > 200) {
      this.data.broadcasts.pop();
    }
    this.scheduleSave();
    return bc;
  }
  // --- Media ---
  getMedia() {
    return this.data.media;
  }
  addMedia(item) {
    this.data.media.unshift(item);
    if (this.data.media.length > 200) {
      this.data.media.pop();
    }
    this.scheduleSave();
    return item;
  }
  // --- Bot Config ---
  getBotConfig() {
    return this.data.bot_config || { bot_token: "", bot_username: "" };
  }
  saveBotConfig(token, username, webAppUrl) {
    this.data.bot_config = {
      bot_token: token.trim(),
      bot_username: username.replace("@", "").trim(),
      web_app_url: webAppUrl ? webAppUrl.trim() : this.data.bot_config?.web_app_url || "https://salery-bingo-1.vercel.app",
      configured_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.persistSync();
  }
  // --- Supabase Config ---
  getSupabaseConfig() {
    return this.data.supabase_config || { url: "", key: "" };
  }
  saveSupabaseConfig(url, key) {
    this.data.supabase_config = {
      url: url.trim(),
      key: key.trim(),
      is_connected: true,
      configured_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.persistSync();
  }
  // --- Backup & Restore ---
  exportBackup() {
    return JSON.stringify(this.data, null, 2);
  }
  importBackup(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === "object" && parsed.users) {
        this.data = {
          version: parsed.version || 1,
          security_mode: "local_isolated_secure",
          updated_at: (/* @__PURE__ */ new Date()).toISOString(),
          users: parsed.users || {},
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
          game_logs: Array.isArray(parsed.game_logs) ? parsed.game_logs : [],
          broadcasts: Array.isArray(parsed.broadcasts) ? parsed.broadcasts : INITIAL_BROADCASTS,
          media: Array.isArray(parsed.media) ? parsed.media : INITIAL_MEDIA,
          bot_config: parsed.bot_config || this.data.bot_config
        };
        this.persistSync();
        return true;
      }
    } catch (err) {
      console.error("Failed to import backup:", err);
    }
    return false;
  }
  getStatus() {
    const users = Object.values(this.data.users);
    const totalBalance = users.reduce((sum, u) => sum + (u.balance || 0), 0);
    const activeUsers = users.filter((u) => u.status !== "blocked").length;
    return {
      ok: true,
      storageType: "local_isolated_secure",
      isSecure: true,
      description: "100% \u122B\u1231\u1295 \u12E8\u127B\u1208 \u12E8\u1270\u1320\u1260\u1240 \u1230\u122D\u1268\u122D \u12F3\u1273\u1264\u12DD (Zero Third-Party Dependency - Supabase \u12A0\u12EB\u1235\u1348\u120D\u1308\u12CD\u121D)",
      totalUsers: users.length,
      activeUsers,
      blockedUsers: users.length - activeUsers,
      totalBalance,
      admin_revenue: this.data.admin_revenue || 0,
      totalTransactions: this.data.transactions.length,
      pendingTransactions: this.data.transactions.filter((t) => t.status === "pending").length,
      lastUpdated: this.data.updated_at
    };
  }
};
var localDb = new LocalSecureDatabase();

// server/guestAuth.ts
import { createHmac, timingSafeEqual } from "node:crypto";
var LOCAL_TEST_BALANCE = 50;
function minimumLocalTestBalance(...balances) {
  const validBalances = balances.map(Number).filter((balance) => Number.isFinite(balance) && balance >= 0);
  return Math.max(LOCAL_TEST_BALANCE, ...validBalances);
}
function getGuestSecret() {
  const configuredSecret = process.env.BINGO_GUEST_SECRET || process.env.BOT_TOKEN || "";
  if (configuredSecret.length >= 32) return configuredSecret;
  if (process.env.NODE_ENV !== "production") return "local-bingo-guest-secret-change-before-deploy";
  return "";
}
function signBingoGuestToken(playerId) {
  const secret = getGuestSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(`bingo-guest:${playerId}`).digest("hex");
}
function isValidBingoGuestToken(playerId, token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) return false;
  const expected = signBingoGuestToken(playerId);
  if (!expected) return false;
  const providedBytes = Buffer.from(token, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

// server/bingo.ts
import { createHmac as createHmac2, timingSafeEqual as timingSafeEqual2 } from "node:crypto";

// src/utils/bingoLogic.ts
var BINGO_LETTERS = ["B", "I", "N", "G", "O"];
function getLetterForNumber(num) {
  if (num <= 15) return "B";
  if (num <= 30) return "I";
  if (num <= 45) return "N";
  if (num <= 60) return "G";
  return "O";
}
function getSeededDistinctNumbers(seed, min, max, count) {
  const pool2 = [];
  for (let i = min; i <= max; i++) {
    pool2.push(i);
  }
  let currentSeed = (seed * 9301 + 49297) % 233280;
  const rnd = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
  for (let i = pool2.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool2[i], pool2[j]] = [pool2[j], pool2[i]];
  }
  return pool2.slice(0, count);
}
function generateCartelaByNumber(cartelaNumber) {
  const bNums = getSeededDistinctNumbers(cartelaNumber * 7 + 1, 1, 15, 5);
  const iNums = getSeededDistinctNumbers(cartelaNumber * 13 + 3, 16, 30, 5);
  const nNums = getSeededDistinctNumbers(cartelaNumber * 19 + 5, 31, 45, 4);
  const gNums = getSeededDistinctNumbers(cartelaNumber * 23 + 7, 46, 60, 5);
  const oNums = getSeededDistinctNumbers(cartelaNumber * 29 + 11, 61, 75, 5);
  const cells = [];
  for (let row = 0; row < 5; row++) {
    const rowCells = [];
    for (let col = 0; col < 5; col++) {
      const letter = BINGO_LETTERS[col];
      const isFree = row === 2 && col === 2;
      let num = 0;
      if (!isFree) {
        if (col === 0) num = bNums[row];
        else if (col === 1) num = iNums[row];
        else if (col === 2) {
          num = row < 2 ? nNums[row] : nNums[row - 1];
        } else if (col === 3) num = gNums[row];
        else if (col === 4) num = oNums[row];
      }
      rowCells.push({
        row,
        col,
        number: num,
        letter,
        isFree,
        isDaubed: isFree,
        isWinningCell: false
      });
    }
    cells.push(rowCells);
  }
  return {
    id: `cartel-${cartelaNumber}`,
    cardIndex: cartelaNumber,
    cells,
    hasWon: false,
    numbersNeeded: 4
  };
}
function generateShuffledDeck() {
  const deck = [];
  for (let num = 1; num <= 75; num++) {
    deck.push({
      number: num,
      letter: getLetterForNumber(num),
      id: `ball-${num}`
    });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function checkCardWinningPatterns(card, lang = "am") {
  const cells = card.cells;
  let isFullHouse = true;
  const fullCoords = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      fullCoords.push({ row: r, col: c });
      if (!cells[r][c].isDaubed) {
        isFullHouse = false;
      }
    }
  }
  if (isFullHouse) {
    return {
      hasWon: true,
      patternType: "fullHouse",
      patternName: lang === "am" ? "\u1219\u1209 \u12AB\u122D\u12F5 (Full House)" : lang === "om" ? "Mana Guutuu (Full House)" : "Full House (Blackout)",
      winningCoordinates: fullCoords,
      multiplier: 3.5
    };
  }
  for (let r = 0; r < 5; r++) {
    let rowComplete = true;
    const rowCoords = [];
    for (let c = 0; c < 5; c++) {
      rowCoords.push({ row: r, col: c });
      if (!cells[r][c].isDaubed) {
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) {
      return {
        hasWon: true,
        patternType: "line",
        patternName: lang === "am" ? `\u12A0\u130D\u12F5\u121D \u1228\u12F5\u134D ${r + 1} (Row ${r + 1})` : lang === "om" ? `Sarara Dalgee ${r + 1}` : `Horizontal Line (Row ${r + 1})`,
        winningCoordinates: rowCoords,
        multiplier: 1.8
      };
    }
  }
  for (let c = 0; c < 5; c++) {
    let colComplete = true;
    const colCoords = [];
    for (let r = 0; r < 5; r++) {
      colCoords.push({ row: r, col: c });
      if (!cells[r][c].isDaubed) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) {
      return {
        hasWon: true,
        patternType: "line",
        patternName: lang === "am" ? `\u1241\u120D\u1241\u120D \u1228\u12F5\u134D '${BINGO_LETTERS[c]}' (Column ${BINGO_LETTERS[c]})` : lang === "om" ? `Sarara Ol-Gadii '${BINGO_LETTERS[c]}'` : `Vertical Column (${BINGO_LETTERS[c]})`,
        winningCoordinates: colCoords,
        multiplier: 1.8
      };
    }
  }
  let diag1Complete = true;
  const diag1Coords = [];
  for (let i = 0; i < 5; i++) {
    diag1Coords.push({ row: i, col: i });
    if (!cells[i][i].isDaubed) {
      diag1Complete = false;
      break;
    }
  }
  if (diag1Complete) {
    return {
      hasWon: true,
      patternType: "line",
      patternName: lang === "am" ? "\u12F2\u12EB\u130E\u1293\u120D \u1218\u1235\u1218\u122D \u2198 (Diagonal)" : lang === "om" ? "Sarara Qaxxaamuraa \u2198" : "Diagonal Line (Top-Left to Bottom-Right)",
      winningCoordinates: diag1Coords,
      multiplier: 2
    };
  }
  let diag2Complete = true;
  const diag2Coords = [];
  for (let i = 0; i < 5; i++) {
    diag2Coords.push({ row: i, col: 4 - i });
    if (!cells[i][4 - i].isDaubed) {
      diag2Complete = false;
      break;
    }
  }
  if (diag2Complete) {
    return {
      hasWon: true,
      patternType: "line",
      patternName: lang === "am" ? "\u12F2\u12EB\u130E\u1293\u120D \u1218\u1235\u1218\u122D \u2197 (Diagonal)" : lang === "om" ? "Sarara Qaxxaamuraa \u2197" : "Diagonal Line (Top-Right to Bottom-Left)",
      winningCoordinates: diag2Coords,
      multiplier: 2
    };
  }
  const cornerCoords = [
    { row: 0, col: 0 },
    { row: 0, col: 4 },
    { row: 4, col: 0 },
    { row: 4, col: 4 }
  ];
  const cornersComplete = cornerCoords.every((coord) => cells[coord.row][coord.col].isDaubed);
  if (cornersComplete) {
    return {
      hasWon: true,
      patternType: "corners",
      patternName: lang === "am" ? "\u12A0\u122B\u1275 \u121B\u12D5\u12D8\u1293\u1275 (4 Corners)" : lang === "om" ? "Kofa 4 (4 Corners)" : "4 Corners",
      winningCoordinates: cornerCoords,
      multiplier: 2.2
    };
  }
  return {
    hasWon: false,
    patternName: "",
    winningCoordinates: [],
    multiplier: 1
  };
}

// server/postgres.ts
import { Pool } from "pg";
var pool;
var schemaReady = null;
var schemaSql = `
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
function getPool() {
  if (pool !== void 0) return pool;
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";
  pool = connectionString ? new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 5e3,
    idleTimeoutMillis: 1e4,
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false }
  }) : null;
  return pool;
}
function isPostgresConfigured() {
  return !!getPool();
}
async function initializePostgres() {
  const client = getPool();
  if (!client) return false;
  await ensureSchema(client);
  return true;
}
async function savePostgresBroadcast(broadcast) {
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
async function getPostgresBroadcasts(limit = 200) {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query(
    "SELECT id, message, photo_url, target, sent_count, created_at FROM public.bingo_broadcasts ORDER BY created_at DESC LIMIT $1",
    [Math.max(1, Math.min(500, Math.floor(limit)))]
  );
  return result.rows;
}
async function ensureSchema(client) {
  if (!schemaReady) {
    schemaReady = client.query(schemaSql).then(() => void 0).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}
async function getPostgresUser(telegramId) {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query("SELECT * FROM public.users WHERE telegram_id = $1 LIMIT 1", [String(telegramId)]);
  return result.rows[0] || null;
}
async function getPostgresUsers() {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query("SELECT * FROM public.users ORDER BY created_at DESC");
  return result.rows;
}
async function upsertPostgresUser(user) {
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
      String(user.telegram_id),
      user.player_code || "",
      user.first_name || "",
      user.full_name || "",
      user.username || "",
      user.phone_number || "",
      Number(user.main_wallet ?? user.balance ?? 0),
      Number(user.main_wallet ?? user.balance ?? 0),
      Number(user.play_wallet ?? 0),
      user.role || "user",
      user.status || "active",
      user.is_blocked ?? false,
      user.ban_reason || null,
      user.is_verified ?? false,
      user.referred_by || null
    ]
  );
  return result.rows[0] || null;
}
async function setPostgresUserBalance(telegramId, balance) {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query(
    "UPDATE public.users SET balance = $2, main_wallet = $2, updated_at = NOW() WHERE telegram_id = $1 RETURNING balance",
    [String(telegramId), Math.max(0, balance)]
  );
  return result.rows[0] ? Number(result.rows[0].balance) : null;
}
async function setPostgresUserWallets(telegramId, mainWallet, playWallet) {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query(
    "UPDATE public.users SET balance = $2, main_wallet = $2, play_wallet = $3, updated_at = NOW() WHERE telegram_id = $1 RETURNING balance, main_wallet, play_wallet",
    [String(telegramId), Math.max(0, Math.floor(mainWallet)), Math.max(0, Math.floor(playWallet))]
  );
  if (!result.rows[0]) return null;
  return {
    balance: Number(result.rows[0].balance),
    mainWallet: Number(result.rows[0].main_wallet),
    playWallet: Number(result.rows[0].play_wallet)
  };
}
async function getPostgresBingoRoom(roomId) {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query("SELECT state FROM public.bingo_rooms WHERE room_id = $1", [roomId]);
  return result.rows[0]?.state || null;
}
async function joinPostgresBingoRoom(input) {
  const poolClient = getPool();
  if (!poolClient) return null;
  await ensureSchema(poolClient);
  const client = await poolClient.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO public.bingo_rooms (room_id, state) VALUES ($1, $2::jsonb) ON CONFLICT (room_id) DO NOTHING",
      [input.roomId, JSON.stringify(input.initialState)]
    );
    const roomResult = await client.query("SELECT state FROM public.bingo_rooms WHERE room_id = $1 FOR UPDATE", [input.roomId]);
    let state = roomResult.rows[0]?.state;
    if (!state) throw new Error("Room unavailable");
    if (state.status === "finished") {
      const previousPlayer = state.players.find((player) => player.telegramId === input.telegramId);
      if (previousPlayer?.joinRequestId === input.joinRequestId) {
        const userResult = await client.query("SELECT balance, main_wallet, play_wallet FROM public.users WHERE telegram_id = $1", [input.telegramId]);
        if (!userResult.rows[0]) throw new Error("Wallet unavailable");
        await client.query("COMMIT");
        return {
          state,
          balance: Number(userResult.rows[0].main_wallet ?? userResult.rows[0].balance),
          mainWallet: Number(userResult.rows[0].main_wallet ?? userResult.rows[0].balance),
          playWallet: Number(userResult.rows[0].play_wallet ?? 0),
          duplicate: true
        };
      }
      state = input.initialState;
    }
    if (state.status === "waiting" && state.players.length === 0 && state.stake !== input.stake) {
      state = input.initialState;
    }
    const existingPlayer = state.players.find((player) => player.telegramId === input.telegramId);
    if (existingPlayer) {
      const userResult = await client.query("SELECT balance, main_wallet, play_wallet FROM public.users WHERE telegram_id = $1", [input.telegramId]);
      if (!userResult.rows[0]) throw new Error("Wallet unavailable");
      await client.query("COMMIT");
      return {
        state,
        balance: Number(userResult.rows[0].main_wallet ?? userResult.rows[0].balance),
        mainWallet: Number(userResult.rows[0].main_wallet ?? userResult.rows[0].balance),
        playWallet: Number(userResult.rows[0].play_wallet ?? 0),
        duplicate: true
      };
    }
    if (state.status === "in_progress") {
      const userResult = await client.query(
        "SELECT balance, main_wallet, play_wallet FROM public.users WHERE telegram_id = $1",
        [input.telegramId]
      );
      await client.query("COMMIT");
      const account = userResult.rows[0];
      return {
        state,
        balance: Number(account?.main_wallet ?? account?.balance ?? 0),
        mainWallet: Number(account?.main_wallet ?? account?.balance ?? 0),
        playWallet: Number(account?.play_wallet ?? 0),
        duplicate: false,
        spectator: true
      };
    }
    if (state.status !== "waiting") {
      throw new Error("This game has already started");
    }
    const reserved = new Set(state.players.flatMap((player) => player.cardIds));
    if (input.cardIds.some((cardId) => reserved.has(cardId))) throw new Error("A selected card was just taken");
    const cost = input.stake * input.cardIds.length;
    const walletColumn = input.walletType === "play_wallet" ? "play_wallet" : "main_wallet";
    const walletFallback = input.walletType === "play_wallet" ? "0" : "balance";
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
    if (!wallet.rows[0]) throw new Error("Insufficient balance or account unavailable");
    state.players.push({
      telegramId: input.telegramId,
      name: input.name,
      cardIds: input.cardIds,
      stake: cost,
      walletType: input.walletType,
      joinRequestId: input.joinRequestId
    });
    const commission = input.walletType === "main_wallet" ? Math.floor(cost * 0.2) : 0;
    state.prizePool += cost;
    await client.query(
      "INSERT INTO public.bingo_wallet_ledger (idempotency_key, telegram_id, game_id, kind, wallet_type, amount) VALUES ($1, $2, $3, 'stake', $4, $5)",
      [`stake:${state.gameId}:${input.telegramId}`, input.telegramId, state.gameId, input.walletType, cost]
    );
    if (commission > 0) {
      await client.query(
        "INSERT INTO public.bingo_platform_commission_ledger (idempotency_key, telegram_id, game_id, amount) VALUES ($1, $2, $3, $4)",
        [`commission:${state.gameId}:${input.telegramId}`, input.telegramId, state.gameId, commission]
      );
    }
    await client.query(
      "INSERT INTO public.bingo_rooms (room_id, state, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (room_id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()",
      [input.roomId, JSON.stringify(state)]
    );
    await client.query("COMMIT");
    return {
      state,
      balance: Number(wallet.rows[0].main_wallet ?? wallet.rows[0].balance),
      mainWallet: Number(wallet.rows[0].main_wallet ?? wallet.rows[0].balance),
      playWallet: Number(wallet.rows[0].play_wallet ?? 0),
      duplicate: false
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => void 0);
    throw error;
  } finally {
    client.release();
  }
}
async function mutatePostgresBingoRoom(roomId, mutate) {
  const poolClient = getPool();
  if (!poolClient) return null;
  await ensureSchema(poolClient);
  const client = await poolClient.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT state FROM public.bingo_rooms WHERE room_id = $1 FOR UPDATE", [roomId]);
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    const nextState = mutate(result.rows[0].state);
    await client.query("UPDATE public.bingo_rooms SET state = $2::jsonb, updated_at = NOW() WHERE room_id = $1", [roomId, JSON.stringify(nextState)]);
    await client.query("COMMIT");
    return nextState;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => void 0);
    throw error;
  } finally {
    client.release();
  }
}
async function awardPostgresBingoPrize(roomId, telegramId, cardId, prize) {
  const poolClient = getPool();
  if (!poolClient) return null;
  await ensureSchema(poolClient);
  const client = await poolClient.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query("SELECT state FROM public.bingo_rooms WHERE room_id = $1 FOR UPDATE", [roomId]);
    const state = roomResult.rows[0]?.state;
    const player = state?.players.find((entry) => entry.telegramId === telegramId && entry.cardIds.includes(cardId));
    const finalDrawClaim = state?.status === "finished" && !state.winnerId && state.called.length === 75;
    if (!state || state.status !== "in_progress" && !finalDrawClaim || !player || prize < 0 || prize > state.prizePool) {
      await client.query("ROLLBACK");
      return null;
    }
    const wallet = await client.query(
      "UPDATE public.users SET main_wallet = COALESCE(main_wallet, balance, 0) + $2, balance = COALESCE(main_wallet, balance, 0) + $2, updated_at = NOW() WHERE telegram_id = $1 RETURNING balance, main_wallet, play_wallet",
      [telegramId, prize]
    );
    if (!wallet.rows[0]) throw new Error("Winner wallet unavailable");
    await client.query(
      "INSERT INTO public.bingo_wallet_ledger (idempotency_key, telegram_id, game_id, kind, wallet_type, amount) VALUES ($1, $2, $3, 'prize', 'main_wallet', $4)",
      [`prize:${state.gameId}`, telegramId, state.gameId, prize]
    );
    const finished = {
      ...state,
      status: "finished",
      winnerId: telegramId,
      winningCardId: cardId,
      prize
    };
    await client.query("UPDATE public.bingo_rooms SET state = $2::jsonb, updated_at = NOW() WHERE room_id = $1", [roomId, JSON.stringify(finished)]);
    await client.query("COMMIT");
    return {
      state: finished,
      balance: Number(wallet.rows[0].main_wallet ?? wallet.rows[0].balance),
      mainWallet: Number(wallet.rows[0].main_wallet ?? wallet.rows[0].balance),
      playWallet: Number(wallet.rows[0].play_wallet ?? 0)
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => void 0);
    throw error;
  } finally {
    client.release();
  }
}
async function setPostgresUserStatus(telegramId, status, reason) {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query(
    `UPDATE public.users
     SET status = $2, is_blocked = $3, ban_reason = $4, updated_at = NOW()
     WHERE telegram_id = $1`,
    [String(telegramId), status, status === "blocked", status === "blocked" ? reason || "Terms violation" : null]
  );
  return (result.rowCount || 0) > 0;
}
async function savePostgresTransaction(transaction) {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const connection = await client.connect();
  try {
    await connection.query("BEGIN");
    const result = await connection.query(
      `INSERT INTO public.transactions (
        id, telegram_id, player_name, player_code, phone_number, type, amount, status,
        reference, screenshot_url, photo_file_id, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, NOW()), NOW())
      ON CONFLICT (id) DO NOTHING
      RETURNING *`,
      [
        transaction.id,
        String(transaction.telegram_id),
        transaction.player_name,
        transaction.player_code,
        transaction.phone_number || "",
        transaction.type,
        Number(transaction.amount),
        transaction.status,
        transaction.reference || "",
        transaction.screenshot_url || "",
        transaction.photo_file_id || "",
        transaction.notes || "",
        transaction.created_at || null
      ]
    );
    const table = transaction.type === "deposit" ? "deposits" : "withdrawals";
    await connection.query(
      `INSERT INTO public.${table} (
        id, telegram_id, player_name, player_code, phone_number, amount, status, reference,
        ${transaction.type === "deposit" ? "screenshot_url, photo_file_id, " : ""}notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        ${transaction.type === "deposit" ? "$9, $10, " : ""}$11, COALESCE($12::timestamptz, NOW()), NOW()
      ) ON CONFLICT (id) DO NOTHING`,
      transaction.type === "deposit" ? [transaction.id, String(transaction.telegram_id), transaction.player_name, transaction.player_code, transaction.phone_number || "", Number(transaction.amount), transaction.status, transaction.reference || "", transaction.screenshot_url || "", transaction.photo_file_id || "", transaction.notes || "", transaction.created_at || null] : [transaction.id, String(transaction.telegram_id), transaction.player_name, transaction.player_code, transaction.phone_number || "", Number(transaction.amount), transaction.status, transaction.reference || "", transaction.notes || "", transaction.created_at || null]
    );
    const stored = result.rows[0] || (await connection.query("SELECT * FROM public.transactions WHERE id = $1", [transaction.id])).rows[0];
    await connection.query("COMMIT");
    return stored || null;
  } catch (error) {
    await connection.query("ROLLBACK").catch(() => void 0);
    throw error;
  } finally {
    connection.release();
  }
}
async function getPostgresTransactions(filters) {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const conditions = [];
  const values = [];
  if (filters?.type === "deposit" || filters?.type === "withdraw") {
    values.push(filters.type);
    conditions.push(`type = $${values.length}`);
  }
  if (filters?.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await client.query(`SELECT * FROM public.transactions ${where} ORDER BY created_at DESC`, values);
  return result.rows;
}
async function updatePostgresTransactionStatus(id, status, note) {
  const poolClient = getPool();
  if (!poolClient) return null;
  await ensureSchema(poolClient);
  const client = await poolClient.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT * FROM public.transactions WHERE id = $1 FOR UPDATE", [id]);
    const transaction = found.rows[0];
    if (!transaction) {
      await client.query("ROLLBACK");
      return null;
    }
    const balanceChanged = status === "approved" && transaction.status !== "approved";
    let balance = null;
    if (balanceChanged) {
      const delta = transaction.type === "deposit" ? Number(transaction.amount) : -Number(transaction.amount);
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
      const user = await client.query("SELECT balance, main_wallet, play_wallet FROM public.users WHERE telegram_id = $1", [String(transaction.telegram_id)]);
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
    const table = transaction.type === "deposit" ? "deposits" : "withdrawals";
    await client.query(
      `UPDATE public.${table}
       SET status = $2, notes = CASE WHEN $3::text IS NULL OR $3 = '' THEN notes ELSE CONCAT_WS(' ', NULLIF(notes, ''), $3) END,
           updated_at = NOW()
       WHERE id = $1`,
      [id, status, note || null]
    );
    await client.query("COMMIT");
    return { transaction: updated.rows[0], balance, balanceChanged };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => void 0);
    throw error;
  } finally {
    client.release();
  }
}
async function deletePostgresTransaction(id) {
  const client = getPool();
  if (!client) return null;
  await ensureSchema(client);
  const connection = await client.connect();
  try {
    await connection.query("BEGIN");
    const result = await connection.query("DELETE FROM public.transactions WHERE id = $1", [id]);
    await connection.query("DELETE FROM public.deposits WHERE id = $1", [id]);
    await connection.query("DELETE FROM public.withdrawals WHERE id = $1", [id]);
    await connection.query("COMMIT");
    return (result.rowCount || 0) > 0;
  } catch (error) {
    await connection.query("ROLLBACK").catch(() => void 0);
    throw error;
  } finally {
    connection.release();
  }
}

// server/bingo.ts
var GLOBAL_ROOM_ID = "GLOBAL_ROOM";
var ROOM_JOIN_WINDOW_MS = 35e3;
var BALL_INTERVAL_MS = 3e3;
var JOIN_GRACE_MS = 1e4;
var JOIN_RETRY_MS = 250;
var MAX_INIT_DATA_AGE_SECONDS = 86400;
var VALID_STAKES = /* @__PURE__ */ new Set([10]);
function createLocalMockUser(idValue) {
  const id = Number(idValue || process.env.MOCK_TELEGRAM_USER_ID || 1000000001);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return {
    id,
    first_name: "Player",
    username: `player_${String(id).slice(-4)}`
  };
}
function isLoopbackAddress(address) {
  const normalized = (address || "").toLowerCase().replace(/^::ffff:/, "");
  return normalized === "::1" || normalized === "127.0.0.1" || normalized.startsWith("127.");
}
function isLoopbackClientAllowed(origin, remoteAddress) {
  if (!isLoopbackAddress(remoteAddress)) return false;
  try {
    const hostname = new URL(origin || "").hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}
function validateTelegramInitData(initData, botToken, allowLocalMock = false) {
  const rawInitData = typeof initData === "string" ? initData.trim() : "";
  if (rawInitData.startsWith("mock:")) {
    return allowLocalMock ? createLocalMockUser(rawInitData.slice(5)) : null;
  }
  if (!rawInitData) return allowLocalMock ? createLocalMockUser() : null;
  if (!botToken) return null;
  try {
    const params = new URLSearchParams(rawInitData);
    const hash = params.get("hash") || "";
    const authDate = Number(params.get("auth_date"));
    const now = Math.floor(Date.now() / 1e3);
    if (!/^[a-f0-9]{64}$/i.test(hash) || !Number.isSafeInteger(authDate)) return null;
    if (authDate > now + 60 || now - authDate > MAX_INIT_DATA_AGE_SECONDS) return null;
    const dataCheckString = Array.from(params.entries()).filter(([key]) => key !== "hash").sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join("\n");
    const secretKey = createHmac2("sha256", "WebAppData").update(botToken).digest();
    const expectedHash = createHmac2("sha256", secretKey).update(dataCheckString).digest();
    const suppliedHash = Buffer.from(hash, "hex");
    if (suppliedHash.length !== expectedHash.length || !timingSafeEqual2(suppliedHash, expectedHash)) return null;
    const userJson = params.get("user");
    if (!userJson) return null;
    const user = JSON.parse(userJson);
    if (!Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) return null;
    return {
      id: Number(user.id),
      first_name: user.first_name || "Player",
      last_name: user.last_name,
      username: user.username || `user_${user.id}`
    };
  } catch {
    return null;
  }
}
function getNextAlignedStartsAt(now = Date.now()) {
  const cycleIndex = Math.floor(now / ROOM_JOIN_WINDOW_MS);
  const cycleStart = cycleIndex * ROOM_JOIN_WINDOW_MS;
  let target = cycleStart + ROOM_JOIN_WINDOW_MS;
  if (target <= now + 1500) {
    target = (cycleIndex + 1) * ROOM_JOIN_WINDOW_MS + ROOM_JOIN_WINDOW_MS;
  }
  return target;
}
function makeRoomState(stake, startsAt = getNextAlignedStartsAt()) {
  const cycleIndex = Math.floor(startsAt / ROOM_JOIN_WINDOW_MS);
  return {
    gameId: `salery-live-${cycleIndex}`,
    stake,
    status: "waiting",
    startsAt,
    deck: generateShuffledDeck().map((ball) => ball.number),
    called: [],
    prizePool: 0,
    players: []
  };
}
function roomIdForStake(_stake = 10) {
  return GLOBAL_ROOM_ID;
}
function publicRoomState(state, onlineIds = /* @__PURE__ */ new Set()) {
  const onlinePlayers = new Set(onlineIds);
  const playersWithCartelas = state.players.filter((player) => player.cardIds.length > 0);
  const totalCards = playersWithCartelas.reduce((total, player) => total + player.cardIds.length, 0);
  const collectedBets = totalCards * state.stake;
  const calculatedPrize = Math.floor(collectedBets * 0.8);
  const takenCartelas = {};
  state.players.forEach((p) => {
    p.cardIds?.forEach((cid) => {
      takenCartelas[cid] = p.name || "Player";
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
      isOnline: onlinePlayers.has(telegramId)
    })),
    winnerId: state.winnerId,
    winnerName: state.players.find((player) => player.telegramId === state.winnerId)?.name,
    winningCardId: state.winningCardId,
    prize: state.prize ?? calculatedPrize
  };
}
function getOnlinePlayerIds(io, roomId) {
  const socketIds = io.sockets.adapter.rooms.get(roomId) || /* @__PURE__ */ new Set();
  const onlineIds = /* @__PURE__ */ new Set();
  socketIds.forEach((socketId) => {
    const client = io.sockets.sockets.get(socketId);
    if (client?.data.player?.id) onlineIds.add(String(client.data.player.id));
  });
  return onlineIds;
}
function sendRoomState(io, roomId, state) {
  const publicState = publicRoomState(state, getOnlinePlayerIds(io, roomId));
  io.to(roomId).emit("room:state", publicState);
  io.to(roomId).emit("room:selection_state", publicState);
}
function attachBingoRooms(io) {
  const localRooms = /* @__PURE__ */ new Map();
  const activeTimers = /* @__PURE__ */ new Map();
  const countdownTimers = /* @__PURE__ */ new Map();
  const activeDrawTimers = /* @__PURE__ */ new Map();
  let globalRoomInitialization = null;
  const cartelaReservations = {
    10: {},
    25: {},
    50: {},
    100: {},
    250: {}
  };
  const broadcastCartelaReservations = (stake) => {
    const roomId = roomIdForStake(stake);
    const takenCartelas = {};
    const state = localRooms.get(roomId);
    state?.players.forEach((joinedPlayer) => {
      joinedPlayer.cardIds.forEach((cardId) => {
        takenCartelas[cardId] = joinedPlayer.name || "Player";
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
        Object.values(cartelaReservations[stake] || {}).map(({ playerId }) => playerId).concat((state?.players || []).map(({ telegramId }) => telegramId))
      ).size,
      prizePool: Math.floor(
        Object.keys(takenCartelas).length * (state?.stake ?? stake) * 0.8
      )
    };
    io.to(roomId).emit("cartela:reserved_list", reservedList);
  };
  function findRoomWinner(room) {
    const calledSet = new Set(room.called);
    for (const player of room.players) {
      for (const cardId of player.cardIds) {
        const card = generateCartelaByNumber(cardId);
        const verifiedCells = card.cells.map(
          (row) => row.map((cell) => ({
            ...cell,
            isDaubed: cell.isFree || calledSet.has(cell.number)
          }))
        );
        const verifiedCard = { ...card, cells: verifiedCells };
        const winResult = checkCardWinningPatterns(verifiedCard, "am");
        if (winResult.hasWon) {
          return { player, cardId, win: winResult };
        }
      }
    }
    return null;
  }
  const resetTimers = /* @__PURE__ */ new Map();
  const startSelectionRound = async (roomId, stake) => {
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
    localRooms.set(roomId, nextState);
    cartelaReservations[stake] = {};
    broadcastCartelaReservations(stake);
    if (await isPostgresConfigured()) {
      try {
        await mutatePostgresBingoRoom(roomId, () => nextState);
      } catch (error) {
        console.error(`Could not persist selection round for ${roomId}:`, error);
      }
    }
    sendRoomState(io, roomId, nextState);
    scheduleRoom(roomId, nextState);
  };
  const scheduleRoomReset = (roomId) => {
    if (resetTimers.has(roomId)) {
      clearTimeout(resetTimers.get(roomId));
      resetTimers.delete(roomId);
    }
    const timer = setTimeout(() => {
      resetTimers.delete(roomId);
      const currentRoom = localRooms.get(roomId);
      if (currentRoom && currentRoom.status === "finished") {
        void startSelectionRound(roomId, currentRoom.stake);
      }
    }, 5e3);
    resetTimers.set(roomId, timer);
  };
  const startRoomGame = async (roomId, latest) => {
    console.log("[DRAW] startRoomGame requested:", {
      roomId,
      status: latest.status,
      playerCount: latest.players.length,
      calledCount: latest.called.length
    });
    if (latest.status === "finished" || latest.players.length === 0) {
      console.log("[DRAW] Not starting loop: room is finished or has no players.", roomId);
      return;
    }
    if (activeDrawTimers.has(roomId)) {
      console.log("[DRAW] Draw loop already active:", roomId);
      return;
    }
    if (activeTimers.has(roomId)) {
      clearTimeout(activeTimers.get(roomId));
      activeTimers.delete(roomId);
    }
    if (resetTimers.has(roomId)) {
      clearTimeout(resetTimers.get(roomId));
      resetTimers.delete(roomId);
    }
    if (countdownTimers.has(roomId)) {
      clearInterval(countdownTimers.get(roomId));
      countdownTimers.delete(roomId);
    }
    const totalRoomCards = latest.players.reduce((total, player) => total + player.cardIds.length, 0);
    latest.prizePool = totalRoomCards * latest.stake;
    const alreadyInProgress = String(latest.status).toLowerCase() === "in_progress";
    if (!alreadyInProgress) {
      latest.status = "in_progress";
      latest.startsAt = Date.now();
    }
    localRooms.set(roomId, latest);
    if (!alreadyInProgress) {
      io.to(roomId).emit("gameStarted", {
        gameId: latest.gameId,
        startedAt: latest.startsAt
      });
    }
    sendRoomState(io, roomId, latest);
    if (!alreadyInProgress && isPostgresConfigured()) {
      void mutatePostgresBingoRoom(roomId, () => latest).catch((error) => {
        console.error(`Could not persist game start for ${roomId}; continuing with the active room state:`, error);
      });
    }
    const startDrawLoop = (drawRoomId, roomState) => {
      console.log("[DRAW] Starting draw loop:", {
        roomId: drawRoomId,
        status: roomState.status,
        playerCount: roomState.players.length
      });
      if (activeDrawTimers.has(drawRoomId)) {
        console.log("[DRAW] Draw loop already active:", drawRoomId);
        return;
      }
      const drawBall = async () => {
        let room = localRooms.get(drawRoomId);
        if (!room || room.status !== "in_progress") {
          const currentTimer = activeDrawTimers.get(drawRoomId);
          if (currentTimer) clearInterval(currentTimer);
          activeDrawTimers.delete(drawRoomId);
          return;
        }
        if (room.deck.length === 0) {
          room.status = "finished";
          localRooms.set(drawRoomId, room);
          const finishedTimer = activeDrawTimers.get(drawRoomId);
          if (finishedTimer) clearInterval(finishedTimer);
          activeDrawTimers.delete(drawRoomId);
          sendRoomState(io, drawRoomId, room);
          scheduleRoomReset(drawRoomId);
          return;
        }
        const currentBall = room.deck.shift();
        room.called.push(currentBall);
        localRooms.set(drawRoomId, room);
        const ball = {
          number: currentBall,
          gameId: room.gameId,
          drawnAt: Date.now()
        };
        console.log("[DRAW] Ball drawn; broadcasting:", {
          roomId: drawRoomId,
          ball,
          calledCount: room.called.length
        });
        const payload = {
          ball,
          number: currentBall,
          calledNumbers: [...room.called],
          called: [...room.called],
          gameId: room.gameId,
          drawnAt: ball.drawnAt
        };
        io.to(drawRoomId).emit("room:number_drawn", payload);
        io.emit("room:number_drawn", payload);
        if (isPostgresConfigured()) {
          void mutatePostgresBingoRoom(drawRoomId, () => room).catch((error) => {
            console.error(`Could not persist drawn number ${currentBall} for ${drawRoomId}; continuing the draw:`, error);
          });
        }
        const winner = findRoomWinner(room);
        if (winner) {
          room.status = "finished";
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
                  first_name: winner.player.name || "Player",
                  username: `player_${winner.player.telegramId}`,
                  balance: 0,
                  main_wallet: 0,
                  play_wallet: 0
                });
              }
              if (localUser) {
                const mainWallet = (localUser.main_wallet ?? localUser.balance ?? 0) + prize;
                const playWallet = localUser.play_wallet ?? 0;
                localDb.upsertUser({
                  ...localUser,
                  balance: mainWallet,
                  main_wallet: mainWallet,
                  games_won: (localUser.games_won || 0) + 1
                });
                finalBal = mainWallet;
                finalMain = mainWallet;
                finalPlay = playWallet;
                payoutVerified = true;
              }
            }
          } catch (err) {
            console.error("Error awarding bingo in loop:", err);
          }
          localRooms.set(drawRoomId, room);
          cartelaReservations[room.stake] = {};
          broadcastCartelaReservations(room.stake);
          io.to(roomId).emit("room:winner", {
            gameId: room.gameId,
            winnerId: String(winner.player.telegramId),
            winnerName: winner.player.name || "Winner",
            cardId: winner.cardId,
            prize,
            ...payoutVerified ? {
              balance: finalBal,
              mainWallet: finalMain,
              playWallet: finalPlay
            } : {},
            win: winner.win
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
  const scheduleRoom = (roomId, state) => {
    if (activeTimers.has(roomId)) return;
    const broadcastTick = () => {
      const latest = localRooms.get(roomId);
      if (!latest || latest.status !== "waiting") return;
      io.to(roomId).emit("room:tick", {
        gameId: latest.gameId,
        status: latest.status,
        startsAt: latest.startsAt,
        serverNow: Date.now(),
        secondsRemaining: Math.max(0, Math.ceil((latest.startsAt - Date.now()) / 1e3))
      });
    };
    broadcastTick();
    const countdown = setInterval(broadcastTick, 1e3);
    countdownTimers.set(roomId, countdown);
    const finalizeSelection = async () => {
      const latest = localRooms.get(roomId);
      if (!latest || latest.status === "finished") return;
      if (latest.status === "in_progress") {
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
      await finalizeSelection();
    }, delay);
    activeTimers.set(roomId, timer);
  };
  const ensureGlobalRoom = () => {
    if (!localRooms.has(GLOBAL_ROOM_ID)) {
      globalRoomInitialization ??= getPostgresBingoRoom(GLOBAL_ROOM_ID).catch((error) => {
        console.warn("Could not restore the global bingo room:", error);
        return null;
      }).then((storedState) => {
        const initialState = storedState || makeRoomState(10, Date.now() + ROOM_JOIN_WINDOW_MS);
        localRooms.set(GLOBAL_ROOM_ID, initialState);
        if (initialState.status === "waiting") scheduleRoom(GLOBAL_ROOM_ID, initialState);
        else if (initialState.status === "in_progress") void startRoomGame(GLOBAL_ROOM_ID, initialState);
        else if (initialState.status === "finished") scheduleRoomReset(GLOBAL_ROOM_ID);
        return initialState;
      });
    }
    return Promise.resolve(localRooms.get(GLOBAL_ROOM_ID) || globalRoomInitialization);
  };
  io.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    const playerId = Number(auth.playerId);
    if (!Number.isSafeInteger(playerId) || playerId <= 0 || !isValidBingoGuestToken(playerId, auth.guestToken)) {
      return next(new Error("A valid signed bingo guest session is required"));
    }
    const client = socket;
    client.data = {
      player: {
        id: playerId,
        first_name: "Player",
        username: `player_${String(playerId).slice(-4)}`
      }
    };
    next();
  });
  io.on("connection", (socket) => {
    const client = socket;
    const player = client.data.player;
    const playerIdentifier = String(player.id);
    console.log("[SOCKET] Client connected:", {
      socketId: client.id,
      playerId: playerIdentifier,
      roomId: GLOBAL_ROOM_ID
    });
    const roomMembership = Promise.resolve(client.join(GLOBAL_ROOM_ID));
    void Promise.all([roomMembership, ensureGlobalRoom()]).then(([, state]) => {
      console.log("[SOCKET] Global room synchronized:", {
        socketId: client.id,
        roomId: GLOBAL_ROOM_ID,
        status: state.status,
        playerCount: state.players.length
      });
      if (state.status === "in_progress") {
        void startRoomGame(GLOBAL_ROOM_ID, state);
      }
      sendRoomState(io, GLOBAL_ROOM_ID, state);
    }).catch((error) => {
      console.error(`Could not initialize ${GLOBAL_ROOM_ID} for socket ${client.id}:`, error);
    });
    client.on("cartela:room_enter", async (payload, ack) => {
      await Promise.all([roomMembership, ensureGlobalRoom()]);
      const stake = Number(payload?.stake) || 10;
      const roomId = roomIdForStake(stake);
      let state = localRooms.get(roomId);
      if (!state || state.status === "finished") {
        state = makeRoomState(stake, Date.now() + ROOM_JOIN_WINDOW_MS);
        localRooms.set(roomId, state);
        scheduleRoom(roomId, state);
      }
      sendRoomState(io, roomId, state);
      broadcastCartelaReservations(stake);
      const existingPlayer = state.players.find((p) => String(p.telegramId) === String(player.id));
      const userRes = cartelaReservations[stake] || {};
      const myReservedCardIds = Object.entries(userRes).filter(([, reservation]) => reservation.playerId === playerIdentifier).map(([cid]) => Number(cid));
      if (typeof ack === "function") {
        ack({
          ok: true,
          joinedPlayer: existingPlayer ? {
            cardIds: existingPlayer.cardIds,
            cards: existingPlayer.cardIds.map((id) => generateCartelaByNumber(id)),
            walletType: existingPlayer.walletType
          } : null,
          myReservedCardIds,
          state: publicRoomState(state, getOnlinePlayerIds(io, roomId))
        });
      }
    });
    client.on("cartela:reserve", async (payload, ack) => {
      await Promise.all([roomMembership, ensureGlobalRoom()]);
      const stake = Number(payload.stake);
      const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds : [];
      if (!VALID_STAKES.has(stake)) {
        if (typeof ack === "function") ack({ ok: false, acceptedIds: [], error: "Invalid stake" });
        return;
      }
      const state = localRooms.get(GLOBAL_ROOM_ID);
      if (!state || state.status !== "waiting") {
        if (typeof ack === "function") ack({ ok: false, acceptedIds: [], error: "Cartela selection is closed" });
        return;
      }
      const userRes = cartelaReservations[stake] || {};
      const validCardIds = Array.from(new Set(cardIds.filter(
        (id) => Number.isInteger(id) && id >= 1 && id <= 400
      )));
      for (const [cidStr, reservation] of Object.entries(userRes)) {
        if (reservation.playerId === playerIdentifier && !validCardIds.includes(Number(cidStr))) {
          delete userRes[Number(cidStr)];
        }
      }
      const purchasedCardIds = new Set(state.players.flatMap((roomPlayer) => roomPlayer.cardIds));
      const acceptedIds = [];
      const rejectedIds = [];
      validCardIds.forEach((id) => {
        const reservation = userRes[id];
        if (purchasedCardIds.has(id) || reservation && reservation.playerId !== playerIdentifier) {
          rejectedIds.push(id);
          return;
        }
        userRes[id] = {
          playerId: playerIdentifier,
          name: player.first_name || player.username || "Player"
        };
        acceptedIds.push(id);
      });
      cartelaReservations[stake] = userRes;
      broadcastCartelaReservations(stake);
      sendRoomState(io, GLOBAL_ROOM_ID, state);
      if (typeof ack === "function") ack({ ok: true, acceptedIds, rejectedIds });
    });
    client.on("cartela:release", (payload) => {
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
    client.on("room:join", async (payload, ack) => {
      await Promise.all([roomMembership, ensureGlobalRoom()]);
      const stake = Number(payload?.stake) || 10;
      const cardIds = Array.isArray(payload?.cardIds) ? payload.cardIds : [];
      console.log("[ROOM] Join request received:", {
        socketId: client.id,
        playerId: playerIdentifier,
        roomId: GLOBAL_ROOM_ID,
        stake,
        cardIds
      });
      if (!VALID_STAKES.has(stake)) {
        return ack({ ok: false, error: "Invalid stake or cartela selection" });
      }
      const walletType = payload?.walletType || "main_wallet";
      const roomId = roomIdForStake(stake);
      let state = localRooms.get(roomId);
      if (!state || state.status === "finished") {
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
          if (!account) return ack({ ok: false, error: "Local player wallet is unavailable" });
          mainWallet = Number(account.main_wallet ?? account.balance ?? 0);
          playWallet = Number(account.play_wallet ?? 0);
        } else {
          const account = localDb.getUser(String(player.id));
          if (!account) return ack({ ok: false, error: "Local player wallet is unavailable" });
          mainWallet = Number(account.main_wallet ?? account.balance ?? 0);
          playWallet = Number(account.play_wallet ?? 0);
        }
        const clientCards = existingJoin.cardIds.map((id) => generateCartelaByNumber(id));
        if (state.status === "in_progress") void startRoomGame(roomId, state);
        return ack({
          ok: true,
          duplicate: true,
          state: publicRoomState(state, getOnlinePlayerIds(io, roomId)),
          cards: clientCards,
          balance: mainWallet,
          mainWallet,
          playWallet
        });
      }
      if (state.status === "in_progress") {
        void startRoomGame(roomId, state);
        return ack({
          ok: true,
          spectator: true,
          state: publicRoomState(state, getOnlinePlayerIds(io, roomId))
        });
      }
      if (payload?.rejoin) {
        return ack({ ok: false, error: "No active cartela ticket exists for this round" });
      }
      if (cardIds.length === 0) return ack({ ok: false, error: "Select at least one cartela" });
      if (cardIds.some((id) => !Number.isInteger(id) || id < 1 || id > 400) || new Set(cardIds).size !== cardIds.length) {
        return ack({ ok: false, error: "Invalid stake or cartela selection" });
      }
      if (state.status !== "waiting") {
        return ack({ ok: false, error: "Cartela selection is closed" });
      }
      const cost = stake * cardIds.length;
      try {
        let finalBal = 0;
        let finalMain = 0;
        let finalPlay = 0;
        if (await isPostgresConfigured()) {
          const account = await getPostgresUser(String(player.id));
          if (!account) {
            await upsertPostgresUser({
              telegram_id: String(player.id),
              first_name: player.first_name || player.username || "Player",
              full_name: player.first_name || player.username || "Player",
              username: player.username || `player_${player.id}`,
              balance: 0,
              main_wallet: 0,
              play_wallet: 0
            });
          }
          const pgResult = await joinPostgresBingoRoom({
            roomId,
            telegramId: String(player.id),
            name: player.first_name || player.username || "Player",
            joinRequestId: payload?.joinRequestId || crypto.randomUUID(),
            stake,
            walletType,
            cardIds,
            initialState: state
          });
          if (!pgResult) return ack({ ok: false, error: "Could not join room" });
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
              state: publicRoomState(state, getOnlinePlayerIds(io, roomId))
            });
          }
        } else {
          let localUser = localDb.getUser(String(player.id));
          if (!localUser) {
            localUser = localDb.upsertUser({
              telegram_id: String(player.id),
              first_name: player.first_name || player.username || "Player",
              username: player.username || `player_${player.id}`,
              balance: 0,
              main_wallet: 0,
              play_wallet: 0
            });
          }
          let mainWallet = Number(localUser.main_wallet ?? localUser.balance ?? 0);
          let playWallet = Number(localUser.play_wallet ?? 0);
          if (walletType === "play_wallet") {
            if (playWallet < cost) return ack({ ok: false, error: "Insufficient balance or account unavailable" });
            playWallet -= cost;
          } else {
            if (mainWallet < cost) return ack({ ok: false, error: "Insufficient balance or account unavailable" });
            mainWallet -= cost;
          }
          localUser.balance = mainWallet;
          localUser.main_wallet = mainWallet;
          localUser.play_wallet = playWallet;
          localUser.games_played = (localUser.games_played || 0) + 1;
          localDb.scheduleSave();
          finalBal = mainWallet;
          finalMain = mainWallet;
          finalPlay = playWallet;
          state.players.push({
            telegramId: String(player.id),
            name: player.first_name || player.username || "Player",
            cardIds,
            walletType,
            stake,
            joinRequestId: payload?.joinRequestId || crypto.randomUUID()
          });
          const totalCards = state.players.reduce((total, joinedPlayer) => total + joinedPlayer.cardIds.length, 0);
          state.prizePool = totalCards * state.stake;
          localRooms.set(roomId, state);
        }
        const userRes = cartelaReservations[stake] || {};
        for (const [cardId, reservation] of Object.entries(userRes)) {
          if (reservation.playerId === playerIdentifier) delete userRes[Number(cardId)];
        }
        cardIds.forEach((id) => {
          userRes[id] = {
            playerId: playerIdentifier,
            name: player.first_name || player.username || "Player"
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
          playWallet: finalPlay
        });
      } catch (err) {
        ack({ ok: false, error: err.message || "Error joining the game" });
      }
    });
    client.on("room:claim", async (payload, ack) => {
      const cardId = Number(payload?.cardId);
      if (isNaN(cardId)) return typeof ack === "function" && ack({ ok: false, error: "Invalid card ID" });
      let foundRoomId = "";
      let state;
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
        for (const [rId, room] of localRooms.entries()) {
          if (room.status === "in_progress") {
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
        return typeof ack === "function" && ack({ ok: false, error: "No active room found for this player" });
      }
      if (state.status !== "in_progress") {
        return typeof ack === "function" && ack({ ok: false, error: "Game is not currently active" });
      }
      const roomPlayer = state.players.find((p) => String(p.telegramId) === String(player.id));
      if (!roomPlayer || !roomPlayer.cardIds.includes(cardId)) {
        return typeof ack === "function" && ack({ ok: false, error: "A purchased cartela is required to claim Bingo" });
      }
      const card = generateCartelaByNumber(cardId);
      const calledSet = new Set(state.called);
      const verifiedCells = card.cells.map(
        (row) => row.map((cell) => ({
          ...cell,
          isDaubed: cell.isFree || calledSet.has(cell.number)
        }))
      );
      const verifiedCard = { ...card, cells: verifiedCells };
      const winResult = checkCardWinningPatterns(verifiedCard, "am");
      if (!winResult.hasWon) {
        return ack({ ok: false, error: "This card does not have a complete winning pattern" });
      }
      state.status = "finished";
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
            state.status = "in_progress";
            state.winnerId = void 0;
            state.winningCardId = void 0;
            state.prize = void 0;
            localRooms.set(foundRoomId, state);
            return ack({ ok: false, error: "Could not verify or award the prize" });
          }
          finalBal = pgResult.balance;
          finalMain = pgResult.mainWallet;
          finalPlay = pgResult.playWallet;
          state = pgResult.state;
        } else {
          let localUser = localDb.getUser(String(player.id));
          if (!localUser) {
            localUser = localDb.upsertUser({
              telegram_id: String(player.id),
              first_name: player.first_name || player.username || "Player",
              username: player.username || `player_${player.id}`,
              balance: 0,
              main_wallet: 0,
              play_wallet: 0
            });
          }
          const mainWallet = Number(localUser.main_wallet ?? localUser.balance ?? 0) + prize;
          const playWallet = Number(localUser.play_wallet ?? 0);
          localDb.upsertUser({
            ...localUser,
            balance: mainWallet,
            main_wallet: mainWallet,
            games_won: (localUser.games_won || 0) + 1
          });
          finalBal = mainWallet;
          finalMain = mainWallet;
          finalPlay = playWallet;
        }
        localRooms.set(foundRoomId, state);
        const drawTimer = activeDrawTimers.get(foundRoomId);
        if (drawTimer) {
          clearInterval(drawTimer);
          activeDrawTimers.delete(foundRoomId);
        }
        cartelaReservations[state.stake] = {};
        broadcastCartelaReservations(state.stake);
        io.to(foundRoomId).emit("room:winner", {
          gameId: state.gameId,
          winnerId: String(player.id),
          winnerName: player.first_name || player.username || "Winner",
          cardId,
          prize,
          balance: finalBal,
          mainWallet: finalMain,
          playWallet: finalPlay,
          win: winResult
        });
        const publicState = publicRoomState(state, getOnlinePlayerIds(io, foundRoomId));
        io.to(foundRoomId).emit("room:state", publicState);
        scheduleRoomReset(foundRoomId);
        socket.emit("wallet:balance", {
          balance: finalBal,
          mainWallet: finalMain,
          playWallet: finalPlay
        });
        ack({
          ok: true,
          state: publicState,
          balance: finalBal,
          mainWallet: finalMain,
          playWallet: finalPlay,
          win: winResult
        });
      } catch (err) {
        ack({ ok: false, error: err.message || "Error processing victory payout" });
      }
    });
    client.on("room:leave", (payload) => {
      const stake = Number(payload.stake);
      if (!VALID_STAKES.has(stake)) return;
      const userRes = cartelaReservations[stake] || {};
      for (const [cardId, reservation] of Object.entries(userRes)) {
        if (reservation.playerId === playerIdentifier) delete userRes[Number(cardId)];
      }
      cartelaReservations[stake] = userRes;
      broadcastCartelaReservations(stake);
    });
    client.on("disconnect", () => {
      const userRes = cartelaReservations[10] || {};
      for (const [cardId, reservation] of Object.entries(userRes)) {
        if (reservation.playerId === playerIdentifier) delete userRes[Number(cardId)];
      }
      cartelaReservations[10] = userRes;
      broadcastCartelaReservations(10);
      const state = localRooms.get(GLOBAL_ROOM_ID);
      if (state) sendRoomState(io, GLOBAL_ROOM_ID, state);
    });
    void Promise.all([roomMembership, ensureGlobalRoom()]).then(([, globalState]) => {
      if (!client.connected) return;
      sendRoomState(io, GLOBAL_ROOM_ID, globalState);
      broadcastCartelaReservations(globalState.stake);
      client.emit("room:ready");
    }).catch((error) => {
      console.error("Could not initialize the global bingo connection:", error);
    });
  });
}

// server.ts
dotenv.config();
function isStaticFrontendUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes("vercel.app") || lower.includes("netlify.app") || lower.includes("pages.dev") || lower.includes("github.io");
}
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = WebSocket;
}
var isProduction = process.env.NODE_ENV === "production";
var supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
if (!supabaseUrl) {
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v !== "string" || !v.trim()) continue;
    const val = v.trim();
    if (val.includes(".supabase.co")) {
      supabaseUrl = val.startsWith("http") ? val : `https://${val}`;
      break;
    }
    if (k.toUpperCase().includes("SUPABASE") && k.toUpperCase().includes("URL")) {
      supabaseUrl = val.startsWith("http") ? val : `https://${val}.supabase.co`;
      break;
    }
  }
}
if (supabaseUrl.endsWith("/")) {
  supabaseUrl = supabaseUrl.slice(0, -1);
}
var supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
var supaEnvVars = Object.entries(process.env).filter(([k, v]) => typeof v === "string" && v.trim() && k.toUpperCase().includes("SUPA")).map(([k, v]) => ({ key: k, val: v.trim() }));
var preferredKey = supabaseKey || supaEnvVars.find((item) => item.val.startsWith("sb_secret_"))?.val || supaEnvVars.find((item) => item.val.startsWith("eyJ"))?.val || supaEnvVars.find(
  (item) => item.key.toUpperCase().includes("SERVICE") || item.key.toUpperCase().includes("SECRET")
)?.val || supaEnvVars.find((item) => item.key.toUpperCase().includes("ROLE"))?.val || supaEnvVars.find((item) => item.key.toUpperCase().includes("KEY"))?.val || "";
supabaseKey = preferredKey;
if (!supabaseKey) {
  for (const [, v] of Object.entries(process.env)) {
    if (typeof v === "string" && v.trim().startsWith("eyJ") && v.trim().split(".").length === 3) {
      supabaseKey = v.trim();
      break;
    }
  }
}
var supabaseInitError = "";
var supabase = null;
function getSupabase() {
  if (supabase) return supabase;
  const savedSupa = isProduction ? { url: "", key: "" } : localDb.getSupabaseConfig();
  let cleanUrl = (savedSupa.url || supabaseUrl || "").replace(/^['"]|['"]$/g, "").trim();
  let cleanKey = (savedSupa.key || supabaseKey || "").replace(/^['"]|['"]$/g, "").trim();
  if (!cleanUrl) {
    for (const [, v] of Object.entries(process.env)) {
      if (typeof v === "string" && v.includes(".supabase.co")) {
        cleanUrl = v.trim().replace(/^['"]|['"]$/g, "");
        if (!cleanUrl.startsWith("http")) cleanUrl = `https://${cleanUrl}`;
        break;
      }
    }
  }
  if (!cleanKey) {
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === "string" && v.trim()) {
        const val = v.trim().replace(/^['"]|['"]$/g, "");
        if (val.startsWith("sb_secret_") || val.startsWith("eyJ")) {
          cleanKey = val;
          break;
        }
        if (k.toUpperCase().includes("SUPABASE") && (k.toUpperCase().includes("ROLE") || k.toUpperCase().includes("SERVICE") || k.toUpperCase().includes("KEY") || k.toUpperCase().includes("SECRET"))) {
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
          transport: WebSocket
        }
      });
      supabaseInitError = "";
      console.log("\u2705 Supabase client dynamically initialized with URL:", cleanUrl);
      return supabase;
    } catch (err) {
      supabaseInitError = err?.message || String(err);
      console.error("Failed to initialize Supabase client:", supabaseInitError);
      return null;
    }
  } else {
    supabaseInitError = !cleanUrl ? "Missing Supabase URL" : "Missing Supabase Key";
    return null;
  }
}
function reinitSupabase(url, key) {
  if (url && key) {
    localDb.saveSupabaseConfig(url, key);
  }
  supabase = null;
  return getSupabase();
}
getSupabase();
async function upsertUserAdaptive(payload) {
  const client = getSupabase();
  if (!client) return { data: null, error: "No Supabase connection" };
  const tId = String(payload.telegram_id);
  const numId = Number(payload.telegram_id) || Math.floor(Math.random() * 1e8);
  try {
    const { data: existing } = await client.from("users").select("id, telegram_id, balance").eq("telegram_id", tId).maybeSingle();
    if (existing) {
      const updateData = { ...payload, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      delete updateData.id;
      if (payload.balance === void 0) delete updateData.balance;
      const { data: updated, error: updateErr } = await client.from("users").update(updateData).eq("telegram_id", tId).select().maybeSingle();
      if (!updateErr) {
        return { data: updated || existing, error: null };
      }
      const colMatch = (updateErr.message || "").match(/column "(.*?)" of relation "users" does not exist/i);
      if (colMatch && colMatch[1]) {
        delete updateData[colMatch[1]];
        const { data: retryUp } = await client.from("users").update(updateData).eq("telegram_id", tId).select().maybeSingle();
        return { data: retryUp || existing, error: null };
      }
    }
  } catch {
  }
  let currentPayload = { ...payload };
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await client.from("users").insert([currentPayload]).select().maybeSingle();
    if (!res.error) {
      console.log("\u2705 Adaptive insert succeeded with fields:", Object.keys(currentPayload));
      return { data: res.data, error: null };
    }
    const errMsg = res.error.message || "";
    if (res.error.code === "23505" || errMsg.includes("duplicate key") || errMsg.includes("unique constraint")) {
      const { data: existingUser } = await client.from("users").select("*").eq("telegram_id", tId).maybeSingle();
      return { data: existingUser, error: null };
    }
    const colMatch = errMsg.match(/column "(.*?)" of relation "users" does not exist/i);
    if (colMatch && colMatch[1]) {
      const missingCol = colMatch[1];
      delete currentPayload[missingCol];
      console.log(`Stripped non-existent column "${missingCol}", retrying...`);
      continue;
    }
    if (errMsg.includes('null value in column "id"') || errMsg.includes('column "id"') || res.error.code === "23502") {
      currentPayload.id = numId;
      console.log(`Supplied explicit id = ${numId}, retrying...`);
      continue;
    }
    if (attempt === 3) {
      currentPayload = {
        id: numId,
        telegram_id: String(payload.telegram_id),
        username: String(payload.username || ""),
        balance: payload.balance ?? 0
      };
      continue;
    }
    if (attempt === 4) {
      currentPayload = {
        telegram_id: String(payload.telegram_id),
        username: String(payload.username || ""),
        balance: payload.balance ?? 0
      };
      continue;
    }
    if (attempt === 5) {
      currentPayload = {
        telegram_id: String(payload.telegram_id)
      };
      continue;
    }
    return { data: null, error: errMsg };
  }
  return { data: null, error: "Insert exceeded max retries" };
}
var insertUserAdaptive = upsertUserAdaptive;
var savedBotConfig = localDb.getBotConfig();
var activeBotToken = (process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || savedBotConfig.bot_token || "").trim();
var activeBotUsername = (process.env.VITE_BOT_USERNAME || savedBotConfig.bot_username || "salerybingo_bot").replace("@", "").trim();
var isLongPollingRunning = false;
var currentPollingInstanceId = "";
var currentPollingToken = "";
if (!savedBotConfig.bot_token) {
  localDb.saveBotConfig(activeBotToken, activeBotUsername);
}
function getActiveBotToken(req) {
  if (req) {
    const fromHeader = req.headers["x-bot-token"];
    if (fromHeader && typeof fromHeader === "string" && fromHeader.trim().length > 10) {
      return fromHeader.trim();
    }
    const fromBody = req.body?.botToken;
    if (fromBody && typeof fromBody === "string" && fromBody.trim().length > 10) {
      return fromBody.trim();
    }
  }
  return activeBotToken;
}
function getAdminTelegramIds() {
  const ids = /* @__PURE__ */ new Set(["5873620165", "908336796", ...process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(",").map((s) => s.trim()) : []]);
  try {
    for (const u of localDb.getAllUsers()) {
      if (u.role === "admin" && u.telegram_id) {
        ids.add(String(u.telegram_id));
      }
    }
  } catch {
  }
  return Array.from(ids);
}
function isAdminUser(id) {
  if (!id) return false;
  const sId = String(id).trim();
  if (sId === "908336796") return true;
  if (process.env.ADMIN_IDS && process.env.ADMIN_IDS.split(",").map((s) => s.trim()).includes(sId)) return true;
  try {
    const user = localDb.getUser(sId);
    if (user && user.role === "admin") return true;
  } catch {
  }
  return false;
}
var VERIFIED_USERS_FILE = path2.join(process.cwd(), "data", "verified_telegram_users.json");
var verifiedUsersCache = {};
try {
  if (fs2.existsSync(VERIFIED_USERS_FILE)) {
    const rawData = fs2.readFileSync(VERIFIED_USERS_FILE, "utf8");
    verifiedUsersCache = JSON.parse(rawData);
  }
} catch {
  verifiedUsersCache = {};
}
if (!verifiedUsersCache["5873620165"]) {
  verifiedUsersCache["5873620165"] = { phone: "+251908336796", name: "Jo_cr7", code: "SB-62805", verifiedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
if (!verifiedUsersCache["908336796"]) {
  verifiedUsersCache["908336796"] = { phone: "+251911000000", name: "Admin", code: "SB-90833", verifiedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function markTelegramUserPermanentlyVerified(telegramId, phone, name, code) {
  const sId = String(telegramId).trim();
  if (!sId || !phone) return;
  verifiedUsersCache[sId] = {
    phone: phone.trim(),
    name: name || "Player",
    code,
    verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    const dir = path2.dirname(VERIFIED_USERS_FILE);
    if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
    fs2.writeFileSync(VERIFIED_USERS_FILE, JSON.stringify(verifiedUsersCache, null, 2), "utf8");
  } catch (err) {
    console.warn("Could not save verified users file:", err);
  }
}
function isUserEverVerified(telegramId) {
  if (!telegramId) return false;
  const sId = String(telegramId).trim();
  if (isAdminUser(sId)) return true;
  if (verifiedUsersCache[sId]?.phone && verifiedUsersCache[sId].phone.trim().length > 3) return true;
  const local = localDb.getUser(sId);
  if (local && (local.is_verified || local.phone_number && local.phone_number.trim().length > 3)) return true;
  return false;
}
function getVerifiedRequestUser(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("tma ")) return null;
  const walletBotToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
  return validateTelegramInitData(
    authorization.slice(4),
    walletBotToken,
    isLoopbackClientAllowed(req.headers.origin, req.socket.remoteAddress)
  );
}
function requireVerifiedAdmin(req, res) {
  const user = getVerifiedRequestUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "Verified Telegram WebApp authentication is required" });
    return false;
  }
  if (!isAdminUser(user.id)) {
    res.status(403).json({ ok: false, error: "Admin access required" });
    return false;
  }
  return true;
}
function requireVerifiedPlayer(req, res, telegramId) {
  const user = getVerifiedRequestUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "Verified Telegram WebApp authentication is required" });
    return false;
  }
  if (String(user.id) !== String(telegramId)) {
    res.status(403).json({ ok: false, error: "Telegram identity does not match the requested account" });
    return false;
  }
  return true;
}
function generatePlayerCode(telegramId) {
  const num = Math.abs(Number(telegramId)) || 12345;
  const codeNum = num * 17 % 9e4 + 1e4;
  return `SB-${codeNum}`;
}
var inMemoryTransactions = [];
var inMemoryBannedUsers = /* @__PURE__ */ new Map();
var inMemoryBroadcastHistory = [
  {
    id: "bc_init_1",
    message: "\u{1F305} \u12A5\u1295\u12F0\u121D\u1295 \u12A0\u12F0\u122B\u127D\u1201 \u12CD\u12F5 \u12E8\u1233\u1208\u122A \u1262\u1295\u130E \u1264\u1270\u1230\u1266\u127D!\n\n\u12E8\u12DB\u122C\u12CD \u12A0\u1235\u12F0\u1233\u127D \u12E8\u1262\u1295\u130E \u12D9\u122D \u1270\u12A8\u134D\u1277\u120D\u1362 \u12A0\u1201\u1291\u1291 \u1260\u1218\u130D\u1263\u1275 \u12AB\u122D\u1274\u120B \u12ED\u1241\u1228\u1321\u1293 \u12A5\u12F5\u120D\u12CE\u1295 \u12ED\u121E\u12AD\u1229! \u{1F3B1}\u{1F4B0}\n\n\u1218\u120D\u12AB\u121D \u12A5\u12F5\u120D \u1208\u1201\u120B\u127D\u1201\u121D! \u2728",
    photo_url: "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop&q=80",
    target: "all",
    sent_count: 28,
    created_at: new Date(Date.now() - 36e5 * 6).toISOString()
  },
  {
    id: "bc_init_2",
    message: "\u{1F525} \u120D\u12E9 \u12E8\u12D5\u1208\u1271 \u12E8\u12F2\u1356\u12DA\u1275 \u1309\u122D\u123B (Deposit Bonus) \u{1F525}\n\n\u12DB\u122C \u12A8 100 \u1265\u122D \u1260\u120B\u12ED \u12F2\u1356\u12DA\u1275 \u1208\u121A\u12EB\u12F0\u122D\u1309 \u1270\u132B\u12CB\u127E\u127D \u1260\u1219\u1209 \u1270\u1328\u121B\u122A 10% \u1266\u1290\u1235 \u12C8\u12F2\u12EB\u12CD\u1291 \u1308\u1262 \u12ED\u12F0\u1228\u130B\u120D!\n\n\u12A5\u12F5\u1209 \u12A5\u1295\u12F3\u12EB\u1218\u120D\u1325\u12CE \u12A0\u1201\u1291\u1291 \u12A0\u12AB\u12CD\u1295\u1275\u12CE\u1295 \u12ED\u1219\u1209\u1293 \u12ED\u132B\u12C8\u1271! \u{1F4B3}\u{1F680}",
    photo_url: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80",
    target: "all",
    sent_count: 35,
    created_at: new Date(Date.now() - 36e5 * 22).toISOString()
  },
  {
    id: "bc_init_3",
    message: "\u{1F389} \u12A5\u1295\u12B3\u1295 \u12F0\u1235 \u12A0\u120B\u127D\u1201! \u{1F389}\n\n\u1260\u1275\u120B\u1295\u1275\u1293\u12CD \u12A5\u1208\u1275 \u1260\u1233\u1208\u122A \u1262\u1295\u130E \u12A8\u134D\u1270\u129B \u1308\u1295\u12D8\u1265 \u12EB\u1238\u1290\u1349 \u1270\u132B\u12CB\u127E\u127B\u127D\u1295 \u12AD\u134D\u12EB\u1278\u12CD \u1260\u1274\u120C\u1265\u122D \u1270\u1320\u1293\u124B\u120D\u1362\n\n\u12DB\u122C \u12E8\u12A5\u122D\u1235\u12CE \u1270\u122B \u1290\u12CD! \u12A0\u1201\u1291\u1291 \u1270\u132B\u12C8\u1271\u1293 \u12A0\u1238\u1295\u1349! \u{1F911}\u{1F4B5}",
    photo_url: "https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=800&auto=format&fit=crop&q=80",
    target: "all",
    sent_count: 40,
    created_at: new Date(Date.now() - 36e5 * 48).toISOString()
  }
];
async function persistBroadcastRecord(record) {
  if (isPostgresConfigured()) {
    const saved = await savePostgresBroadcast(record);
    if (!saved) throw new Error("Supabase PostgreSQL did not save the broadcast record");
  } else if (isProduction) {
    throw new Error("Cannot persist broadcast history: Supabase PostgreSQL is unavailable");
  } else {
    localDb.addBroadcast(record);
  }
  inMemoryBroadcastHistory.unshift(record);
  if (inMemoryBroadcastHistory.length > 200) inMemoryBroadcastHistory.pop();
}
var inMemoryMediaGallery = [
  {
    id: "med_bonus",
    url: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80",
    title: "\u12E8\u12D5\u1208\u1271 \u1266\u1290\u1235 \u12A5\u1293 \u1309\u122D\u123B (Daily Bonus)",
    category: "bonus",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "med_bingo",
    url: "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop&q=80",
    title: "\u12A0\u12F2\u1235 \u12E8\u1262\u1295\u130E \u12D9\u122D \u1300\u121D\u122F\u120D (Game Started)",
    category: "banner",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "med_winner",
    url: "https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=800&auto=format&fit=crop&q=80",
    title: "\u1273\u120B\u1245 \u12A0\u1238\u1293\u134A\u12CE\u127D (Big Jackpot Winner)",
    category: "winner",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "med_telebirr",
    url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80",
    title: "\u12E8\u1274\u120C\u1265\u122D \u12A5\u1293 \u1263\u1295\u12AD \u12F2\u1356\u12DA\u1275 (Telebirr & Bank)",
    category: "payment",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "med_gold_coins",
    url: "https://images.unsplash.com/photo-1618042164219-62c820f10723?w=800&auto=format&fit=crop&q=80",
    title: "\u12E8\u12C8\u122D\u1245 \u1233\u1295\u1272\u121E\u127D \u12A5\u1293 \u123D\u120D\u121B\u1276\u127D (Gold Coins)",
    category: "bonus",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "med_support",
    url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
    title: "\u12E8\u1233\u1208\u122A \u1262\u1295\u130E \u12A6\u134A\u1234\u120B\u12CA \u12F5\u130B\u134D (Official Support)",
    category: "support",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  }
];
async function getOrCreateTelegramUser(from, referredBy) {
  const telegramId = String(from.id);
  const username = from.username || "";
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Player";
  const playerCode = generatePlayerCode(telegramId);
  const userRole = isAdminUser(telegramId) ? "admin" : "user";
  const existing = localDb.getUser(telegramId);
  if (existing) {
    const role = isAdminUser(telegramId) ? "admin" : existing.role || "user";
    const finalBalance = Number(existing.balance ?? 0);
    existing.balance = finalBalance;
    existing.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    localDb.upsertUser({
      ...existing,
      balance: finalBalance,
      role,
      telegram_id: telegramId
    });
    const code = existing.player_code || playerCode;
    const cached = verifiedUsersCache[telegramId];
    if (cached?.phone && (!existing.phone_number || !existing.is_verified)) {
      existing.phone_number = cached.phone;
      existing.is_verified = true;
      localDb.upsertUser(existing);
    }
    const hasPhone = isUserEverVerified(telegramId) || !!(existing.phone_number && String(existing.phone_number).trim()) || !!existing.is_verified;
    const effectivePhone2 = existing.phone_number || cached?.phone || "";
    console.log(`\u2705 Returning user from Secure Local DB: ${telegramId} (@${username}), code: ${code}, balance: ${finalBalance}, phone: ${effectivePhone2 || "none"}`);
    return {
      balance: finalBalance,
      isNew: false,
      registered: true,
      hasPhone,
      phoneNumber: effectivePhone2,
      playerCode: code,
      role,
      status: existing.status || (existing.is_blocked ? "blocked" : "active"),
      user: { ...existing, phone_number: effectivePhone2, is_verified: hasPhone, player_code: code, role, balance: finalBalance }
    };
  }
  try {
    const client = getSupabase();
    if (client) {
      const { data: supaUser } = await client.from("users").select("*").eq("telegram_id", telegramId).maybeSingle();
      if (supaUser) {
        const restoredUser = localDb.upsertUser({
          telegram_id: telegramId,
          player_code: supaUser.player_code || playerCode,
          username: supaUser.username || username,
          first_name: supaUser.first_name || from.first_name || "",
          full_name: supaUser.full_name || fullName,
          phone_number: supaUser.phone_number || "",
          balance: Number(supaUser.balance ?? 0),
          role: userRole === "admin" ? "admin" : supaUser.role || "user",
          status: supaUser.status || "active",
          is_blocked: !!supaUser.is_blocked,
          is_verified: !!supaUser.is_verified || !!supaUser.phone_number,
          referral_count: Number(supaUser.referral_count) || 0,
          total_deposited: Number(supaUser.total_deposited) || 0,
          total_withdrawn: Number(supaUser.total_withdrawn) || 0,
          games_played: Number(supaUser.games_played) || 0,
          games_won: Number(supaUser.games_won) || 0,
          created_at: supaUser.created_at || (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        const hasPhone = !!(restoredUser.phone_number && String(restoredUser.phone_number).trim()) || !!restoredUser.is_verified;
        console.log(`\u2705 Restored existing user from Supabase to Local DB: ${telegramId} (@${username}), code: ${restoredUser.player_code}, balance: ${restoredUser.balance}`);
        return {
          balance: restoredUser.balance,
          isNew: false,
          registered: true,
          hasPhone,
          phoneNumber: restoredUser.phone_number || "",
          playerCode: restoredUser.player_code,
          role: restoredUser.role,
          status: restoredUser.status,
          user: restoredUser
        };
      }
    }
  } catch (err) {
    console.warn("Supabase check user error:", err);
  }
  const initialMain = 0;
  const initialPlay = 0;
  const cachedVerified = verifiedUsersCache[telegramId];
  const userEverVerified = isUserEverVerified(telegramId) || !!cachedVerified?.phone;
  const effectivePhone = cachedVerified?.phone || "";
  const createdUser = localDb.upsertUser({
    telegram_id: telegramId,
    player_code: cachedVerified?.code || playerCode,
    username,
    first_name: cachedVerified?.name || from.first_name || "",
    full_name: fullName,
    phone_number: effectivePhone,
    balance: initialMain,
    main_wallet: initialMain,
    play_wallet: initialPlay,
    role: userRole,
    status: "active",
    is_blocked: false,
    is_verified: userEverVerified,
    referred_by: referredBy && String(referredBy) !== telegramId ? String(referredBy) : void 0
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
    status: "active",
    is_blocked: false,
    is_verified: !!createdUser.phone_number,
    referred_by: createdUser.referred_by
  }).catch((err) => {
    console.warn("PostgreSQL player registration failed:", err);
    return null;
  });
  if (referredBy && String(referredBy) !== telegramId) {
    const refUser = localDb.getUser(String(referredBy));
    if (refUser) {
      const curMain = Number(refUser.main_wallet ?? refUser.balance ?? 0);
      const newPlayBal = (Number(refUser.play_wallet) || 0) + 5;
      localDb.updateUserWallets(String(referredBy), curMain, newPlayBal);
      await setPostgresUserWallets(String(referredBy), curMain, newPlayBal).catch((err) => {
        console.warn("PostgreSQL referral play wallet update failed:", err);
        return null;
      });
      refUser.referral_count = (refUser.referral_count || 0) + 1;
      console.log(`\u{1F381} Referrer ${referredBy} rewarded with +5 ETB in Play Wallet! New play balance: ${newPlayBal} ETB`);
    }
  }
  try {
    const client = getSupabase();
    if (client) {
      await upsertUserAdaptive({
        telegram_id: telegramId,
        player_code: playerCode,
        username,
        first_name: from.first_name || "",
        full_name: fullName,
        balance: initialMain,
        main_wallet: initialMain,
        play_wallet: initialPlay,
        role: userRole,
        status: "active",
        is_blocked: false,
        referred_by: referredBy && String(referredBy) !== telegramId ? String(referredBy) : void 0
      });
      console.log(`\u2705 Supabase user synced instantly: ${telegramId} (@${username})`);
    }
  } catch (err) {
    console.warn("Supabase sync warning:", err);
  }
  console.log(`\u{1F389} Successfully registered new user in Secure Local DB: ${telegramId} (@${username}, code: ${playerCode}, play_bonus: ${initialPlay} ETB, main: ${initialMain} ETB)`);
  return {
    balance: createdUser.balance,
    isNew: true,
    registered: true,
    hasPhone: userEverVerified,
    phoneNumber: effectivePhone,
    playerCode: createdUser.player_code,
    role: userRole,
    status: "active",
    user: createdUser
  };
}
async function updateUserPhone(telegramId, phoneNumber) {
  const success = localDb.updateUserPhone(telegramId, phoneNumber);
  markTelegramUserPermanentlyVerified(telegramId, phoneNumber);
  console.log(`\u2705 Secure Local DB & permanent cache phone updated for ${telegramId}: ${phoneNumber}`);
  try {
    await upsertPostgresUser({
      telegram_id: telegramId,
      phone_number: phoneNumber,
      is_verified: true,
      status: "active"
    });
  } catch {
  }
  try {
    const client = getSupabase();
    if (client) {
      void client.from("users").update({ phone_number: phoneNumber, is_verified: true, status: "active", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("telegram_id", telegramId);
    }
  } catch {
  }
  return success;
}
function getContactRequestMarkup() {
  return {
    keyboard: [
      [
        {
          text: "\u{1F4F1} \u1235\u120D\u12AD \u1241\u1325\u122D\u12CE\u1295 \u12EB\u130B\u1229 (Share Contact)",
          request_contact: true
        }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}
async function getUserBalance(telegramId) {
  const tId = String(telegramId);
  try {
    const postgresUser = await getPostgresUser(tId);
    if (postgresUser && typeof postgresUser.balance !== "undefined") {
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
      const { data: supaUser } = await client.from("users").select("balance").eq("telegram_id", tId).maybeSingle();
      if (supaUser && typeof supaUser.balance === "number") {
        localDb.updateUserBalance(tId, supaUser.balance);
        return supaUser.balance;
      }
    } catch {
    }
  }
  const user = localDb.getUser(tId);
  if (user && typeof user.balance === "number") {
    return user.balance;
  }
  return 0;
}
async function getUserFull(telegramId) {
  const tId = String(telegramId);
  try {
    const postgresUser = await getPostgresUser(tId);
    if (postgresUser) {
      const updated = localDb.upsertUser({
        telegram_id: tId,
        player_code: postgresUser.player_code,
        first_name: postgresUser.first_name || "Player",
        full_name: postgresUser.full_name || postgresUser.first_name || "Player",
        username: postgresUser.username || "",
        phone_number: postgresUser.phone_number || "",
        balance: Number(postgresUser.balance ?? 0),
        role: postgresUser.role || "user",
        status: postgresUser.status || (postgresUser.is_blocked ? "blocked" : "active"),
        is_blocked: !!postgresUser.is_blocked || postgresUser.status === "blocked",
        is_verified: !!postgresUser.is_verified || !!postgresUser.phone_number
      });
      return { ...updated, balance: Number(postgresUser.balance ?? updated.balance) };
    }
  } catch (err) {
    console.warn(`PostgreSQL profile lookup failed for ${tId}:`, err);
  }
  const client = getSupabase();
  if (client) {
    try {
      const { data: supaUser } = await client.from("users").select("*").eq("telegram_id", tId).maybeSingle();
      if (supaUser) {
        const updated = localDb.upsertUser({
          telegram_id: tId,
          player_code: supaUser.player_code,
          first_name: supaUser.first_name || "Player",
          full_name: supaUser.full_name || supaUser.first_name || "Player",
          username: supaUser.username || "",
          phone_number: supaUser.phone_number || "",
          balance: Number(supaUser.balance ?? 0),
          role: supaUser.role || (isAdminUser(tId) ? "admin" : "user"),
          status: supaUser.status || (supaUser.is_blocked ? "blocked" : "active"),
          is_blocked: !!supaUser.is_blocked || supaUser.status === "blocked",
          is_verified: !!supaUser.is_verified || !!supaUser.phone_number
        });
        return {
          ...updated,
          player_code: updated.player_code || generatePlayerCode(tId),
          role: updated.role || "user",
          balance: updated.balance ?? 0
        };
      }
    } catch {
    }
  }
  const user = localDb.getUser(tId);
  if (user) {
    const code = user.player_code || generatePlayerCode(tId);
    const role = isAdminUser(tId) ? "admin" : user.role || "user";
    const balance = Number(user.balance ?? 0);
    return {
      ...user,
      player_code: code,
      role,
      balance
    };
  }
  return null;
}
async function updateUserBalance(telegramId, newBalance) {
  const safeBal = Math.max(0, newBalance);
  const success = localDb.updateUserBalance(telegramId, safeBal, { skipLocalDevOverride: true });
  console.log(`\u2705 Secure Local DB balance updated for ${telegramId}: ${safeBal} ETB`);
  try {
    await setPostgresUserBalance(telegramId, safeBal);
  } catch (err) {
    console.warn(`PostgreSQL balance update failed for ${telegramId}:`, err);
  }
  try {
    const client = getSupabase();
    if (client) {
      const { error } = await client.from("users").update({ balance: safeBal, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("telegram_id", String(telegramId));
      if (error) {
        console.warn(`Supabase balance update error for ${telegramId}:`, error.message);
      } else {
        console.log(`\u26A1 Supabase balance update SUCCESS for ${telegramId}: ${safeBal} ETB`);
      }
    }
  } catch (err) {
    console.warn(`Supabase balance update failed for ${telegramId}:`, err.message || err);
  }
  return success;
}
function resolveBackendUrl() {
  if (process.env.BACKEND_URL && process.env.BACKEND_URL.startsWith("http") && !isStaticFrontendUrl(process.env.BACKEND_URL)) {
    return process.env.BACKEND_URL.replace(/\/$/, "");
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`.replace(/\/$/, "");
  }
  if (process.env.RAILWAY_STATIC_URL) {
    return `https://${process.env.RAILWAY_STATIC_URL}`.replace(/\/$/, "");
  }
  return "https://salery-bingo-1-production.up.railway.app";
}
function resolveWebAppUrl() {
  if (process.env.CLIENT_URL && process.env.CLIENT_URL.startsWith("http") && !process.env.CLIENT_URL.includes("ais-pre-") && !process.env.CLIENT_URL.includes("yeya-bingo")) {
    return process.env.CLIENT_URL.replace(/\/$/, "");
  }
  const cfg = localDb.getBotConfig();
  if (cfg.web_app_url && cfg.web_app_url.startsWith("http") && !cfg.web_app_url.includes("ais-pre-") && !cfg.web_app_url.includes("ais-dev-") && !cfg.web_app_url.includes("yeya-bingo")) {
    return cfg.web_app_url.replace(/\/$/, "");
  }
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.startsWith("http") && !process.env.FRONTEND_URL.includes("ais-pre-") && !process.env.FRONTEND_URL.includes("yeya-bingo")) {
    return process.env.FRONTEND_URL.replace(/\/$/, "");
  }
  if (process.env.APP_URL && process.env.APP_URL.startsWith("http") && !process.env.APP_URL.includes("ais-pre-") && !process.env.APP_URL.includes("yeya-bingo")) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  return "https://salery-bingo-1.vercel.app";
}
function buildWebAppUrl(rawUrl, userId, balance) {
  let base = (rawUrl || "").trim();
  if (!base || base.includes("ais-pre-") || base.includes("ais-dev-") || base.includes("yeya-bingo") || base === "https://your-app.netlify.app") {
    base = resolveWebAppUrl();
  }
  const backendUrl = resolveBackendUrl();
  try {
    const parsed = new URL(base);
    if (userId) {
      parsed.searchParams.set("user_id", String(userId));
    }
    if (typeof balance === "number") {
      parsed.searchParams.set("bal", String(balance));
    }
    if (backendUrl) {
      parsed.searchParams.set("backend", backendUrl);
    }
    parsed.searchParams.set("v", String(Date.now()));
    return parsed.toString();
  } catch {
    let res = base;
    const sep = res.includes("?") ? "&" : "?";
    res += `${sep}v=${Date.now()}`;
    if (userId) res += `&user_id=${userId}`;
    if (typeof balance === "number") res += `&bal=${balance}`;
    if (backendUrl) res += `&backend=${encodeURIComponent(backendUrl)}`;
    return res;
  }
}
function getMainMenuMarkup(webAppUrl, userId, balance) {
  const finalUrl = buildWebAppUrl(webAppUrl, userId, balance);
  const playLabel = "Play \u{1F3AE}";
  const isAdmin = isAdminUser(userId);
  const keyboard = [
    [
      {
        text: playLabel,
        web_app: { url: finalUrl }
      }
    ]
  ];
  if (isAdmin) {
    const adminUrl = finalUrl.includes("?") ? `${finalUrl}&view=admin` : `${finalUrl}?view=admin`;
    keyboard.push([
      {
        text: "\u{1F451} Admin Control Panel \u{1F4CA}",
        web_app: { url: adminUrl }
      }
    ]);
  }
  keyboard.push(
    [
      { text: "Balance \u{1F4B5}", callback_data: "btn_balance" },
      { text: "Deposit \u{1F4B0}", callback_data: "btn_deposit" }
    ],
    [
      { text: "Withdraw \u{1F911}", callback_data: "btn_withdraw" },
      { text: "Transfer \u{1F381}", callback_data: "btn_transfer" }
    ],
    [
      { text: "Instruction \u{1F4D6}", callback_data: "btn_instruction" },
      { text: "Contact Support \u{1F4DE}", callback_data: "btn_support" }
    ],
    [
      { text: "Invite \u{1F517}", callback_data: "btn_invite" }
    ]
  );
  return { inline_keyboard: keyboard };
}
function getReplyMenuMarkup(webAppUrl, userId, balance) {
  const finalUrl = buildWebAppUrl(webAppUrl, userId, balance);
  return {
    keyboard: [
      [{ text: "Play \u{1F3AE}", web_app: { url: finalUrl } }],
      [{ text: "Balance \u{1F4B5}" }, { text: "Deposit \u{1F4B0}" }],
      [{ text: "Withdraw \u{1F911}" }, { text: "Transfer \u{1F381}" }],
      [{ text: "Instruction \u{1F4D6}" }, { text: "Contact Support \u{1F4DE}" }],
      [{ text: "Invite \u{1F517}" }]
    ],
    resize_keyboard: true
  };
}
async function getTelegramFileDirectUrl(botToken, fileId) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const data = await res.json();
    if (data.ok && data.result && data.result.file_path) {
      return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
    }
    return null;
  } catch (err) {
    console.error("getTelegramFileDirectUrl error:", err);
    return null;
  }
}
async function sendTelegramMessage(botToken, chatId, text, replyMarkup) {
  if (!botToken || !chatId) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      })
    });
    const data = await res.json();
    if (data && data.ok) return data;
    if (replyMarkup) {
      try {
        const retryRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML"
          })
        });
        const retryData = await retryRes.json();
        if (retryData && retryData.ok) return retryData;
      } catch (retryErr) {
        console.warn("Retry sendMessage without markup failed:", retryErr);
      }
    }
    try {
      const plainRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text
        })
      });
      return await plainRes.json();
    } catch (plainErr) {
      console.warn("Retry sendMessage plain text failed:", plainErr);
    }
    return data;
  } catch (err) {
    console.error("sendTelegramMessage error:", err);
    return null;
  }
}
async function sendTelegramPhoto(botToken, chatId, photoUrl, caption, replyMarkup) {
  if (!botToken || !chatId) return null;
  const safeCaption = caption && caption.length > 1020 ? caption.slice(0, 1017) + "..." : caption;
  const rawPhoto = (photoUrl || "").trim();
  if (rawPhoto.startsWith("/")) {
    const localPath = path2.join(process.cwd(), "public", rawPhoto);
    if (fs2.existsSync(localPath)) {
      try {
        const buffer = fs2.readFileSync(localPath);
        const ext = path2.extname(localPath).replace(".", "") || "jpg";
        const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        const blob = new Blob([buffer], { type: mimeType });
        const formData = new FormData();
        formData.append("chat_id", String(chatId));
        formData.append("photo", blob, `photo.${ext}`);
        if (safeCaption) formData.append("caption", safeCaption);
        formData.append("parse_mode", "HTML");
        if (replyMarkup) {
          formData.append(
            "reply_markup",
            typeof replyMarkup === "string" ? replyMarkup : JSON.stringify(replyMarkup)
          );
        }
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: "POST",
          body: formData
        });
        const data = await res.json();
        if (data && data.ok) return data;
        if (replyMarkup) {
          try {
            const retryFormData = new FormData();
            retryFormData.append("chat_id", String(chatId));
            retryFormData.append("photo", blob, `photo.${ext}`);
            if (safeCaption) retryFormData.append("caption", safeCaption);
            retryFormData.append("parse_mode", "HTML");
            const retryRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
              method: "POST",
              body: retryFormData
            });
            const retryData = await retryRes.json();
            if (retryData && retryData.ok) return retryData;
          } catch {
          }
        }
      } catch (localErr) {
        console.warn("Local file multipart sendPhoto error:", localErr);
      }
    }
  }
  let fullPhotoUrl = rawPhoto;
  if (fullPhotoUrl.startsWith("/")) {
    const webAppUrl = resolveWebAppUrl();
    fullPhotoUrl = `${webAppUrl.replace(/\/$/, "")}${fullPhotoUrl}`;
  }
  try {
    if (fullPhotoUrl && fullPhotoUrl.startsWith("data:")) {
      try {
        const matches = fullPhotoUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, "base64");
          const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
          const blob = new Blob([buffer], { type: mimeType });
          const formData = new FormData();
          formData.append("chat_id", String(chatId));
          formData.append("photo", blob, `photo.${ext}`);
          if (safeCaption) formData.append("caption", safeCaption);
          formData.append("parse_mode", "HTML");
          if (replyMarkup) {
            formData.append(
              "reply_markup",
              typeof replyMarkup === "string" ? replyMarkup : JSON.stringify(replyMarkup)
            );
          }
          const res2 = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: "POST",
            body: formData
          });
          const data2 = await res2.json();
          if (data2 && data2.ok) return data2;
          if (replyMarkup) {
            try {
              const retryFormData = new FormData();
              retryFormData.append("chat_id", String(chatId));
              retryFormData.append("photo", blob, `photo.${ext}`);
              if (safeCaption) retryFormData.append("caption", safeCaption);
              retryFormData.append("parse_mode", "HTML");
              const retryRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: "POST",
                body: retryFormData
              });
              const retryData = await retryRes.json();
              if (retryData && retryData.ok) return retryData;
            } catch {
            }
          }
          return await sendTelegramMessage(botToken, chatId, safeCaption, replyMarkup);
        }
      } catch (uploadErr) {
        return await sendTelegramMessage(botToken, chatId, safeCaption, replyMarkup);
      }
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: fullPhotoUrl,
        caption: safeCaption,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      }),
      signal: AbortSignal.timeout(4e3)
    });
    const data = await res.json();
    if (!data.ok) {
      if (replyMarkup) {
        try {
          const retryRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              photo: fullPhotoUrl,
              caption: safeCaption,
              parse_mode: "HTML"
            }),
            signal: AbortSignal.timeout(3e3)
          });
          const retryData = await retryRes.json();
          if (retryData && retryData.ok) return retryData;
        } catch {
        }
      }
      return await sendTelegramMessage(botToken, chatId, safeCaption, replyMarkup);
    }
    return data;
  } catch (err) {
    return await sendTelegramMessage(botToken, chatId, safeCaption, replyMarkup);
  }
}
async function answerCallbackQuery(botToken, queryId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: queryId,
        text: text || ""
      })
    });
  } catch (err) {
    console.error("answerCallbackQuery error:", err);
  }
}
var userDepositSessions = /* @__PURE__ */ new Map();
var userWithdrawSessions = /* @__PURE__ */ new Map();
async function processTelegramUpdate(update, botToken) {
  try {
    const webAppUrl = resolveWebAppUrl();
    const botUsername = (process.env.VITE_BOT_USERNAME || activeBotUsername || "Salerybingo_bot").replace("@", "");
    const anyFromUser = update?.message?.from || update?.callback_query?.from;
    if (anyFromUser && anyFromUser.id) {
      getOrCreateTelegramUser(anyFromUser).catch(
        (err) => console.warn(`Failed to auto-upsert user ${anyFromUser.id}:`, err)
      );
      if (!isAdminUser(anyFromUser.id)) {
        const checkedUser = localDb.getUser(anyFromUser.id);
        if (checkedUser && (checkedUser.is_blocked || checkedUser.status === "blocked")) {
          const banReason = checkedUser.ban_reason || "\u12E8\u12A0\u1308\u120D\u130D\u120E\u1275 \u12F0\u1295\u1265 \u1218\u1323\u1235 (Terms Violation)";
          const banNotice = `\u{1F6AB} <b>\u12ED\u1245\u122D\u1273\u1363 \u12A0\u12AB\u12CD\u1295\u1275\u12CE \u1273\u130D\u12F7\u120D (Account Suspended)!</b>

\u{1F464} <b>\u1270\u132B\u12CB\u127D\u1366</b> ${checkedUser.first_name || "Player"}
\u{1F194} <b>Player Code\u1366</b> <code>${checkedUser.player_code}</code>
\u26A0\uFE0F <b>\u12E8\u12A5\u1308\u12F3 \u121D\u12AD\u1295\u12EB\u1275\u1366</b> ${banReason}

\u1208\u1270\u1328\u121B\u122A \u1218\u1228\u1303 \u12A5\u1263\u12AD\u12CE \u12CB\u1293 \u12A0\u1235\u1270\u12F3\u12F3\u122A\u12CD\u1295 (Admin) \u12EB\u1290\u130B\u130D\u1229\u1362`;
          const targetChat = update?.message?.chat?.id || anyFromUser.id;
          await sendTelegramMessage(botToken, targetChat, banNotice);
          return;
        }
      }
    }
    if (update && update.message && update.message.contact) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const contact = msg.contact;
      const fromUser = msg.from || { id: chatId };
      const rawPhone = String(contact.phone_number || "").trim();
      const phoneNumber = rawPhone.startsWith("+") ? rawPhone : rawPhone.startsWith("0") ? `+251${rawPhone.slice(1)}` : `+${rawPhone}`;
      const contactFirstName = contact.first_name || fromUser.first_name || "Player";
      const contactFullName = [contact.first_name || fromUser.first_name, contact.last_name || fromUser.last_name].filter(Boolean).join(" ") || "Player";
      console.log(`\u{1F4F2} User ${chatId} (@${fromUser.username}) shared phone: ${phoneNumber}, name: ${contactFullName}`);
      const existingBefore = localDb.getUser(fromUser.id);
      const wasAlreadyRegistered = !!(existingBefore && (existingBefore.phone_number || existingBefore.is_verified));
      const userResult = await getOrCreateTelegramUser(fromUser);
      const playerCode = existingBefore?.player_code || userResult.playerCode || generatePlayerCode(fromUser.id);
      const userBal = existingBefore?.balance !== void 0 ? existingBefore.balance : userResult.balance ?? 0;
      const localUpdated = localDb.upsertUser({
        telegram_id: String(fromUser.id),
        player_code: playerCode,
        first_name: contactFirstName,
        full_name: contactFullName,
        username: fromUser.username || "",
        phone_number: phoneNumber,
        balance: userBal,
        is_verified: true,
        status: "active",
        role: isAdminUser(fromUser.id) ? "admin" : existingBefore?.role || "user"
      });
      await updateUserPhone(String(fromUser.id), phoneNumber);
      try {
        const client = getSupabase();
        if (client) {
          const supaRes = await upsertUserAdaptive({
            telegram_id: String(fromUser.id),
            player_code: playerCode,
            first_name: contactFirstName,
            full_name: contactFullName,
            username: fromUser.username || "",
            phone_number: phoneNumber,
            is_verified: true,
            status: "active",
            balance: userBal,
            role: isAdminUser(fromUser.id) ? "admin" : existingBefore?.role || "user"
          });
          console.log(`\u2705 [Supabase] Full user contact registered to Supabase: ${fromUser.id} (${phoneNumber})`, supaRes?.error ? supaRes.error : "OK");
        }
      } catch (supaErr) {
        console.warn("Supabase contact registration warning:", supaErr);
      }
      let confirmMsg;
      if (wasAlreadyRegistered) {
        confirmMsg = `\u2705 <b>\u12E8\u12A5\u122D\u1235\u12CE \u1218\u1208\u12EB \u1240\u12F5\u121E\u12CD\u1291 \u12E8\u1270\u1218\u12D8\u1308\u1260 \u1290\u12CD!</b>

\u{1F464} <b>\u1270\u132B\u12CB\u127D\u1366</b> ${contactFirstName}
\u{1F194} <b>Player Code\u1366</b> <code>${playerCode}</code>
\u{1F4F1} <b>\u12E8\u1270\u1218\u12D8\u1308\u1260 \u1235\u120D\u12AD\u1366</b> <code>${phoneNumber}</code>
\u{1F4B0} <b>\u12E8\u12A0\u1201\u1291 \u1240\u122A \u1202\u1233\u1265\u12CE\u1366</b> <b>${userBal.toLocaleString()} ETB</b>

\u12AB\u1246\u1219\u1260\u1275 \u1208\u1218\u1240\u1320\u120D \u12A8\u1273\u127D <b>"Play \u{1F3AE}"</b> \u12E8\u121A\u1208\u12CD\u1295 \u12ED\u132B\u1291!`;
      } else {
        confirmMsg = `\u2705 <b>\u121D\u12DD\u1308\u1263\u12CE \u1260\u1270\u1233\u12AB \u1201\u1294\u1273 \u1270\u1320\u1293\u124B\u120D!</b>

\u{1F464} <b>\u1270\u132B\u12CB\u127D\u1366</b> ${contactFirstName}
\u{1F194} <b>Player Code\u1366</b> <code>${playerCode}</code>
\u{1F4F1} <b>\u12E8\u1270\u1218\u12D8\u1308\u1260 \u1235\u120D\u12AD\u1366</b> <code>${phoneNumber}</code>
\u{1F4B0} <b>\u12E8\u12A0\u1201\u1291 \u1240\u122A \u1202\u1233\u1265\u12CE\u1366</b> <b>${userBal.toLocaleString()} ETB</b>

\u12A8\u1273\u127D <b>"Play \u{1F3AE}"</b> \u12E8\u121A\u1208\u12CD\u1295 \u1260\u1218\u132B\u1295 \u1328\u12CB\u1273\u12CD\u1295 \u1218\u1300\u1218\u122D \u12ED\u127D\u120B\u1209!`;
      }
      await sendTelegramMessage(botToken, chatId, confirmMsg, getMainMenuMarkup(webAppUrl, fromUser.id, userBal));
      try {
        await sendTelegramMessage(
          botToken,
          chatId,
          `\u{1F447} <i>\u12E8\u1273\u127D\u129B\u12CD \u121D\u1293\u120C (Main Menu) \u1270\u12D8\u130B\u1305\u1277\u120D\u1366</i>`,
          getReplyMenuMarkup(webAppUrl, fromUser.id, userBal)
        );
      } catch {
      }
      return;
    }
    if (update && update.message && (update.message.photo || update.message.document)) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const fromUser = msg.from || { id: chatId };
      const caption = (msg.caption || "").trim();
      let fileId = "";
      if (Array.isArray(msg.photo) && msg.photo.length > 0) {
        fileId = msg.photo[msg.photo.length - 1].file_id;
      } else if (msg.document && msg.document.file_id) {
        fileId = msg.document.file_id;
      }
      if (fileId) {
        let fullUser = await getUserFull(fromUser.id);
        if (!fullUser) {
          const registered = localDb.upsertUser({
            telegram_id: String(fromUser.id),
            player_code: generatePlayerCode(fromUser.id),
            first_name: fromUser.first_name || "Player",
            full_name: (fromUser.first_name || "Player") + (fromUser.last_name ? " " + fromUser.last_name : ""),
            username: fromUser.username || "",
            balance: 0,
            role: "user",
            status: "active"
          });
          fullUser = {
            ...registered,
            role: "user",
            balance: 0,
            player_code: registered.player_code
          };
          try {
            await upsertUserAdaptive(registered);
          } catch {
          }
        }
        const playerCode = fullUser?.player_code || generatePlayerCode(fromUser.id);
        const playerName = fromUser.first_name || fullUser?.first_name || "Player";
        const phoneNumber = fullUser?.phone_number || "";
        const userSession = userDepositSessions.get(String(fromUser.id));
        let parsedAmount = userSession?.amount || 100;
        if (!userSession?.amount && caption) {
          const amountMatch = caption.match(/(\d+)/);
          if (amountMatch) {
            const found = parseInt(amountMatch[1], 10);
            if (found >= 10) parsedAmount = found;
          }
        }
        userDepositSessions.delete(String(fromUser.id));
        const directPhotoUrl = await getTelegramFileDirectUrl(botToken, fileId);
        const txId = "dep_tg_" + Date.now() + "_" + Math.floor(Math.random() * 1e3);
        const photoProxyUrl = `/api/telegram-photo/${fileId}`;
        const newTx = {
          id: txId,
          telegram_id: String(fromUser.id),
          player_name: playerName,
          player_code: playerCode,
          phone_number: phoneNumber,
          type: "deposit",
          amount: parsedAmount,
          status: "pending",
          reference: caption ? `Deposit ${parsedAmount} ETB: ${caption}` : `Deposit ${parsedAmount} ETB Screenshot`,
          screenshot_url: directPhotoUrl || photoProxyUrl,
          photo_file_id: fileId,
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          notes: caption ? `Caption: ${caption} | Requested: ${parsedAmount} ETB` : `Telegram screenshot upload (${parsedAmount} ETB)`
        };
        localDb.addTransaction(newTx);
        try {
          await savePostgresTransaction(newTx);
        } catch {
        }
        try {
          const supaClient = getSupabase();
          if (supaClient) {
            void (async () => {
              try {
                const localUser = localDb.getUser(newTx.telegram_id);
                if (localUser) {
                  await upsertUserAdaptive(localUser);
                }
                await supaClient.from("transactions").insert([{
                  id: newTx.id,
                  telegram_id: newTx.telegram_id,
                  player_name: newTx.player_name,
                  player_code: newTx.player_code,
                  phone_number: newTx.phone_number || "",
                  type: newTx.type,
                  amount: newTx.amount,
                  status: newTx.status,
                  reference: newTx.reference || "",
                  screenshot_url: newTx.screenshot_url || "",
                  photo_file_id: newTx.photo_file_id || "",
                  notes: newTx.notes || "",
                  created_at: newTx.created_at
                }]);
              } catch {
              }
            })();
          }
        } catch {
        }
        fetch("https://salery-bingo-1.vercel.app/api/transactions/deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
            notes: newTx.notes
          })
        }).catch(() => {
        });
        const adminId = "908336796";
        const adminLink = `https://salery-bingo-1.vercel.app/admin`;
        const adminAlertText = `\u{1F514} <b>\u12A0\u12F2\u1235 \u12E8\u12F2\u1356\u12DA\u1275 \u1325\u12EB\u1244 \u1240\u122D\u1267\u120D!</b>

\u{1F464} <b>\u1270\u132B\u12CB\u127D\u1366</b> ${playerName} (<code>${playerCode}</code>)
\u{1F4B0} <b>\u1218\u1320\u1295\u1366</b> <b>${parsedAmount} ETB</b>
\u{1F4F1} <b>\u1235\u120D\u12AD\u1366</b> <code>${phoneNumber || "\u12EB\u120D\u1270\u1308\u1208\u1338"}</code>
\u{1F194} <b>Telegram ID\u1366</b> <code>${fromUser.id}</code>

\u{1F447} <b>\u1260\u12A0\u12F5\u121A\u1295 \u1353\u1290\u120D \u1208\u121B\u133D\u12F0\u1245 \u12C8\u12ED\u121D \u12CD\u12F5\u1245 \u1208\u121B\u12F5\u1228\u130D \u12A5\u12DA\u1205 \u12ED\u132B\u1291\u1366</b>`;
        try {
          if (fileId) {
            await sendTelegramPhoto(botToken, Number(adminId), fileId, adminAlertText, {
              inline_keyboard: [
                [{ text: "\u{1F451} \u12A0\u12F5\u121A\u1295 \u1353\u1290\u120D \u12AD\u1348\u1275 (Open Admin)", url: adminLink }]
              ]
            });
          } else {
            await sendTelegramMessage(botToken, adminId, adminAlertText, {
              inline_keyboard: [
                [{ text: "\u{1F451} \u12A0\u12F5\u121A\u1295 \u1353\u1290\u120D \u12AD\u1348\u1275 (Open Admin)", url: adminLink }]
              ]
            });
          }
        } catch {
          sendTelegramMessage(botToken, adminId, adminAlertText, {
            inline_keyboard: [
              [{ text: "\u{1F451} \u12A0\u12F5\u121A\u1295 \u1353\u1290\u120D \u12AD\u1348\u1275 (Open Admin)", url: adminLink }]
            ]
          }).catch(() => {
          });
        }
        const userReply = `\u2705 <b>\u12E8 ${parsedAmount} ETB \u12E8\u12AD\u134D\u12EB \u12F0\u1228\u1230\u129D\u12CE \u12F0\u122D\u1236\u1293\u120D!</b>

\u{1F194} <b>Player Code\u1366</b> <code>${playerCode}</code>
\u{1F4B0} <b>\u12E8\u1270\u1320\u12E8\u1240\u12CD \u1218\u1320\u1295\u1366</b> <b>${parsedAmount} ETB</b>

\u1325\u12EB\u1244\u12CE \u12A5\u1295\u12F0\u1270\u1228\u130B\u1308\u1320 \u1202\u1233\u1265\u12CE \u12C8\u12F2\u12EB\u12CD\u1291 \u12ED\u121E\u120B\u120D\u12CE\u1273\u120D\u1362 \u12A5\u1293\u1218\u1230\u130D\u1293\u1208\u1295! \u{1F3AE}`;
        await sendTelegramMessage(botToken, chatId, userReply, getMainMenuMarkup(webAppUrl, fromUser.id));
        return;
      }
    }
    if (update && update.message && update.message.text) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const rawText = String(msg.text).trim();
      const text = rawText.toLowerCase();
      const fromUser = msg.from || { id: chatId };
      console.log(`Telegram message from ${chatId} (@${fromUser.username}): "${rawText}"`);
      if (text === "/test" || text === "/debug" || text === "/status") {
        const dbStatus = localDb.getStatus();
        const debugMsg = `\u{1F6E1}\uFE0F <b>\u12E8\u1233\u1208\u122A \u1262\u1295\u130E \u12E8\u12F3\u1273\u1264\u12DD \u12F0\u1205\u1295\u1290\u1275 \u1201\u1294\u1273 (Database Security)</b>

\u2022 <b>\u12E8\u12F3\u1273\u1264\u12DD \u12A0\u12ED\u1290\u1275\u1366</b> \u{1F512} \u122B\u1231\u1295 \u12E8\u127B\u1208 \u1230\u122D\u1268\u122D \u12F3\u1273\u1264\u12DD (Local Secure Storage)
\u2022 <b>\u12E8\u12F0\u1205\u1295\u1290\u1275 \u12F0\u1228\u1303\u1366</b> \u{1F6E1}\uFE0F 100% \u12A8\u134D\u1270\u129B (\u12A8\u121B\u1295\u129B\u12CD\u121D \u12E8\u12CD\u132A \u12A0\u12F0\u130B \u12A5\u1293 \u12A8\u1231\u1353\u1264\u12DD \u1325\u1308\u129D\u1290\u1275 \u1290\u133B)
\u2022 <b>\u1320\u1245\u120B\u120B \u1270\u132B\u12CB\u127E\u127D\u1366</b> ${dbStatus.totalUsers}
\u2022 <b>\u1295\u1241 \u1270\u132B\u12CB\u127E\u127D\u1366</b> ${dbStatus.activeUsers}
\u2022 <b>\u1320\u1245\u120B\u120B \u1202\u1233\u1265\u1366</b> ${dbStatus.totalBalance.toLocaleString()} ETB
\u2022 <b>\u12E8\u1270\u1218\u12D8\u1308\u1261 \u12E8\u12AD\u134D\u12EB \u1325\u12EB\u1244\u12CE\u127D\u1366</b> ${dbStatus.totalTransactions} (${dbStatus.pendingTransactions} \u1260\u1218\u1320\u1263\u1260\u1245 \u120B\u12ED)
\u2022 <b>\u12E8\u12F3\u1273 \u12F0\u1205\u1295\u1290\u1275\u1366</b> \u2705 \u1260\u1230\u122D\u1268\u1229 \u12CD\u1235\u1325 \u1260\u124B\u121A\u1290\u1275 \u1270\u1240\u121D\u1327\u120D (Auto-persisted to disk)

\u{1F512} <i>\u121B\u1235\u1273\u12C8\u123B\u1366 \u12F3\u1273\u1264\u12D9 \u1260\u122B\u1231 \u1230\u122D\u1268\u122D \u120B\u12ED \u1265\u127B \u12E8\u1270\u1218\u1230\u1228\u1270 \u1260\u1218\u1206\u1291 \u12A8\u121B\u1295\u129B\u12CD\u121D \u1236\u1235\u1270\u129B \u12C8\u1308\u1295 \u12C8\u12ED\u121D \u12E8\u1231\u1353\u1264\u12DD \u12A0\u12F0\u130B \u1219\u1209 \u1260\u1219\u1209 \u12E8\u1270\u1320\u1260\u1240 \u1290\u12CD\u1362</i>`;
        await sendTelegramMessage(botToken, chatId, debugMsg);
        return;
      }
      if (text === "/register" || text === "/phone" || text === "/contact" || text === "\u{1F4F1} \u1235\u120D\u12AD \u1241\u1325\u122D \u12EB\u130B\u1229" || text === "share contact") {
        const u = localDb.getUser(fromUser.id);
        const hasVerifiedPhone = !!(u?.phone_number && String(u?.phone_number).trim()) || !!u?.is_verified;
        if (hasVerifiedPhone) {
          const registeredMsg = `\u2705 <b>\u12E8\u12A5\u122D\u1235\u12CE \u1235\u120D\u12AD \u1241\u1325\u122D \u1240\u12F5\u121E\u12CD\u1291 \u1270\u1218\u12DD\u130D\u1267\u120D!</b>

\u{1F4F1} <b>\u12E8\u1270\u1218\u12D8\u1308\u1260 \u1235\u120D\u12AD\u1366</b> <code>${u?.phone_number || ""}</code>
\u{1F194} <b>Player Code\u1366</b> <code>${u?.player_code || ""}</code>

\u1328\u12CB\u1273\u12CD\u1295 \u1208\u1218\u1300\u1218\u122D <b>"Play \u{1F3AE}"</b> \u12E8\u121A\u1208\u12CD\u1295 \u12ED\u132B\u1291!`;
          await sendTelegramMessage(botToken, chatId, registeredMsg, getMainMenuMarkup(webAppUrl, fromUser.id, u?.balance));
          return;
        }
        const contactPromptText = `\u{1F4F1} <b>\u1235\u120D\u12AD \u1241\u1325\u122D\u12CE\u1295 \u12EB\u1235\u1218\u12DD\u130D\u1261 (Share Contact)</b>

\u12E8\u1274\u120C\u130D\u122B\u121D \u1235\u120D\u12AD \u1241\u1325\u122D\u12CE\u1295 \u1260\u1245\u133D\u1260\u1275 \u1208\u121B\u1235\u1218\u12DD\u1308\u1265 \u12A8\u1273\u127D \u12EB\u1208\u12CD\u1295 <b>\xAB\u{1F4F1} \u1235\u120D\u12AD \u1241\u1325\u122D\u12CE\u1295 \u12EB\u130B\u1229 (Share Contact)\xBB</b> \u12E8\u121A\u1208\u12CD\u1295 \u12A0\u12DD\u122B\u122D \u12ED\u132B\u1291\u1366`;
        await sendTelegramMessage(botToken, chatId, contactPromptText, getContactRequestMarkup());
        return;
      }
      if (text === "/admin" || text === "/dashboard" || text === "/players" || text === "/deposits" || text === "/pending") {
        const isAdmin = isAdminUser(fromUser.id);
        const allUsers = localDb.getAllUsers().filter((u) => u.role !== "admin" && String(u.telegram_id) !== "908336796");
        const totalUsers = allUsers.length;
        const totalBalance = allUsers.reduce((acc, u) => acc + (Number(u.balance) || 0), 0);
        const pendingTxs = localDb.getTransactions({ status: "pending" });
        const pendingDeposits = pendingTxs.filter((t) => t.type === "deposit");
        const pendingWithdraws = pendingTxs.filter((t) => t.type === "withdraw");
        const playersListText = allUsers.slice(0, 10).map((u, idx) => {
          const code = u.player_code || generatePlayerCode(u.telegram_id);
          const name = u.first_name || u.username || "Player";
          const phone = u.phone_number ? `\u{1F4F1} <code>${u.phone_number}</code>` : "\u{1F4F1} <i>\u1235\u120D\u12AD \u12A0\u120D\u1270\u1218\u12D8\u1308\u1260\u121D</i>";
          return `${idx + 1}. \u{1F464} <b>${name}</b> (${code})
   ${phone} | \u{1F4B0} <b>${u.balance || 0} ETB</b> | ID: <code>${u.telegram_id}</code>`;
        }).join("\n\n");
        const pendingDepText = pendingDeposits.length > 0 ? pendingDeposits.map((tx, idx) => {
          return `${idx + 1}. \u{1F4B0} <b>${tx.amount} ETB</b> \u2014 ${tx.player_name} (${tx.player_code})
   \u{1F4F1} ${tx.phone_number || "\u1235\u120D\u12AD \u12E8\u1208\u121D"} | \u23F0 ${new Date(tx.created_at).toLocaleTimeString()}`;
        }).join("\n") : "\u2705 \u121D\u1295\u121D \u12EB\u120D\u1270\u1228\u130B\u1308\u1320 \u12E8\u12F2\u1356\u12DA\u1275 \u1325\u12EB\u1244 \u12E8\u1208\u121D";
        const adminUrl = "https://salery-bingo-1.vercel.app/?view=admin";
        const adminMsg = `\u{1F451} <b>\u12E8\u1233\u1208\u122A \u1262\u1295\u130E \u12A0\u12F5\u121A\u1295 \u1218\u1246\u1323\u1320\u122A\u12EB \u1353\u1290\u120D (Admin Panel)</b>

\u{1F465} <b>\u1320\u1245\u120B\u120B \u12E8\u1270\u1218\u12D8\u1308\u1261 \u1270\u132B\u12CB\u127E\u127D\u1366</b> <b>${totalUsers}</b>
\u{1F4B0} <b>\u12E8\u1270\u132B\u12CB\u127E\u127D \u1320\u1245\u120B\u120B \u1202\u1233\u1265\u1366</b> <b>${totalBalance.toLocaleString()} ETB</b>
\u{1F4E5} <b>\u12EB\u120D\u1270\u1228\u130B\u1308\u1321 \u12F2\u1356\u12DA\u1276\u127D\u1366</b> <b>${pendingDeposits.length}</b>
\u{1F4E4} <b>\u12E8\u1308\u1295\u12D8\u1265 \u121B\u12CD\u132B \u1325\u12EB\u1244\u12CE\u127D\u1366</b> <b>${pendingWithdraws.length}</b>

\u{1F4CB} <b>\u12E8\u1270\u1218\u12D8\u1308\u1261 \u1270\u132B\u12CB\u127E\u127D \u12A5\u1293 \u1235\u120D\u12AD \u1241\u1325\u122B\u1278\u12CD\u1366</b>
` + (playersListText || "\u1270\u132B\u12CB\u127E\u127D \u12A5\u1235\u12AB\u1201\u1295 \u12A0\u120D\u1270\u1308\u1299\u121D") + (pendingDeposits.length > 0 ? `

\u{1F4F8} <b>\u1260\u1218\u1320\u1263\u1260\u1245 \u120B\u12ED \u12EB\u1209 \u12F2\u1356\u12DA\u1276\u127D\u1366</b>
${pendingDepText}` : "") + `

\u12AD\u134D\u12EB\u12CE\u127D\u1295 \u1260\u1240\u1325\u1273 \u1208\u121B\u133D\u12F0\u1245 \u12C8\u12ED\u121D \u1208\u1218\u1246\u1323\u1320\u122D \u12A8\u1273\u127D \u12EB\u1209\u1275\u1295 \u12A0\u12DD\u122B\u122E\u127D \u12ED\u1320\u1240\u1219\u1366`;
        const keyboardButtons = [];
        for (const dep of pendingDeposits.slice(0, 3)) {
          keyboardButtons.push([
            { text: `\u2705 Approve ${dep.amount} ETB (${dep.player_name})`, callback_data: `adm_app_${dep.id}` },
            { text: `\u274C Reject`, callback_data: `adm_rej_${dep.id}` }
          ]);
        }
        keyboardButtons.push([
          {
            text: "\u{1F451} Open Web Admin Panel \u{1F4CA}",
            web_app: { url: adminUrl }
          }
        ]);
        keyboardButtons.push([
          { text: `\u{1F504} Refresh Stats (${totalUsers} Users)`, callback_data: "adm_refresh" },
          { text: "\u{1F3AE} Play Game", web_app: { url: buildWebAppUrl(webAppUrl, fromUser.id, 0) } }
        ]);
        const adminKeyboard = { inline_keyboard: keyboardButtons };
        await sendTelegramMessage(botToken, chatId, adminMsg, adminKeyboard);
        return;
      }
      if (text.startsWith("/setweb") || text.startsWith("/seturl") || text.startsWith("/url")) {
        const isAdmin = isAdminUser(fromUser.id);
        if (!isAdmin) {
          await sendTelegramMessage(botToken, chatId, "\u26A0\uFE0F \u12ED\u1205 \u1275\u12D5\u12DB\u12DD \u1208\u12A0\u12F5\u121A\u1295 \u1265\u127B \u12E8\u1270\u1348\u1240\u12F0 \u1290\u12CD! (Admin access only)");
          return;
        }
        const parts = rawText.split(/\s+/);
        if (parts.length < 2 || !parts[1].startsWith("http")) {
          await sendTelegramMessage(
            botToken,
            chatId,
            `\u2139\uFE0F <b>\u12E8\u12CC\u1265\u12A0\u1355 \u12A0\u12F5\u122B\u123B (WebApp URL) \u1208\u121B\u1235\u1270\u12AB\u12A8\u120D\u1366</b>
<code>/setweb https://salery-bingo-1.vercel.app</code>

\u12E8\u12A0\u1201\u1291 \u12A0\u12F5\u122B\u123B\u1366 <code>${webAppUrl}</code>`
          );
          return;
        }
        const newUrl = parts[1].trim().replace(/\/$/, "");
        localDb.saveBotConfig(activeBotToken, activeBotUsername, newUrl);
        await sendTelegramMessage(
          botToken,
          chatId,
          `\u2705 <b>\u12E8\u12CC\u1265\u12A0\u1355 \u12A0\u12F5\u122B\u123B \u1260\u1270\u1233\u12AB \u1201\u1294\u1273 \u1270\u1240\u12ED\u122F\u120D!</b>

\u{1F310} \u12A0\u12F2\u1231 \u12A0\u12F5\u122B\u123B\u1366 <code>${newUrl}</code>

\u12A8\u12A0\u1201\u1295 \u1260\u128B\u120B \u1270\u132B\u12CB\u127E\u127D \u130C\u1219\u1295 \u1232\u12A8\u134D\u1271 \u121D\u1295\u121D \u12A0\u12ED\u1290\u1275 \u12E8Google Sign-in \u1233\u12ED\u1320\u12ED\u1243\u1278\u12CD \u1260\u1240\u1325\u1273 \u1260\u1230\u12A8\u1295\u12F5 \u12CD\u1235\u1325 \u12ED\u12A8\u1348\u1275\u120B\u1278\u12CB\u120D!`
        );
        return;
      }
      if (text.startsWith("/setadmin") || text.startsWith("/makeadmin")) {
        const parts = rawText.split(/\s+/);
        const targetId = parts[1] ? parts[1].trim() : String(fromUser.id);
        localDb.upsertUser({
          telegram_id: targetId,
          role: "admin",
          balance: 0,
          status: "active",
          is_verified: true
        });
        await sendTelegramMessage(botToken, chatId, `\u{1F451} <b>ID <code>${targetId}</code> \u12A0\u12F5\u121A\u1295 (Admin) \u1206\u1297\u120D!</b>

\u1260\u12A0\u12F5\u121A\u1295 \u1353\u1290\u120D \u1208\u1218\u130D\u1263\u1275 /admin \u12ED\u1260\u1209 \u12C8\u12ED\u121D "\u{1F451} Admin Control Panel" \u12E8\u121A\u043B\u0435\u12CD\u1295 \u12ED\u132B\u1291\u1362`);
        return;
      }
      if (text.startsWith("/supa") || text.startsWith("/supabase")) {
        const isAdmin = isAdminUser(fromUser.id);
        if (!isAdmin) {
          await sendTelegramMessage(botToken, chatId, "\u26A0\uFE0F \u12ED\u1205 \u1275\u12D5\u12DB\u12DD \u1208\u12A0\u12F5\u121A\u1295 \u1265\u127B \u12E8\u1270\u1348\u1240\u12F0 \u1290\u12CD! (Admin access only)");
          return;
        }
        const parts = rawText.split(/\s+/);
        if (parts.length < 3) {
          await sendTelegramMessage(
            botToken,
            chatId,
            `\u2139\uFE0F <b>Supabase \u12F3\u1273\u1264\u12DD \u1208\u121B\u1308\u1293\u1298\u1275\u1366</b>
<code>/supa &lt;Supabase-URL&gt; &lt;Supabase-Service-Role-Key&gt;</code>

\u121D\u1233\u120C\u1366
<code>/supa https://xyz.supabase.co eyJhbGc...</code>

\u{1F512} <i>\u12ED\u1205\u1295 \u1232\u12EB\u12F0\u122D\u1309 \u12E8\u1266\u1271 \u1230\u122D\u1268\u122D \u12A5\u1293 \u12E8\u12CC\u1265 \u12A0\u1351 \u12F3\u1273\u1264\u12DD 100% \u1260\u1245\u133D\u1260\u1275 \u12ED\u1308\u1293\u129B\u1209!</i>`
          );
          return;
        }
        const sUrl = parts[1].trim();
        const sKey = parts[2].trim();
        try {
          const testClient = reinitSupabase(sUrl, sKey);
          if (testClient) {
            const { error } = await testClient.from("users").select("id").limit(1);
            if (error && error.message.includes("does not exist")) {
              await sendTelegramMessage(
                botToken,
                chatId,
                `\u26A0\uFE0F <b>\u12E8 Supabase \u130D\u1295\u1299\u1290\u1275 \u1270\u1233\u12AD\u1277\u120D\u1364 \u1290\u1308\u122D \u130D\u1295 'users' \u1230\u1295\u1320\u1228\u12E5 (Table) \u12A0\u120D\u1270\u1308\u1298\u121D!</b>

\u12A5\u1263\u12AD\u12CE \u1260 Supabase SQL Editor \u12CD\u1235\u1325 \u1230\u1295\u1320\u1228\u12E6\u1279\u1295 \u1218\u134D\u1320\u122B\u1278\u12CD\u1295 \u12EB\u1228\u130B\u130D\u1321\u1362`
              );
              return;
            }
            const allLocalUsers = localDb.getAllUsers();
            for (const u of allLocalUsers) {
              try {
                await upsertUserAdaptive(u);
              } catch {
              }
            }
            const allLocalTxs = localDb.getTransactions();
            for (const t of allLocalTxs) {
              await testClient.from("transactions").upsert([{
                id: t.id,
                telegram_id: t.telegram_id,
                player_name: t.player_name,
                player_code: t.player_code,
                phone_number: t.phone_number || "",
                type: t.type,
                amount: t.amount,
                status: t.status,
                reference: t.reference || "",
                screenshot_url: t.screenshot_url || "",
                photo_file_id: t.photo_file_id || "",
                notes: t.notes || "",
                created_at: t.created_at
              }]);
            }
            await sendTelegramMessage(
              botToken,
              chatId,
              `\u2705 <b>\u12E8 Supabase \u12F3\u1273\u1264\u12DD \u1260\u1270\u1233\u12AB \u1201\u1294\u1273 \u1270\u1308\u1293\u129D\u1277\u120D!</b>

\u2022 <b>URL\u1366</b> <code>${sUrl}</code>
\u2022 <b>\u121B\u1218\u1233\u1230\u120D\u1366</b> \u26A1 \u1201\u1209\u121D \u1270\u132B\u12CB\u127E\u127D \u12A5\u1293 \u12A5\u1295\u1245\u1235\u1243\u1234\u12CE\u127D (Transactions) \u1260\u1245\u133D\u1260\u1275 \u1270\u1218\u1233\u1235\u1208\u12CB\u120D!

\u12A8\u12A0\u1201\u1295 \u1260\u128B\u120B \u12F2\u1356\u12DA\u1275 \u1232\u12EB\u1338\u12F5\u1241\u121D \u1206\u1290 \u1328\u12CB\u1273 \u1232\u132B\u12C8\u1271 \u1260\u1201\u1209\u121D \u1266\u1273\u12CE\u127D \u120B\u12ED \u1202\u1233\u1261 \u1260\u12A5\u12A9\u120D\u1290\u1275 \u12ED\u123B\u123B\u120B\u120D! \u{1F3C6}`
            );
          } else {
            await sendTelegramMessage(botToken, chatId, "\u274C \u12E8 Supabase \u130D\u1295\u1299\u1290\u1275 \u12A0\u120D\u1270\u1233\u12AB\u121D\u1362 \u12A5\u1263\u12AD\u12CE URL \u12A5\u1293 Key \u12EB\u1228\u130B\u130D\u1321\u1362");
          }
        } catch (err) {
          await sendTelegramMessage(botToken, chatId, `\u274C <b>\u130D\u1295\u1299\u1290\u1275 \u12A0\u120D\u1270\u1233\u12AB\u121D\u1366</b> ${err.message || err}`);
        }
        return;
      }
      if (text.startsWith("/start")) {
        const parts = rawText.split(/\s+/);
        let referredBy;
        if (parts.length > 1 && parts[1].trim()) {
          const possibleRef = parts[1].trim();
          if (/^\d+$/.test(possibleRef) && possibleRef !== String(fromUser.id)) {
            referredBy = possibleRef;
          }
        }
        const userResult = await getOrCreateTelegramUser(fromUser, referredBy);
        const isAdmin = isAdminUser(fromUser.id);
        const userRecord = localDb.getUser(fromUser.id);
        const currentBalance = userResult.balance ?? userRecord?.balance ?? 0;
        const playerCode = userResult.playerCode || userRecord?.player_code || generatePlayerCode(fromUser.id);
        const userPhone = userResult.phoneNumber || userRecord?.phone_number || verifiedUsersCache[String(fromUser.id)]?.phone || "";
        const isVerified = isUserEverVerified(fromUser.id) || !!(userPhone && String(userPhone).trim()) || !!userRecord?.is_verified;
        try {
          const client = getSupabase();
          if (client) {
            console.log(`[Supabase] Explicitly registering user ${fromUser.id} on /start...`);
            const supaPayload = {
              telegram_id: String(fromUser.id),
              username: fromUser.username || "",
              first_name: fromUser.first_name || "",
              full_name: [fromUser.first_name, fromUser.last_name].filter(Boolean).join(" ") || "Player",
              player_code: playerCode,
              balance: currentBalance,
              role: isAdmin ? "admin" : "user",
              status: "active",
              is_blocked: false,
              is_verified: isVerified
            };
            if (userPhone) supaPayload.phone_number = userPhone;
            const res = await upsertUserAdaptive(supaPayload);
            if (res.error) {
              console.warn(`[Supabase] Note on /start user upsert:`, res.error);
            } else {
              console.log(`\u2705 [Supabase] User ${fromUser.id} (${playerCode}) registered and synced!`);
            }
          } else {
            console.warn("[Supabase] Warning: Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
          }
        } catch (supaErr) {
          console.warn("[Supabase] Error during /start sync:", supaErr);
        }
        if (!isAdmin && !isVerified) {
          const contactPromptText = `\u{1F44B} <b>\u12A5\u1295\u12B3\u1295 \u12C8\u12F0 \u1233\u1208\u122A \u1262\u1295\u130E (Salery Bingo) \u1260\u12F0\u1205\u1293 \u1218\u1321!</b>

\u{1F464} <b>\u1270\u132B\u12CB\u127D\u1366</b> ${fromUser.first_name || "Player"}
\u{1F194} <b>\u12E8\u1270\u132B\u12CB\u127D \u12AE\u12F5 (Player Code)\u1366</b> <code>${playerCode}</code>

\u26A0\uFE0F <b>\u121B\u1233\u1230\u1262\u12EB\u1366</b> \u12A0\u12AB\u12CD\u1295\u1275\u12CE\u1295 \u1208\u121B\u1228\u130B\u1308\u1325 \u12A5\u1293 \u12AD\u134D\u12EB\u12CE\u127D\u1295 \u1260\u1245\u133D\u1260\u1275 \u1208\u121B\u130D\u1298\u1275 \u12A5\u1263\u12AD\u12CE \u12A8\u1273\u127D \u12EB\u1208\u12CD\u1295 <b>\xAB\u{1F4F1} \u1235\u120D\u12AD \u1241\u1325\u122D\u12CE\u1295 \u12EB\u130B\u1229 (Share Contact)\xBB</b> \u12E8\u121A\u1208\u12CD\u1295 \u12A0\u12DD\u122B\u122D \u12ED\u132B\u1291\u1366`;
          await sendTelegramMessage(botToken, chatId, contactPromptText, getContactRequestMarkup());
          return;
        }
        let welcomeText;
        if (isAdmin) {
          welcomeText = `\u{1F451} <b>Welcome Admin (\u1233\u1208\u122A \u12A0\u12F5\u121A\u1295)</b>

\u{1F4B0} <b>\u12E8\u12A0\u1201\u1291 \u1240\u122A \u1202\u1233\u1265\u12CE\u1366</b> <b>${currentBalance.toLocaleString()} ETB</b>
\u{1F194} <b>Admin ID\u1366</b> <code>${fromUser.id}</code>
\u{1F579}\uFE0F <b>\u121A\u1293\u1366</b> \u12CB\u1293 \u12A0\u1235\u1270\u12F3\u12F3\u122A (Admin)

\u1328\u12CB\u1273 \u1208\u1218\u1300\u1218\u122D \u12A8\u1273\u127D <b>"Play \u{1F3AE}"</b> \u12E8\u121A\u1208\u12CD\u1295 \u12ED\u132B\u1291 \u12C8\u12ED\u121D \u1270\u132B\u12CB\u127E\u127D\u1295 \u1208\u1218\u1246\u1323\u1320\u122D /admin \u12ED\u1260\u1209!`;
        } else {
          welcomeText = `\u{1F44B} <b>\u12A5\u1295\u12B3\u1295 \u12C8\u12F0 \u1233\u1208\u122A \u1262\u1295\u130E (Salery Bingo) \u1260\u12F0\u1205\u1293 \u1218\u1321!</b>

\u{1F464} <b>\u1270\u132B\u12CB\u127D\u1366</b> ${fromUser.first_name || "Player"}
\u{1F194} <b>\u12E8\u1270\u132B\u12CB\u127D \u12AE\u12F5 (Player Code)\u1366</b> <code>${playerCode}</code>
\u{1F4B0} <b>\u12E8\u12A0\u1201\u1291 \u1240\u122A \u1202\u1233\u1265\u12CE\u1366</b> <b>${currentBalance.toLocaleString()} ETB</b>
` + (userPhone ? `\u{1F4F1} <b>\u12E8\u1270\u1218\u12D8\u1308\u1260 \u1235\u120D\u12AD\u1366</b> <code>${userPhone}</code>
` : "") + `
\u{1F3AE} \u1328\u12CB\u1273 \u1208\u1218\u1300\u1218\u122D <b>"Play \u{1F3AE}"</b> \u12E8\u121A\u1208\u12CD\u1295 \u12ED\u132B\u1291 \u12C8\u12ED\u121D \u12A8\u1273\u127D \u12EB\u1209\u1275\u1295 <b>7\u1271</b> \u12A0\u121B\u122B\u132E\u127D \u12ED\u1320\u1240\u1219\u1366`;
        }
        const inlineMarkup = getMainMenuMarkup(webAppUrl, fromUser.id, currentBalance);
        const replyMarkup = getReplyMenuMarkup(webAppUrl, fromUser.id, currentBalance);
        await sendTelegramMessage(botToken, chatId, welcomeText, inlineMarkup);
        try {
          await sendTelegramMessage(
            botToken,
            chatId,
            `\u{1F447} <i>\u12E8\u1273\u127D\u129B\u12CD \u121D\u1293\u120C (Main Menu) \u1270\u12D8\u130B\u1305\u1277\u120D\u1366</i>`,
            replyMarkup
          );
        } catch {
        }
      } else {
        const activeWithdrawSession = userWithdrawSessions.get(String(fromUser.id));
        if (activeWithdrawSession) {
          const fullUser = await getUserFull(fromUser.id);
          const userBalance = fullUser?.balance || 0;
          const playerCode = fullUser?.player_code || generatePlayerCode(fromUser.id);
          const playerName = fromUser.first_name || fullUser?.first_name || "Player";
          if (activeWithdrawSession.step === "awaiting_amount") {
            const numMatch = rawText.match(/(\d+)/);
            const parsedAmount = numMatch ? parseInt(numMatch[1], 10) : 0;
            const maxWithdrawable = Math.max(0, userBalance - 25);
            if (userBalance <= 25 || maxWithdrawable <= 0) {
              const lowAmtMsg = `\u26A0\uFE0F <b>\u1240\u122A \u1202\u1233\u1265\u12CE \u1208\u121B\u12CD\u1323\u1275 \u12A0\u12ED\u1260\u1243\u121D!</b>

\u{1F4B0} \u12E8\u12A5\u122D\u1235\u12CE \u1240\u122A \u1202\u1233\u1265\u1366 <b>${userBalance.toLocaleString()} ETB</b>

\u{1F4CC} <b>\u12F0\u1295\u1265\u1366</b> 25 \u1265\u122D \u1201\u120D\u130A\u12DC \u1260\u12A0\u12AB\u12CD\u1295\u1275\u12CE \u12CD\u1235\u1325 \u12A5\u1295\u12F0 \u124B\u121A \u1270\u1240\u121B\u132D \u1218\u1246\u12E8\u1275 \u12A0\u1208\u1260\u1275\u1362 \u121B\u12CD\u1323\u1275 \u12E8\u121A\u127B\u1208\u12CD \u1260\u12A0\u12AB\u12CD\u1295\u1275\u12CE \u12CD\u1235\u1325 <b>\u12A8 25 \u1265\u122D \u1260\u120B\u12ED</b> \u1232\u1296\u122D \u1265\u127B \u1290\u12CD\u1362

\u1328\u12CB\u1273\u12CE\u127D\u1295 \u1260\u121B\u1238\u1290\u134D \u12A8 25 \u1265\u122D \u1260\u120B\u12ED \u1232\u1296\u122D\u12CE\u1275 \u121B\u12CD\u1323\u1275 \u12ED\u127D\u120B\u1209! \u{1F3AE}`;
              userWithdrawSessions.delete(String(fromUser.id));
              await sendTelegramMessage(botToken, chatId, lowAmtMsg);
              return;
            }
            if (!numMatch || parsedAmount <= 0) {
              const askNumMsg = `\u26A0\uFE0F \u12A5\u1263\u12AD\u12CE \u121B\u12CD\u1323\u1275 \u12E8\u121A\u1348\u120D\u1309\u1275\u1295 \u12E8\u1265\u122D \u1218\u1320\u1295 \u1260\u1241\u1325\u122D \u1265\u127B \u12ED\u120B\u12A9 (\u121B\u12CD\u1323\u1275 \u12E8\u121A\u127D\u1209\u1275 \u12A5\u1235\u12A8 <b>${maxWithdrawable} ETB</b> \u12F5\u1228\u1235 \u1290\u12CD)\u1366`;
              await sendTelegramMessage(botToken, chatId, askNumMsg);
              return;
            }
            if (parsedAmount > maxWithdrawable) {
              const insufMsg = `\u26A0\uFE0F <b>\u12E8\u1270\u1320\u12E8\u1240\u12CD \u1218\u1320\u1295 \u12A8\u1270\u1348\u1240\u12F0\u12CD \u12ED\u1260\u120D\u1323\u120D!</b>

\u{1F4B0} \u12E8\u12A5\u122D\u1235\u12CE \u1240\u122A \u1202\u1233\u1265\u1366 <b>${userBalance.toLocaleString()} ETB</b>
\u{1F4B5} \u121B\u12CD\u1323\u1275 \u12E8\u121A\u127D\u1209\u1275\u1366 \u12A5\u1235\u12A8 <b>${maxWithdrawable.toLocaleString()} ETB</b> \u12F5\u1228\u1235 \u1290\u12CD\u1362

\u12A5\u1263\u12AD\u12CE \u12A5\u1235\u12A8 <b>${maxWithdrawable} \u1265\u122D</b> \u12F5\u1228\u1235 \u12EB\u1208 \u1218\u1320\u1295 \u12EB\u1235\u1308\u1261\u1366`;
              await sendTelegramMessage(botToken, chatId, insufMsg);
              return;
            }
            userWithdrawSessions.set(String(fromUser.id), {
              step: "awaiting_details",
              amount: parsedAmount,
              timestamp: Date.now()
            });
            const askDetailsMsg = `\u2705 <b>\u12E8\u1270\u1218\u1228\u1320\u12CD \u121B\u12CD\u132B \u1218\u1320\u1295\u1366 ${parsedAmount} ETB</b>

\u12A5\u1263\u12AD\u12CE \u1308\u1295\u12D8\u1261 \u12E8\u121A\u120B\u12AD\u1260\u1275\u1295 <b>\u12E8\u1274\u120C\u1265\u122D/\u1263\u1295\u12AD \u1235\u120D\u12AD \u1241\u1325\u122D \u12A5\u1293 \u1219\u1209 \u1235\u121D\u12CE\u1295 \u12A0\u12EB\u12ED\u12D8\u12CD</b> \u12ED\u120B\u12A9\u1366

<i>(\u121D\u1233\u120C\u1366 <code>0911223344 \u12A0\u1260\u1260 \u12A8\u1260\u12F0</code> \u12C8\u12ED\u121D <code>CBE 100023456789 Abebe</code>)</i>`;
            await sendTelegramMessage(botToken, chatId, askDetailsMsg);
            return;
          }
          if (activeWithdrawSession.step === "awaiting_details" || activeWithdrawSession.step === "awaiting_method" || activeWithdrawSession.step === "awaiting_name") {
            const recipientInfo = rawText.trim();
            const withdrawAmount = activeWithdrawSession.amount || 25;
            if (recipientInfo.length < 4) {
              await sendTelegramMessage(
                botToken,
                chatId,
                `\u26A0\uFE0F \u12A5\u1263\u12AD\u12CE \u1275\u12AD\u12AD\u1208\u129B \u12E8\u1235\u120D\u12AD \u1241\u1325\u122D \u12A5\u1293 \u1235\u121D \u12EB\u1235\u1308\u1261 (\u121D\u1233\u120C\u1366 <code>0911223344 \u12A0\u1260\u1260 \u12A8\u1260\u12F0</code>)\u1366`
              );
              return;
            }
            userWithdrawSessions.delete(String(fromUser.id));
            const txId = "wth_tg_" + Date.now() + "_" + Math.floor(Math.random() * 1e3);
            const newTx = {
              id: txId,
              telegram_id: String(fromUser.id),
              player_name: playerName,
              player_code: playerCode,
              phone_number: recipientInfo,
              type: "withdraw",
              amount: withdrawAmount,
              status: "pending",
              reference: recipientInfo,
              created_at: (/* @__PURE__ */ new Date()).toISOString(),
              notes: `\u121B\u12CD\u132B: ${recipientInfo} | \u1270\u132B\u12CB\u127D: ${playerName} (ID: ${playerCode})`
            };
            localDb.addTransaction(newTx);
            try {
              const supaClient = getSupabase();
              if (supaClient) {
                void (async () => {
                  try {
                    const localUser = localDb.getUser(newTx.telegram_id);
                    if (localUser) {
                      await upsertUserAdaptive(localUser);
                    }
                    await supaClient.from("transactions").insert([{
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
                      created_at: newTx.created_at
                    }]);
                  } catch {
                  }
                })();
              }
            } catch {
            }
            fetch("https://salery-bingo-1.vercel.app/api/transactions/withdraw", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(newTx)
            }).catch(() => {
            });
            const confirmReply = `\u2705 <b>\u12E8 ${withdrawAmount} ETB \u121B\u12CD\u132B \u1325\u12EB\u1244\u12CE \u12F0\u122D\u1236\u1293\u120D!</b>

\u{1F4B3} <b>\u12E8\u121A\u120B\u12AD\u1260\u1275 \u1235\u120D\u12AD\u1293 \u1235\u121D\u1366</b> <code>${recipientInfo}</code>
\u{1F194} <b>Player Code\u1366</b> <code>${playerCode}</code>
\u{1F4B0} <b>\u12E8\u121A\u12A8\u1348\u120D \u1218\u1320\u1295\u1366</b> <b>${withdrawAmount} ETB</b>

\u1325\u12EB\u1244\u12CE \u12A5\u1295\u12F0\u1270\u1228\u130B\u1308\u1320 \u1308\u1295\u12D8\u1261 \u12C8\u12F2\u12EB\u12CD\u1291 \u12ED\u120B\u12AD\u120D\u12CE\u1273\u120D\u1362 \u12A5\u1293\u1218\u1230\u130D\u1293\u1208\u1295! \u{1F3AE}`;
            await sendTelegramMessage(botToken, chatId, confirmReply, getMainMenuMarkup(webAppUrl, fromUser.id, userBalance));
            return;
          }
        }
        const isWithdrawIntent = text.startsWith("/withdraw") || text === "withdraw" || text === "\u121B\u12CD\u1323\u1275" || text === "\u12C8\u132A" || text.includes("\u1308\u1295\u12D8\u1265 \u121B\u12CD\u1323\u1275") || text.includes("\u1265\u122D \u121B\u12CD\u1323\u1275") || text.includes("withdraw");
        if (isWithdrawIntent) {
          const fullUser = await getUserFull(fromUser.id);
          const userBalance = fullUser?.balance || 0;
          const maxWithdrawable = Math.max(0, userBalance - 25);
          if (userBalance <= 25 || maxWithdrawable <= 0) {
            const lowBalMsg = `\u26A0\uFE0F <b>\u1240\u122A \u1202\u1233\u1265\u12CE \u1208\u121B\u12CD\u1323\u1275 \u12A0\u12ED\u1260\u1243\u121D!</b>

\u{1F4B0} \u12E8\u12A5\u122D\u1235\u12CE \u1240\u122A \u1202\u1233\u1265\u1366 <b>${userBalance.toLocaleString()} ETB</b>

\u{1F4CC} <b>\u12F0\u1295\u1265\u1366</b> 25 \u1265\u122D \u1201\u120D\u130A\u12DC \u1260\u12A0\u12AB\u12CD\u1295\u1275\u12CE \u12CD\u1235\u1325 \u12A5\u1295\u12F0 \u124B\u121A \u1270\u1240\u121B\u132D \u1218\u1246\u12E8\u1275 \u12A0\u1208\u1260\u1275\u1362 \u121B\u12CD\u1323\u1275 \u12E8\u121A\u127B\u1208\u12CD \u1260\u12A0\u12AB\u12CD\u1295\u1275\u12CE \u12CD\u1235\u1325 <b>\u12A8 25 \u1265\u122D \u1260\u120B\u12ED</b> \u1232\u1296\u122D \u1265\u127B \u1290\u12CD\u1362

\u1328\u12CB\u1273\u12CE\u127D\u1295 \u1260\u1218\u132B\u12C8\u1275\u1293 \u1260\u121B\u1238\u1290\u134D \u12A8 25 \u1265\u122D \u1260\u120B\u12ED \u1232\u1296\u122D\u12CE\u1275 \u121B\u12CD\u1323\u1275 \u12ED\u127D\u120B\u1209! \u{1F3AE}`;
            await sendTelegramMessage(botToken, chatId, lowBalMsg);
            return;
          }
          userWithdrawSessions.set(String(fromUser.id), {
            step: "awaiting_amount",
            timestamp: Date.now()
          });
          userDepositSessions.delete(String(fromUser.id));
          const startWithdrawMsg = `\u{1F911} <b>\u1308\u1295\u12D8\u1265 \u121B\u12CD\u1323\u1275 (Withdraw)</b>

\u{1F4B0} \u12E8\u12A5\u122D\u1235\u12CE \u1240\u122A \u1202\u1233\u1265\u1366 <b>${userBalance.toLocaleString()} ETB</b>
\u{1F4B5} \u121B\u12CD\u1323\u1275 \u12E8\u121A\u127D\u1209\u1275 \u1218\u1320\u1295\u1366 <b>\u12A5\u1235\u12A8 ${maxWithdrawable.toLocaleString()} ETB</b>
\u26A0\uFE0F <i>(\u121B\u1233\u1230\u1262\u12EB\u1366 25 \u1265\u122D \u1260\u12A0\u12AB\u12CD\u1295\u1275\u12CE \u12CD\u1235\u1325 \u12ED\u1240\u122B\u120D\u1364 \u12A8 25 \u1265\u122D \u1260\u120B\u12ED \u12EB\u1208\u12CD\u1295 \u1265\u127B \u121B\u12CD\u1323\u1275 \u12ED\u127D\u120B\u1209)</i>

\u12A5\u1263\u12AD\u12CE <b>\u1235\u1295\u1275 \u1265\u122D</b> \u121B\u12CD\u1323\u1275 \u12A5\u1295\u12F0\u121A\u1348\u120D\u1309 \u1260\u1241\u1325\u122D \u1265\u127B \u12ED\u120B\u12A9\u1366`;
          await sendTelegramMessage(botToken, chatId, startWithdrawMsg);
          return;
        }
        const activeDepositSession = userDepositSessions.get(String(fromUser.id));
        if (activeDepositSession?.step === "awaiting_amount") {
          const numMatch = rawText.match(/(\d+)/);
          const parsedAmount = numMatch ? parseInt(numMatch[1], 10) : 0;
          if (!numMatch || parsedAmount < 10) {
            const lowAmtMsg = `\u26A0\uFE0F <b>\u12DD\u1245\u1270\u129B\u12CD \u12E8\u121B\u1235\u1308\u1262\u12EB \u1218\u1320\u1295 10 \u1265\u122D \u1290\u12CD!</b>

\u12A8 10 \u1265\u122D \u1260\u1273\u127D \u121B\u1235\u1308\u1263\u1275 \u12A0\u12ED\u127B\u120D\u121D\u1362 \u12A5\u1263\u12AD\u12CE \u121B\u1235\u1308\u1263\u1275 \u12E8\u121A\u1348\u120D\u1309\u1275\u1295 \u12E8\u1265\u122D \u1218\u1320\u1295 \u1260\u1241\u1325\u122D \u1265\u127B \u12ED\u120B\u12A9 (\u121D\u1233\u120C\u1366 50\u1363 100\u1363 200\u1363 500)\u1366`;
            await sendTelegramMessage(botToken, chatId, lowAmtMsg);
            return;
          }
          userDepositSessions.set(String(fromUser.id), {
            step: "awaiting_screenshot",
            amount: parsedAmount,
            timestamp: Date.now()
          });
          const askScreenshotMsg = `\u2705 <b>\u12E8\u1270\u1218\u1228\u1320\u12CD \u1218\u1320\u1295\u1366 ${parsedAmount} ETB</b>

\u12A5\u1263\u12AD\u12CE \u12E8\u1270\u1308\u1208\u1338\u12CD\u1295 <b>${parsedAmount} \u1265\u122D</b> \u1260\u121A\u12A8\u1270\u1208\u12CD \u12E8\u1274\u120C\u1265\u122D \u12A0\u12AB\u12CD\u1295\u1275 \u12EB\u1235\u1270\u120B\u120D\u1349\u1366

\u{1F4F1} <b>Telebirr:</b> <code>0966987823</code>
\u{1F464} <b>\u1235\u121D:</b> Samuel / Salery Bingo

\u{1F4F8} <b>\u1240\u1323\u12ED \u12F0\u1228\u1303\u1366</b>
\u1308\u1295\u12D8\u1261\u1295 \u12AB\u1235\u1270\u120B\u1208\u1349 \u1260\u128B\u120B <b>\u12E8\u12AD\u134D\u12EB\u12CD\u1295 \u12F0\u1228\u1230\u129D (Screenshot \u134E\u1276)</b> \u12A0\u1201\u1291\u1291 \u1260\u12DA\u1205 \u1266\u1275 \u120B\u12ED \u12ED\u120B\u12A9!`;
          await sendTelegramMessage(botToken, chatId, askScreenshotMsg);
          return;
        }
        if (activeDepositSession?.step === "awaiting_screenshot") {
          const numMatch = rawText.match(/(\d+)/);
          if (numMatch && parseInt(numMatch[1], 10) >= 10) {
            const updatedAmt = parseInt(numMatch[1], 10);
            userDepositSessions.set(String(fromUser.id), {
              step: "awaiting_screenshot",
              amount: updatedAmt,
              timestamp: Date.now()
            });
            const updateAmtMsg = `\u2705 <b>\u12E8\u1270\u123B\u123B\u1208\u12CD \u1218\u1320\u1295\u1366 ${updatedAmt} ETB</b>

\u12A5\u1263\u12AD\u12CE <b>${updatedAmt} \u1265\u122D</b> \u1260\u1274\u120C\u1265\u122D <code>0966987823</code> (Samuel) \u12A8\u12A8\u1348\u1209 \u1260\u128B\u120B \u12E8\u12AD\u134D\u12EB\u12CD\u1295 <b>\u1235\u12AD\u122A\u1295\u123E\u1275 (Screenshot \u134E\u1276)</b> \u12A0\u1201\u1291\u1291 \u12ED\u120B\u12A9!`;
            await sendTelegramMessage(botToken, chatId, updateAmtMsg);
            return;
          }
          const remindPhotoMsg = `\u{1F4F8} <b>\u12A5\u1263\u12AD\u12CE \u12E8\u12A8\u1348\u1209\u1260\u1275\u1295 \u12F0\u1228\u1230\u129D (Screenshot \u134E\u1276) \u12ED\u120B\u12A9!</b>

\u{1F4B0} \u12E8\u1270\u1320\u12E8\u1240\u12CD \u1218\u1320\u1295\u1366 <b>${activeDepositSession.amount || 100} ETB</b>
\u{1F4F1} Telebirr: <code>0966987823</code> (Samuel)

\u12E8\u12A8\u1348\u1209\u1260\u1275\u1295 \u12F0\u1228\u1230\u129D \u134E\u1276 \u12A0\u1295\u1235\u1270\u12CD \u12A5\u1295\u12F0\u120B\u12A9 \u12A0\u12F5\u121A\u1291 \u12C8\u12F2\u12EB\u12CD\u1291 \u12A0\u12ED\u1276 \u12EB\u1228\u130B\u130D\u1325\u120D\u12CE\u1273\u120D!`;
          await sendTelegramMessage(botToken, chatId, remindPhotoMsg);
          return;
        }
        const cleanText = text.trim();
        if (cleanText === "balance \u{1F4B5}" || cleanText === "balance" || cleanText === "/balance" || cleanText === "\u1202\u1233\u1265") {
          const balance = await getUserBalance(String(fromUser.id));
          const isAdmin = isAdminUser(fromUser.id);
          const balanceMsg = `\u{1F4B5} <b>\u12E8\u1202\u1233\u1265\u12CE \u1218\u1320\u1295 (Your Balance)</b>

\u{1F4B0} <b>\u1240\u122A \u1202\u1233\u1265\u1366</b> <b>${balance.toLocaleString()} ETB</b>
\u{1F194} <b>Player ID\u1366</b> <code>${fromUser.id}</code>

\u{1F3AE} \u1328\u12CB\u1273 \u1208\u1218\u1300\u1218\u122D \u12A8\u1273\u127D "Play \u{1F3AE}" \u12E8\u121A\u1208\u12CD\u1295 \u12ED\u132B\u1291!`;
          await sendTelegramMessage(botToken, chatId, balanceMsg, getMainMenuMarkup(webAppUrl, fromUser.id, balance));
          return;
        }
        if (cleanText === "deposit \u{1F4B0}" || cleanText.startsWith("/deposit") || cleanText === "deposit" || cleanText === "\u12F2\u1356\u12DA\u1275" || cleanText.includes("\u1308\u1295\u12D8\u1265 \u121B\u1235\u1308\u1263\u1275")) {
          userDepositSessions.set(String(fromUser.id), {
            step: "awaiting_amount",
            timestamp: Date.now()
          });
          const startDepositMsg = `\u{1F4B0} <b>\u1308\u1295\u12D8\u1265 \u121B\u1235\u1308\u1262\u12EB (Deposit)</b>

\u1235\u1295\u1275 \u1265\u122D \u121B\u1235\u1308\u1263\u1275 \u12ED\u1348\u120D\u130B\u1209?
\u26A0\uFE0F <i>(\u121B\u1233\u1230\u1262\u12EB\u1366 \u12DD\u1245\u1270\u129B\u12CD \u12E8\u121B\u1235\u1308\u1262\u12EB \u1218\u1320\u1295 10 \u1265\u122D \u1290\u12CD! \u12A8 10 \u1265\u122D \u1260\u1273\u127D \u121B\u1235\u1308\u1263\u1275 \u12A0\u12ED\u127B\u120D\u121D)</i>

\u12A5\u1263\u12AD\u12CE \u121B\u1235\u1308\u1263\u1275 \u12E8\u121A\u1348\u120D\u1309\u1275\u1295 \u12E8\u1265\u122D \u1218\u1320\u1295 \u1265\u127B \u1260\u1241\u1325\u122D \u12ED\u120B\u12A9 (\u121D\u1233\u120C\u1366 50\u1363 100\u1363 200\u1363 500)\u1366`;
          await sendTelegramMessage(botToken, chatId, startDepositMsg);
          return;
        }
        if (cleanText === "withdraw \u{1F911}" || cleanText.startsWith("/withdraw") || cleanText === "withdraw" || cleanText === "\u121B\u12CD\u1323\u1275") {
          const fullUser = await getUserFull(fromUser.id);
          const userBal = fullUser?.balance || 0;
          userWithdrawSessions.set(String(fromUser.id), {
            step: "awaiting_amount",
            timestamp: Date.now()
          });
          userDepositSessions.delete(String(fromUser.id));
          const withdrawMsg = `\u{1F911} <b>\u1308\u1295\u12D8\u1265 \u121B\u12CD\u1323\u1275 (Withdraw)</b>

\u{1F4B0} \u12E8\u12A5\u122D\u1235\u12CE \u1240\u122A \u1202\u1233\u1265\u1366 <b>${userBal.toLocaleString()} ETB</b>

\u12A5\u1263\u12AD\u12CE <b>\u1235\u1295\u1275 \u1265\u122D</b> \u121B\u12CD\u1323\u1275 \u12A5\u1295\u12F0\u121A\u1348\u120D\u1309 \u1260\u1241\u1325\u122D \u1265\u127B \u12ED\u120B\u12A9\u1366`;
          await sendTelegramMessage(botToken, chatId, withdrawMsg);
          return;
        }
        if (cleanText === "transfer \u{1F381}" || cleanText === "transfer" || cleanText === "\u121B\u1235\u1270\u120B\u1208\u134D") {
          const transferMsg = `\u{1F381} <b>\u1202\u1233\u1265 \u121B\u1235\u1270\u120B\u1208\u134A\u12EB (Transfer)</b>

\u1208\u120C\u120B \u1270\u132B\u12CB\u127D \u1233\u1295\u1272\u121D \u1208\u121B\u1235\u1270\u120B\u1208\u134D \u12E8\u1313\u12F0\u129B\u12CE\u1295 \u12E8\u1274\u120C\u130D\u122B\u121D ID \u12A5\u1293 \u12E8\u121A\u120D\u12A9\u1275\u1295 \u1218\u1320\u1295 \u1208\u12F5\u130B\u134D \u1230\u132A\u12CD \u12ED\u120B\u12A9\u1362

\u{1F464} <b>Support:</b> @Salerybingo_support`;
          await sendTelegramMessage(botToken, chatId, transferMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
          return;
        }
        if (cleanText === "instruction \u{1F4D6}" || cleanText === "instruction" || cleanText === "/help" || cleanText === "\u1218\u1218\u122A\u12EB") {
          const instructionMsg = `\u{1F4D6} <b>\u12E8\u12A0\u1328\u12CB\u12C8\u1275 \u1218\u1218\u122A\u12EB (Rules & Instructions)</b>

1. "Play \u{1F3AE}" \u12E8\u121A\u1208\u12CD\u1295 \u1260\u1218\u132B\u1295 \u1328\u12CB\u1273\u12CD\u1295 \u12ED\u12AD\u1348\u1271\u1362
2. \u12E8\u12AB\u122D\u1274\u120B \u1218\u12F0\u1265 (10, 20, 50...) \u12A5\u1293 \u12E8\u12AB\u122D\u1274\u120B \u1265\u12DB\u1275 \u12ED\u121D\u1228\u1321\u1362
3. 75 \u1241\u1325\u122E\u127D \u1260\u1245\u12F0\u121D \u1270\u12A8\u1270\u120D \u1260\u12F5\u121D\u1345 \u12A5\u1293 \u1260\u1235\u12AD\u122A\u1291 \u120B\u12ED \u12ED\u1320\u122B\u1209\u1362
4. \u1260\u12AB\u122D\u1274\u120B\u12CE \u120B\u12ED \u12EB\u1209\u1275\u1295 \u1241\u1325\u122E\u127D \u1260\u1218\u1295\u12AB\u1275 \u12A0\u1218\u1233\u1235\u1209\u1362
5. \u1218\u1235\u1218\u122D \u1232\u121E\u120B \u12C8\u12F2\u12EB\u12CD\u1291 "BINGO" \u12E8\u121A\u1208\u12CD\u1295 \u1260\u1218\u132B\u1295 \u12EB\u1238\u1295\u1349!`;
          await sendTelegramMessage(botToken, chatId, instructionMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
          return;
        }
        if (cleanText.includes("support") || cleanText.includes("\u12F5\u130B\u134D") || cleanText === "contact support \u{1F4DE}" || cleanText === "contact support...") {
          const supportMsg = `\u{1F4DE} <b>\u12E8\u12F0\u1295\u1260\u129E\u127D \u12A0\u1308\u120D\u130D\u120E\u1275 (Contact Support)</b>

\u121B\u1295\u129B\u12CD\u121D \u1325\u12EB\u1244\u1363 \u12AD\u134D\u12EB \u12C8\u12ED\u121D \u12F5\u130B\u134D \u12A8\u1348\u1208\u1309 \u12A0\u1235\u1270\u12F3\u12F3\u122A\u12CE\u127D\u1295 \u12EB\u1290\u130B\u130D\u1229\u1361

\u{1F4AC} <b>Admin / Support:</b> @Salerybingo_support
\u{1F4E2} <b>Official Channel:</b> @Salerybingo

\u1260 24/7 \u1230\u12D3\u1275 \u1208\u121B\u1235\u1270\u1293\u1308\u12F5 \u12DD\u130D\u1301 \u1290\u1295!`;
          await sendTelegramMessage(botToken, chatId, supportMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
          return;
        }
        if (cleanText === "invite \u{1F517}" || cleanText === "invite" || cleanText === "\u12ED\u130B\u1265\u12D9") {
          const inviteMsg = `\u{1F517} <b>\u12E8\u130D\u1265\u12E3 \u120A\u1295\u12AD (Invite & Earn)</b>

\u1313\u12F0\u129E\u127D\u12CE\u1295 \u12ED\u130B\u1265\u12D9\u1293 \u1208\u12A5\u12EB\u1295\u12F3\u1295\u12F1 \u1270\u130B\u1263\u12E5 5 \u1265\u122D \u1266\u1290\u1235 \u12EB\u130D\u1299!

\u12E8\u12A5\u122D\u1235\u12CE \u1218\u130B\u1260\u12E3 \u120A\u1295\u12AD\u1366
\u{1F449} https://t.me/${botUsername}?start=${fromUser.id}`;
          await sendTelegramMessage(botToken, chatId, inviteMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
          return;
        }
        if (cleanText === "play \u{1F3AE}" || cleanText === "play" || cleanText === "/play") {
          const fullUser = await getUserFull(fromUser.id);
          const currentBal = fullUser?.balance ?? 0;
          await sendTelegramMessage(
            botToken,
            chatId,
            `\u{1F3AE} <b>\u1262\u1295\u130E \u1208\u1218\u132B\u12C8\u1275 \u12A8\u1273\u127D \u12EB\u1208\u12CD\u1295 "Play \u{1F3AE}" \u12ED\u132B\u1291\u1366</b>`,
            getMainMenuMarkup(webAppUrl, fromUser.id, currentBal)
          );
          return;
        }
        const ethioPhoneMatch = rawText.trim().match(/^(?:\+?251|0)([79]\d{8})$/);
        if (ethioPhoneMatch) {
          const fullPhone = `+251${ethioPhoneMatch[1]}`;
          const existingBefore = localDb.getUser(fromUser.id);
          const playerCode = existingBefore?.player_code || generatePlayerCode(fromUser.id);
          const playerName = fromUser.first_name || existingBefore?.first_name || "Player";
          const fullName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(" ") || playerName;
          const currentBal = existingBefore?.balance ?? 0;
          localDb.upsertUser({
            telegram_id: String(fromUser.id),
            player_code: playerCode,
            first_name: playerName,
            full_name: fullName,
            username: fromUser.username || "",
            phone_number: fullPhone,
            is_verified: true,
            status: "active"
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
                username: fromUser.username || "",
                phone_number: fullPhone,
                is_verified: true,
                status: "active",
                balance: currentBal
              }).catch(() => {
              });
            }
          } catch {
          }
          const confirmMsg = `\u2705 <b>\u1235\u120D\u12AD \u1241\u1325\u122D\u12CE \u1260\u1270\u1233\u12AB \u1201\u1294\u1273 \u1270\u1218\u12DD\u130D\u1267\u120D!</b>

\u{1F464} <b>\u1270\u132B\u12CB\u127D\u1366</b> ${playerName}
\u{1F194} <b>Player Code\u1366</b> <code>${playerCode}</code>
\u{1F4F1} <b>\u12E8\u1270\u1218\u12D8\u1308\u1260 \u1235\u120D\u12AD\u1366</b> <code>${fullPhone}</code>
\u{1F4B0} <b>\u12E8\u12A0\u1201\u1291 \u1240\u122A \u1202\u1233\u1265\u12CE\u1366</b> <b>${currentBal.toLocaleString()} ETB</b>

\u12A8\u1273\u127D <b>"Play \u{1F3AE}"</b> \u12E8\u121A\u1208\u12CD\u1295 \u1260\u1218\u132B\u1295 \u1328\u12CB\u1273\u12CD\u1295 \u1218\u1300\u1218\u122D \u12ED\u127D\u120B\u1209!`;
          await sendTelegramMessage(botToken, chatId, confirmMsg, getMainMenuMarkup(webAppUrl, fromUser.id, currentBal));
          return;
        }
      }
    }
    if (update && update.callback_query) {
      const query = update.callback_query;
      const data = query.data;
      const chatId = query.message?.chat?.id || query.from?.id;
      const fromUser = query.from;
      const photoUrl = `${webAppUrl}/salery_bingo.jpg`;
      await answerCallbackQuery(botToken, query.id);
      if (data === "btn_balance") {
        const balance = await getUserBalance(String(fromUser.id));
        const isAdmin = isAdminUser(fromUser.id);
        let balanceMsg;
        if (isAdmin) {
          balanceMsg = `\u{1F451} \u12E8\u1202\u1233\u1265\u12CE \u1218\u1320\u1295 (Admin Balance)

\u{1F4B0} \u1240\u122A \u1202\u1233\u1265\u1366 ${balance} \u1265\u122D / Coins
\u{1F194} Admin ID\u1366 ${fromUser.id}

\u1328\u12CB\u1273 \u1208\u1218\u1300\u1218\u122D "Play \u{1F3AE}" \u12ED\u132B\u1291 \u12C8\u12ED\u121D \u1270\u132B\u12CB\u127E\u127D\u1295 \u1208\u1218\u1246\u1323\u1320\u122D /admin \u12ED\u1260\u1209!`;
        } else {
          balanceMsg = `\u{1F4B5} \u12E8\u1202\u1233\u1265\u12CE \u1218\u1320\u1295 (Your Balance)

\u{1F4B0} \u1240\u122A \u1202\u1233\u1265\u1366 ${balance} \u1265\u122D / Coins
\u{1F381} \u12E8\u1266\u1290\u1235 \u1233\u1295\u1272\u121D\u1366 0

\u1328\u12CB\u1273 \u1208\u1218\u1300\u1218\u122D \u12A8\u1273\u127D "Play \u{1F3AE}" \u12E8\u121A\u1208\u12CD\u1295 \u12ED\u132B\u1291!`;
        }
        await sendTelegramPhoto(botToken, chatId, photoUrl, balanceMsg, getMainMenuMarkup(webAppUrl, fromUser.id, balance));
      } else if (data === "btn_deposit") {
        userDepositSessions.set(String(fromUser.id), {
          step: "awaiting_amount",
          timestamp: Date.now()
        });
        const depositMsg = `\u{1F4B0} <b>\u1308\u1295\u12D8\u1265 \u121B\u1235\u1308\u1262\u12EB (Deposit)</b>

\u1235\u1295\u1275 \u1265\u122D \u121B\u1235\u1308\u1263\u1275 \u12ED\u1348\u120D\u130B\u1209?
\u26A0\uFE0F <i>(\u121B\u1233\u1230\u1262\u12EB\u1366 \u12DD\u1245\u1270\u129B\u12CD \u12E8\u121B\u1235\u1308\u1262\u12EB \u1218\u1320\u1295 10 \u1265\u122D \u1290\u12CD! \u12A8 10 \u1265\u122D \u1260\u1273\u127D \u121B\u1235\u1308\u1263\u1275 \u12A0\u12ED\u127B\u120D\u121D)</i>

\u12A5\u1263\u12AD\u12CE \u121B\u1235\u1308\u1263\u1275 \u12E8\u121A\u1348\u120D\u1309\u1275\u1295 \u12E8\u1265\u122D \u1218\u1320\u1295 \u1265\u127B \u1260\u1241\u1325\u122D \u12ED\u120B\u12A9 (\u121D\u1233\u120C\u1366 50\u1363 100\u1363 200\u1363 500)\u1366`;
        await sendTelegramMessage(botToken, chatId, depositMsg);
      } else if (data === "btn_support") {
        const supportMsg = `\u{1F4DE} \u12E8\u12F0\u1295\u1260\u129E\u127D \u12A0\u1308\u120D\u130D\u120E\u1275 (Contact Support)

\u121B\u1295\u129B\u12CD\u121D \u1325\u12EB\u1244\u1363 \u12AD\u134D\u12EB \u12C8\u12ED\u121D \u12F5\u130B\u134D \u12A8\u1348\u1208\u1309 \u12A0\u1235\u1270\u12F3\u12F3\u122A\u12CE\u127D\u1295 \u12EB\u1290\u130B\u130D\u1229\u1361

\u{1F4AC} Admin / Support: @Salerybingo_support
\u{1F4E2} Official Channel: @Salerybingo

\u1260 24/7 \u1230\u12D3\u1275 \u1208\u121B\u1235\u1270\u1293\u1308\u12F5 \u12DD\u130D\u1301 \u1290\u1295!`;
        await sendTelegramPhoto(botToken, chatId, photoUrl, supportMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
      } else if (data === "btn_instruction") {
        const instructionMsg = `\u{1F4D6} \u12E8\u12A0\u1328\u12CB\u12C8\u1275 \u1218\u1218\u122A\u12EB (Rules & Instructions)

1. "Play \u{1F3AE}" \u12E8\u121A\u1208\u12CD\u1295 \u1260\u1218\u132B\u1295 \u1328\u12CB\u1273\u12CD\u1295 \u12ED\u12AD\u1348\u1271\u1362
2. \u12E8\u12AB\u122D\u1274\u120B \u1218\u12F0\u1265 (10, 20, 50...) \u12A5\u1293 \u12E8\u12AB\u122D\u1274\u120B \u1265\u12DB\u1275 \u12ED\u121D\u1228\u1321\u1362
3. 75 \u1241\u1325\u122E\u127D \u1260\u1245\u12F0\u121D \u1270\u12A8\u1270\u120D \u1260\u12F5\u121D\u1345 \u12A5\u1293 \u1260\u1235\u12AD\u122A\u1291 \u120B\u12ED \u12ED\u1320\u122B\u1209\u1362
4. \u1260\u12AB\u122D\u1274\u120B\u12CE \u120B\u12ED \u12EB\u1209\u1275\u1295 \u1241\u1325\u122E\u127D \u1260\u1218\u1295\u12AB\u1275 \u12A0\u1218\u1233\u1235\u1209\u1362
5. \u1218\u1235\u1218\u122D \u1232\u121E\u120B \u12C8\u12F2\u12EB\u12CD\u1291 "BINGO" \u12E8\u121A\u1208\u12CD\u1295 \u1260\u1218\u132B\u1295 \u12EB\u1238\u1295\u1349!`;
        await sendTelegramPhoto(botToken, chatId, photoUrl, instructionMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
      } else if (data === "btn_transfer") {
        const transferMsg = `\u{1F381} \u1202\u1233\u1265 \u121B\u1235\u1270\u120B\u1208\u134A\u12EB (Transfer)

\u1208\u120C\u120B \u1270\u132B\u12CB\u127D \u1233\u1295\u1272\u121D \u1208\u121B\u1235\u1270\u120B\u1208\u134D \u12E8\u1313\u12F0\u129B\u12CE\u1295 \u12E8\u1274\u120C\u130D\u122B\u121D ID \u12A5\u1293 \u12E8\u121A\u120D\u12A9\u1275\u1295 \u1218\u1320\u1295 \u1208\u12F5\u130B\u134D \u1230\u132A\u12CD \u12ED\u120B\u12A9\u1362

\u{1F464} Support: @Salerybingo_support`;
        await sendTelegramPhoto(botToken, chatId, photoUrl, transferMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
      } else if (data === "btn_withdraw") {
        const fullUser = await getUserFull(fromUser.id);
        const userBal = fullUser?.balance || 0;
        userWithdrawSessions.set(String(fromUser.id), {
          step: "awaiting_amount",
          timestamp: Date.now()
        });
        userDepositSessions.delete(String(fromUser.id));
        const withdrawMsg = `\u{1F911} <b>\u1308\u1295\u12D8\u1265 \u121B\u12CD\u1323\u1275 (Withdraw)</b>

\u{1F4B0} \u12E8\u12A5\u122D\u1235\u12CE \u1240\u122A \u1202\u1233\u1265\u1366 <b>${userBal.toLocaleString()} ETB</b>

\u12A5\u1263\u12AD\u12CE <b>\u1235\u1295\u1275 \u1265\u122D</b> \u121B\u12CD\u1323\u1275 \u12A5\u1295\u12F0\u121A\u1348\u120D\u1309 \u1260\u1241\u1325\u122D \u1265\u127B \u12ED\u120B\u12A9\u1366`;
        await sendTelegramMessage(botToken, chatId, withdrawMsg);
      } else if (data === "btn_invite") {
        const inviteMsg = `\u{1F517} \u12E8\u130D\u1265\u12E3 \u120A\u1295\u12AD (Invite & Earn)

\u1313\u12F0\u129E\u127D\u12CE\u1295 \u12ED\u130B\u1265\u12D9\u1293 \u1208\u12A5\u12EB\u1295\u12F3\u1295\u12F1 \u1270\u130B\u1263\u12E5 5 \u1265\u122D \u1266\u1290\u1235 \u12EB\u130D\u1299!

\u12E8\u12A5\u122D\u1235\u12CE \u1218\u130B\u1260\u12E3 \u120A\u1295\u12AD\u1366
\u{1F449} https://t.me/${botUsername}?start=${fromUser.id}`;
        await sendTelegramPhoto(botToken, chatId, photoUrl, inviteMsg, getMainMenuMarkup(webAppUrl, fromUser.id));
      } else if (data.startsWith("adm_app_")) {
        const txId = data.replace("adm_app_", "");
        const tx = localDb.updateTransactionStatus(txId, "approved");
        if (tx) {
          const curBal = await getUserBalance(tx.telegram_id);
          const newBal = curBal + tx.amount;
          await updateUserBalance(tx.telegram_id, newBal);
          try {
            const client = getSupabase();
            if (client) {
              void client.from("transactions").update({ status: "approved" }).eq("id", txId);
              void client.from("users").update({ balance: newBal }).eq("telegram_id", tx.telegram_id);
            }
          } catch {
          }
          const playerMsg = `\u2705 <b>\u12E8\u1308\u1295\u12D8\u1265 \u121B\u1235\u1308\u1262\u12EB\u12CE \u1270\u1228\u130B\u130D\u1327\u120D! (Deposit Approved)</b>

\u{1F4B0} <b>+${tx.amount} ETB</b> \u12C8\u12F0 \u12A0\u12AB\u12CD\u1295\u1275\u12CE \u1308\u1262 \u1270\u12F0\u122D\u1313\u120D!
\u{1F4B5} <b>\u12E8\u12A0\u1201\u1291 \u1240\u122A \u1202\u1233\u1265\u12CE\u1366 ${newBal} ETB</b>

\u12A0\u1201\u1291\u1291 "Play \u{1F3AE}" \u12E8\u121A\u1208\u12CD\u1295 \u1260\u1218\u132B\u1295 \u12ED\u132B\u12C8\u1271!`;
          await sendTelegramPhoto(botToken, Number(tx.telegram_id), `${webAppUrl}/salery_bingo.jpg`, playerMsg, getMainMenuMarkup(webAppUrl, tx.telegram_id, newBal));
          await sendTelegramMessage(botToken, chatId, `\u2705 <b>\u12E8 ${tx.amount} ETB \u12F2\u1356\u12DA\u1275 \u1338\u12F5\u124B\u120D!</b> \u1208\u1270\u132B\u12CB\u127D ${tx.player_name} (${tx.player_code}) \u1308\u1262 \u1206\u1297\u120D\u1362 \u12E8\u12A0\u1201\u1291 \u1202\u1233\u1261\u1366 ${newBal} ETB`);
        }
      } else if (data.startsWith("adm_rej_")) {
        const txId = data.replace("adm_rej_", "");
        const tx = localDb.updateTransactionStatus(txId, "rejected");
        if (tx) {
          try {
            const client = getSupabase();
            if (client) {
              void client.from("transactions").update({ status: "rejected" }).eq("id", txId);
            }
          } catch {
          }
          await sendTelegramMessage(botToken, Number(tx.telegram_id), `\u274C \u12E8 ${tx.amount} ETB \u12F2\u1356\u12DA\u1275 \u1325\u12EB\u1244\u12CE \u1260\u12A0\u12F5\u121A\u1295 \u12CD\u12F5\u1245 \u1270\u12F0\u122D\u1313\u120D\u1362 \u1325\u12EB\u1244 \u12AB\u1208\u12CE\u1275 \u12F5\u130B\u134D \u1230\u132A\u12CD\u1295 @Salerybingo_support \u12EB\u1290\u130B\u130D\u1229\u1362`);
          await sendTelegramMessage(botToken, chatId, `\u274C \u12E8 ${tx.amount} ETB \u12F2\u1356\u12DA\u1275 \u12CD\u12F5\u1245 \u1270\u12F0\u122D\u1313\u120D\u1362`);
        }
      } else if (data === "adm_refresh") {
        const allUsers = localDb.getAllUsers().filter((u) => u.role !== "admin" && String(u.telegram_id) !== "908336796");
        const pendingTxs = localDb.getTransactions({ status: "pending" });
        await sendTelegramMessage(botToken, chatId, `\u{1F504} <b>\u12E8\u12A0\u1201\u1291 \u1218\u1228\u1303\u1366</b>
\u2022 \u1320\u1245\u120B\u120B \u1270\u132B\u12CB\u127E\u127D\u1366 <b>${allUsers.length}</b>
\u2022 \u12EB\u120D\u1270\u1228\u130B\u1308\u1321 \u12F2\u1356\u12DA\u1276\u127D\u1366 <b>${pendingTxs.filter((t) => t.type === "deposit").length}</b>
\u2022 \u12E8\u12CA\u12DD\u12F5\u122E\u12CD \u1325\u12EB\u1244\u12CE\u127D\u1366 <b>${pendingTxs.filter((t) => t.type === "withdraw").length}</b>`);
      }
    }
  } catch (err) {
    console.error("Error processing Telegram update:", err);
  }
}
function stopLongPolling(reason = "restart") {
  currentPollingInstanceId = `stopped_${Date.now()}`;
  isLongPollingRunning = false;
  currentPollingToken = "";
  console.log(`\u{1F6D1} Stopping Telegram long polling (${reason})`);
}
function isTelegramBotEnabled() {
  if (process.env.DISABLE_TELEGRAM_BOT?.trim().toLowerCase() === "true") return false;
  return process.env.NODE_ENV === "production";
}
function isTelegramPollingEnabled() {
  if (!isTelegramBotEnabled()) return false;
  if (process.env.ENABLE_TELEGRAM_POLLING?.trim().toLowerCase() === "false") return false;
  if (process.env.TELEGRAM_WEBHOOK_URL && process.env.TELEGRAM_WEBHOOK_URL.trim().startsWith("http")) return false;
  return true;
}
async function startLongPolling(botToken) {
  if (!isTelegramPollingEnabled()) {
    console.info("Telegram polling disabled by local or environment configuration.");
    return;
  }
  if (!botToken || !botToken.includes(":") || botToken.length < 15) {
    console.warn("Cannot start Telegram long polling: invalid or missing token.");
    return;
  }
  if (isLongPollingRunning && currentPollingToken === botToken) {
    console.info("Telegram long polling is already active for this process.");
    return;
  }
  stopLongPolling("before-new-instance");
  const instanceId = `${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
  currentPollingInstanceId = instanceId;
  currentPollingToken = botToken;
  isLongPollingRunning = true;
  console.log(`\u{1F680} Starting Telegram Long Polling (Instance: ${instanceId})...`);
  try {
    const delRes = await fetch(
      `https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=false`
    );
    const delData = await delRes.json();
    console.log("Webhook status:", delData.description || delData.ok);
  } catch (e) {
    console.error("Error deleting webhook:", e);
  }
  let offset = 0;
  let consecutiveConflicts = 0;
  while (currentPollingInstanceId === instanceId) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=10`,
        { signal: AbortSignal.timeout(15e3) }
      );
      const data = await res.json();
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
            console.warn("Telegram polling conflict: another poller is using this token; retrying with backoff.");
          }
          const delay = Math.min(3e4, 5e3 * consecutiveConflicts);
          await new Promise((r) => setTimeout(r, delay));
        } else if (data.error_code === 401) {
          console.error("\u274C Telegram Bot Token is unauthorized (401). Stopping polling.");
          break;
        } else {
          console.warn("Telegram getUpdates returned non-ok:", data.description || data);
          await new Promise((r) => setTimeout(r, 4e3));
        }
      }
    } catch (err) {
      const errMsg = err?.message || String(err);
      const isTimeout = errMsg.includes("ETIMEDOUT") || errMsg.includes("ECONNRESET") || errMsg.includes("aborted") || errMsg.includes("fetch failed") || err?.name === "AbortError";
      if (isTimeout) {
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        console.warn("Polling network retry in 3s:", errMsg);
        await new Promise((r) => setTimeout(r, 3e3));
      }
    }
  }
  if (currentPollingInstanceId === instanceId) {
    isLongPollingRunning = false;
    currentPollingToken = "";
  }
}
async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = Number(process.env.PORT) || 8080;
  const HOST = isProduction ? "0.0.0.0" : process.env.HOST || "0.0.0.0";
  const socketServer = new SocketServer(httpServer, {
    cors: {
      origin: (_origin, callback) => callback(null, true),
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket", "polling"]
  });
  attachBingoRooms(socketServer);
  app.use(
    cors({
      origin: (_origin, callback) => callback(null, true),
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-bot-token"],
      credentials: true
    })
  );
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));
  app.use((req, res, next) => {
    try {
      const originHeader = req.headers.origin || req.headers.referer;
      if (originHeader && typeof originHeader === "string" && originHeader.startsWith("http")) {
        const u = new URL(originHeader);
        const host = u.host.toLowerCase();
        if ((host.includes("vercel.app") || host.includes("netlify.app") || host.includes("pages.dev")) && !host.includes("ais-pre-") && !host.includes("ais-dev-") && !host.includes("localhost")) {
          const cfg = localDb.getBotConfig();
          const detectedUrl = `${u.protocol}//${u.host}`;
          if (!cfg.web_app_url || cfg.web_app_url.includes("ais-pre-") || cfg.web_app_url.includes("ais-dev-")) {
            console.log(`\u{1F310} Auto-detected production frontend WebApp URL: ${detectedUrl}`);
            localDb.saveBotConfig(activeBotToken, activeBotUsername, detectedUrl);
          }
        }
      }
    } catch {
    }
    next();
  });
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "salery-bingo-backend",
      supabaseConnected: !!supabase,
      timestamp: /* @__PURE__ */ new Date()
    });
  });
  app.get("/api/admin/database/status", (req, res) => {
    res.json(localDb.getStatus());
  });
  app.get("/api/admin/database/backup", (req, res) => {
    const backupJson = localDb.exportBackup();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="salery_bingo_backup_${Date.now()}.json"`);
    res.send(backupJson);
  });
  app.post("/api/admin/database/restore", (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ ok: false, error: "Backup data required" });
    const success = localDb.importBackup(typeof data === "string" ? data : JSON.stringify(data));
    if (success) {
      return res.json({ ok: true, message: "Database successfully restored from backup!" });
    }
    return res.status(400).json({ ok: false, error: "Invalid backup format" });
  });
  app.get("/api/debug-supabase", (req, res) => {
    res.json({
      ok: true,
      storageType: "local_isolated_secure",
      message: "100% \u122B\u1231\u1295 \u12E8\u127B\u1208 \u12E8\u1270\u1320\u1260\u1240 \u1230\u122D\u1268\u122D \u12F3\u1273\u1264\u12DD (Zero Third-Party Dependency - Supabase \u12A0\u12EB\u1235\u1348\u120D\u1308\u12CD\u121D)",
      dbStatus: localDb.getStatus()
    });
  });
  app.post("/api/bingo/guest-session", async (req, res) => {
    try {
      if (!signBingoGuestToken(0)) {
        return res.status(503).json({ ok: false, error: "BINGO_GUEST_SECRET must be configured with at least 32 characters" });
      }
      const existingPlayerId = Number(req.body?.playerId);
      const existingToken = req.body?.token;
      const isLocalTestRequest = isLoopbackClientAllowed(req.headers.origin, req.socket.remoteAddress);
      if (Number.isSafeInteger(existingPlayerId) && existingPlayerId > 0 && isValidBingoGuestToken(existingPlayerId, existingToken)) {
        let existingAccount = isPostgresConfigured() ? await getPostgresUser(String(existingPlayerId)) : localDb.getUser(String(existingPlayerId));
        if (existingAccount) {
          let mainWallet2 = Number(existingAccount.main_wallet ?? existingAccount.balance ?? 0);
          let balance = Number(existingAccount.balance ?? mainWallet2);
          if (isLocalTestRequest) {
            mainWallet2 = minimumLocalTestBalance(mainWallet2, balance);
            balance = mainWallet2;
            if (isPostgresConfigured()) {
              const updatedBalance = await setPostgresUserBalance(String(existingPlayerId), mainWallet2);
              if (updatedBalance === null) throw new Error("Could not update the local test wallet balance");
              existingAccount = { ...existingAccount, balance: updatedBalance, main_wallet: updatedBalance };
              mainWallet2 = updatedBalance;
              balance = updatedBalance;
            } else {
              existingAccount = localDb.upsertUser({
                ...existingAccount,
                telegram_id: String(existingPlayerId),
                balance: mainWallet2,
                main_wallet: mainWallet2
              });
            }
          }
          const playWallet2 = Number(existingAccount.play_wallet ?? 0);
          return res.json({
            ok: true,
            playerId: existingPlayerId,
            token: existingToken,
            balance,
            mainWallet: mainWallet2,
            playWallet: playWallet2,
            playerCode: existingAccount.player_code
          });
        }
      }
      let playerId = 0;
      let account = null;
      const localTestBalance = isLocalTestRequest ? minimumLocalTestBalance() : 0;
      for (let attempt = 0; attempt < 5 && !account; attempt++) {
        playerId = randomInt(1e15, 125e13);
        const id = String(playerId);
        if (localDb.getUser(id)) continue;
        if (isPostgresConfigured() && await getPostgresUser(id)) continue;
        const newUser = {
          telegram_id: id,
          player_code: generatePlayerCode(id),
          first_name: "Player",
          full_name: "Player",
          username: `player_${id.slice(-4)}`,
          balance: localTestBalance,
          main_wallet: localTestBalance,
          play_wallet: 0,
          role: "user",
          status: "active",
          is_blocked: false,
          is_verified: false
        };
        account = isPostgresConfigured() ? await upsertPostgresUser(newUser) : localDb.upsertUser(newUser);
        if (account && isPostgresConfigured()) {
          localDb.upsertUser({
            ...newUser,
            balance: Number(account.balance ?? 0),
            main_wallet: Number(account.main_wallet ?? account.balance ?? 0),
            play_wallet: Number(account.play_wallet ?? 0)
          });
        }
      }
      if (!account) {
        return res.status(503).json({ ok: false, error: "Could not create a unique guest player account" });
      }
      const token = signBingoGuestToken(playerId);
      if (!token) {
        return res.status(503).json({ ok: false, error: "BINGO_GUEST_SECRET must be configured with at least 32 characters" });
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
        playerCode: account.player_code
      });
    } catch (error) {
      console.error("Could not issue bingo guest session:", error);
      return res.status(500).json({ ok: false, error: "Could not issue bingo guest session" });
    }
  });
  app.post("/api/user/:telegramId/share-bonus", async (req, res) => {
    return res.status(410).json({ ok: false, error: "Share bonuses are no longer credited to player wallets" });
  });
  app.post("/api/user/sync", async (req, res) => {
    try {
      const { telegramId, referredBy } = req.body;
      if (!telegramId) return res.status(400).json({ ok: false, error: "telegramId is required" });
      if (!requireVerifiedPlayer(req, res, String(telegramId))) return;
      const tId = String(telegramId);
      const isAdm = isAdminUser(tId);
      const telegramUser = getVerifiedRequestUser(req);
      const userRole = isAdm ? "admin" : "user";
      const code = generatePlayerCode(tId);
      const telegramFirstName = telegramUser.first_name || "Player";
      const telegramFullName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || "Player";
      const postgresExisting = await getPostgresUser(tId).catch((err) => {
        console.warn("PostgreSQL user lookup failed during sync:", err);
        return null;
      });
      const client = getSupabase();
      let supabaseExisting = null;
      if (!postgresExisting && client) {
        try {
          const { data, error } = await client.from("users").select("*").eq("telegram_id", tId).maybeSingle();
          if (error) console.warn("Supabase user lookup failed during Telegram registration:", error.message);
          else supabaseExisting = data;
        } catch (error) {
          console.warn("Supabase user lookup threw during Telegram registration:", error);
        }
      }
      let existing = postgresExisting ? localDb.upsertUser({
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
        referred_by: postgresExisting.referred_by
      }) : supabaseExisting ? localDb.upsertUser({
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
        referred_by: supabaseExisting.referred_by
      }) : localDb.getUser(tId);
      let finalBalance = existing ? existing.balance : 0;
      const updatedUser = localDb.upsertUser({
        telegram_id: tId,
        player_code: code,
        first_name: telegramFirstName,
        full_name: telegramFullName,
        username: telegramUser.username || existing?.username || "",
        phone_number: existing?.phone_number || "",
        balance: finalBalance,
        role: userRole,
        status: existing?.status || "active",
        is_blocked: !!existing?.is_blocked,
        is_verified: !!existing?.is_verified,
        referred_by: referredBy || existing?.referred_by
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
        referred_by: updatedUser.referred_by
      }).catch((err) => {
        console.warn("PostgreSQL user upsert failed:", err);
        return null;
      });
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
            referred_by: updatedUser.referred_by
          });
          supaSynced = !error;
          if (error) console.warn("Supabase sync warning in /api/user/sync:", error);
          else console.log(`\u26A1 Player synced to Supabase instantly: ${tId} (@${updatedUser.username})`);
        } catch (e) {
          console.warn("Supabase sync exception:", e);
        }
      }
      return res.json({
        ok: true,
        user: updatedUser,
        balance: finalBalance,
        postgresSynced: !!postgresUser,
        supabaseSynced: supaSynced,
        supabaseConnected: !!client,
        storageType: postgresUser ? "postgres" : client ? "supabase_with_local_fallback" : "local_fallback"
      });
    } catch (err) {
      console.error("/api/user/sync error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
  app.get("/api/user/:telegramId", async (req, res) => {
    const telegramId = String(req.params.telegramId);
    if (!requireVerifiedPlayer(req, res, telegramId)) return;
    const isLocalTestRequest = isLoopbackClientAllowed(req.headers.origin, req.socket.remoteAddress);
    const postgresUser = await getPostgresUser(telegramId).catch((err) => {
      console.warn("PostgreSQL profile lookup failed:", err);
      return null;
    });
    let fullUser = await getUserFull(telegramId);
    const client = getSupabase();
    if (client && !postgresUser) {
      try {
        const { data: supaUser } = await client.from("users").select("*").eq("telegram_id", telegramId).maybeSingle();
        if (supaUser) {
          fullUser = localDb.upsertUser({
            telegram_id: telegramId,
            player_code: supaUser.player_code,
            first_name: supaUser.first_name || "Player",
            full_name: supaUser.full_name || supaUser.first_name || "Player",
            username: supaUser.username || "",
            phone_number: supaUser.phone_number || "",
            balance: Number(supaUser.balance ?? 0),
            role: supaUser.role || (isAdminUser(telegramId) ? "admin" : "user"),
            status: supaUser.status || (supaUser.is_blocked ? "blocked" : "active"),
            is_blocked: !!supaUser.is_blocked || supaUser.status === "blocked",
            is_verified: !!supaUser.is_verified || !!supaUser.phone_number
          });
        }
      } catch (err) {
        console.warn("Supabase check in /api/user error:", err);
      }
    }
    if (!fullUser) {
      const devRole = isAdminUser(telegramId) ? "admin" : "user";
      const devBalance = 0;
      const devPlay = 0;
      fullUser = localDb.upsertUser({
        telegram_id: telegramId,
        balance: devBalance,
        main_wallet: devBalance,
        play_wallet: devPlay,
        role: devRole
      });
      if (client && !postgresUser) {
        upsertUserAdaptive({
          telegram_id: telegramId,
          player_code: fullUser.player_code,
          balance: fullUser.balance,
          role: fullUser.role
        }).catch(() => {
        });
      }
    }
    let mainWallet = Number(postgresUser?.main_wallet ?? fullUser?.main_wallet ?? fullUser.balance);
    if (isLocalTestRequest && mainWallet < minimumLocalTestBalance()) {
      mainWallet = minimumLocalTestBalance(mainWallet, fullUser.balance);
      if (postgresUser) {
        const updatedBalance = await setPostgresUserBalance(telegramId, mainWallet);
        if (updatedBalance === null) {
          return res.status(503).json({ ok: false, error: "Could not update the local test wallet balance" });
        }
        mainWallet = updatedBalance;
      }
      localDb.updateUserBalance(telegramId, mainWallet);
      fullUser = { ...fullUser, balance: mainWallet, main_wallet: mainWallet };
    }
    const playWallet = Number(postgresUser?.play_wallet ?? fullUser?.play_wallet ?? 0);
    const balance = mainWallet;
    const isAdmin = isAdminUser(telegramId);
    const playerCode = fullUser.player_code || generatePlayerCode(telegramId);
    const role = isAdmin ? "admin" : fullUser.role || "user";
    const isBlocked = fullUser.status === "blocked" || fullUser.is_blocked === true;
    const banReason = fullUser.ban_reason;
    res.json({
      ok: true,
      telegramId,
      balance,
      mainWallet,
      playWallet,
      playerCode,
      role,
      status: isBlocked ? "blocked" : "active",
      isBlocked,
      ban_reason: isBlocked ? banReason || "\u12E8\u12A0\u1308\u120D\u130D\u120E\u1275 \u12F0\u1295\u1265 \u1218\u1323\u1235" : void 0,
      user: fullUser,
      databaseType: isPostgresConfigured() ? "postgres" : client ? "supabase_realtime_hybrid" : "local_secure",
      supabaseConnected: !!client
    });
  });
  app.get("/api/admin/users", async (req, res) => {
    if (!requireVerifiedAdmin(req, res)) return;
    try {
      const client = getSupabase();
      const postgresUsers = await getPostgresUsers().catch((err) => {
        console.warn("PostgreSQL user list failed:", err);
        return null;
      });
      if (postgresUsers) {
        for (const user of postgresUsers) {
          if (!user.telegram_id) continue;
          localDb.upsertUser({
            telegram_id: String(user.telegram_id),
            player_code: user.player_code,
            first_name: user.first_name || user.full_name || "Player",
            full_name: user.full_name || user.first_name || "Player",
            username: user.username || "",
            phone_number: user.phone_number || "",
            balance: Number(user.balance ?? 0),
            role: user.role || (String(user.telegram_id) === "908336796" ? "admin" : "user"),
            status: user.status || (user.is_blocked ? "blocked" : "active"),
            is_blocked: !!user.is_blocked || user.status === "blocked",
            ban_reason: user.ban_reason,
            is_verified: !!user.is_verified || !!user.phone_number,
            referred_by: user.referred_by
          });
        }
      }
      if (client && !postgresUsers) {
        try {
          const { data: supaUsers, error } = await client.from("users").select("*").order("created_at", { ascending: false });
          if (!error && Array.isArray(supaUsers)) {
            for (const su of supaUsers) {
              if (su.telegram_id) {
                localDb.upsertUser({
                  telegram_id: String(su.telegram_id),
                  player_code: su.player_code,
                  first_name: su.first_name || su.full_name || "Player",
                  full_name: su.full_name || su.first_name || "Player",
                  username: su.username || "",
                  phone_number: su.phone_number || "",
                  balance: Number(su.balance ?? 0),
                  role: su.role || (String(su.telegram_id) === "908336796" ? "admin" : "user"),
                  status: su.status || (su.is_blocked ? "blocked" : "active"),
                  is_blocked: !!su.is_blocked || su.status === "blocked",
                  ban_reason: su.ban_reason,
                  is_verified: !!su.is_verified || !!su.phone_number
                });
              }
            }
          }
        } catch (supaErr) {
          console.warn("Error fetching Supabase users for Admin Panel:", supaErr);
        }
      }
      const allDbUsers = localDb.getAllUsers().map((u) => {
        const tId = String(u.telegram_id);
        const isAdmin = isAdminUser(tId);
        const code = u.player_code || generatePlayerCode(tId);
        const role = isAdmin ? "admin" : u.role || "user";
        const isBlocked = u.status === "blocked" || u.is_blocked === true;
        const banReason = u.ban_reason;
        const balance = Number(u.balance ?? 0);
        return {
          id: u.id,
          telegram_id: tId,
          player_code: code,
          first_name: u.first_name || u.full_name || "Player",
          full_name: u.full_name || u.first_name || "Player",
          username: u.username || "",
          phone_number: u.phone_number || "",
          balance,
          role,
          status: isBlocked ? "blocked" : "active",
          is_blocked: isBlocked,
          ban_reason: isBlocked ? banReason || "\u12E8\u12A0\u1308\u120D\u130D\u120E\u1275 \u12F0\u1295\u1265 \u1218\u1323\u1235" : void 0,
          is_verified: !!u.is_verified || !!u.phone_number,
          created_at: u.created_at || (/* @__PURE__ */ new Date()).toISOString()
        };
      });
      const usersList = allDbUsers.filter((u) => u.role !== "admin" && !isAdminUser(u.telegram_id));
      const totalBalance = usersList.reduce((sum, u) => sum + (u.balance || 0), 0);
      const totalActive = usersList.filter((u) => u.status !== "blocked").length;
      const dbStatus = localDb.getStatus();
      return res.json({
        ok: true,
        storageType: postgresUsers ? "postgres" : client ? "supabase_realtime_hybrid" : "local_isolated_secure",
        isSecure: true,
        users: usersList,
        totalUsers: usersList.length,
        totalBalance,
        admin_revenue: dbStatus.admin_revenue || 0,
        totalActive,
        totalBlocked: usersList.length - totalActive,
        supabaseConnected: !!client,
        securityNotice: client ? "\u26A1 Supabase Cloud Database \u1270\u1308\u1293\u129D\u1277\u120D - \u1260\u1245\u133D\u1260\u1275 \u121B\u1218\u1233\u1230\u120D \u12ED\u1230\u122B\u120D!" : "\u{1F512} \u122B\u1231\u1295 \u12E8\u127B\u1208 \u12E8\u1270\u1320\u1260\u1240 \u1230\u122D\u1268\u122D \u12F3\u1273\u1264\u12DD (Local Secure Storage)"
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });
  app.get("/api/admin/supabase-config", (req, res) => {
    const saved = localDb.getSupabaseConfig();
    const client = getSupabase();
    return res.json({
      ok: true,
      url: saved.url || "",
      isConfigured: !!(saved.url && saved.key),
      isConnected: !!client,
      maskedKey: saved.key ? `${saved.key.slice(0, 6)}...${saved.key.slice(-4)}` : void 0
    });
  });
  app.post("/api/admin/supabase-config", async (req, res) => {
    try {
      const { url, key } = req.body;
      const cleanUrl = (url || "").trim().replace(/\/+$/, "");
      const cleanKey = (key || "").trim();
      if (!cleanUrl || !cleanKey) {
        return res.status(400).json({ ok: false, error: "Supabase URL \u12A5\u1293 Key \u121B\u1235\u1308\u1263\u1275 \u12A0\u1235\u1348\u120B\u130A \u1290\u12CD\u1362" });
      }
      const newClient = reinitSupabase(cleanUrl, cleanKey);
      if (!newClient) {
        return res.status(400).json({ ok: false, error: "\u12E8\u1270\u1230\u1320\u12CD Supabase URL \u12C8\u12ED\u121D Key \u120D\u12AD \u12A0\u12ED\u12F0\u1208\u121D\u1362" });
      }
      const { data, error } = await newClient.from("users").select("id").limit(1);
      const tablesExist = !error || !error.message.includes("does not exist");
      return res.json({
        ok: true,
        isConnected: true,
        tablesExist,
        message: tablesExist ? "\u12A8 Supabase \u12F3\u1273\u1264\u12DD \u130B\u122D \u1260\u1235\u12AC\u1275 \u1270\u1308\u1293\u129D\u1277\u120D! \u1201\u1209\u121D \u1270\u132B\u12CB\u127E\u127D \u12A5\u1293 \u12A5\u1295\u1245\u1235\u1243\u1234\u12CE\u127D \u1260\u1245\u133D\u1260\u1275 \u12ED\u1218\u1233\u1230\u120B\u1209\u1362" : "\u12A8 Supabase \u130B\u122D \u1270\u1308\u1293\u129D\u1277\u120D! \u12E8 SQL \u1230\u1295\u1320\u1228\u12E5 \u1308\u1293 \u12AB\u120D\u1348\u1320\u1229 \u12E8 SQL \u12AE\u12F1\u1295 \u1260 Supabase SQL Editor \u12CD\u1235\u1325 \u12EB\u1202\u12F1\u1362"
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
  app.post("/api/admin/user/:telegramId/balance", async (req, res) => {
    if (!requireVerifiedAdmin(req, res)) return;
    if (!isPostgresConfigured()) {
      return res.status(503).json({ ok: false, error: "PostgreSQL wallet storage is required for balance changes" });
    }
    const telegramId = req.params.telegramId;
    const { balance, delta, reason } = req.body;
    let targetBalance;
    if (typeof balance === "number") {
      targetBalance = balance;
    } else if (typeof delta === "number") {
      const current = await getUserBalance(telegramId);
      targetBalance = Math.max(0, current + delta);
    } else {
      return res.status(400).json({ ok: false, error: "Must provide balance or delta" });
    }
    const success = await updateUserBalance(telegramId, targetBalance);
    console.log(
      `\u{1F451} ADMIN modified balance for ${telegramId}: set to ${targetBalance} ETB (reason: ${reason || "admin_override"})`
    );
    const botToken = getActiveBotToken(req);
    if (botToken && !isNaN(Number(telegramId))) {
      try {
        const changeMsg = `\u{1F514} <b>\u12E8\u1202\u1233\u1265 \u1208\u12CD\u1325 \u121B\u1235\u1273\u12C8\u1242\u12EB (Balance Update)</b>

\u12E8\u12A5\u122D\u1235\u12CE \u1240\u122A \u1202\u1233\u1265 \u1260\u12A0\u12F5\u121A\u1295 \u1270\u1235\u1270\u12AB\u12AD\u120F\u120D\u1366
\u{1F4B0} \u12E8\u12A0\u1201\u1291 \u1240\u122A \u1202\u1233\u1265\u1366 <b>${targetBalance} ETB</b>
${reason ? `\u{1F4DD} \u121D\u12AD\u1295\u12EB\u1275\u1366 ${reason}
` : ""}
\u1218\u120D\u12AB\u121D \u1328\u12CB\u1273! \u{1F3AE}`;
        await sendTelegramMessage(botToken, Number(telegramId), changeMsg);
      } catch (err) {
        console.warn(`Could not notify user ${telegramId}:`, err);
      }
    }
    res.json({
      ok: success,
      telegramId,
      balance: targetBalance
    });
  });
  app.post("/api/admin/user/:telegramId/status", async (req, res) => {
    const telegramId = req.params.telegramId;
    const { status, reason } = req.body;
    const isBlocked = status === "blocked";
    const banReason = reason || "\u12E8\u12A0\u1308\u120D\u130D\u120E\u1275 \u12F0\u1295\u1265 \u1218\u1323\u1235 (Terms Violation)";
    if (isBlocked) {
      inMemoryBannedUsers.set(String(telegramId), {
        reason: banReason,
        banned_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else {
      inMemoryBannedUsers.delete(String(telegramId));
    }
    const client = getSupabase();
    if (client) {
      try {
        const { error } = await client.from("users").update({ status, is_blocked: isBlocked }).eq("telegram_id", String(telegramId));
        if (error) {
          await client.from("users").update({ status }).eq("telegram_id", String(telegramId));
        }
      } catch (err) {
        console.warn("DB update user status err:", err);
      }
    }
    await setPostgresUserStatus(telegramId, isBlocked ? "blocked" : "active", banReason).catch((err) => {
      console.warn("PostgreSQL user status update failed:", err);
      return null;
    });
    console.log(`\u{1F451} ADMIN changed status for user ${telegramId} to: ${status} (Reason: ${banReason})`);
    const botToken = getActiveBotToken(req);
    if (botToken && !isNaN(Number(telegramId))) {
      try {
        if (isBlocked) {
          const banAlert = `\u{1F6AB} <b>\u1218\u1208\u12EB\u12CE \u1260\u12A0\u12F5\u121A\u1295 \u1273\u130D\u12F7\u120D (Account Suspended)</b>

\u12CD\u12F5 \u1270\u132B\u12CB\u127D\u1363 \u12E8\u12A5\u122D\u1235\u12CE \u1218\u1208\u12EB \u1260\u12A0\u12F5\u121A\u1295 \u1273\u130D\u12F7\u120D\u1362
\u{1F4DD} <b>\u121D\u12AD\u1295\u12EB\u1275\u1366</b> ${banReason}

\u1208\u1270\u1328\u121B\u122A \u121B\u1265\u122B\u122A\u12EB \u12C8\u12ED\u121D \u12ED\u130D\u1263\u129D \u12A5\u1263\u12AD\u12CE\u1295 \u12A0\u12F5\u121A\u1295\u1295 \u12EB\u1290\u130B\u130D\u1229\u1362`;
          await sendTelegramMessage(botToken, Number(telegramId), banAlert);
        } else {
          const unbanAlert = `\u2705 <b>\u1218\u1208\u12EB\u12CE \u12D5\u1308\u12F3 \u1270\u1290\u1235\u1276\u1208\u1273\u120D (Account Restored)</b>

\u12CD\u12F5 \u1270\u132B\u12CB\u127D\u1363 \u12E8\u12A5\u122D\u1235\u12CE \u1218\u1208\u12EB \u12A5\u1295\u12F0\u1308\u1293 \u12A0\u1308\u120D\u130D\u120E\u1275 \u12A5\u1295\u12F2\u1230\u1325 \u1270\u1348\u1245\u12F7\u120D!
\u12A0\u1201\u1295 \u1218\u130D\u1263\u1275\u1293 \u1218\u132B\u12C8\u1275 \u12ED\u127D\u120B\u1209\u1362 \u1218\u120D\u12AB\u121D \u1328\u12CB\u1273! \u{1F3AE}`;
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
      reason: isBlocked ? banReason : void 0
    });
  });
  app.post("/api/admin/broadcast", async (req, res) => {
    if (!requireVerifiedAdmin(req, res)) return;
    const { message, targetTelegramId, photoUrl, photoTitle, botToken: bodyToken } = req.body;
    const botToken = bodyToken || getActiveBotToken(req);
    if (!message && !photoUrl) {
      return res.status(400).json({ ok: false, error: "Message or photo is required" });
    }
    if (photoUrl && typeof photoUrl === "string") {
      const exists = localDb.getMedia().some((m) => m.url === photoUrl);
      if (!exists) {
        localDb.addMedia({
          id: "med_" + Date.now(),
          url: photoUrl,
          title: photoTitle || "\u12E8\u1270\u120B\u12A8 \u134E\u1276 (Sent Photo)",
          category: "custom",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
    const cleanAppDomain = resolveWebAppUrl();
    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: "\u{1F3AE} \u12A0\u1201\u1291\u1291 \u1270\u132B\u12C8\u1275 (Play Bingo)",
            web_app: { url: cleanAppDomain }
          }
        ]
      ]
    };
    const finalCaptionOrText = message || "\u{1F4E2} \u12E8\u1233\u1208\u122A \u1262\u1295\u130E \u121B\u1235\u1273\u12C8\u1242\u12EB (Salery Bingo Announcement)";
    try {
      if (targetTelegramId && targetTelegramId !== "all") {
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
        const record2 = {
          id: "bc_" + Date.now(),
          message: finalCaptionOrText,
          photo_url: photoUrl,
          target: String(targetTelegramId),
          sent_count: 1,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        await persistBroadcastRecord(record2);
        return res.json({
          ok: true,
          sentCount: 1,
          record: record2,
          botDelivered: deliveredToTelegram,
          warning: !botToken ? "\u1218\u120D\u12A5\u12AD\u1271 \u1260\u12A0\u1355\u120A\u12AC\u123D\u1291 \u1270\u1218\u12DD\u130D\u1267\u120D\u1362 \u12C8\u12F0 \u1274\u120C\u130D\u122B\u121D \u1266\u1275 \u1260\u1240\u1325\u1273 \u12A5\u1295\u12F2\u12F0\u122D\u1235 \u12E8\u1266\u1275 \u1276\u12A8\u1295 (BOT_TOKEN) \u12EB\u1308\u1293\u1299\u1362" : void 0
        });
      }
      const recipientSet = /* @__PURE__ */ new Set();
      for (const u of localDb.getAllUsers()) {
        if (u.telegram_id && !isNaN(Number(u.telegram_id))) {
          recipientSet.add(String(u.telegram_id));
        }
      }
      for (const t of localDb.getTransactions()) {
        if (t.telegram_id && !isNaN(Number(t.telegram_id))) {
          recipientSet.add(String(t.telegram_id));
        }
      }
      for (const g of localDb.getGameLogs()) {
        if (g.telegram_id && !isNaN(Number(g.telegram_id))) {
          recipientSet.add(String(g.telegram_id));
        }
      }
      recipientSet.add("908336796");
      for (const a of getAdminTelegramIds()) {
        if (a && !isNaN(Number(a))) recipientSet.add(String(a));
      }
      for (const vId of Object.keys(verifiedUsersCache)) {
        if (vId && !isNaN(Number(vId))) {
          recipientSet.add(String(vId));
        }
      }
      try {
        const pgUsers = await getPostgresUsers();
        if (Array.isArray(pgUsers)) {
          for (const pu of pgUsers) {
            if (pu.telegram_id && !isNaN(Number(pu.telegram_id))) {
              recipientSet.add(String(pu.telegram_id));
            }
          }
        }
      } catch {
      }
      try {
        const supaClient = getSupabase();
        if (supaClient) {
          const { data: sUsers } = await supaClient.from("users").select("telegram_id");
          if (Array.isArray(sUsers)) {
            for (const su of sUsers) {
              if (su.telegram_id && !isNaN(Number(su.telegram_id))) {
                recipientSet.add(String(su.telegram_id));
              }
            }
          }
        }
      } catch {
      }
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
                let resObj;
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
          await new Promise((r) => setTimeout(r, 40));
        }
      }
      const isRealToken = !!(botToken && botToken.includes(":") && botToken.length > 15);
      const totalTargetCount = recipientSet.size;
      const record = {
        id: "bc_" + Date.now(),
        message: finalCaptionOrText,
        photo_url: photoUrl,
        target: "all",
        sent_count: deliveredCount || totalTargetCount,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      await persistBroadcastRecord(record);
      socketServer.emit("admin:broadcast", {
        message: finalCaptionOrText,
        photoUrl: photoUrl || void 0,
        createdAt: record.created_at
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
        warning: !isRealToken ? "\u1218\u120D\u12A5\u12AD\u1271 \u1260\u12A0\u12F5\u121A\u1295 \u1353\u1290\u120D \u1270\u1218\u12DD\u130D\u1267\u120D! \u12C8\u12F0 \u1270\u132B\u12CB\u127E\u127D \u1274\u120C\u130D\u122B\u121D \u1235\u120D\u12AD \u1260\u1240\u1325\u1273 \u12A5\u1295\u12F2\u12F0\u122D\u1235 \u12E8\u1266\u1275 \u1276\u12A8\u1295 (BOT_TOKEN) \u121B\u1308\u1293\u1298\u1275 \u12EB\u1235\u1348\u120D\u130B\u120D\u1362" : deliveredCount === 0 && recipientSet.size > 0 ? "\u1218\u120D\u12A5\u12AD\u1271 \u1270\u1218\u12DD\u130D\u1267\u120D\u1364 \u1290\u1308\u122D \u130D\u1295 \u1270\u132B\u12CB\u127E\u127D \u1266\u1271\u1295 \u1260\u1274\u120C\u130D\u122B\u121D (/start) \u12A5\u1235\u12AB\u120D\u1300\u1218\u1229 \u12F5\u1228\u1235 \u1260\u1240\u1325\u1273 \u120A\u12F0\u122D\u1233\u1278\u12CD \u12A0\u12ED\u127D\u120D\u121D\u1362" : void 0
      });
    } catch (e) {
      console.error("Broadcast failed:", e);
      return res.status(500).json({ ok: false, error: e.message });
    }
  });
  app.get("/api/admin/bot-config", (req, res) => {
    const token = getActiveBotToken(req);
    const isRealToken = !!(token && token.includes(":") && token.length > 15);
    const masked = isRealToken ? `${token.slice(0, 7)}...${token.slice(-4)}` : "";
    const currentWebAppUrl = resolveWebAppUrl();
    res.json({
      ok: true,
      isConfigured: isRealToken,
      botUsername: activeBotUsername || "salery_bingo_bot",
      webAppUrl: currentWebAppUrl,
      maskedToken: masked
    });
  });
  app.post("/api/admin/bot-config", async (req, res) => {
    if (!isTelegramBotEnabled()) {
      return res.status(503).json({ ok: false, error: "Telegram bot integration is disabled in local development" });
    }
    const { botToken, botUsername, webAppUrl } = req.body;
    const cleanToken = String(botToken || activeBotToken || "").trim();
    if (!cleanToken && !webAppUrl) {
      return res.status(400).json({ ok: false, error: "\u12E8\u1266\u1275 \u1276\u12A8\u1295 \u12C8\u12ED\u121D \u12E8\u12CC\u1265\u12A0\u1355 \u12A0\u12F5\u122B\u123B \u121B\u1235\u1308\u1263\u1275 \u12A0\u1235\u1348\u120B\u130A \u1290\u12CD" });
    }
    if (webAppUrl && (!botToken || botToken === activeBotToken)) {
      const cleanUrl = String(webAppUrl).trim().replace(/\/$/, "");
      localDb.saveBotConfig(activeBotToken, activeBotUsername, cleanUrl);
      return res.json({
        ok: true,
        message: "\u12E8\u12CC\u1265\u12A0\u1355 \u12A0\u12F5\u122B\u123B \u1260\u1270\u1233\u12AB \u1201\u1294\u1273 \u1270\u1240\u121D\u1327\u120D!",
        bot: { username: activeBotUsername },
        webAppUrl: cleanUrl
      });
    }
    try {
      const testRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      const testData = await testRes.json();
      if (!testData.ok || !testData.result) {
        return res.status(400).json({
          ok: false,
          error: `\u120D\u12AD \u12EB\u120D\u1206\u1290 \u12E8\u1266\u1275 \u1276\u12A8\u1295\u1366 ${testData.description || "\u12E8\u1274\u120C\u130D\u122B\u121D \u12A0\u1308\u120D\u130B\u12ED \u1276\u12A8\u1291\u1295 \u12A0\u120D\u1270\u1240\u1260\u1208\u12CD\u121D"}`
        });
      }
      activeBotToken = cleanToken;
      if (testData.result.username) {
        activeBotUsername = testData.result.username;
      } else if (botUsername) {
        activeBotUsername = String(botUsername).replace("@", "").trim();
      }
      const targetWebUrl = webAppUrl ? String(webAppUrl).trim().replace(/\/$/, "") : resolveWebAppUrl();
      console.log(`\u{1F916} Telegram Bot dynamically connected: @${activeBotUsername} (${testData.result.first_name})`);
      localDb.saveBotConfig(activeBotToken, activeBotUsername, targetWebUrl);
      if (isTelegramPollingEnabled()) {
        startLongPolling(activeBotToken).catch((err) => {
          console.error("Long polling auto-start failed:", err);
        });
      }
      return res.json({
        ok: true,
        message: `\u12E8\u1274\u120C\u130D\u122B\u121D \u1266\u1271 (@${activeBotUsername}) \u1260\u1270\u1233\u12AB \u1201\u1294\u1273 \u1270\u1308\u1293\u129D\u1277\u120D!`,
        bot: testData.result,
        webAppUrl: targetWebUrl
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message || "\u130D\u1295\u1299\u1290\u1275 \u12A0\u120D\u1270\u1233\u12AB\u121D" });
    }
  });
  app.get("/api/admin/broadcast/history", async (_req, res) => {
    try {
      const persistedHistory = await getPostgresBroadcasts();
      if (persistedHistory) return res.json({ ok: true, history: persistedHistory });
      if (isProduction) return res.status(503).json({ ok: false, error: "Broadcast history database is unavailable" });
      return res.json({ ok: true, history: inMemoryBroadcastHistory });
    } catch (error) {
      console.error("Could not load persisted broadcast history:", error);
      return res.status(503).json({ ok: false, error: "Broadcast history database is unavailable" });
    }
  });
  app.get("/api/admin/media", (req, res) => {
    const combined = [...inMemoryMediaGallery];
    for (const tx of inMemoryTransactions) {
      if (tx.screenshot_url && !combined.some((m) => m.url === tx.screenshot_url)) {
        combined.push({
          id: "tx_" + tx.id,
          url: tx.screenshot_url,
          title: `\u12E8\u1270\u132B\u12CB\u127D \u12F0\u1228\u1230\u129D (${tx.player_name || tx.player_code})`,
          category: "receipt",
          created_at: tx.created_at
        });
      }
    }
    res.json({ ok: true, media: combined });
  });
  app.post("/api/admin/media", (req, res) => {
    const { url, title, category } = req.body;
    if (!url) return res.status(400).json({ ok: false, error: "URL required" });
    const newItem = {
      id: "med_" + Date.now(),
      url,
      title: title || "\u12E8\u1270\u1240\u1218\u1320 \u134E\u1276",
      category: category || "custom",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    inMemoryMediaGallery.unshift(newItem);
    res.json({ ok: true, item: newItem });
  });
  app.post("/api/user/:telegramId/balance", (_req, res) => {
    res.status(403).json({ ok: false, error: "Client-side balance changes are disabled" });
  });
  app.get("/api/telegram-photo/:fileId", async (req, res) => {
    const fileId = req.params.fileId;
    const botToken = getActiveBotToken(req);
    if (!botToken || !fileId) {
      return res.status(400).send("Bot token or file_id missing");
    }
    try {
      const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
      const fileData = await fileRes.json();
      if (!fileData.ok || !fileData.result?.file_path) {
        return res.status(404).send("File not found on Telegram");
      }
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
      const imgRes = await fetch(fileUrl);
      if (!imgRes.ok) {
        return res.status(imgRes.status).send("Failed to fetch image from Telegram");
      }
      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const arrayBuffer = await imgRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err) {
      console.error("Telegram photo proxy error:", err);
      res.status(500).send("Error fetching photo");
    }
  });
  app.post("/api/transactions/deposit", async (req, res) => {
    const { id, telegramId, playerName, playerCode, phoneNumber, amount, reference, notes, screenshotUrl, screenshot_url, photoFileId, photo_file_id } = req.body;
    const numAmount = Number(amount);
    if (inMemoryBannedUsers.has(String(telegramId))) {
      return res.status(403).json({ ok: false, error: "User is banned by admin", isBlocked: true });
    }
    if (!telegramId || !numAmount || numAmount < 10) {
      return res.status(400).json({
        ok: false,
        error: "\u12A0\u1290\u1235\u1270\u129B \u12E8\u121B\u1235\u1308\u1262\u12EB \u1218\u1320\u1295 10 \u1265\u122D \u1290\u12CD! \u12A8 10 \u1265\u122D \u1300\u121D\u122E \u121B\u1235\u1308\u1263\u1275 \u12ED\u127D\u120B\u1209 (Min: 10 ETB)"
      });
    }
    const txId = id || "dep_" + Date.now() + "_" + Math.floor(Math.random() * 1e3);
    const finalScreenshotUrl = screenshotUrl || screenshot_url || "";
    const finalPhotoFileId = photoFileId || photo_file_id || "";
    const newTx = {
      id: txId,
      telegram_id: String(telegramId),
      player_name: playerName || "Player",
      player_code: playerCode || generatePlayerCode(telegramId),
      phone_number: phoneNumber || "",
      type: "deposit",
      amount: numAmount,
      status: "pending",
      reference: reference || "Telebirr Transfer",
      screenshot_url: finalScreenshotUrl,
      photo_file_id: finalPhotoFileId,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      notes: notes || ""
    };
    localDb.addTransaction(newTx);
    const postgresTransaction = await savePostgresTransaction(newTx).catch((err) => {
      console.warn("PostgreSQL deposit persistence failed:", err);
      return null;
    });
    const supaDepClient = getSupabase();
    if (supaDepClient) {
      void (async () => {
        try {
          const { error } = await supaDepClient.from("transactions").insert([{
            id: newTx.id,
            telegram_id: newTx.telegram_id,
            player_name: newTx.player_name,
            player_code: newTx.player_code,
            phone_number: newTx.phone_number || "",
            type: newTx.type,
            amount: newTx.amount,
            status: newTx.status,
            reference: newTx.reference || "",
            screenshot_url: newTx.screenshot_url || "",
            photo_file_id: newTx.photo_file_id || "",
            notes: newTx.notes || "",
            created_at: newTx.created_at
          }]);
          if (error) console.warn("Supabase deposit insert error:", error.message);
          else console.log(`\u26A1 Supabase deposit recorded instantly: ${newTx.id} (${newTx.amount} ETB)`);
        } catch {
        }
      })();
    }
    return res.json({
      ok: true,
      transaction: newTx,
      storageType: postgresTransaction ? "postgres" : getSupabase() ? "supabase" : "local_fallback",
      message: "Deposit request submitted successfully."
    });
  });
  app.post("/api/transactions/withdraw", async (req, res) => {
    const { id, telegramId, playerName, playerCode, phoneNumber, amount, paymentMethod, recipientName, reference, notes } = req.body;
    const numAmount = Number(amount);
    if (inMemoryBannedUsers.has(String(telegramId))) {
      return res.status(403).json({ ok: false, error: "User is banned by admin", isBlocked: true });
    }
    if (!telegramId || !numAmount || numAmount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "\u1275\u12AD\u12AD\u1208\u129B \u12E8\u1265\u122D \u1218\u1320\u1295 \u12EB\u1235\u1308\u1261"
      });
    }
    const currentBal = await getUserBalance(String(telegramId));
    const maxWithdrawable = Math.max(0, currentBal - 25);
    if (currentBal <= 25 || maxWithdrawable <= 0) {
      return res.status(400).json({
        ok: false,
        error: `\u1240\u122A \u1202\u1233\u1265\u12CE (${currentBal} ETB) \u1208\u121B\u12CD\u1323\u1275 \u12A0\u12ED\u1260\u1243\u121D\u1362 25 \u1265\u122D \u1201\u120D\u130A\u12DC \u1260\u12A0\u12AB\u12CD\u1295\u1275\u12CE \u12CD\u1235\u1325 \u12A5\u1295\u12F0 \u124B\u121A \u1270\u1240\u121B\u132D \u1218\u1245\u1228\u1275 \u12A0\u1208\u1260\u1275!`
      });
    }
    if (numAmount > maxWithdrawable) {
      return res.status(400).json({
        ok: false,
        error: `25 \u1265\u122D \u1201\u120D\u130A\u12DC \u1260\u12A0\u12AB\u12CD\u1295\u1275\u12CE \u12CD\u1235\u1325 \u1218\u1245\u1228\u1275 \u12A0\u1208\u1260\u1275! \u121B\u12CD\u1323\u1275 \u12E8\u121A\u127D\u1209\u1275 \u12A8\u134D\u1270\u129B\u12CD \u1218\u1320\u1295 ${maxWithdrawable} ETB \u1290\u12CD\u1362`
      });
    }
    const txId = id || "wth_" + Date.now() + "_" + Math.floor(Math.random() * 1e3);
    const methodStr = paymentMethod || "Telebirr";
    const finalRef = reference || (recipientName ? `${methodStr}: ${phoneNumber || "Not provided"} | \u1235\u121D: ${recipientName}` : `${methodStr}: ${phoneNumber || "Not provided"}`);
    const finalNotes = notes || (recipientName ? `\u12E8\u1218\u12AD\u1348\u12EB \u12D8\u12F4: ${methodStr} | \u12E8\u121A\u12C8\u1323\u1260\u1275 \u1235\u121D: ${recipientName}` : `\u12E8\u1218\u12AD\u1348\u12EB \u12D8\u12F4: ${methodStr}`);
    const newTx = {
      id: txId,
      telegram_id: String(telegramId),
      player_name: playerName || "Player",
      player_code: playerCode || generatePlayerCode(telegramId),
      phone_number: phoneNumber || "",
      type: "withdraw",
      amount: numAmount,
      status: "pending",
      reference: finalRef,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      notes: finalNotes
    };
    localDb.addTransaction(newTx);
    const postgresTransaction = await savePostgresTransaction(newTx).catch((err) => {
      console.warn("PostgreSQL withdrawal persistence failed:", err);
      return null;
    });
    const supaWthClient = getSupabase();
    if (supaWthClient) {
      void (async () => {
        try {
          const { error } = await supaWthClient.from("transactions").insert([{
            id: newTx.id,
            telegram_id: newTx.telegram_id,
            player_name: newTx.player_name,
            player_code: newTx.player_code,
            phone_number: newTx.phone_number || "",
            type: newTx.type,
            amount: newTx.amount,
            status: newTx.status,
            reference: newTx.reference || "",
            notes: newTx.notes || "",
            created_at: newTx.created_at
          }]);
          if (error) console.warn("Supabase withdraw insert error:", error.message);
          else console.log(`\u26A1 Supabase withdrawal recorded instantly: ${newTx.id} (${newTx.amount} ETB)`);
        } catch {
        }
      })();
    }
    return res.json({
      ok: true,
      transaction: newTx,
      storageType: postgresTransaction ? "postgres" : getSupabase() ? "supabase" : "local_fallback",
      message: "Withdrawal request submitted successfully."
    });
  });
  app.get("/api/admin/transactions", async (req, res) => {
    const type = req.query.type;
    const status = req.query.status;
    const client = getSupabase();
    const filters = {
      type: type === "deposit" || type === "withdraw" ? type : void 0,
      status: status || void 0
    };
    const transactionMap = /* @__PURE__ */ new Map();
    if (client) {
      try {
        let query = client.from("transactions").select("*").order("created_at", { ascending: false });
        if (filters.type) query = query.eq("type", filters.type);
        if (filters.status) query = query.eq("status", filters.status);
        const { data: supaTxs } = await query;
        if (Array.isArray(supaTxs)) {
          for (const stx of supaTxs) {
            transactionMap.set(stx.id, {
              id: stx.id,
              telegram_id: String(stx.telegram_id),
              player_name: stx.player_name || "Player",
              player_code: stx.player_code || "",
              phone_number: stx.phone_number || "",
              type: stx.type,
              amount: Number(stx.amount || 0),
              status: stx.status || "pending",
              reference: stx.reference || "",
              notes: stx.notes || "",
              created_at: stx.created_at || (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      } catch (err) {
        console.warn("Supabase fetch transactions error:", err);
      }
    }
    for (const transaction of localDb.getTransactions()) transactionMap.set(transaction.id, transaction);
    const postgresTransactions = await getPostgresTransactions(filters).catch((err) => {
      console.warn("PostgreSQL fetch transactions error:", err);
      return null;
    });
    if (postgresTransactions) {
      for (const row of postgresTransactions) {
        transactionMap.set(row.id, {
          ...row,
          telegram_id: String(row.telegram_id),
          amount: Number(row.amount || 0),
          type: row.type,
          status: row.status || "pending",
          created_at: row.created_at || (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
    const list = Array.from(transactionMap.values()).filter((transaction) => (!filters.type || transaction.type === filters.type) && (!filters.status || transaction.status === filters.status)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json({
      ok: true,
      transactions: list,
      totalCount: list.length,
      pendingCount: list.filter((t) => t.status === "pending").length,
      storageType: postgresTransactions ? "postgres" : client ? "supabase_with_local_fallback" : "local_fallback",
      supabaseConnected: !!client
    });
  });
  app.get("/api/admin/financial-movements", (req, res) => {
    try {
      const txs = localDb.getTransactions();
      const logs = localDb.getGameLogs();
      const movements = [];
      for (const t of txs) {
        movements.push({
          id: t.id,
          telegram_id: t.telegram_id,
          player_name: t.player_name,
          player_code: t.player_code,
          type: t.type,
          amount: t.amount,
          status: t.status,
          description: t.type === "deposit" ? "\u12E8\u1308\u1295\u12D8\u1265 \u121B\u1235\u1308\u1262\u12EB (Deposit)" : "\u1308\u1295\u12D8\u1265 \u121B\u12CD\u1323\u1275 (Withdraw)",
          created_at: t.created_at,
          timestamp: new Date(t.created_at).getTime() || Date.now()
        });
      }
      for (const g of logs) {
        if (g.stake > 0) {
          movements.push({
            id: g.id + "_stake",
            telegram_id: g.telegram_id,
            player_name: "Player",
            player_code: g.game_code || "BINGO",
            type: "game_stake",
            amount: g.stake,
            status: "completed",
            description: `\u12E8\u1328\u12CB\u1273 \u12AB\u122D\u1274\u120B \u130D\u12E2 (${g.cards_count || 1} \u12AB\u122D\u1274\u120B - ${g.pattern_name || "1 Line"})`,
            created_at: g.created_at || new Date(g.timestamp).toISOString(),
            timestamp: g.timestamp || Date.now()
          });
        }
        if (g.result === "won" && g.won_amount > 0) {
          movements.push({
            id: g.id + "_win",
            telegram_id: g.telegram_id,
            player_name: "Player",
            player_code: g.game_code || "BINGO",
            type: "game_win",
            amount: g.won_amount,
            status: "completed",
            description: `\u1328\u12CB\u1273 \u121B\u1238\u1290\u134D \u{1F3C6} (${g.pattern_name || "Bingo"} Win)`,
            created_at: g.created_at || new Date(g.timestamp).toISOString(),
            timestamp: (g.timestamp || Date.now()) + 1
          });
        }
      }
      movements.sort((a, b) => b.timestamp - a.timestamp);
      res.json({
        ok: true,
        movements,
        totalCount: movements.length
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  app.delete("/api/admin/transactions/:id", async (req, res) => {
    const txId = req.params.id;
    const localDeleted = localDb.deleteTransaction(txId);
    const postgresDeleted = await deletePostgresTransaction(txId).catch((err) => {
      console.warn("PostgreSQL transaction delete failed:", err);
      return false;
    });
    if (localDeleted || postgresDeleted) {
      return res.json({ ok: true, message: "Transaction deleted/cleared successfully" });
    }
    return res.status(404).json({ ok: false, error: "Transaction not found" });
  });
  app.post("/api/admin/transactions/:id/status", async (req, res) => {
    if (!requireVerifiedAdmin(req, res)) return;
    if (!isPostgresConfigured()) {
      return res.status(503).json({ ok: false, error: "PostgreSQL wallet storage is required for transaction approval" });
    }
    const txId = req.params.id;
    const { status, note } = req.body;
    const nextStatus = status === "rejected" ? "rejected" : "approved";
    const postgresUpdate = await updatePostgresTransactionStatus(txId, nextStatus, note).catch((err) => {
      console.warn("PostgreSQL transaction status update failed:", err);
      return null;
    });
    let tx = postgresUpdate ? postgresUpdate.transaction : localDb.updateTransactionStatus(txId, nextStatus, note);
    if (!tx) {
      return res.status(404).json({ ok: false, error: "Transaction not found" });
    }
    if (postgresUpdate) {
      const existing = localDb.getTransactions().some((transaction) => transaction.id === txId);
      if (!existing) localDb.addTransaction(tx);
      if (postgresUpdate.balanceChanged && postgresUpdate.balance !== null) {
        await updateUserBalance(tx.telegram_id, postgresUpdate.balance);
      }
    }
    const client = getSupabase();
    if (client) {
      void (async () => {
        try {
          await client.from("transactions").update({
            status,
            notes: note ? `${tx.notes || ""} | ${note}`.trim() : tx.notes,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", txId);
        } catch (e) {
          console.warn("Supabase status update error:", e);
        }
      })();
    }
    if (!postgresUpdate && nextStatus === "approved" && tx.type === "deposit") {
      const curBal = await getUserBalance(tx.telegram_id);
      const newBal = curBal + tx.amount;
      await updateUserBalance(tx.telegram_id, newBal);
      if (client) {
        void (async () => {
          try {
            await client.from("users").update({ balance: newBal, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("telegram_id", tx.telegram_id);
          } catch {
          }
        })();
      }
    }
    if (!postgresUpdate && nextStatus === "approved" && tx.type === "withdraw") {
      const curBal = await getUserBalance(tx.telegram_id);
      const newB = Math.max(0, curBal - tx.amount);
      await updateUserBalance(tx.telegram_id, newB);
      if (client) {
        void (async () => {
          try {
            await client.from("users").update({ balance: newB, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("telegram_id", tx.telegram_id);
          } catch {
          }
        })();
      }
    }
    const botToken = getActiveBotToken(req);
    if (botToken && !isNaN(Number(tx.telegram_id))) {
      try {
        const webAppUrl = resolveWebAppUrl();
        const photoUrl = `${webAppUrl}/salery_bingo.jpg`;
        const newBal = await getUserBalance(tx.telegram_id);
        let msg = "";
        if (tx.type === "deposit") {
          msg = status === "approved" ? `\u2705 <b>\u12E8\u1308\u1295\u12D8\u1265 \u121B\u1235\u1308\u1262\u12EB\u12CE \u1270\u1228\u130B\u130D\u1327\u120D! (Deposit Approved)</b>

\u{1F4B0} <b>+${tx.amount} ETB</b> \u12C8\u12F0 \u12A0\u12AB\u12CD\u1295\u1275\u12CE \u1308\u1262 \u1270\u12F0\u122D\u1313\u120D!
\u{1F4B5} <b>\u12E8\u12A0\u1201\u1291 \u1240\u122A \u1202\u1233\u1265\u12CE\u1366 ${newBal} ETB</b>

\u12A0\u1201\u1291\u1291 "Play \u{1F3AE}" \u12E8\u121A\u1208\u12CD\u1295 \u1260\u1218\u132B\u1295 \u12ED\u132B\u12C8\u1271!` : `\u274C <b>\u12E8\u1308\u1295\u12D8\u1265 \u121B\u1235\u1308\u1262\u12EB \u1325\u12EB\u1244\u12CE \u12CD\u12F5\u1245 \u1270\u12F0\u122D\u1313\u120D (Deposit Rejected)</b>

\u12A5\u1263\u12AD\u12CE \u12F5\u130B\u134D \u1230\u132A\u12CD\u1295 @Salerybingo_support \u12EB\u1290\u130B\u130D\u1229\u1362`;
        } else {
          msg = status === "approved" ? `\u2705 <b>\u1308\u1295\u12D8\u1265 \u121B\u12CD\u1323\u1275\u12CE \u1270\u1320\u1293\u124B\u120D! (Withdrawal Completed)</b>

\u{1F4B5} <b>${tx.amount} ETB</b> \u12C8\u12F0 \u1274\u120C\u1265\u122D \u1241\u1325\u122D\u12CE (${tx.phone_number}) \u1270\u120D\u12B3\u120D!
\u{1F4B5} <b>\u12E8\u1240\u1228\u12CD \u1240\u122A \u1202\u1233\u1265\u12CE\u1366 ${newBal} ETB</b>

\u1235\u1208\u1270\u132B\u12C8\u1271 \u12A5\u1293\u1218\u1230\u130D\u1293\u1208\u1295! \u{1F3B1}` : `\u274C <b>\u12E8\u1308\u1295\u12D8\u1265 \u121B\u12CD\u1323\u1275 \u1325\u12EB\u1244\u12CE \u12CD\u12F5\u1245 \u1270\u12F0\u122D\u1313\u120D (Withdrawal Rejected)</b>

\u12A5\u1263\u12AD\u12CE \u12F5\u130B\u134D \u1230\u132A\u12CD\u1295 @Salerybingo_support \u12EB\u1290\u130B\u130D\u1229\u1362`;
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
  app.post("/api/user/:telegramId/game-history", (req, res) => {
    const telegramId = String(req.params.telegramId);
    const { stake, cardsCount, result, wonAmount, patternName, gameCode } = req.body;
    const entry = {
      id: "gm_" + Date.now() + "_" + Math.floor(Math.random() * 1e3),
      telegram_id: telegramId,
      game_code: gameCode || `BB${Math.floor(1e5 + Math.random() * 9e5)}`,
      timestamp: Date.now(),
      stake: Number(stake) || 10,
      cards_count: Number(cardsCount) || 1,
      result: result === "won" ? "won" : "lost",
      won_amount: Number(wonAmount) || 0,
      pattern_name: patternName || "1 Line",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    localDb.addGameLog(entry);
    return res.json({ ok: true, game: entry });
  });
  app.get("/api/user/:telegramId/game-history", (req, res) => {
    const telegramId = String(req.params.telegramId);
    const playerLogs = localDb.getGameLogs(telegramId);
    return res.json({ ok: true, history: playerLogs, totalGames: playerLogs.length });
  });
  app.get("/api/config", (req, res) => {
    res.json({
      appName: "Salery Bingo (\u1233\u1208\u122A \u1262\u1295\u130E)",
      botUsername: process.env.VITE_BOT_USERNAME || "@Salerybingo_bot",
      supabaseConnected: !!supabase,
      version: "1.0.0"
    });
  });
  const webhookHandler = async (req, res) => {
    if (!isTelegramBotEnabled()) {
      return res.status(404).send("Telegram bot integration is disabled in local development");
    }
    if (req.method === "GET") {
      return res.json({
        status: "ok",
        service: "Salery Bingo Telegram Webhook",
        configuredWebhook: process.env.TELEGRAM_WEBHOOK_URL || null,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    const botToken = getActiveBotToken(req);
    if (botToken && req.body) {
      await processTelegramUpdate(req.body, botToken);
    }
    res.status(200).send("OK");
  };
  app.all("/webhook", webhookHandler);
  app.all("/api/webhook", webhookHandler);
  app.all("/api/telegram-webhook", webhookHandler);
  app.all("/api/telegram/webhook", webhookHandler);
  app.post("/", (req, res, next) => {
    if (req.body && (req.body.update_id !== void 0 || req.body.message || req.body.callback_query)) {
      return webhookHandler(req, res);
    }
    next();
  });
  app.get("/health", (_req, res) => res.status(200).json({ status: "ok", service: "Salery Bingo" }));
  app.get("/api/health", (_req, res) => res.status(200).json({ status: "ok", service: "Salery Bingo" }));
  const isLocalDev = process.env.NODE_ENV === "development" && !process.env.PORT && !process.env.RAILWAY_ENVIRONMENT_NAME;
  if (isLocalDev) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch {
    }
  } else {
    const distPath = path2.join(process.cwd(), "dist");
    if (fs2.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.use("/api", (req, res) => {
        res.status(404).json({ error: "API route not found" });
      });
      app.use((req, res) => {
        const indexHtml = path2.join(distPath, "index.html");
        if (fs2.existsSync(indexHtml)) {
          res.sendFile(indexHtml);
        } else {
          res.status(200).send("Salery Bingo Backend API is active");
        }
      });
    } else {
      app.get("/", (req, res) => {
        res.status(200).json({ status: "ok", service: "Salery Bingo Backend" });
      });
    }
  }
  if (isProduction) {
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
    if (!isPostgresConfigured()) {
      throw new Error("Production requires a PostgreSQL connection string in SUPABASE_DB_URL or a supported database URL variable.");
    }
    if (!serviceKey || !getSupabase()) {
      throw new Error("Production requires a valid SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL.");
    }
    await initializePostgres();
    console.info("Supabase PostgreSQL users, game state, and broadcast history tables are ready.");
  }
  httpServer.listen(Number(PORT), HOST, () => {
    console.log(`Salery Bingo Backend listening on http://${HOST}:${PORT}`);
    if (!isProduction && isPostgresConfigured()) {
      initializePostgres().then(() => console.info("PostgreSQL tables are ready.")).catch((err) => console.warn("PostgreSQL startup initialization failed:", err?.message || err));
    }
    try {
      const client = getSupabase();
      if (client && !isProduction) {
        console.log("\u{1F504} Server started with active Supabase connection. Running background sync for local database users...");
        const allLocalUsers = localDb.getAllUsers();
        const allLocalTxs = localDb.getTransactions();
        void (async () => {
          let syncedUsers = 0;
          for (const u of allLocalUsers) {
            try {
              const res = await upsertUserAdaptive(u);
              if (res && !res.error) syncedUsers++;
            } catch {
            }
          }
          console.log(`\u2705 Background sync completed: Synced ${syncedUsers}/${allLocalUsers.length} users to Supabase.`);
          let syncedTxs = 0;
          for (const t of allLocalTxs) {
            try {
              const { error } = await client.from("transactions").upsert([{
                id: t.id,
                telegram_id: t.telegram_id,
                player_name: t.player_name,
                player_code: t.player_code,
                phone_number: t.phone_number || "",
                type: t.type,
                amount: t.amount,
                status: t.status,
                reference: t.reference || "",
                screenshot_url: t.screenshot_url || "",
                photo_file_id: t.photo_file_id || "",
                notes: t.notes || "",
                created_at: t.created_at
              }]);
              if (!error) syncedTxs++;
            } catch {
            }
          }
          console.log(`\u2705 Background sync completed: Synced ${syncedTxs}/${allLocalTxs.length} transactions to Supabase.`);
        })();
      }
    } catch (err) {
      console.warn("Startup background Supabase sync failed:", err);
    }
    const botToken = getActiveBotToken();
    if (!isTelegramBotEnabled()) {
      console.info("Telegram bot initialization, webhooks, and polling disabled for local development.");
    } else if (botToken) {
      const webAppUrl = resolveWebAppUrl();
      fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_button: {
            type: "web_app",
            text: "Play \u{1F3AE}",
            web_app: { url: `${webAppUrl}?v=${Date.now()}` }
          }
        })
      }).catch((e) => console.warn("Could not set chat menu button:", e));
      if (process.env.TELEGRAM_WEBHOOK_URL && process.env.TELEGRAM_WEBHOOK_URL.trim().startsWith("http")) {
        let webhookUrl = process.env.TELEGRAM_WEBHOOK_URL.trim();
        if (!webhookUrl.includes("/webhook") && !webhookUrl.includes("/api/telegram-webhook")) {
          webhookUrl = `${webhookUrl.replace(/\/$/, "")}/api/telegram-webhook`;
        }
        fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=false`).then((res) => res.json()).then((data) => {
          console.log(`\u{1F4E1} Telegram Webhook set to ${webhookUrl}:`, data.description || (data.ok ? "SUCCESS" : "FAILED"));
        }).catch((err) => {
          console.error("Failed to configure Telegram webhook:", err);
        });
      } else if (isTelegramPollingEnabled()) {
        startLongPolling(botToken).catch((err) => {
          isLongPollingRunning = false;
          console.error("Long polling error:", err);
        });
      } else {
        console.info("\u{1F6D1} Telegram bot polling disabled in local mode; app is running without bot startup.");
      }
    } else if (!botToken) {
      console.info("BOT_TOKEN is not set; configure Telegram from the Admin Panel when needed.");
    }
  });
}
startServer().catch((err) => {
  console.error("FATAL startServer exception:", err);
  process.exitCode = 1;
});
export {
  generatePlayerCode,
  getActiveBotToken,
  getAdminTelegramIds,
  getSupabase,
  insertUserAdaptive,
  isAdminUser,
  isUserEverVerified,
  markTelegramUserPermanentlyVerified,
  reinitSupabase,
  resolveBackendUrl,
  resolveWebAppUrl,
  upsertUserAdaptive
};
