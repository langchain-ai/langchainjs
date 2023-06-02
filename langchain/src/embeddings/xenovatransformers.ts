import { pipeline } from '@xenova/transformers';
import { Embeddings, EmbeddingsParams } from "./base.js";

export interface XenovaTransformersEmbeddingsParams extends EmbeddingsParams {
  model?: string;
}

export class XenovaTransformersEmbeddings
  extends Embeddings
  implements XenovaTransformersEmbeddingsParams
{

  model: string;

  client: any;

  constructor(fields?: XenovaTransformersEmbeddingsParams) {
    super(fields ?? {});
    this.model = fields?.model ?? "Xenova/all-MiniLM-L6-v2";
  }

  async _embed(texts: string[]): Promise<number[][]> {

    if(!this.client){
      this.client = await pipeline('embeddings', this.model);
    }

    return this.caller.call(async () => {
      return await Promise.all(texts.map(async t => (await this.client(t)).data));
    });
  }

  embedQuery(document: string): Promise<number[]> {
    return this._embed([document]).then((embeddings) => embeddings[0]);
  }

  embedDocuments(documents: string[]): Promise<number[][]> {
    return this._embed(documents);
  }
}
