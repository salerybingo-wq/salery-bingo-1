import { createHmac, timingSafeEqual } from 'node:crypto';

export const LOCAL_TEST_BALANCE = 50;

export function minimumLocalTestBalance(...balances: unknown[]): number {
  const validBalances = balances
    .map(Number)
    .filter((balance) => Number.isFinite(balance) && balance >= 0);
  return Math.max(LOCAL_TEST_BALANCE, ...validBalances);
}

function getGuestSecret(): string {
  const configuredSecret = process.env.BINGO_GUEST_SECRET || '';
  if (configuredSecret.length >= 32) return configuredSecret;
  if (process.env.NODE_ENV !== 'production') return 'local-bingo-guest-secret-change-before-deploy';
  return '';
}

export function signBingoGuestToken(playerId: string | number): string | null {
  const secret = getGuestSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(`bingo-guest:${playerId}`).digest('hex');
}

export function isValidBingoGuestToken(playerId: string | number, token: unknown): boolean {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return false;
  const expected = signBingoGuestToken(playerId);
  if (!expected) return false;
  const providedBytes = Buffer.from(token, 'hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}
