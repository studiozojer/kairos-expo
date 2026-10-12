import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useOptionalAuth } from '@/auth/auth-context';
import { StarLibraryRepository } from './library';
const repositories = new Map<string | null, StarLibraryRepository>();
export function useStarLibrary() {
  const auth = useOptionalAuth();
  const scope = auth?.account?.did ?? null;
  const ready = !auth || auth.ready;
  const repository = useMemo(() => {
    let owner = repositories.get(scope);
    if (!owner) { owner = new StarLibraryRepository(AsyncStorage, scope); repositories.set(scope, owner); }
    return owner;
  }, [scope]);
  const state = useSyncExternalStore(repository.subscribe, repository.snapshot, repository.snapshot);
  useEffect(() => { if (ready) void repository.load(); }, [ready, repository]);
  const names = useMemo(() => state.stars.map(star => star.name).sort(), [state.stars]);
  return { repository, state, names, ready: ready && state.loaded, scope };
}
