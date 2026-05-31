import { Roles, AssetIndexMode, OrganizationRoles } from "@prisma/client";
import { describe, expect, it, vitest, beforeEach } from "vitest";
import {
  ORGANIZATION_ID,
  USER_EMAIL,
  USER_ID,
  USER_PASSWORD,
} from "@mocks/user";
import { db } from "~/database/db.server";
import {
  createEmailAuthAccount,
  confirmExistingAuthAccount,
  signInWithEmail,
  deleteAuthAccount,
} from "~/modules/auth/service.server";
import { USER_WITH_SSO_DETAILS_SELECT } from "./fields";
import {
  createUserAccountForTesting,
  createUserOrAttachOrg,
  defaultUserCategories,
} from "./service.server";
import { defaultFields } from "../asset-index-settings/helpers";

// @vitest-environment node
// 👋 see https://vitest.dev/guide/environment.html#environments-for-specific-files

// why: testing user account creation logic without executing actual database operations
vitest.mock("~/database/db.server", () => ({
  db: {
    $transaction: vitest.fn().mockImplementation((callback) => callback(db)),
    $queryRaw: vitest.fn().mockResolvedValue([]),
    user: {
      create: vitest.fn().mockResolvedValue({}),
      findFirst: vitest.fn().mockResolvedValue(null),
    },
    organization: {
      findFirst: vitest.fn().mockResolvedValue({
        id: ORGANIZATION_ID,
      }),
    },
    userOrganization: {
      upsert: vitest.fn().mockResolvedValue({}),
    },
  },
}));

// why: ensureAssetIndexModeForRole has its own db dependencies unrelated to user creation
vitest.mock("~/modules/asset-index-settings/service.server", () => ({
  ensureAssetIndexModeForRole: vitest.fn().mockResolvedValue(undefined),
}));

// why: auth service uses real DB/bcrypt under the hood; mock it so unit tests
// focus on user-service orchestration without bcrypt/session overhead
vitest.mock("~/modules/auth/service.server", () => ({
  createEmailAuthAccount: vitest.fn(),
  confirmExistingAuthAccount: vitest.fn(),
  signInWithEmail: vitest.fn(),
  deleteAuthAccount: vitest.fn().mockResolvedValue(undefined),
  updateAccountPassword: vitest.fn().mockResolvedValue(undefined),
  signUpWithEmailPass: vitest.fn(),
}));

const authAccount = { id: USER_ID, email: USER_EMAIL };
const authSession = {
  refreshToken: "valid",
  accessToken: "valid",
  userId: USER_ID,
  email: USER_EMAIL,
  expiresIn: -1,
  expiresAt: -1,
};
const username = `test-user-${USER_ID}`;

describe(createUserAccountForTesting.name, () => {
  beforeEach(() => {
    vitest.clearAllMocks();
  });

  it("should return null if no auth account created", async () => {
    (createEmailAuthAccount as ReturnType<typeof vitest.fn>).mockRejectedValue(
      new Error("create-account-error")
    );

    const result = await createUserAccountForTesting(
      USER_EMAIL,
      USER_PASSWORD,
      username
    );

    expect(result).toBeNull();
    expect(createEmailAuthAccount).toHaveBeenCalledWith(
      USER_EMAIL,
      USER_PASSWORD
    );
  });

  it("should return null and delete auth account if unable to sign in", async () => {
    (createEmailAuthAccount as ReturnType<typeof vitest.fn>).mockResolvedValue(
      authAccount
    );
    (signInWithEmail as ReturnType<typeof vitest.fn>).mockRejectedValue(
      new Error("sign-in-error")
    );

    const result = await createUserAccountForTesting(
      USER_EMAIL,
      USER_PASSWORD,
      username
    );

    expect(result).toBeNull();
    expect(deleteAuthAccount).toHaveBeenCalledWith(USER_ID);
  });

  it("should return null and delete auth account if unable to create user in database", async () => {
    (createEmailAuthAccount as ReturnType<typeof vitest.fn>).mockResolvedValue(
      authAccount
    );
    (signInWithEmail as ReturnType<typeof vitest.fn>).mockResolvedValue(
      authSession
    );
    //@ts-expect-error missing vitest type
    db.user.create.mockResolvedValue(null);

    const result = await createUserAccountForTesting(
      USER_EMAIL,
      USER_PASSWORD,
      username
    );

    expect(result).toBeNull();
    expect(deleteAuthAccount).toHaveBeenCalledWith(USER_ID);
  });

  it("should create an account", async () => {
    (createEmailAuthAccount as ReturnType<typeof vitest.fn>).mockResolvedValue(
      authAccount
    );
    (signInWithEmail as ReturnType<typeof vitest.fn>).mockResolvedValue(
      authSession
    );
    //@ts-expect-error missing vitest type
    db.user.create.mockResolvedValue({
      id: USER_ID,
      email: USER_EMAIL,
      username: username,
      organizations: [{ id: "org-id" }],
    });
    //@ts-expect-error missing vitest type
    db.$transaction.mockImplementationOnce((callback) => callback(db));

    const result = await createUserAccountForTesting(
      USER_EMAIL,
      USER_PASSWORD,
      username
    );

    // normalize the timestamp so the snapshot is stable
    result!.expiresAt = -1;

    expect(db.user.create).toBeCalledWith({
      data: {
        email: USER_EMAIL,
        id: USER_ID,
        username: username,
        firstName: undefined,
        lastName: undefined,
        createdWithInvite: undefined,
        organizations: {
          create: [
            {
              name: "Personal",
              hasSequentialIdsMigrated: true,
              categories: {
                create: defaultUserCategories.map((c) => ({
                  ...c,
                  userId: USER_ID,
                })),
              },
              members: {
                create: {
                  name: "(Owner)",
                  user: { connect: { id: USER_ID } },
                },
              },
              assetIndexSettings: {
                create: {
                  mode: AssetIndexMode.ADVANCED,
                  columns: defaultFields,
                  user: {
                    connect: {
                      id: USER_ID,
                    },
                  },
                },
              },
            },
          ],
        },
        roles: {
          connect: {
            name: Roles["USER"],
          },
        },
      },
      select: {
        organizations: {
          select: { id: true },
        },
        ...USER_WITH_SSO_DETAILS_SELECT,
      },
    });
    expect(result).toEqual(authSession);
  });
});

