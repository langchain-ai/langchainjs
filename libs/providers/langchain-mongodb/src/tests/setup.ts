// eslint-disable-next-line import/no-extraneous-dependencies
import {
  GenericContainer,
  StartedTestContainer,
  StartupCheckStrategy,
  StartupStatus,
} from "testcontainers";
import { MongoClient } from "mongodb";

// @ts-expect-error In order for jest to succesfully load this file, we need the TS extension
// instead of the JS extension.  This errors because `allowImportingTsExtensions` is
// not set but this is okay because this file isn't not technically a part of the project
// (not imported by any code in the project).
import { isUsingLocalAtlas, uri } from "./utils.ts";

/**
 * Local Atlas takes a bit to start up.  This class provides a wait strategy that will wait until
 * a search index is successfully created, indicating that the mongot process is up and running.
 */
class ReadyWhenMongotEstablished extends StartupCheckStrategy {
  public async checkStartupState(): Promise<StartupStatus> {
    try {
      await this.tryCreateSearchIndex();
      return "SUCCESS";
    } catch (e: unknown) {
      const message =
        (typeof e === "object" && e != null && "message" in e && e.message) ||
        "Unknown error";
      console.error("Error: ", message);
      return "PENDING";
    }
  }

  private async tryCreateSearchIndex() {
    let client;
    try {
      client = new MongoClient(uri(), { serverSelectionTimeoutMS: 1_000 });
      await client.connect();

      const namespace = "vectorstore.test";
      const [dbName, collectionName] = namespace.split(".");
      const collection = await client
        .db(dbName)
        .createCollection(collectionName);

      await collection.createSearchIndex({
        name: "default",
        type: "search",
        definition: {
          mappings: {
            fields: {
              e: { type: "number" },
              embedding: {
                dimensions: 1536,
                similarity: "euclidean",
                type: "knnVector",
              },
            },
          },
        },
      });

      await collection.dropSearchIndex("default");
    } finally {
      await client?.close();
    }
  }
}

export default async function setup() {
  if (!isUsingLocalAtlas()) return;

  let container: StartedTestContainer;
  try {
    container = await new GenericContainer("mongodb/mongodb-atlas-local")
      .withExposedPorts({ host: 27017, container: 27017 })
      .withWaitStrategy(new ReadyWhenMongotEstablished())
      .withStartupTimeout(30_000)
      .start();
  } catch (error: Error | unknown) {
    const hasMessage = (err: unknown): err is { message: string } =>
      typeof err === "object" &&
      err !== null &&
      "message" in err &&
      typeof (err as { message?: unknown }).message === "string";

    const msg = hasMessage(error) ? error.message : String(error);

    if (msg.includes("Could not find a working container runtime strategy")) {
      console.error(
        `${msg}\nMongoDB Atlas Local container failed to start. If you are trying to use a MongoDB Atlas instance without Docker, make sure MONGODB_ATLAS_URI environment variable is set to a valid MongoDB Atlas URI.`
      );
    } else {
      console.error(error);
    }
    throw error;
  }
  // @ts-expect-error Assigning properties on the globalThis object is Jest's recommended practice of sharing
  // context between setup and teardown modules.
  // See https://jestjs.io/docs/configuration#globalsetup-string.
  globalThis.__container = container;
}
