import { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Modal, View } from 'react-native';
import { SettingsSheet } from '../SettingsSheet';
import { DEFAULT_SETTINGS } from '../chartSettings';
import { StarLibraryPanel } from '../../stars/StarLibraryPanel';
import { LinkRow } from '../../display/controls';
jest.mock('../../stars/StarLibraryPanel', () => ({ StarLibraryPanel: () => null }));
test('settings-to-ring management retains the same library in one native modal host', () => {
  let back!: () => void;
  function Harness() {
    const [manage, setManage] = useState(false); back = () => setManage(false);
    return <SettingsSheet visible settings={DEFAULT_SETTINGS} saveError={false} onChange={() => {}} onClose={() => {}}
      starRingContext={{ message: 'No fixed-star ring is configured.', onManage: () => setManage(true) }} ringEditor={manage ? <View testID="ring-editor" /> : undefined} />;
  }
  let tree!: ReactTestRenderer; act(() => { tree = create(<Harness />); });
  act(() => tree.root.findAllByType(LinkRow).find(row => row.props.label === 'Personal star library')!.props.onPress());
  const library = tree.root.findByType(StarLibraryPanel);
  act(() => library.props.ringContext.onManage());
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  expect(tree.root.findByType(StarLibraryPanel)).toBe(library);
  expect(tree.root.findAllByType(View).some(node => node.props.testID === 'ring-editor')).toBe(true);
  act(() => back()); expect(tree.root.findByType(StarLibraryPanel)).toBe(library);
  act(() => library.props.onBack()); expect(tree.root.findAllByType(StarLibraryPanel)).toHaveLength(0);
  expect(tree.root.findAllByType(LinkRow).some(row => row.props.label === 'House system')).toBe(true);
  act(() => tree.unmount());
});
