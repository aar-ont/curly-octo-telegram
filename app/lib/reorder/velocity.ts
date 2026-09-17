/**
 * Reorder suggestions from observed sales velocity.
 *
 * Deliberately simple arithmetic, not forecasting. Merchants ask for
 * forecasting; what they buy is a correct list of what is about to run out.
 * A visible formula they can sanity-check beats a black box from a developer
 * they have never heard of — and when the number looks wrong, they can tell us
 * why, which a model cannot.
 */

export interface SaleEvent {
  variantId: string;
  quantity: number;
  occurredAt: Date;
}

export interface StockLine {
  variantId: string;
  title?: string;
  /** Units physically available now. */
  onHand: number;
  /** Units already on an open purchase order. */
  incoming?: number;
  /** Days from placing a PO to stock landing, per supplier. */
  leadTimeDays: number;
  /** Minimum order quantity; suggestions round up to a multiple of it. */
  moq?: number;
}

export interface ReorderOptions {
  /** Trailing window used to compute velocity. */
  windowDays: number;
  /** Days of cover wanted *after* the delivery lands. */
  coverTargetDays: number;
  now: Date;
}

export interface ReorderSuggestion {
  variantId: string;
  title?: string;
  unitsPerDay: number;
  available: number;
  daysOfCover: number;
  reorderPoint: number;
  needsReorder: boolean;
  suggestedQty: number;
  reason: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function salesInWindow(sales: SaleEvent[], now: Date, windowDays: number): Map<string, number> {
  const cutoff = now.getTime() - windowDays * DAY_MS;
  const totals = new Map<string, number>();
  for (const sale of sales) {
    const t = sale.occurredAt.getTime();
    if (t < cutoff || t > now.getTime()) continue;
    totals.set(sale.variantId, (totals.get(sale.variantId) ?? 0) + sale.quantity);
  }
  return totals;
}

export function roundUpToMultiple(qty: number, multiple: number): number {
  if (multiple <= 1) return Math.ceil(qty);
  return Math.ceil(qty / multiple) * multiple;
}

export function suggestReorders(
  stock: StockLine[],
  sales: SaleEvent[],
  options: ReorderOptions,
): ReorderSuggestion[] {
  if (options.windowDays <= 0) {
    throw new Error("windowDays must be greater than zero");
  }

  const sold = salesInWindow(sales, options.now, options.windowDays);

  return stock.map((line) => {
    // Returns can push a window total negative; that is not negative demand.
    const units = Math.max(0, sold.get(line.variantId) ?? 0);
    const unitsPerDay = units / options.windowDays;

    // A negative on-hand (oversold) is zero stock, not a credit.
    const available = Math.max(0, line.onHand) + Math.max(0, line.incoming ?? 0);
    const horizon = line.leadTimeDays + options.coverTargetDays;
    const reorderPoint = unitsPerDay * horizon;
    const daysOfCover = unitsPerDay > 0 ? available / unitsPerDay : Infinity;

    const needsReorder = unitsPerDay > 0 && available < reorderPoint;
    const rawQty = needsReorder ? reorderPoint - available : 0;
    const suggestedQty = needsReorder ? roundUpToMultiple(rawQty, line.moq ?? 1) : 0;

    let reason: string;
    if (unitsPerDay === 0) {
      reason = `No sales in the last ${options.windowDays} days`;
    } else if (!needsReorder) {
      reason = `${daysOfCover.toFixed(1)} days of cover, need ${horizon}`;
    } else {
      reason = `${daysOfCover.toFixed(1)} days of cover but ${line.leadTimeDays} day lead time`;
    }

    return {
      variantId: line.variantId,
      title: line.title,
      unitsPerDay,
      available,
      daysOfCover,
      reorderPoint,
      needsReorder,
      suggestedQty,
      reason,
    };
  });
}
