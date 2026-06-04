import { MongoClient } from "mongodb";

// @ts-expect-error In order for jest to succesfully load this file, we need the TS extension
// instead of the JS extension.  This errors because `allowImportingTsExtensions` is
// not set but this is okay because this file isn't not technically a part of the project
// (not imported by any code in the project).
import { isUsingLocalAtlas, uri } from "./utils.ts";

export default async function teardown() {
  if (!isUsingLocalAtlas()) {
    const client = new MongoClient(uri());
    await client.connect();
    const db = client.db("langchain_test");
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      await db
        .collection(collection.name)
        .drop()
        .catch(() => {});
    }
    await client.close();
  }
  // Only stop the container if testcontainers started it (no URI was pre-provided)
  // oxlint-disable-next-line no-process-env
  if (process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI) return;
  // @ts-expect-error No __container on globalThis
  // however, this is the recommended way to share context between setup and teardown modules
  // https://jestjs.io/docs/configuration#globalsetup-string
  await globalThis.__container?.stop();
}
