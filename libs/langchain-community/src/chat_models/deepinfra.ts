import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { type ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export const DEFAULT_MODEL = "meta-llama/Meta-Llama-3-70B-Instruct";

export type DeepInfraMessageRole = "system" | "assistant" | "user";

export const API_BASE_URL =
  "https://api.deepinfra.com/v1/openai/chat/completions";

export const ENV_VARIABLE_API_KEY = "DEEPINFRA_API_TOKEN";

interface DeepInfraMessage {
  role: DeepInfraMessageRole;
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages?: DeepInfraMessage[];
  stream?: boolean;
  max_tokens?: number | null;
  temperature?: number | null;
}

interface BaseResponse {
  code?: string;
  message?: string;
}

interface ChoiceMessage {
  role: string;
  content: string;
}

interface ResponseChoice {
  index: number;
  finish_reason: "stop" | "length" | "null" | null;
  delta: ChoiceMessage;
  message: ChoiceMessage;
}

interface ChatCompletionResponse extends BaseResponse {
  choices: ResponseChoice[];
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
  output: {
    text: string;
    finish_reason: "stop" | "length" | "null" | null;
  };
}

export interface ChatDeepInfraParams {
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

function messageToRole(message: BaseMessage): DeepInfraMessageRole {
  const type = message._getType();
  switch (type) {
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "system":
      return "system";
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

export class ChatDeepInfra
  extends BaseChatModel
  implements ChatDeepInfraParams
{
  static lc_name() {
    return "ChatDeepInfra";
  }

  get callKeys() {
    return ["stop", "signal", "options"];
  }

  apiKey?: string;

  model: string;

  apiUrl: string;

  maxTokens?: number;

  temperature?: number;

  constructor(fields: Partial<ChatDeepInfraParams> & BaseChatModelParams = {}) {
    super(fields);

    this.apiKey =
      fields?.apiKey ?? getEnvironmentVariable(ENV_VARIABLE_API_KEY);
    if (!this.apiKey) {
      throw new Error(
        "API key is required, set `DEEPINFRA_API_TOKEN` environment variable or pass it as a parameter"
      );
    }

    this.apiUrl = API_BASE_URL;
    this.model = fields.model ?? DEFAULT_MODEL;
    this.temperature = fields.temperature ?? 0;
    this.maxTokens = fields.maxTokens;
  }

  invocationParams(): Omit<ChatCompletionRequest, "messages"> {
    return {
      model: this.model,
      stream: false,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    };
  }

  identifyingParams(): Omit<ChatCompletionRequest, "messages"> {
    return this.invocationParams();
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    const parameters = this.invocationParams();

    const messagesMapped: DeepInfraMessage[] = messages.map((message) => ({
      role: messageToRole(message),
      content: message.content as string,
    }));

    const data = await this.completionWithRetry(
      { ...parameters, messages: messagesMapped },
      false,
      options?.signal
    ).then<ChatCompletionResponse>((data) => {
      if (data?.code) {
        throw new Error(data?.message);
      }
      const { finish_reason, message } = data.choices[0];
      const text = message.content;
      return {
        ...data,
        output: { text, finish_reason },
      };
    });

    const {
      prompt_tokens = 0,
      completion_tokens = 0,
      total_tokens = 0,
    } = data.usage ?? {};

    const { text } = data.output;

    return {
      generations: [{ text, message: new AIMessage(text) }],
      llmOutput: {
        tokenUsage: {
          promptTokens: prompt_tokens,
          completionTokens: completion_tokens,
          totalTokens: total_tokens,
        },
      },
    };
  }

  async completionWithRetry(
    request: ChatCompletionRequest,
    stream: boolean,
    signal?: AbortSignal
  ) {
    const body = {
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      ...request,
      model: this.model,
    };

    const makeCompletionRequest = async () => {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!stream) {
        return response.json();
      }
    };

    return this.caller.call(makeCompletionRequest);
  }

  _llmType(): string {
    return "DeepInfra";
  }
}
