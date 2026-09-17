/**
 * Cleanup applied to extraction output before a merchant sees it.
 *
 * Pure, so it can be tested without an API key, and conservative: it merges
 * obvious duplicates and drops values that cannot be true, but never fills a
 * gap with a guess. Whatever survives here still goes to the review screen.
 */

import type { ExtractedItem, ExtractedSupplier, ExtractionResult } from "./schema";

function clean(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : null;
}

export function supplierKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "");
}

function normalizeItem(item: ExtractedItem): ExtractedItem | null {
  const supplierSku = clean(item.supplierSku);
  const title = clean(item.title);

  // With neither an identifier nor a description there is nothing to review.
  if (!supplierSku && !title) return null;

  return {
    supplierSku,
    title,
    // A negative or zero cost is a misread, not a price. Null asks the merchant.
    unitCost: item.unitCost !== null && item.unitCost > 0 ? item.unitCost : null,
    moq: item.moq !== null && item.moq >= 1 ? Math.floor(item.moq) : null,
  };
}

function mergeSuppliers(a: ExtractedSupplier, b: ExtractedSupplier): ExtractedSupplier {
  return {
    // Keep the longer name: "Acme Supplies Ltd" over "Acme".
    name: a.name.length >= b.name.length ? a.name : b.name,
    email: a.email ?? b.email,
    phone: a.phone ?? b.phone,
    address: a.address ?? b.address,
    leadTimeDays: a.leadTimeDays ?? b.leadTimeDays,
    items: [...a.items, ...b.items],
  };
}

function dedupeItems(items: ExtractedItem[]): ExtractedItem[] {
  const seen = new Map<string, ExtractedItem>();
  for (const item of items) {
    const key = (item.supplierSku ?? item.title ?? "").toLowerCase();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }
    // Same item across two documents: prefer the one with a price.
    seen.set(key, {
      supplierSku: existing.supplierSku ?? item.supplierSku,
      title: existing.title ?? item.title,
      unitCost: existing.unitCost ?? item.unitCost,
      moq: existing.moq ?? item.moq,
    });
  }
  return [...seen.values()];
}

export function normalizeExtraction(result: ExtractionResult): ExtractionResult {
  const merged = new Map<string, ExtractedSupplier>();

  for (const raw of result.suppliers) {
    const name = clean(raw.name);
    if (!name) continue;

    const supplier: ExtractedSupplier = {
      name,
      email: clean(raw.email)?.toLowerCase() ?? null,
      phone: clean(raw.phone),
      address: clean(raw.address),
      leadTimeDays: raw.leadTimeDays !== null && raw.leadTimeDays > 0 ? Math.floor(raw.leadTimeDays) : null,
      items: raw.items.map(normalizeItem).filter((i): i is ExtractedItem => i !== null),
    };

    const key = supplierKey(name);
    const existing = merged.get(key);
    merged.set(key, existing ? mergeSuppliers(existing, supplier) : supplier);
  }

  return {
    suppliers: [...merged.values()].map((s) => ({ ...s, items: dedupeItems(s.items) })),
    notes: result.notes,
  };
}
