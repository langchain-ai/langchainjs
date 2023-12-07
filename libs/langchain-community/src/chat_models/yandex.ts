import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { ChatResult, ChatGeneration } from "@langchain/core/outputs";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { YandexGPTInputs } from "../llms/yandex.js";

const apiUrl = "https://llm.api.cloud.yandex.net/llm/v1alpha/chat";

interface ParsedMessage {
  role: string;
  text: string;
}

function _parseChatHistory(history: BaseMessage[]): [ParsedMessage[], string] {
  const chatHistory: ParsedMessage[] = [];
  let instruction = "";

  for (const message of history) {
    if (typeof message.content !== "string") {
      throw new Error(
        "ChatYandexGPT does not support non-string message content."
      );
    }
    if ("content" in message) {
      if (message._getType() === "human") {
        chatHistory.push({ role: "user", text: message.content });
      } else if (message._getType() === "ai") {
        chatHistory.push({ role: "assistant", text: message.content });
      } else if (message._getType() === "system") {
        instruction = message.content;
      }
    }
  }

  return [chatHistory, instruction];
}

/**
 * @example
 * ```typescript
 * const chat = new ChatYandexGPT({});
 * // The assistant is set to translate English to French.
 * const res = await chat.call([
 *   new SystemMessage(
 *     "You are a helpful assistant that translates English to French."
 *   ),
 *   new HumanMessage("I love programming."),
 * ]);
 * console.log(res);
 * ```
 */
export class ChatYandexGPT extends BaseChatModel {
  apiKey?: string;

  iamToken?: string;

  temperature = 0.6;

  maxTokens = 1700;

  model = "general";

  constructor(fields?: YandexGPTInputs) {
    super(fields ?? {});

    const apiKey = fields?.apiKey ?? getEnvironmentVariable("YC_API_KEY");

    const iamToken = fields?.iamToken ?? getEnvironmentVariable("YC_IAM_TOKEN");

    if (apiKey === undefined && iamToken === undefined) {
      throw new Error(
        "Please set the YC_API_KEY or YC_IAM_TOKEN environment variable or pass it to the constructor as the apiKey or iamToken field."
      );
    }

    this.apiKey = apiKey;
    this.iamToken = iamToken;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.temperature = fields?.temperature ?? this.temperature;
    this.model = fields?.model ?? this.model;
  }

  _llmType() {
    return "yandexgpt";
  }

  _combineLLMOutput?() {
    return {};
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _?: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    const [messageHistory, instruction] = _parseChatHistory(messages);
    const headers = { "Content-Type": "application/json", Authorization: "" };
    if (this.apiKey !== undefined) {
      headers.Authorization = `Api-Key ${this.apiKey}`;
    } else {
      headers.Authorization = `Bearer ${this.iamToken}`;
    }
    const bodyData = {
      model: this.model,
      generationOptions: {
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      },
      messages: messageHistory,
      instructionText: instruction,
    };
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyData),
      signal: options?.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${apiUrl} from YandexGPT: ${response.status}`
      );
    }
    const responseData = await response.json();
    const { result } = responseData;
    const { text } = result.message;
    const totalTokens = result.num_tokens;
    const generations: ChatGeneration[] = [
      { text, message: new AIMessage(text) },
    ];

    return {
      generations,
      llmOutput: { totalTokens },
    };
  }
}
