import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import { data, redirect, useActionData, useLoaderData } from "react-router";
import { useZorm } from "react-zorm";
import { z } from "zod";
import { Form } from "~/components/custom-form";
import PasswordInput from "~/components/forms/password-input";
import { Button } from "~/components/shared/button";
import { useDisabled } from "~/hooks/use-disabled";
import {
  updateAccountPassword,
  verifyResetToken,
} from "~/modules/auth/service.server";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { makeShelfError, ShelfError } from "~/utils/error";
import {
  payload,
  error,
  getCurrentSearchParams,
  parseData,
  readFormData,
} from "~/utils/http.server";

const ResetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z
      .string()
      .min(8, "Password must be at least 8 characters."),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

export function loader({ context, request }: LoaderFunctionArgs) {
  if (context.isAuthenticated) {
    return redirect("/assets");
  }

  const searchParams = getCurrentSearchParams(request);
  const token = searchParams.get("token") ?? "";

  if (!token) {
    return redirect("/forgot-password");
  }

  const payload_ = verifyResetToken(token);

  if (!payload_) {
    return data(
      payload({
        title: "Invalid or expired link",
        valid: false as const,
        token: "",
      })
    );
  }

  return data(
    payload({ title: "Reset your password", valid: true as const, token })
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  try {
    const { token, password } = parseData(
      await readFormData(request),
      ResetPasswordSchema,
      { shouldBeCaptured: false }
    );

    const tokenPayload = verifyResetToken(token);

    if (!tokenPayload) {
      throw new ShelfError({
        cause: null,
        message:
          "Reset link is invalid or has expired. Please request a new one.",
        label: "Auth",
        shouldBeCaptured: false,
      });
    }

    await updateAccountPassword(tokenPayload.userId, password, true);

    context.destroySession();
    return redirect("/login?password_reset=true");
  } catch (cause) {
    const reason = makeShelfError(cause);
    return data(error(reason), { status: reason.status });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.title) : "" },
];

export default function ResetPassword() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const zo = useZorm("ResetPasswordForm", ResetPasswordSchema);
  const disabled = useDisabled();

  if (!loaderData.valid) {
    return (
      <div className="flex min-h-full flex-col justify-center">
        <div className="mx-auto w-full text-center">
          <p className="mb-4 text-red-600">
            This password reset link is invalid or has expired.
          </p>
          <Button to="/forgot-password">Request a new link</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col justify-center">
      <div className="mx-auto w-full">
        <p className="mb-4 text-center">Enter your new password below.</p>
        <Form ref={zo.ref} method="post" className="space-y-2">
          <input
            type="hidden"
            name={zo.fields.token()}
            value={loaderData.token}
          />
          <PasswordInput
            label="New password"
            name={zo.fields.password()}
            autoComplete="new-password"
            disabled={disabled}
            error={zo.errors.password()?.message}
            placeholder="••••••••"
            required
          />
          <PasswordInput
            label="Confirm new password"
            name={zo.fields.confirmPassword()}
            autoComplete="new-password"
            disabled={disabled}
            error={
              zo.errors.confirmPassword()?.message || actionData?.error?.message
            }
            placeholder="••••••••"
            required
          />
          <Button width="full" type="submit" disabled={disabled}>
            {!disabled ? "Set new password" : "Saving…"}
          </Button>
        </Form>
        <div className="pt-4 text-center">
          <Button variant="link" to="/login">
            Back to login
          </Button>
        </div>
      </div>
    </div>
  );
}
