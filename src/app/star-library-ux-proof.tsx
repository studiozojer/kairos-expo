import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { StarLibraryContent } from '@/features/chart/stars/StarLibraryPanel';
import { StarLibraryRepository, starId } from '@/features/chart/stars/library';
import { configureUXFixture, type CatalogStar } from '@/features/chart/stars/catalog';
const stars: CatalogStar[] = [
  { id: starId('Arcturus'), name: 'Arcturus', designation: 'alBoo', displayDesignation: 'α Boo', constellation: 'Boötes', magnitude: -.05, longitude: 204.22, sign: 'Libra', degrees: 24, minutes: 13 },
  { id: starId('Spica'), name: 'Spica', designation: 'alVir', displayDesignation: 'α Vir', constellation: 'Virgo', magnitude: .97, longitude: 203.83, sign: 'Libra', degrees: 23, minutes: 50 },
];
/** QA-only, never merged or shipped: the real UI/controller/repository with scripted I/O. */
export default function StarLibraryUXProof() {
  const { mode = 'save-failure' } = useLocalSearchParams<{ mode: string }>();
  return <Fixture key={mode} mode={mode} />;
}
function Fixture({ mode }: { mode: string }) {
  const router = useRouter(), theme = useTheme(), insets = useSafeAreaInsets();
  const repository = useMemo(() => {
    configureUXFixture({ failures: mode === 'catalog-failure' ? 1 : 0, stars });
    let payload = JSON.stringify({ version: 1, stars: ['Spica', 'Unknown reference'].map(name => ({ id: starId(name), name })) });
    let readFailed = false, writeFailed = false;
    return new StarLibraryRepository({
      getItem: async () => {
        if (mode === 'load-failure' && !readFailed) { readFailed = true; throw new Error('QA read failure'); }
        return payload;
      },
      setItem: async (_key, value) => {
        if (mode === 'pending' && !writeFailed) { writeFailed = true; await new Promise<void>(resolve => setTimeout(resolve, 25000)); }
        if (mode === 'save-failure' && !writeFailed) { writeFailed = true; throw new Error('QA write failure'); }
        payload = value;
      },
    }, 'qa-only');
  }, [mode]);
  const state = useSyncExternalStore(repository.subscribe, repository.snapshot, repository.snapshot);
  useEffect(() => { void repository.load(); }, [repository]);
  return <><Stack.Screen options={{ headerShown: false }} /><View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: theme.color.bgSolidBase }}>
    <StarLibraryContent onBack={() => router.back()} library={{ repository, state, ready: state.loaded && !state.loadError, scope: 'qa-only', names: state.stars.map(star => star.name) }} />
  </View></>;
}
