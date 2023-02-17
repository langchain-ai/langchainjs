import { Embeddings } from "embeddings/base";
import { Document } from "../document";

// Temporary until we have a DocStore class
export interface DocStore {
  [key: number]: object;
}

export abstract class VectorStore {
  embeddings: Embeddings;

  docstore: DocStore;

  abstract addVectors(vectors: number[][], documents: Document[]): Promise<void>;

  abstract similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]>;

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map( ({pageContent}) => (pageContent));
    this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async similaritySearch(query: string, k = 4): Promise<Document[]> {
    const results = await this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      k
    );

    return results.map((result) => result[0]);
  }

  async similaritySearchWithScore(
    query: string,
    k = 4
  ): Promise<[object, number][]> {
    return this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      k
    );
  }
}

export abstract class SaveableVectorStore extends VectorStore {
  abstract save(directory: string): Promise<void>;

  static load(
    _directory: string,
    _embeddings: Embeddings
  ): Promise<SaveableVectorStore> {
    throw new Error("Not implemented");
  }
}
