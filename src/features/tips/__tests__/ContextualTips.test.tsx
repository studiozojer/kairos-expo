import { useLayoutEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ContextualTip, ContextualTipsProvider, CONTEXTUAL_TIPS_KEY, useContextualTips } from '../ContextualTips';

let tips: ReturnType<typeof useContextualTips>;
let view: ReactTestRenderer;
function Probe() {
  const current = useContextualTips();
  useLayoutEffect(() => { tips = current; });
  return <ContextualTip visible={current.isVisible('dragChartCard')}>Drag down to put away</ContextualTip>;
}
const mount = async () => { await act(async () => { view = create(<ContextualTipsProvider><Probe /></ContextualTipsProvider>); }); };
beforeEach(async () => { jest.restoreAllMocks(); jest.clearAllMocks(); await AsyncStorage.clear(); });
afterEach(() => act(() => view?.unmount()));

test('enabled by default; learning is session-only, toggling on restores hints', async () => {
  await mount();
  expect(tips.enabled).toBe(true);
  act(() => tips.dismiss('dragChartCard'));
  expect(tips.isVisible('dragChartCard')).toBe(false);
  expect(view.toJSON()).toBeNull();
  await act(async () => tips.setEnabled(false));
  expect(await AsyncStorage.getItem(CONTEXTUAL_TIPS_KEY)).toBe('false');
  await act(async () => tips.setEnabled(true));
  expect(tips.isVisible('dragChartCard')).toBe(true);
  act(() => tips.dismiss('dragChartCard'));
  act(() => view.unmount());
  await mount();
  expect(tips.isVisible('dragChartCard')).toBe(true);
});

test('persisted off suppresses hints after a new launch', async () => {
  await AsyncStorage.setItem(CONTEXTUAL_TIPS_KEY, 'false');
  await mount();
  expect(tips.enabled).toBe(false);
  expect(view.toJSON()).toBeNull();
});

test('late hydration cannot overwrite a user toggle', async () => {
  let resolve!: (value: string | null) => void;
  jest.spyOn(AsyncStorage, 'getItem').mockReturnValueOnce(new Promise(done => { resolve = done; }));
  await mount();
  await act(async () => tips.setEnabled(false));
  await act(async () => resolve('true'));
  expect(tips.enabled).toBe(false);
});

test('rapid writes are serialized and a failed preference remains retryable', async () => {
  await mount();
  let finish!: () => void;
  const write = jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(() => new Promise<void>(done => { finish = done; }));
  await act(async () => { tips.setEnabled(false); tips.setEnabled(true); });
  expect(write).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(write.mock.calls.map(call => call[1])).toEqual(['false', 'true']);
  expect(await AsyncStorage.getItem(CONTEXTUAL_TIPS_KEY)).toBe('true');
  write.mockRejectedValueOnce(new Error('disk unavailable'));
  await act(async () => tips.setEnabled(false));
  expect(tips.enabled).toBe(false);
  expect(tips.saveError).toBe(true);
  await act(async () => tips.setEnabled(tips.enabled));
  expect(tips.saveError).toBe(false);
  expect(await AsyncStorage.getItem(CONTEXTUAL_TIPS_KEY)).toBe('false');
});
