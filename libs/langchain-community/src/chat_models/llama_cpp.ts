/* eslint-disable import/no-extraneous-dependencies */
import {
  LlamaModel,
  LlamaContext,
  LlamaChatSession,
  type Token,
  ChatUserMessage,
  ChatModelResponse,
  ChatHistoryItem,
  getLlama,
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
 * const model = await ChatLlamaCpp.initialize({
 *   modelPath: "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin",
 *   temperature: 0.5,
 * });
 *
 * // Call the model with a message and await the response.
 * const response = await model.invoke([
 *   new HumanMessage({ content: "My name is John." }),
 * ]);
 *
 * // Log the response to the console.
 * console.log({ response });
 *
 * ```
 */
export class ChatLlamaCpp extends SimpleChatModel<LlamaCppCallOptions> {
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

  public constructor(inputs: LlamaCppInputs) {
    super(inputs);
    this.maxTokens = inputs?.maxTokens;
    this.temperature = inputs?.temperature;
    this.topK = inputs?.topK;
    this.topP = inputs?.topP;
    this.trimWhitespaceSuffix = inputs?.trimWhitespaceSuffix;
    this._session = null;
  }

  /**
   * Initializes the llama_cpp model for usage in the chat models wrapper.
   * @param inputs - the inputs passed onto the model.
   * @returns A Promise that resolves to the ChatLlamaCpp type class.
   */
  public static async initialize(
    inputs: LlamaBaseCppInputs
  ): Promise<ChatLlamaCpp> {
    const instance = new ChatLlamaCpp(inputs);
    const llama = await getLlama();

    instance._model = await createLlamaModel(inputs, llama);
    instance._context = await createLlamaContext(instance._model, inputs);

    return instance;
  }

  _llmType() {
    return "llama_cpp";
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
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
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
        signal: options.signal,
        onToken: async (tokens: number[]) => {
          options.onToken?.(tokens);
          await runManager?.handleLLMNewToken(
            this._model.detokenize(tokens.map((num) => num as Token))
          );
        },
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
      if (typeof e === "object") {
        const error = e as Error;
        if (error.message === "AbortError") {
          throw error;
        }
      }
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
    const sequence = this._context.getSequence();

    const stream = await this.caller.call(async () =>
      sequence.evaluate(this._model.tokenize(prompt), promptOptions)
    );

    for await (const chunk of stream) {
      yield new ChatGenerationChunk({
        text: this._model.detokenize([chunk]),
        message: new AIMessageChunk({
          content: this._model.detokenize([chunk]),
        }),
        generationInfo: {},
      });
      await runManager?.handleLLMNewToken(
        this._model.detokenize([chunk]) ?? ""
      );
    }
  }

  // This constructs a new session if we need to adding in any sys messages or previous chats
  protected _buildSession(messages: BaseMessage[]): string {
    let prompt = "";
    let sysMessage = "";
    let noSystemMessages: BaseMessage[] = [];
    let interactions: ChatHistoryItem[] = [];

    // Let's see if we have a system message
    if (messages.findIndex((msg) => msg.getType() === "system") !== -1) {
      const sysMessages = messages.filter(
        (message) => message.getType() === "system"
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
        (message) => message.getType() !== "system"
      );
    } else {
      noSystemMessages = messages;
    }

    // Lets see if we just have a prompt left or are their previous interactions?
    if (noSystemMessages.length > 1) {
      // Is the last message a prompt?
      if (noSystemMessages[noSystemMessages.length - 1].getType() === "human") {
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
        contextSequence: this._context.getSequence(),
        systemPrompt: sysMessage,
      });
      this._session.setChatHistory(interactions);
    } else if (sysMessage !== "" && interactions.length === 0) {
      this._session = new LlamaChatSession({
        contextSequence: this._context.getSequence(),
        systemPrompt: sysMessage,
      });
    } else if (sysMessage === "" && interactions.length > 0) {
      this._session = new LlamaChatSession({
        contextSequence: this._context.getSequence(),
      });
      this._session.setChatHistory(interactions);
    } else {
      this._session = new LlamaChatSession({
        contextSequence: this._context.getSequence(),
      });
    }

    return prompt;
  }

  // This builds a an array of interactions
  protected _convertMessagesToInteractions(
    messages: BaseMessage[]
  ): ChatHistoryItem[] {
    const result: ChatHistoryItem[] = [];

    for (let i = 0; i < messages.length; i += 2) {
      if (i + 1 < messages.length) {
        const prompt = messages[i].content;
        const response = messages[i + 1].content;
        if (typeof prompt !== "string" || typeof response !== "string") {
          throw new Error(
            "ChatLlamaCpp does not support non-string message content."
          );
        }
        const llamaPrompt: ChatUserMessage = { type: "user", text: prompt };
        const llamaResponse: ChatModelResponse = {
          type: "model",
          response: [response],
        };
        result.push(llamaPrompt);
        result.push(llamaResponse);
      }
    }

    return result;
  }

  protected _buildPrompt(input: BaseMessage[]): string {
    const prompt = input
      .map((message) => {
        let messageText;
        if (message.getType() === "human") {
          messageText = `[INST] ${message.content} [/INST]`;
        } else if (message.getType() === "ai") {
          messageText = message.content;
        } else if (message.getType() === "system") {
          messageText = `<<SYS>> ${message.content} <</SYS>>`;
        } else if (ChatMessage.isInstance(message)) {
          messageText = `\n\n${message.role[0].toUpperCase()}${message.role.slice(
            1
          )}: ${message.content}`;
        } else {
          console.warn(
            `Unsupported message type passed to llama_cpp: "${message.getType()}"`
          );
          messageText = "";
        }
        return messageText;
      })
      .join("\n");

    return prompt;
  }
}
