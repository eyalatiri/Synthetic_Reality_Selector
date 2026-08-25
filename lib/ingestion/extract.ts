import "server-only";

import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

const PLAIN_TEXT_EXTENSIONS = ["txt", "md", "csv"];


export async function extractText(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf") {
    return extractPdfTextFromBuffer(buffer, fileName);
  }

  if (ext === "docx") {
    const { value } = await mammoth.extractRawText({
      buffer,
    });

    return value;
  }

  if (PLAIN_TEXT_EXTENSIONS.includes(ext)) {
    return buffer.toString("utf-8");
  }

  throw new Error(
    `Unsupported file type ".${ext}" for "${fileName}" — supported: pdf, docx, txt, md, csv`
  );
}

async function extractPdfTextFromBuffer(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  // unpdf/pdfjs-dist wants a Uint8Array, not a Node Buffer subclass, to
  // avoid it trying to treat the buffer as a Node stream internally.
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch (err) {
    throw new Error(
      `Could not open "${fileName}" as a PDF — it may be corrupted or password-protected: ${
        (err as Error).message
      }`
    );
  }

  const { text, totalPages } = await extractPdfText(pdf, { mergePages: true });
  const merged = (Array.isArray(text) ? text.join("\n\n") : text).trim();

  if (!merged) {
    // Common cause: a scanned/image-only PDF with no embedded text layer.
    // unpdf does not OCR, so this needs a separate OCR step upstream if
    // scanned documents are expected to be ingested.
    throw new Error(
      `No extractable text found in "${fileName}" (${totalPages} page${
        totalPages === 1 ? "" : "s"
      }) — it may be a scanned/image-only PDF that requires OCR.`
    );
  }

  return merged;
}
