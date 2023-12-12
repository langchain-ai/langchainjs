import {
  LlamaModel,
  LlamaContext,
  LlamaChatSession,
  type ConversationInteraction,
} from "node-llama-cpp";

import {
  SimpleChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseMessage,
  AIMessageChunk,
  ChatMessage,
} from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import {
  LlamaBaseCppInputs,
  createLlamaModel,
  createLlamaContext,
} from "../utils/llama_cpp.js";

/**
 * Note that the modelPath is the only required parameter. For testing you
 * can set this in the environment variable `LLAMA_PATH`.
 */
export interface LlamaCppInputs
  extends LlamaBaseCppInputs,
    BaseChatModelParams {}

export interface LlamaCppCallOptions extends BaseLanguageModelCallOptions {
  /** The maximum number of tokens the response should contain. */
  maxTokens?: number;
  /** A function called when matching the provided token array */
  onToken?: (tokens: number[]) => void;
}

/**
 *  To use this model you need to have the `node-llama-cpp` module installed.
 *  This can be installed using `npm install -S node-llama-cpp` and the minimum
 *  version supported in version 2.0.0.
 *  This also requires that have a locally built version of Llama2 installed.
 * @example
 * ```typescript
 * // Initialize the ChatLlamaCpp model with the path to the model binary file.
 * const model = new ChatLlamaCpp({
 *   modelPath: "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin",
 *   temperature: 0.5,
 * });
 *
 * // Call the model with a message and await the response.
 * const response = await model.call([
 *   new HumanMessage({ content: "My name is John." }),
 * ]);
 *
 * // Log the response to the console.
 * console.log({ response });
 *
 * ```
 */
export class ChatLlamaCpp extends SimpleChatModel<LlamaCppCallOptions> {
  declare CallOptions: LlamaCppCallOptions;

  static inputs: LlamaCppInputs;

  maxTokens?: number;

  temperature?: number;

  topK?: number;

  topP?: number;

  trimWhitespaceSuffix?: boolean;

  _model: LlamaModel;

  _context: LlamaContext;

  _session: LlamaChatSession | null;

  lc_serializable = true;

  static lc_name() {
    return "ChatLlamaCpp";
  }

  constructor(inputs: LlamaCppInputs) {
    super(inputs);
    this.maxTokens = inputs?.maxTokens;
    this.temperature = inputs?.temperature;
    this.topK = inputs?.topK;
    this.topP = inputs?.topP;
    this.trimWhitespaceSuffix = inputs?.trimWhitespaceSuffix;
    this._model = createLlamaModel(inputs);
    this._context = createLlamaContext(this._model, inputs);
    this._session = null;
  }

  _llmType() {
    return "llama2_cpp";
  }

  /** @ignore */
  _combineLLMOutput() {
    return {};
  }

  invocationParams() {
    return {
      maxTokens: this.maxTokens,
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
      trimWhitespaceSuffix: this.trimWhitespaceSuffix,
    };
  }

  /** @ignore */
  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    let prompt = "";

    if (messages.length > 1) {
      // We need to build a new _session
      prompt = this._buildSession(messages);
    } else if (!this._session) {
      prompt = this._buildSession(messages);
    } else {
      if (typeof messages[0].content !== "string") {
        throw new Error(
          "ChatLlamaCpp does not support non-string message content in sessions."
        );
      }
      // If we already have a session then we should just have a single prompt
      prompt = messages[0].content;
    }

