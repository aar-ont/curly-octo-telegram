/**
 * Claude calls for supplier reconstruction and supplier-reply parsing.
 *
 * The model's entire job is document -> structured data. Every decision about
 * what that data *means* lives in the pure modules (matching, reorder, po/reply)
 * where it can be tested, argued with, and shown to a merchant.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ParsedReply } from "../po/reply";
import { toContentBlocks, type InputDocument } from "./documents";
import { normalizeExtraction } from "./normalize";
import { ExtractionResultSchema, ParsedReplySchema, type ExtractionResult } from "./schema";

export const DEFAULT_MODEL = "claude-opus-5";
const MAX_TOKENS = 16000;

export function extractionModel(): string {
  return process.env.EXTRACTION_MODEL || DEFAULT_MODEL;
}

let cached: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!cached) cached = new Anthropic();
  return cached;
}

const EXTRACTION_SYSTEM = `You reconstruct supplier records for a Shopify merchant whose inventory app was shut down, taking their supplier data with it.

You are reading whatever they salvaged: purchase order PDFs, scans of paper, spreadsheet exports, forwarded emails. It is messy and incomplete.

Rules:
- Extract only what is actually on the page. Never infer a price, SKU, lead time, or contact detail that is not written down.
- When a value is unclear or missing, return null. A null is reviewed and fixed in seconds; a plausible-looking invention is trusted and becomes wrong data forever.
- The same supplier may appear across several documents under slightly different names. Return them separately and exactly as written; merging happens downstream.
- Unit cost means what the merchant pays the supplier, not the retail price. If a document shows both, take the cost.
- Use the notes field for anything you could not read, anything ambiguous, and anything you deliberately skipped.`;

const REPLY_SYSTEM = `You read a supplier's email reply to a purchase order and turn it into structured data.

Rules:
- Report only what the supplier said. Do not infer agreement from politeness.
- Dates must be YYYY-MM-DD. If the supplier gave a vague date ("end of the month", "next week"), return null rather than guessing at one.
- intent "confirmation" means they accepted the order as placed. If anything changed — price, quantity, timing, the items themselves — use the intent that names the change.
- Anything the supplier asks the merchant to decide is "question".
- Mark a line unavailable only when the supplier says they cannot supply it.`;

export interface ExtractOptions {
  /** Lower this to trade thoroughness for cost; see docs/06-costs.md. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

/**
 * Extracts supplier records from one merchant upload.
 *
 * Deliberately per-document rather than per-batch: a merchant with 200 old POs
 * should watch progress, and one malformed file must not take down the other
 * 199. For genuinely bulk imports use submitExtractionBatch below.
 */
export async function extractSupplierData(
  documents: InputDocument[],
  options: ExtractOptions = {},
): Promise<ExtractionResult> {
  if (documents.length === 0) {
    return { suppliers: [], notes: "No documents supplied." };
  }

  const content = documents.flatMap(toContentBlocks);
  content.push({
    type: "text",
    text: "Extract every supplier and every line item you can read from the documents above.",
  });

  try {
    const response = await anthropic().messages.parse({
      model: extractionModel(),
      max_tokens: MAX_TOKENS,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content }],
      output_config: {
        format: zodOutputFormat(ExtractionResultSchema),
        ...(options.effort ? { effort: options.effort } : {}),
      },
    });

    if (response.stop_reason === "max_tokens") {
      throw new Error("The documents were too long to extract in one pass. Upload them in smaller batches.");
    }
    if (!response.parsed_output) {
      throw new Error("Extraction returned nothing usable. The source file is probably unreadable.");
    }

    return normalizeExtraction(response.parsed_output);
  } catch (error) {
    throw describeApiError(error);
  }
}

export async function parseSupplierReply(emailBody: string, poReference: string): Promise<ParsedReply> {
  try {
    const response = await anthropic().messages.parse({
      model: extractionModel(),
      max_tokens: MAX_TOKENS,
      system: REPLY_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Reply to purchase order ${poReference}:\n\n---\n${emailBody}\n---`,
        },
      ],
      output_config: { format: zodOutputFormat(ParsedReplySchema) },
    });

    if (!response.parsed_output) {
      // Treat an unparseable reply as "a human should read this", never as agreement.
      return { intent: "question", expectedAt: null, lines: [], summary: "Could not read this reply automatically." };
    }
    return response.parsed_output;
  } catch (error) {
    throw describeApiError(error);
  }
}

/**
 * Bulk import at half price.
 *
 * A merchant dumping their entire archive is not latency-sensitive — they
 * expect to come back to it — which makes this the single biggest cost lever
 * in the app. Batches run asynchronously at 50% of standard rates.
 */
export async function submitExtractionBatch(
  jobs: { customId: string; documents: InputDocument[] }[],
): Promise<string> {
  const batch = await anthropic().messages.batches.create({
    requests: jobs.map((job) => ({
      custom_id: job.customId,
      params: {
        model: extractionModel(),
        max_tokens: MAX_TOKENS,
        system: EXTRACTION_SYSTEM,
        messages: [
          {
            role: "user" as const,
            content: [
              ...job.documents.flatMap(toContentBlocks),
              { type: "text" as const, text: "Extract every supplier and every line item you can read." },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(ExtractionResultSchema) },
      },
    })),
  });
  return batch.id;
}

function describeApiError(error: unknown): Error {
  if (error instanceof Anthropic.AuthenticationError) {
    return new Error("Anthropic API key is missing or invalid. Check ANTHROPIC_API_KEY.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new Error("Hit the Anthropic rate limit. Wait a moment and retry this import.");
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new Error(`Anthropic rejected the request: ${error.message}`);
  }
  if (error instanceof Anthropic.APIError) {
    return new Error(`Anthropic API error ${error.status}: ${error.message}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}
