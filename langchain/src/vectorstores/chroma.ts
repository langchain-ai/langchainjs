import * as uuid from "uuid";
import type { ChromaClient as ChromaClientT, Collection } from "chromadb";

import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";

export type ChromaLibArgs =
  | {
      url?: string;
      numDimensions?: number;
      collectionName?: string;
    }
  | {
      index?: ChromaClientT;
      numDimensions?: number;
      collectionName?: string;
    };

export class Chroma extends VectorStore {
  index?: ChromaClientT;

  collection?: Collection;

  collectionName: string;

  numDimensions?: number;

  url: string;

  constructor(embeddings: Embeddings, args: ChromaLibArgs) {
    super(embeddings, args);
    this.numDimensions = args.numDimensions;
    this.embeddings = embeddings;
    this.collectionName = ensureCollectionName(args.collectionName);
    if ("index" in args) {
      this.index = args.index;
    } else if ("url" in args) {
      this.url = args.url || "http://localhost:8000";
    }
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async ensureCollection(): Promise<Collection> {
    if (!this.collection) {
      if (!this.index) {
        const { ChromaClient } = await Chroma.imports();
        this.index = new ChromaClient(this.url);
      }
      this.collection = await this.index.getOrCreateCollection(
        this.collectionName
      );
    }

    return this.collection;
  }

  async addVectors(vectors: number[][], documents: Document[]) {
    if (vectors.length === 0) {
      return;
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

    const collection = await this.ensureCollection();
    const docstoreSize = await collection.count();
    await collection.add(
      Array.from({ length: vectors.length }, (_, i) =>
        (docstoreSize + i).toString()
      ),
      vectors,
      documents.map(({ metadata }) => metadata),
      documents.map(({ pageContent }) => pageContent)
    );
  }

  async similaritySearchVectorWithScore(query: number[], k: number) {
    const collection = await this.ensureCollection();

    // similaritySearchVectorWithScore supports one query vector at a time
    // chroma supports multiple query vectors at a time
    const result = await collection.query(query, k);

    const { ids, distances, documents, metadatas } = result;
    if (!ids || !distances || !documents || !metadatas) {
      return [];
    }
    // get the result data from the first and only query vector
    const [firstIds] = ids;
    const [firstDistances] = distances;
    const [firstDocuments] = documents;
    const [firstMetadatas] = metadatas;

    const results: [Document, number][] = [];
    for (let i = 0; i < firstIds.length; i += 1) {
      results.push([
        new Document({
          pageContent: firstDocuments[i],
          metadata: firstMetadatas[i],
        }),
        firstDistances[i],
      ]);
    }
    return results;
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: {
      collectionName?: string;
      url?: string;
    }
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
    return Chroma.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: {
      collectionName?: string;
      url?: string;
    }
  ): Promise<Chroma> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingCollection(
    embeddings: Embeddings,
    dbConfig: {
      collectionName: string;
      url?: string;
    }
  ): Promise<Chroma> {
    const instance = new this(embeddings, dbConfig);
    await instance.ensureCollection();
    return instance;
  }

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

function ensureCollectionName(collectionName?: string) {
  if (!collectionName) {
    return `langchain-${uuid.v4()}`;
  }
  return collectionName;
}
