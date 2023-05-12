import { GoogleAuth } from "google-auth-library";
import { BaseLLM, BaseLLMParams } from "./base.js";
import { Generation, LLMResult } from "../schema/index.js";

export interface GoogleVertexAiLLMInput extends BaseLLMParams {
  /** Sampling temperature to use */
  temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  maxTokens?: number;

  /** Model to use */
  model?: string;

  topP?: number;

  topK?: number;

  /** Hostname for the API call */
  endpoint?: string;

  /** Region where the LLM is stored */
  location?: string;
}

interface Response {
  data: {
    predictions: Prediction[];
  };
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
export class GoogleVertexAiLLM
  extends BaseLLM
  implements GoogleVertexAiLLMInput
{
  temperature = 0.7;

  maxTokens = 256;

  model = "text-bison";

  topP = 0.8;

  topK = 40;

  endpoint = "us-central1-aiplatform.googleapis.com";

  location = "us-central1";

  auth: GoogleAuth;

  constructor(fields?: GoogleVertexAiLLMInput) {
    super(fields ?? {});

    this.temperature = fields?.temperature ?? this.temperature;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.model = fields?.model ?? this.model;
    this.topP = fields?.topP ?? this.topP;
    this.topK = fields?.topK ?? this.topK;
    this.endpoint = fields?.endpoint ?? this.endpoint;
    this.location = fields?.location ?? this.location;

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

  async predict(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<Prediction> {
    const client = await this.auth.getClient();
    const projectId = await this.auth.getProjectId();
    const url = `https://${this.endpoint}/v1/projects/${projectId}/locations/${this.location}/publishers/google/models/${this.model}:predict`;
    const method = "POST" as const;

    const data = {
      instances: [{ content: prompt }],
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

    return (<Response>response).data.predictions[0];
  }
}
