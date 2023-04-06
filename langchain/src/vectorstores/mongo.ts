import { MongoClient, Collection, Document as MongoDocument } from "mongodb";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

export type MongoLibArgs = {
  client: MongoClient;
  collection: Collection<MongoDocument>;
  indexName?: string;
};

export type MongoVectorStoreQueryExtension = {
  preQueryPipelineSteps?: MongoDocument[];
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

  // FIXME: This will silently fail if the index not correctly set up on atlas
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: MongoVectorStoreQueryExtension
  ): Promise<[Document, number][]> {
    const pipeline: MongoDocument[] = [];

    // apply any pre-query pipeline steps
    if (filter?.preQueryPipelineSteps) {
      pipeline.push(...filter.preQueryPipelineSteps);
    }

    pipeline.push({
      $search: {
        index: "default",
        knnBeta: {
          path: "embedding",
          vector: query,
          k,
        },
      },
    });

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

    return ret;
  }

  // TODO fromDocuments

  // TODO fromText
}
