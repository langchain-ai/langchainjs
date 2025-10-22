/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-extraneous-dependencies */
import { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Bucket, Cluster, Collection, Scope } from "couchbase";
import { Document } from "@langchain/core/documents";
import { v4 as uuid } from "uuid";

/**
 * Enum for different distance strategies supported by Couchbase vector search
 */
export enum DistanceStrategy {
  DOT = "dot",
  L2 = "l2",
  EUCLIDEAN = "euclidean",
  COSINE = "cosine",
  L2_SQUARED = "l2_squared",
  EUCLIDEAN_SQUARED = "euclidean_squared",
}

export enum IndexType {
  COMPOSITE = "composite",
  BHIVE = "bhive",
}

/**
 * Interface for create_index method parameters
 */
export interface CreateIndexOptions {
  indexType: IndexType;
  indexDescription: string;
  distanceMetric?: DistanceStrategy;
  indexName?: string;
  vectorField?: string;
  vectorDimension?: number;
  fields?: string[];
  whereClause?: string;
  indexScanNprobes?: number;
  indexTrainlist?: number;
}

/**
 * This interface define the optional fields for adding vector
 * - `ids` - vector of ids for each document. If undefined, then uuid will be used
 * - `metadata` - vector of metadata object for each document
 */
export interface AddVectorOptions {
  ids?: string[];
  metadata?: Record<string, any>[];
}

/**
 * This interface defines the fields required to initialize a query vector store
 * These are the fields part of config:
 * @property {Cluster} cluster - The Couchbase cluster that the store will interact with.
 * @property {string} bucketName - The name of the bucket in the Couchbase cluster.
 * @property {string} scopeName - The name of the scope within the bucket.
 * @property {string} collectionName - The name of the collection within the scope.
 * @property {string} textKey - The key to be used for text in the documents. Defaults to "text".
 * @property {string} embeddingKey - The key to be used for embeddings in the documents. Defaults to "embedding".
 * @property {DistanceStrategy} distanceStrategy - The distance strategy to use for vector similarity calculations. Defaults to DOT.
 * @property {AddVectorOptions} addVectorOptions - Options for adding vectors with specific id/metadata
 */
export interface CouchbaseQueryVectorStoreArgs {
  cluster: Cluster;
  bucketName: string;
  scopeName: string;
  collectionName: string;
  textKey?: string;
  embeddingKey?: string;
  distanceStrategy?: DistanceStrategy;
  addVectorOptions?: AddVectorOptions;
}

/**
 * This type defines the search filters used in couchbase query vector search
 * - `where`: Optional WHERE clause conditions for the SQL++ query
 * - `fields`: Optional list of fields to include in the results
 */
type CouchbaseQueryVectorStoreFilter = {
  where?: string;
  fields?: string[];
};

/**
 * Class for interacting with the Couchbase database using Query service for vector search.
 * It extends the VectorStore class and provides methods for adding vectors and
 * documents, and searching for similar vectors using SQL++ queries.
 * Initiate the class using initialize() method.
 */
export class CouchbaseQueryVectorStore extends VectorStore {
  declare FilterType: CouchbaseQueryVectorStoreFilter;

  private metadataKey = "metadata";

  private readonly defaultTextKey = "text";

  private readonly defaultEmbeddingKey = "embedding";

  private readonly defaultDistanceStrategy = DistanceStrategy.DOT;

  private cluster: Cluster;

  private _bucket: Bucket;

  private _scope: Scope;

  private _collection: Collection;

  private bucketName: string;

  private scopeName: string;

  private collectionName: string;

  private textKey = this.defaultTextKey;

  private embeddingKey = this.defaultEmbeddingKey;

  private distanceStrategy = this.defaultDistanceStrategy;

  /**
   * The private constructor used to provide embedding to parent class.
   * Initialize the class using static initialize() method
   * @param embedding - object to generate embedding
   * @param config -  the fields required to initialize a vector store
   */
  private constructor(
    embedding: EmbeddingsInterface,
    config: CouchbaseQueryVectorStoreArgs
  ) {
    super(embedding, config);
  }

  _vectorstoreType(): string {
    return "couchbase_query";
  }

