import { v4 as uuidv4 } from "uuid";
import type { ChromaClient as ChromaClientT } from "chromadb";

import { Embeddings } from "../embeddings/base";
import { VectorStore } from "./base";
import { Document } from "../document";

let ChromaClient: typeof ChromaClientT | null = null;

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ({ ChromaClient } = require("chromadb"));
} catch {
  // ignore error
}

export interface ChromaLibArgs {
  url?: string;
  numDimensions?: number;
  collectionName?: string;
}

export class Chroma extends VectorStore {
  index?: ChromaClientT;

  args: ChromaLibArgs;

  collectionName: string;

  url: string;

  constructor(
    args: ChromaLibArgs,
    embeddings: Embeddings,
    index?: ChromaClientT
  ) {
    super(embeddings);
    this.index = index;
    this.args = args;
    this.embeddings = embeddings;
    this.collectionName = ensureCollectionName(args.collectionName);
    this.url = args.url || "http://localhost:8000";
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[]) {
    if (vectors.length === 0) {
      return;
    }
    if (!this.index) {
      if (this.args.numDimensions === undefined) {
        this.args.numDimensions = vectors[0].length;
      }
      if (ChromaClient === null) {
        throw new Error(
          "Please install chromadb as a dependency with, e.g. `npm install -S chromadb`"
        );
      }
      this.index = new ChromaClient(this.url);
      try {
        await this.index.createCollection(this.collectionName);
      } catch {
        // ignore error
      }
    }
    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and metadatas must have the same length`);
    }
    if (vectors[0].length !== this.args.numDimensions) {
      throw new Error(
        `Vectors must have the same length as the number of dimensions (${this.args.numDimensions})`
      );
    }

    const collection = await this.index.getCollection(this.collectionName);
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
    if (!this.index) {
      throw new Error(
        "Vector store not initialised yet. Try calling `addTexts` first."
      );
    }
    const collection = await this.index.getCollection(this.collectionName);

    // similaritySearchVectorWithScore supports one query vector at a time
    // chroma supports multiple query vectors at a time
    const result = await collection.query(query, k);

    const { ids, distances, documents, metadatas } = result;
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
    metadatas: object[],
    embeddings: Embeddings,
    collectionName?: string,
    url?: string
  ): Promise<Chroma> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const newDoc = new Document({
        pageContent: texts[i],
        metadata: metadatas[i],
      });
      docs.push(newDoc);
    }
    return Chroma.fromDocuments(docs, embeddings, collectionName, url);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    collectionName?: string,
    url?: string
  ): Promise<Chroma> {
    if (ChromaClient === null) {
      throw new Error(
        "Please install chromadb as a dependency with, e.g. `npm install -S chromadb`"
      );
    }

    const args: ChromaLibArgs = {
      collectionName,
      url,
    };
    const instance = new this(args, embeddings);
    await instance.addDocuments(docs);
    return instance;
  }
}

function ensureCollectionName(collectionName?: string) {
  if (!collectionName) {
    return `langchain-${uuidv4()}`;
  }
  return collectionName;
}
