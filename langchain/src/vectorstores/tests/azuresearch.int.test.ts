/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { jest, describe, expect, test } from "@jest/globals";
import { SearchClient, SearchIndexClient, AzureKeyCredential } from "@azure/search-documents";
import { AzureSearchStore, AzureSearchDocument, AzureSearchDocumentMetadata } from "../azuresearch.js";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { Document } from "../../document.js";

const indexName = 'test-int';

describe("AzureSearch", () => {
  const embeddings = new FakeEmbeddings();
  let indexClient: SearchIndexClient;
  let client: SearchClient<AzureSearchDocument>;
  let queryClient: SearchClient<AzureSearchDocument>;

  const embedMock = jest
    .spyOn(FakeEmbeddings.prototype, 'embedDocuments')
    .mockImplementation(
      async (documents: string[]) => documents.map(() => Array(1536).fill(0.2))
    );

  const queryMock = jest
    .spyOn(FakeEmbeddings.prototype, 'embedQuery')
    .mockImplementation(
      async () => Array(1536).fill(0.2)
    );

  beforeEach(() => {
    embedMock.mockClear();
    queryMock.mockClear();
  });

  beforeAll(async () => {
    client = new SearchClient(
      process.env.AZURE_SEARCH_ENDPOINT!,
      indexName,
      new AzureKeyCredential(process.env.AZURE_SEARCH_ADMIN_KEY!),
    );

    queryClient = new SearchClient(
      process.env.AZURE_SEARCH_ENDPOINT!,
      indexName,
      new AzureKeyCredential(process.env.AZURE_SEARCH_QUERY_KEY!),
    );

    indexClient = new SearchIndexClient(
      process.env.AZURE_SEARCH_ENDPOINT!,
      new AzureKeyCredential(process.env.AZURE_SEARCH_ADMIN_KEY!),
    );

    await AzureSearchStore.create(
      {
        client: {
          endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
          indexName,
          credential: process.env.AZURE_SEARCH_ADMIN_KEY!,
        },
        search: {
          type: 'similarity',
        }
      },
      embeddings
    );
  });

  test("test index creation if not exists", async () => {
    const newName = 'index-undefined';

    try {
      await indexClient.deleteIndex(newName);
    } catch (e) {
      // ignore
    }

    await AzureSearchStore.create(
      {
        client: {
          endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
          indexName: newName,
          credential: process.env.AZURE_SEARCH_ADMIN_KEY!,
        },
        search: {
          type: 'similarity',
        }
      },
      embeddings
    );

    const index = await indexClient.getIndex(newName);
    expect(index).toBeDefined();
  });

  test("test index document upload", async () => {
    const key = new Date().getTime().toString();
    const store = await AzureSearchStore.create({
      client,
      search: {
        type: 'similarity',
      }
    }, embeddings);

    const result = await store.addDocuments([
      new Document<AzureSearchDocumentMetadata>({
        pageContent: "test index document upload text",
        metadata: {
          source: 'test',
        }
      })
    ], {
      keys: [key],
    });

    expect(result).toHaveLength(1);
  });

  test("test index document search", async () => {
    const store = await AzureSearchStore.fromTexts(
      ["test index document upload text"],
      [],
      embeddings,
      {
        client,
        search: {
          type: 'similarity',
        }
      }
    );

    const docs = await store.similaritySearch("test", 1);

    expect(docs).toHaveLength(1);
  });

  test("test index document search with filter", async () => {
    const store = await AzureSearchStore.fromTexts(
      ["test index document upload text"],
      [{
        source: 'filter-test',
        attributes: [{ key: 'abc', value: 'def' }],
      }],
      embeddings,
      {
        client,
        search: {
          type: 'similarity',
        }
      }
    );

    const bySource = await store.similaritySearch("test", 1, "metadata/source eq 'filter-test'");
    const byAttr = await store.similaritySearch("test", 1, "metadata/attributes/any(t: t/key eq 'abc' and t/value eq 'def')");

    expect(bySource).toHaveLength(1);
    expect(byAttr).toHaveLength(1);
  });

  test("test index document search with query key", async () => {
    const store = await AzureSearchStore.create(
      {
        client: queryClient,
        search: {
          type: 'similarity',
        }
      },
      embeddings,
    );

    const result = await store.similaritySearch("test", 1);

    expect(result).toBeDefined();
  });

  test("test delete documents by key", async () => {
    const key = new Date().getTime().toString();
    const store = await AzureSearchStore.create({
      client,
      search: {
        type: 'similarity',
      }
    }, embeddings);

    await store.addDocuments([
      new Document<AzureSearchDocumentMetadata>({
        pageContent: "test index document upload text",
        metadata: {
          source: 'test',
        }
      })
    ], {
      keys: [key],
    });

    const deleteResult = await store.deleteByKey(key);

    expect(deleteResult).toHaveLength(1);
  });

  test("test delete documents by filter", async () => {
    const key = new Date().getTime().toString();
    const source = `test-${key}`;

    const store = await AzureSearchStore.create({
      client,
      search: {
        type: 'similarity',
      }
    }, embeddings);

    await store.addDocuments([
      new Document<AzureSearchDocumentMetadata>({
        pageContent: "test index document upload text",
        metadata: {
          source,
        }
      })
    ]);

    const deleteResult = await store.deleteMany(`metadata/source eq '${source}'`);

    expect(deleteResult).toHaveLength(1);
  });
});
