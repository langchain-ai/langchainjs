/* eslint-disable no-process-env */
/* eslint-disable import/no-extraneous-dependencies */
import { test, expect } from "@jest/globals";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { SingleStoreVectorStore, SearchStrategy } from "../singlestore.js";

class MockEmbeddings extends OpenAIEmbeddings {
  queryIndex: number;

  constructor() {
    super();
    this.queryIndex = 0;
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((text: string, _) => this.embed(text));
  }

  embed(_: string): number[] {
    this.queryIndex += 1;
    return [
      Math.cos((this.queryIndex * Math.PI) / 10.0),
      Math.sin((this.queryIndex * Math.PI) / 10.0),
    ];
  }

  async embedQuery(document: string): Promise<number[]> {
    return this.embed(document);
  }
}

const weatherTexts: string[] = [
  "In the parched desert, a sudden rainstorm brought relief, as the droplets danced upon the thirsty earth, rejuvenating the landscape with the sweet scent of petrichor.",
  "Amidst the bustling cityscape, the rain fell relentlessly, creating a symphony of pitter-patter on the pavement, while umbrellas bloomed like colorful flowers in a sea of gray.",
  "High in the mountains, the rain transformed into a delicate mist, enveloping the peaks in a mystical veil, where each droplet seemed to whisper secrets to the ancient rocks below.",
  "Blanketing the countryside in a soft, pristine layer, the snowfall painted a serene tableau, muffling the world in a tranquil hush as delicate flakes settled upon the branches of trees like nature's own lacework.",
  "In the urban landscape, snow descended, transforming bustling streets into a winter wonderland, where the laughter of children echoed amidst the flurry of snowballs and the twinkle of holiday lights.",
  "Atop the rugged peaks, snow fell with an unyielding intensity, sculpting the landscape into a pristine alpine paradise, where the frozen crystals shimmered under the moonlight, casting a spell of enchantment over the wilderness below.",
];

const weatherMetadata: object[] = [
  { count: "1", category: "rain", group: "a" },
  { count: "2", category: "rain", group: "a" },
  { count: "3", category: "rain", group: "b" },
  { count: "1", category: "snow", group: "b" },
  { count: "2", category: "snow", group: "a" },
  { count: "3", category: "snow", group: "a" },
];

test.skip("SingleStoreVectorStore", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();

  const vectorStore = await SingleStoreVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new OpenAIEmbeddings(),
    {
      connectionOptions: {
        host: process.env.SINGLESTORE_HOST,
        port: Number(process.env.SINGLESTORE_PORT),
        user: process.env.SINGLESTORE_USERNAME,
        password: process.env.SINGLESTORE_PASSWORD,
        database: process.env.SINGLESTORE_DATABASE,
      },
      contentColumnName: "cont",
      metadataColumnName: "met",
      vectorColumnName: "vec",
    }
  );
  expect(vectorStore).toBeDefined();

  const results = await vectorStore.similaritySearch("hello world", 1);

  expect(results).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2" },
    }),
  ]);

  await vectorStore.addDocuments([
    new Document({
      pageContent: "Green forest",
      metadata: { id: 4, name: "4" },
    }),
    new Document({
      pageContent: "Green field",
      metadata: { id: 5, name: "5" },
    }),
  ]);

  const results2 = await vectorStore.similaritySearch("forest", 1);

  expect(results2).toEqual([
    new Document({
      pageContent: "Green forest",
      metadata: { id: 4, name: "4" },
    }),
  ]);

  await vectorStore.end();
});

test.skip("SingleStoreVectorStore euclidean_distance", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();

  const vectorStore = await SingleStoreVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new OpenAIEmbeddings(),
    {
      connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
      tableName: "euclidean_distance_test",
      distanceMetric: "EUCLIDEAN_DISTANCE",
    }
  );
  expect(vectorStore).toBeDefined();

  const results = await vectorStore.similaritySearch("hello world", 1);

  expect(results).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2" },
    }),
  ]);

  await vectorStore.end();
});

test.skip("SingleStoreVectorStore filtering", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();

  const vectorStore = await SingleStoreVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2", sub: { sub2: { idx: 1 } } },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new OpenAIEmbeddings(),
    {
      connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
      tableName: "filtering_test",
    }
  );
  expect(vectorStore).toBeDefined();

  const results1 = await vectorStore.similaritySearch("hello world", 1, {
    id: 3,
  });

  expect(results1).toEqual([
    new Document({
      pageContent: "hello nice world",
      metadata: { id: 3, name: "3" },
    }),
  ]);

  const results2 = await vectorStore.similaritySearch("hello nice world", 1, {
    name: "2",
  });
  expect(results2).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2", sub: { sub2: { idx: 1 } } },
    }),
  ]);

  const results3 = await vectorStore.similaritySearch("hello nice world", 1, {
    sub: { sub2: { idx: 1 } },
  });
  expect(results3).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2", sub: { sub2: { idx: 1 } } },
    }),
  ]);

  const results4 = await vectorStore.similaritySearch("hello nice world", 1, {
    name: "2",
    id: 2,
  });
  expect(results4).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2", sub: { sub2: { idx: 1 } } },
    }),
  ]);

  const results5 = await vectorStore.similaritySearch("hello nice world", 1, {
    name: "3",
    sub: { sub2: { idx: 1 } },
  });
  expect(results5).toEqual([]);
  await vectorStore.end();
});

