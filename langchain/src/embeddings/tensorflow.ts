import { load } from "@tensorflow-models/universal-sentence-encoder";
import * as tf from "@tensorflow/tfjs-core";

import { Embeddings, EmbeddingsParams } from "./base.js";

export interface TensorFlowEmbeddingsParams extends EmbeddingsParams {}

export class TensorFlowEmbeddings extends Embeddings {
  constructor(fields?: TensorFlowEmbeddingsParams) {
    super(fields ?? {});

    try {
      tf.backend();
    } catch (e) {
      throw new Error("No TensorFlow backend found, see instructions at ...");
    }
  }

  _cached: ReturnType<typeof load>;

  private async load() {
    if (this._cached === undefined) {
      this._cached = load();
    }
    return this._cached;
  }

  private _embed(texts: string[]) {
    return this.caller.call(async () => {
      const model = await this.load();
      return model.embed(texts);
    });
  }

  embedQuery(document: string): Promise<number[]> {
    return this._embed([document])
      .then((embeddings) => embeddings.array())
      .then((embeddings) => embeddings[0]);
  }

  embedDocuments(documents: string[]): Promise<number[][]> {
    return this._embed(documents).then((embeddings) => embeddings.array());
  }
}
