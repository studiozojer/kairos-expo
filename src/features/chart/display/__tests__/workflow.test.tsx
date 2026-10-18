import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { MenuView } from '@react-native-menu/menu';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StarLibraryPanel } from '../../stars/StarLibraryPanel';
import { RingsEditor } from '../RingsEditor';
import { DisplaySheet } from '../DisplaySheet';
import { useDisplayPresets } from '../useDisplayPresets';
import { renderingPreset, applyAppearance } from '../model';
import { Action, Choices, LinkRow, Note, Toggle } from '../controls';
import { buildMultiConfiguration } from '../../config/buildConfiguration';
import { RulerSegmentsRing } from '../../render/rings/RulerSegmentsRing';
import chart from '../../fixtures/engine/seattle-2026.json';
import type { ChartCalculationResponse } from '../../config/engine-types';
jest.mock('expo-crypto', () => { let n = 300; return { randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12,'0')}` }; });
const charts = [{ instanceId:'inner',name:'Now',chart:chart as ChartCalculationResponse }];
function Harness() {
  const repo = useDisplayPresets(); if (!repo.state.loaded) return null;
  const local=repo.preset, preset=renderingPreset(local);
  return <DisplaySheet visible preset={preset} displayPreset={local} repository={repo} previewCharts={charts} presetName={local.name}
    config={buildMultiConfiguration(charts,preset)} bodyNames={[]} onSelectPreset={id=>{void repo.select(id);}}
    onChangePreset={next=>{void repo.update(applyAppearance(repo.preset,next));}} onClose={()=>{}} />;
}
beforeEach(async()=>{await AsyncStorage.clear();});
test('ring creation, system changes and removal render and survive relaunch',async()=>{
  let tree!:TestRenderer.ReactTestRenderer; await act(async()=>{tree=TestRenderer.create(<Harness />);});
  const root=()=>tree.root;
  act(()=>root().findByType(SegmentedControl).props.onValueChange('Details'));
  act(()=>root().findAllByType(LinkRow).find(row=>row.props.label==='Rings')!.props.onPress());
  await act(async()=>root().findAllByType(Action).find(row=>row.props.label==='Add sign rulers')!.props.onPress());
  expect(root().findAllByType(RulerSegmentsRing)).toHaveLength(1);
  expect(root().findAllByType(MenuView).find(menu => menu.props.title === 'Display preset')!.props.actions.some((entry:{title:string})=>entry.title==='Classic custom')).toBe(true);
  act(()=>root().findAllByType(LinkRow).find(row=>row.props.label==='Sign rulers')!.props.onPress());
  await act(async()=>root().findAllByType(Choices).find(row=>row.props.label==='Rulership system')!.props.onChange('modern'));
  expect(root().findByType(RulerSegmentsRing).props.ring.type.system).toBe('modern');
  await act(async()=>root().findAllByType(Toggle).find(row=>row.props.label==='Show ring')!.props.onChange(false));
  expect(root().findAllByType(RulerSegmentsRing)).toHaveLength(0);
  await act(async()=>root().findAllByType(Toggle).find(row=>row.props.label==='Show ring')!.props.onChange(true));
  act(()=>tree.unmount()); await act(async()=>{tree=TestRenderer.create(<Harness />);});
  expect(root().findByType(RulerSegmentsRing).props.ring.type.system).toBe('modern');
  act(()=>root().findByType(SegmentedControl).props.onValueChange('Details'));
  act(()=>root().findAllByType(LinkRow).find(row=>row.props.label==='Rings')!.props.onPress());
  act(()=>root().findAllByType(LinkRow).find(row=>row.props.label==='Sign rulers')!.props.onPress());
  await act(async()=>root().findAllByType(Action).find(row=>row.props.label==='Remove ring')!.props.onPress());
  expect(root().findAllByType(RulerSegmentsRing)).toHaveLength(0);
  act(()=>tree.unmount());
});
test('editing a missing chart-count preview does not fabricate chart data',async()=>{
  let tree!:TestRenderer.ReactTestRenderer; await act(async()=>{tree=TestRenderer.create(<Harness />);});
  act(()=>tree.root.findByType(SegmentedControl).props.onValueChange('Details'));
  act(()=>tree.root.findAllByType(LinkRow).find(row=>row.props.label==='Rings')!.props.onPress());
  act(()=>tree.root.findAllByType(Choices).find(row=>row.props.label==='Layout')!.props.onChange(3));
  expect(tree.root.findAllByType(Note).some(node => Array.isArray(node.props.children) && node.props.children[0] === 'Open ' && node.props.children[1] === 3)).toBe(true);
  expect(tree.root.findAllByType(RulerSegmentsRing)).toHaveLength(0);
  act(()=>tree.unmount());
});

test('a fixed-star shortcut preserves selected ring and editing layout, and Manage mutates no preset', async () => {
  let tree!: TestRenderer.ReactTestRenderer; await act(async () => { tree = TestRenderer.create(<Harness />); });
  act(() => tree.root.findByType(SegmentedControl).props.onValueChange('Details'));
  act(() => tree.root.findAllByType(LinkRow).find(row => row.props.label === 'Rings')!.props.onPress());
  act(() => tree.root.findAllByType(Choices).find(row => row.props.label === 'Layout')!.props.onChange(3));
  await act(async () => tree.root.findAllByType(Action).find(row => row.props.label === 'Add fixed stars')!.props.onPress());
  act(() => tree.root.findAllByType(LinkRow).find(row => row.props.label === 'Fixed stars · Chart 1')!.props.onPress());
  const editor = tree.root.findByType(RingsEditor), selected = editor.props.selection;
  const stored = await AsyncStorage.getItem('kairos.display-presets.v1'); expect(stored).not.toBeNull();
  await act(async () => tree.root.findAllByType(Action).find(row => row.props.label === 'Choose stars')!.props.onPress());
  expect(tree.root.findByType(StarLibraryPanel).props.ringContext.message).toContain('inactive layout');
  act(() => tree.root.findByType(StarLibraryPanel).props.onBack());
  expect(tree.root.findByType(RingsEditor)).toBe(editor);
  expect(editor.props.selection).toEqual(selected); expect(editor.props.count).toBe(3);
  await act(async () => tree.root.findAllByType(Action).find(row => row.props.label === 'Choose stars')!.props.onPress());
  act(() => tree.root.findByType(StarLibraryPanel).props.ringContext.onManage());
  expect(editor.props.selection).toEqual(selected); expect(editor.props.count).toBe(3);
  expect(await AsyncStorage.getItem('kairos.display-presets.v1')).toBe(stored);
  act(() => tree.unmount());
});
