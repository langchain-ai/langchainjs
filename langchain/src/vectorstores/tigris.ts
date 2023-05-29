import * as uuid from "uuid";
import type { VectorDocumentStore as VectorDocumentStoreT } from "@tigrisdata/vector";

import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";

export type TigrisLibArgs = {
  index: VectorDocumentStoreT;
};

export class TigrisVectorStore extends VectorStore {
  index?: VectorDocumentStoreT;

  constructor(embeddings: Embeddings, args: TigrisLibArgs) {
    super(embeddings, args);

    this.embeddings = embeddings;
    this.index = args.index;
  }

  async addDocuments(documents: Document[], ids?: string[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      ids
    );
  }

  async addVectors(vectors: number[][], documents: Document[], ids?: string[]) {
    if (vectors.length === 0) {
      return;
    }

    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and metadatas must have the same length`);
    }

    const documentIds = ids == null ? documents.map(() => uuid.v4()) : ids;
    await this.index?.addDocumentsWithVectors({
      ids: documentIds,
      embeddings: vectors,
      documents: documents.map(({ metadata, pageContent }) => ({
        content: pageContent,
        metadata,
      })),
    });
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: object
  ) {
    const result = await this.index?.similaritySearchVectorWithScore({
      query,
      k,
      filter,
    });

    if (!result) {
      return [];
    }

    return result.map(([document, score]) => [
      new Document({
        pageContent: document.content,
        metadata: document.metadata,
      }),
      score,
    ]) as [Document, number][];
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: TigrisLibArgs
  ): Promise<TigrisVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return TigrisVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: TigrisLibArgs
  ): Promise<TigrisVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: TigrisLibArgs
  ): Promise<TigrisVectorStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
