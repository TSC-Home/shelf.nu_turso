// Addon trial workers removed in self-hosted fork (no Stripe/trials).
// why: returns a resolved Promise so call sites can safely chain .then()/.catch()
export function registerAddonTrialWorkers(): Promise<void> {
  return Promise.resolve();
}
