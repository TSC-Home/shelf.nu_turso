/* eslint-disable no-console */
import { Prisma } from "@prisma/client";
import { db } from "~/database/db.server";

/**
 * Sequential ID Service for Assets — SQLite/libSQL fork.
 *
 * The original implementation relied on PostgreSQL-specific stored functions
 * (`create_asset_sequence_for_org`, `get_next_sequential_id`) and the
 * `currval`/`setval` sequence API.  SQLite has no sequence objects.
 *
 * Replacement strategy: store the counter implicitly in the Asset table.
 * Every function that needs "the next number" runs:
 *
 *   MAX( CAST(SUBSTR(sequentialId, prefixLen+2) AS INTEGER) ) + 1
 *
 * This is race-free for SQLite because SQLite is single-writer; concurrent
 * inserts are serialized at the DB level.  When called inside a Prisma
 * transaction (as getNextSequentialId always is) the result is consistent.
 *
 * Examples: SAM-0001, SAM-0002, SAM-9999, SAM-10000
 */

const DEFAULT_PREFIX = "SAM";

/**
 * No-op: SQLite doesn't use per-org sequence objects.
 * Kept so callers don't need to change.
 */
export async function createOrganizationSequence(
  _organizationId: string
): Promise<void> {
  // SQLite: no sequence objects to create
}

/**
 * Returns the highest sequential number in use for the given org+prefix,
 * or 0 when no assets have been created yet.
 */
async function getMaxSequenceNumber(
  organizationId: string,
  prefix: string
): Promise<number> {
  // SUBSTR(sequentialId, prefixLen + 2) strips the "SAM-" part and leaves
  // the numeric suffix.  CAST to INTEGER returns NULL for non-numeric strings
  // (SQLite silently coerces), so MAX skips them.
  const prefixWithDash = prefix + "-";
  const result = await db.$queryRaw<[{ max_num: number | null }]>`
    SELECT MAX(CAST(SUBSTR("sequentialId", ${
      prefixWithDash.length + 1
    }) AS INTEGER)) AS max_num
    FROM "Asset"
    WHERE "organizationId" = ${organizationId}
      AND "sequentialId" LIKE ${prefixWithDash + "%"}
  `;
  return result[0]?.max_num ?? 0;
}

/**
 * Gets the next sequential ID for an organization.
 * Consumes the counter — only call when actually persisting an asset.
 *
 * @param organizationId - The organization ID
 * @param prefix - The prefix for the sequential ID (default: "SAM")
 * @returns Promise<string> - e.g. "SAM-0001"
 */
export async function getNextSequentialId(
  organizationId: string,
  prefix: string = DEFAULT_PREFIX
): Promise<string> {
  try {
    const max = await getMaxSequenceNumber(organizationId, prefix);
    return formatSequentialId(max + 1, prefix);
  } catch (error) {
    console.error(
      `Failed to get next sequential ID for organization ${organizationId}:`,
      error
    );
    throw new Error(`Could not generate sequential ID`);
  }
}

/**
 * Estimates the next sequential ID without consuming a counter value.
 * Safe for UI previews.
 *
 * @param organizationId - The organization ID
 * @param prefix - The prefix for the sequential ID (default: "SAM")
 * @returns Promise<string> - e.g. "SAM-0042"
 */
export async function estimateNextSequentialId(
  organizationId: string,
  prefix: string = DEFAULT_PREFIX
): Promise<string> {
  try {
    const max = await getMaxSequenceNumber(organizationId, prefix);
    return formatSequentialId(max + 1, prefix);
  } catch (error) {
    console.error(
      `Failed to estimate next sequential ID for organization ${organizationId}:`,
      error
    );
    return formatSequentialId(1, prefix);
  }
}

/**
 * Formats a sequence number into a sequential ID.
 * Uses 4-digit zero-padding that grows beyond 9999.
 *
 * @param sequenceNumber - The sequence number
 * @param prefix - The prefix (default: "SAM")
 * @returns e.g. "SAM-0001"
 */
export function formatSequentialId(
  sequenceNumber: number,
  prefix: string = DEFAULT_PREFIX
): string {
  const paddedNumber = sequenceNumber.toString().padStart(4, "0");
  return `${prefix}-${paddedNumber}`;
}

/**
 * No-op: SQLite doesn't use sequence objects to reset.
 * Kept so callers don't need to change.
 */
