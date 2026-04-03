import { Collection, MongoClient } from "mongodb";
import { Readable } from "stream";
import { setInterval } from "timers/promises";
import semver from "semver";
import type { MongoDBAtlasVectorSearch } from "../vectorstores.js";

export function isUsingLocalAtlas() {

  // oxlint-disable-next-line no-process-env
  return !process.env.MONGODB_ATLAS_URI;
}
export function uri() {
  return (

    process.env.MONGODB_ATLAS_URI ||
    "mongodb://localhost:27017?directConnection=true"
  );
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
    .find((indexes: { name: string; status: string; }[]) => {
      const found = indexes.some((index) => index.name === indexName && index.status === "READY");
      return found;
    });
}

/**
 * Get MongoDB server version
 * @param client MongoDB client connection
 * @returns Version string (e.g., "8.2.0")
 */
export async function getServerVersion(client: MongoClient): Promise<string> {
  const admin = client.db().admin();
  const serverStatus = await admin.serverStatus();
  return serverStatus.version || "0.0.0";
}

/**
 * Check if MongoDB server version meets minimum requirement
 * @param client MongoDB client connection
 * @param minVersion Minimum required version (e.g., "8.2.0")
 * @returns true if server version >= minVersion
 */
export async function isServerVersionGte(
  client: MongoClient,
  minVersion: string
): Promise<boolean> {
  const version = await getServerVersion(client);
  return semver.gte(version, minVersion);
}

/**
 * Wait for documents to be indexed and searchable after insertion.
 * Polls the vector store with a test query until search succeeds,
 * indicating that auto-embeddings are complete.
 *
 * @param vectorStore The vector store to test
 * @param testQuery A query string to verify searchability
 * @param maxWaitTime Maximum time to wait in milliseconds (default 60s)
 * @throws Error if documents are not indexed within the timeout
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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error(
    `Documents not indexed after ${maxWaitTime}ms for query: "${testQuery}". ` +
    `Auto-embedding may have failed or the timeout is too short.`
  );
}
