import * as uuid from "uuid";
import {
  HybridOptions,
  CollectionConfigCreate,
  configure,
  type DataObject,
  type FilterValue,
  GenerateOptions,
  GenerativeConfigRuntime,
  Metadata,
  Vectors,
  WeaviateClient,
  type WeaviateField,
  BaseHybridOptions,
  MetadataKeys,
} from "weaviate-client";
import {
  type MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";

// Note this function is not generic, it is designed specifically for Weaviate
// https://weaviate.io/developers/weaviate/config-refs/datatypes#introduction
export const flattenObjectForWeaviate = (obj: Record<string, unknown>) => {
  const flattenedObject: Record<string, unknown> = {};
  for (const key in obj) {
    if (!Object.hasOwn(obj, key)) {
      continue;
    }

    // Replace any character that is not a letter, a number, or an underscore with '_'
    const newKey = key.replace(/[^a-zA-Z0-9_]/g, "_");

    const value = obj[key];
    if (typeof value === "object" && !Array.isArray(value)) {
      const recursiveResult = flattenObjectForWeaviate(
        value as Record<string, unknown>
      );
      for (const deepKey in recursiveResult) {
        if (Object.hasOwn(recursiveResult, deepKey)) {
          // Replace any character in the deepKey that is not a letter, a number, or an underscore with '_'
          const newDeepKey = deepKey.replace(/[^a-zA-Z0-9_]/g, "_");
          flattenedObject[`${newKey}_${newDeepKey}`] = recursiveResult[deepKey];
        }
      }
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        flattenedObject[newKey] = value;
      } else if (
        typeof value[0] !== "object" &&
        value.every((el: unknown) => typeof el === typeof value[0])
      ) {
        // Weaviate only supports arrays of primitive types,
        // where all elements are of the same type
        flattenedObject[newKey] = value;
      }
    } else {
      flattenedObject[newKey] = value;
    }
  }
  return flattenedObject;
};

/**
 * Interface that defines the arguments required to create a new instance
 * of the `WeaviateStore` class. It includes the Weaviate client, the name
 * of the class in Weaviate, and optional keys for text and metadata.
 */
export interface WeaviateLibArgs {
  client: WeaviateClient;
  /**
   * The name of the class in Weaviate. Must start with a capital letter.
   */
  indexName?: string;
  textKey?: string;
  metadataKeys?: string[];
  tenant?: string;
  schema?: CollectionConfigCreate;
}

export class WeaviateDocument extends Document {
  generated?: string;

  additional: Partial<Metadata>;

  vectors: Vectors;
}

/**
 * Class that extends the `VectorStore` base class. It provides methods to
 * interact with a Weaviate index, including adding vectors and documents,
 * deleting data, and performing similarity searches.
 */
export class WeaviateStore extends VectorStore {
  declare FilterType: FilterValue;

  private client: WeaviateClient;

  private indexName: string;

  private textKey: string;

  private queryAttrs: string[];

  private tenant?: string;

  private schema?: CollectionConfigCreate;

  _vectorstoreType(): string {
    return "weaviate";
  }

  constructor(public embeddings: EmbeddingsInterface, args: WeaviateLibArgs) {
    super(embeddings, args);

    this.client = args.client;
    this.indexName = args.indexName || args.schema?.name || "";
    this.textKey = args.textKey || "text";
    this.queryAttrs = [this.textKey];
    this.tenant = args.tenant;
    this.schema = args.schema;

    if (args.metadataKeys) {
      this.queryAttrs = [
        ...new Set([
          ...this.queryAttrs,
          ...args.metadataKeys.filter((k) => {
            // https://spec.graphql.org/June2018/#sec-Names
            // queryAttrs need to be valid GraphQL Names
            const keyIsValid = /^[_A-Za-z][_0-9A-Za-z]*$/.test(k);
            if (!keyIsValid) {
              console.warn(
                `Skipping metadata key ${k} as it is not a valid GraphQL Name`
              );
            }
            return keyIsValid;
          }),
        ]),
      ];
    }
  }

