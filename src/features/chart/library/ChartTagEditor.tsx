import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme';
import { newChartId, type ChartDraft } from '../active/model';
import { Action, Note } from '../display/controls';

type Tag = NonNullable<ChartDraft['metadata']>['tags'][number];

/** Suggestions are supplied by the library for the destination chart's owner. */
export function ChartTagEditor({ tags, suggestions, onChange }: { tags: Tag[]; suggestions: Tag[]; onChange: (tags: Tag[]) => void }) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const name = query.trim();
  const key = name.toLowerCase();
  const matches = suggestions.filter(tag => !tags.some(selected => selected.id === tag.id || selected.name.toLowerCase() === tag.name.toLowerCase()) && tag.name.toLowerCase().includes(key));
  const add = (tag: Tag) => {
    if (tags.length >= 32) { setError('A chart can have up to 32 tags.'); return; }
    if (tags.some(selected => selected.id === tag.id || selected.name.toLowerCase() === tag.name.toLowerCase())) { setError('This tag is already on the chart.'); return; }
    onChange([...tags, { ...tag }]); setQuery(''); setError('');
  };
  const create = () => {
    if (!name || Array.from(name).length > 60) { setError('Use a tag name between 1 and 60 characters.'); return; }
    add(suggestions.find(tag => tag.name.toLowerCase() === key) ?? { id: newChartId(), name });
  };
  const chip = (tag: Tag, selected: boolean) => <Pressable key={tag.id} accessibilityRole="button" accessibilityLabel={`${selected ? 'Remove' : 'Add'} tag ${tag.name}`} onPress={() => selected ? onChange(tags.filter(item => item.id !== tag.id)) : add(tag)}
    style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: t.radius.md, backgroundColor: t.color.bgSolidCardSecondary }}>
    <Text style={[t.type.whyteSm, { color: t.color.txPrimary }]}>{tag.name}{selected ? ' ×' : ' +'}</Text>
  </Pressable>;
  return <View style={{ gap: 8 }}>
    {!!tags.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{tags.map(tag => chip(tag, true))}</View>}
    <TextInput accessibilityLabel="Tag name" placeholder="Find or create a tag" placeholderTextColor={t.color.txSecondary} value={query} onChangeText={value => { setQuery(value); setError(''); }} onSubmitEditing={create} returnKeyType="done" autoCorrect={false}
      style={[t.type.whyteSm, { minHeight: 48, padding: 12, borderRadius: t.radius.md, backgroundColor: t.color.bgSolidCardSecondary, color: t.color.txPrimary }]} />
    {!!matches.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{matches.slice(0, 12).map(tag => chip(tag, false))}</View>}
    {!!name && <Action label={suggestions.some(tag => tag.name.toLowerCase() === key) ? `Add “${name}”` : `Create “${name}”`} onPress={create} />}
    {!!error && <Text accessibilityRole="alert" style={[t.type.whyteSm, { color: t.color.txAccent }]}>{error}</Text>}
    <Note>Tags organize your library. Removing one here only changes this chart.</Note>
  </View>;
}