  /**
   * initialize class for interacting with the Couchbase database using Query service.
   * It extends the VectorStore class and provides methods
   * for adding vectors and documents, and searching for similar vectors.
   * This also verifies the params
   *
   * @param embeddings - object to generate embedding
   * @param config - the fields required to initialize a vector store
   */
  static async initialize(
    embeddings: EmbeddingsInterface,
    config: CouchbaseQueryVectorStoreArgs
  ) {
    const store = new CouchbaseQueryVectorStore(embeddings, config);

    const {
      cluster,
      bucketName,
      scopeName,
      collectionName,
      textKey,
      embeddingKey,
      distanceStrategy,
    } = config;

    store.cluster = cluster;
    store.bucketName = bucketName;
    store.scopeName = scopeName;
    store.collectionName = collectionName;
    if (textKey) {
      store.textKey = textKey;
    } else {
      store.textKey = store.defaultTextKey;
    }

    if (embeddingKey) {
      store.embeddingKey = embeddingKey;
    } else {
      store.embeddingKey = store.defaultEmbeddingKey;
    }

    if (distanceStrategy) {
      store.distanceStrategy = distanceStrategy;
    } else {
      store.distanceStrategy = store.defaultDistanceStrategy;
    }

    try {
      store._bucket = store.cluster.bucket(store.bucketName);
      store._scope = store._bucket.scope(store.scopeName);
      store._collection = store._scope.collection(store.collectionName);
    } catch (err) {
      throw new Error(
        "Error connecting to couchbase, Please check connection and credentials"
      );
    }

    try {
      if (
        !(await store.checkBucketExists()) ||
        !(await store.checkScopeAndCollectionExists())
      ) {
        throw new Error("Error while initializing vector store");
      }
    } catch (err) {
      throw new Error(`Error while initializing vector store: ${err}`);
    }
    return store;
  }

  /**
   * An asynchronous method to verify the bucket exists.
   * It retrieves bucket information and checks if the bucket is present.
   *
   * @throws - If the specified bucket does not exist in the database.
   *
   * @returns - returns promise true if no error is found
   */
  private async checkBucketExists(): Promise<boolean> {
    try {
      await this.cluster.buckets().getBucket(this.bucketName);
      return true;
    } catch (err) {
      throw new Error(
        `Bucket with name ${this.bucketName} does not exist. Error: ${err}`
      );
    }
  }

  /**
   * An asynchronous method to verify the scope and collection exist.
   * It checks if the specified scope and collection are present.
   *
   * @throws - If the specified scope or collection does not exist in the database.
   *
   * @returns - returns promise true if no error is found
   */
  private async checkScopeAndCollectionExists(): Promise<boolean> {
    try {
      const scopes = await this._bucket.collections().getAllScopes();
      const scope = scopes.find((s: any) => s.name === this.scopeName);
      if (!scope) {
        throw new Error(`Scope ${this.scopeName} does not exist`);
      }

      const collection = scope.collections.find(
        (c: any) => c.name === this.collectionName
      );
      if (!collection) {
        throw new Error(`Collection ${this.collectionName} does not exist`);
      }

      return true;
    } catch (err) {
      throw new Error(
        `Scope ${this.scopeName} or Collection ${this.collectionName} does not exist. Error: ${err}`
      );
    }
  }

