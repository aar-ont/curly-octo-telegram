/**
 * Matching imported supplier line items to Shopify variants.
 *
 * This runs during supplier reconstruction, where the input is whatever the
 * merchant could salvage from Stocky — old PO PDFs, spreadsheets, emails. The
 * data is dirty by definition, so the goal is not to be clever. The goal is to
 * be *honest about confidence*, because the merchant reviews every row anyway
 * and a confident wrong answer costs more than an admitted uncertainty.
 *
 * Anything not matched exactly is surfaced for review rather than applied.
 */

export type MatchConfidence = "exact" | "likely" | "none";

export interface VariantCandidate {
  variantId: string;
  sku: string | null;
  title: string;
}

export interface IncomingItem {
  supplierSku: string | null;
  title: string | null;
}

export interface MatchResult {
  variantId: string | null;
  confidence: MatchConfidence;
  score: number;
  reason: string;
}

/** Trim + uppercase. The conservative key: "ab-12 " and "AB-12" are the same SKU. */
export function skuKey(sku: string): string {
  return sku.trim().toUpperCase().replace(/\s+/g, " ");
}

/** Strips separators too, so "AB-12" matches "ab12". Looser, hence never "exact". */
export function skuLooseKey(sku: string): string {
  return sku.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr.slice();
  }
  return prev[b.length];
}

/** 0..1, where 1 is identical. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

/**
 * Jaccard overlap on tokens, blended with edit distance on the whole string.
 * Tokens alone match "blue cotton shirt" to "cotton shirt blue" (good) but also
 * rate "small blue shirt" against "large blue shirt" highly (bad), which is what
 * the edit-distance term is there to pull back down.
 */
export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(titleTokens(a));
  const tb = new Set(titleTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;

  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const union = ta.size + tb.size - shared;
  const jaccard = union === 0 ? 0 : shared / union;

  const edit = similarity(a.trim().toLowerCase(), b.trim().toLowerCase());
  return 0.65 * jaccard + 0.35 * edit;
}

export const TITLE_MATCH_THRESHOLD = 0.72;
/** If the top two title candidates are this close, we cannot honestly pick one. */
export const AMBIGUITY_MARGIN = 0.05;
/**
 * Below this, a near-tie is just noise rather than a real ambiguity. Above it,
 * "two variants match equally" tells the merchant to pick one; saying "nothing
 * close" instead would wrongly imply the product is missing from the catalogue.
 */
export const AMBIGUITY_REPORT_FLOOR = 0.5;

interface Index {
  bySku: Map<string, VariantCandidate[]>;
  byLooseSku: Map<string, VariantCandidate[]>;
  all: VariantCandidate[];
}

function buildIndex(candidates: VariantCandidate[]): Index {
  const bySku = new Map<string, VariantCandidate[]>();
  const byLooseSku = new Map<string, VariantCandidate[]>();

  for (const c of candidates) {
    if (!c.sku) continue;
    const strict = skuKey(c.sku);
    const loose = skuLooseKey(c.sku);
    if (strict) {
      const list = bySku.get(strict);
      list ? list.push(c) : bySku.set(strict, [c]);
    }
    if (loose) {
      const list = byLooseSku.get(loose);
      list ? list.push(c) : byLooseSku.set(loose, [c]);
    }
  }
  return { bySku, byLooseSku, all: candidates };
}

function matchOne(item: IncomingItem, index: Index): MatchResult {
  if (item.supplierSku && item.supplierSku.trim()) {
    const strict = index.bySku.get(skuKey(item.supplierSku));
    if (strict?.length === 1) {
      return { variantId: strict[0].variantId, confidence: "exact", score: 1, reason: "SKU matched exactly" };
    }
    if (strict && strict.length > 1) {
      return { variantId: null, confidence: "none", score: 0, reason: `SKU "${item.supplierSku}" matches ${strict.length} variants` };
    }

    const loose = index.byLooseSku.get(skuLooseKey(item.supplierSku));
    if (loose?.length === 1) {
      return { variantId: loose[0].variantId, confidence: "likely", score: 0.9, reason: "SKU matched ignoring punctuation" };
    }
    if (loose && loose.length > 1) {
      return { variantId: null, confidence: "none", score: 0, reason: `SKU "${item.supplierSku}" ambiguous across ${loose.length} variants` };
    }
  }

  if (!item.title || !item.title.trim()) {
    return { variantId: null, confidence: "none", score: 0, reason: "No SKU match and no title to fall back on" };
  }

  let best: { c: VariantCandidate; score: number } | null = null;
  let runnerUp = 0;
  for (const c of index.all) {
    const score = titleSimilarity(item.title, c.title);
    if (!best || score > best.score) {
      if (best) runnerUp = best.score;
      best = { c, score };
    } else if (score > runnerUp) {
      runnerUp = score;
    }
  }

  // Ambiguity is checked before the threshold on purpose. A title that sits
  // just under the bar against two equally-close variants is a "which one?",
  // not a "no such product", and the merchant resolves those differently.
  if (best && best.score >= AMBIGUITY_REPORT_FLOOR && best.score - runnerUp < AMBIGUITY_MARGIN) {
    return { variantId: null, confidence: "none", score: best.score, reason: "Two or more variants match this title equally well" };
  }
  if (!best || best.score < TITLE_MATCH_THRESHOLD) {
    return { variantId: null, confidence: "none", score: best?.score ?? 0, reason: "No variant close enough to match on title" };
  }
  return { variantId: best.c.variantId, confidence: "likely", score: best.score, reason: "Matched on product title" };
}

export function matchItems(items: IncomingItem[], candidates: VariantCandidate[]): MatchResult[] {
  const index = buildIndex(candidates);
  return items.map((item) => matchOne(item, index));
}
