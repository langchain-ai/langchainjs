import type { Client } from "typesense";
import type { MultiSearchRequestSchema } from "typesense/lib/Typesense/MultiSearch.js";
import type { Document } from "../document.js";
import { Embeddings } from "../embeddings/base.js";
import { VectorStore, VectorStoreRetriever } from "./base.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";

/**
 * Typesense vector store configuration.
 */
export interface TypesenseConfig extends AsyncCallerParams {
  /**
   * Typesense client.
   */
  typesenseClient: Client;
  /**
   * Typesense schema name in which documents will be stored and searched.
   */
  schemaName: string;
  /**
   * Typesense search parameters.
   * @default { q: '*', per_page: 5, query_by: '' }
   */
  searchParams?: MultiSearchRequestSchema;
  /**
   * Column names.
   */
  columnNames?: {
    /**
     * Vector column name.
     * @default 'vec'
     */
    vector?: string;
    /**
     * Page content column name.
     * @default 'text'
     */
    pageContent?: string;
    /**
     * Metadata column names.
     * @default []
     */
    metadataColumnNames?: string[];
  };
  /**
   * Replace default import function.
   * Default import function will update documents if there is a document with the same id.
   * @param data
   * @param collectionName
   */
  import?<T extends Record<string, unknown> = Record<string, unknown>>(
    data: T[],
    collectionName: string
  ): Promise<void>;
}

/**
 * Typesense vector store.
 */
export class Typesense extends VectorStore {
  declare FilterType: Record<string, unknown>;

  private client: Client;

  private schemaName: string;

  private searchParams: MultiSearchRequestSchema;

  private vectorColumnName: string;

  private pageContentColumnName: string;

  private metadataColumnNames: string[];

  private caller: AsyncCaller;

  private import: (
    data: Record<string, unknown>[],
    collectionName: string
  ) => Promise<void>;

  constructor(embeddings: Embeddings, config: TypesenseConfig) {
    super(embeddings, config);

    // Assign config values to class properties.
    this.client = config.typesenseClient;
    this.schemaName = config.schemaName;
    this.searchParams = config.searchParams || {
      q: "*",
      per_page: 5,
      query_by: "",
    };
    this.vectorColumnName = config.columnNames?.vector || "vec";
    this.pageContentColumnName = config.columnNames?.pageContent || "text";
    this.metadataColumnNames = config.columnNames?.metadataColumnNames || [];

    // Assign import function.
    this.import = config.import || this.importToTypesense.bind(this);

    this.caller = new AsyncCaller(config);
  }

  /**
   * Default function to import data to typesense
   * @param data
   * @param collectionName
   */
  async importToTypesense<
    T extends Record<string, unknown> = Record<string, unknown>
  >(data: T[], collectionName: string) {
    const chunkSize = 2000;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);

