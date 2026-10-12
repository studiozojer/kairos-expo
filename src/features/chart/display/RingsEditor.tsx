import { useState } from 'react';
import { View } from 'react-native';
import { Action, Choices, LinkRow, Note, NumberRow, Section, Toggle } from './controls';
import type { ColorValue } from '../schema/core-types';
import { createRing, editRing, moveRing, RING_KINDS, RING_TITLES, type ChartCount, type DisplayPreset, type DisplayRing, type RingKind } from './model';
export interface RingSelection { id: string; kind: RingKind; sourceSlot?: number }
export function RingsEditor({ preset, count, onCount, onChange, onOpenStars, selection, onSelect }: { preset: DisplayPreset; count: ChartCount; onCount: (count: ChartCount) => void; onChange: (preset: DisplayPreset) => void; onOpenStars?: (sourceSlot: number) => void; selection?: RingSelection | null; onSelect?: (selection: RingSelection | null) => void }) {
  const [localSelection, setLocalSelection] = useState<RingSelection | null>(null);
  const selected = selection === undefined ? localSelection : selection;
  const setSelected = onSelect ?? setLocalSelection;
  const rings = preset.layouts[count].rings;
  const ring = selected ? rings.find(item => item.id === selected.id) ?? rings.find(item => item.kind === selected.kind && ('sourceSlot' in item ? item.sourceSlot : undefined) === selected.sourceSlot) : undefined;
  const change = (update: (ring: DisplayRing) => DisplayRing) => { if (ring) onChange(editRing(preset,count,ring.id,update)); };
  const option = (key: string, value: unknown) => change(item => ({ ...item, options: { ...item.options, [key]: value } } as DisplayRing));
  const style = (key: string, value: unknown) => change(item => ({ ...item, style: { ...item.style, [key]: value } } as DisplayRing));
  const add = (kind: RingKind) => {
    const ring = createRing(kind);
    const next = { ...preset, layouts: { ...preset.layouts, [count]: { ...preset.layouts[count], rings: [ring,...rings] } } };
    onChange(next);
  };
  return <>
    <Choices label="Layout" value={count} options={[[1,'One chart'],[2,'Two charts'],[3,'Three charts']]} onChange={value => { setSelected(null); onCount(value); }} />
    <Note>Rings are listed from the outside inward. Moving a ring keeps its chart source.</Note>
    {ring ? <>
      <Action label="Back to rings" onPress={() => setSelected(null)} />
      <Section title={RING_TITLES[ring.kind]}>
        {ring.kind === 'fixedStars' && <><Note>This ring shows your personal star library. An empty library keeps the ring shell visible.</Note>{onOpenStars && <Action label="Choose stars" onPress={() => onOpenStars(ring.sourceSlot)} />}</>}
        <Toggle label="Show ring" value={ring.enabled} onChange={enabled => change(item => ({ ...item, enabled }))} />
        {'sourceSlot' in ring && ring.kind !== 'planets' && <Choices label="Chart source" value={ring.sourceSlot} options={Array.from({ length: count },(_,i) => [i+1,`${i+1}${i === 0 ? ' · Inner chart' : ''}`] as const)} onChange={value => change(item => ({ ...item, sourceSlot: value } as DisplayRing))} />}
        {'system' in ring.options && <Choices label="Rulership system" value={ring.options.system} options={(ring.kind === 'signRulers' ? ['traditional','modern'] : ring.kind === 'decans' ? ['chaldean','triplicity','modern'] : ['egyptian','ptolemaic','chaldean']).map(system => [system,system.charAt(0).toUpperCase()+system.slice(1)] as const)} onChange={value => option('system',value)} />}
        {Object.entries(ring.options).filter(([,value]) => typeof value === 'boolean').map(([key,value]) => <Toggle key={key} label={({showSymbols:'Sign symbols',showDegrees:'Degrees',showBoundaries:'Boundaries',showCusps:'Cusp lines',showNumbers:ring.kind === 'decans' ? 'Decan numbers' : 'House numbers',showSign:'Sign symbols',showSignGlyph:'Sign symbols',showMinutes:'Minutes'} as Record<string,string>)[key]} value={value as boolean} onChange={value => option(key,value)} />)}
        <Choices label="Ring thickness" value={ring.thickness.kind} options={[["auto","Automatic"],["fixed","Fixed"]]} onChange={kind => change(item => ({ ...item, thickness: kind === 'auto' ? { kind } : { kind, value: 24 } }))} />
        {ring.thickness.kind === 'fixed' && <NumberRow label="Thickness" value={ring.thickness.value} min={5} max={150} step={1} suffix="" onChange={value => change(item => ({ ...item, thickness: { kind: 'fixed', value } }))} />}
        {'glyphSize' in ring.style && <NumberRow label="Symbol size" value={ring.style.glyphSize} min={4} max={40} step={1} suffix="" onChange={value => style('glyphSize',value)} />}
        {ring.kind === 'fixedStars' && (['glyphColor','textColor','boundaryLineColor','backgroundColor'] as const).map(key => {
          const value = ring.style[key];
          const colorName = value?.source === 'semantic' ? value.value : value ? 'custom' : 'default';
          return <Choices key={key} label={({glyphColor:'Symbol color',textColor:'Annotation color',boundaryLineColor:'Boundary color',backgroundColor:'Background'})[key]} value={colorName} options={[["default","Default"],["primary","Primary"],["accent","Accent"],["secondary","Secondary"]]} onChange={name => style(key,name === 'default' ? undefined : {source:'semantic',value:name,layer:key === 'backgroundColor' ? 'bg' : key === 'boundaryLineColor' ? 'bd' : key === 'textColor' ? 'tx' : 'ic'} satisfies ColorValue)} />;
        })}
        {'rotateGlyphs' in ring.style && <Toggle label="Rotate symbols" value={ring.style.rotateGlyphs} onChange={value => style('rotateGlyphs',value)} />}
        {['textSize','textOffset','numberFontSize','degreeTextFontSize','degreesFontSize','minutesFontSize','boundaryLineWidth','outerBoundaryWidth','innerBoundaryWidth','innerBoundaryLineWidth','outerBoundaryLineWidth','radialLineWidth','segmentBorderWidth'].filter(key => key in ring.style).map(key => <NumberRow key={key} label={({textSize:'Annotation size',textOffset:'Annotation offset',numberFontSize:ring.kind === 'decans' ? 'Decan number size' : 'House number size',degreeTextFontSize:'Annotation size',degreesFontSize:'Degree size',minutesFontSize:'Minute size',boundaryLineWidth:'Divider thickness',outerBoundaryWidth:'Outer boundary',innerBoundaryWidth:'Inner boundary',innerBoundaryLineWidth:'Inner boundary',outerBoundaryLineWidth:'Outer boundary',radialLineWidth:'Divider thickness',segmentBorderWidth:'Segment borders'} as Record<string,string>)[key]} value={(ring.style as unknown as Record<string,number>)[key]} min={(key.includes('FontSize') || key === 'textSize') ? 4 : 0} max={(key.includes('FontSize') || key === 'textSize') ? 24 : 4} step={(key.includes('FontSize') || key === 'textSize') ? 1 : .25} suffix="" onChange={value => style(key,value)} />)}
        <Action label="Move outward" onPress={() => onChange(moveRing(preset,count,ring.id,-1))} />
        <Action label="Move inward" onPress={() => onChange(moveRing(preset,count,ring.id,1))} />
        {ring.kind !== 'planets' && <Action label="Remove ring" onPress={() => { onChange({ ...preset, layouts: { ...preset.layouts, [count]: { ...preset.layouts[count], rings: rings.filter(item => item.id !== ring.id) } } }); setSelected(null); }} />}
      </Section>
    </> : <>
      <Section title="Rings">{rings.map(ring => <View key={ring.id}><LinkRow label={`${RING_TITLES[ring.kind]}${'sourceSlot' in ring ? ` · Chart ${ring.sourceSlot}` : ''}`} detail={ring.enabled ? 'Shown' : 'Hidden'} onPress={() => setSelected({ id: ring.id, kind: ring.kind, sourceSlot: 'sourceSlot' in ring ? ring.sourceSlot : undefined })} /></View>)}</Section>
      <Section title="Add a ring">{RING_KINDS.filter(kind => kind !== 'planets' && !rings.some(ring => ring.kind === kind)).map(kind => <Action key={kind} label={`Add ${RING_TITLES[kind].toLowerCase()}`} onPress={() => add(kind)} />)}</Section>
    </>}
  </>;
}
