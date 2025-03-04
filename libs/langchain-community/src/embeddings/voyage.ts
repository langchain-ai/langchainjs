import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the VoyageEmbeddings class.
 */
export interface VoyageEmbeddingsParams extends EmbeddingsParams {
  modelName: string;

  /**
   * The maximum number of documents to embed in a single request. This is
   * limited by the Voyage AI API to a maximum of 8.
   */
  batchSize?: number;

  /**
   * Input type for the embeddings request.
   */
  inputType?: string;

  /**
   * Whether to truncate the input texts to the maximum length allowed by the model.
   */
  truncation?: boolean;

  /**
   * The desired dimension of the output embeddings.
   */
  outputDimension?: number;

  /**
   * The data type of the output embeddings. Can be "float" or "int8".
   */
  outputDtype?: string;

  /**
   * The format of the output embeddings. Can be "float", "base64", or "ubinary".
   */
  encodingFormat?: string;
}

/**
 * Interface for the request body to generate embeddings.
 */
export interface CreateVoyageEmbeddingRequest {
  /**
   * @type {string}
   * @memberof CreateVoyageEmbeddingRequest
   */
  model: string;

  /**
   *  Text to generate vector expectation
   * @type {CreateEmbeddingRequestInput}
   * @memberof CreateVoyageEmbeddingRequest
   */
  input: string | string[];

  /**
   * Input type for the embeddings request.
   */
  input_type?: string;

  /**
   * Whether to truncate the input texts.
   */
  truncation?: boolean;

  /**
   * The desired dimension of the output embeddings.
   */
  output_dimension?: number;

  /**
   * The data type of the output embeddings.
   */
  output_dtype?: string;

  /**
   * The format of the output embeddings.
   */
  encoding_format?: string;
}

/**
 * A class for generating embeddings using the Voyage AI API.
 */
export class VoyageEmbeddings
  extends Embeddings
  implements VoyageEmbeddingsParams
{
  modelName = "voyage-01";

  batchSize = 8;

  private apiKey: string;

  basePath?: string = "https://api.voyageai.com/v1";

  apiUrl: string;

  headers?: Record<string, string>;

  inputType?: string;

  truncation?: boolean;

  outputDimension?: number;

  outputDtype?: string;

  encodingFormat?: string;

  /**
   * Constructor for the VoyageEmbeddings class.
   * @param fields - An optional object with properties to configure the instance.
   */
  constructor(
    fields?: Partial<VoyageEmbeddingsParams> & {
      verbose?: boolean;
      apiKey?: string;
      inputType?: string;
    }
  ) {
    const fieldsWithDefaults = { ...fields };

    super(fieldsWithDefaults);

    const apiKey =
      fieldsWithDefaults?.apiKey || getEnvironmentVariable("VOYAGEAI_API_KEY");

    if (!apiKey) {
      throw new Error("Voyage AI API key not found");
    }

    this.modelName = fieldsWithDefaults?.modelName ?? this.modelName;
    this.batchSize = fieldsWithDefaults?.batchSize ?? this.batchSize;
    this.apiKey = apiKey;
    this.apiUrl = `${this.basePath}/embeddings`;
    this.inputType = fieldsWithDefaults?.inputType;
    this.truncation = fieldsWithDefaults?.truncation;
    this.outputDimension = fieldsWithDefaults?.outputDimension;
    this.outputDtype = fieldsWithDefaults?.outputDtype;
    this.encodingFormat = fieldsWithDefaults?.encodingFormat;
  }

  /**
   * Generates embeddings for an array of texts.
   * @param texts - An array of strings to generate embeddings for.
   * @returns A Promise that resolves to an array of embeddings.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(texts, this.batchSize);

    const batchRequests = batches.map((batch) =>
      this.embeddingWithRetry({
        model: this.modelName,
        input: batch,
        input_type: this.inputType,
        truncation: this.truncation,
        output_dimension: this.outputDimension,
        output_dtype: this.outputDtype,
        encoding_format: this.encodingFormat,
      })
    );

    const batchResponses = await Promise.all(batchRequests);

    const embeddings: number[][] = [];

    for (let i = 0; i < batchResponses.length; i += 1) {
      const batch = batches[i];
      const { data: batchResponse } = batchResponses[i];
      for (let j = 0; j < batch.length; j += 1) {
        embeddings.push(batchResponse[j].embedding);
      }
    }

    return embeddings;
  }

  /**
   * Generates an embedding for a single text.
   * @param text - A string to generate an embedding for.
   * @returns A Promise that resolves to an array of numbers representing the embedding.
   */
  async embedQuery(text: string): Promise<number[]> {
    const { data } = await this.embeddingWithRetry({
      model: this.modelName,
      input: text,
      input_type: this.inputType,
      truncation: this.truncation,
      output_dimension: this.outputDimension,
      output_dtype: this.outputDtype,
      encoding_format: this.encodingFormat,
    });

    return data[0].embedding;
  }

  /**
   * Makes a request to the Voyage AI API to generate embeddings for an array of texts.
   * @param request - An object with properties to configure the request.
   * @returns A Promise that resolves to the response from the Voyage AI API.
   */
  private async embeddingWithRetry(request: CreateVoyageEmbeddingRequest) {
    const makeCompletionRequest = async () => {
      const url = `${this.apiUrl}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...this.headers,
        },
        body: JSON.stringify(request),
      });

      const json = await response.json();
      return json;
    };

    return this.caller.call(makeCompletionRequest);
  }
}
