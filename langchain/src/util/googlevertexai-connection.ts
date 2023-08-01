import { GoogleAuth } from "google-auth-library";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { AsyncCaller } from "./async_caller.js";
import {
  GoogleVertexAIBasePrediction,
  GoogleVertexAIConnectionParams,
  GoogleVertexAILLMResponse,
  GoogleVertexAIModelParams,
} from "../types/googlevertexai-types.js";

export class GoogleVertexAIConnection<
  CallOptions extends BaseLanguageModelCallOptions,
  InstanceType,
  PredictionType extends GoogleVertexAIBasePrediction
> implements GoogleVertexAIConnectionParams
{
  caller: AsyncCaller;

  endpoint = "us-central1-aiplatform.googleapis.com";

  location = "us-central1";

  model: string;

  auth: GoogleAuth;

  constructor(
    fields: GoogleVertexAIConnectionParams | undefined,
    caller: AsyncCaller
  ) {
    this.caller = caller;

    this.endpoint = fields?.endpoint ?? this.endpoint;
    this.location = fields?.location ?? this.location;
    this.model = fields?.model ?? this.model;

    this.auth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
      ...fields?.authOptions,
    });
  }

  async request(
    instances: InstanceType[],
    parameters: GoogleVertexAIModelParams,
    options: CallOptions
  ): Promise<GoogleVertexAILLMResponse<PredictionType>> {
    const client = await this.auth.getClient();
    const projectId = await this.auth.getProjectId();
    const url = `https://${this.endpoint}/v1/projects/${projectId}/locations/${this.location}/publishers/google/models/${this.model}:predict`;
    const method = "POST" as const;

    const data = {
      instances,
      parameters,
    };

    const opts = {
      url,
      method,
      data,
    };

    async function _request() {
      return client.request(opts);
    }

    const response = await this.caller.callWithOptions(
      { signal: options.signal },
      _request.bind(client)
    );

    return <GoogleVertexAILLMResponse<PredictionType>>response;
  }
}
