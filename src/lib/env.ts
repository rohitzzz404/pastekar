// Environment access. Values are read lazily so `next build` works without secrets.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return n;
}

export const env = {
  get appUrl() {
    return required("APP_URL").replace(/\/+$/, "");
  },
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get teamPasscodeHash() {
    return required("TEAM_PASSCODE_HASH");
  },
  get sessionSecret() {
    const secret = required("SESSION_SECRET");
    if (secret.length < 32) {
      throw new Error("SESSION_SECRET must be at least 32 characters");
    }
    return secret;
  },
  get maxTextBytes() {
    return intFromEnv("MAX_TEXT_BYTES", 1_048_576);
  },
};
