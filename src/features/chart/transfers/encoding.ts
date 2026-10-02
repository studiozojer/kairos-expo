import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import type { ArchiveRecord, ArchiveSnapshot } from './types';

export function snapshotBytes(base64: string): Uint8Array<ArrayBuffer> {
  if (typeof base64 !== 'string' || base64.length > 699052 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new Error('Invalid archive snapshot encoding');
  const binary = atob(base64);
  if (!binary.length || binary.length > 512 * 1024 || btoa(binary) !== base64) throw new Error('Invalid archive snapshot size');
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
export function decodeSnapshot(base64: string): unknown {
  const bytes = snapshotBytes(base64);
  // Strict UTF-8 decoding without a platform-specific Buffer dependency.
  const text = decodeURIComponent(Array.from(bytes, b => `%${b.toString(16).padStart(2, '0')}`).join(''));
  return JSON.parse(text) as unknown;
}
export async function verifySnapshot(value: unknown, record: ArchiveRecord): Promise<ArchiveSnapshot> {
  const snapshot = value as ArchiveSnapshot;
  if (!snapshot || snapshot.snapshotId !== record.snapshotId || snapshot.payloadDigest !== record.payloadDigest || snapshot.payloadEncoding !== record.payloadEncoding) throw new Error('Mismatched archive snapshot identity');
  const bytes = snapshotBytes(snapshot.payloadBytesBase64);
  const hash = await digest(CryptoDigestAlgorithm.SHA256, bytes);
  const hex = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  if (hex !== record.payloadDigest) throw new Error('Archive snapshot integrity check failed');
  // Unknown future encodings remain opaque and cannot be opened.
  if (snapshot.payloadEncoding === 'kairos-swift-json-v1') decodeSnapshot(snapshot.payloadBytesBase64);
  return snapshot;
}
