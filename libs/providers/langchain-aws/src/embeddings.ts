import {
  BedrockRuntimeClient,
  BedrockRuntimeClientConfig,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { CredentialType } from "./types.js";

/**
 * Checks if the given model is an Amazon Nova embedding model.
 * Nova models require a different request format using `messages` instead of `inputText`.
 * @param model - The model ID string
 * @returns true if the model is a Nova embedding model
 */
function isNovaEmbeddingModel(model: string): boolean {
  return model.toLowerCase().includes("nova-embed");
}

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

  /**
   * Overrideable configuration options for the BedrockRuntimeClient.
   * Allows customization of client configuration such as requestHandler, etc.
   * Will be ignored if 'client' is provided.
   */
  clientOptions?: BedrockRuntimeClientConfig;

  region?: string;

  credentials?: CredentialType;

  /**
   * Additional parameters to pass to the model as part of the InvokeModel
   * request body.
   *
   * These are merged into the request payload, allowing model-specific options
   * like `normalize`, `embeddingTypes`, etc.
   *
   * If `dimensions` is also provided as a top-level parameter, it will take
   * precedence over a `dimensions` key set in `modelParameters`.
   */
  modelParameters?: Record<string, unknown>;

  /**
   * @deprecated Use `modelParameters` instead.
   */
  modelKwargs?: Record<string, unknown>;

  /**
   * The number of dimensions for the output embeddings.
   * Only supported by certain models (e.g., Amazon Titan Embed Text v2,
   * Cohere Embed). If not specified, uses the model's default.
   */
  dimensions?: number;
}

/**
 * Class that extends the Embeddings class and provides methods for
 * generating embeddings using the Bedrock API.
 * @example
 * ```typescript
 * const embeddings = new BedrockEmbeddings({
 *   region: "your-aws-region",
 *   credentials: {
 *     accessKeyId: "your-access-key-id",
 *     secretAccessKey: "your-secret-access-key",
 *   },
 *   model: "amazon.titan-embed-text-v2:0",
 *   dimensions: 512,
 *   modelParameters: {
 *     normalize: true,
 *   },
 *   // Configure client options (e.g., custom request handler)
 *   // clientOptions: {
 *   //   requestHandler: myCustomRequestHandler,
 *   // },
 * });
 *
 * // Embed a query and log the result
 * const res = await embeddings.embedQuery(
 *   "What would be a good company name for a company that makes colorful socks?"
 * );
 * console.log({ res });
 * ```
 */
export class BedrockEmbeddings
  extends Embeddings
  implements BedrockEmbeddingsParams
{
  model: string;

  client: BedrockRuntimeClient;

  clientOptions?: BedrockRuntimeClientConfig;

  batchSize = 512;

  modelParameters?: Record<string, unknown>;

  /**
   * @deprecated Use `modelParameters` instead.
   */
  modelKwargs?: Record<string, unknown>;

  dimensions?: number;

  constructor(fields?: BedrockEmbeddingsParams) {
    super(fields ?? {});

    this.model = fields?.model ?? "amazon.titan-embed-text-v1";
    this.clientOptions = fields?.clientOptions;

    // Prefer `modelParameters`, but keep `modelKwargs` for backwards
    // compatibility. If both are provided, `modelParameters` wins.
    const mergedModelParameters = {
      ...(fields?.modelKwargs ?? {}),
      ...(fields?.modelParameters ?? {}),
    };
    this.modelParameters = Object.keys(mergedModelParameters).length
      ? mergedModelParameters
      : undefined;
    this.modelKwargs = fields?.modelKwargs;
    this.dimensions = fields?.dimensions;

    this.client =
      fields?.client ??
      new BedrockRuntimeClient({
        ...fields?.clientOptions,
        region: fields?.region,
        credentials: fields?.credentials,
      });
  }

  /**
   * Protected method to make a request to the Bedrock API to generate
   * embeddings. Handles the retry logic and returns the response from the
   * API.
   * @param request Request to send to the Bedrock API.
   * @returns Promise that resolves to the response from the API.
   */
  protected async _embedText(text: string): Promise<number[]> {
    return this.caller.call(async () => {
      try {
        // replace newlines, which can negatively affect performance.
        const cleanedText = text.replace(/\n/g, " ");

        // Nova embedding models use a different request format with `messages`
        // instead of `inputText` used by Titan models
        const baseRequestBody: Record<string, unknown> = isNovaEmbeddingModel(
          this.model
        )
          ? {
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      text: cleanedText,
                    },
                  ],
                },
              ],
            }
          : {
              inputText: cleanedText,
            };

        const requestBody: Record<string, unknown> = {
          ...(this.modelParameters ?? {}),
          ...baseRequestBody,
        };

        // Top-level `dimensions` takes precedence over modelParameters.dimensions
        if (this.dimensions !== undefined) {
          requestBody.dimensions = this.dimensions;
        }

        const res = await this.client.send(
          new InvokeModelCommand({
            modelId: this.model,
            body: JSON.stringify(requestBody),
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
   * Method to generate embeddings for an array of texts. Calls _embedText
   * method which batches and handles retry logic when calling the AWS Bedrock API.
   * @param documents Array of texts for which to generate embeddings.
   * @returns Promise that resolves to a 2D array of embeddings for each input document.
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.all(documents.map((document) => this._embedText(document)));
  }
}
