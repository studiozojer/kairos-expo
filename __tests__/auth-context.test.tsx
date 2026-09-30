import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import { authorizedFetch, clearSession, storeSession } from '@/auth/session';

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
const ACCOUNT = { did: 'did:plc:abc123', handle: 'reader.bsky.social' };
let auth: ReturnType<typeof useAuth>;
function Probe() { auth = useAuth(); return null; }
let renderer: ReactTestRenderer;
beforeEach(async () => { await clearSession(); });
afterEach(() => { act(() => renderer?.unmount()); });

it('boot restores the account offline, and server expiry updates the provider', async () => {
  await storeSession('A', ACCOUNT);
  const fetchMock = jest.fn().mockResolvedValue({ status: 401 });
  global.fetch = fetchMock;
  await act(async () => { renderer = create(<AuthProvider><Probe /></AuthProvider>); });
  expect(auth.ready).toBe(true);
  expect(auth.account).toEqual(ACCOUNT);
  expect(fetchMock).not.toHaveBeenCalled();
  await act(async () => {
    await expect(authorizedFetch('/api/chart-sync/v1/changes')).rejects.toMatchObject({ status: 401 });
  });
  expect(auth.account).toBeNull();
});

it('tracks account changes and local signout without any logout network request', async () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  await act(async () => { renderer = create(<AuthProvider><Probe /></AuthProvider>); });
  await act(async () => { await storeSession('A', ACCOUNT); });
  expect(auth.account).toEqual(ACCOUNT);
  await act(async () => { await auth.signOut(); });
  expect(auth.account).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});
