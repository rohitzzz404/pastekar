import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  createUnlockToken,
  hasPasteAccess,
  hashSecret,
  SESSION_MAX_AGE_SECONDS,
  verifySecret,
  verifySessionToken,
} from "./auth";

describe("passcode hashing", () => {
  it("verifies the right passcode and rejects others", async () => {
    const hash = await hashSecret("correct horse battery staple");
    expect(hash).not.toContain("$");
    expect(await verifySecret("correct horse battery staple", hash)).toBe(true);
    expect(await verifySecret("wrong", hash)).toBe(false);
  });

  it("uses a fresh salt each time", async () => {
    expect(await hashSecret("same")).not.toBe(await hashSecret("same"));
  });

  it.each(["", "garbage", "scrypt:1:2:3", "scrypt:x:8:1:aa:bb", "bcrypt:1:2:3:aa:bb"])(
    "rejects malformed stored hash %j",
    async (stored) => {
      expect(await verifySecret("anything", stored)).toBe(false);
    },
  );
});

describe("session token", () => {
  const now = 1_700_000_000_000;

  it("accepts a fresh token", () => {
    expect(verifySessionToken(createSessionToken(now), now + 1000)).toBe(true);
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(now);
    expect(verifySessionToken(token, now + SESSION_MAX_AGE_SECONDS * 1000 + 1)).toBe(false);
  });

  it("rejects a tampered expiry or signature", () => {
    const [expires, sig] = createSessionToken(now).split(".");
    expect(verifySessionToken(`${Number(expires) + 99999999}.${sig}`, now)).toBe(false);
    expect(verifySessionToken(`${expires}.${sig.slice(0, -2)}xx`, now)).toBe(false);
  });

  it.each([undefined, "", "nodot", ".sig", "abc.def"])("rejects %j", (token) => {
    expect(verifySessionToken(token, now)).toBe(false);
  });
});

describe("paste unlock cookie", () => {
  const now = 1_700_000_000_000;
  const locked = { id: "11111111-1111-1111-1111-111111111111", passwordHash: "scrypt:hash-a" };

  it("always grants access to a paste with no password", () => {
    expect(hasPasteAccess({ id: locked.id, passwordHash: null }, undefined, now)).toBe(true);
  });

  it("denies a locked paste without a valid cookie", () => {
    expect(hasPasteAccess(locked, undefined, now)).toBe(false);
    expect(hasPasteAccess(locked, "garbage", now)).toBe(false);
  });

  it("accepts the cookie for the same paste for one hour", () => {
    const token = createUnlockToken(locked, now);
    expect(hasPasteAccess(locked, token, now + 1000)).toBe(true);
    expect(hasPasteAccess(locked, token, now + 60 * 60 * 1000 + 1)).toBe(false);
  });

  it("is bound to the paste ID", () => {
    const token = createUnlockToken(locked, now);
    expect(hasPasteAccess({ ...locked, id: "22222222-2222-2222-2222-222222222222" }, token, now)).toBe(false);
  });

  it("stops working when the password changes", () => {
    const token = createUnlockToken(locked, now);
    expect(hasPasteAccess({ ...locked, passwordHash: "scrypt:hash-b" }, token, now)).toBe(false);
  });

  it("can't be forged from a session token", () => {
    expect(hasPasteAccess(locked, createSessionToken(now), now)).toBe(false);
  });
});
