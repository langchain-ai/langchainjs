import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { ChatResult, ChatGeneration } from "@langchain/core/outputs";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { YandexGPTInputs } from "./llms.js";

const apiUrl =
  "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

interface ParsedMessage {
  role: string;
  text: string;
}

function _parseChatHistory(history: BaseMessage[]): ParsedMessage[] {
  const chatHistory: ParsedMessage[] = [];

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
        chatHistory.push({ role: "system", text: message.content });
      }
    }
  }

  return chatHistory;
}

/**
 * @example
 * ```typescript
 * const chat = new ChatYandexGPT({});
 * // The assistant is set to translate English to French.
 * const res = await chat.invoke([
 *   new SystemMessage(
 *     "You are a helpful assistant that translates English to French."
 *   ),
 *   new HumanMessage("I love programming."),
 * ]);
 * ```
 */
export class ChatYandexGPT extends BaseChatModel {
  apiKey?: string;

  iamToken?: string;

  temperature = 0.6;

  maxTokens = 1700;

  model = "yandexgpt-lite";

  modelVersion = "latest";

  modelURI?: string;

  folderID?: string;

  constructor(fields?: YandexGPTInputs) {
    super(fields ?? {});

    const apiKey = fields?.apiKey ?? getEnvironmentVariable("YC_API_KEY");

    const iamToken = fields?.iamToken ?? getEnvironmentVariable("YC_IAM_TOKEN");

    const folderID = fields?.folderID ?? getEnvironmentVariable("YC_FOLDER_ID");

    if (apiKey === undefined && iamToken === undefined) {
      throw new Error(
        "Please set the YC_API_KEY or YC_IAM_TOKEN environment variable or pass it to the constructor as the apiKey or iamToken field."
      );
    }

    this.modelURI = fields?.modelURI;
    this.apiKey = apiKey;
    this.iamToken = iamToken;
    this.folderID = folderID;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.temperature = fields?.temperature ?? this.temperature;
    this.model = fields?.model ?? this.model;
    this.modelVersion = fields?.modelVersion ?? this.modelVersion;

    if (this.modelURI === undefined && folderID === undefined) {
      throw new Error(
        "Please set the YC_FOLDER_ID environment variable or pass Yandex GPT model URI to the constructor as the modelURI field."
      );
    }

    if (!this.modelURI) {
      this.modelURI = `gpt://${this.folderID}/${this.model}/${this.modelVersion}`;
    }
  }

  _llmType() {
    return "yandexgpt";
  }

  _combineLLMOutput?() {
    return {};
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "YC_API_KEY",
      iamToken: "YC_IAM_TOKEN",
      folderID: "YC_FOLDER_ID",
    };
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    const messageHistory = _parseChatHistory(messages);
    const headers = {
      "Content-Type": "application/json",
      Authorization: "",
      "x-folder-id": "",
    };
    if (this.apiKey !== undefined) {
      headers.Authorization = `Api-Key ${this.apiKey}`;
      if (this.folderID !== undefined) {
        headers["x-folder-id"] = this.folderID;
      }
    } else {
      headers.Authorization = `Bearer ${this.iamToken}`;
    }
    const bodyData = {
      modelUri: this.modelURI,
      completionOptions: {
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      },
      messages: messageHistory,
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
    const { text } = result.alternatives[0].message;
    const { totalTokens } = result.usage;
    const generations: ChatGeneration[] = [
      { text, message: new AIMessage(text) },
    ];

    return {
      generations,
      llmOutput: { totalTokens },
    };
  }
}