  /**
   * Method to add vectors and documents to the vector store.
   *
   * @param vectors - Vectors to be added to the vector store.
   * @param documents - Documents to be added to the vector store.
   * @param options - Optional parameters for adding vectors.
   *
   * @returns - Promise that resolves to an array of document IDs.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: AddVectorOptions
  ): Promise<string[]> {
    if (vectors.length === 0) {
      return [];
    }

    if (vectors.length !== documents.length) {
      throw new Error("Vectors and documents must have the same length");
    }

    const documentIds = options?.ids || documents.map(() => uuid());
    const documentsToInsert: { [key: string]: any }[] = [];

    for (let index = 0; index < vectors.length; index += 1) {
      const vector = vectors[index];
      const document = documents[index];
      const documentId = documentIds[index];

      const documentToInsert = {
        [documentId]: {
          [this.textKey]: document.pageContent,
          [this.embeddingKey]: vector,
          [this.metadataKey]: document.metadata,
        },
      };

      documentsToInsert.push(documentToInsert);
    }

    const docIds = await this.upsertDocuments(documentsToInsert);
    return docIds;
  }

  /**
   * Method to add documents to the vector store. It first converts
   * the documents to vectors using the embeddings and then adds them to the vector store.
   *
   * @param documents - Documents to be added to the vector store.
   * @param options - Optional parameters for adding documents.
   *
   * @returns - Promise that resolves to an array of document IDs.
   */
  async addDocuments(
    documents: Document[],
    options?: AddVectorOptions
  ): Promise<string[]> {
    const texts = documents.map(({ pageContent }) => pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    return this.addVectors(vectors, documents, options);
  }

  /**
   * Method to delete documents from the vector store.
   *
   * @param ids - Array of document IDs to be deleted.
   *
   * @returns - Promise that resolves when the deletion is complete.
   */
  async delete(options: { ids: string[] }): Promise<void> {
    const { ids } = options;
    const deletePromises = ids.map((id) =>
      this._collection.remove(id).catch((e: any) => {
        throw new Error(`Delete failed with error: ${e}`);
      })
    );

    await Promise.all(deletePromises);
  }

  /**
   * Return documents that are most similar to the vector embedding using SQL++ query.
   *
   * @param queryEmbeddings - Embedding vector to look up documents similar to.
   * @param k - Number of documents to return. Defaults to 4.
   * @param filter - Optional search filter that are passed to Couchbase query. Defaults to empty object.
   * - `where`: Optional WHERE clause conditions for the SQL++ query
   * - `fields`: Optional list of fields to include in the results
   *
   * @returns - Promise of list of [document, score] that are the most similar to the query vector.
   *
   * @throws If the search operation fails.
   */
  async similaritySearchVectorWithScore(
    queryEmbeddings: number[],
    k = 4,
    filter: CouchbaseQueryVectorStoreFilter = {}
  ): Promise<[Document, number][]> {
    const { where, fields } = filter;

    // Build the SELECT clause
    let selectClause = `META().id, ${this.textKey}, ${this.metadataKey}`;
    if (fields && fields.length > 0) {
      selectClause = fields.join(", ");
      if (!fields.includes(this.textKey)) {
        selectClause += `, ${this.textKey}`;
      }
      if (!fields.includes(this.metadataKey)) {
        selectClause += `, ${this.metadataKey}`;
      }
      if (!fields.includes("META().id")) {
        selectClause += `, META().id`;
      }
    }

    // Build the WHERE clause
    let whereClause = "";
    if (where) {
      whereClause = `AND ${where}`;
    }

    // Build the SQL++ query with vector search using APPROX_VECTOR_DISTANCE function
    // Using the configured distance metric for similarity scoring

    const distanceMetric = this.distanceStrategy;
    const query = `
      SELECT ${selectClause},
             APPROX_VECTOR_DISTANCE(${this.embeddingKey}, [${queryEmbeddings}], "${distanceMetric}") as distance
      FROM \`${this.bucketName}\`.\`${this.scopeName}\`.\`${this.collectionName}\`
      WHERE ${this.embeddingKey} IS NOT NULL ${whereClause}
      ORDER BY APPROX_VECTOR_DISTANCE(${this.embeddingKey}, [${queryEmbeddings}], "${distanceMetric}")
      LIMIT ${k}
    `;

    const docsWithScore: [Document, number][] = [];
    try {
      const result = await this.cluster.query(query, {
        parameters: {
          queryVector: queryEmbeddings,
          k,
        },
      });

      for (const row of result.rows) {
        const text = row[this.textKey];
        const metadata = row[this.metadataKey] || {};
        // Convert distance to similarity score (lower distance = higher similarity)
        const distance = row.distance || 0;
        const doc = new Document({
          pageContent: text,
          metadata,
        });
        docsWithScore.push([doc, distance]);
      }
    } catch (err) {
      throw new Error(`Query failed with error: ${err}`);
    }
    return docsWithScore;
  }

  /**
   * Return documents that are most similar to the vector embedding.
   *
   * @param queryEmbeddings - Embedding to look up documents similar to.
   * @param k - The number of similar documents to return. Defaults to 4.
   * @param filter - Optional search filter that are passed to Couchbase query. Defaults to empty object.
   * - `where`: Optional WHERE clause conditions for the SQL++ query
   * - `fields`: Optional list of fields to include in the results
   *
   * @returns - A promise that resolves to an array of documents that match the similarity search.
   */
  async similaritySearchByVector(
    queryEmbeddings: number[],
    k = 4,
    filter: CouchbaseQueryVectorStoreFilter = {}
  ): Promise<Document[]> {
    const docsWithScore = await this.similaritySearchVectorWithScore(
      queryEmbeddings,
      k,
      filter
    );
    const docs = [];
    for (const doc of docsWithScore) {
      docs.push(doc[0]);
    }
    return docs;
  }

  /**
   * Return documents that are most similar to the query.
   *
   * @param query - Query to look up for similar documents
   * @param k - The number of similar documents to return. Defaults to 4.
   * @param filter - Optional search filter that are passed to Couchbase query. Defaults to empty object.
   * - `where`: Optional WHERE clause conditions for the SQL++ query
   * - `fields`: Optional list of fields to include in the results
   *
   * @returns - Promise of list of documents that are most similar to the query.
   */
  async similaritySearch(
    query: string,
    k = 4,
    filter: CouchbaseQueryVectorStoreFilter = {}
  ): Promise<Document[]> {
    const queryEmbeddings = await this.embeddings.embedQuery(query);
    const docsWithScore = await this.similaritySearchVectorWithScore(
      queryEmbeddings,
      k,
      filter
    );
    const docs = [];
    for (const doc of docsWithScore) {
      docs.push(doc[0]);
    }
    return docs;
  }

  /**
   * Return documents that are most similar to the query with their scores.
   *
   * @param query - Query to look up for similar documents
   * @param k - The number of similar documents to return. Defaults to 4.
   * @param filter - Optional search filter that are passed to Couchbase query. Defaults to empty object.
   * - `where`: Optional WHERE clause conditions for the SQL++ query
   * - `fields`: Optional list of fields to include in the results
   *
   * @returns - Promise of list of documents that are most similar to the query.
   */
  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter: CouchbaseQueryVectorStoreFilter = {}
  ): Promise<[Document, number][]> {
    const queryEmbeddings = await this.embeddings.embedQuery(query);
    const docsWithScore = await this.similaritySearchVectorWithScore(
      queryEmbeddings,
      k,
      filter
    );
    return docsWithScore;
  }

