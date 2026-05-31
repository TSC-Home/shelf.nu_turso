import {
  AssetIndexMode,
  OrganizationRoles,
  OrganizationType,
  Roles,
} from "@prisma/client";
import type { Organization, Prisma, User } from "@prisma/client";

import { db } from "~/database/db.server";
import { sendEmail } from "~/emails/mail.server";
import type { TierId } from "~/modules/tier/service.server";
import { DEFAULT_MAX_IMAGE_UPLOAD_SIZE } from "~/utils/constants";
import { ADMIN_EMAIL } from "~/utils/env";
import type { ErrorLabel } from "~/utils/error";
import { isLikeShelfError, ShelfError } from "~/utils/error";
import { parseRoles } from "~/utils/roles";
import {
  createStripeCustomer,
  customerHasPaymentMethod,
  premiumIsEnabled,
} from "~/utils/stripe.server";
import { resolveUserDisplayName } from "~/utils/user";
import { newOwnerEmailText, previousOwnerEmailText } from "./email";
import { defaultFields } from "../asset-index-settings/helpers";
import { defaultUserCategories } from "../category/default-categories";
import { updateUserTierId } from "../tier/service.server";
import { getDefaultWeeklySchedule } from "../working-hours/service.server";

const label: ErrorLabel = "Organization";

export async function getOrganizationById<T extends Prisma.OrganizationInclude>(
  id: Organization["id"],
  extraIncludes?: T
) {
  try {
    return (await db.organization.findUniqueOrThrow({
      where: { id },
      include: extraIncludes,
    })) as Prisma.OrganizationGetPayload<{ include: T }>;
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "No organization found with this ID",
      additionalData: { id },
      label,
    });
  }
}

export const getOrganizationByUserId = async ({
  userId,
  orgType,
}: {
  userId: User["id"];
  orgType: OrganizationType;
}) => {
  try {
    return await db.organization.findFirstOrThrow({
      where: {
        owner: {
          is: {
            id: userId,
          },
        },
        type: orgType,
      },
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
      },
    });
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "No organization found for this user.",
      additionalData: {
        userId,
        orgType,
      },
      label,
    });
  }
};

/**
 * Gets organizations that use the email domain for SSO
 * Supports multiple domains per organization via comma-separated domain strings
 * @param emailDomain - Email domain to check
 * @returns Array of organizations that use this domain for SSO
 */
export async function getOrganizationsBySsoDomain(emailDomain: string) {
  try {
    if (!emailDomain) {
      throw new ShelfError({
        cause: null,
        message: "Email domain is required",
        additionalData: { emailDomain },
        label: "SSO",
      });
    }

    // Query for organizations where the domain field contains the email domain
    const organizations = await db.organization.findMany({
      where: {
        ssoDetails: {
          isNot: null,
        },
        AND: [
          {
            ssoDetails: {
              domain: {
                contains: emailDomain,
              },
            },
          },
        ],
      },
      include: {
        ssoDetails: true,
      },
    });

    // Filter to ensure exact domain matches
    return organizations.filter((org) =>
      org.ssoDetails?.domain
        ? emailMatchesDomains(emailDomain, org.ssoDetails.domain)
        : false
    );
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Failed to get organizations by SSO domain",
      additionalData: { emailDomain },
      label: "SSO",
    });
  }
}

