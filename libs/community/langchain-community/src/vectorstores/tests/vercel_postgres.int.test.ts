import { expect, test } from "@jest/globals";
import { OpenAIEmbeddings } from "@langchain/openai";
import { VercelPostgres } from "../vercel_postgres.js";

let vercelPostgresStore: VercelPostgres;

const config = {
  tableName: "testvercelvectorstorelangchain2",
  columns: {
    idColumnName: "id",
    vectorColumnName: "vector",
    contentColumnName: "content",
    metadataColumnName: "metadata",
  },
};

describe("Test VercelPostgres store", () => {
  afterEach(async () => {
    await vercelPostgresStore?.delete({ deleteAll: true });
    await vercelPostgresStore?.end();
  });

  test("Test embeddings creation", async () => {
    vercelPostgresStore = await VercelPostgres.initialize(
      new OpenAIEmbeddings(),
      config
    );

    expect(vercelPostgresStore).toBeDefined();

    const docHello = {
      pageContent: "hello",
      metadata: { a: 1 },
    };
    const docCat = {
      pageContent: "Cat drinks milk",
      metadata: { a: 2 },
    };
    const docHi = { pageContent: "hi", metadata: { a: 1 } };

    const ids = await vercelPostgresStore.addDocuments([
      docHello,
      docHi,
      docCat,
    ]);

    const results = await vercelPostgresStore.similaritySearch("hello", 2, {
      a: 2,
    });

    expect(results).toHaveLength(1);

    expect(results[0].pageContent).toEqual(docCat.pageContent);

    await vercelPostgresStore.addDocuments(
      [{ pageContent: "Dog drinks milk", metadata: { a: 2 } }],
      { ids: [ids[2]] }
    );

    const results2 = await vercelPostgresStore.similaritySearch("hello", 2, {
      a: 2,
    });

    expect(results2).toHaveLength(1);
    expect(results2[0].pageContent).toEqual("Dog drinks milk");

    await vercelPostgresStore.delete({ ids: [ids[2]] });

    const results3 = await vercelPostgresStore.similaritySearch("hello", 2, {
      a: 2,
    });

    expect(results3).toHaveLength(0);
  });

  test("Test metadata filtering", async () => {
    vercelPostgresStore = await VercelPostgres.initialize(
      new OpenAIEmbeddings(),
      config
    );

    const docGreen = {
      pageContent: "Hi, I am the color green.",
      metadata: { color: "green" },
    };
    const docBlue = {
      pageContent: "Hi, I am the color blue.",
      metadata: { color: "blue" },
    };
    const docYellow = {
      pageContent: "Hi, I am the color yellow.",
      metadata: { color: "yellow" },
    };
    const docIrrelevant = {
      pageContent: "Hi, I am an irrelevant doc without metadata.",
      metadata: {},
    };

    await vercelPostgresStore.addDocuments([
      docGreen,
      docBlue,
      docYellow,
      docIrrelevant,
    ]);

    const results1 = await vercelPostgresStore.similaritySearch("color", 5, {
      color: "blue",
    });

    expect(results1).toHaveLength(1);

    const results2 = await vercelPostgresStore.similaritySearch(
      "irrelevant query",
      5,
      {
        color: { in: ["blue", "yellow"] },
      }
    );

    expect(results2).toHaveLength(2);

    const results2WithColorGreen = results2.filter(
      (result) => result.metadata.color === "green"
    );

    expect(results2WithColorGreen).toHaveLength(0);
  });
});
