import { QdrantClient } from "@qdrant/js-client-rest";
import type { Schemas as QdrantSchemas } from "@qdrant/js-client-rest";
import { v4 as uuid } from "uuid";
import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface for the arguments that can be passed to the
 * `QdrantVectorStore` constructor. It includes options for specifying a
 * `QdrantClient` instance, the URL and API key for a Qdrant database, and
 * the name and configuration for a collection.
 */
export interface QdrantLibArgs {
  client?: QdrantClient;
  url?: string;
  apiKey?: string;
  collectionName?: string;
  collectionConfig?: QdrantSchemas["CreateCollection"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customPayload?: Record<string, any>[];
}

export type QdrantAddDocumentOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customPayload: Record<string, any>[];
};

/**
 * Type for the response returned by a search operation in the Qdrant
 * database. It includes the score and payload (metadata and content) for
 * each point (document) in the search results.
 */
type QdrantSearchResponse = QdrantSchemas["ScoredPoint"] & {
  payload: {
    metadata: object;
    content: string;
  };
};

/**
 * Class that extends the `VectorStore` base class to interact with a
 * Qdrant database. It includes methods for adding documents and vectors
 * to the Qdrant database, searching for similar vectors, and ensuring the
 * existence of a collection in the database.
 */
export class QdrantVectorStore extends VectorStore {
  get lc_secrets(): { [key: string]: string } {
    return {
      apiKey: "QDRANT_API_KEY",
      url: "QDRANT_URL",
    };
  }

  client: QdrantClient;

  collectionName: string;

  collectionConfig?: QdrantSchemas["CreateCollection"];

  _vectorstoreType(): string {
    return "qdrant";
  }

  constructor(embeddings: Embeddings, args: QdrantLibArgs) {
    super(embeddings, args);

    const url = args.url ?? getEnvironmentVariable("QDRANT_URL");
    const apiKey = args.apiKey ?? getEnvironmentVariable("QDRANT_API_KEY");

    if (!args.client && !url) {
      throw new Error("Qdrant client or url address must be set.");
    }

    this.client =
      args.client ||
      new QdrantClient({
        url,
        apiKey,
      });

    this.collectionName = args.collectionName ?? "documents";

    this.collectionConfig = args.collectionConfig;
  }

  /**
   * Method to add documents to the Qdrant database. It generates vectors
   * from the documents using the `Embeddings` instance and then adds the
   * vectors to the database.
   * @param documents Array of `Document` instances to be added to the Qdrant database.
   * @param documentOptions Optional `QdrantAddDocumentOptions` which has a list of JSON objects for extra querying
   * @returns Promise that resolves when the documents have been added to the database.
   */
  async addDocuments(
    documents: Document[],
    documentOptions?: QdrantAddDocumentOptions
  ): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      documentOptions
    );
  }

  /**
   * Method to add vectors to the Qdrant database. Each vector is associated
   * with a document, which is stored as the payload for a point in the
   * database.
   * @param vectors Array of vectors to be added to the Qdrant database.
   * @param documents Array of `Document` instances associated with the vectors.
   * @param documentOptions Optional `QdrantAddDocumentOptions` which has a list of JSON objects for extra querying
   * @returns Promise that resolves when the vectors have been added to the database.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    documentOptions?: QdrantAddDocumentOptions
  ): Promise<void> {
    if (vectors.length === 0) {
      return;
    }

    await this.ensureCollection();

    const points = vectors.map((embedding, idx) => ({
      id: uuid(),
      vector: embedding,
      payload: {
        content: documents[idx].pageContent,
        metadata: documents[idx].metadata,
        customPayload: documentOptions?.customPayload[idx],
      },
    }));

    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const error = new Error(
        `${e?.status ?? "Undefined error code"} ${e?.message}: ${
          e?.data?.status?.error
        }`
      );
      throw error;
    }
  }

  /**
   * Method to search for vectors in the Qdrant database that are similar to
   * a given query vector. The search results include the score and payload
   * (metadata and content) for each similar vector.
   * @param query Query vector to search for similar vectors in the Qdrant database.
   * @param k Optional number of similar vectors to return. If not specified, all similar vectors are returned.
   * @param filter Optional filter to apply to the search results.
   * @returns Promise that resolves with an array of tuples, where each tuple includes a `Document` instance and a score for a similar vector.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k?: number,
    filter?: QdrantSchemas["Filter"]
  ): Promise<[Document, number][]> {
    if (!query) {
      return [];
    }

    await this.ensureCollection();

    const results = await this.client.search(this.collectionName, {
      vector: query,
      limit: k,
      filter,
    });

    const result: [Document, number][] = (
      results as QdrantSearchResponse[]
    ).map((res) => [
      new Document({
        metadata: res.payload.metadata,
        pageContent: res.payload.content,
      }),
      res.score,
    ]);

    return result;
  }

  /**
   * Method to ensure the existence of a collection in the Qdrant database.
   * If the collection does not exist, it is created.
   * @returns Promise that resolves when the existence of the collection has been ensured.
   */
  async ensureCollection() {
    const response = await this.client.getCollections();

    const collectionNames = response.collections.map(
      (collection) => collection.name
    );

    if (!collectionNames.includes(this.collectionName)) {
      const collectionConfig = this.collectionConfig ?? {
        vectors: {
          size: (await this.embeddings.embedQuery("test")).length,
          distance: "Cosine",
        },
      };
      await this.client.createCollection(this.collectionName, collectionConfig);
    }
  }

  /**
   * Static method to create a `QdrantVectorStore` instance from texts. Each
   * text is associated with metadata and converted to a `Document`
   * instance, which is then added to the Qdrant database.
   * @param texts Array of texts to be converted to `Document` instances and added to the Qdrant database.
   * @param metadatas Array or single object of metadata to be associated with the texts.
   * @param embeddings `Embeddings` instance used to generate vectors from the texts.
   * @param dbConfig `QdrantLibArgs` instance specifying the configuration for the Qdrant database.
   * @returns Promise that resolves with a new `QdrantVectorStore` instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: QdrantLibArgs
  ): Promise<QdrantVectorStore> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return QdrantVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method to create a `QdrantVectorStore` instance from `Document`
   * instances. The documents are added to the Qdrant database.
   * @param docs Array of `Document` instances to be added to the Qdrant database.
   * @param embeddings `Embeddings` instance used to generate vectors from the documents.
   * @param dbConfig `QdrantLibArgs` instance specifying the configuration for the Qdrant database.
   * @returns Promise that resolves with a new `QdrantVectorStore` instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: QdrantLibArgs
  ): Promise<QdrantVectorStore> {
    const instance = new this(embeddings, dbConfig);
    if (dbConfig.customPayload) {
      const documentOptions = {
        customPayload: dbConfig?.customPayload,
      };
      await instance.addDocuments(docs, documentOptions);
    } else {
      await instance.addDocuments(docs);
    }
    return instance;
  }

  /**
   * Static method to create a `QdrantVectorStore` instance from an existing
   * collection in the Qdrant database.
   * @param embeddings `Embeddings` instance used to generate vectors from the documents in the collection.
   * @param dbConfig `QdrantLibArgs` instance specifying the configuration for the Qdrant database.
   * @returns Promise that resolves with a new `QdrantVectorStore` instance.
   */
  static async fromExistingCollection(
    embeddings: Embeddings,
    dbConfig: QdrantLibArgs
  ): Promise<QdrantVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.ensureCollection();
    return instance;
  }
}
