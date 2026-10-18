import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MenuView } from '@react-native-menu/menu';
import { Choices, NumberRow } from '@/features/chart/display/controls';
import { FieldStepper } from '../fields.generated';
let view: ReactTestRenderer;
afterEach(() => act(() => view?.unmount()));
test('native picker selections preserve numeric setting values rather than string IDs', () => {
  const onChange = jest.fn();
  act(() => { view = create(<Choices label="Chart source" value={2} options={[[1, 'Inner'], [2, 'Outer']]} onChange={onChange} />); });
  const menu = view.root.findByType(MenuView);
  expect(menu.props.actions.find((option: any) => option.state === 'on').title).toBe('Outer');
  act(() => menu.props.onPressAction({ nativeEvent: { event: '0' } }));
  expect(onChange).toHaveBeenCalledWith(1);
});
test('an unset choice is explicit and cannot choose a value until the user acts', () => {
  const onChange = jest.fn();
  act(() => { view = create(<Choices label="Occurrence" value={undefined} options={[[0, 'Earlier'], [1, 'Later']]} onChange={onChange} />); });
  const menu = view.root.findByType(MenuView);
  expect(onChange).not.toHaveBeenCalled();
  expect(menu.props.actions.find((option: any) => option.state === 'on')).toMatchObject({ id: '__unset', attributes: { disabled: true } });
  act(() => menu.props.onPressAction({ nativeEvent: { event: '__unset' } }));
  expect(onChange).not.toHaveBeenCalled();
  act(() => menu.props.onPressAction({ nativeEvent: { event: '1' } }));
  expect(onChange).toHaveBeenCalledWith(1);
});
test('number rows pass real bounds, units and callbacks to the canonical stepper', () => {
  const onChange = jest.fn();
  act(() => { view = create(<NumberRow label="Opacity" value={75} min={0} max={100} step={5} suffix="%" onChange={onChange} />); });
  const stepper = view.root.findByType(FieldStepper);
  expect(stepper.props).toMatchObject({ min: 0, max: 100, step: 5 });
  expect(stepper.props.format(75)).toBe('75%');
  act(() => stepper.props.onChange(80));
  expect(onChange).toHaveBeenCalledWith(80);
});
