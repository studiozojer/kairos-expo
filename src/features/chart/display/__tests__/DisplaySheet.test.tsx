import React from 'react';
import { PanResponder, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
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
  const handle = root.findAll(n => n.props.accessibilityLabel === 'Hide chart preview' && typeof n.props.onPress === 'function')[0];
  act(() => handle.props.onPress());
  expect(root.findByType(ChartWheel).props.size).toBe(size);
  act(() => renderer.unmount());
});

it('keeps the editor in the modal tree while visibility changes for dismissal', () => {
  const preset = bundledPreset('classic')!.preset;
  const props = { visible: true, preset, presetName: 'classic', bodyNames: [], config: buildConfiguration(chart as ChartCalculationResponse, preset), onChangePreset: jest.fn(), onSelectPreset: jest.fn(), onClose: jest.fn() };
  const open = DisplaySheet(props);
  const closing = DisplaySheet({ ...props, visible: false });
  expect(closing.props.visible).toBe(false);
  expect(closing.props.children.props.children.type).toBe(open.props.children.props.children.type);
  expect(open.props.presentationStyle).toBe('pageSheet');
  expect(open.props.allowSwipeDismissal).toBe(true);
  closing.props.onRequestClose();
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

it('keeps an intermediate drag position on release and across tab changes', () => {
  const create = jest.spyOn(PanResponder, 'create');
  const preset = bundledPreset('classic')!.preset;
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<DisplaySheet visible preset={preset} presetName="classic" bodyNames={[]} config={buildConfiguration(chart as ChartCalculationResponse, preset)} onChangePreset={jest.fn()} onSelectPreset={jest.fn()} onClose={jest.fn()} />); });
  const gesture = create.mock.calls.at(-1)![0];
  const cover = () => renderer.root.findAll(n => n.props.testID === 'preview-cover')[0].props.style.top.__getValue();
  const original = cover();
  const size = renderer.root.findByType(ChartWheel).props.size;
  act(() => {
    const event = {} as GestureResponderEvent;
    const state = { dy: -original * .4, vy: -2 } as PanResponderGestureState;
    gesture.onPanResponderGrant!(event, state);
    gesture.onPanResponderMove!(event, state);
    gesture.onPanResponderRelease!(event, state);
  });
  expect(cover()).toBeCloseTo(original * .6);
  act(() => renderer.root.findByType(Choices).props.onChange('Details'));
  expect(cover()).toBeCloseTo(original * .6);
  expect(renderer.root.findByType(ChartWheel).props.size).toBe(size);
  act(() => renderer.unmount());
  create.mockRestore();
});
