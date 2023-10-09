/* eslint-disable no-instanceof/no-instanceof */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ALL_VECTOR_METADATA,
  IVectorIndexClient,
  VectorIndexItem,
  CreateVectorIndex,
  VectorUpsertItemBatch,
  VectorDeleteItemBatch,
  VectorSearch,
} from "@gomomento/sdk-core";
import * as uuid from "uuid";
import { Document } from "../document.js";
import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";

export interface DocumentProps {
  ids: string[];
}

export interface MomentoVectorIndexLibArgs {
  client: IVectorIndexClient;
  indexName?: string;
  textField?: string;
  sourceField?: string;
  fields?: string[];
}

export interface DeleteProps {
  ids: string[];
}

export class MomentoVectorIndex extends VectorStore {
  private client: IVectorIndexClient;

  private indexName: string;

  private textField: string;

  _vectorstoreType(): string {
    return "momento";
  }

  constructor(embeddings: Embeddings, args: MomentoVectorIndexLibArgs) {
    super(embeddings, args);

    this.embeddings = embeddings;
    this.client = args.client;
    this.indexName = args.indexName ?? "default";
    this.textField = args.textField ?? "text";
  }

  public getClient(): IVectorIndexClient {
    return this.client;
  }

  private async ensureIndexExists(numDimensions: number): Promise<boolean> {
    const response = await this.client.createIndex(
      this.indexName,
      numDimensions
    );
    if (response instanceof CreateVectorIndex.Success) {
      return true;
    } else if (response instanceof CreateVectorIndex.AlreadyExists) {
      return false;
    } else if (response instanceof CreateVectorIndex.Error) {
      throw new Error(response.toString());
    } else {
      throw new Error(`Unknown response type: ${response.toString()}`);
    }
  }

  private static prepareMetadata(
    metadata: Record<string, any>
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(metadata).map(([key, val]) => [key, JSON.stringify(val)])
    );
  }

  private prepareItemBatch(
    vectors: number[][],
    documents: Document<Record<string, any>>[],
    ids: string[]
  ): VectorIndexItem[] {
    return vectors.map((vector, idx) => ({
      id: ids[idx],
      vector,
      metadata: {
        ...MomentoVectorIndex.prepareMetadata(documents[idx].metadata),
        [this.textField]: documents[idx].pageContent,
      },
    }));
  }

  public async addVectors(
    vectors: number[][],
    documents: Document<Record<string, any>>[],
    documentProps?: DocumentProps
  ): Promise<void | string[]> {
    if (vectors.length === 0) {
      return;
    }

    if (documents.length !== vectors.length) {
      throw new Error(
        `Number of vectors (${vectors.length}) does not equal number of documents (${documents.length})`
      );
    }

    if (vectors.some((v) => v.length !== vectors[0].length)) {
      throw new Error("All vectors must have the same length");
    }

    if (
      documentProps?.ids !== undefined &&
      documentProps.ids.length !== vectors.length
    ) {
      throw new Error(
        `Number of ids (${
          documentProps?.ids?.length || "null"
        }) does not equal number of vectors (${vectors.length})`
      );
    }

    await this.ensureIndexExists(vectors[0].length);
    const documentIds = documentProps?.ids ?? documents.map(() => uuid.v4());

    const batchSize = 128;
    const numBatches = Math.ceil(vectors.length / batchSize);

    // Add each batch of vectors to the index
    for (let i = 0; i < numBatches; i += 1) {
      const [startIndex, endIndex] = [
        i * batchSize,
        Math.min((i + 1) * batchSize, vectors.length),
      ];

      const batchVectors = vectors.slice(startIndex, endIndex);
      const batchDocuments = documents.slice(startIndex, endIndex);
      const batchDocumentIds = documentIds.slice(startIndex, endIndex);

      // Insert the items to the index
      const response = await this.client.upsertItemBatch(
        this.indexName,
        this.prepareItemBatch(batchVectors, batchDocuments, batchDocumentIds)
      );
      if (response instanceof VectorUpsertItemBatch.Success) {
        // eslint-disable-next-line no-continue
        continue;
      } else if (response instanceof VectorUpsertItemBatch.Error) {
        throw new Error(response.toString());
      } else {
        throw new Error(`Unknown response type: ${response.toString()}`);
      }
    }
  }

  /**
   * Adds vectors to the index. Generates embeddings from the documents
   * using the `Embeddings` instance passed to the constructor.
   * @param documents Array of `Document` instances to be added to the index.
   * @returns Promise that resolves when the documents have been added to the index.
   */
  async addDocuments(
    documents: Document[],
    documentProps?: DocumentProps
  ): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      documentProps
    );
  }

  public async delete(params: DeleteProps): Promise<void> {
    const response = await this.client.deleteItemBatch(
      this.indexName,
      params.ids
    );
    if (response instanceof VectorDeleteItemBatch.Success) {
      // pass
    } else if (response instanceof VectorDeleteItemBatch.Error) {
      throw new Error(response.toString());
    } else {
      throw new Error(`Unknown response type: ${response.toString()}`);
    }
  }

  public async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document<Record<string, any>>, number][]> {
    const response = await this.client.search(this.indexName, query, {
      topK: k,
      metadataFields: ALL_VECTOR_METADATA,
    });
    if (response instanceof VectorSearch.Success) {
      if (response.hits === undefined) {
        return [];
      }

      return response.hits().map((hit) => [
        new Document({
          pageContent: hit.metadata[this.textField] ?? "",
          metadata: Object.fromEntries(
            Object.entries(hit.metadata)
              .filter(([key]) => key !== this.textField)
              .map(([key, val]) => [key, JSON.parse(val)])
          ),
        }),
        hit.distance,
      ]);
    } else if (response instanceof VectorSearch.Error) {
      throw new Error(response.toString());
    } else {
      throw new Error(`Unknown response type: ${response.toString()}`);
    }
  }

  public static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: MomentoVectorIndexLibArgs,
    documentProps?: DocumentProps
  ): Promise<MomentoVectorIndex> {
    if (Array.isArray(metadatas) && texts.length !== metadatas.length) {
      throw new Error(
        `Number of texts (${texts.length}) does not equal number of metadatas (${metadatas.length})`
      );
    }

    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const metadata: object = Array.isArray(metadatas)
        ? metadatas[i]
        : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return await this.fromDocuments(docs, embeddings, dbConfig, documentProps);
  }

  public static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: MomentoVectorIndexLibArgs,
    documentProps?: DocumentProps
  ): Promise<MomentoVectorIndex> {
    const vectorStore = new MomentoVectorIndex(embeddings, dbConfig);
    await vectorStore.addDocuments(docs, documentProps);
    return vectorStore;
  }
}
