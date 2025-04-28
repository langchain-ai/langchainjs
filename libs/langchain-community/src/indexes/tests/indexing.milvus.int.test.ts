import { Document } from "@langchain/core/documents";
import { index } from "@langchain/core/indexing";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";

import { OpenAIEmbeddings } from "@langchain/openai";
import { InMemoryRecordManager } from "../memory.js";
import { sleep } from "../../utils/time.js";
import { Milvus } from "../../vectorstores/milvus.js";

let collectionName: string;
let embeddings: OpenAIEmbeddings;
// https://docs.zilliz.com/docs/quick-start-1#create-a-collection
const MILVUS_ADDRESS = "";
const MILVUS_TOKEN = "";

const OPEN_AI_API_KEY = "";

class MockLoader extends BaseDocumentLoader {
  constructor(public docs: Document[]) {
    super();
  }

  async load(): Promise<Document[]> {
    return this.docs;
  }
}

describe.skip("Indexing API", () => {
  let recordManager: InMemoryRecordManager;
  let vectorstore: Milvus;

  beforeAll(async () => {
    embeddings = new OpenAIEmbeddings({
      openAIApiKey: OPEN_AI_API_KEY,
    });
    collectionName = `test_collection_${Math.random()
      .toString(36)
      .substring(7)}`;
    recordManager = new InMemoryRecordManager();

    await recordManager.createSchema();

    vectorstore = await new Milvus(embeddings, {
      collectionName,
      autoId: false,
      clientConfig: {
        address: MILVUS_ADDRESS,
        token: MILVUS_TOKEN,
      },
    });
  });

  afterEach(async () => {
    recordManager.records.clear();
    await index({
      docsSource: [],
      recordManager,
      vectorStore: vectorstore,
      options: {
        cleanup: "full",
      },
    });
    // Because the indexing API relies on timestamps, without this the tests are flaky.
    await sleep(1000);
  });

  test("Test indexing sanity", async () => {
    const docs = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    const initialIndexingResult = await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
    });

    expect(initialIndexingResult.numAdded).toEqual(3);

    const secondIndexingResult = await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
    });
    expect(secondIndexingResult.numAdded).toEqual(0);
    expect(secondIndexingResult.numSkipped).toEqual(3);

    const query = "Document";
    const result = await vectorstore.similaritySearch(query, 3);
    expect(recordManager.records.size).toEqual(3);
    const resultMetadatas = result.map(({ metadata }) => metadata);
    expect(resultMetadatas.length).toBe(3);
  });

  test("Test indexing with cleanup full", async () => {
    const docs = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
      options: { cleanup: "full" },
    });

    const secondIndexingResult = await index({
      docsSource: [],
      recordManager,
      vectorStore: vectorstore,
      options: {
        cleanup: "full",
      },
    });
    expect(secondIndexingResult.numAdded).toEqual(0);
    expect(secondIndexingResult.numSkipped).toEqual(0);
    expect(secondIndexingResult.numDeleted).toEqual(3);

    expect(recordManager.records.size).toEqual(0);
  });

  test("Test indexing with updated page content (full)", async () => {
    const docs = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
      options: {
        cleanup: "full",
      },
    });

    docs[0].pageContent = "Document 0 Content";

    const secondIndexingResult = await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
      options: {
        cleanup: "full",
      },
    });
    expect(secondIndexingResult.numAdded).toEqual(1);
    expect(secondIndexingResult.numDeleted).toEqual(1);
    expect(secondIndexingResult.numSkipped).toEqual(2);

    const query = "Document";
    const result = await vectorstore.similaritySearch(query, 3);
    expect(recordManager.records.size).toEqual(3);
    const resultMetadatas = result.map(({ metadata }) => metadata);
    expect(resultMetadatas.length).toBe(3);
  });

  test("Test indexing with updated metadata (full)", async () => {
    const docs: Document[] = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
      options: {
        cleanup: "full",
      },
    });

    docs[0].metadata.field = "value";

    const secondIndexingResult = await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
      options: {
        cleanup: "full",
      },
    });
    expect(secondIndexingResult.numAdded).toEqual(1);
    expect(secondIndexingResult.numDeleted).toEqual(1);
    expect(secondIndexingResult.numSkipped).toEqual(2);
  });

  test("Test indexing with updated page content (incremental)", async () => {
    const docs = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
      options: {
        cleanup: "incremental",
        sourceIdKey: "source",
      },
    });

    docs[0].pageContent = "Document 0 Content";

    const secondIndexingResult = await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
      options: {
        cleanup: "incremental",
        sourceIdKey: "source",
      },
    });
    expect(secondIndexingResult.numAdded).toEqual(1);
    expect(secondIndexingResult.numDeleted).toEqual(1);
    expect(secondIndexingResult.numSkipped).toEqual(2);

    const query = "Document";
    const result = await vectorstore.similaritySearch(query, 3);
    expect(recordManager.records.size).toEqual(3);
    const resultMetadatas = result.map(({ metadata }) => metadata);
    expect(resultMetadatas.length).toBe(3);
  });

  test("Test indexing with updated metadata (incremental)", async () => {
    const docs: Document[] = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
      options: {
        cleanup: "incremental",
        sourceIdKey: "source",
      },
    });

    docs[0].metadata.field = "value";

    const secondIndexingResult = await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
      options: {
        cleanup: "incremental",
        sourceIdKey: "source",
      },
    });
    expect(secondIndexingResult.numAdded).toEqual(1);
    expect(secondIndexingResult.numDeleted).toEqual(1);
    expect(secondIndexingResult.numSkipped).toEqual(2);
  });

  test("Test indexing with updated page content without cleanup", async () => {
    const docs: Document[] = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index({ docsSource: docs, recordManager, vectorStore: vectorstore });

    docs[0].pageContent = "Document 0 Content";

    const secondIndexingResult = await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
    });
    expect(secondIndexingResult.numAdded).toEqual(1);
    expect(secondIndexingResult.numDeleted).toEqual(0);
    expect(secondIndexingResult.numSkipped).toEqual(2);
  });

  test("Test indexing with forced update", async () => {
    const docs: Document[] = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
      options: {
        cleanup: "full",
      },
    });

    // Force update is mostly useful when you are re-indexing with updated embeddings.
    // Some vector stores (such as Milvus) do not support overwriting records
    // and will throw an error if you try to do so. We must therefore delete the records
    // before re-indexing.
    await vectorstore.delete({ ids: Array.from(recordManager.records.keys()) });

    const secondIndexingResult = await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
      options: {
        cleanup: "full",
        forceUpdate: true,
      },
    });

    expect(secondIndexingResult.numAdded).toEqual(0);
    expect(secondIndexingResult.numDeleted).toEqual(0);
    expect(secondIndexingResult.numUpdated).toEqual(3);
  });

  test("Test indexing with duplicate documents", async () => {
    const docs: Document[] = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
    ];

    const indexingResult = await index({
      docsSource: docs,
      recordManager,
      vectorStore: vectorstore,
    });

    expect(indexingResult.numAdded).toEqual(1);
    expect(indexingResult.numSkipped).toEqual(0);
  });

  test("Test indexing with doc loader", async () => {
    const mockLoader = new MockLoader([
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ]);
    const indexingResult = await index({
      docsSource: mockLoader,
      recordManager,
      vectorStore: vectorstore,
    });
    expect(indexingResult.numAdded).toEqual(3);
  });
});
