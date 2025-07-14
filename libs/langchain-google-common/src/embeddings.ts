import { Embeddings } from "@langchain/core/embeddings";
import {
  AsyncCaller,
  AsyncCallerCallOptions,
} from "@langchain/core/utils/async_caller";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { GoogleAIConnection } from "./connection.js";
import { ApiKeyGoogleAuth, GoogleAbstractedClient } from "./auth.js";
import {
  BaseGoogleEmbeddingsOptions,
  BaseGoogleEmbeddingsParams,
  GoogleConnectionParams, GoogleEmbeddingsInstance, GoogleEmbeddingsResponse,
  VertexEmbeddingsParameters,
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
    fields: BaseGoogleEmbeddingsParams<AuthOptions> | undefined,
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
    parameters: VertexEmbeddingsParameters,
  ): Promise<unknown> {
    return {
      instances: input,
      parameters,
    };
  }
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

  dimensions?: number;

  private connection: EmbeddingsConnection<
    BaseGoogleEmbeddingsOptions,
    AuthOptions
  >;

  constructor(fields: BaseGoogleEmbeddingsParams<AuthOptions>) {
    super(fields);

    this.model = fields.model;
    this.dimensions = fields.dimensions ?? fields.outputDimensionality;

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

  buildParameters(): VertexEmbeddingsParameters {
    const ret: VertexEmbeddingsParameters = {
      outputDimensionality: this.dimensions,
    };

    // Remove undefined attributes
    let key: keyof VertexEmbeddingsParameters;
    for (key in ret) {
      if (ret[key] === undefined) {
        delete ret[key];
      }
    }

    return ret;
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
    // Vertex "text-" models could do up 5 documents at once,
    // but the "gemini-embedding-001" can only do 1.
    // TODO: Make this configurable
    const chunkSize = 1;
    const instanceChunks: GoogleEmbeddingsInstance[][] = chunkArray(
      documents.map((document) => ({
        content: document,
      })),
      chunkSize
    );
    const parameters: VertexEmbeddingsParameters = this.buildParameters();
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
