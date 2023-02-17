export abstract class Embeddings {
  abstract embedDocuments(documents: string[]): Promise<number[][]>;

  abstract embedQuery(document: string): Promise<number[]>;
}
