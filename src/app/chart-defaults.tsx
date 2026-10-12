import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { SettingsEditor } from '@/features/chart/settings/SettingsSheet';
import { useChartSettings } from '@/features/chart/settings/useChartSettings';
export default function ChartDefaultsScreen() {
  const defaults = useChartSettings(), router = useRouter();
  return defaults.loaded
    ? <SettingsEditor visible scope="defaults" settings={defaults.settings} saveError={defaults.saveError} onChange={defaults.update} onClose={() => router.back()} onOpenStars={() => router.push('/star-library')} />
    : <ActivityIndicator accessibilityLabel="Loading chart defaults" />;
}
