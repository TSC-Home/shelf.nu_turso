/**
 * Stripe stub — all Stripe/payment functionality has been removed in this
 * self-hosted SQLite fork. These exports are kept as no-ops so import sites
 * compile without changes.
 */

import type { Organization, User } from "@prisma/client";
import { config } from "~/config/shelf.config";

export const premiumIsEnabled = config.enablePremiumFeatures;

/** Stub — no Stripe client in self-hosted mode */
export const stripe = null as unknown as never;

export type StripeEvent = never;

export type CustomerWithSubscriptions = never;

export type OwnerSubscriptionInfo = {
  tier: null;
  trialEndsAt: null;
  customerId: null;
  hasActiveSubscription: false;
  subscriptions: never[];
};

export function getDomainUrl(request: Request) {
  const host =
    request.headers.get("X-Forwarded-Host") ?? request.headers.get("host");

  if (!host) {
    throw new Error("Could not determine domain URL.");
  }

  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export function createStripeCheckoutSession() {
  return Promise.resolve(null);
}

export function getStripePricesAndProducts() {
  return Promise.resolve({ prices: [], products: [] });
}

export function getStripePricesForTrialPlanSelection() {
  return Promise.resolve([]);
}

export function getOrCreateCustomerId() {
  return Promise.resolve(null);
}

export const createStripeCustomer = () => Promise.resolve(null);

export const getStripeCustomer = () => Promise.resolve(null);

export const getCustomerSubscriptionsWithProducts = () => Promise.resolve(null);

export function createBillingPortalSession() {
  return Promise.resolve(null);
}

export function getCustomerPaidSubscription() {
  return null;
}

export function getCustomerTrialSubscription() {
  return null;
}

export function getCustomerActiveSubscription() {
  return null;
}

export function fetchStripeSubscription() {
  return Promise.resolve(null);
}

export function getDataFromStripeEvent() {
  return Promise.resolve(null);
}

// why: stub accepts any args so call sites don't need updating
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const disabledTeamOrg = (_args: any) => Promise.resolve(false);

export function createTeamTrialSubscription() {
  return Promise.resolve(null);
}

export function customerHasPaymentMethod() {
  return false;
}

export function validateSubscriptionIsActive() {
  return true;
}

export function generateReturnUrl() {
  return Promise.resolve(null);
}

export function getCustomerOpenInvoices() {
  return Promise.resolve([]);
}

export function getCustomerPaidInvoices() {
  return Promise.resolve([]);
}

export function getCustomerUpcomingInvoices() {
  return Promise.resolve(null);
}

export function getOwnerSubscriptionInfo(): Promise<OwnerSubscriptionInfo> {
  return Promise.resolve({
    tier: null,
    trialEndsAt: null,
    customerId: null,
    hasActiveSubscription: false,
    subscriptions: [],
  });
}

export function getCustomerNotificationData() {
  return Promise.resolve(null);
}

export function getInvoiceNotificationData() {
  return Promise.resolve(null);
}
