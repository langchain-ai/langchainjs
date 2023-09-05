import type {
  MongoClient,
  Collection,
  Document as MongoDocument,
} from "mongodb";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

/** @deprecated use `MongoDBAtlasVectorSearch` instead. */
export type MongoLibArgs = {
  client: MongoClient;
  collection: Collection<MongoDocument>;
  indexName?: string;
};

/**
 * Type that defines an extension for MongoDB queries. It includes an
 * optional array of post-query pipeline steps.
 */
export type MongoVectorStoreQueryExtension = {
  postQueryPipelineSteps?: MongoDocument[];
};

/** @deprecated use `MongoDBAtlasVectorSearch` instead. */
export class MongoVectorStore extends VectorStore {
  declare FilterType: MongoVectorStoreQueryExtension;

  collection: Collection<MongoDocument>;

  client: MongoClient;

  indexName: string;

  _vectorstoreType(): string {
    return "mongodb";
  }

  constructor(embeddings: Embeddings, args: MongoLibArgs) {
    super(embeddings, args);
    this.collection = args.collection;
    this.client = args.client;
    this.indexName = args.indexName || "default";
  }

  /**
   * Method that adds documents to the MongoDB collection. It first converts
   * the documents into vectors using the `embedDocuments` method of the
   * `embeddings` instance, and then adds these vectors to the collection.
   * @param documents Array of Document instances to be added to the MongoDB collection.
   * @returns Promise that resolves when the documents have been added to the collection.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Method that adds vectors to the MongoDB collection. It creates an array
   * of items, each containing the content, embedding, and metadata of a
   * document, and then inserts these items into the collection.
   * @param vectors Array of vectors to be added to the MongoDB collection.
   * @param documents Array of Document instances corresponding to the vectors.
   * @returns Promise that resolves when the vectors have been added to the collection.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const items = vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding,
      metadata: documents[idx].metadata,
    }));

    await this.collection.insertMany(items);
  }

  /**
   * Method that performs a similarity search on vectors and returns the
   * documents and their similarity scores. It constructs a MongoDB
   * aggregation pipeline, applies any post-query pipeline steps if
   * provided, and then executes the pipeline to retrieve the results.
   * @param query Query vector for the similarity search.
   * @param k Number of nearest neighbors to return.
   * @param filter Optional filter for the query, which can include post-query pipeline steps.
   * @returns Promise that resolves to an array of tuples, each containing a Document instance and its similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: MongoVectorStoreQueryExtension
  ): Promise<[Document, number][]> {
    // Search has to be the first pipeline step (https://www.mongodb.com/docs/atlas/atlas-search/query-syntax/#behavior)
    // We hopefully this changes in the future
    const pipeline: MongoDocument[] = [
      {
        $search: {
          index: this.indexName,
          knnBeta: {
            path: "embedding",
            vector: query,
            k,
          },
        },
      },
    ];

    // apply any post-query pipeline steps (idk how useful the option to do this is in practice)
    if (filter?.postQueryPipelineSteps) {
      pipeline.push(...filter.postQueryPipelineSteps);
    }

    pipeline.push({
      $project: {
        _id: 0,
        content: 1,
        metadata: 1,
        similarity: {
          $arrayElemAt: ["$knnBeta.similarity", 0],
        },
      },
    });

    const results = this.collection.aggregate(pipeline);

    const ret: [Document, number][] = [];

    for await (const result of results) {
      ret.push([
        new Document({
          pageContent: result.content,
          metadata: result.metadata,
        }),
        result.similarity,
      ]);
    }

    // Attempt to warn if it appears that the indexing failed
    if (
      ret.length === 0 &&
      k > 0 &&
      filter?.postQueryPipelineSteps === undefined
    ) {
      // check for existence of documents (if nothing is there we should expect no results)
      const count = await this.collection.countDocuments();

      if (count !== 0) {
        console.warn(
          "MongoDB search query returned no results where results were expected:\n" +
            "This may be because the index is improperly configured or because the indexing over recently added documents has not yet completed."
        );
      }
    }

    return ret;
  }

  /**
   * Static method that creates a `MongoVectorStore` instance from an array
   * of texts. It creates Document instances from the texts and their
   * corresponding metadata, and then calls the `fromDocuments` method to
   * create the `MongoVectorStore` instance.
   * @param texts Array of texts to be converted into Document instances.
   * @param metadatas Array or single object of metadata corresponding to the texts.
   * @param embeddings Embeddings instance used to convert the texts into vectors.
   * @param dbConfig Configuration for the MongoDB database.
   * @returns Promise that resolves to a new MongoVectorStore instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: MongoLibArgs
  ): Promise<MongoVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return MongoVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method that creates a `MongoVectorStore` instance from an array
   * of Document instances. It creates a new `MongoVectorStore` instance,
   * adds the documents to it, and then returns the instance.
   * @param docs Array of Document instances to be added to the `MongoVectorStore`.
   * @param embeddings Embeddings instance used to convert the documents into vectors.
   * @param dbConfig Configuration for the MongoDB database.
   * @returns Promise that resolves to a new MongoVectorStore instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: MongoLibArgs
  ): Promise<MongoVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
