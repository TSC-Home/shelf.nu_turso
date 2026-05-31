import { relayClient } from "~/emails/transporter.server";
import { ShelfError } from "~/utils/error";
import { Logger } from "~/utils/logger";
import { QueueNames, scheduler } from "~/utils/scheduler.server";
import type { EmailPayloadType } from "./types";

/** Domain used for soft-deleted user email addresses */
export const SOFT_DELETED_EMAIL_DOMAIN = "@deleted.shelf.nu";

export const registerEmailWorkers = async () => {
  await scheduler.work<EmailPayloadType>(
    QueueNames.emailQueue,
    { teamSize: 5 },
    async (job) => {
      try {
        await triggerEmail(job.data);
      } catch (cause) {
        Logger.error(
          new ShelfError({
            cause,
            message: "Email failed",
            additionalData: { payload: job.data },
            label: "Email",
          })
        );
        throw cause;
      }
    }
  );
};

export const triggerEmail = async ({
  to,
  subject,
  text,
  html,
}: EmailPayloadType) => {
  if (to.endsWith(SOFT_DELETED_EMAIL_DOMAIN)) {
    Logger.warn(
      `Skipping email to soft-deleted user: ${to} (subject: ${subject})`
    );
    return;
  }

  try {
    await relayClient.send({
      to,
      subject,
      content: html || text,
      isHtml: !!html,
    });
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Unable to send email",
      additionalData: { to, subject },
      label: "Email",
    });
  }
};
