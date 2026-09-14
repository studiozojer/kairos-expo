import { MenuView } from '@react-native-menu/menu';
import React from 'react';
import { Modal } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import TestRenderer, { act } from 'react-test-renderer';
import { DisplaySheet } from '../DisplaySheet';
import { ChartWheel } from '../../render/ChartWheel';
import { Choices, LinkRow, Toggle } from '../controls';
import { bundledPreset } from '../presets';
import { buildConfiguration } from '../../config/buildConfiguration';
import type { ChartCalculationResponse } from '../../config/engine-types';
import chart from '../../fixtures/engine/sibly-1776.json';
import { planetStyles } from '../sharedControls';

it('navigates the agreed pages, applies global labels, and keeps preview size fixed', () => {
  const preset = bundledPreset('classic')!.preset;
  const onChange = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<DisplaySheet visible preset={preset} presetName="classic" bodyNames={[]} config={buildConfiguration(chart as ChartCalculationResponse, preset)} onChangePreset={onChange} onSelectPreset={jest.fn()} onClose={jest.fn()} />); });
  const root = renderer.root;
  const size = root.findByType(ChartWheel).props.size;
  expect(root.findAllByType(LinkRow).map(n => n.props.label)).toEqual(['Asteroids', 'Lots']);
  act(() => root.findByType(Choices).props.onChange('Details'));
  expect(root.findAllByType(LinkRow).map(n => n.props.label)).toEqual(['Aspect types & orbs', 'Aspect patterns', 'Aspect filtering', 'Static orientation']);
  act(() => root.findAllByType(Toggle).find(n => n.props.label === 'Minutes')!.props.onChange(true));
  expect(planetStyles(onChange.mock.calls[0][0]).every(s => s.showMinuteText)).toBe(true);
  act(() => root.findByType(Choices).props.onChange('Style'));
  expect(root.findAllByType(LinkRow).map(n => n.props.label)).toEqual(['Aspect line styling', 'Selection']);
  act(() => fireGestureHandler(getByGestureTestId('preview-tap')));
  expect(root.findByType(ChartWheel).props.size).toBe(size);
  act(() => renderer.unmount());
});

it('keeps the editor in the modal tree while visibility changes for dismissal', () => {
  const preset = bundledPreset('classic')!.preset;
  const props = { visible: true, preset, presetName: 'classic', bodyNames: [], config: buildConfiguration(chart as ChartCalculationResponse, preset), onChangePreset: jest.fn(), onSelectPreset: jest.fn(), onClose: jest.fn() };
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<DisplaySheet {...props} />); });
  const open = renderer.root.findByType(Modal).props;
  act(() => renderer.update(<DisplaySheet {...props} visible={false} />));
  const closing = renderer.root.findByType(Modal).props;
  expect(closing.visible).toBe(false);
  expect(closing.children.props.children.props.children.type).toBe(open.children.props.children.props.children.type);
  expect(open.presentationStyle).toBe('pageSheet');
  expect(open.allowSwipeDismissal).toBe(true);
  act(() => closing.onRequestClose());
  expect(props.onClose).toHaveBeenCalledTimes(1);
  act(() => renderer.unmount());
});

