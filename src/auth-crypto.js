import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/** Hash passwords with a fresh 128-bit salt. Never log passwords or results. */
export async function hashPassword(password) {
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 1024) throw new Error('Invalid password length');
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

/** Invalid records use the same scrypt cost as normal verification. */
export async function verifyPassword(password, record) {
  const fields = typeof record === 'string' ? record.split('$') : [];
  const valid = fields.length === 6 && fields[0] === 'scrypt' && fields[1] === '16384' && fields[2] === '8' && fields[3] === '1' && /^[A-Za-z0-9_-]{22}$/.test(fields[4]) && /^[A-Za-z0-9_-]{43}$/.test(fields[5]);
  const parts = (valid ? record : DUMMY).split('$');
  const salt = Buffer.from(parts[4], 'base64url');
  const expected = Buffer.from(parts[5], 'base64url');
  const input = typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 1024 ? password : '';
  const actual = await scrypt(input, salt, 32, { N: 16384, r: 8, p: 1 });
  return valid && typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 1024 && timingSafeEqual(actual, expected);
}

/** Store only tokenHash, never the bearer token itself. */
export function createSessionToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashSessionToken(token) };
}

export function hashSessionToken(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return createHash('sha256').update(token, 'ascii').digest('hex');
}
