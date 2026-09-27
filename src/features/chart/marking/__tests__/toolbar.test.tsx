import { act, create } from 'react-test-renderer';
import { ChartToolbar } from '../ChartToolbar';
import { MarkingMenuButton } from '../MarkingMenu';

jest.mock('../MarkingMenu', () => ({ MarkingMenuButton: 'MarkingMenuButton' }));
jest.mock('../MarkingIcon', () => ({ MarkingIcon: 'MarkingIcon' }));
test('four empty marking buttons expose primary actions and independent availability', () => {
  const actions = { onSettings: jest.fn(), onLock: jest.fn(), onScreenshot: jest.fn(), onDisplay: jest.fn() };
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<ChartToolbar title="Natal" topInset={40} locked settingsEnabled chartEnabled capturing={false} {...actions} />); });
  const buttons = () => view.root.findAllByType(MarkingMenuButton);
  expect(buttons().map(n => n.props.label)).toEqual(['Chart settings', 'Unlock chart', 'Screenshot', 'Display settings']);
  buttons().forEach(button => { expect(button.props.options).toBeUndefined(); act(() => button.props.onPress()); });
  Object.values(actions).forEach(action => expect(action).toHaveBeenCalledTimes(1));
  act(() => view.update(<ChartToolbar title="Chart" topInset={40} locked={false} settingsEnabled={false} chartEnabled={false} capturing {...actions} />));
  expect(buttons()[1].props.label).toBe('Lock chart');
  expect(buttons().every(n => n.props.disabled)).toBe(true);
  act(() => view.unmount());
});
