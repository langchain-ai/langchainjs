import {
  GenerativeModel,
  GoogleGenerativeAI as GenerativeAI,
} from "@google/generative-ai";
import type {
  EnhancedGenerateContentResponse,
  HarmBlockThreshold,
  Content,
  HarmCategory,
  Part,
  SafetySetting,
} from "@google/generative-ai";
import { DiscussServiceClient } from "@google-ai/generativelanguage";
import type { protos } from "@google-ai/generativelanguage";
import { GoogleAuth } from "google-auth-library";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  MessageContent,
  isBaseMessage,
} from "@langchain/core/messages";
import {
  ChatGenerationChunk,
  ChatGeneration,
  ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";

export type { HarmCategory, HarmBlockThreshold, SafetySetting };

export type BaseMessageExamplePair = {
  input: BaseMessage;
  output: BaseMessage;
};

/**
 * An interface defining the input to the ChatGoogleGenerativeAI class.
 */
export interface GoogleGenerativeAIChatInput extends BaseChatModelParams {
  /**
   * Model Name to use
   *
   * Note: The format must follow the pattern - `{model}`
   */
  modelName?: string;

  /**
   * Controls the randomness of the output.
   *
   * Values can range from [0.0,1.0], inclusive. A value closer to 1.0
   * will produce responses that are more varied and creative, while
   * a value closer to 0.0 will typically result in less surprising
   * responses from the model.
   *
   * Note: The default value varies by model
   */
  temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  maxOutputTokens?: number;

  /**
   * Top-p changes how the model selects tokens for output.
   *
   * Tokens are selected from most probable to least until the sum
   * of their probabilities equals the top-p value.
   *
   * For example, if tokens A, B, and C have a probability of
   * .3, .2, and .1 and the top-p value is .5, then the model will
   * select either A or B as the next token (using temperature).
   *
   * Note: The default value varies by model
   */
  topP?: number;

  /**
   * Top-k changes how the model selects tokens for output.
   *
   * A top-k of 1 means the selected token is the most probable among
   * all tokens in the model’s vocabulary (also called greedy decoding),
   * while a top-k of 3 means that the next token is selected from
   * among the 3 most probable tokens (using temperature).
   *
   * Note: The default value varies by model
   */
  topK?: number;

  /**
   * Note: examples are not supported for Gemini models
   */
  examples?:
    | protos.google.ai.generativelanguage.v1beta2.IExample[]
    | BaseMessageExamplePair[];

  /**
   * The set of character sequences (up to 5) that will stop output generation.
   * If specified, the API will stop at the first appearance of a stop
   * sequence.
   *
   * Note: The stop sequence will not be included as part of the response.
   * Note: stopSequences is only supported for Gemini models
   */
  stopSequences?: string[];

  /**
   * A list of unique `SafetySetting` instances for blocking unsafe content. The API will block
   * any prompts and responses that fail to meet the thresholds set by these settings. If there
   * is no `SafetySetting` for a given `SafetyCategory` provided in the list, the API will use
   * the default safety setting for that category.
   */
  safetySettings?:
    | SafetySetting[]
    | protos.google.ai.generativelanguage.v1beta2.ISafetySetting[];

  /**
   * Google API key to use
   */
  apiKey?: string;
}

function getMessageAuthor(message: BaseMessage) {
  const type = message._getType();
  if (ChatMessage.isInstance(message)) {
    return message.role;
  }
  return message.name ?? type;
}

/**
 * Maps a message type to a Google Generative AI chat author.
 * @param message The message to map.
 * @param model The model to use for mapping.
 * @returns The message type mapped to a Google Generative AI chat author.
 */
export function convertAuthorToRole(author: string) {
  switch (author) {
    /**
     *  Note: Gemini currently is not supporting system messages
     *  we will convert them to human messages and merge with following
     * */
    case "ai":
      return "model";
    case "system":
    case "human":
      return "user";
    default:
      throw new Error(`Unknown / unsupported author: ${author}`);
  }
}

export function convertMessageContentToParts(
  content: MessageContent,
  isMultimodalModel: boolean
): Part[] {
  if (typeof content === "string") {
    return [{ text: content }];
  }

  return content.map((c) => {
    if (c.type === "text") {
      return {
        text: c.text,
      };
    }

    if (c.type === "image_url") {
      if (!isMultimodalModel) {
        throw new Error(`This model does not support images`);
      }
      if (typeof c.image_url !== "string") {
        throw new Error("Please provide image as base64 encoded data URL");
      }
      const [dm, data] = c.image_url.split(",");
      if (!dm.startsWith("data:")) {
        throw new Error("Please provide image as base64 encoded data URL");
      }

      const [mimeType, encoding] = dm.replace(/^data:/, "").split(";");
      if (encoding !== "base64") {
        throw new Error("Please provide image as base64 encoded data URL");
      }

      return {
        inlineData: {
          data,
          mimeType,
        },
      };
    }
    throw new Error(`Unknown content type ${(c as { type: string }).type}`);
  });
}

export function convertBaseMessagesToContent(
  messages: BaseMessage[],
  isMultimodalModel: boolean
) {
  return messages.reduce<{
    content: Content[];
    mergeWithPreviousContent: boolean;
  }>(
    (acc, message, index) => {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (!isBaseMessage(message)) {
        throw new Error("Unsupported message input");
      }
      const author = getMessageAuthor(message);
      if (author === "system" && index !== 0) {
        throw new Error("System message should be the first one");
      }
      const role = convertAuthorToRole(author);

      const prevContent = acc.content[acc.content.length];
      if (
        !acc.mergeWithPreviousContent &&
        prevContent &&
        prevContent.role === role
      ) {
        throw new Error(
          "Google Generative AI requires alternate messages between authors"
        );
      }

      const parts = convertMessageContentToParts(
        message.content,
        isMultimodalModel
      );

      if (acc.mergeWithPreviousContent) {
        const prevContent = acc.content[acc.content.length];
        if (!prevContent) {
          throw new Error("indexing error");
        }
        prevContent.parts.push(...parts);

        return {
          mergeWithPreviousContent: false,
          content: acc.content,
        };
      }
      const content: Content = {
        role,
        parts,
      };
      return {
        mergeWithPreviousContent: author === "system",
        content: [...acc.content, content],
      };
    },
    { content: [], mergeWithPreviousContent: false }
  ).content;
}

export function mapGenerateContentResultToChatResult(
  response: EnhancedGenerateContentResponse
): ChatResult {
  // if rejected or error, return empty generations with reason in filters
  if (
    !response.candidates ||
    response.candidates.length === 0 ||
    !response.candidates[0]
  ) {
    return {
      generations: [],
      llmOutput: {
        filters: response.promptFeedback,
      },
    };
  }

  const [message] = response.candidates;
  const text =
    message.content.parts
      .map((part) => part.text)
      .filter(Boolean)
      .flat(1)
      .join(" ") ?? "";

  const generation: ChatGeneration = {
    text: text,
    message: new AIMessage({
      content: text,
      name: message.content === null ? undefined : message.content.role,
      additional_kwargs: {
        citationSources: message.citationMetadata?.citationSources,
        filters: response.promptFeedback,
      },
    }),
  };

  return {
    generations: [generation],
  };
}

export function getPalmContextInstruction(
  messages: BaseMessage[]
): string | undefined {
  // get the first message and checks if it's a system 'system' messages
  const systemMessage =
    messages.length > 0 && getMessageAuthor(messages[0]) === "system"
      ? messages[0]
      : undefined;
  if (
    systemMessage?.content !== undefined &&
    typeof systemMessage.content !== "string"
  ) {
    throw new Error("Non-string system message content is not supported.");
  }
  return systemMessage?.content;
}

export function mapBaseMessagesToPalmMessages(
  messages: BaseMessage[]
): protos.google.ai.generativelanguage.v1beta2.IMessage[] {
  // remove all 'system' messages
  const nonSystemMessages = messages.filter(
    (m) => getMessageAuthor(m) !== "system"
  );

  // requires alternate human & ai messages. Throw error if two messages are consecutive
  nonSystemMessages.forEach((msg, index) => {
    if (index < 1) return;
    if (
      getMessageAuthor(msg) === getMessageAuthor(nonSystemMessages[index - 1])
    ) {
      throw new Error(
        `Google PaLM requires alternate messages between authors`
      );
    }
  });

  return nonSystemMessages.map((m) => {
    if (typeof m.content !== "string") {
      throw new Error(
        "ChatGooglePaLM does not support non-string message content."
      );
    }
    return {
      author: getMessageAuthor(m),
      content: m.content,
      citationMetadata: {
        citationSources: m.additional_kwargs.citationSources as
          | protos.google.ai.generativelanguage.v1beta2.ICitationSource[]
          | undefined,
      },
    };
  });
}

export function mapPalmMessagesToChatResult(
  msgRes: protos.google.ai.generativelanguage.v1beta2.IGenerateMessageResponse
): ChatResult {
  // if rejected or error, return empty generations with reason in filters
  if (
    !msgRes.candidates ||
    msgRes.candidates.length === 0 ||
    !msgRes.candidates[0]
  ) {
    return {
      generations: [],
      llmOutput: {
        filters: msgRes.filters,
      },
    };
  }

  const message = msgRes.candidates[0];
  return {
    generations: [
      {
        text: message.content ?? "",
        message: new AIMessage({
          content: message.content ?? "",
          name: message.author === null ? undefined : message.author,
          additional_kwargs: {
            citationSources: message.citationMetadata?.citationSources,
            filters: msgRes.filters, // content filters applied
          },
        }),
      },
    ],
  };
}

/**
 * A class that wraps the Google Palm chat model.
 * @example
 * ```typescript
 * const model = new ChatGoogleGenerativeAI({
 *   apiKey: "<YOUR API KEY>",
 *   temperature: 0.7,
 *   modelName: "gemini-pro",
 *   topK: 40,
 *   topP: 1,
 * });
 * const questions = [
 *   new HumanMessage({
 *     content: [
 *       {
 *         type: "text",
 *         text: "You are a funny assistant that answers in pirate language.",
 *       },
 *       {
 *         type: "text",
 *         text: "What is your favorite food?",
 *       },
 *     ]
 *   })
 * ];
 * const res = await model.call(questions);
 * console.log({ res });
 * ```
 */
export class ChatGoogleGenerativeAI
  extends BaseChatModel
  implements GoogleGenerativeAIChatInput
{
  static lc_name() {
    return "googlegenerativeai";
  }

  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "GOOGLE_API_KEY",
    };
  }

  modelName = "gemini-pro";

  temperature?: number; // default value chosen based on model

  maxOutputTokens?: number;

  topP?: number; // default value chosen based on model

  topK?: number; // default value chosen based on model

  examples: protos.google.ai.generativelanguage.v1beta2.IExample[] = [];

  stopSequences: string[] = [];

  safetySettings?:
    | SafetySetting[]
    | protos.google.ai.generativelanguage.v1beta2.ISafetySetting[];

  apiKey?: string;

  private client: GenerativeModel | DiscussServiceClient;

  get _isGenerateContentModel() {
    if (/^gemini/.test(this.modelName)) {
      return true;
    }
    return false;
  }

  get _isMultimodalModel() {
    return this._isGenerateContentModel && this.modelName.includes("vision");
  }

  constructor(fields?: GoogleGenerativeAIChatInput) {
    super(fields ?? {});

    this.modelName =
      fields?.modelName?.replace(/^models\//, "") ?? this.modelName;

    const isGenerateContentModel = this._isGenerateContentModel;

    this.maxOutputTokens = fields?.maxOutputTokens ?? this.maxOutputTokens;
    if (this.maxOutputTokens && !isGenerateContentModel) {
      throw new Error("`maxOutputTokens` only supported for Gemini models");
    }
    if (this.maxOutputTokens && this.maxOutputTokens < 0) {
      throw new Error("`maxOutputTokens` must be a positive integer");
    }

    this.temperature = fields?.temperature ?? this.temperature;
    if (this.temperature && (this.temperature < 0 || this.temperature > 1)) {
      throw new Error("`temperature` must be in the range of [0.0,1.0]");
    }

    this.topP = fields?.topP ?? this.topP;
    if (this.topP && this.topP < 0) {
      throw new Error("`topP` must be a positive integer");
    }

    this.topK = fields?.topK ?? this.topK;
    if (this.topK && this.topK < 0) {
      throw new Error("`topK` must be a positive integer");
    }

    if (fields?.examples && fields.examples.length > 0) {
      if (!isGenerateContentModel) {
        throw new Error("`examples` is not supported for Gemini models");
      }
    }
    this.examples =
      fields?.examples?.map((example) => {
        if (
          (isBaseMessage(example.input) &&
            typeof example.input.content !== "string") ||
          (isBaseMessage(example.output) &&
            typeof example.output.content !== "string")
        ) {
          throw new Error(
            "GooglePaLM example messages may only have string content."
          );
        }
        return {
          input: {
            ...example.input,
            content: example.input?.content as string,
          },
          output: {
            ...example.output,
            content: example.output?.content as string,
          },
        };
      }) ?? this.examples;

    this.apiKey = fields?.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    if (!this.apiKey) {
      throw new Error(
        "Please set an API key for Google GenerativeAI " +
          "in the environmentb variable GOOGLE_API_KEY " +
          "or in the `apiKey` field of the " +
          "ChatGoogleGenerativeAI constructor"
      );
    }

    this.client = isGenerateContentModel
      ? new GenerativeAI(this.apiKey).getGenerativeModel({
          model: this.modelName,
          safetySettings: this.safetySettings as SafetySetting[],
          generationConfig: {
            candidateCount: 1,
            stopSequences: this.stopSequences,
            maxOutputTokens: this.maxOutputTokens,
            temperature: this.temperature,
            topP: this.topP,
            topK: this.topK,
          },
        })
      : new DiscussServiceClient({
          authClient: new GoogleAuth().fromAPIKey(this.apiKey),
        });
  }

  _combineLLMOutput() {
    return [];
  }

  _llmType() {
    return "googlegenerativeai";
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this._isGenerateContentModel) {
      return this._generateContent(messages, options, runManager);
    }
    return this._generateMessage(messages, options, runManager);
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const stream = this._isGenerateContentModel
      ? this._generateContentStream(messages, options, runManager)
      : this._generateMessageStream(messages, options, runManager);

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  protected async _generateContent(
    input: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const prompt = convertBaseMessagesToContent(input, this._isMultimodalModel);
    const res = await this.caller.callWithOptions(
      { signal: options?.signal },
      async () => {
        const client = this.client as GenerativeModel;
        const output = await client.generateContent({
          contents: prompt,
        });
        return output;
      }
    );

    return mapGenerateContentResultToChatResult(res.response);
  }

  protected async *_generateContentStream(
    input: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const prompt = convertBaseMessagesToContent(input, this._isMultimodalModel);
    const stream = await this.caller.callWithOptions(
      { signal: options?.signal },
      async () => {
        const client = this.client as GenerativeModel;
        const { stream } = await client.generateContentStream({
          contents: prompt,
        });
        return stream;
      }
    );

    for await (const response of stream) {
      if (!response.candidates || response.candidates.length === 0) {
        continue;
      }

      const [candidate] = response.candidates;
      const { content, ...generationInfo } = candidate;
      const text = content.parts[0]?.text ?? "";

      yield new ChatGenerationChunk({
        text,
        message: new AIMessageChunk(text),
        generationInfo: {
          ...generationInfo,
        },
      });
    }
  }

  protected async _generateMessage(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const palmMessages = mapBaseMessagesToPalmMessages(messages);
    const context = getPalmContextInstruction(messages);
    const examples = this.examples;
    const result = await this.caller.callWithOptions(
      { signal: options.signal },
      async () => {
        const client = this.client as DiscussServiceClient;
        const [response] = await client.generateMessage({
          candidateCount: 1,
          model: this.modelName,
          temperature: this.temperature,
          topK: this.topK,
          topP: this.topP,
          prompt: {
            context,
            examples,
            messages: palmMessages,
          },
        });
        return response;
      }
    );
    const chatResult = mapPalmMessagesToChatResult(result);
    return chatResult;
  }

  protected async *_generateMessageStream(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const result = await this._generateMessage(messages, options, runManager);
    const [output] = result.generations;

    const chunk = output
      ? new ChatGenerationChunk({
          text: output.text,
          message: output.message.toChunk(),
          generationInfo: { finishReason: "stop" },
        })
      : new ChatGenerationChunk({
          text: "",
          message: new AIMessageChunk(""),
          generationInfo: {
            reason: result.llmOutput?.filters?.reason ?? "stop",
          },
        });

    yield chunk;
  }
}
