import { Document } from "../../documents/document.js";
import { EmbeddingsInterface } from "../../embeddings.js";
import { VectorStore } from "../../vectorstores.js";
import { cosine } from "../ml-distance/similarities.js";

/**
 * Interface representing a vector in memory. It includes the content
 * (text), the corresponding embedding (vector), and any associated
 * metadata.
 */
interface MemoryVector {
  content: string;
  embedding: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

/**
 * Interface for the arguments that can be passed to the
 * `FakeVectorStore` constructor. It includes an optional `similarity`
 * function.
 */
export interface FakeVectorStoreArgs {
  similarity?: typeof cosine;
}

/**
 * Class that extends `VectorStore` to store vectors in memory. Provides
 * methods for adding documents, performing similarity searches, and
 * creating instances from texts, documents, or an existing index.
 */
export class FakeVectorStore extends VectorStore {
  declare FilterType: (doc: Document) => boolean;

  memoryVectors: MemoryVector[] = [];

  similarity: typeof cosine;

  _vectorstoreType(): string {
    return "memory";
  }

  constructor(
    embeddings: EmbeddingsInterface,
    { similarity, ...rest }: FakeVectorStoreArgs = {}
  ) {
    super(embeddings, rest);

    this.similarity = similarity ?? cosine;
  }

  /**
   * Method to add documents to the memory vector store. It extracts the
   * text from each document, generates embeddings for them, and adds the
   * resulting vectors to the store.
   * @param documents Array of `Document` instances to be added to the store.
   * @returns Promise that resolves when all documents have been added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Method to add vectors to the memory vector store. It creates
   * `MemoryVector` instances for each vector and document pair and adds
   * them to the store.
   * @param vectors Array of vectors to be added to the store.
   * @param documents Array of `Document` instances corresponding to the vectors.
   * @returns Promise that resolves when all vectors have been added.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const memoryVectors = vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding,
      metadata: documents[idx].metadata,
    }));

    this.memoryVectors = this.memoryVectors.concat(memoryVectors);
  }

  /**
   * Method to perform a similarity search in the memory vector store. It
   * calculates the similarity between the query vector and each vector in
   * the store, sorts the results by similarity, and returns the top `k`
   * results along with their scores.
   * @param query Query vector to compare against the vectors in the store.
   * @param k Number of top results to return.
   * @param filter Optional filter function to apply to the vectors before performing the search.
   * @returns Promise that resolves with an array of tuples, each containing a `Document` and its similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    const filterFunction = (memoryVector: MemoryVector) => {
      if (!filter) {
        return true;
      }

      const doc = new Document({
        metadata: memoryVector.metadata,
        pageContent: memoryVector.content,
      });
      return filter(doc);
    };
    const filteredMemoryVectors = this.memoryVectors.filter(filterFunction);
    const searches = filteredMemoryVectors
      .map((vector, index) => ({
        similarity: this.similarity(query, vector.embedding),
        index,
      }))
      .sort((a, b) => (a.similarity > b.similarity ? -1 : 0))
      .slice(0, k);

    const result: [Document, number][] = searches.map((search) => [
      new Document({
        metadata: filteredMemoryVectors[search.index].metadata,
        pageContent: filteredMemoryVectors[search.index].content,
      }),
      search.similarity,
    ]);

    return result;
  }

  /**
   * Static method to create a `FakeVectorStore` instance from an array of
   * texts. It creates a `Document` for each text and metadata pair, and
   * adds them to the store.
   * @param texts Array of texts to be added to the store.
   * @param metadatas Array or single object of metadata corresponding to the texts.
   * @param embeddings `Embeddings` instance used to generate embeddings for the texts.
   * @param dbConfig Optional `FakeVectorStoreArgs` to configure the `FakeVectorStore` instance.
   * @returns Promise that resolves with a new `FakeVectorStore` instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig?: FakeVectorStoreArgs
  ): Promise<FakeVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return FakeVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method to create a `FakeVectorStore` instance from an array of
   * `Document` instances. It adds the documents to the store.
   * @param docs Array of `Document` instances to be added to the store.
   * @param embeddings `Embeddings` instance used to generate embeddings for the documents.
   * @param dbConfig Optional `FakeVectorStoreArgs` to configure the `FakeVectorStore` instance.
   * @returns Promise that resolves with a new `FakeVectorStore` instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig?: FakeVectorStoreArgs
  ): Promise<FakeVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Static method to create a `FakeVectorStore` instance from an existing
   * index. It creates a new `FakeVectorStore` instance without adding any
   * documents or vectors.
   * @param embeddings `Embeddings` instance used to generate embeddings for the documents.
   * @param dbConfig Optional `FakeVectorStoreArgs` to configure the `FakeVectorStore` instance.
   * @returns Promise that resolves with a new `FakeVectorStore` instance.
   */
  static async fromExistingIndex(
    embeddings: EmbeddingsInterface,
    dbConfig?: FakeVectorStoreArgs
  ): Promise<FakeVectorStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
