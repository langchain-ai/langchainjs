import type { Client } from "typesense";
import type { MultiSearchRequestSchema } from "typesense/lib/Typesense/MultiSearch.js";
import type {
  SearchResponseHit,
  DocumentSchema,
} from "typesense/lib/Typesense/Documents.js";
import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";

/**
 * Interface for the response hit from a vector search in Typesense.
 */
interface VectorSearchResponseHit<T extends DocumentSchema>
  extends SearchResponseHit<T> {
  vector_distance?: number;
}

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
  declare FilterType: Partial<MultiSearchRequestSchema>;

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

  _vectorstoreType(): string {
    return "typesense";
  }

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
  private async importToTypesense<
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
  _documentsToTypesenseRecords(
    documents: Document[],
    vectors: number[][]
  ): Record<string, unknown>[] {
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
   * Transform the Typesense records to documents.
   * @param typesenseRecords
   * @returns documents
   */
  _typesenseRecordsToDocuments(
    typesenseRecords:
      | { document?: Record<string, unknown>; vector_distance: number }[]
      | undefined
  ): [Document, number][] {
    const documents: [Document, number][] =
      typesenseRecords?.map((hit) => {
        const objectWithMetadatas: Record<string, unknown> = {};
        const hitDoc = hit.document || {};
        this.metadataColumnNames.forEach((metadataColumnName) => {
          objectWithMetadatas[metadataColumnName] = hitDoc[metadataColumnName];
        });

        const document: Document = {
          pageContent: (hitDoc[this.pageContentColumnName] as string) || "",
          metadata: objectWithMetadatas,
        };
        return [document, hit.vector_distance];
      }) || [];

    return documents;
  }

  /**
   * Add documents to the vector store.
   * Will be updated if in the metadata there is a document with the same id if is using the default import function.
   * Metadata will be added in the columns of the schema based on metadataColumnNames.
   * @param documents Documents to add.
   */
  async addDocuments(documents: Document[]) {
    const typesenseDocuments = this._documentsToTypesenseRecords(
      documents,
      await this.embeddings.embedDocuments(
        documents.map((doc) => doc.pageContent)
      )
    );
    await this.import(typesenseDocuments, this.schemaName);
  }

  /**
   * Adds vectors to the vector store.
   * @param vectors Vectors to add.
   * @param documents Documents associated with the vectors.
   */
  async addVectors(vectors: number[][], documents: Document[]) {
    const typesenseDocuments = this._documentsToTypesenseRecords(
      documents,
      vectors
    );
    await this.import(typesenseDocuments, this.schemaName);
  }

  /**
   * Search for similar documents with their similarity score.
   * @param vectorPrompt vector to search for
   * @param k amount of results to return
   * @returns similar documents with their similarity score
   */
  async similaritySearchVectorWithScore(
    vectorPrompt: number[],
    k?: number,
    filter: this["FilterType"] = {}
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

    const hits = results?.map((hit: VectorSearchResponseHit<object>) => ({
      document: hit?.document || {},
      vector_distance: hit?.vector_distance || 2,
    })) as
      | { document: Record<string, unknown>; vector_distance: number }[]
      | undefined;

    return this._typesenseRecordsToDocuments(hits);
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
}
