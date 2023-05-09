import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";

export interface VoyClient {
  index: (input: {
    embeddings: {
      id: string;
      embeddings: number[];
    }[];
  }) => string;
  search: (index: string, query: number[], k: number) => { id: string }[];
}

interface InternalDoc {
  embeddings: number[];
  document: Document;
}

export class Voy extends VectorStore {
  rawIndex = "";

  client: VoyClient;

  numDimensions: number | null = null;

  docstore: InternalDoc[] = [];

  constructor(client: VoyClient, embeddings: Embeddings) {
    super(embeddings, {});
    this.client = client;
    this.embeddings = embeddings;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    if (documents.length === 0) {
      return;
    }

    const firstVector = (
      await this.embeddings.embedDocuments(texts.slice(0, 1))
    )[0];
    if (this.numDimensions === null) {
      this.numDimensions = firstVector.length;
    } else if (this.numDimensions !== firstVector.length) {
      throw new Error(
        `Vectors must have the same length as the number of dimensions (${this.numDimensions})`
      );
    }
    const restResults = await this.embeddings.embedDocuments(texts.slice(1));
    await this.addVectors([firstVector, ...restResults], documents);
  }

  async addVectors(vectors: number[][], documents: Document[]) {
    if (vectors.length === 0) {
      return;
    }
    if (this.numDimensions === null) {
      this.numDimensions = vectors[0].length;
    }

    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and metadatas must have the same length`);
    }
    if (!vectors.every((v) => v.length === this.numDimensions)) {
      throw new Error(
        `Vectors must have the same length as the number of dimensions (${this.numDimensions})`
      );
    }

    vectors.forEach((item, idx) => {
      const doc = documents[idx];
      this.docstore.push({ embeddings: item, document: doc });
    });
    const embeddings = this.docstore.map((item, idx) => ({
      id: String(idx),
      embeddings: item.embeddings,
    }));
    this.rawIndex = this.client.index({ embeddings });
  }

  async similaritySearchVectorWithScore(query: number[], k: number) {
    if (this.numDimensions === null) {
      throw new Error("There aren't any elements in the index yet.");
    }
    if (query.length !== this.numDimensions) {
      throw new Error(
        `Query vector must have the same length as the number of dimensions (${this.numDimensions})`
      );
    }
    const itemsToQuery = Math.min(this.docstore.length, k);
    if (itemsToQuery > this.docstore.length) {
      console.warn(
        `k (${k}) is greater than the number of elements in the index (${this.docstore.length}), setting k to ${itemsToQuery}`
      );
    }
    const results: { id: string }[] = this.client.search(
      this.rawIndex,
      query,
      itemsToQuery
    );
    return results.map(
      ({ id }, idx) =>
        [this.docstore[parseInt(id, 10)].document, idx] as [Document, number]
    );
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    client: VoyClient
  ): Promise<Voy> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return Voy.fromDocuments(docs, embeddings, client);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    client: VoyClient
  ): Promise<Voy> {
    const instance = new Voy(client, embeddings);
    await instance.addDocuments(docs);
    return instance;
  }
}
