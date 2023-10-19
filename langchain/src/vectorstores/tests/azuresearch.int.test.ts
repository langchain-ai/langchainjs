/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "@jest/globals";
import { SearchClient, SearchIndexClient, AzureKeyCredential } from "@azure/search-documents";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { AzureSearchStore, AzureSearchDocument } from "../azuresearch.js";

const indexName = 'test-int';

describe("AzureSearch", () => {
  const embeddings = new OpenAIEmbeddings();
  let indexClient: SearchIndexClient;
  let client: SearchClient<AzureSearchDocument>;
  let queryClient: SearchClient<AzureSearchDocument>;

  beforeAll(async () => {
    console.log(process.env.OPENAI_API_KEY);
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
    const oldStats = await indexClient.getIndexStatistics(indexName);

    await AzureSearchStore.fromTexts(
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

    const newStats = await indexClient.getIndexStatistics(indexName);

    expect(newStats.documentCount - oldStats.documentCount).toBe(1);
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
    const store = await AzureSearchStore.fromTexts(
      ["test index document upload text"],
      [{
        source: 'filter-test',
        attributes: [{ key: 'abc', value: 'def' }],
      }],
      embeddings,
      {
        client: queryClient,
        search: {
          type: 'similarity',
        }
      }
    );

    const result = await store.similaritySearch("test", 1);

    expect(result).toHaveLength(1);
  });
});
