import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, evaluateReply, type ParsedReply, type POSnapshot } from "./reply";

const po: POSnapshot = {
  status: "sent",
  expectedAt: new Date("2026-10-01T00:00:00Z"),
  lines: [
    { supplierSku: "ACME-100", title: "Acme Widget Blue", qtyOrdered: 50, unitCost: 10 },
    { supplierSku: "ACME-200", title: "Acme Widget Red", qtyOrdered: 20, unitCost: 12 },
  ],
};

const reply = (over: Partial<ParsedReply> = {}): ParsedReply => ({
  intent: "confirmation",
  expectedAt: null,
  lines: [],
  summary: "",
  ...over,
});

describe("evaluateReply", () => {
  it("confirms a clean reply without bothering the merchant", () => {
    const r = evaluateReply(po, reply({ expectedAt: "2026-10-02T00:00:00Z" }));
    expect(r.escalations).toHaveLength(0);
    expect(r.nextStatus).toBe("confirmed");
    expect(r.autoApplied).toBe(true);
    expect(r.expectedAt?.toISOString()).toBe("2026-10-02T00:00:00.000Z");
  });

  it("escalates a price change beyond tolerance and does not confirm", () => {
    const r = evaluateReply(
      po,
      reply({ lines: [{ supplierSku: "ACME-100", title: null, qtyConfirmed: 50, unitCost: 12, unavailable: false }] }),
    );
    expect(r.escalations.map((e) => e.kind)).toContain("price_change");
    expect(r.nextStatus).toBe("sent");
    expect(r.autoApplied).toBe(false);
  });

  it("ignores a price change inside tolerance", () => {
    const r = evaluateReply(
      po,
      reply({ lines: [{ supplierSku: "ACME-100", title: null, qtyConfirmed: 50, unitCost: 10.3, unavailable: false }] }),
    );
    expect(r.escalations).toHaveLength(0);
    expect(r.nextStatus).toBe("confirmed");
  });

  it("escalates an ETA that slips past the threshold", () => {
    const r = evaluateReply(po, reply({ intent: "eta_update", expectedAt: "2026-11-01T00:00:00Z" }));
    expect(r.escalations.map((e) => e.kind)).toContain("eta_slip");
    // The date is still recorded even though a human must see it.
    expect(r.expectedAt?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("does not escalate an ETA that moves earlier", () => {
    const r = evaluateReply(po, reply({ intent: "eta_update", expectedAt: "2026-09-20T00:00:00Z" }));
    expect(r.escalations).toHaveLength(0);
  });

  it("escalates unavailable items and short quantities", () => {
    const r = evaluateReply(
      po,
      reply({
        lines: [
          { supplierSku: "ACME-100", title: null, qtyConfirmed: null, unitCost: null, unavailable: true },
          { supplierSku: "ACME-200", title: null, qtyConfirmed: 5, unitCost: null, unavailable: false },
        ],
      }),
    );
    const kinds = r.escalations.map((e) => e.kind);
    expect(kinds).toContain("item_unavailable");
    expect(kinds).toContain("quantity_short");
  });

  it("matches lines by title when the supplier omits a SKU", () => {
    const r = evaluateReply(
      po,
      reply({ lines: [{ supplierSku: null, title: "Acme Widget Red", qtyConfirmed: 2, unitCost: null, unavailable: false }] }),
    );
    expect(r.escalations.map((e) => e.kind)).toContain("quantity_short");
  });

  it("flags a supplier question for a human", () => {
    const r = evaluateReply(po, reply({ intent: "question", summary: "Do you want the 12-pack?" }));
    expect(r.escalations.map((e) => e.kind)).toContain("needs_reply");
    expect(r.autoApplied).toBe(false);
  });

  it("does nothing at all with an unrelated message", () => {
    const r = evaluateReply(po, reply({ intent: "unrelated", expectedAt: "2026-12-01T00:00:00Z" }));
    expect(r.escalations).toHaveLength(0);
    expect(r.expectedAt).toEqual(po.expectedAt);
    expect(r.nextStatus).toBe("sent");
  });

  it("ignores an unparseable date rather than throwing", () => {
    const r = evaluateReply(po, reply({ expectedAt: "next Tuesday-ish" }));
    expect(r.expectedAt).toEqual(po.expectedAt);
  });

  it("never advances a PO that is already received", () => {
    const r = evaluateReply({ ...po, status: "received" }, reply());
    expect(r.nextStatus).toBe("received");
  });

  it("respects a stricter policy", () => {
    const r = evaluateReply(
      po,
      reply({ lines: [{ supplierSku: "ACME-100", title: null, qtyConfirmed: 50, unitCost: 10.3, unavailable: false }] }),
      { ...DEFAULT_POLICY, priceTolerance: 0.01 },
    );
    expect(r.escalations.map((e) => e.kind)).toContain("price_change");
  });
});
