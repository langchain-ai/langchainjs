import * as uuid from "uuid";

import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

/**
 * Type definition for the arguments required to initialize a
 * TigrisVectorStore instance.
 */
export type TigrisLibArgs = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  index: any;
};

/**
 * Class for managing and operating vector search applications with
 * Tigris, an open-source Serverless NoSQL Database and Search Platform.
 */
export class TigrisVectorStore extends VectorStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  index?: any;

  _vectorstoreType(): string {
    return "tigris";
  }

  constructor(embeddings: Embeddings, args: TigrisLibArgs) {
    super(embeddings, args);

    this.embeddings = embeddings;
    this.index = args.index;
  }

  /**
   * Method to add an array of documents to the Tigris database.
   * @param documents An array of Document instances to be added to the Tigris database.
   * @param options Optional parameter that can either be an array of string IDs or an object with a property 'ids' that is an array of string IDs.
   * @returns A Promise that resolves when the documents have been added to the Tigris database.
   */
  async addDocuments(
    documents: Document[],
    options?: { ids?: string[] } | string[]
  ): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Method to add vectors to the Tigris database.
   * @param vectors An array of vectors to be added to the Tigris database.
   * @param documents An array of Document instances corresponding to the vectors.
   * @param options Optional parameter that can either be an array of string IDs or an object with a property 'ids' that is an array of string IDs.
   * @returns A Promise that resolves when the vectors have been added to the Tigris database.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] } | string[]
  ) {
    if (vectors.length === 0) {
      return;
    }

    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and metadatas must have the same length`);
    }

    const ids = Array.isArray(options) ? options : options?.ids;
    const documentIds = ids == null ? documents.map(() => uuid.v4()) : ids;
    await this.index?.addDocumentsWithVectors({
      ids: documentIds,
      embeddings: vectors,
      documents: documents.map(({ metadata, pageContent }) => ({
        content: pageContent,
        metadata,
      })),
    });
  }

  /**
   * Method to perform a similarity search in the Tigris database and return
   * the k most similar vectors along with their similarity scores.
   * @param query The query vector.
   * @param k The number of most similar vectors to return.
   * @param filter Optional filter object to apply during the search.
   * @returns A Promise that resolves to an array of tuples, each containing a Document and its similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: object
  ) {
    const result = await this.index?.similaritySearchVectorWithScore({
      query,
      k,
      filter,
    });

    if (!result) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.map(([document, score]: [any, any]) => [
      new Document({
        pageContent: document.content,
        metadata: document.metadata,
      }),
      score,
    ]) as [Document, number][];
  }

  /**
   * Static method to create a new instance of TigrisVectorStore from an
   * array of texts.
   * @param texts An array of texts to be converted into Document instances and added to the Tigris database.
   * @param metadatas Either an array of metadata objects or a single metadata object to be associated with the texts.
   * @param embeddings An instance of Embeddings to be used for embedding the texts.
   * @param dbConfig An instance of TigrisLibArgs to be used for configuring the Tigris database.
   * @returns A Promise that resolves to a new instance of TigrisVectorStore.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: TigrisLibArgs
  ): Promise<TigrisVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return TigrisVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method to create a new instance of TigrisVectorStore from an
   * array of Document instances.
   * @param docs An array of Document instances to be added to the Tigris database.
   * @param embeddings An instance of Embeddings to be used for embedding the documents.
   * @param dbConfig An instance of TigrisLibArgs to be used for configuring the Tigris database.
   * @returns A Promise that resolves to a new instance of TigrisVectorStore.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: TigrisLibArgs
  ): Promise<TigrisVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Static method to create a new instance of TigrisVectorStore from an
   * existing index.
   * @param embeddings An instance of Embeddings to be used for embedding the documents.
   * @param dbConfig An instance of TigrisLibArgs to be used for configuring the Tigris database.
   * @returns A Promise that resolves to a new instance of TigrisVectorStore.
   */
  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: TigrisLibArgs
  ): Promise<TigrisVectorStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