export async function resetOrganizationSequence(
  _organizationId: string
): Promise<void> {
  // SQLite: no sequence objects to reset
}

/**
 * Checks if an organization has any assets with sequential IDs.
 */
export async function organizationHasSequentialIds(
  organizationId: string
): Promise<boolean> {
  try {
    const count = await db.asset.count({
      where: {
        organizationId,
        sequentialId: { not: null },
      },
    });
    return count > 0;
  } catch (error) {
    console.error(
      `Failed to check sequential IDs for organization ${organizationId}:`,
      error
    );
    return false;
  }
}

/**
 * Gets count of assets without sequential IDs for an organization.
 */
export async function getAssetsWithoutSequentialIdCount(
  organizationId: string
): Promise<number> {
  try {
    return await db.asset.count({
      where: {
        organizationId,
        sequentialId: null,
      },
    });
  } catch (error) {
    console.error(
      `Failed to count assets without sequential IDs for organization ${organizationId}:`,
      error
    );
    return 0;
  }
}

/**
 * Validates that a sequential ID follows the expected format.
 *
 * @param sequentialId - e.g. "SAM-0001"
 * @returns true when format is valid
 */
export function isValidSequentialIdFormat(sequentialId: string): boolean {
  const pattern = /^[A-Z]+-\d{4,}$/;
  return pattern.test(sequentialId);
}

/**
 * Extracts the numeric part from a sequential ID.
 *
 * @param sequentialId - e.g. "SAM-0001"
 * @returns The numeric part or null if invalid
 */
export function extractSequenceNumber(sequentialId: string): number | null {
  if (!isValidSequentialIdFormat(sequentialId)) {
    return null;
  }
  const parts = sequentialId.split("-");
  if (parts.length !== 2) return null;
  const number = parseInt(parts[1], 10);
  return isNaN(number) ? null : number;
}

/**
 * Generates sequential IDs for existing assets that don't have one yet.
 * SQLite-compatible: assigns IDs in JavaScript and updates one asset at a time
 * (or in CASE-expression batches for larger datasets).
 *
 * @param organizationId - The organization ID
 * @param prefix - The prefix for sequential IDs (default: "SAM")
 * @returns Number of assets updated
 */
export async function generateBulkSequentialIdsEfficient(
  organizationId: string,
  prefix: string = DEFAULT_PREFIX
): Promise<number> {
  try {
    const startingNumber =
      (await getMaxSequenceNumber(organizationId, prefix)) + 1;

    // Fetch all asset IDs that still need a sequential ID, ordered deterministically
    const assetIds = await db.asset.findMany({
      where: { organizationId, sequentialId: null },
      select: { id: true },
      orderBy: { id: "asc" },
    });

    if (assetIds.length === 0) return 0;

    const padLen = Math.max(
      4,
      String(startingNumber + assetIds.length - 1).length
    );

    // Build (id, sequentialId) pairs
    const assignments = assetIds.map((a, i) => ({
      id: a.id,
      sequentialId: `${prefix}-${String(startingNumber + i).padStart(
        padLen,
        "0"
      )}`,
    }));

    const BATCH_SIZE = 200;
    let totalUpdated = 0;

    for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
      const batch = assignments.slice(i, i + BATCH_SIZE);

      // Build a CASE expression for SQLite batch update
      const setClauses = Prisma.join(
        batch.map((a) => Prisma.sql`WHEN ${a.id} THEN ${a.sequentialId}`),
        " "
      );
      const idList = Prisma.join(
        batch.map((a) => Prisma.sql`${a.id}`),
        ", "
      );

      const updated = await db.$executeRaw`
        UPDATE "Asset"
        SET "sequentialId" = CASE "id" ${setClauses} END
        WHERE "id" IN (${idList})
          AND "sequentialId" IS NULL
      `;

      totalUpdated += Number(updated);
      console.log(
        `Bulk sequential IDs: batch ${
          Math.floor(i / BATCH_SIZE) + 1
        } → ${updated} assets`
      );
    }

    console.log(
      `Generated ${totalUpdated} sequential IDs for org ${organizationId}, starting from ${formatSequentialId(
        startingNumber,
        prefix
      )}`
    );

    return totalUpdated;
  } catch (error) {
    console.error(
      `Failed to generate bulk sequential IDs for organization ${organizationId}:`,
      error
    );
    throw new Error(`Could not generate sequential IDs for existing assets`);
  }
}
