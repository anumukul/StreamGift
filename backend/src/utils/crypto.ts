import { createHash } from 'crypto';

export function hashSocialHandle(socialType: string, handle: string): string {
  const normalized = `${socialType}:${handle.toLowerCase().trim()}`;
  return createHash('sha256').update(normalized).digest('hex');
}

export function hashToBytes(hash: string): Uint8Array {
  return Buffer.from(hash, 'hex');
}