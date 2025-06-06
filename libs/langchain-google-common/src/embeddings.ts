import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import {
  AsyncCaller,
  AsyncCallerCallOptions,
} from "@langchain/core/utils/async_caller";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { GoogleAIConnection } from "./connection.js";
import { ApiKeyGoogleAuth, GoogleAbstractedClient } from "./auth.js";
import {
  GoogleAIModelRequestParams,
  GoogleConnectionParams,
  GoogleResponse,
} from "./types.js";

class EmbeddingsConnection<
  CallOptions extends AsyncCallerCallOptions,
  AuthOptions
> extends GoogleAIConnection<
  CallOptions,
  GoogleEmbeddingsInstance[],
  AuthOptions,
  GoogleEmbeddingsResponse
> {
  convertSystemMessageToHumanContent: boolean | undefined;

  constructor(
    fields: GoogleConnectionParams<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
    streaming: boolean
  ) {
    super(fields, caller, client, streaming);
  }

  async buildUrlMethod(): Promise<string> {
    return "predict";
  }

  get modelPublisher(): string {
    // All the embedding models are currently published by "google"
    return "google";
  }

  async formatData(
    input: GoogleEmbeddingsInstance[],
    parameters: GoogleAIModelRequestParams
  ): Promise<unknown> {
    return {
      instances: input,
      parameters,
    };
  }
}

/**
 * @see https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings-api
 */
export type GoogleVertexEmbeddingModelId =
  | 'textembedding-gecko'
  | 'textembedding-gecko@001'
  | 'textembedding-gecko@003'
  | 'textembedding-gecko-multilingual'
  | 'textembedding-gecko-multilingual@001'
  | 'text-multilingual-embedding-002'
  | 'text-embedding-004'
  | 'text-embedding-005'
  | (string & NonNullable<unknown>);

/**
 * Defines the parameters required to initialize a
 * GoogleEmbeddings instance. It extends EmbeddingsParams and
 * GoogleConnectionParams.
 */
export interface BaseGoogleEmbeddingsParams<AuthOptions>
  extends EmbeddingsParams,
    GoogleConnectionParams<AuthOptions> {
  model: GoogleVertexEmbeddingModelId;
}

/**
 * Defines additional options specific to the
 * GoogleEmbeddingsInstance. It extends AsyncCallerCallOptions.
 */
export interface BaseGoogleEmbeddingsOptions extends AsyncCallerCallOptions {}

/**
 * Represents an instance for generating embeddings using the Google
 * Vertex AI API. It contains the content to be embedded.
 */
export interface GoogleEmbeddingsInstance {
  content: string;
}

/**
 * Defines the structure of the embeddings results returned by the Google
 * Vertex AI API. It extends GoogleBasePrediction and contains the
 * embeddings and their statistics.
 */
export interface GoogleEmbeddingsResponse extends GoogleResponse {
  data: {
    predictions: {
      embeddings: {
        statistics: {
          token_count: number;
          truncated: boolean;
        };
        values: number[];
      };
    }[];
  };
}

/**
 * Enables calls to Google APIs for generating
 * text embeddings.
 */
export abstract class BaseGoogleEmbeddings<AuthOptions>
  extends Embeddings
  implements BaseGoogleEmbeddingsParams<AuthOptions>
{
  model: string;

  private connection: EmbeddingsConnection<
    BaseGoogleEmbeddingsOptions,
    AuthOptions
  >;

  constructor(fields: BaseGoogleEmbeddingsParams<AuthOptions>) {
    super(fields);

    this.model = fields.model;
    this.connection = new EmbeddingsConnection(
      { ...fields, ...this },
      this.caller,
      this.buildClient(fields),
      false
    );
  }

  abstract buildAbstractedClient(
    fields?: GoogleConnectionParams<AuthOptions>
  ): GoogleAbstractedClient;

  buildApiKeyClient(apiKey: string): GoogleAbstractedClient {
    return new ApiKeyGoogleAuth(apiKey);
  }

  buildApiKey(
    fields?: GoogleConnectionParams<AuthOptions>
  ): string | undefined {
    return fields?.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
  }

  buildClient(
    fields?: GoogleConnectionParams<AuthOptions>
  ): GoogleAbstractedClient {
    const apiKey = this.buildApiKey(fields);
    if (apiKey) {
      return this.buildApiKeyClient(apiKey);
    } else {
      return this.buildAbstractedClient(fields);
    }
  }

  /**
   * Takes an array of documents as input and returns a promise that
   * resolves to a 2D array of embeddings for each document. It splits the
   * documents into chunks and makes requests to the Google Vertex AI API to
   * generate embeddings.
   * @param documents An array of documents to be embedded.
   * @returns A promise that resolves to a 2D array of embeddings for each document.
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    const instanceChunks: GoogleEmbeddingsInstance[][] = chunkArray(
      documents.map((document) => ({
        content: document,
      })),
      5
    ); // Vertex AI accepts max 5 instances per prediction
    const parameters = {};
    const options = {};
    const responses = await Promise.all(
      instanceChunks.map((instances) =>
        this.connection.request(instances, parameters, options)
      )
    );
    const result: number[][] =
      responses
        ?.map(
          (response) =>
            response?.data?.predictions?.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (result: any) => result.embeddings?.values
            ) ?? []
        )
        .flat() ?? [];
    return result;
  }

  /**
   * Takes a document as input and returns a promise that resolves to an
   * embedding for the document. It calls the embedDocuments method with the
   * document as the input.
   * @param document A document to be embedded.
   * @returns A promise that resolves to an embedding for the document.
   */
  async embedQuery(document: string): Promise<number[]> {
    const data = await this.embedDocuments([document]);
    return data[0];
  }
}