  /**
   * upsert documents asynchronously into a couchbase collection
   * @param documentsToInsert Documents to be inserted into couchbase collection with embeddings, original text and metadata
   * @returns DocIds of the inserted documents
   */
  private async upsertDocuments(
    documentsToInsert: {
      [x: string]: any;
    }[]
  ) {
    // Create promises for each document to be upserted
    const upsertDocumentsPromises = documentsToInsert.map((document) => {
      const currentDocumentKey = Object.keys(document)[0];
      return this._collection
        .upsert(currentDocumentKey, document[currentDocumentKey])
        .then(() => currentDocumentKey)
        .catch((e: any) => {
          throw new Error(`Upsert failed with error: ${e}`);
        });
    });

    // Upsert all documents asynchronously
    const docIds = await Promise.all(upsertDocumentsPromises);
    const successfulDocIds: string[] = [];
    for (const id of docIds) {
      if (id) {
        successfulDocIds.push(id);
      }
    }
    return successfulDocIds;
  }

  /**
   * Create a new vector index for the Query vector store.
   *
   * @param options - Configuration options for creating the index
   * @param options.indexType - Type of the index (BHIVE or COMPOSITE) to create
   * @param options.indexDescription - Description of the index like "IVF,SQ8"
   * @param options.distanceMetric - Distance metric to use for the index. Defaults to the distance metric in the constructor
   * @param options.indexName - Name of the index to create. Defaults to "langchain_{indexType}_query_index"
   * @param options.vectorField - Name of the vector field to use for the index. Defaults to the embedding key in the constructor
   * @param options.vectorDimension - Dimension of the vector field. If not provided, it will be determined from the embedding object
   * @param options.fields - List of fields to include in the index. Defaults to the text field in the constructor
   * @param options.whereClause - Optional where clause to filter the documents to index
   * @param options.indexScanNprobes - Number of probes to use for the index
   * @param options.indexTrainlist - Number of training samples to use for the index
   *
   * @throws {Error} If index creation fails or invalid parameters are provided
   */
  async createIndex(options: CreateIndexOptions): Promise<void> {
    const {
      indexType,
      indexDescription,
      distanceMetric,
      indexName,
      vectorField,
      vectorDimension,
      fields,
      whereClause,
      indexScanNprobes,
      indexTrainlist,
    } = options;

    if (!Object.values(IndexType).includes(indexType)) {
      throw new Error(
        `Invalid index type. Got ${indexType}. Expected one of: ${Object.values(
          IndexType
        ).join(", ")}`
      );
    }

    if (!indexDescription) {
      throw new Error(
        "Index description is required for creating Vector Query index."
      );
    }

    const similarityMetric = distanceMetric || this.distanceStrategy;
    const vectorFieldName = vectorField || this.embeddingKey;

    // Get the vector dimension for the index
    let vectorDim = vectorDimension;
    if (!vectorDim) {
      try {
        const testEmbedding = await this.embeddings.embedQuery(
          "check the size of the vector embeddings"
        );
        vectorDim = testEmbedding.length;
      } catch (e) {
        throw new Error(
          "Vector dimension is required for creating Query index. " +
            "Unable to determine the dimension from the embedding object. " +
            `Error: ${e}`
        );
      }
    }

    // Create the index parameters for the index creation query
    const indexParams: Record<string, any> = {
      dimension: vectorDim,
      similarity: similarityMetric,
      description: indexDescription,
    };

    if (indexScanNprobes) {
      indexParams.scan_nprobes = indexScanNprobes;
    }
    if (indexTrainlist) {
      indexParams.trainlist = indexTrainlist;
    }

    // Add the text field to the fields if empty or if it is not present
    const includeFields = fields || [this.textKey];
    if (!includeFields.includes(this.textKey)) {
      includeFields.push(this.textKey);
    }

    // Build where clause if provided
    const whereClauseStr = whereClause ? `WHERE ${whereClause}` : "";

    // Convert index params to WITH clause format
    const withClause = `WITH ${JSON.stringify(indexParams).replace(/"/g, "'")}`;

    let indexQuery: string;
    let finalIndexName: string;

    if (indexType === IndexType.BHIVE) {
      finalIndexName = indexName || "langchain_bhive_query_index";
      // BHIVE: Specialized vector index with INCLUDE clause for additional fields
      indexQuery =
        `CREATE VECTOR INDEX \`${finalIndexName}\` ON \`${this.bucketName}\`.\`${this.scopeName}\`.\`${this.collectionName}\` ` +
        `(\`${vectorFieldName}\` VECTOR) INCLUDE (${includeFields
          .map((f) => `\`${f}\``)
          .join(", ")}) ` +
        `${whereClauseStr} USING GSI ${withClause}`;
    } else if (indexType === IndexType.COMPOSITE) {
      finalIndexName = indexName || "langchain_composite_query_index";
      // COMPOSITE: General GSI index that includes vector field alongside other fields with VECTOR keyword
      indexQuery =
        `CREATE INDEX \`${finalIndexName}\` ON \`${this.bucketName}\`.\`${this.scopeName}\`.\`${this.collectionName}\` ` +
        `(${includeFields
          .map((f) => `\`${f}\``)
          .join(", ")}, \`${vectorFieldName}\` VECTOR) ` +
        `${whereClauseStr} USING GSI ${withClause}`;
    } else {
      throw new Error(`Unsupported index type: ${indexType}`);
    }

    try {
      await this.cluster.query(indexQuery);
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "cause" in e &&
        e.cause &&
        typeof e.cause === "object" &&
        "first_error_message" in e.cause
      ) {
        throw new Error(
          `Index creation failed with error: ${e.cause.first_error_message}`
        );
      }
      throw new Error(`Index creation failed with error: ${e}`);
    }
  }

  /**
   * Static method to create a new CouchbaseQueryVectorStore from an array of texts.
   * It first converts the texts to vectors using the embeddings and then creates a new vector store.
   *
   * @param texts - Array of texts to be converted to vectors.
   * @param metadatas - Array of metadata objects corresponding to the texts.
   * @param embeddings - Embeddings to be used for converting texts to vectors.
   * @param config - Configuration for the vector store.
   *
   * @returns - Promise that resolves to a new CouchbaseQueryVectorStore instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    config: CouchbaseQueryVectorStoreArgs
  ): Promise<CouchbaseQueryVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return CouchbaseQueryVectorStore.fromDocuments(docs, embeddings, config);
  }

  /**
   * Static method to create a new CouchbaseQueryVectorStore from an array of documents.
   * It first converts the documents to vectors using the embeddings and then creates a new vector store.
   *
   * @param docs - Array of documents to be converted to vectors.
   * @param embeddings - Embeddings to be used for converting documents to vectors.
   * @param config - Configuration for the vector store.
   *
   * @returns - Promise that resolves to a new CouchbaseQueryVectorStore instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    config: CouchbaseQueryVectorStoreArgs
  ): Promise<CouchbaseQueryVectorStore> {
    const instance = await CouchbaseQueryVectorStore.initialize(
      embeddings,
      config
    );
    await instance.addDocuments(docs);
    return instance;
  }
}
