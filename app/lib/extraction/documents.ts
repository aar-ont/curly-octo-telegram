/**
 * Turning merchant uploads into content blocks.
 *
 * Handles the three things that actually arrive: PDFs (printed or scanned POs),
 * spreadsheet exports, and photos of paper. Anything oversized throws rather
 * than being silently truncated — a partial import that looks complete is worse
 * than a rejected file, because nobody goes looking for the missing half.
 */

import type Anthropic from "@anthropic-ai/sdk";

/** Anthropic caps the whole request at 32MB; leave headroom for the rest of it. */
export const MAX_DOCUMENT_BYTES = 28 * 1024 * 1024;

export interface InputDocument {
  filename: string;
  /** Raw file bytes. */
  content: Buffer;
  mimeType: string;
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const TEXT_TYPES = new Set([
  "text/csv",
  "text/plain",
  "text/tab-separated-values",
  "application/csv",
  "message/rfc822",
]);

export function isSupported(mimeType: string): boolean {
  return mimeType === "application/pdf" || IMAGE_TYPES.has(mimeType) || TEXT_TYPES.has(mimeType);
}

export function toContentBlocks(doc: InputDocument): Anthropic.ContentBlockParam[] {
  if (doc.content.byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error(
      `${doc.filename} is ${(doc.content.byteLength / 1024 / 1024).toFixed(1)}MB, over the ${
        MAX_DOCUMENT_BYTES / 1024 / 1024
      }MB limit. Split it and upload the parts.`,
    );
  }

  // The filename is worth sending: "acme-invoice-2024.pdf" tells the model
  // which supplier it is looking at when the letterhead is illegible.
  const label: Anthropic.ContentBlockParam = { type: "text", text: `File: ${doc.filename}` };

  if (doc.mimeType === "application/pdf") {
    return [
      label,
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: doc.content.toString("base64") },
      },
    ];
  }

  if (IMAGE_TYPES.has(doc.mimeType)) {
    return [
      label,
      {
        type: "image",
        source: {
          type: "base64",
          media_type: doc.mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: doc.content.toString("base64"),
        },
      },
    ];
  }

  if (TEXT_TYPES.has(doc.mimeType)) {
    return [{ type: "text", text: `File: ${doc.filename}\n\n${doc.content.toString("utf8")}` }];
  }

  throw new Error(`Unsupported file type ${doc.mimeType} for ${doc.filename}`);
}
