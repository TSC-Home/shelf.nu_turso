/**
 * Resolves whether Shelf branding should be displayed on labels.
 *
 * @param override - Explicit preference coming from the current render context.
 * @param organizationDefault - The stored organization preference, if available.
 * @returns `true` when branding should be shown, defaulting to `true` when no
 * preference is provided.
 */
export const resolveShowShelfBranding = (
  override?: boolean,
  organizationDefault?: boolean
): boolean => {
  if (typeof override === "boolean") {
    return override;
  }

  if (typeof organizationDefault === "boolean") {
    return organizationDefault;
  }

  return true;
};

/**
 * Resolves the label branding text shown at the bottom of QR/barcode labels.
 *
 * Priority:
 * 1. `labelBrandingText` — custom text configured per workspace (completely replaces default)
 * 2. "Powered by shelf.nu" — shown when `showShelfBranding` is true and no custom text is set
 * 3. `null` — nothing is rendered
 *
 * @param labelBrandingText - Custom branding text from workspace settings.
 * @param showShelfBranding - Whether the default Shelf branding should show as fallback.
 * @returns The text to display, or `null` if nothing should be shown.
 */
export function resolveLabelBrandingText(
  labelBrandingText?: string | null,
  showShelfBranding?: boolean
): string | null {
  if (labelBrandingText) return labelBrandingText;
  if (showShelfBranding) return "Powered by shelf.nu";
  return null;
}
