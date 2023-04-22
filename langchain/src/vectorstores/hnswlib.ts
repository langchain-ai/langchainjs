import type {
  HierarchicalNSW as HierarchicalNSWT,
  SpaceName,
} from "hnswlib-node";
import { Embeddings } from "../embeddings/base.js";
import { SaveableVectorStore } from "./base.js";
import { Document } from "../document.js";
import { InMemoryDocstore } from "../docstore/index.js";

export interface HNSWLibBase {
  space: SpaceName;
  numDimensions?: number;
}

export interface HNSWLibArgs extends HNSWLibBase {
  docstore?: InMemoryDocstore;
  index?: HierarchicalNSWT;
}

export class HNSWLib extends SaveableVectorStore {
  _index?: HierarchicalNSWT;

  docstore: InMemoryDocstore;

  args: HNSWLibBase;

  constructor(embeddings: Embeddings, args: HNSWLibArgs) {
    super(embeddings, args);
    this._index = args.index;
    this.args = args;
    this.embeddings = embeddings;
    this.docstore = args?.docstore ?? new InMemoryDocstore();
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  private static async getHierarchicalNSW(args: HNSWLibBase) {
    const { HierarchicalNSW } = await HNSWLib.imports();
    if (!args.space) {
      throw new Error("hnswlib-node requires a space argument");
    }
    if (args.numDimensions === undefined) {
      throw new Error("hnswlib-node requires a numDimensions argument");
    }
    return new HierarchicalNSW(args.space, args.numDimensions);
  }

  private async initIndex(vectors: number[][]) {
    if (!this._index) {
      if (this.args.numDimensions === undefined) {
        this.args.numDimensions = vectors[0].length;
      }
      this.index = await HNSWLib.getHierarchicalNSW(this.args);
    }
    if (!this.index.getCurrentCount()) {
      this.index.initIndex(vectors.length);
    }
  }

  public get index(): HierarchicalNSWT {
    if (!this._index) {
      throw new Error(
        "Vector store not initialised yet. Try calling `addTexts` first."
      );
    }
    return this._index;
  }

  private set index(index: HierarchicalNSWT) {
    this._index = index;
  }

  async addVectors(vectors: number[][], documents: Document[]) {
    if (vectors.length === 0) {
      return;
    }
    await this.initIndex(vectors);

    // TODO here we could optionally normalise the vectors to unit length
    // so that dot product is equivalent to cosine similarity, like this
    // https://github.com/nmslib/hnswlib/issues/384#issuecomment-1155737730
    // While we only support OpenAI embeddings this isn't necessary
    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and metadatas must have the same length`);
    }
    if (vectors[0].length !== this.args.numDimensions) {
      throw new Error(
        `Vectors must have the same length as the number of dimensions (${this.args.numDimensions})`
      );
    }
    const capacity = this.index.getMaxElements();
    const needed = this.index.getCurrentCount() + vectors.length;
    if (needed > capacity) {
      this.index.resizeIndex(needed);
    }
    const docstoreSize = this.docstore.count;
    for (let i = 0; i < vectors.length; i += 1) {
      this.index.addPoint(vectors[i], docstoreSize + i);
      this.docstore.add({ [docstoreSize + i]: documents[i] });
    }
  }

  async similaritySearchVectorWithScore(query: number[], k: number) {
    if (this.args.numDimensions && !this._index) {
      await this.initIndex([[]]);
    }
    if (query.length !== this.args.numDimensions) {
      throw new Error(
        `Query vector must have the same length as the number of dimensions (${this.args.numDimensions})`
      );
    }
    if (k > this.index.getCurrentCount()) {
      const total = this.index.getCurrentCount();
      console.warn(
        `k (${k}) is greater than the number of elements in the index (${total}), setting k to ${total}`
      );
      // eslint-disable-next-line no-param-reassign
      k = total;
    }
    const result = this.index.searchKnn(query, k);
    return result.neighbors.map(
      (docIndex, resultIndex) =>
        [
          this.docstore.search(String(docIndex)),
          result.distances[resultIndex],
        ] as [Document, number]
    );
  }

  async save(directory: string) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(directory, { recursive: true });
    await Promise.all([
      this.index.writeIndex(path.join(directory, "hnswlib.index")),
      await fs.writeFile(
        path.join(directory, "args.json"),
        JSON.stringify(this.args)
      ),
      await fs.writeFile(
        path.join(directory, "docstore.json"),
        JSON.stringify(Array.from(this.docstore._docs.entries()))
      ),
    ]);
  }

  static async load(directory: string, embeddings: Embeddings) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const args = JSON.parse(
      await fs.readFile(path.join(directory, "args.json"), "utf8")
    );
    const index = await HNSWLib.getHierarchicalNSW(args);
    const [docstoreFiles] = await Promise.all([
      fs
        .readFile(path.join(directory, "docstore.json"), "utf8")
        .then(JSON.parse),
      index.readIndex(path.join(directory, "hnswlib.index")),
    ]);
    args.docstore = new InMemoryDocstore(new Map(docstoreFiles));

    args.index = index;

    return new HNSWLib(embeddings, args);
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig?: {
      docstore?: InMemoryDocstore;
    }
  ): Promise<HNSWLib> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return HNSWLib.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig?: {
      docstore?: InMemoryDocstore;
    }
  ): Promise<HNSWLib> {
    const args: HNSWLibArgs = {
      docstore: dbConfig?.docstore,
      space: "cosine",
    };
    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }

  static async imports(): Promise<{
    HierarchicalNSW: typeof HierarchicalNSWT;
  }> {
    try {
      const {
        default: { HierarchicalNSW },
      } = await import("hnswlib-node");

      return { HierarchicalNSW };
    } catch (err) {
      throw new Error(
        "Please install hnswlib-node as a dependency with, e.g. `npm install -S hnswlib-node`"
      );
    }
  }
}
