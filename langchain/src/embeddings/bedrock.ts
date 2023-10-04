import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

import { Embeddings, EmbeddingsParams } from "./base.js";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the GooglePaLMEmbeddings class.
 */
export interface BedrockEmbeddingsParams extends EmbeddingsParams {
  /**
   * Model Name to use. Defaults to `amazon.titan-embed-text-v1` if not provided
   *
   */
  modelName?: string;

  /**
   * A client provided by the user that allows them to customze any
   * SDK configuration options.
   */
  client?: BedrockRuntimeClient;
}

/**
 * Class that extends the Embeddings class and provides methods for
 * generating embeddings using the Google Palm API.
 */
export class BedrockEmbeddings
  extends Embeddings
  implements BedrockEmbeddingsParams
{
  modelName: string;

  client: BedrockRuntimeClient;

  constructor(fields?: BedrockEmbeddingsParams) {
    super(fields ?? {});

    this.modelName = fields?.modelName ?? "amazon.titan-embed-text-v1";

    this.client = fields?.client ?? new BedrockRuntimeClient();
  }

  protected async _embedText(text: string): Promise<number[]> {
    // replace newlines, which can negatively affect performance.
    const cleanedText = text.replace(/\n/g, " ");

    const res = await this.client.send(
      new InvokeModelCommand({
        modelId: this.modelName,
        body: JSON.stringify({
          inputText: cleanedText,
        }),
        contentType: "application/json",
        accept: "application/json",
      })
    );

    try {
      const body = new TextDecoder().decode(res.body);

      return JSON.parse(body).embedding;
    } catch (e) {
      throw new Error("An invalid response was returned by Bedrock.");
    }
  }

  /**
   * Method that takes a document as input and returns a promise that
   * resolves to an embedding for the document. It calls the _embedText
   * method with the document as the input.
   * @param document Document for which to generate an embedding.
   * @returns Promise that resolves to an embedding for the input document.
   */
  embedQuery(document: string): Promise<number[]> {
    return this.caller.callWithOptions(
      {},
      this._embedText.bind(this),
      document
    );
  }

  /**
   * Method that takes an array of documents as input and returns a promise
   * that resolves to a 2D array of embeddings for each document. It calls
   * the _embedText method for each document in the array.
   * @param documents Array of documents for which to generate embeddings.
   * @returns Promise that resolves to a 2D array of embeddings for each input document.
   */
  embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.all(documents.map((document) => this._embedText(document)));
  }
}
