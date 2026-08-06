// Session state: the kairos-server session token (Keychain via
// expo-secure-store) and the signed-in account. Signed out ⇒ zero network,
// everywhere. Ported from zhouyi's src/auth/session.ts (2026-08-05) — the
// sync-status hook zhouyi calls on sign-out does not exist here yet; it
// arrives with Stage 3.

import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'kairos_session_token';
const ACCOUNT_KEY = 'kairos_account';

export interface Account {
  did: string;
  handle: string;
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_KAIROS_API_URL ?? 'https://api.kairos.solar';

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getAccount(): Promise<Account | null> {
  try {
    const raw = await SecureStore.getItemAsync(ACCOUNT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Account;
  } catch {
    // Keychain unreadable (pre-first-unlock) or value corrupt — either way,
    // no account is known.
    return null;
  }
}

export async function storeSession(token: string, account: Account): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(ACCOUNT_KEY, JSON.stringify(account));
}

/** Sign out clears the session. Local journal entries are never touched. */
export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(ACCOUNT_KEY);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Authenticated fetch. Throws ApiError(401) when signed out or expired. */
export async function authorizedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getSessionToken();
  if (!token) throw new ApiError(401, 'not signed in');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    // Session expired server-side: drop it so the UI returns to signed-out.
    await clearSession();
    throw new ApiError(401, 'session expired');
  }
  return response;
}
