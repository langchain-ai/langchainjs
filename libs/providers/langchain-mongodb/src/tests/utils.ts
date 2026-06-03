import { Collection } from "mongodb";
import { Readable } from "stream";
import { setInterval } from "timers/promises";
import type { MongoDBAtlasVectorSearch } from "../vectorstores.js";

export function isUsingLocalAtlas() {
  // oxlint-disable-next-line no-process-env
  const atlasUri = process.env.MONGODB_ATLAS_URI || process.env.MONGODB_URI || "";
  return !atlasUri.startsWith("mongodb+srv://");
}
export function uri() {
  // oxlint-disable-next-line no-process-env
  if (process.env.MONGODB_ATLAS_URI) return process.env.MONGODB_ATLAS_URI;
  // @ts-expect-error __mongoPort is set by the global test setup
  const port: number = globalThis.__mongoPort ?? 27017;
  return `mongodb://localhost:${port}?directConnection=true`;
}

/**
 * Given a collection and an index name, wait for the index to be queryable.
 */
export async function waitForIndexToBeQueryable(
  collection: Collection,
  indexName: string
): Promise<void> {
  return Readable.from(setInterval(5000, undefined, { ref: false }))
    .map(() => collection.listSearchIndexes().toArray())
    .find((indexes: { name: string; status: string }[]) => {
      const found = indexes.some(
        (index) => index.name === indexName && index.status === "READY"
      );
      return found;
    });
}

/**
 * Wait for documents to be indexed and searchable after insertion.
 * Polls the vector store with a test query until search succeeds,
 * indicating that auto-embeddings are complete.
 */
export async function waitForDocumentsIndexed(
  vectorStore: MongoDBAtlasVectorSearch,
  testQuery: string,
  maxWaitTime = 60000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const result = await vectorStore.similaritySearch(testQuery, 1);
    if (result.length > 0) {
      return; // Search succeeded, documents are indexed
    } else {
      // Documents not yet indexed, retry after a short delay
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  throw new Error(
    `Documents not indexed after ${maxWaitTime}ms for query: "${testQuery}". ` +
      `Auto-embedding may have failed or the timeout is too short.`
  );
}
