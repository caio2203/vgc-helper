import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Stored as `scrypt:N:r:p:salt:hash` (base64url). No `$`, so shells and .env files leave it alone.
const PREFIX = 'scrypt';
const DEFAULTS = { N: 2 ** 15, r: 8, p: 1, keyLength: 32, saltLength: 16 } as const;

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

function derive(
  password: string,
  salt: Buffer,
  N: number,
  r: number,
  p: number,
  keyLength: number,
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, { N, r, p, maxmem: 256 * N * r }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const { N, r, p, keyLength, saltLength } = DEFAULTS;
  const salt = randomBytes(saltLength);
  const hash = await derive(password, salt, N, r, p, keyLength);
  return [PREFIX, N, r, p, salt.toString('base64url'), hash.toString('base64url')].join(':');
}

export function parsePasswordHash(stored: string): ParsedHash | null {
  const parts = stored.trim().split(':');
  if (parts.length !== 6 || parts[0] !== PREFIX) return null;
  const [, n, r, p, salt, hash] = parts as [string, string, string, string, string, string];
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);
  if (![N, R, P].every((v) => Number.isInteger(v) && v > 0)) return null;
  const saltBuf = Buffer.from(salt, 'base64url');
  const hashBuf = Buffer.from(hash, 'base64url');
  if (saltBuf.length < 16 || hashBuf.length < 16) return null;
  return { N, r: R, p: P, salt: saltBuf, hash: hashBuf };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parsePasswordHash(stored);
  if (!parsed) return false;
  const candidate = await derive(
    password,
    parsed.salt,
    parsed.N,
    parsed.r,
    parsed.p,
    parsed.hash.length,
  );
  return timingSafeEqual(candidate, parsed.hash);
}
