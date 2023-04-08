import type { IndexFlatL2 } from "faiss-node";
import { Embeddings } from "../embeddings/base.js";
import { SaveableVectorStore } from "./base.js";
import { Document } from "../document.js";
import { InMemoryDocstore } from "../docstore/index.js";

export interface FaissLibArgs {
  docstore?: InMemoryDocstore;
  index?: IndexFlatL2;
  mapping?: Record<number, string>;
}

export class FaissStore extends SaveableVectorStore {
  _index?: IndexFlatL2;

  docstore: InMemoryDocstore;

  args: FaissLibArgs;

  constructor(embeddings: Embeddings, args: FaissLibArgs) {
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

  public get index(): IndexFlatL2 {
    if (!this._index) {
      throw new Error(
        "Vector store not initialised yet. Try calling `fromTexts` or `fromDocuments` first."
      );
    }
    return this._index;
  }

  private set index(index: IndexFlatL2) {
    this._index = index;
  }

  async addVectors(vectors: number[][], documents: Document[]) {
    if (vectors.length === 0) {
      return;
    }
    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and metadatas must have the same length`);
    }
    const dv = vectors[0].length;
    if (!this._index) {
      const { IndexFlatL2 } = await FaissStore.imports();
      this._index = new IndexFlatL2(dv);
    }
    const d = this.index.getDimension();
    if (dv !== d) {
      throw new Error(
        `Vectors must have the same length as the number of dimensions (${d})`
      );
    }

    const docstoreSize = this.docstore.count;
    for (let i = 0; i < vectors.length; i += 1) {
      this.index.add(vectors[i]);
      this.docstore.add({ [docstoreSize + i]: documents[i] });
    }
  }

  async similaritySearchVectorWithScore(query: number[], k: number) {
    const d = this.index.getDimension();
    if (query.length !== d) {
      throw new Error(
        `Query vector must have the same length as the number of dimensions (${d})`
      );
    }
    if (k > this.index.ntotal()) {
      const total = this.index.ntotal();
      console.warn(
        `k (${k}) is greater than the number of elements in the index (${total}), setting k to ${total}`
      );
      // eslint-disable-next-line no-param-reassign
      k = total;
    }
    const result = this.index.search(query, k);
    const getId = (index: number) => this.args.mapping ?
      (this.args.mapping as Record<number, string>)[index] :
      String(index);
    return result.labels.map(
      (docIndex, resultIndex) =>
        [
          this.docstore.search(getId(docIndex)),
          result.distances[resultIndex],
        ] as [Document, number]
    );
  }

  async save(directory: string) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(directory, { recursive: true });
    await Promise.all([
      this.index.write(path.join(directory, "faiss.index")),
      await fs.writeFile(
        path.join(directory, "docstore.json"),
        JSON.stringify(Array.from(this.docstore._docs.entries()))
      ),
    ]);
  }

  static async load(directory: string, embeddings: Embeddings) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const readStore = (directory: string) => fs
      .readFile(path.join(directory, "docstore.json"), "utf8")
      .then(JSON.parse) as Promise<Map<string, Document>>;
    const readIndex = async (directory: string) => {
      const { IndexFlatL2 } = await this.imports();
      return IndexFlatL2.read(path.join(directory, "faiss.index"));
    };
    const [docstoreFiles, index] = await Promise.all([
      readStore(directory),
      readIndex(directory)
    ]);
    const docstore = new InMemoryDocstore(new Map(docstoreFiles));
    return new this(embeddings, { docstore, index });
  }


  static async loadFormPython(directory: string, embeddings: Embeddings) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    class PyDocument {
      __dict__: {
        page_content: string;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: Record<string, any>;
      };

      toDocument(): Document {
        const d = new Document();
        d.pageContent = this.__dict__.page_content;
        d.metadata = this.__dict__.metadata;
        return d;
      }
    }

    class PyInMemoryDocstore {
      _dict: Map<string, PyDocument>;

      toInMemoryDocstore(): InMemoryDocstore {
        const s = new InMemoryDocstore();
        for (const [key, value] of Object.entries(this._dict)) {
          s._docs.set(key, value.toDocument());
        }
        return s;
      }
    }

    const readStore = async (directory: string) => {
      const pkl = await fs.readFile(path.join(directory, "index.pkl"), "binary");
      const pickle = await import('./pickle.js');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pickle.emulated as Record<string, any>)['langchain.docstore.in_memory.InMemoryDocstore'] = PyInMemoryDocstore;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pickle.emulated as Record<string, any>)['langchain.schema.Document'] = PyDocument;
      const [pydoc, mapping]: [pydoc: PyInMemoryDocstore, mapping: Record<number, string>] = pickle.loads(pkl);
      const store = pydoc.toInMemoryDocstore();

      return { store, mapping };

    };
    const readIndex = async (directory: string) => {
      const { IndexFlatL2 } = await this.imports();
      return IndexFlatL2.read(path.join(directory, "index.faiss"));
    };
    const [store, index] = await Promise.all([
      readStore(directory),
      readIndex(directory)
    ]);
    return new this(embeddings, { docstore: store.store, index, mapping: store.mapping });
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig?: {
      docstore?: InMemoryDocstore;
    }
  ): Promise<FaissStore> {
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
      docstore?: InMemoryDocstore;
    }
  ): Promise<FaissStore> {
    const args: FaissLibArgs = {
      docstore: dbConfig?.docstore,
    };
    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }

  static async imports(): Promise<{ IndexFlatL2: typeof IndexFlatL2; }> {
    try {
      const { default: { IndexFlatL2 } } = await import("faiss-node");

      return { IndexFlatL2 };
    } catch (err) {
      throw new Error(
        "Please install faiss-node as a dependency with, e.g. `npm install -S faiss-node`"
      );
    }
  }
}
