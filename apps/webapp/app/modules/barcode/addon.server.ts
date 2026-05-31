// Barcode addon (Stripe) removed in self-hosted fork — all features always enabled.

export function createBarcodeAddonCheckoutSession() {
  return Promise.resolve(null);
}
export function createBarcodeAddonTrialSubscription() {
  return Promise.resolve(null);
}
export function getBarcodeAddonPrices() {
  return Promise.resolve([]);
}
export function linkBarcodeAddonToOrganization() {
  return Promise.resolve();
}
export function getBarcodeSubscriptionInfo() {
  return Promise.resolve({ hasAddon: true, isActive: true });
}
export function handleBarcodeAddonWebhook() {
  return Promise.resolve();
}