    try {
      const promptOptions = {
        onToken: options.onToken,
        maxTokens: this?.maxTokens,
        temperature: this?.temperature,
        topK: this?.topK,
        topP: this?.topP,
        trimWhitespaceSuffix: this?.trimWhitespaceSuffix,
      };
      // @ts-expect-error - TS2531: Object is possibly 'null'.
      const completion = await this._session.prompt(prompt, promptOptions);
      return completion;
    } catch (e) {
      throw new Error("Error getting prompt completion.");
    }
  }

  async *_streamResponseChunks(
    input: BaseMessage[],
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const promptOptions = {
      temperature: this?.temperature,
      topK: this?.topK,
      topP: this?.topP,
    };

    const prompt = this._buildPrompt(input);

    const stream = await this.caller.call(async () =>
      this._context.evaluate(this._context.encode(prompt), promptOptions)
    );

    for await (const chunk of stream) {
      yield new ChatGenerationChunk({
        text: this._context.decode([chunk]),
        message: new AIMessageChunk({
          content: this._context.decode([chunk]),
        }),
        generationInfo: {},
      });
      await runManager?.handleLLMNewToken(this._context.decode([chunk]) ?? "");
    }
  }

  // This constructs a new session if we need to adding in any sys messages or previous chats
  protected _buildSession(messages: BaseMessage[]): string {
    let prompt = "";
    let sysMessage = "";
    let noSystemMessages: BaseMessage[] = [];
    let interactions: ConversationInteraction[] = [];

    // Let's see if we have a system message
    if (messages.findIndex((msg) => msg._getType() === "system") !== -1) {
      const sysMessages = messages.filter(
        (message) => message._getType() === "system"
      );

      const systemMessageContent = sysMessages[sysMessages.length - 1].content;

      if (typeof systemMessageContent !== "string") {
        throw new Error(
          "ChatLlamaCpp does not support non-string message content in sessions."
        );
      }
      // Only use the last provided system message
      sysMessage = systemMessageContent;

      // Now filter out the system messages
      noSystemMessages = messages.filter(
        (message) => message._getType() !== "system"
      );
    } else {
      noSystemMessages = messages;
    }

    // Lets see if we just have a prompt left or are their previous interactions?
    if (noSystemMessages.length > 1) {
      // Is the last message a prompt?
      if (
        noSystemMessages[noSystemMessages.length - 1]._getType() === "human"
      ) {
        const finalMessageContent =
          noSystemMessages[noSystemMessages.length - 1].content;
        if (typeof finalMessageContent !== "string") {
          throw new Error(
            "ChatLlamaCpp does not support non-string message content in sessions."
          );
        }
        prompt = finalMessageContent;
        interactions = this._convertMessagesToInteractions(
          noSystemMessages.slice(0, noSystemMessages.length - 1)
        );
      } else {
        interactions = this._convertMessagesToInteractions(noSystemMessages);
      }
    } else {
      if (typeof noSystemMessages[0].content !== "string") {
        throw new Error(
          "ChatLlamaCpp does not support non-string message content in sessions."
        );
      }
      // If there was only a single message we assume it's a prompt
      prompt = noSystemMessages[0].content;
    }

    // Now lets construct a session according to what we got
    if (sysMessage !== "" && interactions.length > 0) {
      this._session = new LlamaChatSession({
        context: this._context,
        conversationHistory: interactions,
        systemPrompt: sysMessage,
      });
    } else if (sysMessage !== "" && interactions.length === 0) {
      this._session = new LlamaChatSession({
        context: this._context,
        systemPrompt: sysMessage,
      });
    } else if (sysMessage === "" && interactions.length > 0) {
      this._session = new LlamaChatSession({
        context: this._context,
        conversationHistory: interactions,
      });
    } else {
      this._session = new LlamaChatSession({
        context: this._context,
      });
    }

    return prompt;
  }

  // This builds a an array of interactions
  protected _convertMessagesToInteractions(
    messages: BaseMessage[]
  ): ConversationInteraction[] {
    const result: ConversationInteraction[] = [];

    for (let i = 0; i < messages.length; i += 2) {
      if (i + 1 < messages.length) {
        const prompt = messages[i].content;
        const response = messages[i + 1].content;
        if (typeof prompt !== "string" || typeof response !== "string") {
          throw new Error(
            "ChatLlamaCpp does not support non-string message content."
          );
        }
        result.push({
          prompt,
          response,
        });
      }
    }

    return result;
  }

  protected _buildPrompt(input: BaseMessage[]): string {
    const prompt = input
      .map((message) => {
        let messageText;
        if (message._getType() === "human") {
          messageText = `[INST] ${message.content} [/INST]`;
        } else if (message._getType() === "ai") {
          messageText = message.content;
        } else if (message._getType() === "system") {
          messageText = `<<SYS>> ${message.content} <</SYS>>`;
        } else if (ChatMessage.isInstance(message)) {
          messageText = `\n\n${message.role[0].toUpperCase()}${message.role.slice(
            1
          )}: ${message.content}`;
        } else {
          console.warn(
            `Unsupported message type passed to llama_cpp: "${message._getType()}"`
          );
          messageText = "";
        }
        return messageText;
      })
      .join("\n");

    return prompt;
  }
}
