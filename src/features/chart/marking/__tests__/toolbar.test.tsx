import { act, create } from 'react-test-renderer';
import { ChartToolbar } from '../ChartToolbar';
import { MarkingMenuButton } from '../MarkingMenu';
import { useActionRegistry } from '../../actions/useActionRegistry';
import { context } from '../../actions/testContext';
import type { ActionContext } from '../../actions/actionRegistry';

jest.mock('../MarkingMenu', () => ({ MarkingMenuButton: 'MarkingMenuButton' }));
jest.mock('../MarkingIcon', () => ({ MarkingIcon: 'MarkingIcon' }));
function Probe({ state }: { state: ActionContext }) {
  const actions = useActionRegistry(state);
  return <ChartToolbar title="Natal" topInset={40} actions={actions} />;
}
test('toolbar dispatches through the live registry and retains empty radial slots', async () => {
  const c = context(); let view!: ReturnType<typeof create>;
  act(() => { view = create(<Probe state={c} />); });
  const buttons = () => view.root.findAllByType(MarkingMenuButton);
  expect(buttons().map(n => n.props.label)).toEqual(['Chart settings', 'Unlock chart', 'Screenshot', 'Display settings']);
  for (const button of buttons()) {
    expect(button.props.options).toBeUndefined();
    await act(async () => button.props.onPress());
  }
  for (const action of [c.openSettings, c.toggleOrientation, c.screenshot, c.openDisplay]) expect(action).toHaveBeenCalledTimes(1);
  const stalePress = buttons()[3].props.onPress;
  act(() => view.update(<Probe state={{ ...c, enabled: false, locked: false }} />));
  expect(buttons()[1].props.label).toBe('Lock chart');
  expect(buttons().every(n => n.props.disabled)).toBe(true);
  await act(async () => stalePress());
  expect(c.openDisplay).toHaveBeenCalledTimes(1);
  act(() => view.unmount());
  await stalePress();
  expect(c.openDisplay).toHaveBeenCalledTimes(1);
});