test.skip("SingleStorevectorStore wrong search type", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();
  const vectorStore = await SingleStoreVectorStore.fromTexts(
    [],
    [],
    new MockEmbeddings(),
    {
      connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
      tableName: "wrong_serch_type_test",
      useVectorIndex: true,
      useFullTextIndex: false,
    }
  );
  for (const searchType of [
    "TEXT_ONLY",
    "FILTER_BY_TEXT",
    "FILTER_BY_VECTOR",
    "WEIGHTED_SUM",
  ]) {
    await vectorStore.setSearchConfig({
      searchStrategy: searchType as SearchStrategy,
    });
    await expect(
      vectorStore.similaritySearch("hello world", 1)
    ).rejects.toThrow(
      "Full text index is required for text-based search strategies."
    );
  }

  await vectorStore.end();
});

test.skip("SingleStoreVectorStore no filter threshold type 1", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();
  const vectorStore = await SingleStoreVectorStore.fromTexts(
    [],
    [],
    new MockEmbeddings(),
    {
      connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
      tableName: "no_filter_threshold_type_test",
      useVectorIndex: true,
      useFullTextIndex: true,
      searchConfig: {
        searchStrategy: "FILTER_BY_TEXT",
      },
    }
  );
  await expect(
    vectorStore.similaritySearch("hello world", 1, { id: 1 })
  ).rejects.toThrow(
    "Filter threshold is required for filter-based search strategies."
  );
  await vectorStore.end();
});

test.skip("SingleStoreVectorStore no filter threshold type 2", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();
  const vectorStore = await SingleStoreVectorStore.fromTexts(
    [],
    [],
    new MockEmbeddings(),
    {
      connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
      tableName: "no_filter_threshold_type_test",
      useVectorIndex: true,
      useFullTextIndex: true,
      searchConfig: {
        searchStrategy: "FILTER_BY_VECTOR",
      },
    }
  );
  await expect(
    vectorStore.similaritySearch("hello world", 1, { id: 1 })
  ).rejects.toThrow(
    "Filter threshold is required for filter-based search strategies."
  );
  await vectorStore.end();
});

test.skip("SingleStoreVectorStore no weight coefs 1", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();
  const vectorStore = await SingleStoreVectorStore.fromTexts(
    [],
    [],
    new MockEmbeddings(),
    {
      connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
      tableName: "no_weighted_sum_params",
      useVectorIndex: true,
      useFullTextIndex: true,
      searchConfig: {
        searchStrategy: "WEIGHTED_SUM",
        vectorWeight: 1,
        textWeight: 1,
      },
    }
  );
  await expect(
    vectorStore.similaritySearch("hello world", 1, { id: 1 })
  ).rejects.toThrow(
    "Text and vector weight and vector select count multiplier are required for weighted sum search strategy."
  );
  await vectorStore.end();
});

test.skip("SingleStoreVectorStore no weight coefs 2", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();
  const vectorStore = await SingleStoreVectorStore.fromTexts(
    [],
    [],
    new MockEmbeddings(),
    {
      connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
      tableName: "no_weighted_sum_params",
      useVectorIndex: true,
      useFullTextIndex: true,
      searchConfig: {
        searchStrategy: "WEIGHTED_SUM",
        textWeight: 1,
        vectorselectCountMultiplier: 10,
      },
    }
  );
  await expect(
    vectorStore.similaritySearch("hello world", 1, { id: 1 })
  ).rejects.toThrow(
    "Text and vector weight and vector select count multiplier are required for weighted sum search strategy."
  );
  await vectorStore.end();
});

test.skip("SingleStoreVectorStore no weight coefs 3", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();
  const vectorStore = await SingleStoreVectorStore.fromTexts(
    [],
    [],
    new MockEmbeddings(),
    {
      connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
      tableName: "no_weighted_sum_params",
      useVectorIndex: true,
      useFullTextIndex: true,
      searchConfig: {
        searchStrategy: "WEIGHTED_SUM",
        vectorWeight: 1,
        vectorselectCountMultiplier: 10,
      },
    }
  );
  await expect(
    vectorStore.similaritySearch("hello world", 1, { id: 1 })
  ).rejects.toThrow(
    "Text and vector weight and vector select count multiplier are required for weighted sum search strategy."
  );
  await vectorStore.end();
});

test.skip("SingleStoreVectorStore text only search", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();
  const vectorStore = await SingleStoreVectorStore.fromTexts(
    weatherTexts,
    weatherMetadata,
    new MockEmbeddings(),
    {
      connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
      tableName: "text_only_search",
      useVectorIndex: false,
      useFullTextIndex: true,
      searchConfig: {
        searchStrategy: "TEXT_ONLY",
      },
    }
  );
  const output = await vectorStore.similaritySearch(
    "rainstorm in parched desert",
    3,
    { count: "1" }
  );
  await vectorStore.end();
  expect(output.length).toEqual(2);
  expect(output[0].pageContent).toContain(
    "In the parched desert, a sudden rainstorm brought relief,"
  );
  expect(output[1].pageContent).toContain(
    "Blanketing the countryside in a soft, pristine layer"
  );
});

