import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import {
  ApiError,
  authorizedFetch,
  clearSession,
  getAccount,
  getSessionToken,
  storeSession,
  captureSession,
  isCurrentSession,
  renewSession,
  StaleSessionError,
  subscribeSession,
} from '@/auth/session';
import { signIn, SignInError } from '@/auth/signIn';

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));

const openAuth = WebBrowser.openAuthSessionAsync as jest.Mock;
const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const ACCOUNT = { did: 'did:plc:abc123', handle: 'reader.bsky.social' };

beforeEach(async () => {
  await clearSession();
  store.clear();
  jest.clearAllMocks();
  fetchMock.mockReset();
  openAuth.mockReset();
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
    expect(init.headers.get('Authorization')).toBe('Bearer tok-1');
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const OTHER = { did: 'did:plc:other', handle: 'other.bsky.social' };

describe('account isolation', () => {
  it('does not clear B when an A request returns 401 late', async () => {
    await storeSession('A', ACCOUNT);
    const delayed = deferred<Response>();
    const dispatched = deferred<void>();
    fetchMock.mockImplementationOnce(() => { dispatched.resolve(); return delayed.promise; });
    const request = authorizedFetch('/api/chart-sync/v1/changes');
    await dispatched.promise;
    await storeSession('B', OTHER);
    delayed.resolve({ status: 401 } as Response);
    await expect(request).rejects.toBeInstanceOf(StaleSessionError);
    expect(await getAccount()).toEqual(OTHER);
    expect(await getSessionToken()).toBe('B');
  });

  it('rejects successful stale responses and refuses dispatch with a stale capture', async () => {
    await storeSession('A', ACCOUNT);
    const captured = (await captureSession())!;
    const delayed = deferred<Response>();
    fetchMock.mockReturnValueOnce(delayed.promise);
    const request = authorizedFetch('/api/chart-sync/v1/changes', {}, captured);
    await storeSession('B', OTHER);
    delayed.resolve({ status: 200 } as Response);
    await expect(request).rejects.toBeInstanceOf(StaleSessionError);
    await expect(authorizedFetch('/api/chart-sync/v1/push', {}, captured)).rejects.toBeInstanceOf(StaleSessionError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isCurrentSession(captured)).toBe(false);
  });

  it('does not let an unfinished sign-in undo sign-out', async () => {
    const browser = deferred<{ type: string; url: string }>();
    openAuth.mockReturnValueOnce(browser.promise);
    const pending = signIn('reader.bsky.social');
    await clearSession();
    browser.resolve({ type: 'success', url: 'kairos://oauth/callback?code=old' });
    await expect(pending).rejects.toBeInstanceOf(StaleSessionError);
    expect(await getAccount()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('notifies subscribers on server expiry', async () => {
    await storeSession('A', ACCOUNT);
    const listener = jest.fn();
    const off = subscribeSession(listener);
    fetchMock.mockResolvedValueOnce({ status: 401 });
    await expect(authorizedFetch('/api/chart-sync/v1/changes')).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalled();
    expect(await getAccount()).toBeNull();
    off();
  });

  it('renews tokens, invalidating old captures', async () => {
    await storeSession('A', ACCOUNT);
    const captured = (await captureSession())!;
    fetchMock.mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ ...ACCOUNT, refreshed_token: 'renewed' }) });
    const renewed = await renewSession(captured);
    expect(renewed?.token).toBe('renewed');
    expect(isCurrentSession(captured)).toBe(false);
    expect(isCurrentSession(renewed!)).toBe(true);
  });

  it('guards renewal even if account changes while parsing its response', async () => {
    await storeSession('A', ACCOUNT);
    const json = deferred<unknown>();
    const reading = deferred<void>();
    fetchMock.mockResolvedValueOnce({ status: 200, ok: true, json: () => { reading.resolve(); return json.promise; } });
    const renewal = renewSession();
    await reading.promise;
    await storeSession('B', OTHER);
    json.resolve({ ...ACCOUNT, refreshed_token: 'old-renewal' });
    await expect(renewal).rejects.toBeInstanceOf(StaleSessionError);
    expect(await getSessionToken()).toBe('B');
  });

  it('rejects a token/account mismatch before sync can start', async () => {
    await storeSession('A', ACCOUNT);
    fetchMock.mockResolvedValueOnce({ status: 200, ok: true, json: async () => OTHER });
    await expect(renewSession()).rejects.toThrow('Invalid session account');
    expect(await getAccount()).toEqual(ACCOUNT);
  });

  it('retains offline credentials on network failure', async () => {
    await storeSession('A', ACCOUNT);
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(renewSession()).rejects.toThrow('offline');
    expect(await getAccount()).toEqual(ACCOUNT);
  });
});

describe('storage upgrade', () => {
  async function freshSession() {
    let api!: typeof import('@/auth/session');
    jest.isolateModules(() => { api = require('@/auth/session'); });
    return api;
  }
  it('upgrades a complete legacy pair into one envelope', async () => {
    store.set('kairos_session_token', 'legacy');
    store.set('kairos_account', JSON.stringify(ACCOUNT));
    const api = await freshSession();
    expect(await api.getAccount()).toEqual(ACCOUNT);
    expect(JSON.parse(store.get('kairos_session_v1')!)).toEqual({ version: 1, token: 'legacy', account: ACCOUNT });
  });
  it.each(['missing-token', 'missing-account', 'invalid-did'])('does not restore partial legacy credentials: %s', async (kind) => {
    if (kind !== 'missing-token') store.set('kairos_session_token', 'legacy');
    if (kind !== 'missing-account') store.set('kairos_account', JSON.stringify(kind === 'invalid-did' ? { ...ACCOUNT, did: 'not-a-did' } : ACCOUNT));
    const api = await freshSession();
    expect(await api.captureSession()).toBeNull();
  });
  it('does not fall back to old credentials behind a signed-out envelope', async () => {
    store.set('kairos_session_v1', JSON.stringify({ version: 1, account: null, token: null }));
    store.set('kairos_session_token', 'legacy');
    store.set('kairos_account', JSON.stringify(ACCOUNT));
    expect(await (await freshSession()).captureSession()).toBeNull();
  });
  it('does not let a late boot read undo a newer account', async () => {
    const api = await freshSession();
    const read = deferred<string | null>();
    const spy = jest.spyOn(SecureStore, 'getItemAsync').mockReturnValueOnce(read.promise);
    const boot = api.captureSession();
    await Promise.resolve();
    const signin = api.storeSession('B', OTHER);
    read.resolve(JSON.stringify({ version: 1, token: 'A', account: ACCOUNT }));
    await signin;
    await boot;
    expect(await api.getAccount()).toEqual(OTHER);
    spy.mockRestore();
  });
});
