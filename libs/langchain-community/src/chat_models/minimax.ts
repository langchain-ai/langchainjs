import type { OpenAIClient } from "@langchain/openai";

import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
} from "@langchain/core/messages";
import { ChatResult, ChatGeneration } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { StructuredTool } from "@langchain/core/tools";
import { BaseFunctionCallOptions } from "@langchain/core/language_models/base";
import { formatToOpenAIFunction } from "@langchain/openai";

/**
 * Type representing the sender_type of a message in the Minimax chat model.
 */
export type MinimaxMessageRole = "BOT" | "USER" | "FUNCTION";

/**
 * Interface representing a message in the Minimax chat model.
 */
interface MinimaxChatCompletionRequestMessage {
  sender_type: MinimaxMessageRole;
  sender_name?: string;
  text: string;
}

/**
 * Interface representing a request for a chat completion.
 */
interface MinimaxChatCompletionRequest {
  model: string;
  messages: MinimaxChatCompletionRequestMessage[];
  stream?: boolean;
  prompt?: string;
  temperature?: number;
  top_p?: number;
  tokens_to_generate?: number;
  skip_info_mask?: boolean;
  mask_sensitive_info?: boolean;
  beam_width?: number;
  use_standard_sse?: boolean;
  role_meta?: RoleMeta;
  bot_setting?: BotSetting[];
  reply_constraints?: ReplyConstraints;
  sample_messages?: MinimaxChatCompletionRequestMessage[];
  /**
   * A list of functions the model may generate JSON inputs for.
   * @type {Array<OpenAIClient.Chat.ChatCompletionCreateParams.Function[]>}
   */
  functions?: OpenAIClient.Chat.ChatCompletionCreateParams.Function[];
  plugins?: string[];
}

interface RoleMeta {
  role_meta: string;
  bot_name: string;
}

interface RawGlyph {
  type: "raw";
  raw_glyph: string;
}

interface JsonGlyph {
  type: "json_value";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json_properties: any;
}

type ReplyConstraintsGlyph = RawGlyph | JsonGlyph;

interface ReplyConstraints {
  sender_type: string;
  sender_name: string;
  glyph?: ReplyConstraintsGlyph;
}

interface BotSetting {
  content: string;
  bot_name: string;
}

export declare interface ConfigurationParameters {
  basePath?: string;
  headers?: Record<string, string>;
}

/**
 * Interface defining the input to the ChatMinimax class.
 */
declare interface MinimaxChatInputBase {
  /** Model name to use
   * @default "abab5.5-chat"
   */
  modelName: string;

  /** Whether to stream the results or not. Defaults to false. */
  streaming?: boolean;

  prefixMessages?: MinimaxChatCompletionRequestMessage[];

  /**
   * API key to use when making requests. Defaults to the value of
   * `MINIMAX_GROUP_ID` environment variable.
   */
  minimaxGroupId?: string;

  /**
   * Secret key to use when making requests. Defaults to the value of
   * `MINIMAX_API_KEY` environment variable.
   */
  minimaxApiKey?: string;

  /** Amount of randomness injected into the response. Ranges
   * from 0 to 1 (0 is not included). Use temp closer to 0 for analytical /
   * multiple choice, and temp closer to 1 for creative
   * and generative tasks. Defaults to 0.95.
   */
  temperature?: number;

  /**
   *  The smaller the sampling method, the more determinate the result;
   *  the larger the number, the more random the result.
   */
  topP?: number;

  /**
   * Enable Chatcompletion pro
   */
  proVersion?: boolean;

  /**
   *  Pay attention to the maximum number of tokens generated,
   *  this parameter does not affect the generation effect of the model itself,
   *  but only realizes the function by truncating the tokens exceeding the limit.
   *  It is necessary to ensure that the number of tokens of the input context plus this value is less than 6144 or 16384,
   *  otherwise the request will fail.
   */
  tokensToGenerate?: number;
}

declare interface MinimaxChatInputNormal {
  /**
   *  Dialogue setting, characters, or functionality setting.
   */
  prompt?: string;
  /**
   *  Sensitize text information in the output that may involve privacy issues,
   *  currently including but not limited to emails, domain names,
   *  links, ID numbers, home addresses, etc. Default false, ie. enable sensitization.
   */
  skipInfoMask?: boolean;

  /**
   *  Whether to use the standard SSE format, when set to true,
   *  the streaming results will be separated by two line breaks.
   *  This parameter only takes effect when stream is set to true.
   */
  useStandardSse?: boolean;

