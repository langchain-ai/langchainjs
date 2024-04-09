import {
  GenerativeModel,
  GoogleGenerativeAI as GenerativeAI,
} from "@google/generative-ai";
import type { SafetySetting } from "@google/generative-ai";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import {
  convertBaseMessagesToContent,
  convertResponseContentToChatGenerationChunk,
  mapGenerateContentResultToChatResult,
} from "./utils.js";

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

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
   * Alias for `model`
   *
   * Note: The format must follow the pattern - `{model}`
   */
  modelName?: string;
  /**
   * Model Name to use
   *
   * Note: The format must follow the pattern - `{model}`
   */
  model?: string;

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
  safetySettings?: SafetySetting[];

  /**
   * Google API key to use
   */
  apiKey?: string;

  /** Whether to stream the results or not */
  streaming?: boolean;
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
 * const res = await model.invoke(questions);
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

  model = "gemini-pro";

  temperature?: number; // default value chosen based on model

  maxOutputTokens?: number;

  topP?: number; // default value chosen based on model

  topK?: number; // default value chosen based on model

  stopSequences: string[] = [];

  safetySettings?: SafetySetting[];

  apiKey?: string;

  streaming = false;

  private client: GenerativeModel;

  get _isMultimodalModel() {
    return this.model.includes("vision");
  }

  constructor(fields?: GoogleGenerativeAIChatInput) {
    super(fields ?? {});

    this.modelName = fields?.model?.replace(/^models\//, "") ??
      fields?.modelName?.replace(/^models\//, "") ?? this.model;
    this.model = this.modelName;

    this.maxOutputTokens = fields?.maxOutputTokens ?? this.maxOutputTokens;

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

    if (this.topP && this.topP > 1) {
      throw new Error("`topP` must be below 1.");
    }

    this.topK = fields?.topK ?? this.topK;
    if (this.topK && this.topK < 0) {
      throw new Error("`topK` must be a positive integer");
    }

    this.stopSequences = fields?.stopSequences ?? this.stopSequences;

    this.apiKey = fields?.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    if (!this.apiKey) {
      throw new Error(
        "Please set an API key for Google GenerativeAI " +
          "in the environment variable GOOGLE_API_KEY " +
          "or in the `apiKey` field of the " +
          "ChatGoogleGenerativeAI constructor"
      );
    }

    this.safetySettings = fields?.safetySettings ?? this.safetySettings;
    if (this.safetySettings && this.safetySettings.length > 0) {
      const safetySettingsSet = new Set(
        this.safetySettings.map((s) => s.category)
      );
      if (safetySettingsSet.size !== this.safetySettings.length) {
        throw new Error(
          "The categories in `safetySettings` array must be unique"
        );
      }
    }

    this.streaming = fields?.streaming ?? this.streaming;

    this.client = new GenerativeAI(this.apiKey).getGenerativeModel({
      model: this.model,
      safetySettings: this.safetySettings as SafetySetting[],
      generationConfig: {
        candidateCount: 1,
        stopSequences: this.stopSequences,
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
        topP: this.topP,
        topK: this.topK,
      },
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
    const prompt = convertBaseMessagesToContent(
      messages,
      this._isMultimodalModel
    );

    // Handle streaming
    if (this.streaming) {
      const tokenUsage: TokenUsage = {};
      const stream = this._streamResponseChunks(messages, options, runManager);
      const finalChunks: Record<number, ChatGenerationChunk> = {};
      for await (const chunk of stream) {
        const index =
          (chunk.generationInfo as NewTokenIndices)?.completion ?? 0;
        if (finalChunks[index] === undefined) {
          finalChunks[index] = chunk;
        } else {
          finalChunks[index] = finalChunks[index].concat(chunk);
        }
      }
      const generations = Object.entries(finalChunks)
        .sort(([aKey], [bKey]) => parseInt(aKey, 10) - parseInt(bKey, 10))
        .map(([_, value]) => value);

      return { generations, llmOutput: { estimatedTokenUsage: tokenUsage } };
    }

    const res = await this.caller.callWithOptions(
      { signal: options?.signal },
      async () => {
        let output;
        try {
          output = await this.client.generateContent({
            contents: prompt,
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          // TODO: Improve error handling
          if (e.message?.includes("400 Bad Request")) {
            e.status = 400;
          }
          throw e;
        }
        return output;
      }
    );
    const generationResult = mapGenerateContentResultToChatResult(res.response);
    await runManager?.handleLLMNewToken(
      generationResult.generations[0].text ?? ""
    );
    return generationResult;
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const prompt = convertBaseMessagesToContent(
      messages,
      this._isMultimodalModel
    );
    const stream = await this.caller.callWithOptions(
      { signal: options?.signal },
      async () => {
        const { stream } = await this.client.generateContentStream({
          contents: prompt,
        });
        return stream;
      }
    );

    for await (const response of stream) {
      const chunk = convertResponseContentToChatGenerationChunk(response);
      if (!chunk) {
        continue;
      }

      yield chunk;
      await runManager?.handleLLMNewToken(chunk.text ?? "");
    }
  }
}
