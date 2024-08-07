import type { BaseMessage } from "@langchain/core/messages";
import { AIMessageChunk } from "@langchain/core/messages";
import type {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
  ToolDefinition,
} from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel,
  LangSmithParams,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import type {
  ToolConfiguration,
  GuardrailConfiguration,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  defaultProvider,
  DefaultProviderInit,
} from "@aws-sdk/credential-provider-node";
import type { DocumentType as __DocumentType } from "@smithy/types";
import {
  Runnable,
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { zodToJsonSchema } from "zod-to-json-schema";
import { isZodSchema } from "@langchain/core/utils/types";
import { z } from "zod";
import {
  convertToConverseTools,
  convertToBedrockToolChoice,
  convertToConverseMessages,
  convertConverseMessageToLangChainMessage,
  handleConverseStreamContentBlockDelta,
  handleConverseStreamMetadata,
  handleConverseStreamContentBlockStart,
  BedrockConverseToolChoice,
} from "./common.js";
import {
  ChatBedrockConverseToolType,
  ConverseCommandParams,
  CredentialType,
} from "./types.js";

// Models which support the `toolChoice` param.
// See https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolChoice.html
const ALLOWED_TOOL_CHOICE_MODELS_PREFIX = ["anthropic.claude-3", "mistral.mistral-large"]

/**
 * Inputs for ChatBedrockConverse.
 */
export interface ChatBedrockConverseInput
  extends BaseChatModelParams,
    Partial<DefaultProviderInit> {
  /**
   * Whether or not to stream responses
   */
  streaming?: boolean;

  /**
   * Model to use.
   * For example, "anthropic.claude-3-haiku-20240307-v1:0", this is equivalent to the modelId property in the
   * list-foundation-models api.
   * See the below link for a full list of models.
   * @link https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html#model-ids-arns
   *
   * @default anthropic.claude-3-haiku-20240307-v1:0
   */
  model?: string;

  /**
   * The AWS region e.g. `us-west-2`.
   * Fallback to AWS_DEFAULT_REGION env variable or region specified in ~/.aws/config
   * in case it is not provided here.
   */
  region?: string;

  /**
   * AWS Credentials. If no credentials are provided, the default credentials from
   * `@aws-sdk/credential-provider-node` will be used.
   */
  credentials?: CredentialType;

  /**
   * Temperature.
   */
  temperature?: number;

  /**
   * Max tokens.
   */
  maxTokens?: number;

  /**
   * Override the default endpoint hostname.
   */
  endpointHost?: string;

  /**
   * The percentage of most-likely candidates that the model considers for the next token. For
   * example, if you choose a value of 0.8 for `topP`, the model selects from the top 80% of the
   * probability distribution of tokens that could be next in the sequence.
   * The default value is the default value for the model that you are using.
   * For more information, see the inference parameters for foundation models link below.
   * @link https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html
   */
  topP?: number;

  /**
   * Additional inference parameters that the model supports, beyond the
   * base set of inference parameters that the Converse API supports in the `inferenceConfig`
   * field. For more information, see the model parameters link below.
   * @link https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html
   */
  additionalModelRequestFields?: __DocumentType;
  /**
   * Whether or not to include usage data, like token counts
   * in the streamed response chunks. Passing as a call option will
   * take precedence over the class-level setting.
   * @default true
   */
  streamUsage?: boolean;

  /**
   * Configuration information for a guardrail that you want to use in the request.
   */
  guardrailConfig?: GuardrailConfiguration;
}

export interface ChatBedrockConverseCallOptions
  extends BaseChatModelCallOptions,
    Pick<
      ChatBedrockConverseInput,
      "additionalModelRequestFields" | "streamUsage"
    > {
  /**
   * A list of stop sequences. A stop sequence is a sequence of characters that causes
   * the model to stop generating the response.
   */
  stop?: string[];

  tools?: ChatBedrockConverseToolType[];

  /**
   * Tool choice for the model. If passing a string, it must be "any", "auto" or the
   * name of the tool to use. Or, pass a BedrockToolChoice object.
   *
   * If "any" is passed, the model must request at least one tool.
   * If "auto" is passed, the model automatically decides if a tool should be called
   * or whether to generate text instead.
   * If a tool name is passed, it will force the model to call that specific tool.
   */
  tool_choice?: BedrockConverseToolChoice;
}

/**
 * Integration with AWS Bedrock Converse API.
 *
 * @example
 * ```typescript
 * import { ChatBedrockConverse } from "@langchain/aws";
 *
 * const model = new ChatBedrockConverse({
 *   region: process.env.BEDROCK_AWS_REGION ?? "us-east-1",
 *   credentials: {
 *     secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
 *     accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
 *   },
 * });
 *
 * const res = await model.invoke([new HumanMessage("Print hello world")]);
 * ```
 */
export class ChatBedrockConverse
  extends BaseChatModel<ChatBedrockConverseCallOptions, AIMessageChunk>
  implements ChatBedrockConverseInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatBedrockConverse";
  }

  /**
   * Replace with any secrets this class passes to `super`.
   * See {@link ../../langchain-cohere/src/chat_model.ts} for
   * an example.
   */
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "API_KEY_NAME",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "API_KEY_NAME",
    };
  }

  model = "anthropic.claude-3-haiku-20240307-v1:0";

  streaming = false;

  region: string;

  temperature?: number | undefined = undefined;

  maxTokens?: number | undefined = undefined;

  endpointHost?: string;

  topP?: number;

  additionalModelRequestFields?: __DocumentType;

  streamUsage = true;

  guardrailConfig?: GuardrailConfiguration;

  client: BedrockRuntimeClient;

  constructor(fields?: ChatBedrockConverseInput) {
    super(fields ?? {});
    const {
      profile,
      filepath,
      configFilepath,
      ignoreCache,
      mfaCodeProvider,
      roleAssumer,
      roleArn,
      webIdentityTokenFile,
      roleAssumerWithWebIdentity,
      ...rest
    } = fields ?? {};

    const credentials =
      rest?.credentials ??
      defaultProvider({
        profile,
        filepath,
        configFilepath,
        ignoreCache,
        mfaCodeProvider,
        roleAssumer,
        roleArn,
        webIdentityTokenFile,
        roleAssumerWithWebIdentity,
      });

    const region = rest?.region ?? getEnvironmentVariable("AWS_DEFAULT_REGION");
    if (!region) {
      throw new Error(
        "Please set the AWS_DEFAULT_REGION environment variable or pass it to the constructor as the region field."
      );
    }

    this.client = new BedrockRuntimeClient({
      region,
      credentials,
    });
    this.region = region;
    this.model = rest?.model ?? this.model;
    this.streaming = rest?.streaming ?? this.streaming;
    this.temperature = rest?.temperature;
    this.maxTokens = rest?.maxTokens;
    this.endpointHost = rest?.endpointHost;
    this.topP = rest?.topP;
    this.additionalModelRequestFields = rest?.additionalModelRequestFields;
    this.streamUsage = rest?.streamUsage ?? this.streamUsage;
    this.guardrailConfig = rest?.guardrailConfig;
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "amazon_bedrock",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.inferenceConfig?.temperature ?? this.temperature,
      ls_max_tokens: params.inferenceConfig?.maxTokens ?? undefined,
      ls_stop: options.stop,
    };
  }

  override bindTools(
    tools: ChatBedrockConverseToolType[],
    kwargs?: Partial<this["ParsedCallOptions"]>
  ): Runnable<
    BaseLanguageModelInput,
    AIMessageChunk,
    this["ParsedCallOptions"]
  > {
    if (kwargs?.tool_choice) {
      if (!ALLOWED_TOOL_CHOICE_MODELS_PREFIX.find((prefix) => this.model.startsWith(prefix))) {
        throw new Error("Only Anthropic Claude 3 and Mistral Large models support the tool_choice parameter.");
      }
    }
    return this.bind({ tools: convertToConverseTools(tools), ...kwargs });
  }

  // Replace
  _llmType() {
    return "chat_bedrock_converse";
  }

  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Partial<ConverseCommandParams> {
    let toolConfig: ToolConfiguration | undefined;
    if (options?.tools && options.tools.length) {
      const tools = convertToConverseTools(options.tools);
      toolConfig = {
        tools,
        toolChoice: options.tool_choice
          ? convertToBedrockToolChoice(options.tool_choice, tools)
          : undefined,
      };
    }
    return {
      inferenceConfig: {
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        topP: this.topP,
        stopSequences: options?.stop,
      },
      toolConfig,
      additionalModelRequestFields:
        this.additionalModelRequestFields ??
        options?.additionalModelRequestFields,
      guardrailConfig: this.guardrailConfig,
    };
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.streaming) {
      const stream = this._streamResponseChunks(messages, options, runManager);
      let finalResult: ChatGenerationChunk | undefined;
      for await (const chunk of stream) {
        if (finalResult === undefined) {
          finalResult = chunk;
        } else {
          finalResult = finalResult.concat(chunk);
        }
      }
      if (finalResult === undefined) {
        throw new Error(
          "Could not parse final output from Bedrock streaming call."
        );
      }
      return {
        generations: [finalResult],
        llmOutput: finalResult.generationInfo,
      };
    }
    return this._generateNonStreaming(messages, options, runManager);
  }

  async _generateNonStreaming(
    messages: BaseMessage[],
    options: Partial<this["ParsedCallOptions"]>,
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const { converseMessages, converseSystem } =
      convertToConverseMessages(messages);
    const params = this.invocationParams(options);

    const command = new ConverseCommand({
      modelId: this.model,
      messages: converseMessages,
      system: converseSystem,
      ...params,
    });
    const response = await this.client.send(command);
    const { output, ...responseMetadata } = response;
    if (!output?.message) {
      throw new Error("No message found in Bedrock response.");
    }

    const message = convertConverseMessageToLangChainMessage(
      output.message,
      responseMetadata
    );
    return {
      generations: [
        {
          text: typeof message.content === "string" ? message.content : "",
          message,
        },
      ],
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const { converseMessages, converseSystem } =
      convertToConverseMessages(messages);
    const params = this.invocationParams(options);
    let { streamUsage } = this;
    if (options.streamUsage !== undefined) {
      streamUsage = options.streamUsage;
    }
    const command = new ConverseStreamCommand({
      modelId: this.model,
      messages: converseMessages,
      system: converseSystem,
      ...params,
    });
    const response = await this.client.send(command);
    if (response.stream) {
      for await (const chunk of response.stream) {
        if (chunk.contentBlockStart) {
          yield handleConverseStreamContentBlockStart(chunk.contentBlockStart);
        } else if (chunk.contentBlockDelta) {
          const textChatGeneration = handleConverseStreamContentBlockDelta(
            chunk.contentBlockDelta
          );
          yield textChatGeneration;
          await runManager?.handleLLMNewToken(textChatGeneration.text);
        } else if (chunk.metadata) {
          yield handleConverseStreamMetadata(chunk.metadata, {
            streamUsage,
          });
        } else {
          yield new ChatGenerationChunk({
            text: "",
            message: new AIMessageChunk({
              content: "",
              response_metadata: chunk,
            }),
          });
        }
      }
    }
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        {
          raw: BaseMessage;
          parsed: RunOutput;
        }
      > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema: z.ZodType<RunOutput> | Record<string, any> = outputSchema;
    const name = config?.name;
    const description = schema.description ?? "A function available to call.";
    const method = config?.method;
    const includeRaw = config?.includeRaw;
    if (method === "jsonMode") {
      throw new Error(
        `ChatBedrockConverse does not support 'jsonMode'.`
      );
    }

    let functionName = name ?? "extract";
    let tools: ToolDefinition[];
    if (isZodSchema(schema)) {
      tools = [
        {
          type: "function",
          function: {
            name: functionName,
            description,
            parameters: zodToJsonSchema(schema),
          },
        },
      ];
    } else {
      if ("name" in schema) {
        functionName = schema.name;
      }
      tools = [
        {
          type: "function",
          function: {
            name: functionName,
            description,
            parameters: schema,
          },
        },
      ];
    }

    const toolChoiceObj = ALLOWED_TOOL_CHOICE_MODELS_PREFIX.find((prefix) => this.model.startsWith(prefix)) ? {
      tool_choice: tools[0].function.name,
    } : undefined
    const llm = this.bindTools(tools, toolChoiceObj);
    const outputParser = RunnableLambda.from<AIMessageChunk, RunOutput>(
      (input: AIMessageChunk): RunOutput => {
        if (!input.tool_calls || input.tool_calls.length === 0) {
          throw new Error("No tool calls found in the response.");
        }
        const toolCall = input.tool_calls.find(
          (tc) => tc.name === functionName
        );
        if (!toolCall) {
          throw new Error(`No tool call found with name ${functionName}.`);
        }
        return toolCall.args as RunOutput;
      }
    );

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "StructuredOutput",
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
