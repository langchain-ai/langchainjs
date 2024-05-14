/* eslint-disable no-process-env */
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import {
  DOCUMENTS,
  TYPE_1_FILTERING_TEST_CASES,
  TYPE_2_FILTERING_TEST_CASES,
  TYPE_3_FILTERING_TEST_CASES,
  TYPE_4_FILTERING_TEST_CASES,
} from "./neo4j_vector.fixtures.js";
import { Neo4jVectorStore } from "../neo4j_vector.js";

const OS_TOKEN_COUNT = 1536;

const texts = ["foo", "bar", "baz", "This is the end of the world!"];

class FakeEmbeddingsWithOsDimension extends FakeEmbeddings {
  async embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.resolve(
      documents.map((_, i) =>
        Array(OS_TOKEN_COUNT - 1)
          .fill(1.0)
          .concat([i + 1.0])
      )
    );
  }

  async embedQuery(text: string): Promise<number[]> {
    const index = texts.indexOf(text);

    if (index !== -1) {
      return Array(OS_TOKEN_COUNT - 1)
        .fill(1.0)
        .concat([index + 1]);
    } else {
      throw new Error(`Text '${text}' not found in the 'texts' array.`);
    }
  }
}

async function dropVectorIndexes(store: Neo4jVectorStore) {
  const allIndexes = await store.query(`
      SHOW INDEXES YIELD name, type
      WHERE type = "VECTOR"
      RETURN name
    `);

  if (allIndexes) {
    for (const index of allIndexes) {
      await store.query(`DROP INDEX ${index.name}`);
    }
  }
}

