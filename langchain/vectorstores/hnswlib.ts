import fs from "fs/promises";
import path from "path";
import type {
  HierarchicalNSW as HierarchicalNSWT,
  SpaceName,
} from "hnswlib-node";

import { Embeddings } from "../embeddings/base";

import { SaveableVectorStore } from "./base";

let HierarchicalNSW: typeof HierarchicalNSWT | null = null;

try {
  // eslint-disable-next-line global-require
  ({ HierarchicalNSW } = require("hnswlib-node"));
} catch {
  // ignore error
}

export interface HNSWLibArgs {
  space: SpaceName;
  numDimensions: number;
}

export class HNSWLib extends SaveableVectorStore {
  index: HierarchicalNSWT;

  args: HNSWLibArgs;

  constructor(
    index: HierarchicalNSWT,
    args: HNSWLibArgs,
    embeddings: Embeddings,
    docstore: { [key: number]: object }
  ) {
    super();
    this.index = index;
    this.args = args;
    this.embeddings = embeddings;
    this.docstore = docstore;
  }

  async addVectors(vectors: number[][], metadatas: object[]) {
    if (vectors.length !== metadatas.length) {
      throw new Error(`Vectors and metadatas must have the same length`);
    }
    const capacity = this.index.getMaxElements();
    const needed = this.index.getCurrentCount() + vectors.length;
    if (needed > capacity) {
      this.index.resizeIndex(needed - capacity);
    }
    for (let i = 0; i < vectors.length; i += 1) {
      this.index.addPoint(vectors[i], i);
      this.docstore[i] = metadatas[i];
    }
  }

  async similaritySearchVectorWithScore(query: number[], k: number) {
    const result = this.index.searchKnn(query, k);
    return result.neighbors.map(
      (docIndex, resultIndex) =>
        [this.docstore[docIndex], result.distances[resultIndex]] as [
          object,
          number
        ]
    );
  }

  async save(directory: string) {
    await fs.mkdir(directory, { recursive: true });
    await Promise.all([
      this.index.writeIndex(path.join(directory, "hnswlib.index")),
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
    if (HierarchicalNSW === null) {
      throw new Error(
        "Please install hnswlib-node as a dependency with, e.g. `npm install -S hnswlib-node`"
      );
    }
    const args = JSON.parse(
      await fs.readFile(path.join(directory, "args.json"), "utf8")
    );
    const index = new HierarchicalNSW(args.space, args.numDimensions);
    const [docstore] = await Promise.all([
      fs
        .readFile(path.join(directory, "docstore.json"), "utf8")
        .then(JSON.parse),
      index.readIndex(path.join(directory, "hnswlib.index")),
    ]);

    return new HNSWLib(index, args, embeddings, docstore);
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[],
    embeddings: Embeddings
  ): Promise<HNSWLib> {
    if (HierarchicalNSW === null) {
      throw new Error(
        "Please install hnswlib-node as a dependency with, e.g. `npm install -S hnswlib-node`"
      );
    }
    const args: HNSWLibArgs = {
      space: "ip",
      numDimensions: embeddings.numDimensions,
    };
    const index = new HierarchicalNSW(args.space, args.numDimensions);
    index.initIndex(texts.length);
    const instance = new this(index, args, embeddings, {});
    await instance.addTexts(texts, metadatas);
    return instance;
  }
}
