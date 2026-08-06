import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { clearSession, getAccount, type Account } from './session';
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

/**
 * The app's identity state. The journal is usable signed out — sign-in is for
 * sync (Stage 3), and signed out means ZERO network, a zhouyi law carried
 * here. This provider's only boot-time read is the Keychain.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getAccount().then((stored) => {
      setAccount(stored);
      setReady(true);
    });
  }, []);

  const signIn = useCallback(async (handle: string) => {
    setBusy(true);
    try {
      setAccount(await runSignIn(handle));
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setAccount(null);
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
