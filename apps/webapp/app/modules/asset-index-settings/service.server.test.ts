import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShelfError } from "~/utils/error";

vi.mock("~/database/db.server", () => ({
  db: {
    assetIndexSettings: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

const { db } = await import("~/database/db.server");
const { removeCustomFieldFromAssetIndexSettings } = await import(
  "./service.server"
);

describe("removeCustomFieldFromAssetIndexSettings", () => {
  beforeEach(() => {
    vi.mocked(db.assetIndexSettings.findMany).mockClear();
    vi.mocked(db.assetIndexSettings.update).mockClear();
  });

  it("removes the custom field column for all organization settings", async () => {
    const existingColumns = [
      { name: "cf_Condition", visible: true, position: 5, cfType: "TEXT" },
      { name: "name", visible: true, position: 0 },
    ];

    vi.mocked(db.assetIndexSettings.findMany).mockResolvedValueOnce([
      // why: simulate one settings row that contains cf_Condition
      { id: "settings-1", columns: existingColumns } as any,
    ]);

    await removeCustomFieldFromAssetIndexSettings({
      customFieldName: "Condition",
      organizationId: "org-123",
    });

    expect(vi.mocked(db.assetIndexSettings.findMany)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.assetIndexSettings.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-123" } })
    );

    expect(vi.mocked(db.assetIndexSettings.update)).toHaveBeenCalledTimes(1);
    const updateCall = vi.mocked(db.assetIndexSettings.update).mock.calls[0][0];
    expect(updateCall.data.columns).toEqual([
      { name: "name", visible: true, position: 0 },
    ]);
  });

  it("skips update when no settings contain the column", async () => {
    vi.mocked(db.assetIndexSettings.findMany).mockResolvedValueOnce([
      {
        id: "settings-1",
        columns: [{ name: "name", visible: true, position: 0 }],
      } as any,
    ]);

    await removeCustomFieldFromAssetIndexSettings({
      customFieldName: "Condition",
      organizationId: "org-123",
    });

    expect(vi.mocked(db.assetIndexSettings.update)).not.toHaveBeenCalled();
  });

  it("wraps database errors in a ShelfError", async () => {
    vi.mocked(db.assetIndexSettings.findMany).mockRejectedValueOnce(
      new Error("boom")
    );

    await expect(
      removeCustomFieldFromAssetIndexSettings({
        customFieldName: "Condition",
        organizationId: "org-123",
      })
    ).rejects.toBeInstanceOf(ShelfError);
  });
});
