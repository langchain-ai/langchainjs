export abstract class Embeddings {
  abstract numDimensions: number;

  abstract embedDocuments(documents: string[]): Promise<number[][]>;

  abstract embedQuery(document: string): Promise<number[]>;
}