const newUserMock = {
  id: USER_ID,
  email: USER_EMAIL,
  organizations: [{ id: ORGANIZATION_ID }],
};

describe(createUserOrAttachOrg.name, () => {
  beforeEach(() => {
    vitest.clearAllMocks();
    //@ts-expect-error missing vitest type
    db.user.findFirst.mockResolvedValue(null);
    //@ts-expect-error missing vitest type
    db.user.create.mockResolvedValue(newUserMock);
    //@ts-expect-error missing vitest type
    db.$transaction.mockImplementation((callback: any) => callback(db));
    (createEmailAuthAccount as ReturnType<typeof vitest.fn>).mockResolvedValue(
      authAccount
    );
    (
      confirmExistingAuthAccount as ReturnType<typeof vitest.fn>
    ).mockResolvedValue(authAccount);
  });

  /** Happy path: brand-new user with no prior auth account */
  it("creates a new user when no Prisma user exists", async () => {
    const result = await createUserOrAttachOrg({
      email: USER_EMAIL,
      organizationId: ORGANIZATION_ID,
      roles: [OrganizationRoles.BASE],
      password: USER_PASSWORD,
      firstName: "Test",
      createdWithInvite: true,
    });

    expect(result.id).toBe(USER_ID);
    expect(db.user.create).toHaveBeenCalled();
  });

  /** Falls back to confirming existing account when createEmailAuthAccount fails */
  it("falls back to confirming existing auth account when createEmailAuthAccount fails", async () => {
    (createEmailAuthAccount as ReturnType<typeof vitest.fn>).mockRejectedValue(
      new Error("email already registered")
    );

    const result = await createUserOrAttachOrg({
      email: USER_EMAIL,
      organizationId: ORGANIZATION_ID,
      roles: [OrganizationRoles.BASE],
      password: USER_PASSWORD,
      firstName: "Test",
      createdWithInvite: true,
    });

    expect(result.id).toBe(USER_ID);
    expect(confirmExistingAuthAccount).toHaveBeenCalledWith(
      USER_EMAIL,
      USER_PASSWORD
    );
    expect(db.user.create).toHaveBeenCalled();
  });

  /** No auth account can be created or found — user gets a clear error */
  it("throws when both createEmailAuthAccount and confirmExistingAuthAccount fail", async () => {
    (createEmailAuthAccount as ReturnType<typeof vitest.fn>).mockRejectedValue(
      new Error("email already registered")
    );
    (
      confirmExistingAuthAccount as ReturnType<typeof vitest.fn>
    ).mockResolvedValue(null);

    await expect(
      createUserOrAttachOrg({
        email: USER_EMAIL,
        organizationId: ORGANIZATION_ID,
        roles: [OrganizationRoles.BASE],
        password: USER_PASSWORD,
        firstName: "Test",
        createdWithInvite: true,
      })
    ).rejects.toThrow("We are facing some issue with your account");
  });

  /** Existing user accepting invite for a new org — no auth changes needed */
  it("attaches org to existing Prisma user without creating a new auth account", async () => {
    const existingUser = {
      id: USER_ID,
      email: USER_EMAIL,
      firstName: "Existing",
      lastName: "User",
      sso: false,
      userOrganizations: [],
    };

    //@ts-expect-error missing vitest type
    db.user.findFirst.mockResolvedValueOnce(existingUser);

    const result = await createUserOrAttachOrg({
      email: USER_EMAIL,
      organizationId: ORGANIZATION_ID,
      roles: [OrganizationRoles.BASE],
      password: USER_PASSWORD,
      firstName: "Existing",
      createdWithInvite: true,
    });

    expect(result.id).toBe(USER_ID);
    expect(db.userOrganization.upsert).toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
    expect(createEmailAuthAccount).not.toHaveBeenCalled();
  });
});
