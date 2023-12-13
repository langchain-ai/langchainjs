import usearch from "usearch";
import * as uuid from "uuid";
import { Embeddings } from "@langchain/core/embeddings";
import { SaveableVectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { SynchronousInMemoryDocstore } from "../stores/doc/in_memory.js";

/**
 * Interface that defines the arguments that can be passed to the
 * `USearch` constructor. It includes optional properties for a
 * `docstore`, `index`, and `mapping`.
 */
export interface USearchArgs {
  docstore?: SynchronousInMemoryDocstore;
  index?: usearch.Index;
  mapping?: Record<number, string>;
}

/**
 * Class that extends `SaveableVectorStore` and provides methods for
 * adding documents and vectors to a `usearch` index, performing
 * similarity searches, and saving the index.
 */
export class USearch extends SaveableVectorStore {
  _index?: usearch.Index;

  _mapping: Record<number, string>;

  docstore: SynchronousInMemoryDocstore;

  args: USearchArgs;

  _vectorstoreType(): string {
    return "usearch";
  }

  constructor(embeddings: Embeddings, args: USearchArgs) {
    super(embeddings, args);
    this.args = args;
    this._index = args.index;
    this._mapping = args.mapping ?? {};
    this.embeddings = embeddings;
    this.docstore = args?.docstore ?? new SynchronousInMemoryDocstore();
  }

  /**
   * Method that adds documents to the `usearch` index. It generates
   * embeddings for the documents and adds them to the index.
   * @param documents An array of `Document` instances to be added to the index.
   * @returns A promise that resolves with an array of document IDs.
   */
  async addDocuments(documents: Document[]) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  public get index(): usearch.Index {
    if (!this._index) {
      throw new Error(
        "Vector store not initialised yet. Try calling `fromTexts` or `fromDocuments` first."
      );
    }
    return this._index;
  }

  private set index(index: usearch.Index) {
    this._index = index;
  }

  /**
   * Method that adds vectors to the `usearch` index. It also updates the
   * mapping between vector IDs and document IDs.
   * @param vectors An array of vectors to be added to the index.
   * @param documents An array of `Document` instances corresponding to the vectors.
   * @returns A promise that resolves with an array of document IDs.
   */
  async addVectors(vectors: number[][], documents: Document[]) {
    if (vectors.length === 0) {
      return [];
    }
    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and documents must have the same length`);
    }
    const dv = vectors[0].length;
    if (!this._index) {
      this._index = new usearch.Index({
        metric: "l2sq",
        connectivity: BigInt(16),
        dimensions: BigInt(dv),
      });
    }
    const d = this.index.dimensions();
    if (BigInt(dv) !== d) {
      throw new Error(
        `Vectors must have the same length as the number of dimensions (${d})`
      );
    }

    const docstoreSize = this.index.size();
    const documentIds = [];
    for (let i = 0; i < vectors.length; i += 1) {
      const documentId = uuid.v4();
      documentIds.push(documentId);
      const id = Number(docstoreSize) + i;
      this.index.add(BigInt(id), new Float32Array(vectors[i]));
      this._mapping[id] = documentId;
      this.docstore.add({ [documentId]: documents[i] });
    }
    return documentIds;
  }

  /**
   * Method that performs a similarity search in the `usearch` index. It
   * returns the `k` most similar documents to a given query vector, along
   * with their similarity scores.
   * @param query The query vector.
   * @param k The number of most similar documents to return.
   * @returns A promise that resolves with an array of tuples, each containing a `Document` and its similarity score.
   */
  async similaritySearchVectorWithScore(query: number[], k: number) {
    const d = this.index.dimensions();
    if (BigInt(query.length) !== d) {
      throw new Error(
        `Query vector must have the same length as the number of dimensions (${d})`
      );
    }
    if (k > this.index.size()) {
      const total = this.index.size();
      console.warn(
        `k (${k}) is greater than the number of elements in the index (${total}), setting k to ${total}`
      );
      // eslint-disable-next-line no-param-reassign
      k = Number(total);
    }
    const result = this.index.search(new Float32Array(query), BigInt(k));

    const return_list: [Document, number][] = [];
    for (let i = 0; i < result.count; i += 1) {
      const uuid = this._mapping[Number(result.keys[i])];
      return_list.push([this.docstore.search(uuid), result.distances[i]]);
    }

    return return_list;
  }

  /**
   * Method that saves the `usearch` index and the document store to disk.
   * @param directory The directory where the index and document store should be saved.
   * @returns A promise that resolves when the save operation is complete.
   */
  async save(directory: string) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(directory, { recursive: true });
    await Promise.all([
      this.index.save(path.join(directory, "usearch.index")),
      await fs.writeFile(
        path.join(directory, "docstore.json"),
        JSON.stringify([
          Array.from(this.docstore._docs.entries()),
          this._mapping,
        ])
      ),
    ]);
  }

  /**
   * Static method that creates a new `USearch` instance from a list of
   * texts. It generates embeddings for the texts and adds them to the
   * `usearch` index.
   * @param texts An array of texts to be added to the index.
   * @param metadatas Metadata associated with the texts.
   * @param embeddings An instance of `Embeddings` used to generate embeddings for the texts.
   * @param dbConfig Optional configuration for the document store.
   * @returns A promise that resolves with a new `USearch` instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig?: {
      docstore?: SynchronousInMemoryDocstore;
    }
  ): Promise<USearch> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return this.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method that creates a new `USearch` instance from a list of
   * documents. It generates embeddings for the documents and adds them to
   * the `usearch` index.
   * @param docs An array of `Document` instances to be added to the index.
   * @param embeddings An instance of `Embeddings` used to generate embeddings for the documents.
   * @param dbConfig Optional configuration for the document store.
   * @returns A promise that resolves with a new `USearch` instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig?: {
      docstore?: SynchronousInMemoryDocstore;
    }
  ): Promise<USearch> {
    const args: USearchArgs = {
      docstore: dbConfig?.docstore,
    };
    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }
}
