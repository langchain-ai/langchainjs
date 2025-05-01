import * as uuid from "uuid";
import { IClient as ChromiaClientT } from "postchain-client";

import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";


/**
 * Defines the arguments that can be passed to the `Chromia` class
 * constructor. It can either contain a `url` for the Chromia database, the
 * number of dimensions for the vectors (`numDimensions`), a
 * `collectionName` for the collection to be used in the database, and a
 * `filter` object; or it can contain an `index` which is an instance of
 * `ChromiaClientT`, along with the `numDimensions`, `collectionName`, and
 * `filter`.
 */
export interface ChromiaLibArgs {
  client: ChromiaClientT;
  numDimensions?: number;
  filter?: object;
}

/**
 * Defines the parameters for the `delete` method in the `Chromia` class.
 * It can either contain an array of `ids` of the documents to be deleted
 * or a `filter` object to specify the documents to be deleted.
 */
export interface ChromiaDeleteParams<T> {
  ids?: string[];
  filter?: T;
}

/**
 * Chromia vector store integration.
 *
 * Setup:
 * Install `@langchain/community` and `postchain-client`.
 *
 * ```bash
 * npm install @langchain/community postchain-client
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/langchain_community_vectorstores_chromia.Chromia.html#constructor)
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { Chromia } from '@langchain/community/vectorstores/chromia';
 * // Or other embeddings
 * import { OpenAIEmbeddings } from '@langchain/openai';
 *
 * const embeddings = new OpenAIEmbeddings({
 *   model: "text-embedding-3-small",
 * })
 *
 * const vectorStore = new Chromia(
 *   embeddings,
 *   {
 *     client: postchainClient, // Chromia postchain client
 *     numDimensions: embeddings.dimensions, // Number of dimensions for the vectors
 *   }
 * );
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Add documents</strong></summary>
 *
 * ```typescript
 * import type { Document } from '@langchain/core/documents';
 *
 * const document1 = { pageContent: "foo", metadata: { baz: "bar" } };
 * const document2 = { pageContent: "thud", metadata: { bar: "baz" } };
 * const document3 = { pageContent: "i will be deleted :(", metadata: {} };
 *
 * const documents: Document[] = [document1, document2, document3];
 * const ids = ["1", "2", "3"];
 * await vectorStore.addDocuments(documents, { ids });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Delete documents</strong></summary>
 *
 * ```typescript
 * await vectorStore.delete({ ids: ["3"] });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Similarity search</strong></summary>
 *
 * ```typescript
 * const results = await vectorStore.similaritySearch("thud", 1);
 * for (const doc of results) {
 *   console.log(`* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
 * }
 * // Output: * thud [{"baz":"bar"}]
 * ```
 * </details>
 *
 * <br />
 *
 *
 * <details>
 * <summary><strong>Similarity search with filter</strong></summary>
 *
 * ```typescript
 * const resultsWithFilter = await vectorStore.similaritySearch("thud", 1, { baz: "bar" });
 *
 * for (const doc of resultsWithFilter) {
 *   console.log(`* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
 * }
 * // Output: * foo [{"baz":"bar"}]
 * ```
 * </details>
 *
 * <br />
 *
 *
 * <details>
 * <summary><strong>Similarity search with score</strong></summary>
 *
 * ```typescript
 * const resultsWithScore = await vectorStore.similaritySearchWithScore("qux", 1);
 * for (const [doc, score] of resultsWithScore) {
 *   console.log(`* [SIM=${score.toFixed(6)}] ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
 * }
 * // Output: * [SIM=0.000000] qux [{"bar":"baz","baz":"bar"}]
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>As a retriever</strong></summary>
 *
 * ```typescript
 * const retriever = vectorStore.asRetriever({
 *   searchType: "mmr", // Leave blank for standard similarity search
 *   k: 1,
 * });
 * const resultAsRetriever = await retriever.invoke("thud");
 * console.log(resultAsRetriever);
 *
 * // Output: [Document({ metadata: { "baz":"bar" }, pageContent: "thud" })]
 * ```
 * </details>
 *
 * <br />
 */
export class Chromia extends VectorStore {
  client: ChromiaClientT;

  numDimensions?: number;

  url: string;

  filter?: object;


  _vectorstoreType(): string {
    return "chromia";
  }

  constructor(embeddings: EmbeddingsInterface, args: ChromiaLibArgs) {
    super(embeddings, args);

    this.client = args.client;
    this.numDimensions = args.numDimensions;
    this.embeddings = embeddings;

    this.filter = args.filter;
  }

