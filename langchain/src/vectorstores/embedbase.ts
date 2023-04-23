import type { EmbedbaseClient, BatchAddDocument } from "embedbase-js";
import { FakeEmbeddings } from "../embeddings/fake.js";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

const batch = async <T>(
  myList: BatchAddDocument[],
  fn: (chunk: BatchAddDocument[]) => Promise<T[]>
) => {
  const batchSize = 100;
  return Promise.all(
    myList
      .reduce((acc: BatchAddDocument[][], _, i) => {
        if (i % batchSize === 0) {
          acc.push(myList.slice(i, i + batchSize));
        }
        return acc;
      }, [])
      .map(fn)
  );
};

export interface EmbedbaseVectorStoreArgs {
  embedbase: EmbedbaseClient;
  datasetId?: string;
}

export class EmbedbaseVectorStore extends VectorStore {
  embedbase: EmbedbaseClient;

  public datasetId: string;

  constructor(args: EmbedbaseVectorStoreArgs) {
    super(new FakeEmbeddings(), args.embedbase);

    this.embedbase = args.embedbase;
    this.datasetId = args.datasetId || "default";
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const chunks = documents.map((document) => ({
      data: document.pageContent,
      metadata: document.metadata,
    }));
    await batch(chunks, (chunk) =>
      this.embedbase.dataset(this.datasetId).batchAdd(chunk)
    );
  }

  async similaritySearch(
    query: string,
    k = 4,
    _: object | undefined = undefined
  ): Promise<Document[]> {
    const results = await this.embedbase
      .dataset(this.datasetId)
      .search(query, { limit: k });

    return results.map((result) => ({
      pageContent: result.data,
      metadata: result.metadata as never,
    }));
  }

  async similaritySearchWithScore(
    query: string,
    k = 4,
    _: object | undefined = undefined
  ): Promise<[Document, number][]> {
    const results = await this.embedbase
      .dataset(this.datasetId)
      .search(query, { limit: k });

    return results.map((result) => [
      {
        pageContent: result.data,
        metadata: result.metadata as never,
      },
      result.similiarity,
    ]);
  }

  async addVectors(_: number[][], __: Document[]): Promise<void> {
    throw new Error("Not implemented");
  }

  async similaritySearchVectorWithScore(
    _: number[],
    __: number
  ): Promise<[Document, number][]> {
    throw new Error("Not implemented");
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    _: Embeddings,
    dbConfig: EmbedbaseVectorStoreArgs
  ): Promise<EmbedbaseVectorStore> {
    const documents = texts.map((text, idx) => ({
      pageContent: text,
      metadata: Array.isArray(metadatas) ? metadatas[idx] : metadatas,
    }));
    const store = new EmbedbaseVectorStore(dbConfig);
    await store.addDocuments(documents);
    return store;
  }

  static async fromDocuments(
    docs: Document[],
    _: Embeddings,
    dbConfig: EmbedbaseVectorStoreArgs
  ): Promise<EmbedbaseVectorStore> {
    const store = new EmbedbaseVectorStore(dbConfig);
    await store.addDocuments(docs);
    return store;
  }

  static async fromExistingIndex(
    _: Embeddings,
    dbConfig: EmbedbaseVectorStoreArgs
  ): Promise<EmbedbaseVectorStore> {
    return new EmbedbaseVectorStore(dbConfig);
  }

  static async imports(): Promise<{
    EmbedbaseClient: typeof EmbedbaseClient;
  }> {
    try {
      const { EmbedbaseClient } = await import("embedbase-js");
      return { EmbedbaseClient };
    } catch (e) {
      throw new Error(
        "Please install embedbase-js as a dependency with, e.g. `npm install -S embedbase-js`"
      );
    }
  }
}