  static async initialize(
    embeddings: EmbeddingsInterface,
    config: WeaviateLibArgs & { dimensions?: number }
  ): Promise<WeaviateStore> {
    const weaviateStore = new this(embeddings, config);
    const collection = await weaviateStore.client.collections.exists(
      weaviateStore.indexName
    );
    if (!collection) {
      if (weaviateStore.schema) {
        await weaviateStore.client.collections.create(weaviateStore.schema);
      } else {
        if (config.tenant) {
          await weaviateStore.client.collections.create({
            name: weaviateStore.indexName,
            multiTenancy: configure.multiTenancy({
              enabled: true,
              autoTenantCreation: true,
            }),
          });
        } else {
          await weaviateStore.client.collections.create({
            name: weaviateStore.indexName,
          });
        }
      }
    }
    return weaviateStore;
  }

  /**
   * Method to add vectors and corresponding documents to the Weaviate
   * index.
   * @param vectors Array of vectors to be added.
   * @param documents Array of documents corresponding to the vectors.
   * @param options Optional parameter that can include specific IDs for the documents.
   * @returns An array of document IDs.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] }
  ) {
    const documentIds = options?.ids ?? documents.map((_) => uuid.v4());
    const batch: DataObject<undefined>[] = documents.map((document, index) => {
      if (Object.hasOwn(document.metadata, "id"))
        throw new Error(
          "Document inserted to Weaviate vectorstore should not have `id` in their metadata."
        );
      const flattenedMetadata = flattenObjectForWeaviate(
        document.metadata
      ) as Record<string, WeaviateField>;
      return {
        id: documentIds[index],
        vectors: vectors[index],
        references: {},
        properties: {
          [this.textKey]: document.pageContent,
          ...flattenedMetadata,
        },
      };
    });

    try {
      const collection = this.client.collections.get(this.indexName);
      let response;
      if (this.tenant) {
        response = await collection
          .withTenant(this.tenant)
          .data.insertMany(batch);
      } else {
        response = await collection.data.insertMany(batch);
      }
      console.log(
        `Successfully imported batch of ${
          Object.values(response.uuids).length
        } items`
      );
      if (response.hasErrors) {
        console.log("this the error", response.errors);
        throw new Error("Error in batch import!");
      }
      return Object.values(response.uuids);
    } catch (error) {
      console.error("Error importing batch:", error);
      throw error;
    }
  }

  /**
   * Method to add documents to the Weaviate index. It first generates
   * vectors for the documents using the embeddings, then adds the vectors
   * and documents to the index.
   * @param documents Array of documents to be added.
   * @param options Optional parameter that can include specific IDs for the documents.
   * @returns An array of document IDs.
   */
  async addDocuments(documents: Document[], options?: { ids?: string[] }) {
    return this.addVectors(
      await this.embeddings.embedDocuments(documents.map((d) => d.pageContent)),
      documents,
      options
    );
  }

  /**
   * Method to delete data from the Weaviate index. It can delete data based
   * on specific IDs or a filter.
   * @param params Object that includes either an array of IDs or a filter for the data to be deleted.
   * @returns Promise that resolves when the deletion is complete.
   */
  async delete(params: {
    ids?: string[];
    filter?: FilterValue;
  }): Promise<void> {
    const { ids, filter } = params;
    const collection = this.client.collections.get(this.indexName);
    if (ids && ids.length > 0) {
      if (this.tenant) {
        await collection
          .withTenant(this.tenant)
          .data.deleteMany(collection.filter.byId().containsAny(ids));
      } else {
        await collection.data.deleteMany(
          collection.filter.byId().containsAny(ids)
        );
      }
    } else if (filter) {
      if (this.tenant) {
        await collection.withTenant(this.tenant).data.deleteMany(filter);
      } else {
        await collection.data.deleteMany(filter);
      }
    } else {
      throw new Error(
        `This method requires either "ids" or "filter" to be set in the input object`
      );
    }
  }

