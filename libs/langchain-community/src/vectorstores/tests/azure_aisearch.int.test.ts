/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { jest, test, expect } from "@jest/globals";
import { setTimeout } from "timers/promises";
import { SearchIndexClient, AzureKeyCredential } from "@azure/search-documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "../../utils/testing.js";
import {
  AzureAISearchVectorStore,
  AzureAISearchQueryType,
  AzureAISearchDocumentMetadata,
} from "../azure_aisearch.js";

const INDEX_NAME = "vectorsearch";
const DOCUMENT_IDS: string[] = ["1", "2", "3", "4"];

/*
 * To run these tests, you need have an Azure AI Search instance running.
 * You can deploy a free version on Azure Portal without any cost, following
 * this guide:
 * https://learn.microsoft.com/azure/search/search-create-service-portal
 *
 * Once you have the instance running, you need to set the following environment
 * variables before running the test:
 * - AZURE_AISEARCH_ENDPOINT
 * - AZURE_AISEARCH_KEY
 * - AZURE_OPENAI_API_KEY
 * - AZURE_OPENAI_API_INSTANCE_NAME
 * - AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
 * - AZURE_OPENAI_API_VERSION
 *
 * A regular OpenAI key can also be used instead of Azure OpenAI.
 */

describe.skip("AzureAISearchVectorStore e2e integration tests", () => {
  let indexClient: SearchIndexClient;

  beforeEach(async () => {
    expect(process.env.AZURE_AISEARCH_ENDPOINT).toBeDefined();
    expect(process.env.AZURE_AISEARCH_KEY).toBeDefined();

    // Note: when using Azure OpenAI, you have to also set these variables
    // in addition to the API key:
    // - AZURE_OPENAI_API_INSTANCE_NAME
    // - AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
    // - AZURE_OPENAI_API_VERSION
    expect(
      process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY
    ).toBeDefined();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const endpoint = process.env.AZURE_AISEARCH_ENDPOINT!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const credential = new AzureKeyCredential(process.env.AZURE_AISEARCH_KEY!);
    indexClient = new SearchIndexClient(endpoint, credential);

    try {
      await indexClient.deleteIndex(INDEX_NAME);
    } catch (e) {
      // Ignore if documents or index do not exist
    }
  });

  afterAll(async () => {
    try {
      await indexClient.deleteIndex(INDEX_NAME);
    } catch (e) {
      // Ignore
    }
  });

  test("performs similarity search", async () => {
    const vectorStore = new AzureAISearchVectorStore(new OpenAIEmbeddings(), {
      indexName: INDEX_NAME,
      search: {
        type: AzureAISearchQueryType.SemanticHybrid,
      },
    });

    expect(vectorStore).toBeDefined();

    await vectorStore.addDocuments(
      [
        {
          pageContent: "This book is about politics",
          metadata: {
            source: "doc1",
            attributes: [{ key: "a", value: "1" }],
          },
        },
        {
          pageContent: "Cats sleeps a lot.",
          metadata: {
            source: "doc2",
            attributes: [{ key: "b", value: "1" }],
          },
        },
        {
          pageContent: "Sandwiches taste good.",
          metadata: {
            source: "doc3",
            attributes: [{ key: "c", value: "1" }],
          },
        },
        {
          pageContent: "The house is open",
          metadata: {
            source: "doc4",
            attributes: [
              { key: "d", value: "1" },
              { key: "e", value: "2" },
            ],
          },
        },
      ],
      { ids: DOCUMENT_IDS }
    );

    // Wait for the documents to be indexed
    await setTimeout(1000);

    const results: Document[] = await vectorStore.similaritySearch(
      "sandwich",
      1
    );

    expect(results.length).toEqual(1);
    expect(results).toMatchObject([
      {
        pageContent: "Sandwiches taste good.",
        metadata: {
          source: "doc3",
          attributes: [{ key: "c", value: "1" }],
        },
      },
    ]);

    const retriever = vectorStore.asRetriever({});

    const docs = await retriever.getRelevantDocuments("house");
    expect(docs).toBeDefined();
    expect(docs[0]).toMatchObject({
      pageContent: "The house is open",
      metadata: {
        source: "doc4",
        attributes: [
          { key: "d", value: "1" },
          { key: "e", value: "2" },
        ],
      },
    });
  });

  test("performs max marginal relevance search", async () => {
    const texts = ["foo", "foo", "fox"];
    const vectorStore = await AzureAISearchVectorStore.fromTexts(
      texts,
      {},
      new OpenAIEmbeddings(),
      {
        indexName: INDEX_NAME,
        search: {
          type: "similarity",
        },
      }
    );

    // Wait for the documents to be indexed
    await setTimeout(1000);

    const output = await vectorStore.maxMarginalRelevanceSearch("foo", {
      k: 10,
      fetchK: 20,
      lambda: 0.1,
    });

    expect(output).toHaveLength(texts.length);

    const actual = output.map((doc) => doc.pageContent);
    const expected = ["foo", "fox", "foo"];
    expect(actual).toEqual(expected);

    const standardRetriever = await vectorStore.asRetriever();

    const standardRetrieverOutput =
      await standardRetriever.getRelevantDocuments("foo");
    expect(output).toHaveLength(texts.length);

    const standardRetrieverActual = standardRetrieverOutput.map(
      (doc) => doc.pageContent
    );
    const standardRetrieverExpected = ["foo", "foo", "fox"];
    expect(standardRetrieverActual).toEqual(standardRetrieverExpected);

    const retriever = await vectorStore.asRetriever({
      searchType: "mmr",
      searchKwargs: {
        fetchK: 20,
        lambda: 0.1,
      },
    });

    const retrieverOutput = await retriever.getRelevantDocuments("foo");
    expect(output).toHaveLength(texts.length);

    const retrieverActual = retrieverOutput.map((doc) => doc.pageContent);
    const retrieverExpected = ["foo", "fox", "foo"];
    expect(retrieverActual).toEqual(retrieverExpected);

    const similarity = await vectorStore.similaritySearchWithScore("foo", 1);
    expect(similarity.length).toBe(1);
  });
});

