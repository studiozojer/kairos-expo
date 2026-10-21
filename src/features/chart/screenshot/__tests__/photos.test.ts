import { Album, Asset, getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library';
import { ensurePhotoPermission, saveChartToPhotos, AlbumSaveError, PhotoPermissionError } from '../photos';
jest.mock('expo-media-library', () => ({ Album: { get: jest.fn(), create: jest.fn() }, Asset: { create: jest.fn() }, getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn() }));
const asset = { id: 'created-once' } as Asset;
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(Asset.create).mockResolvedValue(asset);
});
test('requests only photo access, only when needed', async () => {
  await ensurePhotoPermission(); expect(requestPermissionsAsync).not.toHaveBeenCalled();
  jest.mocked(getPermissionsAsync).mockResolvedValue({ granted: false, canAskAgain: true } as never);
  jest.mocked(requestPermissionsAsync).mockResolvedValue({ granted: true, accessPrivileges: 'all' } as never);
  await ensurePhotoPermission();
  expect(requestPermissionsAsync).toHaveBeenCalledWith(false, ['photo']);
});
test('limited access fails before writing an asset because SDK 57 albums need full access', async () => {
  jest.mocked(getPermissionsAsync).mockResolvedValue({ granted: true, accessPrivileges: 'limited' } as never);
  await expect(ensurePhotoPermission()).rejects.toBeInstanceOf(PhotoPermissionError);
  expect(Asset.create).not.toHaveBeenCalled();
});
test('denied permission does not reprompt or create assets', async () => {
  jest.mocked(getPermissionsAsync).mockResolvedValue({ granted: false, canAskAgain: false } as never);
  await expect(ensurePhotoPermission()).rejects.toBeInstanceOf(PhotoPermissionError);
  expect(requestPermissionsAsync).not.toHaveBeenCalled(); expect(Asset.create).not.toHaveBeenCalled();
});
test('creates the named album with one asset and move semantics', async () => {
  jest.mocked(Album.get).mockResolvedValue(null);
  await saveChartToPhotos('file:///chart.png');
  expect(Asset.create).toHaveBeenCalledTimes(1);
  expect(Album.create).toHaveBeenCalledWith('Kairōs', [asset], true);
});
test('reuses an existing album without a duplicate asset', async () => {
  const add = jest.fn(); jest.mocked(Album.get).mockResolvedValue({ add } as unknown as Album);
  await saveChartToPhotos('file:///chart.png');
  expect(add).toHaveBeenCalledWith(asset); expect(Album.create).not.toHaveBeenCalled();
  expect(Asset.create).toHaveBeenCalledTimes(1);
});
test('album failure reports the partial save and never retries asset creation', async () => {
  jest.mocked(Album.get).mockRejectedValue(new Error('Album inaccessible'));
  await expect(saveChartToPhotos('file:///chart.png')).rejects.toBeInstanceOf(AlbumSaveError);
  expect(Asset.create).toHaveBeenCalledTimes(1);
});
test('asset failure remains a complete save failure', async () => {
  jest.mocked(Asset.create).mockRejectedValue(new Error('Disk full'));
  await expect(saveChartToPhotos('file:///chart.png')).rejects.toThrow('Disk full');
  expect(Album.get).not.toHaveBeenCalled();
});