  /**
   *  If it is true, this indicates that the current request is set to continuation mode,
   *  and the response is a continuation of the last sentence in the incoming messages;
   *  at this time, the last sender is not limited to USER, it can also be BOT.
   *  Assuming the last sentence of incoming messages is {"sender_type": " U S E R", "text": "天生我材"},
   *  the completion of the reply may be "It must be useful."
   */
  continueLastMessage?: boolean;

  /**
   *  How many results to generate; the default is 1 and the maximum is not more than 4.
   *  Because beamWidth generates multiple results, it will consume more tokens.
   */
  beamWidth?: number;

  /**
   * Dialogue Metadata
   */
  roleMeta?: RoleMeta;
}

declare interface MinimaxChatInputPro extends MinimaxChatInputBase {
  /**
   *  For the text information in the output that may involve privacy issues,
   *  code masking is currently included but not limited to emails, domains, links, ID numbers, home addresses, etc.,
   *  with the default being true, that is, code masking is enabled.
   */
  maskSensitiveInfo?: boolean;

  /**
   *  Default bot name
   */
  defaultBotName?: string;

  /**
   *  Default user name
   */
  defaultUserName?: string;

  /**
   *  Setting for each robot, only available for pro version.
   */
  botSetting?: BotSetting[];

  replyConstraints?: ReplyConstraints;
}

type MinimaxChatInput = MinimaxChatInputNormal & MinimaxChatInputPro;

/**
 * Function that extracts the custom sender_type of a generic chat message.
 * @param message Chat message from which to extract the custom sender_type.
 * @returns The custom sender_type of the chat message.
 */
function extractGenericMessageCustomRole(message: ChatMessage) {
  if (message.role !== "ai" && message.role !== "user") {
    console.warn(`Unknown message role: ${message.role}`);
  }
  if (message.role === "ai") {
    return "BOT" as MinimaxMessageRole;
  }
  if (message.role === "user") {
    return "USER" as MinimaxMessageRole;
  }
  return message.role as MinimaxMessageRole;
}

/**
 * Function that converts a base message to a Minimax message sender_type.
 * @param message Base message to convert.
 * @returns The Minimax message sender_type.
 */
