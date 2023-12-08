/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeAll, expect, test } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";
import { SyntheticEmbeddings } from "../../utils/testing.js";
import { InMemoryDocstore } from "../../stores/doc/in_memory.js";
import {
  MatchingEngineArgs,
  MatchingEngine,
  IdDocument,
  Restriction,
} from "../googlevertexai.js";

describe("Vertex AI matching", () => {
  let embeddings: Embeddings;
  let store: InMemoryDocstore;
  let config: MatchingEngineArgs;
  let engine: MatchingEngine;

  beforeAll(() => {
    embeddings = new SyntheticEmbeddings({
      vectorSize: Number.parseInt(
        process.env.SYNTHETIC_EMBEDDINGS_VECTOR_SIZE ?? "768",
        10
      ),
    });

    store = new InMemoryDocstore();

    config = {
      index: process.env.GOOGLE_VERTEXAI_MATCHINGENGINE_INDEX!,
      indexEndpoint: process.env.GOOGLE_VERTEXAI_MATCHINGENGINE_INDEXENDPOINT!,
      apiVersion: "v1beta1",
      docstore: store,
    };

    engine = new MatchingEngine(embeddings, config);
  });

  test.skip("public endpoint", async () => {
    const apiendpoint = await engine.determinePublicAPIEndpoint();
    console.log(apiendpoint);
    expect(apiendpoint).toHaveProperty("apiEndpoint");
    expect(apiendpoint).toHaveProperty("deployedIndexId");
  });

  test.skip("store", async () => {
    const doc = new Document({ pageContent: "this" });
    await engine.addDocuments([doc]);
    console.log(store._docs);
  });

  test.skip("query", async () => {
    const results = await engine.similaritySearch("that");
    console.log("query", results);
    expect(results?.length).toBeGreaterThanOrEqual(1);
  });

  test.skip("query filter exclude", async () => {
    const filters: Restriction[] = [
      {
        namespace: "color",
        allowList: ["red"],
      },
    ];
    const results = await engine.similaritySearch("that", 4, filters);
    console.log("query", results);
    expect(results?.length).toEqual(0);
  });

  test.skip("delete", async () => {
    const newDoc = new Document({ pageContent: "this" });
    await engine.addDocuments([newDoc]);
    console.log("added", newDoc);

    const oldResults: IdDocument[] = await engine.similaritySearch("this", 10);
    expect(oldResults?.length).toBeGreaterThanOrEqual(1);
    console.log(oldResults);

    const oldIds = oldResults.map((doc) => doc.id!);
    await engine.delete({ ids: oldIds });
    console.log("deleted", oldIds);

    const newResults: IdDocument[] = await engine.similaritySearch("this", 10);
    expect(newResults).not.toEqual(oldResults);

    console.log(newResults);
  });

  describe("restrictions", () => {
    let documents: IdDocument[];

    beforeAll(async () => {
      documents = [
        new IdDocument({
          id: "1",
          pageContent: "this apple",
          metadata: {
            color: "red",
            category: "edible",
          },
        }),
        new IdDocument({
          id: "2",
          pageContent: "this blueberry",
          metadata: {
            color: "blue",
            category: "edible",
          },
        }),
        new IdDocument({
          id: "3",
          pageContent: "this firetruck",
          metadata: {
            color: "red",
            category: "machine",
          },
        }),
      ];

      // Add all our documents
      await engine.addDocuments(documents);
    });

    test.skip("none", async () => {
      // A general query to make sure we can read everything
      const allResults = await engine.similaritySearch("this", 4);
      expect(allResults).toHaveLength(3);
    });

    test.skip("red things", async () => {
      // Just get red things
      const redFilter: Restriction[] = [
        {
          namespace: "color",
          allowList: ["red"],
        },
      ];
      const redResults = await engine.similaritySearch("this", 4, redFilter);
      expect(redResults).toHaveLength(2);
    });

    test.skip("red, not edible", async () => {
      const filter: Restriction[] = [
        {
          namespace: "color",
          allowList: ["red"],
        },
        {
          namespace: "category",
          denyList: ["edible"],
        },
      ];
      const results = await engine.similaritySearch("thing", 4, filter);
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toEqual("this firetruck");
    });

    afterAll(async () => {
      // Cleanup
      const ids = documents.map((doc) => doc.id!);
      await engine.delete({ ids });
    });
  });
});
