/**
 * Deciding what to do with a parsed supplier reply.
 *
 * The model's job ends at turning an email into a `ParsedReply`. This module
 * decides what that means for the PO and what the merchant must see, and it is
 * deliberately pure so the policy can be tested without an API key.
 *
 * Standing rule: the agent drafts, the merchant sends. An agent that emails a
 * supplier unsupervised and gets it wrong damages a relationship the merchant
 * spent years building. Autonomy is earned with a track record we do not have.
 */

import type { POStatus } from "./state";
import { canTransition } from "./state";

export type ReplyIntent =
  | "confirmation"
  | "eta_update"
  | "backorder"
  | "price_change"
  | "substitution"
  | "question"
  | "unrelated";

export interface ParsedReplyLine {
  supplierSku: string | null;
  title: string | null;
  qtyConfirmed: number | null;
  unitCost: number | null;
  unavailable: boolean;
}

export interface ParsedReply {
  intent: ReplyIntent;
  /** ISO-8601 date, or null when the supplier gave no date. */
  expectedAt: string | null;
  lines: ParsedReplyLine[];
  summary: string;
}

export interface POLineSnapshot {
  supplierSku: string | null;
  title: string;
  qtyOrdered: number;
  unitCost: number;
}

export interface POSnapshot {
  status: POStatus;
  expectedAt: Date | null;
  lines: POLineSnapshot[];
}

export interface EvaluationPolicy {
  /** Fractional unit-cost change that needs a human. 0.05 = 5%. */
  priceTolerance: number;
  /** ETA slipping by more than this many days needs a human. */
  etaSlipDays: number;
}

export const DEFAULT_POLICY: EvaluationPolicy = {
  priceTolerance: 0.05,
  etaSlipDays: 7,
};

export type EscalationKind =
  | "price_change"
  | "item_unavailable"
  | "eta_slip"
  | "quantity_short"
  | "substitution"
  | "needs_reply";

export interface Escalation {
  kind: EscalationKind;
  message: string;
}

export interface ReplyEvaluation {
  nextStatus: POStatus;
  expectedAt: Date | null;
  escalations: Escalation[];
  /** True when nothing needs a human and the PO can update quietly. */
  autoApplied: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function findOrderLine(po: POSnapshot, line: ParsedReplyLine): POLineSnapshot | undefined {
  if (line.supplierSku) {
    const bySku = po.lines.find(
      (l) => l.supplierSku && l.supplierSku.trim().toUpperCase() === line.supplierSku!.trim().toUpperCase(),
    );
    if (bySku) return bySku;
  }
  if (line.title) {
    const needle = line.title.trim().toLowerCase();
    return po.lines.find((l) => l.title.trim().toLowerCase() === needle);
  }
  return undefined;
}

export function evaluateReply(
  po: POSnapshot,
  reply: ParsedReply,
  policy: EvaluationPolicy = DEFAULT_POLICY,
): ReplyEvaluation {
  const escalations: Escalation[] = [];

  // An unrelated or terminal-state message changes nothing.
  if (reply.intent === "unrelated") {
    return { nextStatus: po.status, expectedAt: po.expectedAt, escalations: [], autoApplied: false };
  }
  if (reply.intent === "question") {
    escalations.push({ kind: "needs_reply", message: `Supplier asked a question: ${reply.summary}` });
  }
  if (reply.intent === "substitution") {
    escalations.push({ kind: "substitution", message: `Supplier proposed a substitution: ${reply.summary}` });
  }

  let expectedAt = po.expectedAt;
  const parsedDate = reply.expectedAt ? new Date(reply.expectedAt) : null;
  if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
    if (po.expectedAt) {
      const slipDays = (parsedDate.getTime() - po.expectedAt.getTime()) / DAY_MS;
      if (slipDays > policy.etaSlipDays) {
        escalations.push({
          kind: "eta_slip",
          message: `Delivery moved out by ${Math.round(slipDays)} days, to ${parsedDate.toISOString().slice(0, 10)}`,
        });
      }
    }
    expectedAt = parsedDate;
  }

  for (const line of reply.lines) {
    const ordered = findOrderLine(po, line);
    const label = line.title ?? line.supplierSku ?? "an item";

    if (line.unavailable) {
      escalations.push({ kind: "item_unavailable", message: `${label} is unavailable` });
      continue;
    }
    if (!ordered) continue;

    if (line.unitCost !== null && ordered.unitCost > 0) {
      const delta = Math.abs(line.unitCost - ordered.unitCost) / ordered.unitCost;
      if (delta > policy.priceTolerance) {
        escalations.push({
          kind: "price_change",
          message: `${label} quoted at ${line.unitCost.toFixed(2)}, ordered at ${ordered.unitCost.toFixed(2)}`,
        });
      }
    }

    if (line.qtyConfirmed !== null && line.qtyConfirmed < ordered.qtyOrdered) {
      escalations.push({
        kind: "quantity_short",
        message: `${label}: supplier confirmed ${line.qtyConfirmed} of ${ordered.qtyOrdered}`,
      });
    }
  }

  if (reply.intent === "backorder") {
    escalations.push({ kind: "item_unavailable", message: reply.summary || "Supplier reported a backorder" });
  }

  // Only a clean confirmation advances the PO on its own.
  const clean = escalations.length === 0;
  const wantsConfirmed = reply.intent === "confirmation" || reply.intent === "eta_update";
  const nextStatus =
    clean && wantsConfirmed && canTransition(po.status, "confirmed") ? "confirmed" : po.status;

  return { nextStatus, expectedAt, escalations, autoApplied: clean && nextStatus !== po.status };
}
