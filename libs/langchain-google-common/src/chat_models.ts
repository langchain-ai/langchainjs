import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { UsageMetadata, type BaseMessage } from "@langchain/core/messages";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

import {
  BaseChatModel,
  LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import type { z } from "zod";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";
import { BaseLLMOutputParser } from "@langchain/core/output_parsers";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import { concat } from "@langchain/core/utils/stream";
import {
  GoogleAIBaseLLMInput,
  GoogleAIModelParams,
  GoogleAISafetySetting,
  GoogleConnectionParams,
  GooglePlatformType,
  GeminiTool,
  GoogleAIBaseLanguageModelCallOptions,
  GoogleAIAPI,
  GoogleAIAPIParams,
  GoogleSearchToolSetting,
} from "./types.js";
import {
  convertToGeminiTools,
  copyAIModelParams,
  copyAndValidateModelParamsInto,
} from "./utils/common.js";
import { AbstractGoogleLLMConnection } from "./connection.js";
import { DefaultGeminiSafetyHandler, getGeminiAPI } from "./utils/gemini.js";
import { ApiKeyGoogleAuth, GoogleAbstractedClient } from "./auth.js";
import { JsonStream } from "./utils/stream.js";
import { ensureParams } from "./utils/failed_handler.js";
import type {
  GoogleBaseLLMInput,
  GoogleAISafetyHandler,
  GoogleAISafetyParams,
  GeminiFunctionDeclaration,
  GeminiFunctionSchema,
  GoogleAIToolType,
  GeminiAPIConfig,
  GoogleAIModelModality,
} from "./types.js";
import { schemaToGeminiParameters } from "./utils/zod_to_gemini_parameters.js";

export class ChatConnection<AuthOptions> extends AbstractGoogleLLMConnection<
  BaseMessage[],
  AuthOptions
> {
  convertSystemMessageToHumanContent: boolean | undefined;

  constructor(
    fields: GoogleAIBaseLLMInput<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
    streaming: boolean
  ) {
    super(fields, caller, client, streaming);
    this.convertSystemMessageToHumanContent =
      fields?.convertSystemMessageToHumanContent;
  }

  get useSystemInstruction(): boolean {
    return typeof this.convertSystemMessageToHumanContent === "boolean"
      ? !this.convertSystemMessageToHumanContent
      : this.computeUseSystemInstruction;
  }

  get computeUseSystemInstruction(): boolean {
    // This works on models from April 2024 and later
    //   Vertex AI: gemini-1.5-pro and gemini-1.0-002 and later
    //   AI Studio: gemini-1.5-pro-latest
    if (this.modelFamily === "palm") {
      return false;
    } else if (this.modelName === "gemini-1.0-pro-001") {
      return false;
    } else if (this.modelName.startsWith("gemini-pro-vision")) {
      return false;
    } else if (this.modelName.startsWith("gemini-1.0-pro-vision")) {
      return false;
    } else if (this.modelName === "gemini-pro" && this.platform === "gai") {
      // on AI Studio gemini-pro is still pointing at gemini-1.0-pro-001
      return false;
    } else if (this.modelFamily === "gemma") {
      // At least as of 12 Mar 2025 gemma 3 on AIS, trying to use system instructions yields an error:
      // "Developer instruction is not enabled for models/gemma-3-27b-it"
      return false;
    }
    return true;
  }

  computeGoogleSearchToolAdjustmentFromModel(): Exclude<
    GoogleSearchToolSetting,
    boolean
  > {
    if (this.modelName.startsWith("gemini-1.0")) {
      return "googleSearchRetrieval";
    } else if (this.modelName.startsWith("gemini-1.5")) {
      return "googleSearchRetrieval";
    } else {
      return "googleSearch";
    }
  }

  computeGoogleSearchToolAdjustment(
    apiConfig: GeminiAPIConfig
  ): Exclude<GoogleSearchToolSetting, true> {
    const adj = apiConfig.googleSearchToolAdjustment;
    if (adj === undefined || adj === true) {
      return this.computeGoogleSearchToolAdjustmentFromModel();
    } else {
      return adj;
    }
  }

  buildGeminiAPI(): GoogleAIAPI {
    const apiConfig: GeminiAPIConfig =
      (this.apiConfig as GeminiAPIConfig) ?? {};
    const googleSearchToolAdjustment =
      this.computeGoogleSearchToolAdjustment(apiConfig);
    const geminiConfig: GeminiAPIConfig = {
      useSystemInstruction: this.useSystemInstruction,
      googleSearchToolAdjustment,
      ...apiConfig,
    };
    return getGeminiAPI(geminiConfig);
  }

  get api(): GoogleAIAPI {
    switch (this.apiName) {
      case "google":
        return this.buildGeminiAPI();
      default:
        return super.api;
    }
  }
}

/**
 * Input to chat model class.
 */
export interface ChatGoogleBaseInput<AuthOptions>
  extends BaseChatModelParams,
    GoogleConnectionParams<AuthOptions>,
    GoogleAIModelParams,
    GoogleAISafetyParams,
    GoogleAIAPIParams,
    Pick<GoogleAIBaseLanguageModelCallOptions, "streamUsage"> {}

/**
 * Integration with a Google chat model.
 */
export abstract class ChatGoogleBase<AuthOptions>
  extends BaseChatModel<GoogleAIBaseLanguageModelCallOptions, AIMessageChunk>
  implements ChatGoogleBaseInput<AuthOptions>
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatGoogle";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      authOptions: "GOOGLE_AUTH_OPTIONS",
    };
  }

  lc_serializable = true;

  // Set based on modelName
  model: string;

  modelName = "gemini-pro";

  temperature: number;

  maxOutputTokens: number;

  maxReasoningTokens: number;

  topP: number;

  topK: number;

  seed: number;

  presencePenalty: number;

  frequencyPenalty: number;

  stopSequences: string[] = [];

  logprobs: boolean;

  topLogprobs: number = 0;

  safetySettings: GoogleAISafetySetting[] = [];

  responseModalities?: GoogleAIModelModality[];

  // May intentionally be undefined, meaning to compute this.
  convertSystemMessageToHumanContent: boolean | undefined;

  safetyHandler: GoogleAISafetyHandler;

  streamUsage = true;

  streaming = false;

  labels?: Record<string, string>;

  protected connection: ChatConnection<AuthOptions>;

  protected streamedConnection: ChatConnection<AuthOptions>;

  constructor(fields?: ChatGoogleBaseInput<AuthOptions>) {
    super(ensureParams(fields));

    copyAndValidateModelParamsInto(fields, this);
    this.safetyHandler =
      fields?.safetyHandler ?? new DefaultGeminiSafetyHandler();
    this.streamUsage = fields?.streamUsage ?? this.streamUsage;
    const client = this.buildClient(fields);
    this.buildConnection(fields ?? {}, client);
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "google_vertexai",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature ?? undefined,
      ls_max_tokens: params.maxOutputTokens ?? undefined,
      ls_stop: options.stop,
    };
  }

  abstract buildAbstractedClient(
    fields?: GoogleAIBaseLLMInput<AuthOptions>
  ): GoogleAbstractedClient;

  buildApiKeyClient(apiKey: string): GoogleAbstractedClient {
    return new ApiKeyGoogleAuth(apiKey);
  }

  buildApiKey(fields?: GoogleAIBaseLLMInput<AuthOptions>): string | undefined {
    return fields?.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
  }

  buildClient(
    fields?: GoogleAIBaseLLMInput<AuthOptions>
  ): GoogleAbstractedClient {
    const apiKey = this.buildApiKey(fields);
    if (apiKey) {
      return this.buildApiKeyClient(apiKey);
    } else {
      return this.buildAbstractedClient(fields);
    }
  }

  buildConnection(
    fields: GoogleBaseLLMInput<AuthOptions>,
    client: GoogleAbstractedClient
  ) {
    this.connection = new ChatConnection(
      { ...fields, ...this },
      this.caller,
      client,
      false
    );

    this.streamedConnection = new ChatConnection(
      { ...fields, ...this },
      this.caller,
      client,
      true
    );
  }

  get platform(): GooglePlatformType {
    return this.connection.platform;
  }

  override bindTools(
    tools: GoogleAIToolType[],
    kwargs?: Partial<GoogleAIBaseLanguageModelCallOptions>
  ): Runnable<
    BaseLanguageModelInput,
    AIMessageChunk,
    GoogleAIBaseLanguageModelCallOptions
  > {
    return this.withConfig({ tools: convertToGeminiTools(tools), ...kwargs });
  }

  // Replace
  _llmType() {
    return "chat_integration";
  }

  /**
   * Get the parameters used to invoke the model
   */
  override invocationParams(options?: this["ParsedCallOptions"]) {
    return copyAIModelParams(this, options);
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    const parameters = this.invocationParams(options);
    if (this.streaming) {
      const stream = this._streamResponseChunks(messages, options, runManager);
      let finalChunk: ChatGenerationChunk | null = null;
      for await (const chunk of stream) {
        finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
      }
      if (!finalChunk) {
        throw new Error("No chunks were returned from the stream.");
      }
      return {
        generations: [finalChunk],
      };
    }

    const response = await this.connection.request(
      messages,
      parameters,
      options,
      runManager
    );
    const ret = this.connection.api.responseToChatResult(response);
    const chunk = ret?.generations?.[0];
    if (chunk) {
      await runManager?.handleLLMNewToken(chunk.text || "");
    }
    return ret;
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    // Make the call as a streaming request
    const parameters = this.invocationParams(options);
    const response = await this.streamedConnection.request(
      _messages,
      parameters,
      options,
      runManager
    );

    // Get the streaming parser of the response
    const stream = response.data as JsonStream;
    let usageMetadata: UsageMetadata | undefined;
    // Loop until the end of the stream
    // During the loop, yield each time we get a chunk from the streaming parser
    // that is either available or added to the queue
    while (!stream.streamDone) {
      const output = await stream.nextChunk();
      await runManager?.handleCustomEvent(
        `google-chunk-${this.constructor.name}`,
        {
          output,
        }
      );
      if (
        output &&
        output.usageMetadata &&
        this.streamUsage !== false &&
        options.streamUsage !== false
      ) {
        usageMetadata = {
          input_tokens: output.usageMetadata.promptTokenCount,
          output_tokens: output.usageMetadata.candidatesTokenCount,
          total_tokens: output.usageMetadata.totalTokenCount,
        };
      }
      const chunk =
        output !== null
          ? this.connection.api.responseToChatGeneration({ data: output })
          : new ChatGenerationChunk({
              text: "",
              generationInfo: { finishReason: "stop" },
              message: new AIMessageChunk({
                content: "",
                usage_metadata: usageMetadata,
              }),
            });
      if (chunk) {
        yield chunk;
        await runManager?.handleLLMNewToken(
          chunk.text ?? "",
          undefined,
          undefined,
          undefined,
          undefined,
          { chunk }
        );
      }
    }
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
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
      throw new Error(`Google only supports "functionCalling" as a method.`);
    }

    let functionName = name ?? "extract";
    let outputParser: BaseLLMOutputParser<RunOutput>;
    let tools: GeminiTool[];
    if (isZodSchema(schema)) {
      const jsonSchema = schemaToGeminiParameters(schema);
      tools = [
        {
          functionDeclarations: [
            {
              name: functionName,
              description:
                jsonSchema.description ?? "A function available to call.",
              parameters: jsonSchema as GeminiFunctionSchema,
            },
          ],
        },
      ];
      outputParser = new JsonOutputKeyToolsParser({
        returnSingle: true,
        keyName: functionName,
        zodSchema: schema,
      });
    } else {
      let geminiFunctionDefinition: GeminiFunctionDeclaration;
      if (
        typeof schema.name === "string" &&
        typeof schema.parameters === "object" &&
        schema.parameters != null
      ) {
        geminiFunctionDefinition = schema as GeminiFunctionDeclaration;
        functionName = schema.name;
      } else {
        geminiFunctionDefinition = {
          name: functionName,
          description: schema.description ?? "",
          parameters: schema as GeminiFunctionSchema,
        };
      }
      tools = [
        {
          functionDeclarations: [geminiFunctionDefinition],
        },
      ];
      outputParser = new JsonOutputKeyToolsParser<RunOutput>({
        returnSingle: true,
        keyName: functionName,
      });
    }
    const llm = this.bindTools(tools).withConfig({ tool_choice: functionName });

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatGoogleStructuredOutput",
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

function isZodSchema<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: z.ZodType<RunOutput> | Record<string, any>
): input is z.ZodType<RunOutput> {
  // Check for a characteristic method of Zod schemas
  return typeof (input as z.ZodType<RunOutput>)?.parse === "function";
}
