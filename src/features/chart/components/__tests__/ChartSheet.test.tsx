import { useState } from 'react';
import { act, create } from 'react-test-renderer';
import { Modal, Platform, Pressable, Text } from 'react-native';
import { ChartSheet } from '../ChartSheet';

function Probe() {
  const [visible, setVisible] = useState(true);
  return <>
    <Pressable testID="open" onPress={() => setVisible(true)} />
    <ChartSheet visible={visible} onClose={() => setVisible(false)}>
      <Pressable testID="close" onPress={() => setVisible(false)}><Text>Close</Text></Pressable>
    </ChartSheet>
  </>;
}

test.each(['ios', 'android'] as const)('%s closes and reopens without retaining swipe cleanup state', platform => {
  const original = Platform.OS;
  Platform.OS = platform;
  let view!: ReturnType<typeof create>;
  try {
    act(() => { view = create(<Probe />); });
    const modal = () => view.root.findByType(Modal).props;
    const open = () => {
      act(() => view.root.findByProps({ testID: 'open' }).props.onPress());
      expect(modal().visible).toBe(true);
      expect(modal().animationType).toBe('slide');
      act(() => modal().onShow());
    };
    for (let i = 0; i < 2; i++) {
      // iOS sends this only after completing its interactive dismissal.
      // Android sends it for Back, which still needs the dismissal animation.
      act(() => modal().onRequestClose());
      expect(modal().visible).toBe(false);
      expect(modal().animationType).toBe(platform === 'ios' ? 'none' : 'slide');
      open();
      act(() => view.root.findByProps({ testID: 'close' }).props.onPress());
      expect(modal().visible).toBe(false);
      expect(modal().animationType).toBe('slide');
      open();
    }
  } finally {
    act(() => view?.unmount());
    Platform.OS = original;
  }
});
