import { z } from "zod";

/**
 * What we try to recover from a merchant's old Stocky paperwork.
 *
 * Every field except the supplier name is nullable on purpose. The documents
 * are whatever survived — scanned POs, half-broken CSVs, forwarded emails — and
 * a null we surface for review is cheap, while an invented value that looks
 * plausible is expensive and destroys trust in the whole import.
 */

export const ExtractedItemSchema = z.object({
  supplierSku: z.string().nullable().describe("The supplier's own part number, exactly as printed"),
  title: z.string().nullable().describe("Product description as written on the document"),
  unitCost: z.number().nullable().describe("Cost per unit paid to the supplier, excluding tax"),
  moq: z.number().int().nullable().describe("Minimum order quantity, only if explicitly stated"),
});

export const ExtractedSupplierSchema = z.object({
  name: z.string().describe("Supplier or vendor business name"),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  leadTimeDays: z.number().int().nullable().describe("Only if the document states a lead time"),
  items: z.array(ExtractedItemSchema),
});

export const ExtractionResultSchema = z.object({
  suppliers: z.array(ExtractedSupplierSchema),
  notes: z
    .string()
    .describe("Anything unreadable, ambiguous, or deliberately skipped, so the merchant knows what to check"),
});

export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;
export type ExtractedSupplier = z.infer<typeof ExtractedSupplierSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/** Mirrors ParsedReply in app/lib/po/reply.ts. */
export const ParsedReplySchema = z.object({
  intent: z.enum(["confirmation", "eta_update", "backorder", "price_change", "substitution", "question", "unrelated"]),
  expectedAt: z.string().nullable().describe("Delivery date in YYYY-MM-DD form, or null if not stated"),
  lines: z.array(
    z.object({
      supplierSku: z.string().nullable(),
      title: z.string().nullable(),
      qtyConfirmed: z.number().int().nullable(),
      unitCost: z.number().nullable(),
      unavailable: z.boolean(),
    }),
  ),
  summary: z.string().describe("One sentence a merchant can read at a glance"),
});
