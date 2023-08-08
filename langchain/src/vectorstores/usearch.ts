import usearch from "usearch";
import * as uuid from "uuid";
import { Embeddings } from "../embeddings/base.js";
import { SaveableVectorStore } from "./base.js";
import { Document } from "../document.js";
import { SynchronousInMemoryDocstore } from "../stores/doc/in_memory.js";

export interface USearchArgs {
  docstore?: SynchronousInMemoryDocstore;
  index?: usearch.Index;
  mapping?: Record<number, string>;
}

export class USearch extends SaveableVectorStore {
  _index?: usearch.Index;

  _mapping: Record<number, string>;

  docstore: SynchronousInMemoryDocstore;

  args: USearchArgs;

  _vectorstoreType(): string {
    return "usearch";
  }

  constructor(embeddings: Embeddings, args: USearchArgs) {
    super(embeddings, args);
    this.args = args;
    this._index = args.index;
    this._mapping = args.mapping ?? {};
    this.embeddings = embeddings;
    this.docstore = args?.docstore ?? new SynchronousInMemoryDocstore();
  }

  async addDocuments(documents: Document[]) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  public get index(): usearch.Index {
    if (!this._index) {
      throw new Error(
        "Vector store not initialised yet. Try calling `fromTexts` or `fromDocuments` first."
      );
    }
    return this._index;
  }

  private set index(index: usearch.Index) {
    this._index = index;
  }

  async addVectors(vectors: number[][], documents: Document[]) {
    if (vectors.length === 0) {
      return [];
    }
    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and documents must have the same length`);
    }
    const dv = vectors[0].length;
    if (!this._index) {
      this._index = new usearch.Index({
        metric: "l2sq",
        connectivity: BigInt(16),
        dimensions: BigInt(dv),
      });
    }
    const d = this.index.dimensions();
    if (BigInt(dv) !== d) {
      throw new Error(
        `Vectors must have the same length as the number of dimensions (${d})`
      );
    }

    const docstoreSize = this.index.size();
    const documentIds = [];
    for (let i = 0; i < vectors.length; i += 1) {
      const documentId = uuid.v4();
      documentIds.push(documentId);
      const id = Number(docstoreSize) + i;
      this.index.add(BigInt(id), new Float32Array(vectors[i]));
      this._mapping[id] = documentId;
      this.docstore.add({ [documentId]: documents[i] });
    }
    return documentIds;
  }

  async similaritySearchVectorWithScore(query: number[], k: number) {
    const d = this.index.dimensions();
    if (BigInt(query.length) !== d) {
      throw new Error(
        `Query vector must have the same length as the number of dimensions (${d})`
      );
    }
    if (k > this.index.size()) {
      const total = this.index.size();
      console.warn(
        `k (${k}) is greater than the number of elements in the index (${total}), setting k to ${total}`
      );
      // eslint-disable-next-line no-param-reassign
      k = Number(total);
    }
    const result = this.index.search(new Float32Array(query), BigInt(k));

    const return_list: [Document, number][] = [];
    for (let i = 0; i < result.count; i += 1) {
      const uuid = this._mapping[Number(result.keys[i])];
      return_list.push([this.docstore.search(uuid), result.distances[i]]);
    }

    return return_list;
  }

  async save(directory: string) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(directory, { recursive: true });
    await Promise.all([
      this.index.save(path.join(directory, "usearch.index")),
      await fs.writeFile(
        path.join(directory, "docstore.json"),
        JSON.stringify([
          Array.from(this.docstore._docs.entries()),
          this._mapping,
        ])
      ),
    ]);
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig?: {
      docstore?: SynchronousInMemoryDocstore;
    }
  ): Promise<USearch> {
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
    dbConfig?: {
      docstore?: SynchronousInMemoryDocstore;
    }
  ): Promise<USearch> {
    const args: USearchArgs = {
      docstore: dbConfig?.docstore,
    };
    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }
}