test.skip("SingleStoreVectorStore filter by text search", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();
  const vectorStore = await SingleStoreVectorStore.fromTexts(
    weatherTexts,
    weatherMetadata,
    new MockEmbeddings(),
    {
      connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
      tableName: "filter_by_text_search",
      useVectorIndex: false,
      useFullTextIndex: true,
      searchConfig: {
        searchStrategy: "FILTER_BY_TEXT",
        filterThreshold: 0.0001,
      },
    }
  );
  const output = await vectorStore.similaritySearch(
    "rainstorm in parched desert",
    1
  );
  await vectorStore.end();
  expect(output.length).toEqual(1);
  expect(output[0].pageContent).toContain(
    "In the parched desert, a sudden rainstorm brought relief,"
  );
});

test.skip("SingleStoreVectorStore filter by vector search", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();
  const vectorStore = await new SingleStoreVectorStore(new MockEmbeddings(), {
    connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
    tableName: "filter_by_vector_search",
    useVectorIndex: false,
    vectorSize: 2,
    useFullTextIndex: true,
    searchConfig: {
      searchStrategy: "FILTER_BY_VECTOR",
    },
  });
  for (let i = 0; i < weatherTexts.length; i += 1) {
    await vectorStore.addDocuments([
      new Document({
        pageContent: weatherTexts[i],
        metadata: weatherMetadata[i],
      }),
    ]);
  }
  await vectorStore.setSearchConfig({
    searchStrategy: "FILTER_BY_VECTOR",
    filterThreshold: -0.2,
  });
  const output = await vectorStore.similaritySearch(
    "rainstorm in parched desert, rain",
    1,
    { group: "b" }
  );
  await vectorStore.end();
  expect(output.length).toEqual(1);
  expect(output[0].pageContent).toContain(
    "High in the mountains, the rain transformed into a delicate"
  );
});

test.skip("SingleStoreVectorStore filter by text search", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();
  const vectorStore = await new SingleStoreVectorStore(new MockEmbeddings(), {
    connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
    tableName: "filter_by_text_search",
    useVectorIndex: false,
    vectorSize: 2,
    useFullTextIndex: true,
  });
  for (let i = 0; i < weatherTexts.length; i += 1) {
    await vectorStore.addDocuments([
      new Document({
        pageContent: weatherTexts[i],
        metadata: weatherMetadata[i],
      }),
    ]);
  }
  await vectorStore.setSearchConfig({
    searchStrategy: "FILTER_BY_TEXT",
    filterThreshold: 0,
  });
  const output = await vectorStore.similaritySearch(
    "rainstorm in parched desert",
    1
  );
  await vectorStore.end();
  expect(output.length).toEqual(1);
  expect(output[0].pageContent).toContain(
    "In the parched desert, a sudden rainstorm brought relief"
  );
});

test.skip("SingleStoreVectorStore weighted sum search unsupported strategy", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();
  const vectorStore = await new SingleStoreVectorStore(new MockEmbeddings(), {
    connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
    tableName: "filter_by_weighted_sum_unsuported",
    useVectorIndex: true,
    vectorSize: 2,
    useFullTextIndex: true,
    distanceMetric: "EUCLIDEAN_DISTANCE",
    searchConfig: {
      searchStrategy: "WEIGHTED_SUM",
      textWeight: 1,
      vectorWeight: 1,
      vectorselectCountMultiplier: 10,
    },
  });
  await expect(vectorStore.similaritySearch("some text", 1)).rejects.toThrow(
    "Weighted sum search strategy is only available for DOT_PRODUCT distance metric."
  );
  await vectorStore.end();
});

test.skip("SingleStoreVectorStore weighted sum search", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();
  const vectorStore = await new SingleStoreVectorStore(new MockEmbeddings(), {
    connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
    tableName: "filter_by_weighted_sum",
    useVectorIndex: true,
    vectorSize: 2,
    useFullTextIndex: true,
    distanceMetric: "DOT_PRODUCT",
    searchConfig: {
      searchStrategy: "WEIGHTED_SUM",
      textWeight: 1,
      vectorWeight: 1,
      vectorselectCountMultiplier: 10,
    },
  });
  for (let i = 0; i < weatherTexts.length; i += 1) {
    await vectorStore.addDocuments([
      new Document({
        pageContent: weatherTexts[i],
        metadata: weatherMetadata[i],
      }),
    ]);
  }
  const output = await vectorStore.similaritySearch(
    "rainstorm in parched desert, rain",
    1,
    { category: "snow" }
  );
  await vectorStore.end();
  expect(output.length).toEqual(1);
  expect(output[0].pageContent).toContain(
    "Atop the rugged peaks, snow fell with an unyielding"
  );
});
