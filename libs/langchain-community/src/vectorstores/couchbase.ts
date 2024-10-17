/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-extraneous-dependencies */
import { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import {
  Bucket,
  Cluster,
  Collection,
  Scope,
  SearchRequest,
  VectorQuery,
  VectorSearch,
} from "couchbase";
import { Document } from "@langchain/core/documents";
import { v4 as uuid } from "uuid";

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
 * This interface defines the fields required to initialize a vector store
 * These are the fields part of config:
 * @property {Cluster} cluster - The Couchbase cluster that the store will interact with.
 * @property {string} bucketName - The name of the bucket in the Couchbase cluster.
 * @property {string} scopeName - The name of the scope within the bucket.
 * @property {string} collectionName - The name of the collection within the scope.
 * @property {string} indexName - The name of the index to be used for vector search.
 * @property {string} textKey - The key to be used for text in the documents. Defaults to "text".
 * @property {string} embeddingKey - The key to be used for embeddings in the documents. Defaults to "embedding".
 * @property {boolean} scopedIndex - Whether to use a scoped index for vector search. Defaults to true.
 * @property {AddVectorOptions} addVectorOptions - Options for adding vectors with specific id/metadata
 */
export interface CouchbaseVectorStoreArgs {
  cluster: Cluster;
  bucketName: string;
  scopeName: string;
  collectionName: string;
  indexName: string;
  textKey?: string;
  embeddingKey?: string;
  scopedIndex?: boolean;
  addVectorOptions?: AddVectorOptions;
}

/**
 * This type defines the search filters used in couchbase vector search
 * - `fields`: Optional list of fields to include in the
 * metadata of results. Note that these need to be stored in the index.
 * If nothing is specified, defaults to all the fields stored in the index.
 * - `searchOptions`:  Optional search options that are passed to Couchbase search. Defaults to empty object.
 */
type CouchbaseVectorStoreFilter = {
  fields?: any;
  searchOptions?: any;
};

/**
 * Class for interacting with the Couchbase database. It extends the
 * VectorStore class and provides methods for adding vectors and
 * documents, and searching for similar vectors.
 * Initiate the class using initialize() method.
 */
export class CouchbaseVectorStore extends VectorStore {
  declare FilterType: CouchbaseVectorStoreFilter;

  private metadataKey = "metadata";

  private readonly defaultTextKey = "text";

  private readonly defaultScopedIndex = true;

  private readonly defaultEmbeddingKey = "embedding";

  private cluster: Cluster;

  private _bucket: Bucket;

  private _scope: Scope;

  private _collection: Collection;

  private bucketName: string;

  private scopeName: string;

  private collectionName: string;

  private indexName: string;

  private textKey = this.defaultTextKey;

  private embeddingKey = this.defaultEmbeddingKey;

  private scopedIndex: boolean;

  /**
   * The private constructor used to provide embedding to parent class.
   * Initialize the class using static initialize() method
   * @param embedding - object to generate embedding
   * @param config -  the fields required to initialize a vector store
   */
  private constructor(
    embedding: EmbeddingsInterface,
    config: CouchbaseVectorStoreArgs
  ) {
    super(embedding, config);
  }

  /**
   * initialize class for interacting with the Couchbase database.
   * It extends the VectorStore class and provides methods
   * for adding vectors and documents, and searching for similar vectors.
   * This also verifies the params
   *
   * @param embeddings - object to generate embedding
   * @param config - the fields required to initialize a vector store
   */
  static async initialize(
    embeddings: EmbeddingsInterface,
    config: CouchbaseVectorStoreArgs
  ) {
    const store = new CouchbaseVectorStore(embeddings, config);

    const {
      cluster,
      bucketName,
      scopeName,
      collectionName,
      indexName,
      textKey,
      embeddingKey,
      scopedIndex,
    } = config;

    store.cluster = cluster;
    store.bucketName = bucketName;
    store.scopeName = scopeName;
    store.collectionName = collectionName;
    store.indexName = indexName;
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

    if (scopedIndex !== undefined) {
      store.scopedIndex = scopedIndex;
    } else {
      store.scopedIndex = store.defaultScopedIndex;
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
        !(await store.checkIndexExists()) ||
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
   * An asynchrononous method to verify the search indexes.
   * It retrieves all indexes and checks if specified index is present.
   *
   * @throws - If the specified index does not exist in the database.
   *
   * @returns - returns promise true if no error is found
   */
  private async checkIndexExists(): Promise<boolean> {
    if (this.scopedIndex) {
      const allIndexes = await this._scope.searchIndexes().getAllIndexes();
      const indexNames = allIndexes.map((index) => index.name);
      if (!indexNames.includes(this.indexName)) {
        throw new Error(
          `Index ${this.indexName} does not exist. Please create the index before searching.`
        );
      }
    } else {
      const allIndexes = await this.cluster.searchIndexes().getAllIndexes();
      const indexNames = allIndexes.map((index) => index.name);
      if (!indexNames.includes(this.indexName)) {
        throw new Error(
          `Index ${this.indexName} does not exist. Please create the index before searching.`
        );
      }
    }
    return true;
  }

  /**
   * An asynchronous method to verify the existence of a bucket.
   * It retrieves the bucket using the bucket manager and checks if the specified bucket is present.
   *
   * @throws - If the specified bucket does not exist in the database.
   *
   * @returns - Returns a promise that resolves to true if no error is found, indicating the bucket exists.
   */
  private async checkBucketExists(): Promise<boolean> {
    const bucketManager = this.cluster.buckets();
    try {
      await bucketManager.getBucket(this.bucketName);
      return true;
    } catch (error) {
      throw new Error(
        `Bucket ${this.bucketName} does not exist. Please create the bucket before searching.`
      );
    }
  }

  /**
   * An asynchronous method to verify the existence of a scope and a collection within that scope.
   * It retrieves all scopes and collections in the bucket, and checks if the specified scope and collection are present.
   *
   * @throws - If the specified scope does not exist in the bucket, or if the specified collection does not exist in the scope.
   *
   * @returns - Returns a promise that resolves to true if no error is found, indicating the scope and collection exist.
   */
  private async checkScopeAndCollectionExists(): Promise<boolean> {
    const scopeCollectionMap: Record<string, any> = {};

    // Get a list of all scopes in the bucket
    const scopes = await this._bucket.collections().getAllScopes();
    for (const scope of scopes) {
      scopeCollectionMap[scope.name] = [];

      // Get a list of all the collections in the scope
      for (const collection of scope.collections) {
        scopeCollectionMap[scope.name].push(collection.name);
      }
    }

    // Check if the scope exists
    if (!Object.keys(scopeCollectionMap).includes(this.scopeName)) {
      throw new Error(
        `Scope ${this.scopeName} not found in Couchbase bucket ${this.bucketName}`
      );
    }

    // Check if the collection exists in the scope
    if (!scopeCollectionMap[this.scopeName].includes(this.collectionName)) {
      throw new Error(
        `Collection ${this.collectionName} not found in scope ${this.scopeName} in Couchbase bucket ${this.bucketName}`
      );
    }

    return true;
  }

  _vectorstoreType(): string {
    return "couchbase";
  }

  /**
   * Formats couchbase metadata by removing `metadata.` from initials
   * @param fields - all the fields of row
   * @returns - formatted metadata fields
   */
  private formatMetadata = (fields: any) => {
    delete fields[this.textKey];
    const metadataFields: { [key: string]: any } = {};
    // eslint-disable-next-line guard-for-in
    for (const key in fields) {
      const newKey = key.replace(`${this.metadataKey}.`, "");
      metadataFields[newKey] = fields[key];
    }
    return metadataFields;
  };

  /**
   * Performs a similarity search on the vectors in the Couchbase database and returns the documents and their corresponding scores.
   *
   * @param queryEmbeddings - Embedding vector to look up documents similar to.
   * @param k - Number of documents to return. Defaults to 4.
   * @param filter - Optional search filter that are passed to Couchbase search. Defaults to empty object.
   * - `fields`: Optional list of fields to include in the
   * metadata of results. Note that these need to be stored in the index.
   * If nothing is specified, defaults to all the fields stored in the index.
   * - `searchOptions`:  Optional search options that are passed to Couchbase search. Defaults to empty object.
   *
   * @returns - Promise of list of [document, score] that are the most similar to the query vector.
   *
   * @throws If the search operation fails.
   */
  async similaritySearchVectorWithScore(
    queryEmbeddings: number[],
    k = 4,
    filter: CouchbaseVectorStoreFilter = {}
  ): Promise<[Document, number][]> {
    let { fields } = filter;
    const { searchOptions } = filter;

    if (!fields) {
      fields = ["*"];
    }
    if (
      !(fields.length === 1 && fields[0] === "*") &&
      !fields.includes(this.textKey)
    ) {
      fields.push(this.textKey);
    }

    const searchRequest = new SearchRequest(
      VectorSearch.fromVectorQuery(
        new VectorQuery(this.embeddingKey, queryEmbeddings).numCandidates(k)
      )
    );

    let searchIterator;
    const docsWithScore: [Document, number][] = [];
    try {
      if (this.scopedIndex) {
        searchIterator = this._scope.search(this.indexName, searchRequest, {
          limit: k,
          fields,
          raw: searchOptions,
        });
      } else {
        searchIterator = this.cluster.search(this.indexName, searchRequest, {
          limit: k,
          fields,
          raw: searchOptions,
        });
      }

      const searchRows = (await searchIterator).rows;
      for (const row of searchRows) {
        const text = row.fields[this.textKey];
        const metadataFields = this.formatMetadata(row.fields);
        const searchScore = row.score;
        const doc = new Document({
          pageContent: text,
          metadata: metadataFields,
        });
        docsWithScore.push([doc, searchScore]);
      }
    } catch (err) {
      console.log("error received");
      throw new Error(`Search failed with error: ${err}`);
    }
    return docsWithScore;
  }

  /**
   * Return documents that are most similar to the vector embedding.
   *
   * @param queryEmbeddings - Embedding to look up documents similar to.
   * @param k - The number of similar documents to return. Defaults to 4.
   * @param filter - Optional search filter that are passed to Couchbase search. Defaults to empty object.
   * - `fields`: Optional list of fields to include in the
   * metadata of results. Note that these need to be stored in the index.
   * If nothing is specified, defaults to all the fields stored in the index.
   * - `searchOptions`:  Optional search options that are passed to Couchbase search. Defaults to empty object.
   *
   * @returns - A promise that resolves to an array of documents that match the similarity search.
   */
  async similaritySearchByVector(
    queryEmbeddings: number[],
    k = 4,
    filter: CouchbaseVectorStoreFilter = {}
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
   * @param filter - Optional search filter that are passed to Couchbase search. Defaults to empty object.
   * - `fields`: Optional list of fields to include in the
   * metadata of results. Note that these need to be stored in the index.
   * If nothing is specified, defaults to all the fields stored in the index.
   * - `searchOptions`:  Optional search options that are passed to Couchbase search. Defaults to empty object.
   *
   * @returns - Promise of list of documents that are most similar to the query.
   */
  async similaritySearch(
    query: string,
    k = 4,
    filter: CouchbaseVectorStoreFilter = {}
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
   * @param filter - Optional search filter that are passed to Couchbase search. Defaults to empty object.
   * - `fields`: Optional list of fields to include in the
   * metadata of results. Note that these need to be stored in the index.
   * If nothing is specified, defaults to all the fields stored in the index.
   * - `searchOptions`:  Optional search options that are passed to Couchbase search. Defaults to empty object.
   *
   * @returns - Promise of list of documents that are most similar to the query.
   */
  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter: CouchbaseVectorStoreFilter = {}
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
        .catch((e) => {
          console.error("error received while upserting document", e);
          throw new Error(`Upsert failed with error: ${e}`);
        });
    });

    try {
      // Upsert all documents asynchronously
      const docIds = await Promise.all(upsertDocumentsPromises);
      const successfulDocIds: string[] = [];
      for (const id of docIds) {
        if (id) {
          successfulDocIds.push(id);
        }
      }
      return successfulDocIds;
    } catch (e) {
      console.error(
        "An error occurred with Promise.all at upserting all documents",
        e
      );
      throw e;
    }
  }

  /**
   * Add vectors and corresponding documents to a couchbase collection
   * If the document IDs are passed, the existing documents (if any) will be
   * overwritten with the new ones.
   * @param vectors - The vectors to be added to the collection.
   * @param documents - The corresponding documents to be added to the collection.
   * @param options - Optional parameters for adding vectors.
   * This may include the IDs and metadata of the documents to be added. Defaults to an empty object.
   *
   * @returns - A promise that resolves to an array of document IDs that were added to the collection.
   */
  public async addVectors(
    vectors: number[][],
    documents: Document[],
    options: AddVectorOptions = {}
  ): Promise<string[]> {
    // Get document ids. if ids are not available then use UUIDs for each document
    let ids: string[] | undefined = options ? options.ids : undefined;
    if (ids === undefined) {
      ids = Array.from({ length: documents.length }, () => uuid());
    }

    // Get metadata for each document. if metadata is not available, use empty object for each document
    let metadata: any = options ? options.metadata : undefined;
    if (metadata === undefined) {
      metadata = Array.from({ length: documents.length }, () => ({}));
    }

    const documentsToInsert = ids.map((id: string, index: number) => ({
      [id]: {
        [this.textKey]: documents[index].pageContent,
        [this.embeddingKey]: vectors[index],
        [this.metadataKey]: metadata[index],
      },
    }));

    let docIds: string[] = [];
    try {
      docIds = await this.upsertDocuments(documentsToInsert);
    } catch (err) {
      console.error("Error while adding vectors", err);
      throw err;
    }

    return docIds;
  }

  /**
   * Run texts through the embeddings and persist in vectorstore.
   * If the document IDs are passed, the existing documents (if any) will be
   * overwritten with the new ones.
   * @param documents - The corresponding documents to be added to the collection.
   * @param options - Optional parameters for adding documents.
   * This may include the IDs and metadata of the documents to be added. Defaults to an empty object.
   *
   * @returns - A promise that resolves to an array of document IDs that were added to the collection.
   */
  public async addDocuments(
    documents: Document[],
    options: AddVectorOptions = {}
  ) {
    const texts = documents.map(({ pageContent }) => pageContent);
    const metadatas = documents.map((doc) => doc.metadata);
    if (!options.metadata) {
      options.metadata = metadatas;
    }
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Create a new CouchbaseVectorStore from a set of documents.
   * This function will initialize a new store, add the documents to it, and then return the store.
   * @param documents - The documents to be added to the new store.
   * @param embeddings - The embeddings to be used for the documents.
   * @param config - The configuration for the new CouchbaseVectorStore. This includes the options for adding vectors.
   *
   * @returns - A promise that resolves to the new CouchbaseVectorStore that contains the added documents.
   */
  static async fromDocuments(
    documents: Document[],
    embeddings: EmbeddingsInterface,
    config: CouchbaseVectorStoreArgs
  ): Promise<CouchbaseVectorStore> {
    const store = await this.initialize(embeddings, config);
    await store.addDocuments(documents, config.addVectorOptions);
    return store;
  }

  /**
   * Create a new CouchbaseVectorStore from a set of texts.
   * This function will convert each text and its corresponding metadata into a Document,
   * initialize a new store, add the documents to it, and then return the store.
   * @param texts - The texts to be converted into Documents and added to the new store.
   * @param metadatas - The metadata for each text. If an array is passed, each text will have its corresponding metadata.
   * If not, all texts will have the same metadata.
   * @param embeddings - The embeddings to be used for the documents.
   * @param config - The configuration for the new CouchbaseVectorStore. This includes the options for adding vectors.
   *
   * @returns - A promise that resolves to the new CouchbaseVectorStore that contains the added documents.
   */
  static async fromTexts(
    texts: string[],
    metadatas: any,
    embeddings: EmbeddingsInterface,
    config: CouchbaseVectorStoreArgs
  ): Promise<CouchbaseVectorStore> {
    const docs = [];

    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return await this.fromDocuments(docs, embeddings, config);
  }

  /**
   * Delete documents asynchronously from the collection.
   * This function will attempt to remove each document in the provided list of IDs from the collection.
   * If an error occurs during the deletion of a document, an error will be thrown with the ID of the document and the error message.
   * @param ids - An array of document IDs to be deleted from the collection.
   *
   * @returns - A promise that resolves when all documents have been attempted to be deleted. If a document could not be deleted, an error is thrown.
   */
  public async delete(ids: string[]): Promise<void> {
    const deleteDocumentsPromises = ids.map((id) =>
      this._collection.remove(id).catch((err) => {
        throw new Error(
          `Error while deleting document - Document Id: ${id}, Error: ${err}`
        );
      })
    );
    try {
      await Promise.all(deleteDocumentsPromises);
    } catch (err) {
      throw new Error(`Error while deleting documents, Error: ${err}`);
    }
  }
}
