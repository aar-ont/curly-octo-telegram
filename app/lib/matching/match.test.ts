import { describe, expect, it } from "vitest";
import { matchItems, similarity, skuKey, skuLooseKey, titleSimilarity, type VariantCandidate } from "./match";

const catalog: VariantCandidate[] = [
  { variantId: "gid://shopify/ProductVariant/1", sku: "ACME-100", title: "Acme Widget - Blue" },
  { variantId: "gid://shopify/ProductVariant/2", sku: "ACME-200", title: "Acme Widget - Red" },
  { variantId: "gid://shopify/ProductVariant/3", sku: null, title: "Hand Cream 50ml Lavender" },
];

describe("sku normalisation", () => {
  it("is case and whitespace insensitive", () => {
    expect(skuKey(" acme-100 ")).toBe("ACME-100");
  });
  it("strips punctuation only in the loose form", () => {
    expect(skuLooseKey("acme-100")).toBe("ACME100");
    expect(skuKey("acme-100")).not.toBe(skuLooseKey("acme-100"));
  });
});

describe("similarity", () => {
  it("is 1 for identical strings and 0 for total mismatch", () => {
    expect(similarity("abc", "abc")).toBe(1);
    expect(similarity("abc", "xyz")).toBe(0);
  });
  it("rates reordered titles highly", () => {
    expect(titleSimilarity("Blue Cotton Shirt", "Cotton Shirt Blue")).toBeGreaterThan(0.72);
  });
  it("separates variants that differ only by size", () => {
    const small = titleSimilarity("Small Blue Shirt", "Small Blue Shirt");
    const large = titleSimilarity("Small Blue Shirt", "Large Blue Shirt");
    expect(small).toBeGreaterThan(large);
  });
});

describe("matchItems", () => {
  it("matches an exact SKU with full confidence", () => {
    const [r] = matchItems([{ supplierSku: "ACME-100", title: "whatever" }], catalog);
    expect(r.confidence).toBe("exact");
    expect(r.variantId).toBe("gid://shopify/ProductVariant/1");
  });

  it("matches a punctuation-different SKU as likely, not exact", () => {
    const [r] = matchItems([{ supplierSku: "acme 100", title: null }], catalog);
    expect(r.confidence).toBe("likely");
    expect(r.variantId).toBe("gid://shopify/ProductVariant/1");
  });

  it("refuses to guess when a SKU is ambiguous", () => {
    const dupes: VariantCandidate[] = [
      { variantId: "a", sku: "DUP-1", title: "One" },
      { variantId: "b", sku: "dup-1", title: "Two" },
    ];
    const [r] = matchItems([{ supplierSku: "DUP-1", title: "One" }], dupes);
    expect(r.confidence).toBe("none");
    expect(r.variantId).toBeNull();
    expect(r.reason).toMatch(/matches 2 variants/);
  });

  it("falls back to title when there is no SKU", () => {
    const [r] = matchItems([{ supplierSku: null, title: "Hand Cream Lavender 50ml" }], catalog);
    expect(r.confidence).toBe("likely");
    expect(r.variantId).toBe("gid://shopify/ProductVariant/3");
  });

  it("returns none rather than a bad guess for unknown items", () => {
    const [r] = matchItems([{ supplierSku: "NOPE-1", title: "Completely Unrelated Thing" }], catalog);
    expect(r.confidence).toBe("none");
    expect(r.variantId).toBeNull();
  });

  it("refuses near-ties on title", () => {
    const [r] = matchItems([{ supplierSku: null, title: "Acme Widget" }], catalog);
    expect(r.confidence).toBe("none");
    expect(r.reason).toMatch(/equally well/);
  });

  it("handles an empty catalogue without throwing", () => {
    const [r] = matchItems([{ supplierSku: "X", title: "Y" }], []);
    expect(r.confidence).toBe("none");
  });
});
