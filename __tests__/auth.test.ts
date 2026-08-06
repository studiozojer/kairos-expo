import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import {
  ApiError,
  authorizedFetch,
  clearSession,
  getAccount,
  getSessionToken,
  storeSession,
} from '@/auth/session';
import { signIn, SignInError } from '@/auth/signIn';

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));

const openAuth = WebBrowser.openAuthSessionAsync as jest.Mock;
const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const ACCOUNT = { did: 'did:plc:abc123', handle: 'reader.bsky.social' };

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

describe('session storage', () => {
  it('round-trips token and account', async () => {
    await storeSession('tok-1', ACCOUNT);
    expect(await getSessionToken()).toBe('tok-1');
    expect(await getAccount()).toEqual(ACCOUNT);
  });

  it('is empty before sign-in and after sign-out', async () => {
    expect(await getSessionToken()).toBeNull();
    expect(await getAccount()).toBeNull();
    await storeSession('tok-1', ACCOUNT);
    await clearSession();
    expect(await getSessionToken()).toBeNull();
    expect(await getAccount()).toBeNull();
  });

  it('treats a corrupt stored account as signed out', async () => {
    store.set('kairos_account', '{not json');
    expect(await getAccount()).toBeNull();
  });
});

describe('authorizedFetch', () => {
  it('throws 401 without touching the network when signed out', async () => {
    await expect(authorizedFetch('/api/anything')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the bearer token when signed in', async () => {
    await storeSession('tok-1', ACCOUNT);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    await authorizedFetch('/api/anything');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer tok-1');
  });

  it('clears the session on a server-side 401', async () => {
    await storeSession('tok-1', ACCOUNT);
    fetchMock.mockResolvedValueOnce({ status: 401 });
    await expect(authorizedFetch('/api/anything')).rejects.toBeInstanceOf(ApiError);
    expect(await getSessionToken()).toBeNull();
  });
});

describe('signIn', () => {
  it('completes the federation round trip and stores the session', async () => {
    openAuth.mockResolvedValueOnce({
      type: 'success',
      url: 'kairos://oauth/callback?code=abc',
    });
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ session_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ACCOUNT });

    const account = await signIn('@reader.bsky.social');

    expect(account).toEqual(ACCOUNT);
    expect(await getSessionToken()).toBe('tok-1');
    // The handle is normalized (leading @ stripped) on the way out.
    expect(openAuth.mock.calls[0][0]).toContain('handle=reader.bsky.social');
    // Exchange happened before account resolution, against the server.
    expect(fetchMock.mock.calls[0][0]).toContain('/oauth/exchange');
    expect(fetchMock.mock.calls[1][0]).toContain('/api/auth/session');
  });

  it('surfaces a cancelled auth session without storing anything', async () => {
    openAuth.mockResolvedValueOnce({ type: 'cancel' });
    await expect(signIn('reader.bsky.social')).rejects.toThrow('sign-in was cancelled');
    expect(await getSessionToken()).toBeNull();
  });

  it('maps the server’s handle_not_found to a readable error', async () => {
    openAuth.mockResolvedValueOnce({
      type: 'success',
      url: 'kairos://oauth/callback?error=handle_not_found',
    });
    await expect(signIn('nobody')).rejects.toThrow('handle not found');
  });

  it('refuses an empty handle before opening the browser', async () => {
    await expect(signIn('   ')).rejects.toBeInstanceOf(SignInError);
    expect(openAuth).not.toHaveBeenCalled();
  });

  it('fails loudly when the exchange rejects the code', async () => {
    openAuth.mockResolvedValueOnce({
      type: 'success',
      url: 'kairos://oauth/callback?code=abc',
    });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });
    await expect(signIn('reader.bsky.social')).rejects.toThrow('token exchange');
    expect(await getSessionToken()).toBeNull();
  });
});
