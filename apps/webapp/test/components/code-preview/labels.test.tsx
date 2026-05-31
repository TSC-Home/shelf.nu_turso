import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("lottie-react", () => ({
  default: () => null,
}));

import { BarcodeLabel, QrLabel } from "~/components/code-preview/code-preview";

describe("QrLabel", () => {
  const baseProps = {
    title: "Camera",
    data: {
      qr: {
        id: "qr-123",
        src: "data:image/png;base64,AAA",
        size: "small",
      },
    },
  } as const;

  it("shows custom branding text when provided", () => {
    render(
      <QrLabel
        {...(baseProps as any)}
        labelBrandingText="Powered by AcmeCorp"
      />
    );

    expect(screen.getByText(/Powered by AcmeCorp/i)).toBeInTheDocument();
  });

  it("hides branding when no labelBrandingText is given", () => {
    render(<QrLabel {...(baseProps as any)} labelBrandingText={null} />);

    expect(screen.queryByText(/Powered by/i)).not.toBeInTheDocument();
  });
});

describe("BarcodeLabel", () => {
  const baseProps = {
    title: "Camera",
    data: {
      type: "EAN13",
      value: "1234567890123",
    },
  } as const;

  it("shows custom branding text when provided", () => {
    render(
      <BarcodeLabel
        {...(baseProps as any)}
        labelBrandingText="Powered by AcmeCorp"
      />
    );

    expect(screen.getByText(/Powered by AcmeCorp/i)).toBeInTheDocument();
  });

  it("hides branding when no labelBrandingText is given", () => {
    render(<BarcodeLabel {...(baseProps as any)} labelBrandingText={null} />);

    expect(screen.queryByText(/Powered by/i)).not.toBeInTheDocument();
  });
});
