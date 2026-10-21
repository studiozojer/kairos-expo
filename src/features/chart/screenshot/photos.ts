import { Album, Asset, getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library';

export const CHART_ALBUM = 'Kairōs';
export class PhotoPermissionError extends Error {
  constructor() { super('Allow full photo access in Settings to save chart images in your Kairōs album.'); }
}
export class AlbumSaveError extends Error {
  constructor() { super('The image was saved to Photos, but could not be added to the Kairōs album.'); }
}

export async function ensurePhotoPermission() {
  let permission = await getPermissionsAsync(false, ['photo']);
  if (!permission.granted && permission.canAskAgain) permission = await requestPermissionsAsync(false, ['photo']);
  // SDK 57's album lookup/creation requires full access. Reject limited access
  // before creating an asset rather than leaving an avoidable partial save.
  if (!permission.granted || permission.accessPrivileges === 'limited') throw new PhotoPermissionError();
}

/** Create exactly one asset. The SDK 57 Album.add moves Android assets rather
 * than copying them; Album.create explicitly uses the same move behavior. */
export async function saveChartToPhotos(uri: string) {
  const asset = await Asset.create(uri);
  try {
    const album = await Album.get(CHART_ALBUM);
    if (album) await album.add(asset);
    else await Album.create(CHART_ALBUM, [asset], true);
  } catch {
    // A library asset already exists. Never retry creation or delete it here.
    throw new AlbumSaveError();
  }
}
