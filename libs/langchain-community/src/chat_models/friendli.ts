import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  BaseMessage,
  AIMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
  HumanMessageChunk,
  AIMessageChunk,
  SystemMessageChunk,
  ChatMessageChunk,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { convertEventStreamToIterableReadableDataStream } from "../utils/event_source_parse.js";

/**
 * Type representing the role of a message in the Friendli chat model.
 */
export type FriendliMessageRole = "system" | "assistant" | "user";

interface FriendliMessage {
  role: FriendliMessageRole;
  content: string;
}

function messageToFriendliRole(message: BaseMessage): FriendliMessageRole {
  const type = message._getType();
  switch (type) {
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "system":
      return "system";
    case "function":
      throw new Error("Function messages not supported");
    case "generic": {
      if (!ChatMessage.isInstance(message)) {
        throw new Error("Invalid generic chat message");
      }
      if (["system", "assistant", "user"].includes(message.role)) {
        return message.role as FriendliMessageRole;
      }
      throw new Error(`Unknown message type: ${type}`);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

function friendliResponseToChatMessage(message: FriendliMessage): BaseMessage {
  switch (message.role) {
    case "user":
      return new HumanMessage(message.content ?? "");
    case "assistant":
      return new AIMessage(message.content ?? "");
    case "system":
      return new SystemMessage(message.content ?? "");
    default:
      return new ChatMessage(message.content ?? "", message.role ?? "unknown");
  }
}

function _convertDeltaToMessageChunk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delta: Record<string, any>
) {
  const role = delta.role ?? "assistant";
  const content = delta.content ?? "";
  let additional_kwargs;

  if (delta.function_call) {
    additional_kwargs = {
      function_call: delta.function_call,
    };
  } else {
    additional_kwargs = {};
  }

  if (role === "user") {
    return new HumanMessageChunk({ content });
  } else if (role === "assistant") {
    return new AIMessageChunk({ content, additional_kwargs });
  } else if (role === "system") {
    return new SystemMessageChunk({ content });
  } else {
    return new ChatMessageChunk({ content, role });
  }
}

/**
 * The ChatFriendliParams interface defines the input parameters for
 * the ChatFriendli class.
 */
export interface ChatFriendliParams extends BaseChatModelParams {
  /**
   * Model name to use.
   */
  model?: string;
  /**
   * Base endpoint url.
   */
  baseUrl?: string;
  /**
   * Friendli personal access token to run as.
   */
  friendliToken?: string;
  /**
   * Friendli team ID to run as.
   */
  friendliTeam?: string;
  /**
   * Number between -2.0 and 2.0. Positive values penalizes tokens that have been
   * sampled, taking into account their frequency in the preceding text. This
   * penalization diminishes the model's tendency to reproduce identical lines
   * verbatim.
   */
  frequencyPenalty?: number;
  /**
   * Number between -2.0 and 2.0. Positive values penalizes tokens that have been
   * sampled at least once in the existing text.
   * presence_penalty: Optional[float] = None
   * The maximum number of tokens to generate. The length of your input tokens plus
   * `max_tokens` should not exceed the model's maximum length (e.g., 2048 for OpenAI
   * GPT-3)
   */
  maxTokens?: number;
  /**
   * When one of the stop phrases appears in the generation result, the API will stop
   * generation. The phrase is included in the generated result. If you are using
   * beam search, all of the active beams should contain the stop phrase to terminate
   * generation. Before checking whether a stop phrase is included in the result, the
   * phrase is converted into tokens.
   */
  stop?: string[];
  /**
   * Sampling temperature. Smaller temperature makes the generation result closer to
   * greedy, argmax (i.e., `top_k = 1`) sampling. If it is `None`, then 1.0 is used.
   */
  temperature?: number;
  /**
   * Tokens comprising the top `top_p` probability mass are kept for sampling. Numbers
   * between 0.0 (exclusive) and 1.0 (inclusive) are allowed. If it is `None`, then 1.0
   * is used by default.
   */
  topP?: number;
  /**
   * Additional kwargs to pass to the model.
   */
  modelKwargs?: Record<string, unknown>;
}

/**
 * The ChatFriendli class is used to interact with Friendli inference Endpoint models.
 * This requires your Friendli Token and Friendli Team which is autoloaded if not specified.
 */
export class ChatFriendli extends BaseChatModel<BaseChatModelCallOptions> {
  lc_serializable = true;

  static lc_name() {
    return "Friendli";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      friendliToken: "FRIENDLI_TOKEN",
      friendliTeam: "FRIENDLI_TEAM",
    };
  }

  model = "meta-llama-3-8b-instruct";

  baseUrl = "https://inference.friendli.ai";

  friendliToken?: string;

  friendliTeam?: string;

  frequencyPenalty?: number;

  maxTokens?: number;

  stop?: string[];

  temperature?: number;

  topP?: number;

  modelKwargs?: Record<string, unknown>;

  constructor(fields: ChatFriendliParams) {
    super(fields);

    this.model = fields?.model ?? this.model;
    this.baseUrl = fields?.baseUrl ?? this.baseUrl;
    this.friendliToken =
      fields?.friendliToken ?? getEnvironmentVariable("FRIENDLI_TOKEN");
    this.friendliTeam =
      fields?.friendliTeam ?? getEnvironmentVariable("FRIENDLI_TEAM");
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.stop = fields?.stop ?? this.stop;
    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.modelKwargs = fields?.modelKwargs ?? {};

    if (!this.friendliToken) {
      throw new Error("Missing Friendli Token");
    }
  }

  _llmType() {
    return "friendli";
  }

  private constructHeaders(stream: boolean) {
    return {
      "Content-Type": "application/json",
      Accept: stream ? "text/event-stream" : "application/json",
      Authorization: `Bearer ${this.friendliToken}`,
      "X-Friendli-Team": this.friendliTeam ?? "",
    };
  }

  private constructBody(
    messages: BaseMessage[],
    stream: boolean,
    _options?: this["ParsedCallOptions"]
  ) {
    const messageList = messages.map((message) => {
      if (typeof message.content !== "string") {
        throw new Error(
          "Friendli does not support non-string message content."
        );
      }
      return {
        role: messageToFriendliRole(message),
        content: message.content,
      };
    });

    const body = JSON.stringify({
      messages: messageList,
      stream,
      model: this.model,
      max_tokens: this.maxTokens,
      frequency_penalty: this.frequencyPenalty,
      stop: this.stop,
      temperature: this.temperature,
      top_p: this.topP,
      ...this.modelKwargs,
    });
    return body;
  }

  /**
   * Calls the Friendli endpoint and retrieves the result.
   * @param {BaseMessage[]} messages The input messages.
   * @returns {Promise<ChatResult>} A promise that resolves to the generated chat result.
   */
  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    interface ChatFriendliResponse {
      choices: {
        index: number;
        message: {
          role: FriendliMessageRole;
          content: string;
        };
        finish_reason: string;
      }[];
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
      created: number;
    }

    const response = (await this.caller.call(async () =>
      fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: this.constructHeaders(false),
        body: this.constructBody(messages, false, _options),
      }).then((res) => res.json())
    )) as ChatFriendliResponse;

    const generations: ChatGeneration[] = [];
    for (const data of response.choices ?? []) {
      const text = data.message?.content ?? "";
      const generation: ChatGeneration = {
        text,
        message: friendliResponseToChatMessage(data.message ?? {}),
      };
      if (data.finish_reason) {
        generation.generationInfo = { finish_reason: data.finish_reason };
      }
      generations.push(generation);
    }

    return { generations };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    interface ChatFriendliResponse {
      choices: {
        index: number;
        delta: {
          role?: FriendliMessageRole;
          content?: string;
        };
        finish_reason: string | null;
      }[];
      created: number;
    }

    const response = await this.caller.call(async () =>
      fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: this.constructHeaders(true),
        body: this.constructBody(messages, true, _options),
      })
    );

    if (response.status !== 200 || !response.body) {
      const errorResponse = await response.json();
      throw new Error(JSON.stringify(errorResponse));
    }

    const stream = convertEventStreamToIterableReadableDataStream(
      response.body
    );

    for await (const chunk of stream) {
      if (chunk === "[DONE]") break;

      const parsedChunk = JSON.parse(chunk) as ChatFriendliResponse;

      if (parsedChunk.choices[0].finish_reason === null) {
        const generationChunk = new ChatGenerationChunk({
          message: _convertDeltaToMessageChunk(parsedChunk.choices[0].delta),
          text: parsedChunk.choices[0].delta.content ?? "",
          generationInfo: {
            finishReason: parsedChunk.choices[0].finish_reason,
          },
        });

        yield generationChunk;

        void runManager?.handleLLMNewToken(generationChunk.text ?? "");
      }
    }
  }
}