export async function createOrganization({
  name,
  userId,
  image,
  currency,
}: Pick<Organization, "name" | "currency"> & {
  userId: User["id"];
  image: File | null;
}) {
  try {
    const owner = await db.user.findFirstOrThrow({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
      },
    });

    const data = {
      name,
      currency,
      type: OrganizationType.TEAM,
      hasSequentialIdsMigrated: true, // New organizations don't need migration
      categories: {
        create: defaultUserCategories.map((c) => ({ ...c, userId })),
      },
      userOrganizations: {
        create: {
          userId,
          // SQLite stores roles as a JSON string
          roles: JSON.stringify([OrganizationRoles.OWNER]),
        },
      },
      owner: {
        connect: {
          id: userId,
        },
      },
      /**
       * Creating a teamMember when a new organization/workspace is created
       * so that the owner appear in the list by default
       */
      members: {
        create: {
          name: `${resolveUserDisplayName(owner)} (Owner)`,
          user: { connect: { id: owner.id } },
        },
      },

      assetIndexSettings: {
        create: {
          mode: AssetIndexMode.ADVANCED,
          columns: defaultFields,
          user: {
            connect: {
              id: userId,
            },
          },
        },
      },

      workingHours: {
        create: {
          enabled: false,
          weeklySchedule: getDefaultWeeklySchedule(),
        },
      },

      bookingSettings: {
        create: {
          bufferStartTime: 0,
        },
      },
    } satisfies Prisma.OrganizationCreateInput;

    const org = await db.organization.create({ data });

    if (image?.size && image?.size > 0) {
      await db.image.create({
        data: {
          blob: Buffer.from(await image.arrayBuffer()),
          contentType: image.type,
          ownerOrg: {
            connect: {
              id: org.id,
            },
          },
          organization: {
            connect: {
              id: org.id,
            },
          },
          user: {
            connect: {
              id: userId,
            },
          },
        },
      });
    }

    return org;
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while creating the organization. Please try again or contact support.",
      additionalData: { name, userId },
      label,
    });
  }
}
export async function updateOrganization({
  id,
  name,
  image,
  userId,
  currency,
  ssoDetails,
  hasSequentialIdsMigrated,
  qrIdDisplayPreference,
  showShelfBranding,
  customEmailFooter,
  labelBrandingText,
  labelCustomText,
  labelTemplate,
}: Pick<Organization, "id"> & {
  currency?: Organization["currency"];
  name?: string;
  userId: User["id"];
  image?: File | null;
  ssoDetails?: {
    selfServiceGroupId: string;
    adminGroupId: string;
    baseUserGroupId: string;
  };
  hasSequentialIdsMigrated?: Organization["hasSequentialIdsMigrated"];
  qrIdDisplayPreference?: Organization["qrIdDisplayPreference"];
  showShelfBranding?: Organization["showShelfBranding"];
  customEmailFooter?: string | null;
  labelBrandingText?: Organization["labelBrandingText"];
  labelCustomText?: Organization["labelCustomText"];
  labelTemplate?: Organization["labelTemplate"];
}) {
  try {
    const data = {
      name,
      ...(currency && { currency }),
      ...(qrIdDisplayPreference && { qrIdDisplayPreference }),
      ...(hasSequentialIdsMigrated !== undefined && {
        hasSequentialIdsMigrated,
      }),
      ...(typeof showShelfBranding === "boolean" && {
        showShelfBranding,
      }),
      ...(customEmailFooter !== undefined && { customEmailFooter }),
      ...(labelBrandingText !== undefined && { labelBrandingText }),
      ...(labelCustomText !== undefined && { labelCustomText }),
      ...(labelTemplate !== undefined && { labelTemplate }),
      ...(ssoDetails && {
        ssoDetails: {
          update: ssoDetails,
        },
      }),
    };

    if (image?.size && image?.size > 0) {
      if (image.size > DEFAULT_MAX_IMAGE_UPLOAD_SIZE) {
        throw new ShelfError({
          cause: null,
          message: `Image size exceeds maximum allowed size of ${
            DEFAULT_MAX_IMAGE_UPLOAD_SIZE / (1024 * 1024)
          }MB`,
          additionalData: { id, userId, field: "image" },
          label,
          shouldBeCaptured: false,
          status: 400,
        });
      }

      const imageData = {
        blob: Buffer.from(await image.arrayBuffer()),
        contentType: image.type,
        ownerOrg: {
          connect: {
            id: id,
          },
        },
        user: {
          connect: {
            id: userId,
          },
        },
      };

      Object.assign(data, {
        image: {
          upsert: {
            create: imageData,
            update: imageData,
          },
        },
      });
    }

    return await db.organization.update({
      where: { id },
      data: data,
    });
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: isLikeShelfError(cause)
        ? cause.message
        : "Something went wrong while updating the organization. Please try again or contact support.",
      additionalData: { id, userId, name },
      label,
    });
  }
}

