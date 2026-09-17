import { describe, expect, it } from "vitest";
import { normalizeExtraction, supplierKey } from "./normalize";
import type { ExtractionResult } from "./schema";

const result = (suppliers: ExtractionResult["suppliers"]): ExtractionResult => ({ suppliers, notes: "" });

describe("supplierKey", () => {
  it("ignores case, spacing and trailing punctuation", () => {
    expect(supplierKey("Acme Supplies Ltd.")).toBe(supplierKey("acme  supplies ltd"));
  });
});

describe("normalizeExtraction", () => {
  it("merges the same supplier seen across documents, keeping the fuller record", () => {
    const out = normalizeExtraction(
      result([
        { name: "Acme", email: null, phone: "555", address: null, leadTimeDays: null, items: [] },
        { name: "acme.", email: "sales@acme.com", phone: null, address: "1 Road", leadTimeDays: 7, items: [] },
      ]),
    );
    expect(out.suppliers).toHaveLength(1);
    expect(out.suppliers[0]).toMatchObject({
      email: "sales@acme.com",
      phone: "555",
      address: "1 Road",
      leadTimeDays: 7,
    });
  });

  it("drops items with neither a SKU nor a title", () => {
    const out = normalizeExtraction(
      result([
        {
          name: "Acme",
          email: null,
          phone: null,
          address: null,
          leadTimeDays: null,
          items: [
            { supplierSku: null, title: null, unitCost: 5, moq: null },
            { supplierSku: "A-1", title: null, unitCost: 5, moq: null },
          ],
        },
      ]),
    );
    expect(out.suppliers[0].items).toHaveLength(1);
    expect(out.suppliers[0].items[0].supplierSku).toBe("A-1");
  });

  it("nulls impossible costs rather than keeping them", () => {
    const out = normalizeExtraction(
      result([
        {
          name: "Acme",
          email: null,
          phone: null,
          address: null,
          leadTimeDays: null,
          items: [{ supplierSku: "A-1", title: null, unitCost: -3, moq: 0 }],
        },
      ]),
    );
    expect(out.suppliers[0].items[0].unitCost).toBeNull();
    expect(out.suppliers[0].items[0].moq).toBeNull();
  });

  it("dedupes the same SKU across documents and keeps the known price", () => {
    const out = normalizeExtraction(
      result([
        {
          name: "Acme",
          email: null,
          phone: null,
          address: null,
          leadTimeDays: null,
          items: [
            { supplierSku: "A-1", title: "Widget", unitCost: null, moq: null },
            { supplierSku: "a-1", title: null, unitCost: 9.5, moq: 6 },
          ],
        },
      ]),
    );
    expect(out.suppliers[0].items).toHaveLength(1);
    expect(out.suppliers[0].items[0]).toMatchObject({ title: "Widget", unitCost: 9.5, moq: 6 });
  });

  it("discards a supplier with no usable name", () => {
    const out = normalizeExtraction(
      result([{ name: "   ", email: null, phone: null, address: null, leadTimeDays: null, items: [] }]),
    );
    expect(out.suppliers).toHaveLength(0);
  });

  it("preserves the model's notes for the merchant", () => {
    const out = normalizeExtraction({ suppliers: [], notes: "Page 3 was too faint to read." });
    expect(out.notes).toBe("Page 3 was too faint to read.");
  });
});
