import * as uuid from "uuid";
import type { ChromaClient as ChromaClientT, Collection } from "chromadb";
import type { Where } from "chromadb/dist/main/types.js";

import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";

export type ChromaLibArgs =
  | {
      url?: string;
      numDimensions?: number;
      collectionName?: string;
      filter?: object;
    }
  | {
      index?: ChromaClientT;
      numDimensions?: number;
      collectionName?: string;
      filter?: object;
    };

export interface ChromaDeleteParams<T> {
  ids?: string[];
  filter?: T;
}

export class Chroma extends VectorStore {
  declare FilterType: Where;

  index?: ChromaClientT;

  collection?: Collection;

  collectionName: string;

  numDimensions?: number;

  url: string;

  filter?: object;

  _vectorstoreType(): string {
    return "chroma";
  }

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

    this.filter = args.filter;
  }

  async addDocuments(documents: Document[], options?: { ids?: string[] }) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  async ensureCollection(): Promise<Collection> {
    if (!this.collection) {
      if (!this.index) {
        const { ChromaClient } = await Chroma.imports();
        this.index = new ChromaClient({ path: this.url });
      }
      try {
        this.collection = await this.index.getOrCreateCollection({
          name: this.collectionName,
        });
      } catch (err) {
        throw new Error(`Chroma getOrCreateCollection error: ${err}`);
      }
    }

    return this.collection;
  }

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

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ) {
    if (filter && this.filter) {
      throw new Error("cannot provide both `filter` and `this.filter`");
    }
    const _filter = filter ?? this.filter;

    const collection = await this.ensureCollection();

    // similaritySearchVectorWithScore supports one query vector at a time
    // chroma supports multiple query vectors at a time
    const result = await collection.query({
      queryEmbeddings: query,
      nResults: k,
      where: { ..._filter },
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

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: ChromaLibArgs
  ): Promise<Chroma> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingCollection(
    embeddings: Embeddings,
    dbConfig: ChromaLibArgs
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
