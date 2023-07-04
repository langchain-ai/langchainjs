import { Embeddings, EmbeddingsParams } from "./base.js";

export class FakeEmbeddings extends Embeddings {
  lc_serializable = true;

  _embeddingsType(): string {
    return "fake";
  }

  constructor(params?: EmbeddingsParams) {
    super(params ?? {});
  }

  _embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.resolve(documents.map(() => [0.1, 0.2, 0.3, 0.4]));
  }

  _embedQuery(_: string): Promise<number[]> {
    return Promise.resolve([0.1, 0.2, 0.3, 0.4]);
  }
}
