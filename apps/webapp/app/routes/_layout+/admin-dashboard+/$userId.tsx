import type { ReactNode } from "react";
import {
  type Asset,
  type Qr,
  type User,
  OrganizationRoles,
  type UserBusinessIntel,
  type Prisma,
} from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, useLoaderData, Link } from "react-router";

import { z } from "zod";
import { DateS } from "~/components/shared/date";
import { Table, Td, Th, Tr } from "~/components/table";
import { DeleteUser } from "~/components/user/delete-user";
import { config } from "~/config/shelf.config";
import { db } from "~/database/db.server";
import { softDeleteUser, getUserByID } from "~/modules/user/service.server";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { makeShelfError, ShelfError } from "~/utils/error";
import {
  payload,
  error,
  getParams,
  isDelete,
  parseData,
} from "~/utils/http.server";
import { parseRoles } from "~/utils/roles";
import { requireAdmin } from "~/utils/roles.server";

export const meta = () => [{ title: appendToMetaTitle("User details") }];

export type QrCodeWithAsset = Qr & {
  asset: {
    title: Asset["title"];
  };
};

export type UserWithQrCodes = User & {
  qrCodes: QrCodeWithAsset[];
};

export const loader = async ({ context, params }: LoaderFunctionArgs) => {
  const authSession = context.getSession();
  const { userId } = authSession;
  const { userId: shelfUserId } = getParams(
    params,
    z.object({ userId: z.string() }),
    { additionalData: { userId } }
  );
  const premiumIsEnabled = config.enablePremiumFeatures;

  try {
    await requireAdmin(userId);

    const user = await getUserByID(shelfUserId, {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        username: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
        sso: true,
        onboarded: true,
        createdWithInvite: true,
        qrCodes: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            asset: {
              select: {
                title: true,
              },
            },
          },
        },
        businessIntel: {
          select: {
            howDidYouHearAboutUs: true,
            jobTitle: true,
            teamSize: true,
            companyName: true,
            primaryUseCase: true,
            currentSolution: true,
            timeline: true,
          },
        },
      } satisfies Prisma.UserSelect,
    });

    const userOrganizations = await db.userOrganization
      .findMany({
        where: {
          userId: shelfUserId,
        },
        select: {
          organization: {
            include: {
              ssoDetails: true,
              userOrganizations: {
                // Include ALL users in each org with SSO enabled so we cna count them
                where: {
                  user: {
                    sso: true,
                  },
                },
                select: {
                  userId: true,
                },
              },
            },
          },
          roles: true,
        },
      })
      .catch((cause) => {
        throw new ShelfError({
          cause,
          message: "Failed to load user organizations",
          additionalData: { userId, shelfUserId },
          label: "Admin dashboard",
        });
      });

    /** Which organizations of the user have SSO enabled */
    const organizationsOwnedByUserWithSso = userOrganizations.filter(
      (uo) =>
        uo.organization.enabledSso &&
        uo.organization.ssoDetails &&
        parseRoles(uo.roles).some((role) => role === OrganizationRoles.OWNER)
    );

    /** Process the data you already have - no second query needed! */
    const usersByDomain = organizationsOwnedByUserWithSso.reduce(
      (acc, uo) => {
        const domain = uo.organization.ssoDetails?.domain;

        if (domain) {
          if (!acc[domain]) {
            acc[domain] = new Set<string>();
          }
          // Add all SSO users from this organization
          uo.organization.userOrganizations.forEach((userOrg) => {
            acc[domain].add(userOrg.userId);
          });
        }

        return acc;
      },
      {} as Record<string, Set<string>>
    );

    /** Convert Sets to counts */
    const ssoUsersByDomain = Object.entries(usersByDomain).reduce(
      (acc, [domain, userSet]) => {
        acc[domain] = userSet.size;
        return acc;
      },
      {} as Record<string, number>
    );

    return payload({
      user,
      organizations: userOrganizations.map((uo) => uo.organization),
      ssoUsersByDomain,
      premiumIsEnabled,
    });
  } catch (cause) {
    const reason = makeShelfError(cause, { userId, shelfUserId });
    throw data(error(reason), { status: reason.status });
  }
};

export const handle = {
  breadcrumb: () => "User details",
};

export const action = async ({
  context,
  request,
  params,
}: ActionFunctionArgs) => {
  const authSession = context.getSession();
  const { userId } = authSession;
  const { userId: shelfUserId } = getParams(
    params,
    z.object({ userId: z.string() }),
    { additionalData: { userId } }
  );

  try {
    await requireAdmin(userId);

    const { intent } = parseData(
      await request.clone().formData(),
      z.object({
        intent: z.enum(["deleteUser"]),
      })
    );

    switch (intent) {
      case "deleteUser":
        if (isDelete(request)) {
          await softDeleteUser(shelfUserId);

          sendNotification({
            title: "User deleted",
            message: "The user has been deleted successfully",
            icon: { name: "trash", variant: "error" },
            senderId: userId,
          });
          return payload({ success: true });
        }
        break;
    }

    return payload(null);
  } catch (cause) {
    const reason = makeShelfError(cause, { userId, shelfUserId });
    return data(error(reason), { status: reason.status });
  }
};

