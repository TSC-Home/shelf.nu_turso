import type { Prisma } from "@prisma/client";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import { data, redirect, useLoaderData } from "react-router";

import { z } from "zod";
import { Card } from "~/components/shared/card";
import { createChangeEmailSchema } from "~/components/user/change-email";
import {
  UserDetailsForm,
  UserDetailsFormSchema,
} from "~/components/user/details-form";
import {
  DisplayNameForm,
  DisplayNameFormSchema,
} from "~/components/user/display-name-form";
import PasswordResetForm from "~/components/user/password-reset-form";
import { RequestDeleteUser } from "~/components/user/request-delete-user";
import {
  UserContactDetailsForm,
  UserContactDetailsFormSchema,
} from "~/components/user/user-contact-form";
import { db } from "~/database/db.server";
import {
  changeEmailAddressHtmlEmail,
  changeEmailAddressTextEmail,
} from "~/emails/change-user-email-address";

import { sendEmail } from "~/emails/mail.server";
import { refreshAccessToken } from "~/modules/auth/service.server";
import {
  getUserByID,
  getUserWithContact,
  updateProfilePicture,
  updateUser,
  updateUserEmail,
} from "~/modules/user/service.server";
import type { UpdateUserPayload } from "~/modules/user/types";
import type { UpdateUserContactPayload } from "~/modules/user-contact/service.server";
import { updateUserContact } from "~/modules/user-contact/service.server";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { checkExhaustiveSwitch } from "~/utils/check-exhaustive-switch";
import { delay } from "~/utils/delay";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { ADMIN_EMAIL, SERVER_URL } from "~/utils/env";
import { makeShelfError, ShelfError } from "~/utils/error";
import { payload, error, parseData } from "~/utils/http.server";
import {
  PermissionAction,
  PermissionEntity,
} from "~/utils/permissions/permission.data";
import { requirePermission } from "~/utils/roles.server";
import { getConfiguredSSODomains } from "~/utils/sso.server";

// First we define our intent schema
const IntentSchema = z.object({
  intent: z.enum([
    "resetPassword",
    "updateUser",
    "updateDisplayName",
    "deleteUser",
    "initiateEmailChange",
    "verifyEmailChange",
    "updateUserContact",
  ]),
});

// Then we define schemas for each intent type
const ActionSchemas = {
  resetPassword: z.object({
    type: z.literal("resetPassword"),
  }),

  updateUser: UserDetailsFormSchema.extend({
    type: z.literal("updateUser"),
  }),

  updateDisplayName: DisplayNameFormSchema.extend({
    type: z.literal("updateDisplayName"),
  }),

  updateUserContact: UserContactDetailsFormSchema.extend({
    type: z.literal("updateUserContact"),
  }),

  deleteUser: z.object({
    type: z.literal("deleteUser"),
    email: z.string(),
    reason: z.string(),
  }),

  initiateEmailChange: z.object({
    type: z.literal("initiateEmailChange"),
    email: z.string().email(),
  }),

  verifyEmailChange: z.object({
    email: z.string().email(),
    type: z.literal("verifyEmailChange"),
    otp: z.string().min(6).max(6),
  }),
} as const;

// Helper function to get schema
function getActionSchema(intent: z.infer<typeof IntentSchema>["intent"]) {
  return ActionSchemas[intent].extend({ intent: z.literal(intent) });
}

export type UserPageActionData = typeof action;

