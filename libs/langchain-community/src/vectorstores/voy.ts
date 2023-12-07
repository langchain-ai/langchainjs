import type { Voy as VoyOriginClient, SearchResult } from "voy-search";
import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

export type VoyClient = Omit<
  VoyOriginClient,
  "remove" | "size" | "serialize" | "free"
>;

/**
 * Internal interface for storing documents mappings.
 */
interface InternalDoc {
  embeddings: number[];
  document: Document;
}

/**
 * Class that extends `VectorStore`. It allows to perform similarity search using
 * Voi similarity search engine. The class requires passing Voy Client as an input parameter.
 */
export class VoyVectorStore extends VectorStore {
  client: VoyClient;

  numDimensions: number | null = null;

  docstore: InternalDoc[] = [];

  _vectorstoreType(): string {
    return "voi";
  }

  constructor(client: VoyClient, embeddings: Embeddings) {
    super(embeddings, {});
    this.client = client;
    this.embeddings = embeddings;
  }

  /**
   * Adds documents to the Voy database. The documents are embedded using embeddings provided while instantiating the class.
   * @param documents An array of `Document` instances associated with the vectors.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    if (documents.length === 0) {
      return;
    }

    const firstVector = (
      await this.embeddings.embedDocuments(texts.slice(0, 1))
    )[0];
    if (this.numDimensions === null) {
      this.numDimensions = firstVector.length;
    } else if (this.numDimensions !== firstVector.length) {
      throw new Error(
        `Vectors must have the same length as the number of dimensions (${this.numDimensions})`
      );
    }
    const restResults = await this.embeddings.embedDocuments(texts.slice(1));
    await this.addVectors([firstVector, ...restResults], documents);
  }

  /**
   * Adds vectors to the Voy database. The vectors are associated with
   * the provided documents.
   * @param vectors An array of vectors to be added to the database.
   * @param documents An array of `Document` instances associated with the vectors.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }
    if (this.numDimensions === null) {
      this.numDimensions = vectors[0].length;
    }

    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and metadata must have the same length`);
    }
    if (!vectors.every((v) => v.length === this.numDimensions)) {
      throw new Error(
        `Vectors must have the same length as the number of dimensions (${this.numDimensions})`
      );
    }

    vectors.forEach((item, idx) => {
      const doc = documents[idx];
      this.docstore.push({ embeddings: item, document: doc });
    });
    const embeddings = this.docstore.map((item, idx) => ({
      id: String(idx),
      embeddings: item.embeddings,
      title: "",
      url: "",
    }));
    this.client.index({ embeddings });
  }

  /**
   * Searches for vectors in the Voy database that are similar to the
   * provided query vector.
   * @param query The query vector.
   * @param k The number of similar vectors to return.
   * @returns A promise that resolves with an array of tuples, each containing a `Document` instance and a similarity score.
   */
  async similaritySearchVectorWithScore(query: number[], k: number) {
    if (this.numDimensions === null) {
      throw new Error("There aren't any elements in the index yet.");
    }
    if (query.length !== this.numDimensions) {
      throw new Error(
        `Query vector must have the same length as the number of dimensions (${this.numDimensions})`
      );
    }
    const itemsToQuery = Math.min(this.docstore.length, k);
    if (itemsToQuery > this.docstore.length) {
      console.warn(
        `k (${k}) is greater than the number of elements in the index (${this.docstore.length}), setting k to ${itemsToQuery}`
      );
    }
    const results: SearchResult = this.client.search(
      new Float32Array(query),
      itemsToQuery
    );
    return results.neighbors.map(
      ({ id }, idx) =>
        [this.docstore[parseInt(id, 10)].document, idx] as [Document, number]
    );
  }

  /**
   * Method to delete data from the Voy index. It can delete data based
   * on specific IDs or a filter.
   * @param params Object that includes either an array of IDs or a filter for the data to be deleted.
   * @returns Promise that resolves when the deletion is complete.
   */
  async delete(params: { deleteAll?: boolean }): Promise<void> {
    if (params.deleteAll === true) {
      await this.client.clear();
    } else {
      throw new Error(`You must provide a "deleteAll" parameter.`);
    }
  }

  /**
   * Creates a new `VoyVectorStore` instance from an array of text strings. The text
   * strings are converted to `Document` instances and added to the Voy
   * database.
   * @param texts An array of text strings.
   * @param metadatas An array of metadata objects or a single metadata object. If an array is provided, it must have the same length as the `texts` array.
   * @param embeddings An `Embeddings` instance used to generate embeddings for the documents.
   * @param client An instance of Voy client to use in the underlying operations.
   * @returns A promise that resolves with a new `VoyVectorStore` instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    client: VoyClient
  ): Promise<VoyVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return VoyVectorStore.fromDocuments(docs, embeddings, client);
  }

  /**
   * Creates a new `VoyVectorStore` instance from an array of `Document` instances.
   * The documents are added to the Voy database.
   * @param docs An array of `Document` instances.
   * @param embeddings An `Embeddings` instance used to generate embeddings for the documents.
   * @param client An instance of Voy client to use in the underlying operations.
   * @returns A promise that resolves with a new `VoyVectorStore` instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    client: VoyClient
  ): Promise<VoyVectorStore> {
    const instance = new VoyVectorStore(client, embeddings);
    await instance.addDocuments(docs);
    return instance;
  }
}