const ORGANIZATION_SELECT_FIELDS = {
  id: true,
  type: true,
  name: true,
  imageId: true,
  userId: true,
  updatedAt: true,
  currency: true,
  enabledSso: true,
  owner: {
    select: {
      id: true,
      email: true,
    },
  },
  ssoDetails: true,
  workspaceDisabled: true,
  selfServiceCanSeeCustody: true,
  selfServiceCanSeeBookings: true,
  baseUserCanSeeCustody: true,
  baseUserCanSeeBookings: true,
  hasSequentialIdsMigrated: true,
  qrIdDisplayPreference: true,
  showShelfBranding: true,
  customEmailFooter: true,
  labelBrandingText: true,
  labelCustomText: true,
  labelTemplate: true,
};

export type OrganizationFromUser = Prisma.OrganizationGetPayload<{
  select: typeof ORGANIZATION_SELECT_FIELDS;
}>;

export async function getUserOrganizations({ userId }: { userId: string }) {
  try {
    return await db.userOrganization.findMany({
      where: { userId },
      select: {
        organizationId: true,
        roles: true,
        organization: {
          select: ORGANIZATION_SELECT_FIELDS,
        },
        user: {
          select: { lastSelectedOrganizationId: true, sso: true },
        },
      },
    });
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while fetching user organizations. Please try again or contact support.",
      additionalData: { userId },
      label,
    });
  }
}

export async function getOrganizationAdminsEmails({
  organizationId,
}: {
  organizationId: string;
}) {
  try {
    const admins = await db.userOrganization.findMany({
      where: {
        organizationId,
        // SQLite: roles is a JSON string, use OR + contains for array membership
        OR: [
          { roles: { contains: `"${OrganizationRoles.OWNER}"` } },
          { roles: { contains: `"${OrganizationRoles.ADMIN}"` } },
        ],
      },
      select: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return admins.map((a) => a.user.email);
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while fetching organization admins emails. Please try again or contact support.",
      additionalData: { organizationId },
      label,
    });
  }
}

/**
 * Returns admin and owner users for an organization with their full
 * notification-relevant fields: `id`, `email`, `firstName`, `lastName`.
 *
 * This differs from `getOrganizationAdminsEmails()` (which returns only
 * email strings) because the notification recipient resolver needs the
 * `userId` to perform editor exclusion — if the admin performing an action
 * is also in the recipient list, they should be filtered out so they don't
 * email themselves. Returning bare email strings would not support that
 * matching.
 *
 * @param organizationId - The organization to fetch admins for
 * @returns Array of user objects with id, email, firstName, lastName
 */
export async function getOrganizationAdminsForNotification({
  organizationId,
}: {
  organizationId: string;
}) {
  try {
    const admins = await db.userOrganization.findMany({
      where: {
        organizationId,
        // SQLite: roles is a JSON string, use OR + contains for array membership
        OR: [
          { roles: { contains: `"${OrganizationRoles.OWNER}"` } },
          { roles: { contains: `"${OrganizationRoles.ADMIN}"` } },
        ],
      },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return admins.map((a) => a.user);
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while fetching organization admins for notification. Please try again or contact support.",
      additionalData: { organizationId },
      label,
    });
  }
}

export async function toggleOrganizationSso({
  organizationId,
  enabledSso,
}: {
  organizationId: string;
  enabledSso: boolean;
}) {
  try {
    return await db.organization.update({
      where: { id: organizationId, type: OrganizationType.TEAM },
      data: {
        enabledSso,
      },
    });
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while toggling organization SSO. Please try again or contact support.",
      additionalData: { organizationId, enabledSso },
      label,
    });
  }
}

