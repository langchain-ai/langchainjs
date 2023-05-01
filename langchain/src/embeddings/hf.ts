import { HfInference } from "@huggingface/inference";
import { Embeddings, EmbeddingsParams } from "./base.js";

export interface HuggingFaceInferenceEmbeddingsParams extends EmbeddingsParams {
  apiKey?: string;
  model?: string;
}

export class HuggingFaceInferenceEmbeddings
  extends Embeddings
  implements HuggingFaceInferenceEmbeddingsParams
{
  apiKey?: string;

  model: string;

  client: HfInference;

  constructor(fields?: HuggingFaceInferenceEmbeddingsParams) {
    super(fields ?? {});

    this.model =
      fields?.model ?? "sentence-transformers/distilbert-base-nli-mean-tokens";
    this.apiKey =
      fields?.apiKey ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.HUGGINGFACEHUB_API_KEY
        : undefined);
    this.client = new HfInference(this.apiKey);
  }

  async _embed(texts: string[]): Promise<number[][]> {
    // replace newlines, which can negatively affect performance.
    const clean = texts.map((text) => text.replace(/\n/g, " "));
    return this.caller.call(() =>
      this.client.featureExtraction({
        model: this.model,
        inputs: clean,
      })
    ) as Promise<number[][]>;
  }

  embedQuery(document: string): Promise<number[]> {
    return this._embed([document]).then((embeddings) => embeddings[0]);
  }

  embedDocuments(documents: string[]): Promise<number[][]> {
    return this._embed(documents);
  }
}