  /**
   * Hybrid search combines the results of a vector search and a
   * keyword (BM25F) search by fusing the two result sets.
   * @param query The query to search for.
   * @param options available options for the search. Check docs for complete list
   * @returns Promise that resolves the result of the search within the fetched collection.
   */
  async hybridSearch(
    query: string,
    options?: HybridOptions<undefined>
  ): Promise<Document[]> {
    const collection = this.client.collections.get(this.indexName);
    let query_vector: number[] | undefined;
    if (!options?.vector) {
      query_vector = await this.embeddings.embedQuery(query);
    }

    const options_with_vector = {
      ...options,
      vector: options?.vector || query_vector,
      returnMetadata: [
        "score",
        ...((options?.returnMetadata as MetadataKeys) || []),
      ] as MetadataKeys,
    };
    let result;
    if (this.tenant) {
      result = await collection.withTenant(this.tenant).query.hybrid(query, {
        ...options_with_vector,
      });
    } else {
      result = await collection.query.hybrid(query, {
        ...options_with_vector,
      });
    }
    const documents: Document[] = [];

    for (const data of result.objects) {
      const { properties = {}, metadata = {} } = data ?? {};
      const { [this.textKey]: text, ...rest } = properties;

      documents.push(
        new Document({
          pageContent: String(text ?? ""),
          metadata: {
            ...rest,
            ...metadata,
          },
          id: data.uuid,
        })
      );
    }
    return documents;
  }

  /**
   * Weaviate's Retrieval Augmented Generation (RAG) combines information retrieval
   * with generative AI models. It first performs the search, then passes both
   * the search results and your prompt to a generative AI model before returning the generated response.
   * @param query The query to search for.
   * @param generate available options for the generation. Check docs for complete list
   * @param options available options for performing the hybrid search
   * @returns Promise that resolves the result of the search including the generated data.
   */
  async generate(
    query: string,
    generate: GenerateOptions<undefined, GenerativeConfigRuntime | undefined>,
    options?: BaseHybridOptions<undefined>
  ): Promise<WeaviateDocument[]> {
    const collection = this.client.collections.get(this.indexName);
    let result;
    if (this.tenant) {
      result = await collection
        .withTenant(this.tenant)
        .generate.hybrid(
          query,
          { ...(generate || {}) },
          { ...(options || {}) }
        );
    } else {
      result = await collection.generate.hybrid(
        query,
        { ...(generate || {}) },
        { ...(options || {}) }
      );
    }
    const documents = [];
    for (const data of result.objects) {
      const { properties = {} } = data ?? {};
      const { [this.textKey]: text, ...rest } = properties;

      const doc = new WeaviateDocument({
        pageContent: String(text ?? ""),
        metadata: {
          ...rest,
        },
        id: data.uuid,
      });

      doc.generated = data.generative?.text;
      doc.vectors = data.vectors;
      doc.additional = data.metadata || {};

      documents.push(doc);
    }
    return documents;
  }

  /**
   * Method to perform a similarity search on the stored vectors in the
   * Weaviate index. It returns the top k most similar documents and their
   * similarity scores.
   * @param query The query vector.
   * @param k The number of most similar documents to return.
   * @param filter Optional filter to apply to the search.
   * @returns An array of tuples, where each tuple contains a document and its similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: FilterValue
  ): Promise<[Document, number][]> {
    const resultsWithEmbedding =
      await this.similaritySearchVectorWithScoreAndEmbedding(query, k, filter);
    return resultsWithEmbedding.map(([document, score, _embedding]) => [
      document,
      score,
    ]);
  }

  /**
   * Method to perform a similarity search on the stored vectors in the
   * Weaviate index. It returns the top k most similar documents, their
   * similarity scores and embedding vectors.
   * @param query The query vector.
   * @param k The number of most similar documents to return.
   * @param filter Optional filter to apply to the search.
   * @returns An array of tuples, where each tuple contains a document, its similarity score and its embedding vector.
   */
  async similaritySearchVectorWithScoreAndEmbedding(
    query: number[],
    k: number,
    filter?: FilterValue
  ): Promise<[Document, number, number, number[]][]> {
    try {
      const collection = this.client.collections.get(this.indexName);
      // define query attributes to return
      // if no queryAttrs, show all properties
      const queryAttrs =
        this.queryAttrs.length > 1 ? this.queryAttrs : undefined;
      let result;
      if (this.tenant) {
        result = await collection
          .withTenant(this.tenant)
          .query.nearVector(query, {
            filters: filter,
            limit: k,
            returnMetadata: ["distance", "score"],
            returnProperties: queryAttrs,
          });
      } else {
        result = await collection.query.nearVector(query, {
          filters: filter,
          limit: k,
          includeVector: true,
          returnMetadata: ["distance", "score"],
          returnProperties: queryAttrs,
        });
      }

      const documents: [Document, number, number, number[]][] = [];

      for (const data of result.objects) {
        const { properties = {}, metadata = {} } = data ?? {};
        const { [this.textKey]: text, ...rest } = properties;

        documents.push([
          new Document({
            pageContent: String(text ?? ""),
            metadata: {
              ...rest,
            },
            id: data.uuid,
          }),
          metadata?.distance ?? 0,
          metadata?.score ?? 0,
          Object.values(data.vectors)[0],
        ]);
      }
      return documents;
    } catch (e) {
      throw Error(`Error in similaritySearch ${e}`);
    }
  }