export async function toggleWorkspaceDisabled({
  organizationId,
  workspaceDisabled,
}: {
  organizationId: string;
  workspaceDisabled: boolean;
}) {
  try {
    return await db.organization.update({
      where: { id: organizationId, type: OrganizationType.TEAM },
      data: {
        workspaceDisabled,
      },
    });
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while toggling workspace disabled. Please try again or contact support.",
      additionalData: { organizationId, workspaceDisabled },
      label,
    });
  }
}

/** Stub — barcode/audit trial fields removed in self-hosted SQLite fork. */
export function toggleBarcodeEnabled(_args: {
  organizationId: string;
  barcodesEnabled: boolean;
}): Promise<void> {
  return Promise.resolve();
}

/** Stub — barcode/audit trial fields removed in self-hosted SQLite fork. */
export function toggleAuditEnabled(_args: {
  organizationId: string;
  auditsEnabled: boolean;
}): Promise<void> {
  return Promise.resolve();
}

/**
 * Utility function to parse and validate domains from a comma-separated string
 * @param domainsString - Comma-separated string of domains
 * @returns Array of cleaned domain strings
 */
export function parseDomains(domainsString: string): string[] {
  return domainsString
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Checks if a given email matches any of the provided comma-separated domains
 * @param email - Email address to check
 * @param domainsString - Comma-separated string of domains
 * @returns boolean indicating if email matches any domain
 */
export function emailMatchesDomains(
  emailDomain: string,
  domainsString: string | null
): boolean {
  if (!emailDomain || !domainsString) return false;
  const domains = parseDomains(domainsString);
  return domains.includes(emailDomain.toLowerCase());
}

/** Permissions functions */

/**
 * Gets the permissions columns in the organization table
 * Columns:
 * - selfServiceCanSeeCustody
 * - selfServiceCanSeeBookings
 * - baseUserCanSeeCustody
 * - baseUserCanSeeBookings
 */
export function getOrganizationPermissionColumns(id: string) {
  return db.organization.findUnique({
    where: { id },
    select: {
      selfServiceCanSeeCustody: true,
      selfServiceCanSeeBookings: true,
      baseUserCanSeeCustody: true,
      baseUserCanSeeBookings: true,
    },
  });
}

/**
 * Updates the permissions columns in the organization table
 * Updated columns:
 * - selfServiceCanSeeCustody
 * - selfServiceCanSeeBookings
 * - baseUserCanSeeCustody
 * - baseUserCanSeeBookings
 */
export function updateOrganizationPermissions({
  id,
  configuration,
}: {
  id: string;
  configuration: Pick<
    Organization,
    | "selfServiceCanSeeCustody"
    | "selfServiceCanSeeBookings"
    | "baseUserCanSeeCustody"
    | "baseUserCanSeeBookings"
  >;
}) {
  return db.organization.update({
    where: { id },
    data: {
      ...configuration,
    },
  });
}

export async function getOrganizationAdmins({
  organizationId,
}: {
  organizationId: Organization["id"];
}) {
  try {
    /** Get all the admins in current organization */
    const admins = await db.userOrganization.findMany({
      where: {
        organizationId,
        // SQLite: roles is a JSON string, use contains for membership check
        roles: { contains: `"${OrganizationRoles.ADMIN}"` },
      },
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    return admins.map((a) => a.user);
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Something went wrong while fetching organization admins.",
      label,
    });
  }
}

export async function transferOwnership({
  currentOrganization,
  newOwnerId,
  userId,
  transferSubscription = false,
}: {
  currentOrganization: Pick<Organization, "id" | "name" | "type">;
  newOwnerId: User["id"];
  userId: User["id"];
  /** Whether to transfer the owner's subscription to the new owner */
  transferSubscription?: boolean;
}) {
  try {
    if (currentOrganization.type === OrganizationType.PERSONAL) {
      throw new ShelfError({
        cause: null,
        message: "Personal workspaces cannot be transferred.",
        label,
      });
    }

    const user = await db.user
      .findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, roles: true },
      })
      .catch((cause) => {
        throw new ShelfError({
          cause,
          message: "Something went wrong while fetching current user.",
          label,
        });
      });

    const isCurrentUserShelfAdmin = user.roles.some(
      (role) => role.name === Roles.ADMIN
    );

    /**
     * To transfer ownership, we need to:
     * 1. Update the owner of the organization
     * 2. Update the role of both users in the current organization
     * 3. Optionally transfer the subscription
     */
    const userOrganization = await db.userOrganization.findMany({
      where: {
        organizationId: currentOrganization.id,
        OR: [
          { userId: newOwnerId },
          // SQLite: roles is a JSON string, use contains for membership check
          { roles: { contains: `"${OrganizationRoles.OWNER}"` } },
        ],
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            roles: true,
          },
        },
        roles: true,
      },
    });

    // SQLite: roles is a JSON string — parse before checking membership
    const currentOwnerUserOrg = userOrganization.find((userOrg) =>
      parseRoles(userOrg.roles).includes(OrganizationRoles.OWNER)
    );
    /** Validate if the current user is a member of the organization */
    if (!currentOwnerUserOrg) {
      throw new ShelfError({
        cause: null,
        message: "Current user is not a member of the organization.",
        label,
      });
    }

    /**
     * Validate if the current user is the owner of organization
     * or is a Shelf admin
     */
    if (
      !currentOwnerUserOrg.roles.includes(OrganizationRoles.OWNER) &&
      !isCurrentUserShelfAdmin
    ) {
      throw new ShelfError({
        cause: null,
        message: "Current user is not the owner of the organization.",
        label,
      });
    }

    const newOwnerUserOrg = userOrganization.find(
      (userOrg) => userOrg.user.id === newOwnerId
    );
    if (!newOwnerUserOrg) {
      throw new ShelfError({
        cause: null,
        message: "New owner is not a member of the organization.",
        label,
      });
    }

    /** Validate if the new owner is ADMIN in the current organization */
    if (!newOwnerUserOrg.roles.includes(OrganizationRoles.ADMIN)) {
      throw new ShelfError({
        cause: null,
        message: "New owner is not an admin of the organization.",
        label,
      });
    }

    // Check if new owner already has an active subscription (BLOCK transfer)
    // This applies regardless of whether subscription transfer is requested,
    // as we don't want two owners with separate active subscriptions
    // NOTE: Stripe is not available in this SQLite build — premiumIsEnabled is false
    if (premiumIsEnabled) {
      // Subscription check is a no-op in this build
    }

    // SQLite: tierId does not exist in this fork — use null as a no-op placeholder
    const currentOwnerTierId: TierId | null = null;

    await db.$transaction(async (tx) => {
      /** Update the owner of the organization */
      await tx.organization.update({
        where: { id: currentOrganization.id },
        data: {
          owner: { connect: { id: newOwnerUserOrg.user.id } },
        },
      });

      /** Update the role of current owner to ADMIN */
      await tx.userOrganization.update({
        // eslint-disable-next-line local-rules/require-org-scope-on-id-queries -- idor-safe: currentOwnerUserOrg comes from the `userOrganization` findMany above scoped by `organizationId: currentOrganization.id` (lines 758-765), so this id is already org-proven
        where: { id: currentOwnerUserOrg.id },
        // SQLite: roles is a JSON string — serialize as string instead of array
        data: { roles: JSON.stringify([OrganizationRoles.ADMIN]) },
      });

      /** Update the role of new owner to OWNER */
      await tx.userOrganization.update({
        // eslint-disable-next-line local-rules/require-org-scope-on-id-queries -- idor-safe: newOwnerUserOrg comes from the `userOrganization` findMany above scoped by `organizationId: currentOrganization.id` (lines 758-765), so this id is already org-proven
        where: { id: newOwnerUserOrg.id },
        // SQLite: roles is a JSON string — serialize as string instead of array
        data: { roles: JSON.stringify([OrganizationRoles.OWNER]) },
      });
    });

    // Handle subscription transfer AFTER the ownership transfer succeeds
    // NOTE: Stripe is not available in this SQLite build — premiumIsEnabled is false,
    // so this block is never executed. It remains as a no-op placeholder.
    // why: use `let` so TypeScript does not narrow the type to `null` (which
    // makes downstream `.message`/`.stack` accesses fail on type `never`)
    let subscriptionTransferError: Error | null = null;
    let subscriptionTransferred = false;

    /** Send email to new owner */
    sendEmail({
      subject: `🎉 You're now the Owner of ${currentOrganization.name} - Shelf`,
      to: newOwnerUserOrg.user.email,
      text: newOwnerEmailText({
        newOwnerName: resolveUserDisplayName(newOwnerUserOrg.user),
        workspaceName: currentOrganization.name,
        subscriptionTransferred,
      }),
    });

    /** Send email to previous owner */
    sendEmail({
      subject: `🔁 You've Transferred Ownership of ${currentOrganization.name}`,
      to: currentOwnerUserOrg.user.email,
      text: previousOwnerEmailText({
        previousOwnerName: resolveUserDisplayName(currentOwnerUserOrg.user),
        newOwnerName: resolveUserDisplayName(newOwnerUserOrg.user),
        workspaceName: currentOrganization.name,
        subscriptionTransferred,
      }),
    });

    /** Send admin notification */
    if (ADMIN_EMAIL) {
      // why: cast to `Error | null` so TypeScript does not narrow the stub
      // `null` literal to `never` when accessing `.message` / `.stack`
      const transferErr = subscriptionTransferError as Error | null;
      const subscriptionStatus = transferErr
        ? `Failed - ${transferErr.message}`
        : subscriptionTransferred
        ? "Yes"
        : "No (not requested)";

      sendEmail({
        subject: transferErr
          ? `⚠️ Workspace transferred with errors: ${currentOrganization.name}`
          : `Workspace transferred: ${currentOrganization.name}`,
        to: ADMIN_EMAIL,
        text: `A workspace ownership transfer has occurred.

Workspace: ${currentOrganization.name}
Workspace ID: ${currentOrganization.id}

Previous Owner: ${resolveUserDisplayName(currentOwnerUserOrg.user)} (${
          currentOwnerUserOrg.user.email
        })
New Owner: ${resolveUserDisplayName(newOwnerUserOrg.user)} (${
          newOwnerUserOrg.user.email
        })

Subscription transferred: ${subscriptionStatus}
${
  transferErr
    ? `\nError details: ${transferErr.stack || transferErr.message}`
    : ""
}`,
      });
    }

    return {
      newOwner: newOwnerUserOrg.user,
      subscriptionTransferred,
      subscriptionTransferError: (subscriptionTransferError as Error | null)
        ?.message,
    };
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: isLikeShelfError(cause)
        ? cause.message
        : "Something went wrong while transferring ownership. Please try again or contact support.",
      additionalData: { currentOrganization, newOwnerId },
      label,
    });
  }
}

/**
 * Resets showShelfBranding to true for all personal workspaces owned by a user.
 * Called when Plus user downgrades to free tier.
 *
 * @param userId - The ID of the user whose personal workspaces should be reset
 * @returns Promise resolving to the update result
 */
export async function resetPersonalWorkspaceBranding(userId: User["id"]) {
  try {
    return await db.organization.updateMany({
      where: {
        userId,
        type: OrganizationType.PERSONAL,
      },
      data: {
        showShelfBranding: true,
      },
    });
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while resetting personal workspace branding.",
      additionalData: { userId },
      label,
    });
  }
}

// Stripe subscription helpers removed — Stripe is not available in this SQLite build.
