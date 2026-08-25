/**
 * Manual RAG retrieval sanity check.
 *
 * Run with: npx tsx scripts/test-retrieval.ts "<question>" "<knowledge_source_id>" [matchCount] ["<substring to find>"]
 *
 * .env.local is loaded directly inside this file (see dotenv.config below) —
 * no dotenv-cli wrapper needed, which avoids Windows issues with nested
 * npx processes and extensionless shell-script binaries in node_modules/.bin.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

async function main() {
  // Dynamic import, not static — static imports are hoisted and run before
  // dotenv.config() above, which would make retrieve.ts's transitive import
  // of lib/supabase/admin.ts throw on missing env vars before they're loaded.
  const { searchKnowledgeChunks } = await import("../lib/ingestion/retrieve");

  const question = process.argv[2];
  const sourceId = process.argv[3];
  const matchCount = process.argv[4] ? parseInt(process.argv[4], 10) : 6;
  const findSubstring = process.argv[5];

  if (!question || !sourceId) {
    console.error(
      'Usage: tsx scripts/test-retrieval.ts "<question>" "<knowledge_source_id>" [matchCount] ["<substring to find>"]'
    );
    process.exit(1);
  }

  console.log(`\nQuery: "${question}"  (matchCount=${matchCount})\n`);

  const results = await searchKnowledgeChunks(question, sourceId, matchCount);

  if (results.length === 0) {
    console.log("No chunks returned at all — check filter_source_id matches an indexed source.");
    return;
  }

  for (const [i, r] of results.entries()) {
    const isTarget = findSubstring && r.content.includes(findSubstring);
    console.log(
      `#${i + 1}${isTarget ? "  <-- MATCH" : ""}  similarity=${r.similarity.toFixed(4)}  chunk_id=${r.id}`
    );
    console.log(`    ${r.content.slice(0, 200).replace(/\n/g, " ")}...`);
    console.log();
  }

  if (findSubstring) {
    const rank = results.findIndex((r) => r.content.includes(findSubstring));
    console.log(
      rank === -1
        ? `"${findSubstring}" not found in top ${matchCount} results at all — try increasing matchCount further.`
        : `"${findSubstring}" found at rank #${rank + 1} with similarity ${results[rank].similarity.toFixed(4)}.`
    );
  }

  const top = results[0].similarity;
  if (top < 0.3) {
    console.log(
      "⚠️  Top similarity is quite low — either the question isn't covered by this source, or retrieval quality needs attention."
    );
  }
}

main().catch((err) => {
  console.error("Retrieval test failed:", err);
  process.exit(1);
});
