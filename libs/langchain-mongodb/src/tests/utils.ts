import { Collection } from "mongodb";
import { Readable } from "stream";
import { setInterval } from "timers/promises";

export function isUsingLocalAtlas() {
  // eslint-disable-next-line no-process-env
  return !process.env.MONGODB_ATLAS_URI;
}
export function uri() {
  return (
    // eslint-disable-next-line no-process-env
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
    .find((indexes: { name: string; queryable?: boolean }[]) =>
      indexes.some((index) => index.name === indexName && index.queryable)
    );
}