  /**
   * Return documents selected using the maximal marginal relevance.
   * Maximal marginal relevance optimizes for similarity to the query AND diversity
   * among selected documents.
   *
   * @param {string} query - Text to look up documents similar to.
   * @param {number} options.k - Number of documents to return.
   * @param {number} options.fetchK - Number of documents to fetch before passing to the MMR algorithm.
   * @param {number} options.lambda - Number between 0 and 1 that determines the degree of diversity among the results,
   *                 where 0 corresponds to maximum diversity and 1 to minimum diversity.
   * @param {this["FilterType"]} options.filter - Optional filter
   * @param _callbacks
   *
   * @returns {Promise<Document[]>} - List of documents selected by maximal marginal relevance.
   */
  override async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>,
    _callbacks?: undefined
  ): Promise<Document[]> {
    const { k, fetchK = 20, lambda = 0.5, filter } = options;
    const queryEmbedding: number[] = await this.embeddings.embedQuery(query);
    const allResults: [Document, number, number, number[]][] =
      await this.similaritySearchVectorWithScoreAndEmbedding(
        queryEmbedding,
        fetchK,
        filter
      );
    const embeddingList = allResults.map(
      ([_doc, _distance, _score, embedding]) => embedding
    );
    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      lambda,
      k
    );
    return mmrIndexes
      .filter((idx) => idx !== -1)
      .map((idx) => allResults[idx][0]);
  }

  /**
   * Static method to create a new `WeaviateStore` instance from a list of
   * texts. It first creates documents from the texts and metadata, then
   * adds the documents to the Weaviate index.
   * @param texts Array of texts.
   * @param metadatas Metadata for the texts. Can be a single object or an array of objects.
   * @param embeddings Embeddings to be used for the texts.
   * @param args Arguments required to create a new `WeaviateStore` instance.
   * @returns A new `WeaviateStore` instance.
   */
  static fromTexts(
    texts: string[],
    metadatas: object | object[],
    embeddings: EmbeddingsInterface,
    args: WeaviateLibArgs
  ): Promise<WeaviateStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return WeaviateStore.fromDocuments(docs, embeddings, args);
  }

  /**
   * Static method to create a new `WeaviateStore` instance from a list of
   * documents. It adds the documents to the Weaviate index.
   * @param docs Array of documents.
   * @param embeddings Embeddings to be used for the documents.
   * @param args Arguments required to create a new `WeaviateStore` instance.
   * @returns A new `WeaviateStore` instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    args: WeaviateLibArgs
  ): Promise<WeaviateStore> {
    const instance = await this.initialize(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Static method to create a new `WeaviateStore` instance from an existing
   * Weaviate index.
   * @param embeddings Embeddings to be used for the Weaviate index.
   * @param args Arguments required to create a new `WeaviateStore` instance.
   * @returns A new `WeaviateStore` instance.
   */
  static async fromExistingIndex(
    embeddings: EmbeddingsInterface,
    args: WeaviateLibArgs
  ): Promise<WeaviateStore> {
    return new this(embeddings, args);
  }
}
