import { Client } from "typesense";
import { MultiSearchRequestSchema } from "typesense/lib/Typesense/MultiSearch.js";
import { Document } from "../document.js";
import { Embeddings } from "../embeddings/base.js";
import { VectorStore, VectorStoreRetriever } from "./base.js";

/**
 * Typesense vector store configuration.
 */
interface Config {
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
  import?<T extends Record<string, any> = Record<string, any>>(
    data: T[],
    collectionName: string
  ): Promise<void>;
}

/**
 * Typesense vector store.
 */
export class TypesenseVectorStore extends VectorStore {
  private client: Client;
  private schemaName: string;
  private searchParams: MultiSearchRequestSchema;
  private vectorColumnName: string;
  private pageContentColumnName: string;
  private metadataColumnNames: string[];
  private import: (
    data: Record<string, any>[],
    collectionName: string
  ) => Promise<void>;

  constructor(embeddings: Embeddings, config: Config) {
    super(embeddings, {});

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
    this.import = config.import || this.importToTypesense;
  }

  /**
   * Default function to import data to typesense
   * @param data
   * @param collectionName
   */
  async importToTypesense<T extends Record<string, any> = Record<string, any>>(
    data: T[],
    collectionName: string
  ) {
    const TEN_MINUTES_IN_SECONDS = 10 * 60;
    const typesenseConfig = {
      host: process.env.TYPESENSE_HOST,
      apiKey: process.env.TYPESENSE_ADMIN_API_KEY,
    } as Record<string, string>;

    const typesenseClient = new Client({
      nodes: [
        {
          host: typesenseConfig.host,
          port: 443,
          protocol: "https",
        },
      ],
      apiKey: typesenseConfig.apiKey,
      numRetries: 3, // A total of 4 tries
      connectionTimeoutSeconds: TEN_MINUTES_IN_SECONDS, // Longer timeout for large imports
    });

    const chunkSize = 2000;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);

      try {
        await typesenseClient
          .collections<T>(collectionName)
          .documents()
          .import(chunk, { action: "emplace", dirty_values: "drop" });
      } catch (error) {
        console.log("Error importing data to typesense");
        console.error(error);
      }
    }
  }

  /**
   * Transform documents to Typesense records.
   * @param documents
   * @returns Typesense records.
   */
  async documentsToTypesenseRecords(
    documents: Document[]
  ): Promise<Record<string, any>[]> {
    const pageContents = documents.map((doc) => doc.pageContent);
    const vectors = await this.embeddings.embedDocuments(pageContents);

    const metadatas = documents.map((doc) => doc.metadata);

    const typesenseDocuments = documents.map((doc, index) => {
      const metadata = metadatas[index];
      const objectWithMetadatas: Record<string, any> = {};

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
      const objectWithMetadatas: Record<string, any> = {};

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
   * Add search parameters that will be used in the similarity search.
   * @param searchParams MultiSearchRequestSchema
   */
  modifySearchParams(searchParams: Partial<MultiSearchRequestSchema>) {
    this.searchParams = {
      ...this.searchParams,
      ...searchParams,
      collection: this.schemaName,
    };
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
    config: Config
  ): Promise<TypesenseVectorStore> {
    const instance = new TypesenseVectorStore(embeddings, config);
    await instance.addDocuments(docs);

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
    typesenseRecords: Record<string, any>[] | undefined
  ): Document[] {
    const documents =
      typesenseRecords?.map((hit) => {
        const objectWithMetadatas: Record<string, any> = {};

        this.metadataColumnNames.forEach((metadataColumnName) => {
          objectWithMetadatas[metadataColumnName] = hit[metadataColumnName];
        });

        const document: Document = {
          pageContent: hit[this.pageContentColumnName] || "",
          metadata: objectWithMetadatas,
        };
        return document;
      }) || [];

    return documents;
  }

  /**
   * Search for similar documents.
   * @param query query
   * @param k amount of results to return
   * @param filter filter to apply to the search, merged with default search params. As Langchain chains method does do the similarity search implicitly, you can use modifySearchParams to change the default search params.
   * @returns similar documents
   */
  async similaritySearch(
    query: string,
    k?: number,
    filter: Record<string, any> = {}
  ) {
    const amount = k || this.searchParams.per_page || 5;
    const vectorPrompt = await this.embeddings.embedQuery(query);
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
      | Record<string, any>[]
      | undefined;

    const documents = this.typesenseRecordsToDocuments(hits);

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

  async similaritySearchVectorWithScore(
    _vectorPrompt: number[]
  ): Promise<[Document<Record<string, any>>, number][]> {
    throw new Error("Method not implemented");
  }

  async similaritySearchWithScore(
    _query: string
  ): Promise<[Document<Record<string, any>>, number][]> {
    throw new Error("Method not implemented");
  }
}
