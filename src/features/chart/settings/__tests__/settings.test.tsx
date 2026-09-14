import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS, parseSettings, SETTINGS_KEY } from '../chartSettings';
import { useChartSettings } from '../useChartSettings';
import { chartRequest } from '../../data/calculateChart';
import { searchAtlas } from '../atlas';
import { searchLocations } from '../../../../../modules/kairos';

jest.mock('../../../../../modules/kairos', () => ({ searchLocations: jest.fn() }));
const london = { name: 'London, GB', latitude: 51.5085, longitude: -0.1257, elevation: 25, timezone: 'Europe/London' };
const changed = { location: london, houseSystem: 'Whole Sign' as const };
let latest: ReturnType<typeof useChartSettings>;
function Probe() { latest = useChartSettings(); return null; }
let view: ReactTestRenderer;
afterEach(() => { if (view) act(() => view.unmount()); jest.restoreAllMocks(); });
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

test('persists location and houses, hydrates them on remount, and sends them to Rust', async () => {
  await act(async () => { view = create(<Probe />); });
  await act(async () => { latest.update(changed); });
  act(() => view.unmount());
  await act(async () => { view = create(<Probe />); });
  expect(latest.loaded).toBe(true);
  expect(latest.settings).toEqual(changed);
  expect(chartRequest('2026-09-13T19:00:00Z', latest.settings)).toMatchObject({
    latitude: london.latitude, longitude: london.longitude, elevation: 25, house_system: 'Whole Sign',
  });
});

test('corrupt storage falls back per field, including invalid coordinates and timezones', () => {
  expect(parseSettings('{broken')).toEqual(DEFAULT_SETTINGS);
  expect(parseSettings(JSON.stringify({ ...changed, location: { ...london, timezone: 'not/a-zone' } })))
    .toEqual({ ...changed, location: DEFAULT_SETTINGS.location });
  expect(parseSettings(JSON.stringify({ ...changed, location: { ...london, latitude: 200 }, houseSystem: 'invalid' })))
    .toEqual(DEFAULT_SETTINGS);
});

test('failed persistence is visible and another selection retries it', async () => {
  await act(async () => { view = create(<Probe />); });
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
  await act(async () => { latest.update(changed); });
  expect(latest.saveError).toBe(true);
  expect(latest.settings).toEqual(changed);
  await act(async () => { latest.update(changed); });
  expect(latest.saveError).toBe(false);
  expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY))!)).toEqual(changed);
});

test('rapid changes write in order', async () => {
  await act(async () => { view = create(<Probe />); });
  let finish!: () => void;
  const write = jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { latest.update(changed); latest.update(DEFAULT_SETTINGS); });
  expect(write).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); });
  expect(write).toHaveBeenLastCalledWith(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
});

test('atlas retains disambiguation, coordinates, elevation and timezone', async () => {
  jest.mocked(searchLocations).mockResolvedValue(JSON.stringify([
    { name: 'London', country: 'GB', region: 'England', coordinates: { latitude: london.latitude, longitude: london.longitude, elevation: 25 }, timezone: london.timezone },
  ]));
  expect(await searchAtlas(' London ')).toEqual([{ ...london, name: 'London, England, GB' }]);
  expect(searchLocations).toHaveBeenLastCalledWith('London');
});