describe.skip("AzureAISearchVectorStore integration tests", () => {
  const embeddings = new FakeEmbeddings();
  let indexClient: SearchIndexClient;

  const embedMock = jest
    .spyOn(FakeEmbeddings.prototype, "embedDocuments")
    .mockImplementation(async (documents: string[]) =>
      documents.map(() => Array(1536).fill(0.2))
    );

  const queryMock = jest
    .spyOn(FakeEmbeddings.prototype, "embedQuery")
    .mockImplementation(async () => Array(1536).fill(0.2));

  beforeEach(() => {
    embedMock.mockClear();
    queryMock.mockClear();
  });

  beforeAll(async () => {
    expect(process.env.AZURE_AISEARCH_ENDPOINT).toBeDefined();
    expect(process.env.AZURE_AISEARCH_KEY).toBeDefined();

    indexClient = new SearchIndexClient(
      process.env.AZURE_AISEARCH_ENDPOINT!,
      new AzureKeyCredential(process.env.AZURE_AISEARCH_KEY!)
    );

    try {
      await indexClient.deleteIndex(INDEX_NAME);
    } catch (e) {
      // Ignore
    }
  });

  afterAll(async () => {
    try {
      await indexClient.deleteIndex(INDEX_NAME);
    } catch (e) {
      // Ignore
    }
  });

  test("test index creation if not exists", async () => {
    const newName = "index-undefined";

    try {
      await indexClient.deleteIndex(newName);
    } catch (e) {
      // Ignore
    }

    const store = new AzureAISearchVectorStore(embeddings, {
      indexName: newName,
      search: {
        type: AzureAISearchQueryType.Similarity,
      },
    });
    await store.addDocuments([
      {
        pageContent: "foo",
        metadata: {
          source: "bar",
        },
      },
    ]);

    const index = await indexClient.getIndex(newName);
    expect(index).toBeDefined();

    // Cleanup
    try {
      await indexClient.deleteIndex(newName);
    } catch (e) {
      // Ignore
    }
  });

  test("test add document", async () => {
    const id = new Date().getTime().toString();
    const store = new AzureAISearchVectorStore(embeddings, {
      indexName: INDEX_NAME,
      search: {
        type: AzureAISearchQueryType.Similarity,
      },
    });

    const result = await store.addDocuments(
      [
        new Document<AzureAISearchDocumentMetadata>({
          pageContent: "test index document upload text",
          metadata: {
            source: "test",
          },
        }),
      ],
      {
        ids: [id],
      }
    );

    expect(result).toHaveLength(1);
  });

  test("test search document", async () => {
    const store = await AzureAISearchVectorStore.fromTexts(
      ["test index document upload text"],
      [],
      embeddings,
      {
        indexName: INDEX_NAME,
        search: {
          type: AzureAISearchQueryType.Similarity,
        },
      }
    );

    // Need to wait a bit for the document to be indexed
    await setTimeout(1000);

    const docs = await store.similaritySearch("test", 1);

    expect(docs).toHaveLength(1);
    expect(docs[0].metadata.embeddings).not.toBeDefined();
  });

  test("test search document with included embeddings", async () => {
    const store = await AzureAISearchVectorStore.fromTexts(
      ["test index document upload text"],
      [],
      embeddings,
      {
        indexName: INDEX_NAME,
        search: {
          type: AzureAISearchQueryType.Similarity,
        },
      }
    );

    // Need to wait a bit for the document to be indexed
    await setTimeout(1000);

    const docs = await store.similaritySearch("test", 1, {
      includeEmbeddings: true,
    });

    expect(docs).toHaveLength(1);
    expect(docs[0].metadata.embedding).toBeDefined();
  });

  test("test search document with filter", async () => {
    const store = await AzureAISearchVectorStore.fromTexts(
      ["test index document upload text"],
      [
        {
          source: "filter-test",
          attributes: [{ key: "abc", value: "def" }],
        },
      ],
      embeddings,
      {
        indexName: INDEX_NAME,
        search: {
          type: AzureAISearchQueryType.Similarity,
        },
      }
    );

    // Need to wait a bit for the document to be indexed
    await setTimeout(1000);

    const bySource = await store.similaritySearch("test", 1, {
      filterExpression: "metadata/source eq 'filter-test'",
    });
    const byAttr = await store.similaritySearch("test", 1, {
      filterExpression:
        "metadata/attributes/any(t: t/key eq 'abc' and t/value eq 'def')",
    });

    expect(bySource).toHaveLength(1);
    expect(byAttr).toHaveLength(1);
  });

  test("test search document with query key", async () => {
    const store = new AzureAISearchVectorStore(embeddings, {
      indexName: INDEX_NAME,
      search: {
        type: AzureAISearchQueryType.Similarity,
      },
    });

    const result = await store.similaritySearch("test", 1);

    // Need to wait a bit for the document to be indexed
    await setTimeout(1000);

    expect(result).toBeDefined();
  });

  test("test delete documents by id", async () => {
    const id = new Date().getTime().toString();
    const store = new AzureAISearchVectorStore(embeddings, {
      indexName: INDEX_NAME,
      search: {
        type: AzureAISearchQueryType.Similarity,
      },
    });

    await store.addDocuments(
      [
        new Document<AzureAISearchDocumentMetadata>({
          pageContent: "test index document upload text",
          metadata: {
            source: "deleteById",
          },
        }),
      ],
      {
        ids: [id],
      }
    );

    // Need to wait a bit for the document to be indexed
    await setTimeout(1000);

    await store.delete({ ids: id });

    // Wait a bit for the index to be updated
    await setTimeout(1000);

    const docs = await store.similaritySearch("test", 1, {
      filterExpression: "metadata/source eq 'deleteById'",
    });

    expect(docs).toHaveLength(0);
  });

  test("test delete documents by filter", async () => {
    const id = new Date().getTime().toString();
    const source = `test-${id}`;

    const store = new AzureAISearchVectorStore(embeddings, {
      indexName: INDEX_NAME,
      search: {
        type: AzureAISearchQueryType.Similarity,
      },
    });

    await store.addDocuments([
      new Document<AzureAISearchDocumentMetadata>({
        pageContent: "test index document upload text",
        metadata: {
          source,
        },
      }),
    ]);

    // Need to wait a bit for the document to be indexed
    await setTimeout(1000);

    await store.delete({
      filter: {
        filterExpression: `metadata/source eq '${source}'`,
      },
    });

    // Wait a bit for the index to be updated
    await setTimeout(1000);

    const docs = await store.similaritySearch("test", 1, {
      filterExpression: `metadata/source eq '${source}'`,
    });

    expect(docs).toHaveLength(0);
  });
});
