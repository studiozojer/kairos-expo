import { localFields, resolveWallTime } from '../wallTime';

describe('chart local-time input', () => {
  test('resolves a local natal time independently of the device timezone', () => {
    expect(resolveWallTime('1990-07-05', '14:30', 'America/Los_Angeles')).toEqual([Date.parse('1990-07-05T21:30:00Z')]);
    expect(localFields(Date.parse('1990-07-05T21:30:12Z'), 'America/Los_Angeles')).toEqual({ date: '1990-07-05', clock: '14:30:12' });
  });
  test('rejects spring gaps rather than silently changing the time', () => {
    expect(() => resolveWallTime('2026-03-08', '02:30', 'America/Los_Angeles')).toThrow('does not exist');
  });
  test('returns both fall-fold occurrences in chronological order', () => {
    expect(resolveWallTime('2026-11-01', '01:30', 'America/Los_Angeles')).toEqual([
      Date.parse('2026-11-01T08:30:00Z'), Date.parse('2026-11-01T09:30:00Z'),
    ]);
  });
  test('handles non-hour transitions and quarter-hour timezone offsets', () => {
    expect(resolveWallTime('2026-04-05', '01:45', 'Australia/Lord_Howe')).toHaveLength(2);
    expect(resolveWallTime('2026-01-01', '12:00', 'Asia/Kathmandu')).toEqual([Date.parse('2026-01-01T06:15:00Z')]);
  });
  test.each([['2026-02-29', '12:00'], ['2026-04-31', '12:00'], ['2026-01-01', '24:00'], ['1899-12-31', '12:00']])('rejects invalid date/time %s %s', (date, time) => {
    expect(() => resolveWallTime(date, time, 'UTC')).toThrow('valid');
  });
  test('rejects invalid timezone and UTC instants outside the engine range', () => {
    expect(() => resolveWallTime('2026-01-01', '12:00', 'Fake/Zone')).toThrow('timezone');
    expect(() => resolveWallTime('1900-01-01', '00:00', 'Asia/Tokyo')).toThrow('UTC time');
  });
});
