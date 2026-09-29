import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';

import { AppState } from 'react-native';

import { clearSession, captureSession, isCurrentSession, subscribeSession, type Account } from './session';
import { signIn as runSignIn } from './signIn';

type AuthValue = {
  /** The signed-in account, or null. */
  account: Account | null;
  /** False until the stored session has been read at boot. */
  ready: boolean;
  /** True while a sign-in round trip is in flight. */
  busy: boolean;
  /** Throws SignInError; the screen owns error display. */
  signIn: (handle: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const operation = useRef(0);
  useEffect(() => {
    let live = true;
    let updateVersion = 0;
    const update = async () => {
      const own = ++updateVersion;
      try {
        const stored = await captureSession();
        if (live && own === updateVersion && (!stored || isCurrentSession(stored))) setAccount(stored?.account ?? null);
      } catch {
        // Keychain may be unavailable before first unlock. Never erase it.
        if (live && own === updateVersion) setAccount(null);
      } finally {
        if (live && own === updateVersion) setReady(true);
      }
    };
    const unsubscribe = subscribeSession(() => { void update(); });
    const foreground = AppState.addEventListener('change', (state) => { if (state === 'active') void update(); });
    void update();
    return () => { live = false; unsubscribe(); foreground.remove(); };
  }, []);

  const signIn = useCallback(async (handle: string) => {
    const own = ++operation.current;
    setBusy(true);
    try { await runSignIn(handle); }
    finally { if (own === operation.current) setBusy(false); }
  }, []);

  const signOut = useCallback(async () => {
    ++operation.current;
    setBusy(false);
    await clearSession();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ account, ready, busy, signIn, signOut }),
    [account, ready, busy, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth outside AuthProvider');
  return auth;
}

/** Optional for isolated chart previews; the application always supplies AuthProvider. */
export function useOptionalAuth(): AuthValue | null {
  return useContext(AuthContext);
}
