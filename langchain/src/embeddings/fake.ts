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

interface SyntheticEmbeddingsParams extends EmbeddingsParams {
  vectorSize: number;
}

export class SyntheticEmbeddings
  extends Embeddings
  implements SyntheticEmbeddingsParams
{
  vectorSize: number;

  constructor(params?: SyntheticEmbeddingsParams) {
    super(params ?? {});
    this.vectorSize = params?.vectorSize ?? 4;
  }

  _embeddingsType(): string {
    return "synthetic";
  }

  async _embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.all(documents.map((doc) => this.embedQuery(doc)));
  }

  async _embedQuery(document: string): Promise<number[]> {
    let doc = document;

    // Only use the letters (and space) from the document, and make them lower case
    doc = doc.toLowerCase().replaceAll(/[^a-z ]/g, "");

    // Pad the document to make sure it has a divisible number of chunks
    const padMod = doc.length % this.vectorSize;
    const padGapSize = padMod === 0 ? 0 : this.vectorSize - padMod;
    const padSize = doc.length + padGapSize;
    doc = doc.padEnd(padSize, " ");

    // Break it into chunks
    const chunkSize = doc.length / this.vectorSize;
    const docChunk = [];
    for (let co = 0; co < doc.length; co += chunkSize) {
      docChunk.push(doc.slice(co, co + chunkSize));
    }

    // Turn each chunk into a number
    const ret: number[] = docChunk.map((s) => {
      let sum = 0;
      // Get a total value by adding the value of each character in the string
      for (let co = 0; co < s.length; co += 1) {
        sum += s === " " ? 0 : s.charCodeAt(co);
      }
      // Reduce this to a number between 0 and 25 inclusive
      // Then get the fractional number by dividing it by 26
      const ret = (sum % 26) / 26;
      return ret;
    });

    return ret;
  }
}
