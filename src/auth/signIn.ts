// ATProto sign-in via the kairos server's OAuth federation. One account
// across the ecosystem: GET /oauth/start?handle=… in an auth browser session
// → the server redirects to kairos://oauth/callback?code=… → POST
// /oauth/exchange → session token. The kairos:// scheme is the server's
// redirect target; the auth session intercepts it — this app never owns the
// scheme.
//
// Ported from zhouyi's src/auth/signIn.ts (2026-08-05), where this flow is in
// production.

import * as WebBrowser from 'expo-web-browser';

import { API_BASE_URL, storeSession, type Account } from './session';

export class SignInError extends Error {}

export async function signIn(handle: string): Promise<Account> {
  const trimmed = handle.trim().replace(/^@/, '');
  if (!trimmed) throw new SignInError('enter your handle');

  const startUrl = `${API_BASE_URL}/oauth/start?handle=${encodeURIComponent(trimmed)}`;
  const result = await WebBrowser.openAuthSessionAsync(startUrl, 'kairos://oauth/callback');

  if (result.type !== 'success' || !('url' in result)) {
    throw new SignInError('sign-in was cancelled');
  }

  const callback = new URL(result.url);
  const errorCode = callback.searchParams.get('error');
  if (errorCode === 'handle_not_found') {
    throw new SignInError('handle not found — check it and try again');
  }
  if (errorCode) {
    throw new SignInError('sign-in failed — please try again');
  }
  const code = callback.searchParams.get('code');
  if (!code) throw new SignInError('sign-in failed — no code returned');

  const exchange = await fetch(`${API_BASE_URL}/oauth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!exchange.ok) throw new SignInError('sign-in failed at token exchange');
  const { session_token } = (await exchange.json()) as { session_token: string };

  // Resolve the account behind the token.
  const session = await fetch(`${API_BASE_URL}/api/auth/session`, {
    headers: { Authorization: `Bearer ${session_token}` },
  });
  if (!session.ok) throw new SignInError('sign-in failed resolving the account');
  const info = (await session.json()) as { did: string; handle: string };

  const account: Account = { did: info.did, handle: info.handle };
  await storeSession(session_token, account);
  return account;
}
