/**
 * Scheduler — node-cron + ScheduledJob DB polling
 *
 * Replaces pg-boss with a lightweight in-process scheduler that stores
 * pending jobs in the `ScheduledJob` table and polls every minute via
 * node-cron. The public API mirrors the subset of pg-boss used in this
 * codebase so call sites don't need to change.
 *
 * Job states: pending → completed | failed (max 3 attempts).
 */

import cron from "node-cron";
import { db } from "~/database/db.server";
import { Logger } from "./logger";

export enum QueueNames {
  emailQueue = "email-queue",
  bookingQueue = "booking-queue",
  auditQueue = "audit-queue",
  assetsQueue = "assets-queue",
  addonTrialQueue = "addon-trial-queue",
}

type JobHandler<T = unknown> = (job: { data: T; id: string }) => Promise<void>;

/** In-memory registry of queue name → handler function. */
const handlers = new Map<string, JobHandler<unknown>>();

const MAX_ATTEMPTS = 3;

/** Drain all due pending jobs from the database. */
async function processDueJobs(): Promise<void> {
  const now = new Date();

  const jobs = await db.scheduledJob
    .findMany({
      where: {
        state: "pending",
        executeAt: { lte: now },
      },
      orderBy: { executeAt: "asc" },
      take: 50,
    })
    .catch(() => []);

  for (const job of jobs) {
    const handler = handlers.get(job.queue);

    if (!handler) {
      continue;
    }

    try {
      await handler({
        id: job.id,
        data: JSON.parse(job.payload) as unknown,
      });

      await db.scheduledJob
        .update({
          where: { id: job.id },
          data: { state: "completed" },
        })
        .catch(() => undefined);
    } catch (err) {
      const nextAttempts = job.attempts + 1;
      const nextState = nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending";
      const nextExecuteAt =
        nextState === "pending"
          ? new Date(now.getTime() + nextAttempts * 60_000)
          : now;

      await db.scheduledJob
        .update({
          where: { id: job.id },
          data: {
            attempts: nextAttempts,
            state: nextState,
            executeAt: nextExecuteAt,
          },
        })
        .catch(() => undefined);

      Logger.error(
        new Error(`Scheduler job ${job.id} (${job.queue}) failed: ${err}`)
      );
    }
  }
}

/** Start the cron poller. Call once at server startup. */
export const init = (): Promise<void> => {
  cron.schedule("* * * * *", () => {
    processDueJobs().catch((err) =>
      Logger.error(new Error(`Scheduler poll error: ${err}`))
    );
  });
  return Promise.resolve();
};

/**
 * Scheduler object with the same surface as the pg-boss subset used in this
 * app. Queue implementations call `scheduler.work` to register handlers;
 * service code calls `scheduler.send` / `scheduler.sendAfter` to enqueue.
 */
export const scheduler = {
  /** Enqueue a job for immediate execution. */
  async send<T>(queue: string, data: T): Promise<string> {
    const job = await db.scheduledJob.create({
      data: {
        queue,
        payload: JSON.stringify(data),
        executeAt: new Date(),
      },
      select: { id: true },
    });
    return job.id;
  },

  /**
   * Enqueue a job to run after a delay.
   *
   * @param queue - Target queue name
   * @param data - Job payload
   * @param _options - Ignored (pg-boss compat shim)
   * @param afterSeconds - Delay in seconds, or a Date to run at
   */
  async sendAfter<T>(
    queue: string,
    data: T,
    _options: Record<string, unknown>,
    afterSeconds: number | Date
  ): Promise<string> {
    const executeAt =
      afterSeconds instanceof Date
        ? afterSeconds
        : new Date(Date.now() + afterSeconds * 1000);

    const job = await db.scheduledJob.create({
      data: {
        queue,
        payload: JSON.stringify(data),
        executeAt,
      },
      select: { id: true },
    });
    return job.id;
  },

  /** Cancel a previously scheduled job by ID. */
  async cancel(jobId: string): Promise<void> {
    await db.scheduledJob
      .update({
        where: { id: jobId },
        data: { state: "cancelled" },
        select: { id: true },
      })
      .catch(() => {
        // Ignore if job not found — it may have already completed
      });
  },

  /** Register a handler for a queue. Call once at server startup. */
  work<T>(
    queue: string,
    _options: Record<string, unknown> | JobHandler<T>,
    handler?: JobHandler<T>
  ): Promise<void> {
    const fn =
      typeof _options === "function"
        ? (_options as JobHandler<T>)
        : (handler as JobHandler<T>);

    handlers.set(queue, fn as JobHandler<unknown>);
    return Promise.resolve();
  },
};
