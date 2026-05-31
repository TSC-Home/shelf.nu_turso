/**
 * Tier service stub — SQLite/Turso self-hosted fork.
 *
 * The Tier / TierLimit / CustomTierLimit Prisma models were removed from the
 * schema. All features are always enabled (ENABLE_PREMIUM_FEATURES=false).
 * These functions return an "unlimited" tier limit without touching the DB so
 * callers in subscription.server.ts and route loaders compile unchanged.
 */

import type { Organization, User } from "@prisma/client";

/** Stable id used internally as a tier name for this fork. */
export type TierId = "free" | "plus" | "team" | "custom";

/** Minimal tier-limit shape expected by callers throughout the app. */
export type TierLimit = {
  id: string;
  tierId: TierId;
  maxAssets: number;
  maxOrganizations: number;
  maxCustomFields: number;
  canExportAssets: boolean;
  canImportAssets: boolean;
  canImportNRM: boolean;
  canHideShelfBranding: boolean;
  isEnterprise: boolean;
  storageLimit: number | null;
  bookingReservationsEnabled: boolean;
};

/** Unlimited tier limit returned for every user and organization. */
const UNLIMITED_TIER_LIMIT: TierLimit = {
  id: "self-hosted",
  tierId: "custom",
  maxAssets: Number.MAX_SAFE_INTEGER,
  maxOrganizations: Number.MAX_SAFE_INTEGER,
  maxCustomFields: Number.MAX_SAFE_INTEGER,
  canExportAssets: true,
  canImportAssets: true,
  canImportNRM: true,
  canHideShelfBranding: true,
  isEnterprise: true,
  storageLimit: null,
  bookingReservationsEnabled: true,
};

export function getUserTierLimit(_id: User["id"]): Promise<TierLimit> {
  return Promise.resolve(UNLIMITED_TIER_LIMIT);
}

export function getOrganizationTierLimit(_args: {
  organizationId?: string;
  organizations: Pick<
    Organization,
    "id" | "type" | "name" | "imageId" | "userId"
  >[];
}): Promise<TierLimit> {
  return Promise.resolve(UNLIMITED_TIER_LIMIT);
}

export function updateUserTierId(
  _id: User["id"],
  _tierId: TierId
): Promise<{ id: string; tierId: string | null }> {
  return Promise.resolve({ id: _id, tierId: _tierId });
}
