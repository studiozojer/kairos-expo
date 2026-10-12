import { View } from 'react-native';
import { useTheme } from '@/theme';
import { StarLibraryPanel } from '@/features/chart/stars/StarLibraryPanel';
export default function StarLibraryScreen() {
  const theme = useTheme();
  return <View style={{flex:1,backgroundColor:theme.color.bgSolidBase}}><StarLibraryPanel /></View>;
}
