import { describe, expect, it } from "vitest";
import { roundUpToMultiple, salesInWindow, suggestReorders, type SaleEvent, type StockLine } from "./velocity";

const now = new Date("2026-09-17T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

describe("salesInWindow", () => {
  it("excludes sales older than the window", () => {
    const sales: SaleEvent[] = [
      { variantId: "a", quantity: 5, occurredAt: daysAgo(10) },
      { variantId: "a", quantity: 7, occurredAt: daysAgo(40) },
    ];
    expect(salesInWindow(sales, now, 30).get("a")).toBe(5);
  });

  it("excludes sales dated in the future", () => {
    const sales: SaleEvent[] = [{ variantId: "a", quantity: 5, occurredAt: daysAgo(-3) }];
    expect(salesInWindow(sales, now, 30).get("a")).toBeUndefined();
  });
});

describe("roundUpToMultiple", () => {
  it("respects a minimum order quantity", () => {
    expect(roundUpToMultiple(13, 12)).toBe(24);
    expect(roundUpToMultiple(12, 12)).toBe(12);
  });
  it("still rounds up to whole units with no MOQ", () => {
    expect(roundUpToMultiple(4.2, 1)).toBe(5);
  });
});

describe("suggestReorders", () => {
  const stock: StockLine[] = [{ variantId: "a", onHand: 10, leadTimeDays: 14 }];
  const opts = { windowDays: 30, coverTargetDays: 14, now };

  it("flags an item that runs out inside the lead time", () => {
    // 60 units in 30 days = 2/day. 10 on hand = 5 days of cover, lead time 14.
    const sales: SaleEvent[] = [{ variantId: "a", quantity: 60, occurredAt: daysAgo(5) }];
    const [s] = suggestReorders(stock, sales, opts);
    expect(s.unitsPerDay).toBe(2);
    expect(s.daysOfCover).toBe(5);
    expect(s.needsReorder).toBe(true);
    // Needs 2/day * 28 days = 56, minus 10 on hand = 46.
    expect(s.suggestedQty).toBe(46);
  });

  it("does not flag an item with enough cover", () => {
    const sales: SaleEvent[] = [{ variantId: "a", quantity: 3, occurredAt: daysAgo(5) }];
    const [s] = suggestReorders([{ variantId: "a", onHand: 500, leadTimeDays: 14 }], sales, opts);
    expect(s.needsReorder).toBe(false);
    expect(s.suggestedQty).toBe(0);
  });

  it("never suggests reordering something with no sales", () => {
    const [s] = suggestReorders([{ variantId: "a", onHand: 0, leadTimeDays: 14 }], [], opts);
    expect(s.needsReorder).toBe(false);
    expect(s.daysOfCover).toBe(Infinity);
    expect(s.reason).toMatch(/No sales/);
  });

  it("counts stock already on order", () => {
    const sales: SaleEvent[] = [{ variantId: "a", quantity: 60, occurredAt: daysAgo(5) }];
    const [s] = suggestReorders([{ variantId: "a", onHand: 10, incoming: 100, leadTimeDays: 14 }], sales, opts);
    expect(s.needsReorder).toBe(false);
  });

  it("treats an oversold negative balance as zero, not as credit", () => {
    const sales: SaleEvent[] = [{ variantId: "a", quantity: 30, occurredAt: daysAgo(5) }];
    const [s] = suggestReorders([{ variantId: "a", onHand: -5, leadTimeDays: 7 }], sales, opts);
    expect(s.available).toBe(0);
    expect(s.needsReorder).toBe(true);
  });

  it("does not read returns as negative demand", () => {
    const sales: SaleEvent[] = [
      { variantId: "a", quantity: 2, occurredAt: daysAgo(3) },
      { variantId: "a", quantity: -5, occurredAt: daysAgo(2) },
    ];
    const [s] = suggestReorders(stock, sales, opts);
    expect(s.unitsPerDay).toBe(0);
    expect(s.needsReorder).toBe(false);
  });

  it("rounds the suggestion up to the supplier's MOQ", () => {
    const sales: SaleEvent[] = [{ variantId: "a", quantity: 60, occurredAt: daysAgo(5) }];
    const [s] = suggestReorders([{ variantId: "a", onHand: 10, leadTimeDays: 14, moq: 12 }], sales, opts);
    expect(s.suggestedQty).toBe(48); // 46 rounded up to a multiple of 12
  });

  it("rejects a nonsensical window", () => {
    expect(() => suggestReorders(stock, [], { ...opts, windowDays: 0 })).toThrow(/windowDays/);
  });
});
