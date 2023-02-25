import fs from "fs/promises";
import path from "path";
import type {
  HierarchicalNSW as HierarchicalNSWT,
  SpaceName,
} from "hnswlib-node";
import { Embeddings } from "../embeddings/base";
import { SaveableVectorStore } from "./base";
import { Document } from "../document";
import { InMemoryDocstore } from "../docstore";

let HierarchicalNSW: typeof HierarchicalNSWT | null = null;

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ({ HierarchicalNSW } = require("hnswlib-node"));
} catch {
  // ignore error
}

export interface HNSWLibArgs {
  space: SpaceName;
  numDimensions?: number;
}

export class HNSWLib extends SaveableVectorStore {
  index?: HierarchicalNSWT;

  docstore: InMemoryDocstore;

  args: HNSWLibArgs;

  constructor(
    args: HNSWLibArgs,
    embeddings: Embeddings,
    docstore: InMemoryDocstore,
    index?: HierarchicalNSWT
  ) {
    super(embeddings);
    this.index = index;
    this.args = args;
    this.embeddings = embeddings;
    this.docstore = docstore;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
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
      if (HierarchicalNSW === null) {
        throw new Error(
          "Please install hnswlib-node as a dependency with, e.g. `npm install -S hnswlib-node`"
        );
      }
      this.index = new HierarchicalNSW(
        this.args.space,
        this.args.numDimensions
      );
      this.index.initIndex(vectors.length);
    }
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
    if (!this.index) {
      throw new Error(
        "Vector store not initialised yet. Try calling `addTexts` first."
      );
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
    if (!this.index) {
      throw new Error(
        "Vector store not initialised yet. Try calling `addTexts` first."
      );
    }
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
    if (HierarchicalNSW === null) {
      throw new Error(
        "Please install hnswlib-node as a dependency with, e.g. `npm install -S hnswlib-node`"
      );
    }
    const args = JSON.parse(
      await fs.readFile(path.join(directory, "args.json"), "utf8")
    );
    const index = new HierarchicalNSW(args.space, args.numDimensions);
    const [docstoreFiles] = await Promise.all([
      fs
        .readFile(path.join(directory, "docstore.json"), "utf8")
        .then(JSON.parse),
      index.readIndex(path.join(directory, "hnswlib.index")),
    ]);
    const docstore = new InMemoryDocstore(new Map(docstoreFiles));

    return new HNSWLib(args, embeddings, docstore, index);
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[],
    embeddings: Embeddings,
    docstore: InMemoryDocstore = new InMemoryDocstore()
  ): Promise<HNSWLib> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const newDoc = new Document({
        pageContent: texts[i],
        metadata: metadatas[i],
      });
      docs.push(newDoc);
    }
    return HNSWLib.fromDocuments(docs, embeddings, docstore);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    docstore: InMemoryDocstore = new InMemoryDocstore()
  ): Promise<HNSWLib> {
    if (HierarchicalNSW === null) {
      throw new Error(
        "Please install hnswlib-node as a dependency with, e.g. `npm install -S hnswlib-node`"
      );
    }
    const args: HNSWLibArgs = {
      space: "ip", // dot product
    };
    const instance = new this(args, embeddings, docstore);
    await instance.addDocuments(docs);
    return instance;
  }
}
