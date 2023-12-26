import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

/**
 * Database config for your vectorstore.
 */
export interface VectorstoreIntegrationParams {}

/**
 * Class for managing and operating vector search applications with
 * Tigris, an open-source Serverless NoSQL Database and Search Platform.
 */
export class VectorstoreIntegration extends VectorStore {
  // Replace
  _vectorstoreType(): string {
    return "vectorstore_integration";
  }

  constructor(
    embeddings: EmbeddingsInterface,
    params: VectorstoreIntegrationParams
  ) {
    super(embeddings, params);
    this.embeddings = embeddings;
  }

  /**
   * Replace with any secrets this class passes to `super`.
   * See {@link ../../langchain-cohere/src/chat_model.ts} for
   * an example.
   */
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "API_KEY_NAME",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "API_KEY_NAME",
    };
  }

  /**
   * Method to add an array of documents to the vectorstore.
   *
   * Useful to override in case your vectorstore doesn't work directly with embeddings.
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
   * Method to add raw vectors to the vectorstore.
   */
  async addVectors(
    _vectors: number[][],
    _documents: Document[],
    _options?: { ids?: string[] } | string[]
  ) {
    throw new Error("Not implemented.");
  }

  /**
   * Method to perform a similarity search over the vectorstore and return
   * the k most similar vectors along with their similarity scores.
   */
  async similaritySearchVectorWithScore(
    _query: number[],
    _k: number,
    _filter?: object
  ): Promise<[Document, number][]> {
    throw new Error("Not implemented.");
  }

  /**
   * Static method to create a new instance of the vectorstore from an
   * array of Document instances.
   *
   * Other common static initializer names are fromExistingIndex, initialize, and fromTexts.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: VectorstoreIntegrationParams
  ): Promise<VectorstoreIntegration> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
