/**
 * Stripe Webhook Handlers — Stub
 *
 * Stripe is not available in this self-hosted SQLite fork.
 * All handlers return 200 immediately and are kept only for import compatibility.
 */

import type { WebhookUser } from "./helpers.server";

const OK = () => new Response(null, { status: 200 });

export function handleCheckoutCompleted(
  _event: unknown,
  _user: WebhookUser
): Promise<Response> {
  return Promise.resolve(OK());
}

export function handleSubscriptionCreated(
  _event: unknown,
  _user: WebhookUser
): Promise<Response> {
  return Promise.resolve(OK());
}

export function handleSubscriptionPaused(
  _event: unknown,
  _user: WebhookUser
): Promise<Response> {
  return Promise.resolve(OK());
}

export function handleSubscriptionUpdated(
  _event: unknown,
  _user: WebhookUser
): Promise<Response> {
  return Promise.resolve(OK());
}

export function handleSubscriptionDeleted(
  _event: unknown,
  _user: WebhookUser
): Promise<Response> {
  return Promise.resolve(OK());
}

export function handleInvoicePaymentFailed(
  _event: unknown,
  _user: WebhookUser,
  _customerId: string
): Promise<Response> {
  return Promise.resolve(OK());
}

export function handleInvoicePaid(
  _event: unknown,
  _user: WebhookUser,
  _customerId: string
): Promise<Response> {
  return Promise.resolve(OK());
}

export function handleInvoiceResolved(
  _event: unknown,
  _user: WebhookUser,
  _customerId: string
): Promise<Response> {
  return Promise.resolve(OK());
}

export function handleInvoiceOverdue(
  _event: unknown,
  _user: WebhookUser,
  _customerId: string
): Promise<Response> {
  return Promise.resolve(OK());
}

export function handleTrialWillEnd(
  _event: unknown,
  _user: WebhookUser
): Promise<Response> {
  return Promise.resolve(OK());
}

export function handlePaymentMethodAttached(
  _event: unknown,
  _user: WebhookUser,
  _customerId: string
): Promise<Response> {
  return Promise.resolve(OK());
}

export function handlePaymentMethodDetached(
  _event: unknown,
  _user: WebhookUser,
  _customerId: string
): Promise<Response> {
  return Promise.resolve(OK());
}
