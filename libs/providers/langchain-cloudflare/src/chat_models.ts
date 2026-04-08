import {
  LangSmithParams,
  SimpleChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import {
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
} from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

import type { CloudflareWorkersAIInput } from "./llms.js";
import { convertEventStreamToIterableReadableDataStream } from "./utils/event_source_parse.js";

/**
 * An interface defining the options for a Cloudflare Workers AI call. It extends
 * the BaseLanguageModelCallOptions interface.
 */
export interface ChatCloudflareWorkersAICallOptions extends BaseLanguageModelCallOptions {}

/**
 * A class that enables calls to the Cloudflare Workers AI API to access large language
 * models in a chat-like fashion. It extends the SimpleChatModel class and
 * implements the CloudflareWorkersAIInput interface.
 * @example
 * ```typescript
 * const model = new ChatCloudflareWorkersAI({
 *   model: "@cf/meta/llama-2-7b-chat-int8",
 *   cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
 *   cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN
 * });
 *
 * const response = await model.invoke([
 *   ["system", "You are a helpful assistant that translates English to German."],
 *   ["human", `Translate "I love programming".`]
 * ]);
 *
 * console.log(response);
 * ```
 */
export class ChatCloudflareWorkersAI
  extends SimpleChatModel
  implements CloudflareWorkersAIInput
{
  static lc_name() {
    return "ChatCloudflareWorkersAI";
  }

  lc_serializable = true;

  model = "@cf/meta/llama-2-7b-chat-int8";

  cloudflareAccountId?: string;

  cloudflareApiToken?: string;

  baseUrl: string;

  streaming = false;

  constructor(
    model: string,
    params?: Omit<CloudflareWorkersAIInput & BaseChatModelParams, "model">
  );
  constructor(fields?: CloudflareWorkersAIInput & BaseChatModelParams);
  constructor(
    modelOrFields?: string | (CloudflareWorkersAIInput & BaseChatModelParams),
    paramsArg?: Omit<CloudflareWorkersAIInput & BaseChatModelParams, "model">
  ) {
    const fields =
      typeof modelOrFields === "string"
        ? { ...(paramsArg ?? {}), model: modelOrFields }
        : (modelOrFields ?? {});
    super(fields);
    this._addVersion("@langchain/cloudflare", __PKG_VERSION__);

    this.model = fields.model ?? this.model;
    this.streaming = fields.streaming ?? this.streaming;
    this.cloudflareAccountId =
      fields.cloudflareAccountId ??
      getEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID");
    this.cloudflareApiToken =
      fields.cloudflareApiToken ??
      getEnvironmentVariable("CLOUDFLARE_API_TOKEN");
    this.baseUrl =
      fields.baseUrl ??
      `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/ai/run`;
    if (this.baseUrl.endsWith("/")) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    return {
      ls_provider: "cloudflare",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_stop: options.stop,
    };
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      cloudflareApiToken: "CLOUDFLARE_API_TOKEN",
    };
  }

  _llmType() {
    return "cloudflare";
  }

  /** Get the identifying parameters for this LLM. */
  get identifyingParams() {
    return { model: this.model };
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(_options?: this["ParsedCallOptions"]) {
    return {
      model: this.model,
    };
  }

  _combineLLMOutput() {
    return {};
  }

  private _isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object";
  }

  private _extractTextFromResult(
    result: Record<string, unknown>
  ): string | undefined {
    if (typeof result.response === "string") {
      return result.response;
    }
    if (typeof result.output_text === "string") {
      return result.output_text;
    }
    if (!Array.isArray(result.output)) {
      if (!Array.isArray(result.choices)) {
        return undefined;
      }
      // Some Cloudflare models return OpenAI-compatible choices; content can be
      // a string, content blocks, or null with reasoning_content only.
      // https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
      const choiceText: string[] = [];
      for (const choice of result.choices) {
        if (!this._isRecord(choice) || !this._isRecord(choice.message)) {
          continue;
        }
        if (typeof choice.message.content === "string") {
          choiceText.push(choice.message.content);
          continue;
        }
        if (Array.isArray(choice.message.content)) {
          for (const block of choice.message.content) {
            if (this._isRecord(block) && typeof block.text === "string") {
              choiceText.push(block.text);
            }
          }
          continue;
        }
        if (typeof choice.message.reasoning_content === "string") {
          choiceText.push(choice.message.reasoning_content);
        }
      }
      if (choiceText.length === 0) {
        return undefined;
      }
      return choiceText.join("");
    }

    const textChunks: string[] = [];
    for (const item of result.output) {
      if (!this._isRecord(item)) {
        continue;
      }
      if (typeof item.text === "string") {
        textChunks.push(item.text);
      }
      if (!Array.isArray(item.content)) {
        continue;
      }
      for (const block of item.content) {
        if (!this._isRecord(block)) {
          continue;
        }
        if (typeof block.text === "string") {
          textChunks.push(block.text);
        }
      }
    }

    if (textChunks.length === 0) {
      return undefined;
    }
    return textChunks.join("");
  }

  private _extractTextFromResponse(responseData: unknown): string {
    if (!this._isRecord(responseData)) {
      throw new Error(
        "Unexpected Cloudflare response format: response is not an object."
      );
    }

    if (typeof responseData.response === "string") {
      return responseData.response;
    }

    if (this._isRecord(responseData.result)) {
      const text = this._extractTextFromResult(responseData.result);
      if (text !== undefined) {
        return text;
      }
    }

    throw new Error(
      `Unexpected Cloudflare response format: could not find text in any of the expected locations (response, result.response, result.output_text, result.output[], or result.choices[*].message.{content,reasoning_content}). Top-level keys received: ${Object.keys(responseData).join(
        ", "
      )}.`
    );
  }

  private _extractTextFromChunk(chunkData: unknown): string | undefined {
    if (!this._isRecord(chunkData)) {
      return undefined;
    }
    if (typeof chunkData.response === "string") {
      return chunkData.response;
    }
    if (this._isRecord(chunkData.result)) {
      return this._extractTextFromResult(chunkData.result);
    }
    if (Array.isArray(chunkData.choices)) {
      // Streaming payloads may provide text in delta.content, final message.content,
      // or reasoning_content when content is absent.
      const chunkText: string[] = [];
      for (const choice of chunkData.choices) {
        if (!this._isRecord(choice)) {
          continue;
        }
        if (
          this._isRecord(choice.delta) &&
          typeof choice.delta.content === "string"
        ) {
          chunkText.push(choice.delta.content);
          continue;
        }
        if (
          this._isRecord(choice.message) &&
          typeof choice.message.content === "string"
        ) {
          chunkText.push(choice.message.content);
          continue;
        }
        if (
          this._isRecord(choice.delta) &&
          typeof choice.delta.reasoning_content === "string"
        ) {
          chunkText.push(choice.delta.reasoning_content);
          continue;
        }
        if (
          this._isRecord(choice.message) &&
          typeof choice.message.reasoning_content === "string"
        ) {
          chunkText.push(choice.message.reasoning_content);
        }
      }
      if (chunkText.length > 0) {
        return chunkText.join("");
      }
    }
    return undefined;
  }

  /**
   * Method to validate the environment.
   */
  validateEnvironment() {
    if (!this.cloudflareAccountId) {
      throw new Error(
        `No Cloudflare account ID found. Please provide it when instantiating the CloudflareWorkersAI class, or set it as "CLOUDFLARE_ACCOUNT_ID" in your environment variables.`
      );
    }
    if (!this.cloudflareApiToken) {
      throw new Error(
        `No Cloudflare API key found. Please provide it when instantiating the CloudflareWorkersAI class, or set it as "CLOUDFLARE_API_KEY" in your environment variables.`
      );
    }
  }

  async _request(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    stream?: boolean
  ) {
    this.validateEnvironment();
    const url = `${this.baseUrl}/${this.model}`;
    const headers = {
      Authorization: `Bearer ${this.cloudflareApiToken}`,
      "Content-Type": "application/json",
    };

    const formattedMessages = this._formatMessages(messages);

    const data = { messages: formattedMessages, stream };
    return this.caller.call(async () => {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        signal: options.signal,
      });
      if (!response.ok) {
        const error = new Error(
          `Cloudflare LLM call failed with status code ${response.status}`
        );
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).response = response;
        throw error;
      }
      return response;
    });
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const response = await this._request(messages, options, true);
    if (!response.body) {
      throw new Error("Empty response from Cloudflare. Please try again.");
    }
    const stream = convertEventStreamToIterableReadableDataStream(
      response.body
    );
    for await (const chunk of stream) {
      if (options.signal?.aborted) {
        return;
      }
      if (chunk !== "[DONE]") {
        const parsedChunk = JSON.parse(chunk);
        const chunkText = this._extractTextFromChunk(parsedChunk);
        if (chunkText === undefined) {
          continue;
        }
        const generationChunk = new ChatGenerationChunk({
          message: new AIMessageChunk({ content: chunkText }),
          text: chunkText,
        });
        yield generationChunk;
        // oxlint-disable-next-line no-void
        void runManager?.handleLLMNewToken(generationChunk.text ?? "");
      }
    }
  }

  protected _formatMessages(
    messages: BaseMessage[]
  ): { role: string; content: string }[] {
    const formattedMessages = messages.map((message) => {
      let role;
      if (message._getType() === "human") {
        role = "user";
      } else if (message._getType() === "ai") {
        role = "assistant";
      } else if (message._getType() === "system") {
        role = "system";
      } else if (ChatMessage.isInstance(message)) {
        role = message.role;
      } else {
        console.warn(
          `Unsupported message type passed to Cloudflare: "${message._getType()}"`
        );
        role = "user";
      }
      if (typeof message.content !== "string") {
        throw new Error(
          "ChatCloudflareWorkersAI currently does not support non-string message content."
        );
      }
      return {
        role,
        content: message.content,
      };
    });
    return formattedMessages;
  }

  /** @ignore */
  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    // Integration tests call _call directly without options, so guard against
    // undefined before reading signal.
    const parsedOptions = options ?? ({} as this["ParsedCallOptions"]);
    parsedOptions.signal?.throwIfAborted();
    if (!this.streaming) {
      const response = await this._request(messages, parsedOptions);

      const responseData: unknown = await response.json();

      return this._extractTextFromResponse(responseData);
    } else {
      const stream = this._streamResponseChunks(
        messages,
        parsedOptions,
        runManager
      );
      let finalResult: ChatGenerationChunk | undefined;
      for await (const chunk of stream) {
        if (finalResult === undefined) {
          finalResult = chunk;
        } else {
          finalResult = finalResult.concat(chunk);
        }
      }
      const messageContent = finalResult?.message.content;
      if (messageContent && typeof messageContent !== "string") {
        throw new Error(
          "Non-string output for ChatCloudflareWorkersAI is currently not supported."
        );
      }
      return messageContent ?? "";
    }
  }
}