function messageToMinimaxRole(message: BaseMessage): MinimaxMessageRole {
  const type = message._getType();
  switch (type) {
    case "ai":
      return "BOT";
    case "human":
      return "USER";
    case "system":
      throw new Error("System messages not supported");
    case "function":
      return "FUNCTION";
    case "generic": {
      if (!ChatMessage.isInstance(message))
        throw new Error("Invalid generic chat message");
      return extractGenericMessageCustomRole(message);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

export interface ChatMinimaxCallOptions extends BaseFunctionCallOptions {
  tools?: StructuredTool[];
  defaultUserName?: string;
  defaultBotName?: string;
  plugins?: string[];
  botSetting?: BotSetting[];
  replyConstraints?: ReplyConstraints;
  sampleMessages?: BaseMessage[];
}

/**
 * Wrapper around Minimax large language models that use the Chat endpoint.
 *
 * To use you should have the `MINIMAX_GROUP_ID` and `MINIMAX_API_KEY`
 * environment variable set.
 * @example
 * ```typescript
 * // Define a chat prompt with a system message setting the context for translation
 * const chatPrompt = ChatPromptTemplate.fromMessages([
 *   SystemMessagePromptTemplate.fromTemplate(
 *     "You are a helpful assistant that translates {input_language} to {output_language}.",
 *   ),
 *   HumanMessagePromptTemplate.fromTemplate("{text}"),
 * ]);
 *
 * // Create a new LLMChain with the chat model and the defined prompt
 * const chainB = new LLMChain({
 *   prompt: chatPrompt,
 *   llm: new ChatMinimax({ temperature: 0.01 }),
 * });
 *
 * // Call the chain with the input language, output language, and the text to translate
 * const resB = await chainB.call({
 *   input_language: "English",
 *   output_language: "Chinese",
 *   text: "I love programming.",
 * });
 *
 * // Log the result
 * console.log({ resB });
 *
 * ```
 */
export class ChatMinimax
  extends BaseChatModel<ChatMinimaxCallOptions>
  implements MinimaxChatInput
{
  static lc_name() {
    return "ChatMinimax";
  }

  get callKeys(): (keyof ChatMinimaxCallOptions)[] {
    return [
      ...(super.callKeys as (keyof ChatMinimaxCallOptions)[]),
      "functions",
      "tools",
      "defaultBotName",
      "defaultUserName",
      "plugins",
      "replyConstraints",
      "botSetting",
      "sampleMessages",
    ];
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      minimaxApiKey: "MINIMAX_API_KEY",
      minimaxGroupId: "MINIMAX_GROUP_ID",
    };
  }

  lc_serializable = true;

  minimaxGroupId?: string;

  minimaxApiKey?: string;

  streaming = false;

  prompt?: string;

  modelName = "abab5.5-chat";

  defaultBotName?: string = "Assistant";

  defaultUserName?: string = "I";

  prefixMessages?: MinimaxChatCompletionRequestMessage[];

  apiUrl: string;

  basePath?: string = "https://api.minimax.chat/v1";

  headers?: Record<string, string>;

  temperature?: number = 0.9;

  topP?: number = 0.8;

  tokensToGenerate?: number;

  skipInfoMask?: boolean;

  proVersion?: boolean = true;

  beamWidth?: number;

  botSetting?: BotSetting[];

  continueLastMessage?: boolean;

  maskSensitiveInfo?: boolean;

  roleMeta?: RoleMeta;

  useStandardSse?: boolean;

  replyConstraints?: ReplyConstraints;

  constructor(
    fields?: Partial<MinimaxChatInput> &
      BaseChatModelParams & {
        configuration?: ConfigurationParameters;
      }
  ) {
    super(fields ?? {});

    this.minimaxGroupId =
      fields?.minimaxGroupId ?? getEnvironmentVariable("MINIMAX_GROUP_ID");
    if (!this.minimaxGroupId) {
      throw new Error("Minimax GroupID not found");
    }

    this.minimaxApiKey =
      fields?.minimaxApiKey ?? getEnvironmentVariable("MINIMAX_API_KEY");

    if (!this.minimaxApiKey) {
      throw new Error("Minimax ApiKey not found");
    }

    this.streaming = fields?.streaming ?? this.streaming;
    this.prompt = fields?.prompt ?? this.prompt;
    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.skipInfoMask = fields?.skipInfoMask ?? this.skipInfoMask;
    this.prefixMessages = fields?.prefixMessages ?? this.prefixMessages;
    this.maskSensitiveInfo =
      fields?.maskSensitiveInfo ?? this.maskSensitiveInfo;
    this.beamWidth = fields?.beamWidth ?? this.beamWidth;
    this.continueLastMessage =
      fields?.continueLastMessage ?? this.continueLastMessage;
    this.tokensToGenerate = fields?.tokensToGenerate ?? this.tokensToGenerate;
    this.roleMeta = fields?.roleMeta ?? this.roleMeta;
    this.botSetting = fields?.botSetting ?? this.botSetting;
    this.useStandardSse = fields?.useStandardSse ?? this.useStandardSse;
    this.replyConstraints = fields?.replyConstraints ?? this.replyConstraints;
    this.defaultBotName = fields?.defaultBotName ?? this.defaultBotName;

    this.modelName = fields?.modelName ?? this.modelName;
    this.basePath = fields?.configuration?.basePath ?? this.basePath;
    this.headers = fields?.configuration?.headers ?? this.headers;
    this.proVersion = fields?.proVersion ?? this.proVersion;

    const modelCompletion = this.proVersion
      ? "chatcompletion_pro"
      : "chatcompletion";
    this.apiUrl = `${this.basePath}/text/${modelCompletion}`;
  }

  fallbackBotName(options?: this["ParsedCallOptions"]) {
    let botName = options?.defaultBotName ?? this.defaultBotName ?? "Assistant";
    if (this.botSetting) {
      botName = this.botSetting[0].bot_name;
    }
    return botName;
  }

  defaultReplyConstraints(options?: this["ParsedCallOptions"]) {
    const constraints = options?.replyConstraints ?? this.replyConstraints;
    if (!constraints) {
      let botName =
        options?.defaultBotName ?? this.defaultBotName ?? "Assistant";
      if (this.botSetting) {
        botName = this.botSetting[0].bot_name;
      }

      return {
        sender_type: "BOT",
        sender_name: botName,
      };
    }
    return constraints;
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<MinimaxChatCompletionRequest, "messages"> {
    return {
      model: this.modelName,
      stream: this.streaming,
      prompt: this.prompt,
      temperature: this.temperature,
      top_p: this.topP,
      tokens_to_generate: this.tokensToGenerate,
      skip_info_mask: this.skipInfoMask,
      mask_sensitive_info: this.maskSensitiveInfo,
      beam_width: this.beamWidth,
      use_standard_sse: this.useStandardSse,
      role_meta: this.roleMeta,
      bot_setting: options?.botSetting ?? this.botSetting,
      reply_constraints: this.defaultReplyConstraints(options),
      sample_messages: this.messageToMinimaxMessage(
        options?.sampleMessages,
        options
      ),
      functions:
        options?.functions ??
        (options?.tools
          ? options?.tools.map(formatToOpenAIFunction)
          : undefined),
      plugins: options?.plugins,
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return {
      ...this.invocationParams(),
    };
  }

  /**
   * Convert a list of messages to the format expected by the model.
   * @param messages
   * @param options
   */
  messageToMinimaxMessage(
    messages?: BaseMessage[],
    options?: this["ParsedCallOptions"]
  ): MinimaxChatCompletionRequestMessage[] | undefined {
    return messages
      ?.filter((message) => {
        if (ChatMessage.isInstance(message)) {
          return message.role !== "system";
        }
        return message._getType() !== "system";
      })
      ?.map((message) => {
        const sender_type = messageToMinimaxRole(message);
        if (typeof message.content !== "string") {
          throw new Error(
            "ChatMinimax does not support non-string message content."
          );
        }
        return {
          sender_type,
          text: message.content,
          sender_name:
            message.name ??
            (sender_type === "BOT"
              ? this.fallbackBotName()
              : options?.defaultUserName ?? this.defaultUserName),
        };
      });
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage = { totalTokens: 0 };
    this.botSettingFallback(options, messages);

    const params = this.invocationParams(options);
    const messagesMapped: MinimaxChatCompletionRequestMessage[] = [
      ...(this.messageToMinimaxMessage(messages, options) ?? []),
      ...(this.prefixMessages ?? []),
    ];

    const data = params.stream
      ? await new Promise<ChatCompletionResponse>((resolve, reject) => {
          let response: ChatCompletionResponse;
          let rejected = false;
          let resolved = false;
          this.completionWithRetry(
            {
              ...params,
              messages: messagesMapped,
            },
            true,
            options?.signal,
            (event) => {
              const data = JSON.parse(event.data);

              if (data?.error_code) {
                if (rejected) {
                  return;
                }
                rejected = true;
                reject(data);
                return;
              }

              const message = data as ChatCompletionResponse;
              // on the first message set the response properties

              if (!message.choices[0].finish_reason) {
                // the last stream message
                let streamText;
                if (this.proVersion) {
                  const messages = message.choices[0].messages ?? [];
                  streamText = messages[0].text;
                } else {
                  streamText = message.choices[0].delta;
                }

                // TODO this should pass part.index to the callback
                // when that's supported there
                // eslint-disable-next-line no-void
                void runManager?.handleLLMNewToken(streamText ?? "");
                return;
              }

              response = message;
              if (!this.proVersion) {
                response.choices[0].text = message.reply;
              }

              if (resolved || rejected) {
                return;
              }
              resolved = true;
              resolve(response);
            }
          ).catch((error) => {
            if (!rejected) {
              rejected = true;
              reject(error);
            }
          });
        })
      : await this.completionWithRetry(
          {
            ...params,
            messages: messagesMapped,
          },
          false,
          options?.signal
        );

    const { total_tokens: totalTokens } = data.usage ?? {};

    if (totalTokens) {
      tokenUsage.totalTokens = totalTokens;
    }

    if (data.base_resp?.status_code !== 0) {
      throw new Error(`Minimax API error: ${data.base_resp?.status_msg}`);
    }
    const generations: ChatGeneration[] = [];

    if (this.proVersion) {
      for (const choice of data.choices) {
        const messages = choice.messages ?? [];
        // 取最后一条消息
        if (messages) {
          const message = messages[messages.length - 1];
          const text = message?.text ?? "";
          generations.push({
            text,
            message: minimaxResponseToChatMessage(message),
          });
        }
      }
    } else {
      for (const choice of data.choices) {
        const text = choice?.text ?? "";
        generations.push({
          text,
          message: minimaxResponseToChatMessage({
            sender_type: "BOT",
            sender_name:
              options?.defaultBotName ?? this.defaultBotName ?? "Assistant",
            text,
          }),
        });
      }
    }
    return {
      generations,
      llmOutput: { tokenUsage },
    };
  }

  /** @ignore */
  async completionWithRetry(
    request: MinimaxChatCompletionRequest,
    stream: boolean,
    signal?: AbortSignal,
    onmessage?: (event: MessageEvent) => void
  ) {
    // The first run will get the accessToken
    const makeCompletionRequest = async () => {
      const url = `${this.apiUrl}?GroupId=${this.minimaxGroupId}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.minimaxApiKey}`,
          ...this.headers,
        },
        body: JSON.stringify(request),
        signal,
      });

      if (!stream) {
        const json = await response.json();
        return json as ChatCompletionResponse;
      } else {
        if (response.body) {
          const reader = response.body.getReader();

          const decoder = new TextDecoder("utf-8");
          let data = "";

          let continueReading = true;
          while (continueReading) {
            const { done, value } = await reader.read();
            if (done) {
              continueReading = false;
              break;
            }
            data += decoder.decode(value);

            let continueProcessing = true;
            while (continueProcessing) {
              const newlineIndex = data.indexOf("\n");
              if (newlineIndex === -1) {
                continueProcessing = false;
                break;
              }
              const line = data.slice(0, newlineIndex);
              data = data.slice(newlineIndex + 1);

              if (line.startsWith("data:")) {
                const event = new MessageEvent("message", {
                  data: line.slice("data:".length).trim(),
                });
                onmessage?.(event);
              }
            }
          }
          return {} as ChatCompletionResponse;
        }
        return {} as ChatCompletionResponse;
      }
    };
    return this.caller.call(makeCompletionRequest);
  }

  _llmType() {
    return "minimax";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }

  private botSettingFallback(
    options?: this["ParsedCallOptions"],
    messages?: BaseMessage[]
  ) {
    const botSettings = options?.botSetting ?? this.botSetting;
    if (!botSettings) {
      const systemMessages = messages?.filter((message) => {
        if (ChatMessage.isInstance(message)) {
          return message.role === "system";
        }
        return message._getType() === "system";
      });

      // get the last system message
      if (!systemMessages?.length) {
        return;
      }
      const lastSystemMessage = systemMessages[systemMessages.length - 1];

      if (typeof lastSystemMessage.content !== "string") {
        throw new Error(
          "ChatMinimax does not support non-string message content."
        );
      }

      //  setting the default botSetting.
      this.botSetting = [
        {
          content: lastSystemMessage.content,
          bot_name:
            options?.defaultBotName ?? this.defaultBotName ?? "Assistant",
        },
      ];
    }
  }
}

function minimaxResponseToChatMessage(
  message: ChatCompletionResponseMessage
): BaseMessage {
  switch (message.sender_type) {
    case "USER":
      return new HumanMessage(message.text || "");
    case "BOT":
      return new AIMessage(message.text || "", {
        function_call: message.function_call,
      });
    case "FUNCTION":
      return new AIMessage(message.text || "");
    default:
      return new ChatMessage(
        message.text || "",
        message.sender_type ?? "unknown"
      );
  }
}

/** ---Response Model---* */
/**
 * Interface representing a message responsed in the Minimax chat model.
 */
interface ChatCompletionResponseMessage {
  sender_type: MinimaxMessageRole;
  sender_name?: string;
  text: string;
  function_call?: ChatCompletionResponseMessageFunctionCall;
}

/**
 * Interface representing the usage of tokens in a chat completion.
 */
interface TokenUsage {
  total_tokens?: number;
}

interface BaseResp {
  status_code?: number;
  status_msg?: string;
}

/**
 * The name and arguments of a function that should be called, as generated by the model.
 * @export
 * @interface ChatCompletionResponseMessageFunctionCall
 */
export interface ChatCompletionResponseMessageFunctionCall {
  /**
   * The name of the function to call.
   * @type {string}
   * @memberof ChatCompletionResponseMessageFunctionCall
   */
  name?: string;
  /**
   * The arguments to call the function with, as generated by the model in JSON format. Note that the model does not always generate valid JSON, and may hallucinate parameters not defined by your function schema. Validate the arguments in your code before calling your function.
   * @type {string}
   * @memberof ChatCompletionResponseMessageFunctionCall
   */
  arguments?: string;
}

/**
 *
 * @export
 * @interface ChatCompletionResponseChoices
 */
export interface ChatCompletionResponseChoicesPro {
  /**
   *
   * @type {string}
   * @memberof ChatCompletionResponseChoices
   */
  messages?: ChatCompletionResponseMessage[];

  /**
   *
   * @type {string}
   * @memberof ChatCompletionResponseChoices
   */
  finish_reason?: string;
}

interface ChatCompletionResponseChoices {
  delta?: string;
  text?: string;
  index?: number;
  finish_reason?: string;
}

/**
 * Interface representing a response from a chat completion.
 */
interface ChatCompletionResponse {
  model: string;
  created: number;
  reply: string;
  input_sensitive?: boolean;
  input_sensitive_type?: number;
  output_sensitive?: boolean;
  output_sensitive_type?: number;
  usage?: TokenUsage;
  base_resp?: BaseResp;
  choices: Array<
    ChatCompletionResponseChoicesPro & ChatCompletionResponseChoices
  >;
}