it('keeps an intermediate drag position on release and across tab changes', () => {
  const preset = bundledPreset('classic')!.preset;
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<DisplaySheet visible preset={preset} presetName="classic" bodyNames={[]} config={buildConfiguration(chart as ChartCalculationResponse, preset)} onChangePreset={jest.fn()} onSelectPreset={jest.fn()} onClose={jest.fn()} />); });
  const cover = () => renderer.root.findAll(n => n.props.testID === 'preview-cover')[0].props.style.top.__getValue();
  const original = cover();
  const size = renderer.root.findByType(ChartWheel).props.size;
  act(() => {
    fireGestureHandler(getByGestureTestId('preview-pan'), [
      { state: State.BEGAN, absoluteY: 600 },
      { state: State.ACTIVE, absoluteY: 600 - original * .2 },
      { state: State.ACTIVE, absoluteY: 600 - original * .4 },
      { state: State.END, absoluteY: 600 - original * .4, velocityY: -2000 },
    ]);
  });
  expect(cover()).toBeCloseTo(original * .6);
  act(() => renderer.root.findByType(Choices).props.onChange('Details'));
  expect(cover()).toBeCloseTo(original * .6);
  expect(renderer.root.findByType(ChartWheel).props.size).toBe(size);
  act(() => fireGestureHandler(getByGestureTestId('preview-pan'), [
    { state: State.BEGAN, absoluteY: 300 },
    { state: State.ACTIVE, absoluteY: 300 + original * .1 },
    { state: State.END, absoluteY: 300 + original * .1 },
  ]));
  expect(cover()).toBeCloseTo(original * .7);
  act(() => renderer.unmount());
});


it('starts halfway and remembers dragged and hidden positions after closing the sheet', () => {
  const preset = bundledPreset('classic')!.preset;
  const props = { preset, presetName: 'classic', bodyNames: [], config: buildConfiguration(chart as ChartCalculationResponse, preset), onChangePreset: jest.fn(), onSelectPreset: jest.fn(), onClose: jest.fn() };
  let renderer!: TestRenderer.ReactTestRenderer;
  const render = (visible: boolean) => <DisplaySheet {...props} visible={visible} />;
  act(() => { renderer = TestRenderer.create(render(true)); });
  const cover = () => renderer.root.findAll(n => n.props.testID === 'preview-cover')[0].props.style.top.__getValue();
  const half = renderer.root.findByType(ChartWheel).props.size / 2;
  expect(cover()).toBe(half);
  act(() => fireGestureHandler(getByGestureTestId('preview-pan'), [
    { state: State.BEGAN, absoluteY: 400 },
    { state: State.ACTIVE, absoluteY: 340 },
    { state: State.END, absoluteY: 340 },
  ]));
  expect(cover()).toBe(half - 60);
  act(() => renderer.update(render(false)));
  expect(renderer.root.findAllByType(ChartWheel)).toHaveLength(0);
  act(() => renderer.update(render(true)));
  expect(cover()).toBe(half - 60);
  act(() => fireGestureHandler(getByGestureTestId('preview-tap')));
  expect(cover()).toBe(0);
  act(() => renderer.update(render(false)));
  act(() => renderer.update(render(true)));
  expect(cover()).toBe(0);
  expect(props.onChangePreset).not.toHaveBeenCalled();
  act(() => renderer.unmount());
});


it('selects presets from the native menu without replacing the active settings subpage', () => {
  const preset = bundledPreset('classic')!.preset;
  const onSelectPreset = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<DisplaySheet visible preset={preset} presetName="classic" bodyNames={[]} config={buildConfiguration(chart as ChartCalculationResponse, preset)} onChangePreset={jest.fn()} onSelectPreset={onSelectPreset} onClose={jest.fn()} />); });
  const root = renderer.root;
  act(() => root.findByType(Choices).props.onChange('Style'));
  act(() => root.findAllByType(LinkRow).find(n => n.props.label === 'Aspect line styling')!.props.onPress());
  const menu = root.findByType(MenuView);
  expect(menu.props.shouldOpenOnLongPress).toBe(false);
  expect(menu.props.actions.find((a: { id: string }) => a.id === 'classic').state).toBe('on');
  act(() => menu.props.onPressAction({ nativeEvent: { event: 'classic' } }));
  expect(onSelectPreset).not.toHaveBeenCalled();
  act(() => menu.props.onPressAction({ nativeEvent: { event: 'minimal' } }));
  expect(onSelectPreset).toHaveBeenCalledWith('minimal');
  expect(root.findAllByType(Choices).map(n => n.props.label)).toEqual(['Color', 'Shape']);
  act(() => renderer.unmount());
});
