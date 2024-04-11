import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { type BaseMessage } from "@langchain/core/messages";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

import {
  BaseChatModel,
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
  RunnableInterface,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";
import { BaseLLMOutputParser } from "@langchain/core/output_parsers";
import { isStructuredTool } from "@langchain/core/utils/function_calling";
import { StructuredToolInterface } from "@langchain/core/tools";
import {
  GoogleAIBaseLLMInput,
  GoogleAIModelParams,
  GoogleAISafetySetting,
  GoogleConnectionParams,
  GooglePlatformType,
  GeminiContent,
  GeminiTool,
  GoogleAIBaseLanguageModelCallOptions,
} from "./types.js";
import {
  copyAIModelParams,
  copyAndValidateModelParamsInto,
} from "./utils/common.js";
import { AbstractGoogleLLMConnection } from "./connection.js";
import {
  baseMessageToContent,
  safeResponseToChatGeneration,
  safeResponseToChatResult,
  DefaultGeminiSafetyHandler,
} from "./utils/gemini.js";
import { ApiKeyGoogleAuth, GoogleAbstractedClient } from "./auth.js";
import { JsonStream } from "./utils/stream.js";
import { ensureParams } from "./utils/failed_handler.js";
import type {
  GoogleBaseLLMInput,
  GoogleAISafetyHandler,
  GoogleAISafetyParams,
  GeminiFunctionDeclaration,
  GeminiFunctionSchema,
} from "./types.js";
import { zodToGeminiParameters } from "./utils/zod_to_gemini_parameters.js";

class ChatConnection<AuthOptions> extends AbstractGoogleLLMConnection<
  BaseMessage[],
  AuthOptions
> {
  formatContents(
    input: BaseMessage[],
    _parameters: GoogleAIModelParams
  ): GeminiContent[] {
    return input
      .map((msg, i) => baseMessageToContent(msg, input[i - 1]))
      .reduce((acc, cur) => [...acc, ...cur]);
  }
}

/**
 * Input to chat model class.
 */
export interface ChatGoogleBaseInput<AuthOptions>
  extends BaseChatModelParams,
    GoogleConnectionParams<AuthOptions>,
    GoogleAIModelParams,
    GoogleAISafetyParams {}

function convertToGeminiTools(
  structuredTools: (StructuredToolInterface | Record<string, unknown>)[]
): GeminiTool[] {
  return [
    {
      functionDeclarations: structuredTools.map(
        (structuredTool): GeminiFunctionDeclaration => {
          if (isStructuredTool(structuredTool)) {
            const jsonSchema = zodToGeminiParameters(structuredTool.schema);
            return {
              name: structuredTool.name,
              description: structuredTool.description,
              parameters: jsonSchema as GeminiFunctionSchema,
            };
          }
          return structuredTool as unknown as GeminiFunctionDeclaration;
        }
      ),
    },
  ];
}

/**
 * Integration with a chat model.
 */
export abstract class ChatGoogleBase<AuthOptions>
  extends BaseChatModel<GoogleAIBaseLanguageModelCallOptions, AIMessageChunk>
  implements ChatGoogleBaseInput<AuthOptions>
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatGoogle";
  }

  lc_serializable = true;

  model = "gemini-pro";

  modelName = "gemini-pro";

  temperature = 0.7;

  maxOutputTokens = 1024;

  topP = 0.8;

  topK = 40;

  stopSequences: string[] = [];

  safetySettings: GoogleAISafetySetting[] = [];

  safetyHandler: GoogleAISafetyHandler;

  protected connection: ChatConnection<AuthOptions>;

  protected streamedConnection: ChatConnection<AuthOptions>;

  constructor(fields?: ChatGoogleBaseInput<AuthOptions>) {
    super(ensureParams(fields));

    copyAndValidateModelParamsInto(fields, this);
    this.safetyHandler =
      fields?.safetyHandler ?? new DefaultGeminiSafetyHandler();

    const client = this.buildClient(fields);
    this.buildConnection(fields ?? {}, client);
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
    tools: (StructuredToolInterface | Record<string, unknown>)[],
    kwargs?: Partial<GoogleAIBaseLanguageModelCallOptions>
  ): RunnableInterface<
    BaseLanguageModelInput,
    AIMessageChunk,
    GoogleAIBaseLanguageModelCallOptions
  > {
    return this.bind({ tools: convertToGeminiTools(tools), ...kwargs });
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
    _runManager: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    const parameters = this.invocationParams(options);
    const response = await this.connection.request(
      messages,
      parameters,
      options
    );
    const ret = safeResponseToChatResult(response, this.safetyHandler);
    return ret;
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    // Make the call as a streaming request
    const parameters = this.invocationParams(options);
    const response = await this.streamedConnection.request(
      _messages,
      parameters,
      options
    );

    // Get the streaming parser of the response
    const stream = response.data as JsonStream;

    // Loop until the end of the stream
    // During the loop, yield each time we get a chunk from the streaming parser
    // that is either available or added to the queue
    while (!stream.streamDone) {
      const output = await stream.nextChunk();
      const chunk =
        output !== null
          ? safeResponseToChatGeneration({ data: output }, this.safetyHandler)
          : new ChatGenerationChunk({
              text: "",
              generationInfo: { finishReason: "stop" },
              message: new AIMessageChunk({
                content: "",
              }),
            });
      yield chunk;
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
      const jsonSchema = zodToGeminiParameters(schema);
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
    const llm = this.bind({
      tools,
    });

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
