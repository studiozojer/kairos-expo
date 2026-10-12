import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { StarLibraryPanel } from '@/features/chart/stars/StarLibraryPanel';
export default function StarLibraryScreen() {
  const theme = useTheme(), router = useRouter(), insets = useSafeAreaInsets();
  return <><Stack.Screen options={{ headerShown: false }} /><View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: theme.color.bgSolidBase }}><StarLibraryPanel onBack={() => router.back()} /></View></>;
}
