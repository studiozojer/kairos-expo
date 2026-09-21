import { Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Action, LinkRow, Note, Section } from '../display/controls';
import type { ActiveChart } from './model';
import { chartDateLabel } from './wallTime';

export function ReplacementChooser({ active, visible, onSelect, onCancel }: {
  active: ActiveChart[]; visible: boolean; onSelect: (id: string) => void; onCancel: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
    <View style={{ flex: 1, backgroundColor: t.color.bgSolidBase, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ScrollView contentContainerStyle={{ padding: t.space.lg }}>
        <Section title="Choose a chart to replace"><Note>Three charts are already open. Replacing one only closes its open instance; its saved original stays unchanged.</Note>
          {active.map((chart, i) => <LinkRow key={chart.id} label={`Replace ring ${i + 1}: ${chart.name}`}
            detail={chartDateLabel(chart.time, chart.settings.location.timezone)} onPress={() => onSelect(chart.id)} />)}
        </Section><Action label="Cancel" onPress={onCancel} />
      </ScrollView>
    </View>
  </Modal>;
}
