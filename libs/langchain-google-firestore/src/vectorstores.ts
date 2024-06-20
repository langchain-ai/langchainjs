// eslint-disable-next-line import/no-extraneous-dependencies
import { Firestore, FieldValue } from "@google-cloud/firestore";
// eslint-disable-next-line import/no-extraneous-dependencies
import * as uuid from "uuid";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { VectorStore } from "@langchain/core/vectorstores";
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { flatten } from "flat";
import { GoogleAuth } from "google-auth-library";

export interface FirebaseStoreParams extends AsyncCallerParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  firestoreConfig?: FirebaseFirestore.Settings;
  collectionName: string;
  textKey?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: Record<string, any>;
  distanceMeasure?: "EUCLIDEAN" | "COSINE" | "DOT_PRODUCT";
  googleAuth: GoogleAuth;
}

interface AddDocumentsOptions {
  ids?: string[];
}

interface DeleteParams {
  deleteAll?: boolean;
  ids?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: Record<string, any>;
}

interface FirestoreDocumentData {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
  pageContent: string;
  embedding_field: FieldValue;
}

class FirestoreVectorStore extends VectorStore {
  firestore: Firestore;

  textKey: string;

  collectionName: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: Record<string, any>;

  distanceMeasure: "EUCLIDEAN" | "COSINE" | "DOT_PRODUCT";

  caller: AsyncCaller;

  googleAuth: GoogleAuth;

  /**
   * Constructs a new FirestoreVectorStore instance.
   * @param {EmbeddingsInterface} embeddings - The embeddings interface.
   * @param {FirebaseStoreParams} params - The parameters for the Firestore configuration.
   * @param {Object} params.firestoreConfig - Firestore configuration settings.
   * @param {string} params.collectionName - The name of the Firestore collection.
   * @param {string} [params.textKey] - The key to use for text content in documents.
   * @param {Object} [params.filter] - Default filter to apply to queries.
   * @param {string} [params.distanceMeasure="EUCLIDEAN"] - The distance measure for vector similarity search.
   */
  constructor({
    embeddings,
    params,
  }: {
    embeddings: EmbeddingsInterface;
    params: FirebaseStoreParams;
  }) {
    super(embeddings, params);
    const {
      textKey,
      collectionName,
      filter,
      distanceMeasure,
      firestoreConfig,
      googleAuth,
      ...asyncCallerArgs
    } = params;
    this.googleAuth = googleAuth;
    this.textKey = textKey ?? "text";
    this.collectionName = collectionName;
    this.filter = filter;
    this.distanceMeasure = distanceMeasure ?? "EUCLIDEAN";
    this.caller = new AsyncCaller(asyncCallerArgs);

    this.firestore = new Firestore({ googleAuth, ...firestoreConfig });
  }

  _vectorstoreType(): string {
    return "FirestoreVectorStore";
  }

  /**
   * Adds documents to Firestore with their embeddings.
   * @param {Array<Document>} documents - The documents to add.
   * @param {Object} options - Additional options for adding documents.
   * @returns {Promise<Array<string>>} - The IDs of the added documents.
   */
  async addDocuments(
    documents: DocumentInterface[],
    options?: AddDocumentsOptions
  ): Promise<string[]> {
    try {
      const texts = documents.map(({ pageContent }) => pageContent);
      const vectors = await this.embeddings.embedDocuments(texts);

      return this.addVectors(vectors, documents, options);
    } catch (error) {
      console.error("Error adding documents:", error);
      throw new Error("Failed to add documents to Firestore.");
    }
  }

  /**
   * Adds vectors and corresponding documents to Firestore.
   * @param {Array<Array<number>>} vectors - The vectors to add.
   * @param {Array<Document>} documents - The documents to add.
   * @param {Object} options - Additional options for adding vectors.
   * @returns {Promise<Array<string>>} - The IDs of the added documents.
   */
  async addVectors(
    vectors: number[][],
    documents: DocumentInterface[],
    options?: AddDocumentsOptions
  ): Promise<string[]> {
    try {
      const ids = options?.ids;
      const documentIds = ids ?? documents.map(() => uuid.v4());

      const batchRequests = vectors.map((values, idx) => {
        const docData = this.prepareDocData(
          documentIds[idx],
          documents[idx],
          values
        );
        return this.setDocData(documentIds[idx], docData);
      });

      await Promise.all(batchRequests);
      return documentIds;
    } catch (error) {
      console.error("Error adding vectors:", error);
      throw new Error("Failed to add vectors to Firestore.");
    }
  }

