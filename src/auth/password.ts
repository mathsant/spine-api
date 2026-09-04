import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// scrypt parameters (OWASP-recommended baseline). memory ≈ 128 * N * r ≈ 32 MiB,
// so maxmem is set well above that.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;
const MAXMEM = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return scrypt(password, salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM });
}

/** Hash a password with scrypt. Format: `scrypt$N$r$p$saltB64$hashB64`. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(plain, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/**
 * Verify a password against a stored hash. Returns `false` (never throws) for a
 * malformed stored value, and still runs the KDF in that case so the timing does
 * not reveal whether the stored hash was well-formed.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    await derive(plain, randomBytes(SALT_BYTES), N, R, P);
    return false;
  }

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    await derive(plain, randomBytes(SALT_BYTES), N, R, P);
    return false;
  }

  const salt = Buffer.from(saltRaw, 'base64');
  const expected = Buffer.from(hashRaw, 'base64');
  const actual = await derive(plain, salt, n, r, p);

  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
