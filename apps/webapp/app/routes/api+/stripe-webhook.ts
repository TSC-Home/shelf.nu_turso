/**
 * Stripe Webhook Handler
 *
 * Enable these events in Stripe Dashboard → Developers → Webhooks:
 *
 * Checkout:
 *   - checkout.session.completed
 *
 * Subscriptions:
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.paused
 *   - customer.subscription.deleted
 *   - customer.subscription.trial_will_end
 *
 * Invoices:
 *   - invoice.paid
 *   - invoice.payment_failed
 *   - invoice.overdue
 *   - invoice.voided
 *   - invoice.marked_uncollectible
 *
 * Payment Methods:
 *   - payment_method.attached
 *   - payment_method.detached
 */

import type { ActionFunctionArgs } from "react-router";

/** Stripe webhooks are disabled in this self-hosted SQLite fork. */
export function action(_args: ActionFunctionArgs): Response {
  return new Response(null, { status: 404 });
}
