const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 150;

/**
 * Splits text into overlapping chunks, preferring paragraph boundaries so a
 * chunk doesn't cut a sentence in half. Paragraphs longer than chunkSize are
 * hard-split with overlap as a fallback.
 */
export function chunkText(
  text: string,
  { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = {}
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);

    if (paragraph.length <= chunkSize) {
      current = paragraph;
    } else {
      for (let i = 0; i < paragraph.length; i += chunkSize - overlap) {
        chunks.push(paragraph.slice(i, i + chunkSize));
      }
      current = "";
    }
  }
  if (current) chunks.push(current);

  return chunks;
}
