import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { Embeddings, EmbeddingsParams } from "./base.js";
import type { CredentialType } from "../util/bedrock.js";
import { chunkArray } from "../util/chunk.js";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the BedrockEmbeddings class.
 */
export interface BedrockEmbeddingsParams extends EmbeddingsParams {
  /**
   * Model Name to use. Defaults to `amazon.titan-embed-text-v1` if not provided
   *
   */
  model?: string;

  /**
   * A client provided by the user that allows them to customze any
   * SDK configuration options.
   */
  client?: BedrockRuntimeClient;

  region?: string;

  credentials?: CredentialType;
}

/**
 * Class that extends the Embeddings class and provides methods for
 * generating embeddings using the Bedrock API.
 */
export class BedrockEmbeddings
  extends Embeddings
  implements BedrockEmbeddingsParams
{
  model: string;

  client: BedrockRuntimeClient;

  batchSize = 512;

  constructor(fields?: BedrockEmbeddingsParams) {
    super(fields ?? {});

    this.model = fields?.model ?? "amazon.titan-embed-text-v1";

    this.client =
      fields?.client ??
      new BedrockRuntimeClient({
        region: fields?.region,
        credentials: fields?.credentials,
      });
  }

  /** @deprecated */
  protected async _embedText(text: string): Promise<number[]> {
    return this.caller.call(async () => {
      try {
        // replace newlines, which can negatively affect performance.
        const cleanedText = inputText.replace(/\n/g, " ");

        const res = await this.client.send(
          new InvokeModelCommand({
            modelId: this.model,
            body: JSON.stringify({
              inputText: cleanedText,
            }),
            contentType: "application/json",
            accept: "application/json",
          })
        );

        const body = new TextDecoder().decode(res.body);
        return JSON.parse(body).embedding;
      } catch (e) {
        console.error({
          error: e,
        });
        // eslint-disable-next-line no-instanceof/no-instanceof
        if (e instanceof Error) {
          throw new Error(
            `An error occurred while embedding documents with Bedrock: ${e.message}`
          );
        }

        throw new Error(
          "An error occurred while embedding documents with Bedrock"
        );
      }
    });
  }

  /**
   * Method that takes a document as input and returns a promise that
   * resolves to an embedding for the document. It calls the embedTextWithRetry
   * method with the document as the input.
   * @param document Document for which to generate an embedding.
   * @returns Promise that resolves to an embedding for the input document.
   */
  embedQuery(document: string): Promise<number[]> {
    return this.caller.callWithOptions(
      {},
      this.embedTextWithRetry.bind(this),
      document
    );
  }

  /**
   * Method to generate embeddings for an array of texts. Splits the
   * texts into batches and makes requests to Bedrock to generate
   * embeddings.
   * @param documents Array of texts for which to generate embeddings.
   * @returns Promise that resolves to a 2D array of embeddings for each input document.
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    const batches = chunkArray(documents, this.batchSize);
    const embeddings: number[][] = [];

    for (const batch of batches) {
      const batchRequests = batch.map((document) =>
        this.embedTextWithRetry(document)
      );

      const batchEmbeddings = await Promise.all(batchRequests);
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * Private method to make a request to the Bedrock API to generate
   * embeddings. Handles the retry logic and returns the response from the
   * API.
   * @param request Request to send to the Bedrock API.
   * @returns Promise that resolves to the response from the API.
   */
  private async embedTextWithRetry(inputText: string): Promise<number[]> {
    return this.caller.call(async () => {
      try {
        // replace newlines, which can negatively affect performance.
        const cleanedText = inputText.replace(/\n/g, " ");

        const res = await this.client.send(
          new InvokeModelCommand({
            modelId: this.model,
            body: JSON.stringify({
              inputText: cleanedText,
            }),
            contentType: "application/json",
            accept: "application/json",
          })
        );

        const body = new TextDecoder().decode(res.body);
        return JSON.parse(body).embedding;
      } catch (e) {
        console.error({
          error: e,
        });
        // eslint-disable-next-line no-instanceof/no-instanceof
        if (e instanceof Error) {
          throw new Error(
            `An error occurred while embedding documents with Bedrock: ${e.message}`
          );
        }

        throw new Error(
          "An error occurred while embedding documents with Bedrock"
        );
      }
    });
  }
}
