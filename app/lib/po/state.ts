/**
 * Purchase order lifecycle.
 *
 * Kept as an explicit transition table rather than scattered boolean flags,
 * because the follow-up agent writes to this state from parsed supplier email.
 * An agent acting on ambiguous input needs a narrow set of legal moves, and a
 * rejected transition is a bug report rather than silent corruption.
 */

export const PO_STATUSES = ["draft", "sent", "confirmed", "partial", "received", "cancelled"] as const;
export type POStatus = (typeof PO_STATUSES)[number];

const TRANSITIONS: Record<POStatus, readonly POStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["confirmed", "partial", "received", "cancelled"],
  // A supplier can confirm and then the goods arrive, in whole or in part.
  confirmed: ["partial", "received", "cancelled"],
  partial: ["partial", "received", "cancelled"],
  // Terminal.
  received: [],
  cancelled: [],
};

export function isTerminal(status: POStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function canTransition(from: POStatus, to: POStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transition(from: POStatus, to: POStatus): POStatus {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal purchase order transition: ${from} -> ${to}`);
  }
  return to;
}

export interface ReceiptLine {
  qtyOrdered: number;
  qtyReceived: number;
}

/**
 * Derives status from what has physically arrived. Draft and cancelled orders
 * are never moved by receiving — a receipt against either is a data problem the
 * merchant should see, not something to paper over.
 */
export function deriveStatusFromReceipts(current: POStatus, lines: ReceiptLine[]): POStatus {
  if (current === "draft" || current === "cancelled") return current;
  if (lines.length === 0) return current;

  const anyReceived = lines.some((l) => l.qtyReceived > 0);
  const allReceived = lines.every((l) => l.qtyReceived >= l.qtyOrdered);

  if (allReceived) return "received";
  if (anyReceived) return "partial";
  return current;
}
