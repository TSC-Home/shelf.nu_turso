/**
 * Hook to check if barcodes are enabled for the current organization.
 * In the self-hosted SQLite fork, barcodes are always enabled.
 */
export function useBarcodePermissions() {
  return {
    barcodesEnabled: true,
    canUseBarcodes: true,
  };
}