  /**
   * Prepares the Firestore document data.
   * @param {string} id - The document ID.
   * @param {DocumentInterface} document - The document.
   * @param {number[]} values - The embedding values.
   * @returns {FirestoreDocumentData} - The prepared document data.
   */
  prepareDocData(
    id: string,
    document: DocumentInterface,
    values: number[]
  ): FirestoreDocumentData {
    const documentMetadata = { ...document.metadata };
    const stringArrays: Record<string, string[]> = {};

    for (const key of Object.keys(documentMetadata)) {
      if (
        Array.isArray(documentMetadata[key]) &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        documentMetadata[key].every((el: any) => typeof el === "string")
      ) {
        stringArrays[key] = documentMetadata[key];
        delete documentMetadata[key];
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flattenedMetadata = flatten(documentMetadata) as Record<string, any>;

    const metadata = {
      ...flattenedMetadata,
      ...stringArrays,
      [this.textKey]: document.pageContent,
    };

    for (const key of Object.keys(metadata)) {
      if (
        metadata[key] == null ||
        (typeof metadata[key] === "object" &&
          Object.keys(metadata[key]).length === 0)
      ) {
        delete metadata[key];
      }
    }

    // console.log(FieldValue.vector(values));
    return {
      id,
      metadata,
      pageContent: document.pageContent,
      embedding_field: FieldValue.vector(values),
    };
  }

  /**
   * Sets the document data in Firestore.
   * @param {string} id - The document ID.
   * @param {FirestoreDocumentData} docData - The document data.
   * @returns {Promise<void>}
   */
  async setDocData(id: string, docData: FirestoreDocumentData): Promise<void> {
    try {
      const docRef = this.firestore.collection(this.collectionName).doc(id);
      await docRef.set(docData);
    } catch (error) {
      console.error("Error setting document data:", error);
      throw new Error("Failed to set document data in Firestore.");
    }
  }

  /**
   * Deletes documents from Firestore based on the given parameters.
   * @param {DeleteParams} params - The parameters for deletion.
   * @throws {Error} - If neither `ids` nor `deleteAll` is provided.
   */
  async delete(params: DeleteParams): Promise<void> {
    const { deleteAll, ids, filter } = params;

    if (deleteAll) {
      await this.deleteAllDocuments();
    } else if (ids) {
      await this.deleteDocumentsByIds(ids);
    } else if (filter) {
      await this.deleteDocumentsByFilter(filter);
    } else {
      throw new Error("Either ids or deleteAll must be provided.");
    }
  }

  /**
   * Deletes all documents in the Firestore collection.
   * @returns {Promise<void>}
   */
  async deleteAllDocuments(): Promise<void> {
    try {
      const querySnapshot = await this.firestore
        .collection(this.collectionName)
        .get();
      const BATCH_LIMIT = 500;

      let batch = this.firestore.batch();
      let batchCount = 0;

      for (const doc of querySnapshot.docs) {
        batch.delete(doc.ref);
        batchCount += 1;

        if (batchCount === BATCH_LIMIT) {
          await batch.commit();
          batch = this.firestore.batch();
          batchCount = 0;
        }
      }

      // Commit any remaining writes
      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Error deleting all documents:", error);
      throw new Error("Failed to delete all documents from Firestore.");
    }
  }

  /**
   * Deletes documents by their IDs.
   * @param {string[]} ids - The IDs of the documents to delete.
   * @returns {Promise<void>}
   */
  async deleteDocumentsByIds(ids: string[]): Promise<void> {
    try {
      const BATCH_LIMIT = 500;
      let batch = this.firestore.batch();
      let batchCount = 0;

      for (const id of ids) {
        const docRef = this.firestore.collection(this.collectionName).doc(id);
        batch.delete(docRef);
        batchCount += 1;

        if (batchCount === BATCH_LIMIT) {
          await batch.commit();
          batch = this.firestore.batch();
          batchCount = 0;
        }
      }

      // Commit any remaining writes
      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Error deleting documents by IDs:", error);
      throw new Error("Failed to delete documents by IDs from Firestore.");
    }
  }

  /**
   * Deletes documents based on the provided filter.
   * @param {Record<string, any>} filter - The filter to apply.
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async deleteDocumentsByFilter(filter: Record<string, any>): Promise<void> {
    try {
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
        this.firestore.collection(this.collectionName);

      for (const key of Object.keys(filter)) {
        const value = filter[key];
        // Use dot notation for nested fields in metadata if needed
        const field = key.startsWith("metadata.") ? key : `metadata.${key}`;
        query = query.where(field, "==", value);
      }

      const querySnapshot = await query.get();
      const BATCH_LIMIT = 500;

      let batch = this.firestore.batch();
      let batchCount = 0;

      for (const doc of querySnapshot.docs) {
        batch.delete(doc.ref);
        batchCount += 1;

        if (batchCount === BATCH_LIMIT) {
          await batch.commit();
          batch = this.firestore.batch();
          batchCount = 0;
        }
      }

      // Commit any remaining writes
      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Error deleting documents by filter:", error);
      throw new Error("Failed to delete documents by filter from Firestore.");
    }
  }

  /**
   * Performs a similarity search based on vector distance.
   * @param {number[]} query - The query vector.
   * @param {number} k - The number of nearest neighbors to retrieve.
   * @param {Object} [filter] - A filter to apply to the search.
   * @returns {Promise<Array<[DocumentInterface, number]>>} - The search results and their scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter?: Record<string, any>
  ): Promise<[DocumentInterface, number][]> {
    try {
      if (filter && this.filter) {
        throw new Error("Cannot provide both `filter` and `this.filter`");
      }
      const _filter = filter ?? this.filter;

      let baseQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
        this.firestore.collection(this.collectionName);

      if (_filter) {
        for (const key of Object.keys(_filter)) {
          baseQuery = baseQuery.where(key, "==", _filter[key]);
        }
      }

      const vectorQuery = baseQuery.findNearest("embedding_field", query, {
        limit: k,
        distanceMeasure: this.distanceMeasure,
      });

      const querySnapshot = await vectorQuery.get();
      const results = querySnapshot.docs.map((doc) => doc.data());

      return results.map((res) => {
        const { [this.textKey]: pageContent, ...metadata } = res.metadata ?? {};
        return [
          new Document({
            metadata,
            pageContent,
          }),
          1,
        ]; // Dummy score value
      }) as [DocumentInterface, number][];
    } catch (error) {
      console.error("Error performing similarity search:", error);
      throw new Error("Failed to perform similarity search.");
    }
  }

  /**
   * Retrieves a document by its ID.
   * @param {string} id - The ID of the document to retrieve.
   * @returns {Promise<DocumentInterface | null>} - The retrieved document or null if not found.
   */
  async getDocumentById(id: string): Promise<DocumentInterface | null> {
    try {
      const docRef = this.firestore.collection(this.collectionName).doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return null;
      }
      const data = doc.data();
      console.log(data);
      return new Document({
        metadata: data?.metadata,
        pageContent: data?.pageContent,
      });
    } catch (error) {
      console.error("Error getting document by ID:", error);
      throw new Error("Failed to get document by ID from Firestore.");
    }
  }

  /**
   * Retrieves documents by metadata filter.
   * @param {Record<string, any>} filter - The filter to apply to the search.
   * @returns {Promise<DocumentInterface[]>} - The retrieved documents.
   */
  async getDocumentsByMetadata(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter: Record<string, any>
  ): Promise<DocumentInterface[]> {
    try {
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
        this.firestore.collection(this.collectionName);
      for (const key of Object.keys(filter)) {
        const value = filter[key];
        // Use dot notation for nested fields in metadata
        const field = key.startsWith("metadata.") ? key : `metadata.${key}`;
        query = query.where(field, "==", value);
      }
      const querySnapshot = await query.get();
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return new Document({
          metadata: data.metadata,
          pageContent: data.pageContent,
        });
      });
    } catch (error) {
      console.error("Error getting documents by metadata:", error);
      throw new Error("Failed to get documents by metadata from Firestore.");
    }
  }

  /**
   * Static method that creates a new instance of the FirestoreVectorStore class from documents.
   * @param {DocumentInterface[]} docs - The documents to add to the Firestore vector database.
   * @param {EmbeddingsInterface} embeddings - The embeddings to use for the documents.
   * @param {FirebaseStoreParams} params - The parameters for the Firestore configuration.
   * @returns {Promise<FirestoreVectorStore>} - Promise that resolves with a new instance of the class.
   */
  static async fromDocuments(
    docs: DocumentInterface[],
    embeddings: EmbeddingsInterface,
    params: FirebaseStoreParams
  ): Promise<FirestoreVectorStore> {
    const instance = new FirestoreVectorStore({ embeddings, params });
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Static method that creates a new instance of the FirestoreVectorStore class from texts.
   * @param {string[]} texts - The texts to add to the Firestore database.
   * @param {object | object[]} metadatas - Metadata associated with the texts.
   * @param {EmbeddingsInterface} embeddings - The embeddings to use for the texts.
   * @param {FirebaseStoreParams} params - The parameters for the Firestore configuration.
   * @returns {Promise<FirestoreVectorStore>} - Promise that resolves with a new instance of the class.
   */
  static async fromTexts(
    texts: string[],

    metadatas: object | object[],

    embeddings: EmbeddingsInterface,

    params: FirebaseStoreParams
  ): Promise<FirestoreVectorStore> {
    const docs = texts.map((text, index) => {
      const metadata = Array.isArray(metadatas) ? metadatas[index] : metadatas;
      return new Document({
        pageContent: text,
        metadata,
      });
    });
    return FirestoreVectorStore.fromDocuments(docs, embeddings, params);
  }
}

export { FirestoreVectorStore };
