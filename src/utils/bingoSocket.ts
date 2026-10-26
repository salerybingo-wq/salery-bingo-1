import { io, Socket } from 'socket.io-client';
import { BingoCardModel } from '../types';
import { getBingoGuestSession, isStaticFrontendUrl, PRIMARY_LIVE_BACKEND, BingoGuestSession } from './api';

export const GLOBAL_BINGO_ROOM_ID = 'GLOBAL_ROOM';

export interface BingoRoomSnapshot {
  gameId: string;
  stake: number;
  status: 'waiting' | 'in_progress' | 'finished';
  startsAt: number;
  serverNow?: number;
  called: number[];
  prizePool: number;
  playerCount: number;
  players: Array<{ name: string; cardsCount: number; isOnline?: boolean }>;
  winnerId?: string;
  winnerName?: string;
  winningCardId?: number;
  prize?: number;
}

export interface BingoJoinResult {
  ok: boolean;
  spectator?: boolean;
  error?: string;
  state?: BingoRoomSnapshot;
  cards?: BingoCardModel[];
  balance?: number;
  mainWallet?: number;
  playWallet?: number;
  duplicate?: boolean;
}

export interface BingoClaimResult {
  ok: boolean;
  error?: string;
  state?: BingoRoomSnapshot;
  balance?: number;
  mainWallet?: number;
  playWallet?: number;
  win?: {
    hasWon: boolean;
    patternName: string;
    winningCoordinates: Array<{ row: number; col: number }>;
    multiplier: number;
  };
}

export type BingoSocket = Socket;

function getSocketBackendUrl() {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') {
      return window.location.origin;
    }

    const envBackend = (import.meta as any).env?.VITE_SERVER_URL || (import.meta as any).env?.VITE_BACKEND_URL;
    if (envBackend && typeof envBackend === 'string' && envBackend.startsWith('http')) {
      return envBackend.replace(/\/$/, '');
    }

    const qp = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const explicitUrl =
      qp.get('backend') ||
      hashParams.get('backend') ||
      localStorage.getItem('salery_bingo_backend_url') ||
      '';

    if (explicitUrl.startsWith('http') && !explicitUrl.includes('ais-dev-') && !explicitUrl.includes('ais-pre-')) {
      return explicitUrl.replace(/\/$/, '');
    }

    // Clean up any stale local storage value
    try {
      const stored = localStorage.getItem('salery_bingo_backend_url');
      if (stored && (stored.includes('ais-dev-') || stored.includes('ais-pre-'))) {
        localStorage.removeItem('salery_bingo_backend_url');
      }
    } catch {}

    if (isStaticFrontendUrl(window.location.origin)) {
      return PRIMARY_LIVE_BACKEND;
    }

    return window.location.origin;
  }

  return PRIMARY_LIVE_BACKEND;
}

export function connectBingoSocket(
  playerId: number | string,
  onGuestSession?: (session: BingoGuestSession) => void
): BingoSocket {
  return io(getSocketBackendUrl(), {
    path: '/socket.io',
    auth: (callback) => {
      void getBingoGuestSession().then((session) => {
        onGuestSession?.(session);
        callback({ playerId: String(session.playerId), guestToken: session.token });
      }).catch((error: unknown) => {
        console.error('Could not establish a secure bingo guest session:', error);
        callback({ playerId: String(playerId), guestToken: '' });
      });
    },
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['websocket', 'polling'],
  });
}

export function emitBingoWithAck<T>(
  socket: BingoSocket,
  event: string,
  payload?: unknown,
  timeoutMs = 10_000
): Promise<T> {
  if (timeoutMs <= 0) {
    return new Promise((resolve) => {
      socket.emit(event, payload, (result: T) => resolve(result));
    });
  }

  return new Promise((resolve, reject) => {
    socket.timeout(timeoutMs).emit(event, payload, (error: Error | null, result: T) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}
