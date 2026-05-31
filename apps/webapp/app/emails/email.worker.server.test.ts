// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { triggerEmail } from "./email.worker.server";

// why: vi.mock is hoisted so the factory must not reference block-scoped vars;
// vi.hoisted() runs at hoist time and returns a stable reference.
const mockSend = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("~/emails/transporter.server", () => ({
  relayClient: { send: mockSend },
}));

// why: env vars are not available in test environment
vi.mock("../utils/env", () => ({
  SMTP_FROM: "test@shelf.nu",
  SUPPORT_EMAIL: "support@shelf.nu",
}));

// why: scheduler is not needed for triggerEmail unit tests
vi.mock("~/utils/scheduler.server", () => ({
  QueueNames: { emailQueue: "email" },
  scheduler: { work: vi.fn() },
}));

const basePayload = {
  subject: "Test Subject",
  text: "Test body",
  html: "<p>Test</p>",
};

describe("triggerEmail", () => {
  it("skips sending email to soft-deleted users", async () => {
    await triggerEmail({
      ...basePayload,
      to: "deleted+abc123@deleted.shelf.nu",
    });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends email to normal addresses", async () => {
    mockSend.mockClear();
    await triggerEmail({
      ...basePayload,
      to: "user@example.com",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
  });
});
