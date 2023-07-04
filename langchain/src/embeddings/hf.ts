import { HfInference } from "@huggingface/inference";
import { Embeddings, EmbeddingsParams } from "./base.js";
import { getEnvironmentVariable } from "../util/env.js";

export interface HuggingFaceInferenceEmbeddingsParams extends EmbeddingsParams {
  apiKey?: string;
  model?: string;
}

export class HuggingFaceInferenceEmbeddings
  extends Embeddings
  implements HuggingFaceInferenceEmbeddingsParams
{
  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "HUGGINGFACEHUB_API_KEY",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      model: "model_name",
      apiKey: "huggingfacehub_api_token",
    };
  }

  apiKey?: string;

  model: string;

  client: HfInference;

  _embeddingsType(): string {
    return "hf";
  }

  constructor(fields?: HuggingFaceInferenceEmbeddingsParams) {
    super(fields ?? {});

    this.model =
      fields?.model ?? "sentence-transformers/distilbert-base-nli-mean-tokens";
    this.apiKey =
      fields?.apiKey ?? getEnvironmentVariable("HUGGINGFACEHUB_API_KEY");
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

  _embedQuery(document: string): Promise<number[]> {
    return this._embed([document]).then((embeddings) => embeddings[0]);
  }

  _embedDocuments(documents: string[]): Promise<number[][]> {
    return this._embed(documents);
  }
}
