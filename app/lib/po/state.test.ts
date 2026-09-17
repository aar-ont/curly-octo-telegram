import { describe, expect, it } from "vitest";
import { canTransition, deriveStatusFromReceipts, isTerminal, transition } from "./state";

describe("transitions", () => {
  it("allows the normal path", () => {
    expect(canTransition("draft", "sent")).toBe(true);
    expect(canTransition("sent", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "received")).toBe(true);
  });

  it("refuses to move backwards", () => {
    expect(canTransition("sent", "draft")).toBe(false);
    expect(() => transition("received", "sent")).toThrow(/Illegal/);
  });

  it("treats received and cancelled as terminal", () => {
    expect(isTerminal("received")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("sent")).toBe(false);
  });

  it("allows repeated partial receipts", () => {
    expect(canTransition("partial", "partial")).toBe(true);
  });
});

describe("deriveStatusFromReceipts", () => {
  it("marks fully received orders", () => {
    expect(deriveStatusFromReceipts("sent", [{ qtyOrdered: 5, qtyReceived: 5 }])).toBe("received");
  });

  it("marks partial receipts", () => {
    expect(
      deriveStatusFromReceipts("sent", [
        { qtyOrdered: 5, qtyReceived: 2 },
        { qtyOrdered: 3, qtyReceived: 0 },
      ]),
    ).toBe("partial");
  });

  it("counts an over-receipt as complete", () => {
    expect(deriveStatusFromReceipts("sent", [{ qtyOrdered: 5, qtyReceived: 7 }])).toBe("received");
  });

  it("leaves a sent order alone when nothing has arrived", () => {
    expect(deriveStatusFromReceipts("sent", [{ qtyOrdered: 5, qtyReceived: 0 }])).toBe("sent");
  });

  it("never moves a draft or cancelled order", () => {
    expect(deriveStatusFromReceipts("draft", [{ qtyOrdered: 5, qtyReceived: 5 }])).toBe("draft");
    expect(deriveStatusFromReceipts("cancelled", [{ qtyOrdered: 5, qtyReceived: 5 }])).toBe("cancelled");
  });
});
