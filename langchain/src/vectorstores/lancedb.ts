import { Table } from "vectordb";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

export type LanceDBArgs = {
  table: Table;
  textKey?: string;
};

export class LanceDB extends VectorStore {
  private table: Table;

  private textKey: string;

  constructor(embeddings: Embeddings, args: LanceDBArgs) {
    super(embeddings, args);
    this.table = args.table;
    this.embeddings = embeddings;
    this.textKey = args.textKey || "text";
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  _vectorstoreType(): string {
    return "lancedb";
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }
    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and documents must have the same length`);
    }

    const data: Array<Record<string, unknown>> = [];
    for (let i = 0; i < documents.length; i += 1) {
      const record = {
        vector: vectors[i],
        [this.textKey]: documents[i].pageContent,
      };
      Object.keys(documents[i].metadata).forEach((metaKey) => {
        record[metaKey] = documents[i].metadata[metaKey];
      });
      data.push(record);
    }
    await this.table.add(data);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    const results = await this.table.search(query).limit(k).execute();

    const docsAndScore: [Document, number][] = [];
    results.forEach((item) => {
      const metadata: Record<string, unknown> = {};
      Object.keys(item).forEach((key) => {
        if (key !== "vector" && key !== "score" && key !== this.textKey) {
          metadata[key] = item[key];
        }
      });

      docsAndScore.push([
        new Document({
          pageContent: item[this.textKey] as string,
          metadata,
        }),
        item.score as number,
      ]);
    });
    return docsAndScore;
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: LanceDBArgs
  ): Promise<LanceDB> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return LanceDB.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: LanceDBArgs
  ): Promise<LanceDB> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