  /**
   * Adds documents to the Chromia database. The documents are first
   * converted to vectors using the `embeddings` instance, and then added to
   * the database.
   * @param documents An array of `Document` instances to be added to the database.
   * @param options Optional. An object containing an array of `ids` for the documents.
   * @returns A promise that resolves when the documents have been added to the database.
   */
  async addDocuments(documents: Document[], options?: { ids?: string[] }) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Adds vectors to the Chromia database. The vectors are associated with
   * the provided documents.
   * @param vectors An array of vectors to be added to the database.
   * @param documents An array of `Document` instances associated with the vectors.
   * @param options Optional. An object containing an array of `ids` for the vectors.
   * @returns A promise that resolves with an array of document IDs when the vectors have been added to the database.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] }
  ) {
    if (vectors.length === 0) {
      return [];
    }
    if (this.numDimensions === undefined) {
      this.numDimensions = vectors[0].length;
    }
    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and metadatas must have the same length`);
    }
    if (vectors[0].length !== this.numDimensions) {
      throw new Error(
        `Vectors must have the same length as the number of dimensions (${this.numDimensions})`
      );
    }
    const documentIds =
      options?.ids ?? Array.from({ length: vectors.length }, () => uuid.v1());

    const rows = vectors.map((embedding, idx) => {
      const id = documentIds[idx];
      const metadata = documents[idx].metadata || {};
      return [
        parseInt(id),
        documents[idx].pageContent,
        JSON.stringify(metadata),
        `[${embedding}]`]
    });
    const tx = this.client.addNop({
      operations: [{
        name: "add_messages",
        args: [rows],
      }],
      signers: [],
    });
    await this.client.sendTransaction(tx)

    return documentIds;
  }

  /**
   * Deletes documents from the Chromia database. The documents to be deleted
   * can be specified by providing an array of `ids` or a `filter` object.
   * @param params An object containing either an array of `ids` of the documents to be deleted or a `filter` object to specify the documents to be deleted.
   * @returns A promise that resolves when the specified documents have been deleted from the database.
   */
  async delete(params: { ids: string[] | number[] }): Promise<void> {
    const { ids } = params;

    const tx = this.client.addNop({
      operations: [{
        name: "delete_messages",
        args: [ids],
      }],
      signers: [],
    });
    await this.client.sendTransaction(tx)
  }

  /**
   * Searches for vectors in the Chromia database that are similar to the
   * provided query vector. The search can be filtered using the provided
   * `filter` object or the `filter` property of the `Chromia` instance.
   * @param query The query vector.
   * @param k The number of similar vectors to return.
   * @param filter Optional. A `filter` object to filter the search results.
   * @returns A promise that resolves with an array of tuples, each containing a `Document` instance and a similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: object
  ) {
    // filter is not supported yet
    if (filter && this.filter) {
      throw new Error("cannot provide both `filter` and `this.filter`");
    }
    // const _filter = filter ?? this.filter;
    // const where = _filter === undefined ? undefined : { ..._filter };
    // similaritySearchVectorWithScore supports one query vector at a time
    // chromia supports multiple query vectors at a time
    const searches = await this.client.query("query_closest_objects", {
      context: 0,
      q_vector: `[${query}]`,
      max_distance: "1.0",
      max_vectors: k,
      query_template: {
        // "type": "get_messages",
        "type": "get_messages_with_distance",
        // "type": "get_messages_with_filter",
        // "args": { "text_filter": `Paris` }
      }
    }) as {
      id: string;
      text: string;
      distance: number;
      metadata: string;
    }[];

    const result: [Document, number][] = searches.map((resp) => {
      return [
        new Document({
          id: resp.id,
          pageContent: resp.text || "",
          metadata: JSON.parse(resp.metadata) || {},
        }),
        resp.distance
      ];
    });

    return result;
  }

  /**
   * Creates a new `Chromia` instance from an array of text strings. The text
   * strings are converted to `Document` instances and added to the Chromia
   * database.
   * @param texts An array of text strings.
   * @param metadatas An array of metadata objects or a single metadata object. If an array is provided, it must have the same length as the `texts` array.
   * @param embeddings An `Embeddings` instance used to generate embeddings for the documents.
   * @param dbConfig A `ChromiaClientT` object containing the configuration for the Chromia database.
   * @returns A promise that resolves with a new `Chromia` instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: ChromiaLibArgs
  ): Promise<Chromia> {
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
   * Creates a new `Chromia` instance from an array of `Document` instances.
   * The documents are added to the Chromia database.
   * @param docs An array of `Document` instances.
   * @param embeddings An `Embeddings` instance used to generate embeddings for the documents.
   * @param dbConfig A `ChromiaClientT` object containing the configuration for the Chromia database.
   * @returns A promise that resolves with a new `Chromia` instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: ChromiaLibArgs
  ): Promise<Chromia> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Creates a new `Chromia` instance from an existing collection in the
   * Chromia database.
   * @param embeddings An `Embeddings` instance used to generate embeddings for the documents.
   * @param dbConfig A `ChromiaLibArgs` object containing the configuration for the Chromia database.
   * @returns A promise that resolves with a new `Chromia` instance.
   */
  static async fromExistingCollection(
    embeddings: EmbeddingsInterface,
    dbConfig: ChromiaLibArgs
  ): Promise<Chromia> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }

  /** @ignore */
  static async imports(): Promise<{
    ChromiaClient: ChromiaClientT;
  }> {
    try {
      const { createClient } = await import("postchain-client");
      return { ChromiaClient: await createClient({}) };
    } catch (e) {
      throw new Error(
        "Please install postchain-client as a dependency with, e.g. `npm install -S postchain-client`"
      );
    }
  }
}
