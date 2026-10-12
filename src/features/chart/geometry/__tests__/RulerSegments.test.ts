import { rulerSegments, rulerGlyphSize, signRuler } from '../RulerSegments';
test.each([['signRulers','traditional',12],['signRulers','modern',12],['decans','chaldean',36],['decans','triplicity',36],['decans','modern',36],['terms','egyptian',60],['terms','ptolemaic',60],['terms','chaldean',60]] as const)('%s / %s covers the full circle without gaps', (kind,system,count) => {
  const segments = rulerSegments(kind,system);
  expect(segments).toHaveLength(count); expect(segments[0].start).toBe(0); expect(segments.at(-1)!.end).toBe(360);
  segments.forEach((segment,index) => { expect(segment.end).toBeGreaterThan(segment.start); if(index) expect(segment.start).toBe(segments[index-1].end); });
});
test('rulers and term boundaries match independent reference examples', () => {
  expect(signRuler(7,'traditional')).toBe('mars'); expect(signRuler(7,'modern')).toBe('pluto');
  expect(rulerSegments('decans','chaldean').slice(0,3).map(s=>s.ruler)).toEqual(['mars','sun','venus']);
  expect(rulerSegments('decans','triplicity').slice(0,3).map(s=>s.ruler)).toEqual(['mars','sun','jupiter']);
  expect(rulerSegments('terms','egyptian').slice(0,5).map(s=>[s.end,s.ruler])).toEqual([[6,'jupiter'],[12,'venus'],[20,'mercury'],[25,'mars'],[30,'saturn']]);
});
test('smallest segment bounds one uniform size', () => {
  const segments = rulerSegments('terms','egyptian');
  expect(rulerGlyphSize(segments,100,20,16)).toBeLessThan(16);
  expect(rulerGlyphSize(segments,100,4,16)).toBeLessThanOrEqual(3.2);
});
