import { GoogleAuth } from "google-auth-library";
import { BaseLLM, BaseLLMParams } from "./base.js";
import { Generation, LLMResult } from "../schema/index.js";
import { AsyncCaller } from "../util/async_caller.js";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";

export interface GoogleVertexAiConnectionParams {
  /** Hostname for the API call */
  endpoint?: string;

  /** Region where the LLM is stored */
  location?: string;

  /** Model to use */
  model?: string;
}

export interface GoogleVertexAiModelParams {
  /** Sampling temperature to use */
  temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  maxTokens?: number;

  /**
   * Top-p changes how the model selects tokens for output.
   *
   * Tokens are selected from most probable to least until the sum
   * of their probabilities equals the top-p value.
   *
   * For example, if tokens A, B, and C have a probability of
   * .3, .2, and .1 and the top-p value is .5, then the model will
   * select either A or B as the next token (using temperature).
   */
  topP?: number;

  /**
   * Top-k changes how the model selects tokens for output.
   *
   * A top-k of 1 means the selected token is the most probable among
   * all tokens in the model’s vocabulary (also called greedy decoding),
   * while a top-k of 3 means that the next token is selected from
   * among the 3 most probable tokens (using temperature).
   */
  topK?: number;
}

export interface GoogleVertexAiBaseLLMInput
  extends BaseLLMParams,
    GoogleVertexAiConnectionParams,
    GoogleVertexAiModelParams {}

export interface GoogleVertexAiTextInput extends GoogleVertexAiBaseLLMInput {}

export interface GoogleVertexAiLLMResponse<
  PredictionType extends GoogleVertexAiBasePrediction
> {
  data: {
    predictions: PredictionType[];
  };
}

interface GoogleVertexAiLLMTextInstance {
  content: string;
}

/**
 * Models the data returned from the API call
 */
export interface GoogleVertexAiBasePrediction {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  safetyAttributes?: any;
}

interface TextPrediction extends GoogleVertexAiBasePrediction {
  content: string;
}

export class GoogleVertexAiConnection<
  CallOptions extends BaseLanguageModelCallOptions,
  InstanceType,
  PredictionType extends GoogleVertexAiBasePrediction
> implements GoogleVertexAiConnectionParams
{
  caller: AsyncCaller;

  endpoint = "us-central1-aiplatform.googleapis.com";

  location = "us-central1";

  model: string;

  auth: GoogleAuth;

  constructor(
    fields: GoogleVertexAiConnectionParams | undefined,
    caller: AsyncCaller
  ) {
    this.caller = caller;

    this.endpoint = fields?.endpoint ?? this.endpoint;
    this.location = fields?.location ?? this.location;
    this.model = fields?.model ?? this.model;

    this.auth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
  }

  async request(
    instances: [InstanceType],
    parameters: GoogleVertexAiModelParams,
    options: CallOptions
  ): Promise<GoogleVertexAiLLMResponse<PredictionType>> {
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
      return await client.request(opts);
    }

    const response = await this.caller.callWithOptions(
      { signal: options.signal },
      _request.bind(client)
    );

    return <GoogleVertexAiLLMResponse<PredictionType>>response;
  }
}

/**
 * Enables calls to the Google Cloud's Vertex AI API to access
 * Large Language Models.
 *
 * To use, you will need to have one of the following authentication
 * methods in place:
 * - You are logged into an account permitted to the Google Cloud project
 *   using Vertex AI.
 * - You are running this on a machine using a service account permitted to
 *   the Google Cloud project using Vertex AI.
 * - The `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set to the
 *   path of a credentials file for a service account permitted to the
 *   Google Cloud project using Vertex AI.
 */
export class GoogleVertexAiTextLLM
  extends BaseLLM
  implements GoogleVertexAiTextInput
{
  model = "text-bison";

  temperature = 0.7;

  maxTokens = 256;

  topP = 0.8;

  topK = 40;

  connection: GoogleVertexAiConnection<
    this["CallOptions"],
    GoogleVertexAiLLMTextInstance,
    TextPrediction
  >;

  constructor(fields?: GoogleVertexAiTextInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.topP = fields?.topP ?? this.topP;
    this.topK = fields?.topK ?? this.topK;

    this.connection = new GoogleVertexAiConnection(fields, this.caller);
  }

  _llmType(): string {
    return "googlevertexai";
  }

  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"]
  ): Promise<LLMResult> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const generations: Generation[][] = await Promise.all(
      prompts.map((prompt) => this._generatePrompt(prompt, options))
    );
    return { generations };
  }

  async _generatePrompt(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<Generation[]> {
    const instance = this.formatInstance(prompt);
    const parameters: GoogleVertexAiModelParams = {
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
      maxTokens: this.maxTokens,
    };
    const result = await this.connection.request(
      [instance],
      parameters,
      options
    );
    const prediction = this.convertResult(result);
    return [
      {
        text: prediction.content,
        generationInfo: prediction,
      },
    ];
  }

  formatInstance(prompt: string): GoogleVertexAiLLMTextInstance {
    return { content: prompt };
  }

  convertResult(
    result: GoogleVertexAiLLMResponse<TextPrediction>
  ): TextPrediction {
    return result?.data?.predictions[0];
  }
}
