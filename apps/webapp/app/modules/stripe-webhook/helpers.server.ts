/**
 * Stripe Webhook Helpers — Stub
 *
 * Stripe is not available in this self-hosted SQLite fork.
 * All exports are no-ops kept for import compatibility.
 */

import type { TierId } from "~/modules/tier/service.server";
import { ShelfError } from "~/utils/error";

/** The user shape returned by the webhook's initial DB query */
export type WebhookUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  tierId: TierId;
  warnForNoPaymentMethod: boolean;
};

export const subscriptionTiersPriority: Record<TierId, number> = {
  free: 0,
  plus: 1,
  team: 2,
  custom: 3,
};

export function isAddonSubscription(_args: unknown): boolean {
  return false;
}

export function isHigherTier(_newTier: TierId, _currentTier: TierId): boolean {
  return false;
}

export function isHigherOrEqualTier(
  _newTier: TierId,
  _currentTier: TierId
): boolean {
  return false;
}

export function sendAdminInvoiceEmail(_args: unknown): Promise<void> {
  return Promise.resolve();
}

/** Always throws — Stripe webhooks are disabled in this fork. */
export function constructVerifiedWebhookEvent(_request: Request): never {
  throw new ShelfError({
    cause: null,
    message: "Stripe webhooks are disabled in this self-hosted fork.",
    label: "Stripe webhook",
    status: 404,
    shouldBeCaptured: false,
  });
}

/** Sentinel error class kept for instanceof checks in the route. */
export class PaymentMethodWithoutCustomerResponse extends Error {}
