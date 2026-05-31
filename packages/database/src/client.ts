import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { Prisma, PrismaClient } from "@prisma/client";

export type ExtendedPrismaClient = ReturnType<typeof createDatabaseClient>;

/**
 * Creates a new PrismaClient instance backed by libSQL (Turso or embedded SQLite).
 *
 * In @prisma/adapter-libsql v6.19+, PrismaLibSQL is an adapter *factory* that
 * takes a libsql config object { url, authToken } and creates its own internal
 * @libsql/client when connect() is first called. Do NOT pass a pre-created
 * @libsql/client instance here — that was the old API (pre-6.x).
 *
 * Supports both embedded file databases (`file:/path/to/db.sqlite`) and
 * remote Turso databases (`libsql://your-db.turso.io`) selected via
 * `DATABASE_URL`. An optional `DATABASE_AUTH_TOKEN` is required for remote
 * Turso connections; leave it empty for local file databases.
 */
export function createDatabaseClient(url?: string) {
  const dbUrl = url ?? process.env.DATABASE_URL!;
  const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

  const adapter = new PrismaLibSQL({ url: dbUrl, authToken });

  const client = new PrismaClient({ adapter }).$extends({
    model: {
      $allModels: {
        dynamicFindMany<T>(this: T, options: Prisma.Args<T, "findMany">) {
          const ctx = Prisma.getExtensionContext(this) as any;
          return ctx.findMany(options);
        },
      },
    },
  });

  return client;
}
