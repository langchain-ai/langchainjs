import * as uuid from "uuid";
import type {
  ChromaClient as ChromaClientT,
  ChromaClientArgs,
  Collection,
  CollectionConfiguration,
  CollectionMetadata,
  Where,
} from "chromadb";

import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

type SharedChromaLibArgs = {
  numDimensions?: number;
  collectionName?: string;
  filter?: object;
  collectionMetadata?: CollectionMetadata;
  collectionConfiguration?: CollectionConfiguration;
  chromaCloudAPIKey?: string;
  clientParams?: Omit<ChromaClientArgs, "path">;
};

/**
 * Defines the arguments that can be passed to the `Chroma` class
 * constructor. It can either contain a `url` for the Chroma database, the
 * number of dimensions for the vectors (`numDimensions`), a
 * `collectionName` for the collection to be used in the database, and a
 * `filter` object; or it can contain an `index` which is an instance of
 * `ChromaClientT`, along with the `numDimensions`, `collectionName`, and
 * `filter`.
 */
export type ChromaLibArgs =
  | ({
      url?: string;
    } & SharedChromaLibArgs)
  | ({
      index?: ChromaClientT;
    } & SharedChromaLibArgs);

/**
 * Defines the parameters for the `delete` method in the `Chroma` class.
 * It can either contain an array of `ids` of the documents to be deleted
 * or a `filter` object to specify the documents to be deleted.
 */
export interface ChromaDeleteParams<T> {
  ids?: string[];
  filter?: T;
}

