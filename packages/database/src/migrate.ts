/**
 * Custom migration runner for libSQL / Turso.
 *
 * `prisma migrate deploy` only accepts `file:` URLs (Prisma's native SQLite
 * driver). When DATABASE_URL is a `libsql://` Turso URL the command exits
 * with P1012. This script replaces it: it reads migration SQL files from
 * `prisma/migrations/` and applies them in order via `@libsql/client`, which
 * works with both embedded `file:` databases and remote Turso instances.
 *
 * A `_prisma_migrations` table (Prisma-compatible schema) is maintained so
 * that switching back to `prisma migrate deploy` for local `file:` dev later
 * is still possible without re-applying migrations.
 *
 * Usage (via package script):
 *   pnpm --filter @shelf/database db:migrate
 */

import { createClient } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the monorepo root (two levels above packages/database/)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

/** DDL for the Prisma-compatible migration tracking table. */
const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id                  TEXT      PRIMARY KEY NOT NULL,
    checksum            TEXT      NOT NULL DEFAULT '',
    finished_at         DATETIME,
    migration_name      TEXT      NOT NULL,
    logs                TEXT,
    rolled_back_at      DATETIME,
    started_at          DATETIME  NOT NULL DEFAULT (datetime('now')),
    applied_steps_count INTEGER   NOT NULL DEFAULT 0
  )
`;

/**
 * Split a multi-statement SQL string into individual statements.
 *
 * Handles single-quoted string literals and `--` line comments so that
 * semicolons inside strings/comments are not treated as statement delimiters.
 * This is sufficient for Prisma-generated SQLite migration scripts.
 */
function splitStatements(sql: string): string[] {
  const results: string[] = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    if (inString) {
      current += ch;
      if (ch === stringChar) {
        // Doubled quote = escaped quote inside the string
        if (sql[i + 1] === stringChar) {
          current += sql[++i];
        } else {
          inString = false;
        }
      }
    } else if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      current += ch;
    } else if (ch === "-" && sql[i + 1] === "-") {
      // Line comment — skip to end of line (include the newline for formatting)
      const newline = sql.indexOf("\n", i);
      if (newline === -1) break;
      i = newline;
      current += "\n";
    } else if (ch === ";") {
      const stmt = current.trim();
      if (stmt) results.push(stmt);
      current = "";
    } else {
      current += ch;
    }

    i++;
  }

  const tail = current.trim();
  if (tail) results.push(tail);

  return results;
}

/** Apply one migration file by executing its statements individually. */
async function applyMigration(
  client: ReturnType<typeof createClient>,
  name: string,
  sql: string
): Promise<void> {
  const statements = splitStatements(sql);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await client.execute(stmt);
    } catch (err) {
      console.error(`\nFailed at statement #${i + 1}:`);
      console.error(stmt.slice(0, 200));
      throw err;
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;
  const client = createClient({ url, authToken });

  // Ensure the migration tracking table exists.
  await client.execute(CREATE_MIGRATIONS_TABLE);

  // Fetch already-applied migration names.
  const result = await client.execute(
    "SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL ORDER BY started_at"
  );
  const applied = new Set(result.rows.map((r) => r.migration_name as string));

  // Discover migration directories, sorted lexicographically (chronological).
  const migrationsDir = path.resolve(__dirname, "../prisma/migrations");
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  let count = 0;

  for (const dir of dirs) {
    if (applied.has(dir)) {
      continue;
    }

    const sqlPath = path.join(migrationsDir, dir, "migration.sql");
    const sql = await readFile(sqlPath, "utf-8");

    console.log(`Applying migration: ${dir} …`);
    const startedAt = new Date().toISOString();

    await applyMigration(client, dir, sql);

    // Record the migration so it won't be re-applied.
    const id = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO _prisma_migrations
              (id, checksum, finished_at, migration_name, applied_steps_count, started_at)
            VALUES (?, '', ?, ?, 1, ?)`,
      args: [id, new Date().toISOString(), dir, startedAt],
    });

    console.log(`  ✔ ${dir}`);
    count++;
  }

  if (count === 0) {
    console.log("Database is up to date — no pending migrations.");
  } else {
    console.log(`\nApplied ${count} migration(s) successfully.`);
  }

  client.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
