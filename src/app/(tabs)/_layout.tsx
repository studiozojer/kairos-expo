import AppTabs from '@/components/app-tabs';
import { useSegments } from 'expo-router';
import { ChartTimeProvider } from '@/features/chart/time/ChartTimeContext';

export default function TabsLayout() {
  const segments = useSegments();
  const chartActive = segments.some(segment => segment === '(chart)');
  return <ChartTimeProvider enabled={chartActive}><AppTabs /></ChartTimeProvider>;
}
