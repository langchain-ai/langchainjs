import {
  GenerativeModel,
  GoogleGenerativeAI as GenerativeAI,
  FunctionDeclarationsTool as GoogleGenerativeAIFunctionDeclarationsTool,
  FunctionDeclaration as GenerativeAIFunctionDeclaration,
  type FunctionDeclarationSchema as GenerativeAIFunctionDeclarationSchema,
  GenerateContentRequest,
  SafetySetting,
  Part as GenerativeAIPart,
  EnhancedGenerateContentResponse,
} from "@google/generative-ai";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessageChunk,
  BaseMessage,
  UsageMetadata,
} from "@langchain/core/messages";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseChatModel,
  LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import {
  BaseLanguageModelCallOptions,
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import { StructuredToolInterface } from "@langchain/core/tools";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import type { z } from "zod";
import { isZodSchema } from "@langchain/core/utils/types";
import { BaseLLMOutputParser } from "@langchain/core/output_parsers";
import { zodToGenerativeAIParameters } from "./utils/zod_to_genai_parameters.js";
import {
  convertBaseMessagesToContent,
  convertResponseContentToChatGenerationChunk,
  convertToGenerativeAITools,
  mapGenerateContentResultToChatResult,
} from "./utils/common.js";
import { GoogleGenerativeAIToolsOutputParser } from "./output_parsers.js";

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

export type BaseMessageExamplePair = {
  input: BaseMessage;
  output: BaseMessage;
};

export interface GoogleGenerativeAIChatCallOptions
  extends BaseLanguageModelCallOptions {
  tools?:
    | StructuredToolInterface[]
    | GoogleGenerativeAIFunctionDeclarationsTool[];
  /**
   * Whether or not to include usage data, like token counts
   * in the response. If set to true, this will invoke two
   * additional API calls to fetch token counts after the model
   * has responded. If streaming is enabled, this will append an
   * additional chunk containing the token usage at the end of
   * the stream.
   * @default false
   */
  streamUsage?: boolean;
}

/**
 * An interface defining the input to the ChatGoogleGenerativeAI class.
 */
export interface GoogleGenerativeAIChatInput
  extends BaseChatModelParams,
    Pick<GoogleGenerativeAIChatCallOptions, "streamUsage"> {
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

  /**
   * Google API version to use
   */
  apiVersion?: string;

  /**
   * Google API base URL to use
   */
  baseUrl?: string;

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
  extends BaseChatModel<GoogleGenerativeAIChatCallOptions, AIMessageChunk>
  implements GoogleGenerativeAIChatInput
{
  static lc_name() {
    return "ChatGoogleGenerativeAI";
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

  streamUsage = false;

  private client: GenerativeModel;

  get _isMultimodalModel() {
    return this.model.includes("vision") || this.model.startsWith("gemini-1.5");
  }

  constructor(fields?: GoogleGenerativeAIChatInput) {
    super(fields ?? {});

    this.modelName =
      fields?.model?.replace(/^models\//, "") ??
      fields?.modelName?.replace(/^models\//, "") ??
      this.model;
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

    this.client = new GenerativeAI(this.apiKey).getGenerativeModel(
      {
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
      },
      {
        apiVersion: fields?.apiVersion,
        baseUrl: fields?.baseUrl,
      }
    );
    this.streamUsage = fields?.streamUsage ?? this.streamUsage;
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    return {
      ls_provider: "google_genai",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: this.client.generationConfig.temperature,
      ls_max_tokens: this.client.generationConfig.maxOutputTokens,
      ls_stop: options.stop,
    };
  }

  _combineLLMOutput() {
    return [];
  }

  _llmType() {
    return "googlegenerativeai";
  }

  override bindTools(
    tools: (StructuredToolInterface | Record<string, unknown>)[],
    kwargs?: Partial<GoogleGenerativeAIChatCallOptions>
  ): Runnable<
    BaseLanguageModelInput,
    AIMessageChunk,
    GoogleGenerativeAIChatCallOptions
  > {
    return this.bind({ tools: convertToGenerativeAITools(tools), ...kwargs });
  }

  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<GenerateContentRequest, "contents"> {
    const tools = options?.tools as
      | GoogleGenerativeAIFunctionDeclarationsTool[]
      | StructuredToolInterface[]
      | undefined;
    if (
      Array.isArray(tools) &&
      !tools.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (t: any) => !("lc_namespace" in t)
      )
    ) {
      // Tools are in StructuredToolInterface format. Convert to GenAI format
      return {
        tools: convertToGenerativeAITools(
          options?.tools as StructuredToolInterface[]
        ),
      };
    }
    return {
      tools: options?.tools as
        | GoogleGenerativeAIFunctionDeclarationsTool[]
        | undefined,
    };
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
    const parameters = this.invocationParams(options);

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

    const request = {
      ...parameters,
      contents: prompt,
    };
    const res = await this.completionWithRetry(request);
    let usageMetadata: UsageMetadata | undefined;
    if (this.streamUsage || options.streamUsage) {
      usageMetadata = await this.getTokenCount({
        input: request,
        output: res.response,
      });
    }
    const generationResult = mapGenerateContentResultToChatResult(
      res.response,
      {
        usageMetadata,
      }
    );
    await runManager?.handleLLMNewToken(
      generationResult.generations[0].text ?? ""
    );
    return generationResult;
  }

  /**
   * Get token counts for the model input output (if provided).
   * Token counts are fetched via the `countTokens` API from the
   * Google Generative AI client.
   * @param args An object containing the input and optional output.
   * @param {string | GenerateContentRequest | (string | GenerativeAIPart)[]} [args.input] The input to count tokens for. The same input which is passed to the `generateContent` API.
   * @param {EnhancedGenerateContentResponse | undefined} [args.output] Optional output response to count tokens for. Should be an EnhancedGenerateContentResponse object.
   * @returns {Promise<UsageMetadata | undefined>} The usage metadata, or undefined if an error occurred.
   */
  async getTokenCount(args: {
    input: string | GenerateContentRequest | (string | GenerativeAIPart)[];
    output?: EnhancedGenerateContentResponse;
  }): Promise<UsageMetadata | undefined> {
    try {
      let getOutputTokensRequest:
        | Parameters<typeof this.client.countTokens>[0]
        | undefined;
      if (args.output) {
        const { text: getText, functionCalls: getFunctionCalls } = args.output;
        const text = getText();
        const functionCalls = getFunctionCalls();

        if (text) {
          getOutputTokensRequest = text;
        } else if (functionCalls) {
          getOutputTokensRequest = functionCalls.map((functionCall) => ({
            functionCall,
          }));
        }
      }

      const [{ totalTokens: input_tokens }, { totalTokens: output_tokens }] =
        await Promise.all([
          this.client.countTokens(args.input),
          getOutputTokensRequest
            ? this.client.countTokens(getOutputTokensRequest)
            : { totalTokens: 0 },
        ]);
      return {
        input_tokens,
        output_tokens,
        total_tokens: input_tokens + output_tokens,
      };
    } catch (e) {
      console.error("Failed to fetch token count: ", e);
      return undefined;
    }
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
    const parameters = this.invocationParams(options);
    const request = {
      ...parameters,
      contents: prompt,
    };
    const { stream, response } = await this.caller.callWithOptions(
      { signal: options?.signal },
      async () => {
        const res = await this.client.generateContentStream(request);
        return res;
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

    if (this.streamUsage || options.streamUsage) {
      const usageMetadata = await this.getTokenCount({
        input: request,
        output: await response,
      });

      yield new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({
          content: "",
          usage_metadata: usageMetadata,
        }),
      });
    }
  }

  async completionWithRetry(
    request: string | GenerateContentRequest | (string | GenerativeAIPart)[],
    options?: this["ParsedCallOptions"]
  ) {
    return this.caller.callWithOptions(
      { signal: options?.signal },
      async () => {
        let output;
        try {
          output = await this.client.generateContent(request);
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
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema: z.ZodType<RunOutput> | Record<string, any> = outputSchema;
    const name = config?.name;
    const method = config?.method;
    const includeRaw = config?.includeRaw;
    if (method === "jsonMode") {
      throw new Error(
        `ChatGoogleGenerativeAI only supports "functionCalling" as a method.`
      );
    }

    let functionName = name ?? "extract";
    let outputParser: BaseLLMOutputParser<RunOutput>;
    let tools: GoogleGenerativeAIFunctionDeclarationsTool[];
    if (isZodSchema(schema)) {
      const jsonSchema = zodToGenerativeAIParameters(schema);
      tools = [
        {
          functionDeclarations: [
            {
              name: functionName,
              description:
                jsonSchema.description ?? "A function available to call.",
              parameters: jsonSchema as GenerativeAIFunctionDeclarationSchema,
            },
          ],
        },
      ];
      outputParser = new GoogleGenerativeAIToolsOutputParser<
        z.infer<typeof schema>
      >({
        returnSingle: true,
        keyName: functionName,
        zodSchema: schema,
      });
    } else {
      let geminiFunctionDefinition: GenerativeAIFunctionDeclaration;
      if (
        typeof schema.name === "string" &&
        typeof schema.parameters === "object" &&
        schema.parameters != null
      ) {
        geminiFunctionDefinition = schema as GenerativeAIFunctionDeclaration;
        functionName = schema.name;
      } else {
        geminiFunctionDefinition = {
          name: functionName,
          description: schema.description ?? "",
          parameters: schema as GenerativeAIFunctionDeclarationSchema,
        };
      }
      tools = [
        {
          functionDeclarations: [geminiFunctionDefinition],
        },
      ];
      outputParser = new GoogleGenerativeAIToolsOutputParser<RunOutput>({
        returnSingle: true,
        keyName: functionName,
      });
    }
    const llm = this.bind({
      tools,
    });

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatGoogleGenerativeAIStructuredOutput",
      }) as Runnable<BaseLanguageModelInput, RunOutput>;
    }

    const parserAssign = RunnablePassthrough.assign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed: (input: any, config) => outputParser.invoke(input.raw, config),
    });
    const parserNone = RunnablePassthrough.assign({
      parsed: () => null,
    });
    const parsedWithFallback = parserAssign.withFallbacks({
      fallbacks: [parserNone],
    });
    return RunnableSequence.from<
      BaseLanguageModelInput,
      { raw: BaseMessage; parsed: RunOutput }
    >([
      {
        raw: llm,
      },
      parsedWithFallback,
    ]).withConfig({
      runName: "StructuredOutputRunnable",
    });
  }
}
