import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'kairos_session_v1';
const TOKEN_KEY = 'kairos_session_token';
const ACCOUNT_KEY = 'kairos_account';
export interface Account { did: string; handle: string }
export interface SessionSnapshot {
  readonly account: Readonly<Account>;
  readonly token: string;
  readonly generation: number;
}
export const API_BASE_URL = process.env.EXPO_PUBLIC_KAIROS_API_URL ?? 'https://api.kairos.solar';
let generation = 0;
let intent = 0;
let loaded = false;
let current: SessionSnapshot | null = null;
let loading: Promise<void> | null = null;
let writes: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = writes.then(work, work);
  writes = result.catch(() => undefined);
  return result;
}
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function validAccount(value: unknown): value is Account {
  if (!value || typeof value !== 'object') return false;
  const a = value as Account;
  return typeof a.did === 'string' && /^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$/.test(a.did)
    && typeof a.handle === 'string' && a.handle.trim().length > 0;
}
function validToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !/\s/.test(value);
}
function snapshot(token: string, account: Account): SessionSnapshot {
  return Object.freeze({ token, account: Object.freeze({ did: account.did, handle: account.handle }), generation });
}
function decode(raw: string | null): unknown {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loading) {
    const started = generation;
    loading = serialize(async () => {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      let value = decode(raw) as { version?: number; token?: unknown; account?: unknown } | null;
      if (raw === null) {
        const [token, accountRaw] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(ACCOUNT_KEY),
        ]);
        const account = decode(accountRaw);
        value = validToken(token) && validAccount(account) ? { version: 1, token, account } : null;
        if (started !== generation) return;
        // One envelope is the authority. A null envelope prevents partial legacy
        // credentials from being revived after sign-out or interrupted migration.
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value ?? { version: 1, account: null, token: null }));
      }
      if (started !== generation) return;
      current = value?.version === 1 && validToken(value.token) && validAccount(value.account)
        ? snapshot(value.token, value.account) : null;
      loaded = true;
      notify();
    }).finally(() => { loading = null; });
  }
  await loading;
}
export async function captureSession(): Promise<SessionSnapshot | null> {
  await ensureLoaded();
  return current;
}
export function isCurrentSession(value: SessionSnapshot): boolean {
  return current !== null && value.generation === generation && value.token === current.token
    && value.account.did === current.account.did;
}
export async function getSessionToken(): Promise<string | null> { return (await captureSession())?.token ?? null; }
export async function getAccount(): Promise<Account | null> { return (await captureSession())?.account ?? null; }
/** An auth attempt is invalidated by a newer attempt, sign-out, or session change. */
export function beginSignIn(): number { return ++intent; }
export function assertSignInCurrent(attempt: number): void {
  if (attempt !== intent) throw new StaleSessionError();
}
export async function storeSession(token: string, account: Account, attempt?: number): Promise<void> {
  if (!validToken(token) || !validAccount(account)) throw new Error('Invalid session credentials');
  if (attempt !== undefined) assertSignInCurrent(attempt);
  ++intent;
  const started = ++generation;
  current = null;
  loaded = true;
  notify();
  await serialize(async () => {
    if (started !== generation) throw new StaleSessionError();
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ version: 1, token, account }));
    if (started !== generation) throw new StaleSessionError();
    current = snapshot(token, account);
    notify();
  });
}
/** Device-local logout. The server's logout route revokes every device. */
export async function clearSession(): Promise<void> {
  ++intent;
  ++generation;
  current = null;
  loaded = true;
  notify();
  await serialize(async () => {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ version: 1, account: null, token: null }));
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(ACCOUNT_KEY)]);
  });
}
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export class StaleSessionError extends Error {
  constructor() { super('Account session changed; retry with the current account'); }
}
/** Bind dispatch AND response to the caller's captured account/session. */
export async function authorizedFetch(path: string, init: RequestInit = {}, expected?: SessionSnapshot): Promise<Response> {
  const session = expected ?? await captureSession();
  if (!session) throw new ApiError(401, 'not signed in');
  if (!isCurrentSession(session)) throw new StaleSessionError();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${session.token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!isCurrentSession(session)) throw new StaleSessionError();
  if (response.status === 401) {
    await clearSession();
    throw new ApiError(401, 'session expired');
  }
  return response;
}
/** Call on foreground sync. Offline failure retains the locally known account. */
export async function renewSession(expected?: SessionSnapshot, init: RequestInit = {}): Promise<SessionSnapshot | null> {
  const session = expected ?? await captureSession();
  if (!session) return null;
  const response = await authorizedFetch('/api/auth/session', init, session);
  if (!response.ok) throw new ApiError(response.status, 'Unable to refresh session');
  const info = await response.json();
  if (!isCurrentSession(session)) throw new StaleSessionError();
  if (!validAccount(info) || info.did !== session.account.did) throw new Error('Invalid session account');
  const token: unknown = (info as Account & { refreshed_token?: unknown }).refreshed_token ?? session.token;
  if (!validToken(token)) throw new Error('Invalid refreshed token');
  if (token !== session.token || info.handle !== session.account.handle) {
    await serialize(async () => {
      if (!isCurrentSession(session)) throw new StaleSessionError();
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ version: 1, token, account: { did: info.did, handle: info.handle } }));
      if (!isCurrentSession(session)) throw new StaleSessionError();
      ++generation;
      current = snapshot(token, info);
      notify();
    });
  }
  return captureSession();
}
