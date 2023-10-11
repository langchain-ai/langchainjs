/* eslint-disable no-process-env */
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { Neo4jVectorStore } from "../neo4jvector.js";
import { Document } from "../../document.js";

const OS_TOKEN_COUNT = 1536;

const texts = ["foo", "bar", "baz"];

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

  for (const index of allIndexes) {
    await store.query(`DROP INDEX ${index.name}`);
  }
}

test("Test fromTexts", async () => {
  const url = process.env.NEO4J_URI as string;
  const username = process.env.NEO4J_USERNAME as string;
  const password = process.env.NEO4J_PASSWORD as string;

  expect(url).toBeDefined();
  expect(username).toBeDefined();
  expect(password).toBeDefined();

  const embeddings = new FakeEmbeddingsWithOsDimension();
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
  neo4jVectorStore.close();
});
