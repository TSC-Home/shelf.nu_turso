import { describe, expect, it } from "vitest";

import {
  resolveLabelBrandingText,
  resolveShowShelfBranding,
} from "~/utils/branding";

describe("resolveShowShelfBranding", () => {
  it("returns the override when it is explicitly provided", () => {
    expect(resolveShowShelfBranding(true, false)).toBe(true);
    expect(resolveShowShelfBranding(false, true)).toBe(false);
  });

  it("falls back to the organization default when override is undefined", () => {
    expect(resolveShowShelfBranding(undefined, false)).toBe(false);
    expect(resolveShowShelfBranding(undefined, true)).toBe(true);
  });

  it("defaults to true when both override and organization default are undefined", () => {
    expect(resolveShowShelfBranding(undefined, undefined)).toBe(true);
  });
});

describe("resolveLabelBrandingText", () => {
  it("returns custom text when labelBrandingText is set", () => {
    expect(resolveLabelBrandingText("Powered by AcmeCorp", true)).toBe(
      "Powered by AcmeCorp"
    );
    expect(resolveLabelBrandingText("Powered by AcmeCorp", false)).toBe(
      "Powered by AcmeCorp"
    );
  });

  it("falls back to shelf.nu text when showShelfBranding is true and no custom text", () => {
    expect(resolveLabelBrandingText(null, true)).toBe("Powered by shelf.nu");
    expect(resolveLabelBrandingText(undefined, true)).toBe(
      "Powered by shelf.nu"
    );
  });

  it("returns null when no custom text and showShelfBranding is false", () => {
    expect(resolveLabelBrandingText(null, false)).toBeNull();
    expect(resolveLabelBrandingText(undefined, false)).toBeNull();
    expect(resolveLabelBrandingText("", false)).toBeNull();
  });

  it("returns null when everything is undefined", () => {
    expect(resolveLabelBrandingText()).toBeNull();
  });
});
