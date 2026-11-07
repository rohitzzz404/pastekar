import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { env } from "@/lib/env";

const scryptWithParams = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

export const SESSION_COOKIE = "pk_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Hash format: scrypt:N:r:p:salt:hash (base64url). It avoids `$` because
// Next's .env loader expands `$VAR` references.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptWithParams(secret, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join(":");
}

export async function verifySecret(
  secret: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (![N, r, p].every(Number.isSafeInteger)) return false;
  const salt = Buffer.from(saltRaw, "base64url");
  const expected = Buffer.from(hashRaw, "base64url");
  if (expected.length === 0) return false;
  const actual = await scryptWithParams(secret, salt, expected.length, {
    N,
    r,
    p,
  });
  return timingSafeEqual(actual, expected);
}

function sign(payload: string): string {
  return createHmac("sha256", env.sessionSecret)
    .update(payload)
    .digest("base64url");
}

/** Session token: `{expiresAtMs}.{signature}`. */
export function createSessionToken(now = Date.now()): string {
  const expires = String(now + SESSION_MAX_AGE_SECONDS * 1000);
  return `${expires}.${sign(`session:${expires}`)}`;
}

export function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expires = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^\d+$/.test(expires) || Number(expires) <= now) return false;
  const expected = Buffer.from(sign(`session:${expires}`));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.appUrl.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

// Unlock cookies: bound to the paste ID and a fingerprint of its password hash,
// valid for 1 hour. Changing the password changes the fingerprint, which
// invalidates every existing unlock cookie. See docs/security.md#paste-privacy.
export const UNLOCK_MAX_AGE_SECONDS = 60 * 60;

type Lockable = { id: string; passwordHash: string | null };

export function unlockCookieName(pasteId: string): string {
  return `pk_unlock_${pasteId}`;
}

function unlockPayload(paste: { id: string; passwordHash: string }, expires: string) {
  const fingerprint = createHash("sha256")
    .update(paste.passwordHash)
    .digest("base64url")
    .slice(0, 22);
  return `unlock:${paste.id}:${fingerprint}:${expires}`;
}

export function createUnlockToken(
  paste: { id: string; passwordHash: string },
  now = Date.now(),
): string {
  const expires = String(now + UNLOCK_MAX_AGE_SECONDS * 1000);
  return `${expires}.${sign(unlockPayload(paste, expires))}`;
}

function verifyUnlockToken(
  paste: { id: string; passwordHash: string },
  token: string | undefined,
  now: number,
): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expires = token.slice(0, dot);
  if (!/^\d+$/.test(expires) || Number(expires) <= now) return false;
  const expected = Buffer.from(sign(unlockPayload(paste, expires)));
  const given = Buffer.from(token.slice(dot + 1));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** True when the paste has no password, or the cookie proves it was unlocked. */
export function hasPasteAccess(
  paste: Lockable,
  cookieValue: string | undefined,
  now = Date.now(),
): boolean {
  if (!paste.passwordHash) return true;
  return verifyUnlockToken(
    { id: paste.id, passwordHash: paste.passwordHash },
    cookieValue,
    now,
  );
}

export function unlockCookieOptions() {
  return { ...sessionCookieOptions(), maxAge: UNLOCK_MAX_AGE_SECONDS };
}