/**
 * Chroma vector store integration.
 *
 * Setup:
 * Install `@langchain/community` and `chromadb`.
 *
 * ```bash
 * npm install @langchain/community chromadb
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/langchain_community_vectorstores_chroma.Chroma.html#constructor)
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { Chroma } from '@langchain/community/vectorstores/chroma';
 * // Or other embeddings
 * import { OpenAIEmbeddings } from '@langchain/openai';
 *
 * const embeddings = new OpenAIEmbeddings({
 *   model: "text-embedding-3-small",
 * })
 *
 * const vectorStore = new Chroma(
 *   embeddings,
 *   {
 *     collectionName: "foo",
 *     host: "localhost",
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
 * const document3 = { pageContent: "I will be deleted :(", metadata: {} };
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
export class Chroma extends VectorStore {
  declare FilterType: Where;

  index?: ChromaClientT;

  collection?: Collection;

  collectionName: string;

  collectionMetadata?: CollectionMetadata;

  numDimensions?: number;

  clientParams?: Omit<ChromaClientArgs, "path">;

  url: string;

  filter?: object;

  _vectorstoreType(): string {
    return "chroma";
  }

  constructor(embeddings: EmbeddingsInterface, args: ChromaLibArgs) {
    super(embeddings, args);
    this.numDimensions = args.numDimensions;
    this.embeddings = embeddings;
    this.collectionName = ensureCollectionName(args.collectionName);
    this.collectionMetadata = args.collectionMetadata;
    this.clientParams = args.clientParams || {};
    if ("index" in args) {
      this.index = args.index;
    } else if ("url" in args) {
      this.url = args.url || "http://localhost:8000";
    }

    if (args.chromaCloudAPIKey) {
      this.clientParams.headers = {
        ...(this.clientParams?.headers || {}),
        "x-chroma-token": args.chromaCloudAPIKey,
      };
    }

    this.filter = args.filter;
  }

  /**
   * Adds documents to the Chroma database. The documents are first
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
   * Ensures that a collection exists in the Chroma database. If the
   * collection does not exist, it is created.
   * @returns A promise that resolves with the `Collection` instance.
   */
  async ensureCollection(): Promise<Collection> {
    if (!this.collection) {
      if (!this.index) {
        this.index = new (await Chroma.imports()).ChromaClient({
          path: this.url,
          ...(this.clientParams ?? {}),
        });
      }
      try {
        this.collection = await this.index.getOrCreateCollection({
          name: this.collectionName,
          embeddingFunction: null,
          ...(this.collectionMetadata && { metadata: this.collectionMetadata }),
        });
      } catch (err) {
        throw new Error(`Chroma getOrCreateCollection error: ${err}`);
      }
    }

    return this.collection;
  }

  /**
   * Adds vectors to the Chroma database. The vectors are associated with
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
    const collection = await this.ensureCollection();

    const mappedMetadatas = documents.map(({ metadata }) => {
      let locFrom;
      let locTo;

      if (metadata?.loc) {
        if (metadata.loc.lines?.from !== undefined)
          locFrom = metadata.loc.lines.from;
        if (metadata.loc.lines?.to !== undefined) locTo = metadata.loc.lines.to;
      }

      const newMetadata: Document["metadata"] = {
        ...metadata,
        ...(locFrom !== undefined && { locFrom }),
        ...(locTo !== undefined && { locTo }),
      };

      if (newMetadata.loc) delete newMetadata.loc;

      return newMetadata;
    });

    await collection.upsert({
      ids: documentIds,
      embeddings: vectors,
      metadatas: mappedMetadatas,
      documents: documents.map(({ pageContent }) => pageContent),
    });
    return documentIds;
  }

  /**
   * Deletes documents from the Chroma database. The documents to be deleted
   * can be specified by providing an array of `ids` or a `filter` object.
   * @param params An object containing either an array of `ids` of the documents to be deleted or a `filter` object to specify the documents to be deleted.
   * @returns A promise that resolves when the specified documents have been deleted from the database.
   */
  async delete(params: ChromaDeleteParams<this["FilterType"]>): Promise<void> {
    const collection = await this.ensureCollection();
    if (Array.isArray(params.ids)) {
      await collection.delete({ ids: params.ids });
    } else if (params.filter) {
      await collection.delete({
        where: { ...params.filter },
      });
    } else {
      throw new Error(`You must provide one of "ids or "filter".`);
    }
  }

  /**
   * Searches for vectors in the Chroma database that are similar to the
   * provided query vector. The search can be filtered using the provided
   * `filter` object or the `filter` property of the `Chroma` instance.
   * @param query The query vector.
   * @param k The number of similar vectors to return.
   * @param filter Optional. A `filter` object to filter the search results.
   * @returns A promise that resolves with an array of tuples, each containing a `Document` instance and a similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ) {
    if (filter && this.filter) {
      throw new Error("cannot provide both `filter` and `this.filter`");
    }
    const _filter = filter ?? this.filter;
    const where = _filter === undefined ? undefined : { ..._filter };

    const collection = await this.ensureCollection();

    // similaritySearchVectorWithScore supports one query vector at a time
    // chroma supports multiple query vectors at a time
    const result = await collection.query({
      queryEmbeddings: [query],
      nResults: k,
      where,
    });

    const { ids, distances, documents, metadatas } = result;
    if (!ids || !distances || !documents || !metadatas) {
      return [];
    }
    // get the result data from the first and only query vector
    const [firstIds] = ids;
    const [firstDistances] = distances;
    const [firstDocuments] = documents;
    const [firstMetadatas] = metadatas;

    if (firstDistances.some((item) => item === null)) {
      return [];
    }

    const cleanDistances = firstDistances.filter((item) => item !== null);

    const results: [Document, number][] = [];
    for (let i = 0; i < firstIds.length; i += 1) {
      let metadata: Document["metadata"] = firstMetadatas?.[i] ?? {};

      if (metadata.locFrom && metadata.locTo) {
        metadata = {
          ...metadata,
          loc: {
            lines: {
              from: metadata.locFrom,
              to: metadata.locTo,
            },
          },
        };

        delete metadata.locFrom;
        delete metadata.locTo;
      }

      results.push([
        new Document({
          pageContent: firstDocuments?.[i] ?? "",
          metadata,
          id: firstIds[i],
        }),
        cleanDistances[i],
      ]);
    }
    return results;
  }

  /**
   * Creates a new `Chroma` instance from an array of text strings. The text
   * strings are converted to `Document` instances and added to the Chroma
   * database.
   * @param texts An array of text strings.
   * @param metadatas An array of metadata objects or a single metadata object. If an array is provided, it must have the same length as the `texts` array.
   * @param embeddings An `Embeddings` instance used to generate embeddings for the documents.
   * @param dbConfig A `ChromaLibArgs` object containing the configuration for the Chroma database.
   * @returns A promise that resolves with a new `Chroma` instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: ChromaLibArgs
  ): Promise<Chroma> {
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
   * Creates a new `Chroma` instance from an array of `Document` instances.
   * The documents are added to the Chroma database.
   * @param docs An array of `Document` instances.
   * @param embeddings An `Embeddings` instance used to generate embeddings for the documents.
   * @param dbConfig A `ChromaLibArgs` object containing the configuration for the Chroma database.
   * @returns A promise that resolves with a new `Chroma` instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: ChromaLibArgs
  ): Promise<Chroma> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Creates a new `Chroma` instance from an existing collection in the
   * Chroma database.
   * @param embeddings An `Embeddings` instance used to generate embeddings for the documents.
   * @param dbConfig A `ChromaLibArgs` object containing the configuration for the Chroma database.
   * @returns A promise that resolves with a new `Chroma` instance.
   */
  static async fromExistingCollection(
    embeddings: EmbeddingsInterface,
    dbConfig: ChromaLibArgs
  ): Promise<Chroma> {
    const instance = new this(embeddings, dbConfig);
    await instance.ensureCollection();
    return instance;
  }

  /** @ignore */
  static async imports(): Promise<{
    ChromaClient: typeof ChromaClientT;
  }> {
    try {
      const { ChromaClient } = await import("chromadb");
      return { ChromaClient };
    } catch (e) {
      throw new Error(
        "Please install chromadb as a dependency with, e.g. `npm install -S chromadb`"
      );
    }
  }
}

/**
 * Generates a unique collection name if none is provided.
 */
function ensureCollectionName(collectionName?: string) {
  if (!collectionName) {
    return `langchain-${uuid.v4()}`;
  }
  return collectionName;
}