export async function action({ context, request }: ActionFunctionArgs) {
  const authSession = context.getSession();
  const { userId, email } = authSession;

  try {
    await requirePermission({
      userId,
      request,
      entity: PermissionEntity.userData,
      action: PermissionAction.update,
    });

    // First parse just the intent
    const { intent } = parseData(
      await request.clone().formData(),
      IntentSchema
    );

    // Then parse the full payload with the correct schema
    const parsedData = parseData(
      await request.clone().formData(),
      getActionSchema(intent),
      {
        additionalData: { userId },
      }
    );

    switch (intent) {
      case "resetPassword": {
        if (parsedData.type !== "resetPassword")
          throw new Error("Invalid payload type");

        /** Logout user after 3 seconds */
        await delay(2000);

        context.destroySession();

        return redirect("/forgot-password");
      }
      case "updateUser": {
        if (parsedData.type !== "updateUser")
          throw new Error("Invalid payload type");
        /** Create the payload if the client side validation works */

        const updateUserPayload: UpdateUserPayload = {
          email: parsedData.email,
          username: parsedData.username,
          firstName: parsedData.firstName,
          lastName: parsedData.lastName,
          id: userId,
        };

        await updateProfilePicture({
          request,
          userId,
        });

        /** Update the user */
        await updateUser(updateUserPayload);

        sendNotification({
          title: "User updated",
          message: "Your settings have been updated successfully",
          icon: { name: "success", variant: "success" },
          senderId: authSession.userId,
        });

        return payload({ success: true });
      }
      case "updateDisplayName": {
        if (parsedData.type !== "updateDisplayName")
          throw new Error("Invalid payload type");

        const currentUser = await getUserByID(userId, {
          select: {
            sso: true,
            firstName: true,
            lastName: true,
          } satisfies Prisma.UserSelect,
        });

        if (!currentUser.sso) {
          throw new ShelfError({
            cause: null,
            message: "Display name can only be set by SSO users.",
            label: "User",
          });
        }

        const trimmedDisplayName = parsedData.displayName?.trim() || null;

        await updateUser({
          id: userId,
          displayName: trimmedDisplayName,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
        });

        sendNotification({
          title: "Display name updated",
          message: "Your display name has been updated successfully",
          icon: { name: "success", variant: "success" },
          senderId: authSession.userId,
        });

        return payload({ success: true });
      }
      case "updateUserContact": {
        if (parsedData.type !== "updateUserContact")
          throw new ShelfError({
            cause: null,
            message: "Invalid payload type",
            label: "User",
          });

        const updateUserContactPayload: UpdateUserContactPayload = {
          userId,
          phone: parsedData.phone,
          street: parsedData.street,
          city: parsedData.city,
          stateProvince: parsedData.stateProvince,
          zipPostalCode: parsedData.zipPostalCode,
          countryRegion: parsedData.countryRegion,
        };

        await updateUserContact(updateUserContactPayload);

        sendNotification({
          title: "Contact details updated",
          message: "Your contact information has been updated successfully",
          icon: { name: "success", variant: "success" },
          senderId: authSession.userId,
        });

        return payload({ success: true });
      }
      case "deleteUser": {
        if (parsedData.type !== "deleteUser")
          throw new Error("Invalid payload type");

        let reason = "No reason provided";
        if ("reason" in parsedData && parsedData.reason) {
          reason = parsedData?.reason;
        }

        sendEmail({
          to: ADMIN_EMAIL || `"Shelf" <updates@emails.shelf.nu>`,
          subject: "Delete account request",
          text: `User with id ${userId} and email ${parsedData.email} has requested to delete their account. \n User: ${SERVER_URL}/admin-dashboard/${userId} \n\n Reason: ${reason}\n\n`,
        });

        sendEmail({
          to: parsedData.email,
          subject: "Delete account request received",
          text: `We have received your request to delete your account. It will be processed within 72 hours.\n\n Kind regards,\nthe Shelf team \n\n`,
        });

        sendNotification({
          title: "Account deletion request",
          message:
            "Your request has been sent to the admin and will be processed within 24 hours. You will receive an email confirmation.",
          icon: { name: "success", variant: "success" },
          senderId: authSession.userId,
        });

        return payload({ success: true });
      }
      case "initiateEmailChange": {
        if (parsedData.type !== "initiateEmailChange")
          throw new Error("Invalid payload type");

        const ssoDomains = await getConfiguredSSODomains();
        const user = await getUserByID(userId, {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
          } satisfies Prisma.UserSelect,
        });
        // Validate the payload using our schema
        const { email: newEmail } = parseData(
          await request.clone().formData(),
          createChangeEmailSchema(
            email,
            ssoDomains.map((d) => d.domain)
          ),
          {
            additionalData: { userId },
          }
        );

        // Direct email update — no OTP step needed in self-hosted mode
        await updateUserEmail({ userId, currentEmail: email, newEmail });

        // Invalidate all other sessions so other devices must re-authenticate
        const { refreshToken } = authSession;
        await db.userSession.deleteMany({
          where: { userId, NOT: { refreshToken } },
        });

        sendNotification({
          title: "Email updated",
          message: "Your email address has been successfully updated.",
          icon: { name: "success", variant: "success" },
          senderId: userId,
        });

        return payload({
          awaitingOtp: false,
          newEmail,
          success: true,
          emailChanged: true,
        });
      }
      case "verifyEmailChange": {
        // No-op in self-hosted mode: email change is completed in the
        // initiateEmailChange step without OTP verification.
        return payload({
          success: true,
          awaitingOtp: false,
          emailChanged: true,
        });
      }
      default: {
        checkExhaustiveSwitch(intent);
        return payload(null);
      }
    }
  } catch (cause) {
    const reason = makeShelfError(cause, { userId });
    return data(error(reason), { status: reason.status });
  }
}

export async function loader({ context, request }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;
  try {
    await requirePermission({
      userId,
      request,
      entity: PermissionEntity.userData,
      action: PermissionAction.read,
    });

    const title = "Account Details";
    const user = await getUserWithContact(userId);

    return payload({ title, user });
  } catch (cause) {
    const reason = makeShelfError(cause, { userId });
    throw data(error(reason), { status: reason.status });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.title) : "" },
];

export const handle = {
  breadcrumb: () => "General",
};

export default function UserPage() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="mb-2.5 flex flex-col justify-between gap-3">
      <UserDetailsForm user={user} />
      {user.sso ? <DisplayNameForm user={user} /> : null}
      <UserContactDetailsForm user={user} />
      {!user.sso && (
        <>
          <Card className="my-0">
            <div className="mb-6">
              <h3 className="text-text-lg font-semibold">Password</h3>
              <p className="text-sm text-gray-600">
                Update your password here.
              </p>
            </div>
            <div>
              <p>Need to reset your password?</p>
              <p>
                Click below to start the reset process. You'll be logged out and
                redirected to our password reset page.
              </p>
            </div>
            <PasswordResetForm />
          </Card>
          <Card className="my-0">
            <h3 className="text-text-lg font-semibold">Delete account</h3>
            <p className="text-sm text-gray-600">
              Send a request to delete your account.
            </p>
            <RequestDeleteUser />
          </Card>
        </>
      )}
    </div>
  );
}
