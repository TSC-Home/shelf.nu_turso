// Audit addon (Stripe) removed in self-hosted fork — all features always enabled.

export function createAuditAddonCheckoutSession() {
  return Promise.resolve(null);
}
export function createAuditAddonTrialSubscription() {
  return Promise.resolve(null);
}
export function getAuditAddonPrices() {
  return Promise.resolve([]);
}
export function linkAuditAddonToOrganization() {
  return Promise.resolve();
}
export function getAuditSubscriptionInfo() {
  return Promise.resolve({ hasAddon: true, isActive: true });
}
export function handleAuditAddonWebhook() {
  return Promise.resolve();
}