// User type extracted from the loader's return value; used by the
// module-scope renderers below.
type LoaderUser = NonNullable<Awaited<ReturnType<typeof loader>>["user"]>;
type LoaderBusinessIntel = Pick<
  UserBusinessIntel,
  | "howDidYouHearAboutUs"
  | "jobTitle"
  | "teamSize"
  | "companyName"
  | "primaryUseCase"
  | "currentSolution"
  | "timeline"
>;

/**
 * Renders the right-hand cell for a given user-profile field in the admin
 * user detail table. Extracted to module scope so React can treat it as a
 * stable component identity (avoids render-in-render churn).
 */
function UserFieldValue({
  fieldKey,
  value,
}: {
  fieldKey: keyof LoaderUser;
  value: LoaderUser[keyof LoaderUser];
}): ReactNode {
  switch (fieldKey) {
    case "createdAt":
    case "updatedAt":
      return <DateS date={value as string | Date} />;
    default:
      return typeof value === "string"
        ? value
        : typeof value === "boolean"
        ? String(value)
        : null;
  }
}

/**
 * Renders a single business-intel field value, substituting an em-dash for
 * missing/empty values. Extracted to module scope to satisfy React's
 * no-render-in-render rule.
 */
function BusinessIntelValue({
  value,
}: {
  value: LoaderBusinessIntel[keyof LoaderBusinessIntel];
}): ReactNode {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return "—";
  }

  return value;
}

export default function Area51UserPage() {
  const { user, organizations, ssoUsersByDomain } =
    useLoaderData<typeof loader>();

  return user ? (
    <div>
      <div>
        <div className="flex justify-between">
          <h1>User: {user?.email}</h1>
          <DeleteUser />
        </div>
        <div className="flex gap-4">
          <div className="w-[400px]">
            <ul className="mt-5">
              {user
                ? Object.entries(user)
                    .filter(
                      ([k, _v]) => !["qrCodes", "businessIntel"].includes(k)
                    )
                    .map(([key, value]) => (
                      <li key={key}>
                        <span className="font-semibold">{key}</span>:{" "}
                        <UserFieldValue
                          fieldKey={key as keyof LoaderUser}
                          value={value}
                        />
                      </li>
                    ))
                : null}
            </ul>
            {user.businessIntel ? (
              <div className="mt-6">
                <h4 className="font-semibold">Business intel</h4>
                <ul className="mt-2 space-y-1">
                  {Object.entries(user.businessIntel).map(([key, value]) => (
                    <li key={key}>
                      <span className="font-semibold">{key}</span>:{" "}
                      <BusinessIntelValue
                        value={
                          value as LoaderBusinessIntel[keyof LoaderBusinessIntel]
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div>
            <SsoUsersByDomainTable ssoUsersByDomain={ssoUsersByDomain} />
          </div>
        </div>
      </div>
      <div className="mt-10">
        <Table>
          <thead>
            <tr>
              <th className="border-b p-4 text-left text-gray-600 md:px-6">
                Name
              </th>
              <th className="border-b p-4 text-left text-gray-600 md:px-6">
                Type
              </th>
              <th className="border-b p-4 text-left text-gray-600 md:px-6">
                Created at
              </th>
              <th className="border-b p-4 text-left text-gray-600 md:px-6">
                Is Owner
              </th>
              <th className="border-b p-4 text-left text-gray-600 md:px-6">
                SSO
              </th>
              <th className="border-b p-4 text-left text-gray-600 md:px-6">
                Workspace disabled
              </th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => (
              <Tr key={org.id}>
                <Td>
                  <Link
                    to={`/admin-dashboard/org/${org.id}/assets`}
                    className="underline hover:text-gray-500"
                  >
                    {org.name}
                  </Link>
                </Td>
                <Td>{org.type}</Td>
                <Td>
                  <DateS date={org.createdAt} />
                </Td>
                <Td>{org.userId === user.id ? "yes" : "no"}</Td>
                <Td>{org.enabledSso ? "yes" : "no"}</Td>
                <Td>{org.workspaceDisabled ? "yes" : "no"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  ) : null;
}

interface SsoUsersByDomainTableProps {
  ssoUsersByDomain: Record<string, number>;
}
const SsoUsersByDomainTable = ({
  ssoUsersByDomain,
}: SsoUsersByDomainTableProps) => {
  // Convert object to array and sort by domain name for consistent display
  const sortedDomains = Object.entries(ssoUsersByDomain).sort(
    ([domainA], [domainB]) => domainA.localeCompare(domainB)
  );

  if (sortedDomains.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No SSO users found in workspaces owned by this user.
      </div>
    );
  }

  const totalUsers = sortedDomains.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="flex flex-col bg-gray-200 p-4">
      <h4>SSO user count</h4>

      <div className="">
        <table className="w-full border">
          <thead className="bg-gray-50">
            <Tr>
              <Th className="">Domain</Th>
              <Th className="whitespace-nowrap">SSO Users</Th>
            </Tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedDomains.map(([domain, userCount]) => (
              <Tr key={domain} className="transition-colors hover:bg-gray-50">
                <Td className="max-w-none">{domain}</Td>
                <Td className="text-right">{userCount.toLocaleString()}</Td>
              </Tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <Tr>
              <Td className="px-4 py-3 text-sm font-semibold text-gray-800">
                Total
              </Td>
              <Td className="px-4 py-3 text-right font-mono text-sm font-semibold text-gray-800">
                {totalUsers.toLocaleString()}
              </Td>
            </Tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