describe("Neo4j Vector", () => {
  test.skip("Test fromTexts", async () => {
    const url = process.env.NEO4J_URI as string;
    const username = process.env.NEO4J_USERNAME as string;
    const password = process.env.NEO4J_PASSWORD as string;

    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const embeddings = new FakeEmbeddingsWithOsDimension();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadatas: any[] = [];

    const neo4jVectorStore = await Neo4jVectorStore.fromTexts(
      texts,
      metadatas,
      embeddings,
      {
        url,
        username,
        password,
        preDeleteCollection: true,
      }
    );

    const output = await neo4jVectorStore.similaritySearch("foo", 2);

    const expectedResult = [
      new Document({
        pageContent: "foo",
        metadata: {},
      }),
      new Document({
        pageContent: "bar",
        metadata: {},
      }),
    ];

    expect(output).toStrictEqual(expectedResult);
    await dropVectorIndexes(neo4jVectorStore);
    await neo4jVectorStore.close();
  });

  test.skip("Test fromTexts Hybrid", async () => {
    const url = process.env.NEO4J_URI as string;
    const username = process.env.NEO4J_USERNAME as string;
    const password = process.env.NEO4J_PASSWORD as string;

    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const embeddings = new FakeEmbeddingsWithOsDimension();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadatas: any[] = [];

    const neo4jVectorStore = await Neo4jVectorStore.fromTexts(
      texts,
      metadatas,
      embeddings,
      {
        url,
        username,
        password,
        preDeleteCollection: true,
        searchType: "hybrid",
      }
    );

    const output = await neo4jVectorStore.similaritySearch("foo", 2);

    const expectedResult = [
      new Document({
        pageContent: "foo",
        metadata: {},
      }),
      new Document({
        pageContent: "bar",
        metadata: {},
      }),
    ];

    expect(output).toStrictEqual(expectedResult);
    await dropVectorIndexes(neo4jVectorStore);
    await neo4jVectorStore.close();
  });

  test.skip("Test fromExistingIndex", async () => {
    const url = process.env.NEO4J_URI as string;
    const username = process.env.NEO4J_USERNAME as string;
    const password = process.env.NEO4J_PASSWORD as string;

    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const embeddings = new FakeEmbeddingsWithOsDimension();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadatas: any[] = [];

    const neo4jVectorStore = await Neo4jVectorStore.fromTexts(
      texts,
      metadatas,
      embeddings,
      {
        url,
        username,
        password,
        indexName: "vector",
        preDeleteCollection: true,
      }
    );

    const existingIndex = await Neo4jVectorStore.fromExistingIndex(embeddings, {
      url,
      username,
      password,
      indexName: "vector",
    });

    const output = await existingIndex.similaritySearch("foo", 2);

    const expectedResult = [
      new Document({
        pageContent: "foo",
        metadata: {},
      }),
      new Document({
        pageContent: "bar",
        metadata: {},
      }),
    ];

    expect(output).toStrictEqual(expectedResult);
    await dropVectorIndexes(neo4jVectorStore);
    await neo4jVectorStore.close();
    await existingIndex.close();
  });

  test.skip("Test fromExistingIndex Hybrid", async () => {
    const url = process.env.NEO4J_URI as string;
    const username = process.env.NEO4J_USERNAME as string;
    const password = process.env.NEO4J_PASSWORD as string;

    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const embeddings = new FakeEmbeddingsWithOsDimension();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadatas: any[] = [];

    const neo4jVectorStore = await Neo4jVectorStore.fromTexts(
      texts,
      metadatas,
      embeddings,
      {
        url,
        username,
        password,
        indexName: "vector",
        keywordIndexName: "keyword",
        searchType: "hybrid",
        preDeleteCollection: true,
      }
    );

    const existingIndex = await Neo4jVectorStore.fromExistingIndex(embeddings, {
      url,
      username,
      password,
      indexName: "vector",
      keywordIndexName: "keyword",
      searchType: "hybrid",
    });

    const output = await existingIndex.similaritySearch("foo", 2);

    const expectedResult = [
      new Document({
        pageContent: "foo",
        metadata: {},
      }),
      new Document({
        pageContent: "bar",
        metadata: {},
      }),
    ];

    expect(output).toStrictEqual(expectedResult);
    await dropVectorIndexes(neo4jVectorStore);
    await neo4jVectorStore.close();
    await existingIndex.close();
  });

  test.skip("Test retrievalQuery", async () => {
    const url = process.env.NEO4J_URI as string;
    const username = process.env.NEO4J_USERNAME as string;
    const password = process.env.NEO4J_PASSWORD as string;

    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const embeddings = new FakeEmbeddingsWithOsDimension();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadatas: any[] = [];

    const neo4jVectorStore = await Neo4jVectorStore.fromTexts(
      texts,
      metadatas,
      embeddings,
      {
        url,
        username,
        password,
        indexName: "vector",
        preDeleteCollection: true,
        retrievalQuery:
          "RETURN node.text AS text, score, {foo:'bar'} AS metadata",
      }
    );

    const output = await neo4jVectorStore.similaritySearch("foo", 2);

    const expectedResult = [
      new Document({
        pageContent: "foo",
        metadata: { foo: "bar" },
      }),
      new Document({
        pageContent: "bar",
        metadata: { foo: "bar" },
      }),
    ];

    expect(output).toStrictEqual(expectedResult);
    await dropVectorIndexes(neo4jVectorStore);
    await neo4jVectorStore.close();
  });

  test.skip("Test fromExistingGraph", async () => {
    const url = process.env.NEO4J_URI as string;
    const username = process.env.NEO4J_USERNAME as string;
    const password = process.env.NEO4J_PASSWORD as string;

    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const embeddings = new FakeEmbeddingsWithOsDimension();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadatas: any[] = [];

    const neo4jVectorStore = await Neo4jVectorStore.fromTexts(
      texts,
      metadatas,
      embeddings,
      {
        url,
        username,
        password,
        indexName: "vector",
        preDeleteCollection: true,
      }
    );

    await neo4jVectorStore.query("MATCH (n) DETACH DELETE n");

    await neo4jVectorStore.query(
      "CREATE (:Test {name:'Foo'}), (:Test {name:'Bar', foo:'bar'})"
    );

    const existingGraph = await Neo4jVectorStore.fromExistingGraph(embeddings, {
      url,
      username,
      password,
      indexName: "vector1",
      nodeLabel: "Test",
      textNodeProperties: ["name"],
      embeddingNodeProperty: "embedding",
    });

    const output = await existingGraph.similaritySearch("foo", 2);

    const expectedResult = [
      new Document({
        pageContent: "\nname: Foo",
        metadata: {},
      }),
      new Document({
        pageContent: "\nname: Bar",
        metadata: { foo: "bar" },
      }),
    ];

    expect(output).toStrictEqual(expectedResult);
    await dropVectorIndexes(neo4jVectorStore);
    await neo4jVectorStore.close();
    await existingGraph.close();
  });

  test.skip("Test fromExistingGraph multiple properties", async () => {
    const url = process.env.NEO4J_URI as string;
    const username = process.env.NEO4J_USERNAME as string;
    const password = process.env.NEO4J_PASSWORD as string;

    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const embeddings = new FakeEmbeddingsWithOsDimension();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadatas: any[] = [];

    const neo4jVectorStore = await Neo4jVectorStore.fromTexts(
      texts,
      metadatas,
      embeddings,
      {
        url,
        username,
        password,
        indexName: "vector",
        preDeleteCollection: true,
      }
    );

    await neo4jVectorStore.query("MATCH (n) DETACH DELETE n");

    await neo4jVectorStore.query(
      "CREATE (:Test {name:'Foo', name2:'Fooz'}), (:Test {name:'Bar', foo:'bar'})"
    );

    const existingGraph = await Neo4jVectorStore.fromExistingGraph(embeddings, {
      url,
      username,
      password,
      indexName: "vector1",
      nodeLabel: "Test",
      textNodeProperties: ["name", "name2"],
      embeddingNodeProperty: "embedding",
    });

    const output = await existingGraph.similaritySearch("foo", 2);

    const expectedResult = [
      new Document({
        pageContent: "\nname: Foo\nname2: Fooz",
        metadata: {},
      }),
      new Document({
        pageContent: "\nname: Bar\nname2: ",
        metadata: { foo: "bar" },
      }),
    ];

    expect(output).toStrictEqual(expectedResult);
    await dropVectorIndexes(neo4jVectorStore);
    await neo4jVectorStore.close();
    await existingGraph.close();
  });

  test.skip("Test fromExistingGraph multiple properties hybrid", async () => {
    const url = process.env.NEO4J_URI as string;
    const username = process.env.NEO4J_USERNAME as string;
    const password = process.env.NEO4J_PASSWORD as string;

    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const embeddings = new FakeEmbeddingsWithOsDimension();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadatas: any[] = [];

    const neo4jVectorStore = await Neo4jVectorStore.fromTexts(
      texts,
      metadatas,
      embeddings,
      {
        url,
        username,
        password,
        indexName: "vector",
        preDeleteCollection: true,
      }
    );

    await neo4jVectorStore.query("MATCH (n) DETACH DELETE n");

    await neo4jVectorStore.query(
      "CREATE (:Test {name:'Foo', name2:'Fooz'}), (:Test {name:'Bar', foo:'bar'})"
    );

    const existingGraph = await Neo4jVectorStore.fromExistingGraph(embeddings, {
      url,
      username,
      password,
      indexName: "vector1",
      nodeLabel: "Test",
      textNodeProperties: ["name", "name2"],
      embeddingNodeProperty: "embedding",
      searchType: "hybrid",
    });

    const output = await existingGraph.similaritySearch("foo", 2);

    const expectedResult = [
      new Document({
        pageContent: "\nname: Foo\nname2: Fooz",
        metadata: {},
      }),
      new Document({
        pageContent: "\nname: Bar\nname2: ",
        metadata: { foo: "bar" },
      }),
    ];

    expect(output).toStrictEqual(expectedResult);
    await dropVectorIndexes(neo4jVectorStore);
    await neo4jVectorStore.close();
    await existingGraph.close();
  });

  test.skip("Test escape lucene characters", async () => {
    const url = process.env.NEO4J_URI as string;
    const username = process.env.NEO4J_USERNAME as string;
    const password = process.env.NEO4J_PASSWORD as string;

    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const embeddings = new FakeEmbeddingsWithOsDimension();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadatas: any[] = [];

    const neo4jVectorStore = await Neo4jVectorStore.fromTexts(
      texts,
      metadatas,
      embeddings,
      {
        url,
        username,
        password,
        preDeleteCollection: true,
        searchType: "hybrid",
      }
    );

    const output = await neo4jVectorStore.similaritySearch(
      "This is the end of the world!",
      2
    );

    const expectedResult = [
      new Document({
        pageContent: "This is the end of the world!",
        metadata: {},
      }),
      new Document({
        pageContent: "baz",
        metadata: {},
      }),
    ];

    expect(output).toStrictEqual(expectedResult);
    await dropVectorIndexes(neo4jVectorStore);
    await neo4jVectorStore.close();
  });

  test.skip("Test multiple index", async () => {
    const url = process.env.NEO4J_URI as string;
    const username = process.env.NEO4J_USERNAME as string;
    const password = process.env.NEO4J_PASSWORD as string;

    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const embeddings = new FakeEmbeddingsWithOsDimension();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadatas: any[] = [];

    const foo = await Neo4jVectorStore.fromTexts(
      ["foo"],
      metadatas,
      embeddings,
      {
        url,
        username,
        password,
        indexName: "Foo",
        nodeLabel: "Foo",
      }
    );

    const bar = await Neo4jVectorStore.fromTexts(
      ["bar"],
      metadatas,
      embeddings,
      {
        url,
        username,
        password,
        indexName: "Bar",
        nodeLabel: "Bar",
      }
    );

    const fooExistingIndex = await Neo4jVectorStore.fromExistingIndex(
      embeddings,
      {
        url,
        username,
        password,
        indexName: "Foo",
      }
    );

    const fooOutput = await fooExistingIndex.similaritySearch(
      "This is the end of the world!",
      1
    );
    const fooExpectedResult = [
      new Document({
        pageContent: "foo",
        metadata: {},
      }),
    ];
    expect(fooOutput).toStrictEqual(fooExpectedResult);

    const barExistingIndex = await Neo4jVectorStore.fromExistingIndex(
      embeddings,
      {
        url,
        username,
        password,
        indexName: "Bar",
      }
    );

    const barOutput = await barExistingIndex.similaritySearch(
      "This is the end of the world!",
      1
    );
    const barExpectedResult = [
      new Document({
        pageContent: "bar",
        metadata: {},
      }),
    ];
    expect(barOutput).toStrictEqual(barExpectedResult);

    await dropVectorIndexes(barExistingIndex);
    await foo.close();
    await bar.close();
    await barExistingIndex.close();
    await fooExistingIndex.close();
  });

  test.skip("Test retrievalQuery with params", async () => {
    const url = process.env.NEO4J_URI as string;
    const username = process.env.NEO4J_USERNAME as string;
    const password = process.env.NEO4J_PASSWORD as string;

    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const embeddings = new FakeEmbeddingsWithOsDimension();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadatas: any[] = [];

    const neo4jVectorStore = await Neo4jVectorStore.fromTexts(
      texts,
      metadatas,
      embeddings,
      {
        url,
        username,
        password,
        indexName: "vector",
        preDeleteCollection: true,
        retrievalQuery: "RETURN $test AS text, score, {foo:$test1} AS metadata",
      }
    );

    const output = await neo4jVectorStore.similaritySearch("foo", 2, {
      test: "test",
      test1: "test1",
    });

    const expectedResult = [
      new Document({
        pageContent: "test",
        metadata: { foo: "test1" },
      }),
      new Document({
        pageContent: "test",
        metadata: { foo: "test1" },
      }),
    ];

    expect(output).toStrictEqual(expectedResult);
    await dropVectorIndexes(neo4jVectorStore);
    await neo4jVectorStore.close();
  });

  test.skip("Test metadata filters", async () => {
    const url = process.env.NEO4J_URI as string;
    const username = process.env.NEO4J_USERNAME as string;
    const password = process.env.NEO4J_PASSWORD as string;

    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const docsearch = await Neo4jVectorStore.fromDocuments(
      DOCUMENTS,
      new FakeEmbeddings(),
      {
        url,
        username,
        password,
        indexName: "vector",
        preDeleteCollection: true,
      }
    );

    const examples = [
      ...TYPE_1_FILTERING_TEST_CASES,
      ...TYPE_2_FILTERING_TEST_CASES,
      ...TYPE_3_FILTERING_TEST_CASES,
      ...TYPE_4_FILTERING_TEST_CASES,
    ];

    for (const example of examples) {
      const { filter, expected } = example;
      const output = await docsearch.similaritySearch("Foo", 4, { filter });
      const adjustedIndices = expected.map((index) => index - 1);
      const expectedOutput = adjustedIndices.map((index) => DOCUMENTS[index]);

      // We don't return id properties from similarity search by default
      // Also remove any key where the value is null
      for (const doc of expectedOutput) {
        if ("id" in doc.metadata) {
          delete doc.metadata.id;
        }
        const keysWithNull = Object.keys(doc.metadata).filter(
          (key) => doc.metadata[key] === null
        );
        for (const key of keysWithNull) {
          delete doc.metadata[key];
        }
      }

      console.log("OUTPUT:", output);
      console.log("EXPECTED OUTPUT:", expectedOutput);

      expect(output.length).toEqual(expectedOutput.length);
      expect(output).toEqual(expect.arrayContaining(expectedOutput));
    }
  });
});
