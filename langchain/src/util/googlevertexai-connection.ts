import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { AsyncCaller, AsyncCallerCallOptions } from "./async_caller.js";
import type {
  GoogleVertexAIBaseLLMInput,
  GoogleVertexAIBasePrediction,
  GoogleVertexAIConnectionParams,
  GoogleVertexAILLMResponse,
  GoogleVertexAIModelParams,
  GoogleVertexAIResponse,
  GoogleVertexAIAbstractedClient,
} from "../types/googlevertexai-types.js";

export abstract class GoogleVertexAIConnection<
  CallOptions extends AsyncCallerCallOptions,
  ResponseType extends GoogleVertexAIResponse,
  AuthOptions
> implements GoogleVertexAIConnectionParams<AuthOptions>
{
  caller: AsyncCaller;

  endpoint = "us-central1-aiplatform.googleapis.com";

  location = "us-central1";

  apiVersion = "v1";

  client: GoogleVertexAIAbstractedClient;

  constructor(
    fields: GoogleVertexAIConnectionParams<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleVertexAIAbstractedClient
  ) {
    this.caller = caller;

    this.endpoint = fields?.endpoint ?? this.endpoint;
    this.location = fields?.location ?? this.location;
    this.apiVersion = fields?.apiVersion ?? this.apiVersion;
    this.client = client;
  }

  abstract buildUrl(): Promise<string>;

  buildMethod(): string {
    return "POST";
  }

  async _request(
    data: unknown | undefined,
    options: CallOptions
  ): Promise<ResponseType> {
    const url = await this.buildUrl();
    const method = this.buildMethod();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = {
      url,
      method,
    };
    if (data && method === "POST") {
      opts.data = data;
    }

    try {
      const callResponse = await this.caller.callWithOptions(
        { signal: options?.signal },
        async () => this.client.request(opts)
      );
      const response: unknown = callResponse; // Done for typecast safety, I guess
      return <ResponseType>response;
    } catch (x) {
      console.error(JSON.stringify(x, null, 1));
      throw x;
    }
  }
}

export class GoogleVertexAILLMConnection<
    CallOptions extends BaseLanguageModelCallOptions,
    InstanceType,
    PredictionType extends GoogleVertexAIBasePrediction,
    AuthOptions
  >
  extends GoogleVertexAIConnection<CallOptions, PredictionType, AuthOptions>
  implements GoogleVertexAIBaseLLMInput<AuthOptions>
{
  model: string;

  client: GoogleVertexAIAbstractedClient;

  constructor(
    fields: GoogleVertexAIBaseLLMInput<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleVertexAIAbstractedClient
  ) {
    super(fields, caller, client);
    this.client = client;
    this.model = fields?.model ?? this.model;
  }

  async buildUrl(): Promise<string> {
    const projectId = await this.client.getProjectId();
    const url = `https://${this.endpoint}/v1/projects/${projectId}/locations/${this.location}/publishers/google/models/${this.model}:predict`;
    return url;
  }

  async request(
    instances: InstanceType[],
    parameters: GoogleVertexAIModelParams,
    options: CallOptions
  ): Promise<GoogleVertexAILLMResponse<PredictionType>> {
    const data = {
      instances,
      parameters,
    };
    const response = await this._request(data, options);
    return response;
  }
}