      await this.caller.call(async () => {
        await this.client
          .collections<T>(collectionName)
          .documents()
          .import(chunk, { action: "emplace", dirty_values: "drop" });
      });
    }
  }

  /**
   * Transform documents to Typesense records.
   * @param documents
   * @returns Typesense records.
   */
  async documentsToTypesenseRecords(
    documents: Document[]
  ): Promise<Record<string, unknown>[]> {
    const pageContents = documents.map((doc) => doc.pageContent);
    const vectors = await this.embeddings.embedDocuments(pageContents);

    const metadatas = documents.map((doc) => doc.metadata);

    const typesenseDocuments = documents.map((doc, index) => {
      const metadata = metadatas[index];
      const objectWithMetadatas: Record<string, unknown> = {};

      this.metadataColumnNames.forEach((metadataColumnName) => {
        objectWithMetadatas[metadataColumnName] = metadata[metadataColumnName];
      });

      return {
        [this.pageContentColumnName]: doc.pageContent,
        [this.vectorColumnName]: vectors[index],
        ...objectWithMetadatas,
      };
    });

    return typesenseDocuments;
  }

  /**
   * Add documents to the vector store.
   * Will be updated if in the metadata there is a document with the same id if is using the default import function.
   * Metadata will be added in the columns of the schema based on metadataColumnNames.
   * @param documents Documents to add.
   */
  async addDocuments(documents: Document[]) {
    const typesenseDocuments = await this.documentsToTypesenseRecords(
      documents
    );
    await this.import(typesenseDocuments, this.schemaName);
  }

  /**
   * Add documents to the vector store.
   * Will be updated if in the metadata there is a document with the same id.
   * Metadata will be added in the columns of the schema based on metadataColumnNames.
   * @param documents Documents to add.
   */
  async addDocumentsWithoutEmbedding(
    documents: (Document & { vector: number[] })[]
  ) {
    const typesenseDocuments = documents.map((doc) => {
      const objectWithMetadatas: Record<string, unknown> = {};

      this.metadataColumnNames.forEach((metadataColumnName) => {
        objectWithMetadatas[metadataColumnName] =
          doc.metadata[metadataColumnName];
      });

      return {
        [this.pageContentColumnName]: doc.pageContent,
        [this.vectorColumnName]: doc.vector,
        ...objectWithMetadatas,
      };
    });

    await this.import(typesenseDocuments, this.schemaName);
  }

  /**
   * Create a vector store from documents.
   * @param docs documents
   * @param embeddings embeddings
   * @param config Typesense configuration
   * @returns Typesense vector store
   * @warning You can omit this method, and only use the constructor and addDocuments.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    config: TypesenseConfig
  ): Promise<Typesense> {
    const instance = new Typesense(embeddings, config);
    await instance.addDocuments(docs);

    return instance;
  }

  /**
   * Create a vector store from texts.
   * @param texts
   * @param metadatas
   * @param embeddings
   * @param config
   * @returns Typesense vector store
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[],
    embeddings: Embeddings,
    config: TypesenseConfig
  ) {
    const instance = new Typesense(embeddings, config);
    const documents: Document[] = texts.map((text, i) => ({
      pageContent: text,
      metadata: metadatas[i] || {},
    }));
    await instance.addDocuments(documents);

    return instance;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async addVectors(_vectors: number[][]) {
    throw new Error("Method not implemented");
  }

  /**
   * Create a retriever from the vector store.
   * @returns Typesense retriever
   */
  asRetriever(
    k?: number,
    filter?: this["FilterType"]
  ): VectorStoreRetriever<this> {
    return new VectorStoreRetriever<this>({
      vectorStore: this,
      filter,
      k,
    });
  }

  /**
   * Transform the Typesense records to documents.
   * @param typesenseRecords
   * @returns documents
   */
  typesenseRecordsToDocuments(
    typesenseRecords: Record<string, unknown>[] | undefined
  ): Document[] {
    const documents =
      typesenseRecords?.map((hit) => {
        const objectWithMetadatas: Record<string, unknown> = {};

        this.metadataColumnNames.forEach((metadataColumnName) => {
          objectWithMetadatas[metadataColumnName] = hit[metadataColumnName];
        });

        const document: Document = {
          pageContent: (hit[this.pageContentColumnName] as string) || "",
          metadata: objectWithMetadatas,
        };
        return document;
      }) || [];

    return documents;
  }

  /**
   * Delete documents from the vector store.
   * @param documentIds ids of the documents to delete
   */
  async deleteDocuments(documentIds: string[]) {
    await this.client
      .collections(this.schemaName)
      .documents()
      .delete({
        filter_by: `id:=${documentIds.join(",")}`,
      });
  }

  /**
   * Search for similar documents with their similarity score.
   * All the documents have 0 as similarity score because Typesense API
   * does not return the similarity score.
   * @param vectorPrompt vector to search for
   * @param k amount of results to return
   * @returns similar documents with their similarity score
   */
  async similaritySearchVectorWithScore(
    vectorPrompt: number[],
    k?: number,
    filter: Partial<MultiSearchRequestSchema> = {}
  ) {
    const amount = k || this.searchParams.per_page || 5;
    const vector_query = `${this.vectorColumnName}:([${vectorPrompt}], k:${amount})`;
    const typesenseResponse = await this.client.multiSearch.perform(
      {
        searches: [
          {
            ...this.searchParams,
            ...filter,
            per_page: amount,
            vector_query,
            collection: this.schemaName,
          },
        ],
      },
      {}
    );
    const results = typesenseResponse.results[0].hits;
    const hits = results?.map((hit) => hit.document) as
      | Record<string, unknown>[]
      | undefined;

    const documents = this.typesenseRecordsToDocuments(hits).map(
      (doc) => [doc, 0] as [Document<Record<string, unknown>>, number]
    );

    return documents;
  }

  /**
   * Search for similar documents with their similarity score. All the documents has 1 as similarity score because Typesense API does not return the similarity score.
   * @param query prompt to search for
   * @returns similar documents with their similarity score
   */
  async similaritySearchWithScore(
    query: string,
    k = 5,
    filter: Partial<MultiSearchRequestSchema> = {}
  ): Promise<[Document<Record<string, unknown>>, number][]> {
    const documents = await this.similaritySearch(query, k, filter);
    return documents.map((doc) => [doc, 1] as [Document, number]);
  }
}
