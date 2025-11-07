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
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
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
  GoogleSpeechConfig,
  GeminiJsonSchema,
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
import {
  removeAdditionalProperties,
  schemaToGeminiParameters,
} from "./utils/zod_to_gemini_parameters.js";

/**
 * Helper to automatically infer Gemini property ordering from a Zod schema.
 */
function withPropertyOrdering<RunOutput extends Record<string, any>>(
  schema: InteropZodType<RunOutput>
): string[] {
  try {
    return Object.keys(schema.shape ?? {});
  } catch {
    return [];
  }
}

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
  static lc_name() {
    return "ChatGoogle";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      authOptions: "GOOGLE_AUTH_OPTIONS",
    };
  }

  lc_serializable = true;

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
  convertSystemMessageToHumanContent: boolean | undefined;
  safetyHandler: GoogleAISafetyHandler;
  speechConfig: GoogleSpeechConfig;
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

  _llmType() {
    return "chat_integration";
  }

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
      return { generations: [finalChunk] };
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
    const parameters = this.invocationParams(options);
    const response = await this.streamedConnection.request(
      _messages,
      parameters,
      options,
      runManager
    );
    const stream = response.data as JsonStream;
    let usageMetadata: UsageMetadata | undefined;
    while (!stream.streamDone) {
      const output = await stream.nextChunk();
      await runManager?.handleCustomEvent(
        `google-chunk-${this.constructor.name}`,
        { output }
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

  _combineLLMOutput() {
    return [];
  }

  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }> {
    const schema: InteropZodType<RunOutput> | Record<string, any> =
      outputSchema;
    const name = config?.name;
    const method = config?.method;
    const includeRaw = config?.includeRaw;
    if (method === "jsonMode") {
      throw new Error(`Google only supports "functionCalling" as a method.`);
    }

    let functionName = name ?? "extract";
    let outputParser: BaseLLMOutputParser<RunOutput>;
    let tools: GeminiTool[];

    if (isInteropZodSchema(schema)) {
      const jsonSchema = schemaToGeminiParameters(schema);

      // 🧩 Add inferred property ordering for Gemini structured outputs
      if (!jsonSchema.propertyOrdering) {
        jsonSchema.propertyOrdering = withPropertyOrdering(schema);
      }

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
        const parameters: GeminiJsonSchema = removeAdditionalProperties(schema);
        geminiFunctionDefinition = {
          name: functionName,
          description: schema.description ?? "",
          parameters,
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
      { raw: llm },
      parsedWithFallback,
    ]).withConfig({
      runName: "StructuredOutputRunnable",
    });
  }
}
