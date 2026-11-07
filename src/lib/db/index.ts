import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

// One pool per server instance. Kept on globalThis so dev hot reloads reuse it.
const globalForDb = globalThis as unknown as { pastekarPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.pastekarPool) {
    // Neon's pooled endpoint does the real pooling, so keep this small.
    globalForDb.pastekarPool = new Pool({
      connectionString: env.databaseUrl,
      max: 5,
    });
  }
  return globalForDb.pastekarPool;
}

let cached: ReturnType<typeof create> | undefined;

function create() {
  return drizzle(getPool(), { schema });
}

export function getDb() {
  return (cached ??= create());
}

export type Db = ReturnType<typeof getDb>;
export { schema };
