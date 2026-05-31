import { OrganizationRoles } from "@prisma/client";

/**
 * SQLite stores the `roles` field as a JSON string (e.g. '["ADMIN","OWNER"]').
 * Use this helper everywhere a DB-returned roles value is consumed as an array.
 */
export function parseRoles(
  roles: string | OrganizationRoles[]
): OrganizationRoles[] {
  if (Array.isArray(roles)) return roles;
  try {
    return JSON.parse(roles) as OrganizationRoles[];
  } catch {
    return [];
  }
}

const ROLE_RANK: Record<OrganizationRoles, number> = {
  [OrganizationRoles.OWNER]: 3,
  [OrganizationRoles.ADMIN]: 2,
  [OrganizationRoles.SELF_SERVICE]: 1,
  [OrganizationRoles.BASE]: 1,
};

/**
 * Determines whether changing from `current` to `next` is a demotion.
 * A demotion means the new role has a lower rank than the current role.
 */
export function isDemotion(
  current: OrganizationRoles,
  next: OrganizationRoles
): boolean {
  return ROLE_RANK[current] > ROLE_RANK[next];
}
