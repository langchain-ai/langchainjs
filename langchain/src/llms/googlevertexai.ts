import { GoogleAuth } from "google-auth-library";
import { BaseLLM, BaseLLMParams } from "./base.js";
import { Generation, LLMResult } from "../schema/index.js";

interface GoogleVertexAiBaseLLMInput extends BaseLLMParams {
  /** Sampling temperature to use */
  temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  maxTokens?: number;

  topP?: number;

  topK?: number;

  /** Hostname for the API call */
  endpoint?: string;

  /** Region where the LLM is stored */
  location?: string;

  /** Model to use */
  model?: string;
}

export interface GoogleVertexAiLLMInput extends GoogleVertexAiBaseLLMInput {}

export const ChatRequestMessageRoleEnum = {
  System: "system",
  User: "user",
  Assistant: "assistant", // For OpenAI compatibility
  Bot: "bot",
} as const;

export type ChatRequestMessageRoleEnum =
  (typeof ChatRequestMessageRoleEnum)[keyof typeof ChatRequestMessageRoleEnum];

/*
const ChatRequestMessageRoleAlias = {
  assistant: 'bot'
} as const;
*/

/**
 * Based on OpenAI ChatCompletionRequestMessage
 */
export interface ChatRequestMessage {
  role: ChatRequestMessageRoleEnum;
  content: string;
  name?: string;
}

export interface GoogleVertexAiChatInput extends GoogleVertexAiLLMInput {
  prefixMessages?: ChatRequestMessage[];
}

interface Response {
  data: {
    predictions: Prediction[];
  };
}

interface LLMInstance {
  content: string;
}

/**
 * Models the data returned from the API call
 */
interface Prediction {
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  safetyAttributes?: any;
}

/**
 * Enables calls to the Google Cloud's Vertex AI AP to access Large Language Models.
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
abstract class GoogleVertexAiBaseLLM
  extends BaseLLM
  implements GoogleVertexAiBaseLLMInput
{
  temperature = 0.7;

  maxTokens = 256;

  topP = 0.8;

  topK = 40;

  endpoint = "us-central1-aiplatform.googleapis.com";

  location = "us-central1";

  model: string;

  auth: GoogleAuth;

  constructor(fields?: GoogleVertexAiBaseLLMInput) {
    super(fields ?? {});

    this.temperature = fields?.temperature ?? this.temperature;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.topP = fields?.topP ?? this.topP;
    this.topK = fields?.topK ?? this.topK;
    this.endpoint = fields?.endpoint ?? this.endpoint;
    this.location = fields?.location ?? this.location;
    this.model = fields?.model ?? this.model;

    this.auth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
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
      prompts.map((prompt) => this.promptGeneration(prompt, options))
    );
    return { generations };
  }

  async promptGeneration(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<Generation[]> {
    const prediction = await this.predict(prompt, options);
    return [
      {
        text: prediction.content,
        generationInfo: prediction,
      },
    ];
  }

  async _predict(
    instances: [LLMInstance],
    options: this["ParsedCallOptions"]
  ): Promise<Response> {
    const client = await this.auth.getClient();
    const projectId = await this.auth.getProjectId();
    const url = `https://${this.endpoint}/v1/projects/${projectId}/locations/${this.location}/publishers/google/models/${this.model}:predict`;
    const method = "POST" as const;

    const data = {
      instances,
      parameters: {
        temperature: this.temperature,
        maxOutputTokens: this.maxTokens,
        topP: this.topP,
        topK: this.topK,
      },
    };

    const opts = {
      url,
      method,
      data,
    };

    async function request() {
      return await client.request(opts);
    }

    const response = await this.caller.callWithOptions(
      { signal: options.signal },
      request.bind(client)
    );

    return <Response>response;
  }

  abstract predict(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<Prediction>;
}

export class GoogleVertexAiLLM extends GoogleVertexAiBaseLLM {
  model = "text-bison";

  constructor(fields?: GoogleVertexAiLLMInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
  }

  async predict(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<Prediction> {
    const response = await this._predict([{ content: prompt }], options);
    return response.data.predictions[0];
  }
}
