import type { CloseVectorSaveableVectorStore } from "closevector-common";

import { Embeddings } from "../../embeddings/base.js";
import { Document } from "../../document.js";
import { SaveableVectorStore } from "../base.js";

type CloseVectorCredentials = {
  key?: string,
  secret?: string,
}

/**
 * package closevector is largely based on hnswlib.ts in the current folder with the following exceptions:
 * 1. It uses a modified version of hnswlib-node to ensure the generated index can be loaded by closevector_web.ts.
 * 2. It adds features to upload and download the index to/from the CDN provided by CloseVector.
 *
 * For more information, check out https://closevector-docs.getmegaportal.com/
 */

/**
 * Class that implements a vector store using Hierarchical Navigable Small
 * World (HNSW) graphs. It extends the SaveableVectorStore class and
 * provides methods for adding documents and vectors, performing
 * similarity searches, and saving and loading the vector store.
 */
export abstract class CloseVector<
    CloseVectorHNSWImplementation extends CloseVectorSaveableVectorStore,
> extends SaveableVectorStore {
  declare FilterType: (doc: Document) => boolean;

  _instance?: CloseVectorHNSWImplementation;

  // credentials will not be saved to disk
  credentials?: CloseVectorCredentials;

  _vectorstoreType(): string {
    return "closevector";
  }

  constructor(
    embeddings: Embeddings,
    args: {
      space: "l2" | "ip" | "cosine";
      numDimensions?: number;
      maxElements?: number;
    },
    credentials?: CloseVectorCredentials
  ) {
    super(embeddings, args);
    this.credentials = credentials;
  }

  public get instance(): CloseVectorHNSWImplementation {
    if (!this._instance) {
      throw new Error(
        "Vector store not initialised yet. Try calling `addTexts` first."
      );
    }
    return this._instance;
  }

  protected set instance(instance: CloseVectorHNSWImplementation) {
    this._instance = instance;
  }

  /**
   * Method to add documents to the vector store. It first converts the
   * documents to vectors using the embeddings, then adds the vectors to the
   * vector store.
   * @param documents The documents to be added to the vector store.
   * @returns A Promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    await this.instance.addDocuments(documents);
  }

  async saveToCloud(
    _options: Record<string, unknown>
  ) {
    throw new Error("not implemented");
  }

  /**
   * Method to save the vector store to a directory. It saves the HNSW
   * index, the arguments, and the document store to the directory.
   * @param directory The directory to which to save the vector store. In CloseVector, we use IndexedDB to mock the file system. Therefore, this parameter is can be treated as a key to the contents stored.
   * @returns A Promise that resolves when the vector store has been saved.
   */
  async save(directory: string): Promise<void> {
    await this.instance.save(directory);
  }

  static async loadFromCloud(
    _options: Record<string, unknown>
  ): Promise<SaveableVectorStore> {
    throw new Error("not implemented");
  }

  static async load(
    _directory: string,
    _embeddings: Embeddings,
    _credentials?: CloseVectorCredentials
  ): Promise<SaveableVectorStore> {
    throw new Error("not implemented");
  }

  /**
   * Method to add vectors to the vector store. It first initializes the
   * index if it hasn't been initialized yet, then adds the vectors to the
   * index and the documents to the document store.
   * @param vectors The vectors to be added to the vector store.
   * @param documents The documents corresponding to the vectors.
   * @returns A Promise that resolves when the vectors and documents have been added.
   */
  async addVectors(vectors: number[][], documents: Document[]) {
    await this.instance.addVectors(vectors, documents);
  }

  /**
   * Method to perform a similarity search in the vector store using a query
   * vector. It returns the k most similar documents along with their
   * similarity scores. An optional filter function can be provided to
   * filter the documents.
   * @param query The query vector.
   * @param k The number of most similar documents to return.
   * @param filter An optional filter function to filter the documents.
   * @returns A Promise that resolves to an array of tuples, where each tuple contains a document and its similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ) {
    const resp = await this.instance.similaritySearchVectorWithScore(
      query,
      k,
      filter
        ? (x: { pageContent: string; metadata: Record<string, unknown>; }) =>
            filter?.({
              pageContent: x.pageContent,
              metadata: x.metadata || {},
            }) || false
        : undefined
    );
    const mapped: [Document<Record<string, unknown>>, number][] = resp.map(
      (x) => [
        new Document({
          pageContent: x[0].pageContent,
          metadata: x[0].metadata || {},
        }),
        x[1],
      ]
    );
    return mapped;
  }

  /**
   * Method to delete the vector store from a directory. It deletes the
   * hnswlib.index file, the docstore.json file, and the args.json file from
   * the directory.
   * @param params An object with a directory property that specifies the directory from which to delete the vector store.
   * @returns A Promise that resolves when the vector store has been deleted.
   */
  async delete(params: { directory: string }) {
    return await this.instance.delete(params);
  }

  static textsToDocuments(texts: string[], metadatas: object[] | object) {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return docs;
  }

  /**
   * Static method to create a new CloseVectorNode instance from texts and metadata.
   * It creates a new Document instance for each text and metadata, then
   * calls the fromDocuments method to create the HNSWLib instance.
   * @param _texts The texts to be used to create the documents.
   * @param _metadatas The metadata to be used to create the documents.
   * @param _embeddings The embeddings to be used by the HNSWLib instance.
   * @param _args An optional configuration object for the HNSWLib instance.
   * @param _credential An optional credential object for the CloseVector API.
   * @returns A Promise that resolves to a new CloseVectorNode instance.
   */
  static async fromTexts (
    _texts: string[],
    _metadatas: object[] | object,
    _embeddings: Embeddings,
    _args?: Record<string, unknown>,
    _credential?: CloseVectorCredentials
  ): Promise<CloseVector<CloseVectorSaveableVectorStore>> {
    throw new Error("not implemented");
  }

  /**
   * Static method to create a new CloseVectorNode instance from documents. It
   * creates a new CloseVectorNode instance, adds the documents to it, then returns
   * the instance.
   * @param _docs The documents to be added to the HNSWLib instance.
   * @param _embeddings The embeddings to be used by the HNSWLib instance.
   * @param _args An optional configuration object for the HNSWLib instance.
   * @param _credentials An optional credential object for the CloseVector API.
   * @returns A Promise that resolves to a new CloseVectorNode instance.
   */
  static async fromDocuments(
    _docs: Document[],
    _embeddings: Embeddings,
    _args?: Record<string, unknown>,
    _credentials?: CloseVectorCredentials
  ): Promise<CloseVector<CloseVectorSaveableVectorStore>> {
    throw new Error("not implemented");
  }

  static async imports(): Promise<{
    HierarchicalNSW: unknown;
  }> {
    throw new Error("not implemented");
  }
}
