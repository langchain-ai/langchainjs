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

  /** Hostname for the API call */
  endpoint?: string;

  /** Region where the LLM is stored */
  location?: string;

  /** Model to use */
  model?: string;
}

export interface GoogleVertexAiLLMInput extends GoogleVertexAiBaseLLMInput {}

export interface GoogleVertexAiChatInput extends GoogleVertexAiBaseLLMInput {
  /** Any messages from earlier in this conversation */
  prefixMessages?: ChatMessage[];

  /** Instructions how the model should respond */
  context?: string;

  /** Help the model understand what an appropriate response is */
  examples?: ChatExample[];

  /**
   * A map of OpenAI role names and their corresponding Vertex AI
   * author name.
   */
  roleAlias?: RoleAlias;
}

export const ChatMessageRoleEnum = {
  System: "system",
  User: "user",
  Assistant: "assistant", // For OpenAI compatibility
  Bot: "bot",
} as const;

export type ChatMessageRoleEnum =
  (typeof ChatMessageRoleEnum)[keyof typeof ChatMessageRoleEnum];

type RoleAlias = Record<string, string>;

/**
 * Based on OpenAI ChatCompletionRequestMessage
 */
export interface ChatMessage {
  role: ChatMessageRoleEnum;
  content: string;
  name?: string;
}

/**
 * Represents a single "example" exchange that can be provided to
 * help illustrate what a model response should look like.
 */
export interface ChatExample {
  input: ChatMessage;
  output: ChatMessage;
}

interface Response {
  data: {
    predictions: Prediction[];
  };
}

interface GoogleVertexAiLLMTextInstance {
  content: string;
}

interface GoogleVertexAiChatExample {
  input: GoogleVertexAiChatMessage;
  output: GoogleVertexAiChatMessage;
}

interface GoogleVertexAiChatMessage {
  author: ChatMessageRoleEnum;
  content: string;
  name?: string;
}

interface GoogleVertexAiLLMChatInstance {
  context?: string;
  examples?: GoogleVertexAiChatExample[];
  messages: GoogleVertexAiChatMessage[];
}

type GoogleVertexAiLLMInstance =
  | GoogleVertexAiLLMTextInstance
  | GoogleVertexAiLLMChatInstance;

/**
 * Models the data returned from the API call
 */
interface BasePrediction {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  safetyAttributes?: any;
}

interface TextPrediction extends BasePrediction {
  content: string;
}

interface ChatPrediction extends BasePrediction {
  candidates: ChatMessage[];
}

type Prediction = TextPrediction | ChatPrediction;

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
    return [this.predictionToGeneration(prediction)];
  }

  abstract predictionToGeneration(prediction: Prediction): Generation;

  async _predict(
    instances: [GoogleVertexAiLLMInstance],
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

  async predict(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<Prediction> {
    const response = await this._predict(
      [this.formatInstance(prompt)],
      options
    );
    return this.formatResponse(response);
  }

  abstract formatInstance(prompt: string): GoogleVertexAiLLMInstance;

  formatResponse(response: Response): Prediction {
    return response?.data?.predictions[0];
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
export class GoogleVertexAiLLM extends GoogleVertexAiBaseLLM {
  model = "text-bison";

  constructor(fields?: GoogleVertexAiLLMInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
  }

  formatInstance(prompt: string): GoogleVertexAiLLMTextInstance {
    return { content: prompt };
  }

  predictionToGeneration(prediction: TextPrediction): Generation {
    return {
      text: prediction.content,
      generationInfo: prediction,
    };
  }
}

/**
 * Enables calls to the Google Cloud's Vertex AI API to access
 * Large Language Models in a chat-like fashion.
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
export class GoogleVertexAiChat
  extends GoogleVertexAiBaseLLM
  implements GoogleVertexAiChatInput
{
  model = "chat-bison";

  prefixMessages: ChatMessage[] = [];

  context: string;

  examples: ChatExample[];

  roleAlias: RoleAlias = {
    assistant: "bot",
  };

  constructor(fields?: GoogleVertexAiChatInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.prefixMessages = fields?.prefixMessages ?? this.prefixMessages;
    this.context = fields?.context ?? this.context;
    this.examples = fields?.examples ?? this.examples;
    this.roleAlias = fields?.roleAlias ?? this.roleAlias;
  }

  formatMessages(prompt: string): ChatMessage[] {
    const message: ChatMessage = {
      role: "user",
      content: prompt,
    };
    return this.prefixMessages ? [...this.prefixMessages, message] : [message];
  }

  reformatMessage(message: ChatMessage): GoogleVertexAiChatMessage {
    const ret: GoogleVertexAiChatMessage = {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      author: this.roleAlias[message.role] ?? message.role,
      content: message.content,
    };
    if (message.name) {
      ret.name = message.name;
    }
    return ret;
  }

  reformatExample(example: ChatExample): GoogleVertexAiChatExample {
    return {
      input: this.reformatMessage(example.input),
      output: this.reformatMessage(example.output),
    };
  }

  reformatMessages(messages: ChatMessage[]): GoogleVertexAiChatMessage[] {
    return messages.map((message) => this.reformatMessage(message));
  }

  reformatExamples(examples: ChatExample[]): GoogleVertexAiChatExample[] {
    return examples.map((example) => this.reformatExample(example));
  }

  formatInstance(prompt: string): GoogleVertexAiLLMChatInstance {
    const messages = this.formatMessages(prompt);
    return {
      context: this.context ?? "",
      examples: this.reformatExamples(this.examples ?? []),
      messages: this.reformatMessages(messages),
    };
  }

  predictionToGeneration(prediction: ChatPrediction): Generation {
    return {
      text: prediction?.candidates[0]?.content,
      generationInfo: prediction,
    };
  }
}
