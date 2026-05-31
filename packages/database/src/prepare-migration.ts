/**
 * Generates (or refreshes) the initial SQLite migration SQL from the current
 * Prisma schema and post-processes it so it is compatible with both embedded
 * SQLite and remote Turso databases:
 *
 *  - `JSONB` → `TEXT`  (Turso rejects JSONB via its HTTP API)
 *  - Unquoted JSON default values → single-quoted string literals
 *  - `CREATE TABLE/INDEX` → `CREATE TABLE/INDEX IF NOT EXISTS`  (idempotent re-runs)
 *
 * Uses `prisma migrate diff --from-empty` with a temp `file:` URL so the
 * command succeeds regardless of whether DATABASE_URL is a `libsql://` or
 * `file:` URL (the Prisma migration engine rejects non-file: URLs).
 *
 * Usage:
 *   pnpm --filter @shelf/database db:prepare-migration
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../prisma/migrations");
const MIGRATION_NAME = "0001_initial_sqlite";
const SQL_FILE = path.join(MIGRATIONS_DIR, MIGRATION_NAME, "migration.sql");

/** Replace bare JSON default values with properly single-quoted string literals. */
function quoteJsonDefaults(text: string): string {
  const result: string[] = [];
  let i = 0;
  const pattern = /DEFAULT (?=[{[])/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    result.push(text.slice(i, match.index + "DEFAULT ".length));
    let j = match.index + "DEFAULT ".length;
    let depth = 0;
    let inStr = false;
    const start = j;

    while (j < text.length) {
      const c = text[j];
      if (inStr) {
        if (c === "\\") {
          j++; // skip escaped char
        } else if (c === '"') {
          inStr = false;
        }
      } else {
        if (c === '"') {
          inStr = true;
        } else if (c === "{" || c === "[") {
          depth++;
        } else if (c === "}" || c === "]") {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        }
      }
      j++;
    }

    result.push(`'${text.slice(start, j)}'`);
    i = j;
    pattern.lastIndex = j;
  }

  result.push(text.slice(i));
  return result.join("");
}

function fixMigrationSql(raw: string): string {
  let sql = raw;

  // JSONB is not reliably supported via Turso's hrana HTTP transport
  sql = sql.replaceAll("JSONB", "TEXT");

  // Make CREATE statements idempotent (safe to re-run on existing databases)
  sql = sql.replace(/^CREATE TABLE /gm, "CREATE TABLE IF NOT EXISTS ");
  sql = sql.replace(
    /^CREATE UNIQUE INDEX /gm,
    "CREATE UNIQUE INDEX IF NOT EXISTS "
  );
  sql = sql.replace(/^CREATE INDEX /gm, "CREATE INDEX IF NOT EXISTS ");

  // Quote bare JSON default values so SQLite parses them as string literals
  sql = quoteJsonDefaults(sql);

  return sql;
}

function main() {
  console.log("Generating migration SQL from schema …");

  const raw = execSync(
    `DATABASE_URL="file:/tmp/shelf-migration-gen.db" npx prisma migrate diff \
      --from-empty \
      --to-schema-datamodel prisma/schema.prisma \
      --script`,
    { cwd: path.resolve(__dirname, ".."), encoding: "utf-8" }
  )
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("◇") &&
        !line.startsWith("Loaded") &&
        !line.startsWith("Prisma")
    )
    .join("\n");

  const fixed = fixMigrationSql(raw);
  writeFileSync(SQL_FILE, fixed, "utf-8");

  console.log(`Written: ${SQL_FILE}`);
  console.log(`  JSONB remaining  : ${(fixed.match(/JSONB/g) ?? []).length}`);
  console.log(
    `  Bare DEFAULT {   : ${(fixed.match(/DEFAULT \{/g) ?? []).length}`
  );
  console.log(
    `  IF NOT EXISTS    : ${(fixed.match(/IF NOT EXISTS/g) ?? []).length}`
  );
}

main();
