import type {
  MongoClient,
  Collection,
  Document as MongoDocument,
} from "mongodb";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

export type MongoLibArgs = {
  client: MongoClient;
  collection: Collection<MongoDocument>;
  indexName?: string;
};

export type MongoVectorStoreQueryExtension = {
  postQueryPipelineSteps?: MongoDocument[];
};

export class MongoVectorStore extends VectorStore {
  collection: Collection<MongoDocument>;

  client: MongoClient;

  indexName: string;

  constructor(embeddings: Embeddings, args: MongoLibArgs) {
    super(embeddings, args);
    this.collection = args.collection;
    this.client = args.client;
    this.indexName = args.indexName || "default";
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const items = vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding,
      metadata: documents[idx].metadata,
    }));

    await this.collection.insertMany(items);
  }

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
