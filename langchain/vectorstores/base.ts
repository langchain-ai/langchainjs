import { Embeddings } from "embeddings/base";

// Temporary until we have a DocStore class
export interface DocStore {
  [key: number]: object;
}

export abstract class VectorStore {
  embeddings: Embeddings;

  docstore: DocStore;

  abstract addVectors(vectors: number[][], metadatas: object[]): Promise<void>;

  abstract similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[object, number][]>;

  async addTexts(texts: string[], metadatas: object[]): Promise<void> {
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      metadatas
    );
  }

  async similaritySearch(query: string, k = 4): Promise<object[]> {
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
