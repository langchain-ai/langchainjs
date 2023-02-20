import fs from "fs/promises";
import path from "path";
import type {
  ChromaClient as ChromaClientT,
} from "chromadb";
import { ChromaClient as ChromaClientO } from "chromadb";

import { Embeddings } from "../embeddings/base";

import { DocStore, SaveableVectorStore } from "./base";
import { Document } from "../document";

const COLLECTION_NAME = "langchain-collection-2";

let ChromaClient: typeof ChromaClientT | null = null;

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ({ ChromaClient } = require("chromadb"));
} catch {
  // ignore error
}
ChromaClient = ChromaClientO;

export interface ChromaLibArgs {
  space: string;
  numDimensions?: number;
}

export class Chroma extends SaveableVectorStore {
  index?: ChromaClientT;
  
  docstore: DocStore;

  args: ChromaLibArgs;

  constructor(
    args: ChromaLibArgs,
    embeddings: Embeddings,
    docstore: DocStore,
    index?: ChromaClientT
  ) {
    super(embeddings);
    this.index = index;
    this.args = args;
    this.embeddings = embeddings;
    this.docstore = docstore;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(await this.embeddings.embedDocuments(texts), documents);
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
      try {
        await this.index.createCollection(COLLECTION_NAME);
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

    const collection = await this.index.getCollection(COLLECTION_NAME);
    for (let i = 0; i < vectors.length; i += 1) {
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
    const collection = await this.index.getCollection(COLLECTION_NAME);
    const result = await collection.query(query, k);
    const {ids, distances} = result;

    // ids comes back as a list of lists, so we need to flatten it
    let takeIds = ids[0]

    var results = [];
    for (let i = 0; i < takeIds.length; i += 1) {
      takeIds[i] = parseInt(takeIds[i]);
      results.push([this.docstore[takeIds[i]], distances[i]] as [Document, number]);
    }
    return results;
  }

  async save(directory: string) {
    if (!this.index) {
      throw new Error(
        "Vector store not initialised yet. Try calling `addTexts` first."
      );
    }
    await fs.mkdir(directory, { recursive: true });
    await Promise.all([
      await fs.writeFile(
        path.join(directory, "args.json"),
        JSON.stringify(this.args)
      ),
      await fs.writeFile(
        path.join(directory, "docstore.json"),
        JSON.stringify(this.docstore)
      ),
    ]);
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
