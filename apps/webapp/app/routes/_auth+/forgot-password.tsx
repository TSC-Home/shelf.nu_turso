import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import { data, redirect, useActionData } from "react-router";
import { useZorm } from "react-zorm";
import { z } from "zod";
import { Form } from "~/components/custom-form";
import Input from "~/components/forms/input";
import { Button } from "~/components/shared/button";
import { useDisabled } from "~/hooks/use-disabled";
import { sendResetPasswordLink } from "~/modules/auth/service.server";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { makeShelfError, ShelfError } from "~/utils/error";
import {
  payload,
  error,
  getCurrentSearchParams,
  parseData,
  readFormData,
} from "~/utils/http.server";
import { validEmail } from "~/utils/misc";

const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .transform((email) => email.toLowerCase())
    .refine(validEmail, () => ({
      message: "Please enter a valid email",
    })),
});

export function loader({ context, request }: LoaderFunctionArgs) {
  const searchParams = getCurrentSearchParams(request);
  const sent = searchParams.has("sent");

  const title = "Forgot password?";
  const subHeading = sent
    ? "Check your email for the reset link."
    : "Enter your email address and we'll send you a reset link.";

  if (context.isAuthenticated) {
    return redirect("/assets");
  }

  return data(payload({ title, subHeading, sent }));
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { email } = parseData(
      await readFormData(request),
      ForgotPasswordSchema,
      { shouldBeCaptured: false }
    );

    // sendResetPasswordLink silently succeeds even when email is not found
    // to prevent user enumeration
    await sendResetPasswordLink(email);

    return redirect("/forgot-password?sent=true");
  } catch (cause) {
    const reason = makeShelfError(cause);
    return data(error(reason), { status: reason.status });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.title) : "" },
];

export default function ForgotPassword() {
  const zo = useZorm("ForgotPasswordForm", ForgotPasswordSchema);
  const actionData = useActionData<typeof action>();
  const disabled = useDisabled();

  const emailError =
    zo.errors.email()?.message || actionData?.error?.message || "";

  return (
    <div className="flex min-h-full flex-col justify-center">
      <div className="mx-auto w-full">
        <p className="mb-4 text-center">
          Enter your email and we&apos;ll send you a link to reset your
          password. The link expires in 15 minutes.
        </p>
        <Form ref={zo.ref} method="post" className="space-y-2" replace>
          <Input
            label="Email address"
            data-test-id="email"
            name={zo.fields.email()}
            type="email"
            autoComplete="email"
            inputClassName="w-full"
            placeholder="zaans@huisje.com"
            disabled={disabled}
            error={emailError}
          />
          <Button
            data-test-id="send-password-reset-link"
            width="full"
            type="submit"
            disabled={disabled}
          >
            {!disabled ? "Send reset link" : "Sending…"}
          </Button>
        </Form>
        <p className="mt-2 text-center text-gray-500">
          Tip: Check your spam folder if you don&apos;t see the email within a
          few minutes.
        </p>
        <div className="pt-4 text-center">
          <Button variant="link" to={"/login"}>
            Back to login
          </Button>
        </div>
      </div>
    </div>
  );
}
