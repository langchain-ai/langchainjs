import { TextServiceClient } from "@google-ai/generativelanguage";
import { GoogleAuth } from "google-auth-library";
import { Embeddings, EmbeddingsParams } from "./base.js";
import { getEnvironmentVariable } from "../util/env.js";

export interface GooglePalmEmbeddingsParams extends EmbeddingsParams {
  /**
   * Model Name to use
   *
   * Note: The format must follow the pattern - `models/{model}`
   */
  model?: string;
  /**
   * Google Palm API key to use
   */
  apiKey?: string;
}

export class GooglePalmEmbeddings
  extends Embeddings
  implements GooglePalmEmbeddingsParams
{
  apiKey?: string;

  model = "models/embedding-gecko-001";

  private client: TextServiceClient;

  constructor(fields?: GooglePalmEmbeddingsParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    if (this.model && !this.model.startsWith("models/")) {
      throw new Error(
        "`model` value must follow the pattern - `models/{model}`"
      );
    }

    this.apiKey =
      fields?.apiKey ?? getEnvironmentVariable("GOOGLEPALM_API_KEY");
    if (!this.apiKey) {
      throw new Error(
        "Please set an API key for Google Palm 2 in the environment variable GOOGLEPALM_API_KEY or in the `apiKey` field of the GooglePalm constructor"
      );
    }

    this.client = new TextServiceClient({
      authClient: new GoogleAuth().fromAPIKey(this.apiKey),
    });
  }

  async _palmEmbedText(text: string): Promise<number[]> {
    // replace newlines, which can negatively affect performance.
    const cleanedText = text.replace(/\n/g, " ");
    const res = await this.client.embedText({
      model: this.model,
      text: cleanedText,
    });
    return res[0].embedding?.value || [];
  }

  async embedQuery(document: string): Promise<number[]> {
    return this.caller.callWithOptions(
      {},
      this._palmEmbedText.bind(this),
      document
    );
  }

  embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.all(
      documents.map((document) => this._palmEmbedText(document))
    );
  }
}
