import fs from "fs/promises";
import path from "path";
import type {
  ChromaClient as ChromaClientT,
} from "chromadb";

import { Embeddings } from "../embeddings/base";

import { DocStore, SaveableVectorStore } from "./base";
import { Document } from "../document";

let ChromaClient: typeof ChromaClientT | null = null;

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ({ ChromaClient } = require("chromadb"));
} catch {
  // ignore error
}

export interface ChromaLibArgs {
  space: string;
  numDimensions?: number;
}

export class Chroma extends SaveableVectorStore {
  index?: ChromaClientT;

  args: ChromaLibArgs;

  constructor(
    args: ChromaLibArgs,
    embeddings: Embeddings,
    docstore: DocStore,
    index?: ChromaClientT
  ) {
    super();
    this.index = index;
    this.args = args;
    this.embeddings = embeddings;
    this.docstore = docstore;
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
      this.index = new ChromaClient("http://localhost:8000");
      await this.index.createCollection("langchain-collection");
    }
    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and metadatas must have the same length`);
    }
    if (vectors[0].length !== this.args.numDimensions) {
      throw new Error(
        `Vectors must have the same length as the number of dimensions (${this.args.numDimensions})`
      );
    }
    const collection = await this.index!.getCollection("langchain-collection");
    for (let i = 0; i < vectors.length; i += 1) {
      collection.add(i.toString(), vectors[i]);
      await collection.add(
        i.toString(),
        vectors[i]
      )
      this.docstore[i] = documents[i];
    }
  }

  async similaritySearchVectorWithScore(query: number[], k: number) {
    if (!this.index) {
      throw new Error(
        "Vector store not initialised yet. Try calling `addTexts` first."
      );
    }
    const collection = await this.index.getCollection("langchain-collection");
    const result = await collection.query(query, k);
    const {ids, distances} = result;

    var results = [];
    for (let i = 0; i < ids.length; i += 1) {
      ids[i] = parseInt(ids[i]);
      results.push([this.docstore[ids[i]], distances[i]] as [Document, number]);
    }
    return results;
  }

  async save(directory: string) {
    if (!this.index) {
      throw new Error(
        "Vector store not initialised yet. Try calling `addTexts` first."
      );
    }
    // Save is not implemented because the backend is persistent
    directory; // workaround for unused variable
  }

  static async load(directory: string, embeddings: Embeddings) {
    if (ChromaClient === null) {
      throw new Error(
        "Please install chromadb as a dependency with, e.g. `npm install -S chromadb`"
      );
    }
    const args = JSON.parse(
      await fs.readFile(path.join(directory, "args.json"), "utf8")
    );

    const index = new ChromaClient("http://localhost:8000");
    const [docstore] = await Promise.all([
      fs
        .readFile(path.join(directory, "docstore.json"), "utf8")
        .then(JSON.parse),
    ]);

    return new Chroma(args, embeddings, docstore, index);
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[],
    embeddings: Embeddings
  ): Promise<Chroma> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const newDoc = new Document({
        pageContent: texts[i],
        metadata: metadatas[i],
      });
      docs.push(newDoc);
    }
    return Chroma.fromDocuments(docs, embeddings);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings
  ): Promise<Chroma> {
    if (ChromaClient === null) {
      throw new Error(
        "Please install chromadb as a dependency with, e.g. `npm install -S chromadb`"
      );
    }
    const args: ChromaLibArgs = {
      space: "ip", // dot product
    };
    const instance = new this(args, embeddings, {});
    await instance.addDocuments(docs);
    return instance;
  }
}
