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

/**
 * Inputs for ChatBedrockConverse.
 */
export interface ChatBedrockConverseInput
  extends BaseChatModelParams,
    Partial<DefaultProviderInit> {
  /**
   * The BedrockRuntimeClient to use.
   * It gives ability to override the default client with a custom one, allowing you to pass requestHandler {NodeHttpHandler} parameter
   * in case it is not provided here.
   */
  client?: BedrockRuntimeClient;

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

  /**
   * Which types of `tool_choice` values the model supports.
   *
   * Inferred if not specified. Inferred as ['auto', 'any', 'tool'] if a 'claude-3'
   * model is used, ['auto', 'any'] if a 'mistral-large' model is used, empty otherwise.
   */
  supportsToolChoiceValues?: Array<"auto" | "any" | "tool">;
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
 * AWS Bedrock Converse chat model integration.
 *
 * Setup:
 * Install `@langchain/aws` and set the following environment variables:
 *
 * ```bash
 * npm install @langchain/aws
 * export BEDROCK_AWS_REGION="your-aws-region"
 * export BEDROCK_AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
 * export BEDROCK_AWS_ACCESS_KEY_ID="your-aws-access-key-id"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/langchain_aws.ChatBedrockConverse.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/langchain_aws.ChatBedrockConverseCallOptions.html)
 *
 * Runtime args can be passed as the second argument to any of the base runnable methods `.invoke`. `.stream`, `.batch`, etc.
 * They can also be passed via `.bind`, or the second arg in `.bindTools`, like shown in the examples below:
 *
 * ```typescript
 * // When calling `.bind`, call options should be passed via the first argument
 * const llmWithArgsBound = llm.bind({
 *   stop: ["\n"],
 *   tools: [...],
 * });
 *
 * // When calling `.bindTools`, call options should be passed via the second argument
 * const llmWithTools = llm.bindTools(
 *   [...],
 *   {
 *     stop: ["\n"],
 *   }
 * );
 * ```
 *
 * ## Examples
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { ChatBedrockConverse } from '@langchain/aws';
 *
 * const llm = new ChatBedrockConverse({
 *   model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
 *   temperature: 0,
 *   maxTokens: undefined,
 *   timeout: undefined,
 *   maxRetries: 2,
 *   region: process.env.BEDROCK_AWS_REGION,
 *   credentials: {
 *     secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
 *     accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
 *   },
 *   // other params...
 * });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Invoking</strong></summary>
 *
 * ```typescript
 * const input = `Translate "I love programming" into French.`;
 *
 * // Models also accept a list of chat messages or a formatted prompt
 * const result = await llm.invoke(input);
 * console.log(result);
 * ```
 *
 * ```txt
 * AIMessage {
 *   "id": "81a27f7a-550c-473d-8307-c2fbb9c74956",
 *   "content": "Here's the translation to French:\n\nJ'adore la programmation.",
 *   "response_metadata": {
 *     "$metadata": {
 *       "httpStatusCode": 200,
 *       "requestId": "81a27f7a-550c-473d-8307-c2fbb9c74956",
 *       "attempts": 1,
 *       "totalRetryDelay": 0
 *     },
 *     "metrics": {
 *       "latencyMs": 1109
 *     },
 *     "stopReason": "end_turn",
 *     "usage": {
 *       "inputTokens": 25,
 *       "outputTokens": 19,
 *       "totalTokens": 44
 *     }
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 19,
 *     "total_tokens": 44
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Streaming Chunks</strong></summary>
 *
 * ```typescript
 * for await (const chunk of await llm.stream(input)) {
 *   console.log(chunk);
 * }
 * ```
 *
 * ```txt
 * AIMessageChunk {
 *   "content": ""
 *   "response_metadata": {
 *     "messageStart": {
 *       "p": "abcdefghijk",
 *       "role": "assistant"
 *     }
 *   }
 * }
 * AIMessageChunk {
 *   "content": "Here"
 * }
 * AIMessageChunk {
 *   "content": "'s"
 * }
 * AIMessageChunk {
 *   "content": " the translation"
 * }
 * AIMessageChunk {
 *   "content": " to"
 * }
 * AIMessageChunk {
 *   "content": " French:\n\nJ"
 * }
 * AIMessageChunk {
 *   "content": "'adore la"
 * }
 * AIMessageChunk {
 *   "content": " programmation."
 * }
 * AIMessageChunk {
 *   "content": ""
 *   "response_metadata": {
 *     "contentBlockStop": {
 *       "contentBlockIndex": 0,
 *       "p": "abcdefghijk"
 *     }
 *   }
 * }
 * AIMessageChunk {
 *   "content": ""
 *   "response_metadata": {
 *     "messageStop": {
 *       "stopReason": "end_turn"
 *     }
 *   }
 * }
 * AIMessageChunk {
 *   "content": ""
 *   "response_metadata": {
 *     "metadata": {
 *       "metrics": {
 *         "latencyMs": 838
 *       },
 *       "p": "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123",
 *       "usage": {
 *         "inputTokens": 25,
 *         "outputTokens": 19,
 *         "totalTokens": 44
 *       }
 *     }
 *   }
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 19,
 *     "total_tokens": 44
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Aggregate Streamed Chunks</strong></summary>
 *
 * ```typescript
 * import { AIMessageChunk } from '@langchain/core/messages';
 * import { concat } from '@langchain/core/utils/stream';
 *
 * const stream = await llm.stream(input);
 * let full: AIMessageChunk | undefined;
 * for await (const chunk of stream) {
 *   full = !full ? chunk : concat(full, chunk);
 * }
 * console.log(full);
 * ```
 *
 * ```txt
 * AIMessageChunk {
 *   "content": "Here's the translation to French:\n\nJ'adore la programmation.",
 *   "response_metadata": {
 *     "messageStart": {
 *       "p": "ab",
 *       "role": "assistant"
 *     },
 *     "contentBlockStop": {
 *       "contentBlockIndex": 0,
 *       "p": "abcdefghijklmnopqrstuvwxyzABCDEFGHIJK"
 *     },
 *     "messageStop": {
 *       "stopReason": "end_turn"
 *     },
 *     "metadata": {
 *       "metrics": {
 *         "latencyMs": 838
 *       },
 *       "p": "abcdefghijklmnopqrstuvwxyz",
 *       "usage": {
 *         "inputTokens": 25,
 *         "outputTokens": 19,
 *         "totalTokens": 44
 *       }
 *     }
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 19,
 *     "total_tokens": 44
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Bind tools</strong></summary>
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const GetWeather = {
 *   name: "GetWeather",
 *   description: "Get the current weather in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const GetPopulation = {
 *   name: "GetPopulation",
 *   description: "Get the current population in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const llmWithTools = llm.bindTools(
 *   [GetWeather, GetPopulation],
 *   {
 *     // strict: true  // enforce tool args schema is respected
 *   }
 * );
 * const aiMsg = await llmWithTools.invoke(
 *   "Which city is hotter today and which is bigger: LA or NY?"
 * );
 * console.log(aiMsg.tool_calls);
 * ```
 *
 * ```txt
 * [
 *   {
 *     id: 'tooluse_hIaiqfweRtSiJyi6J4naJA',
 *     name: 'GetWeather',
 *     args: { location: 'Los Angeles, CA' },
 *     type: 'tool_call'
 *   },
 *   {
 *     id: 'tooluse_nOS8B0UlTd2FdpH4MSHw9w',
 *     name: 'GetWeather',
 *     args: { location: 'New York, NY' },
 *     type: 'tool_call'
 *   },
 *   {
 *     id: 'tooluse_XxMpZiETQ5aVS5opVDyIaw',
 *     name: 'GetPopulation',
 *     args: { location: 'Los Angeles, CA' },
 *     type: 'tool_call'
 *   },
 *   {
 *     id: 'tooluse_GpYvAfldT2aR8VQfH-p4PQ',
 *     name: 'GetPopulation',
 *     args: { location: 'New York, NY' },
 *     type: 'tool_call'
 *   }
 * ]
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Structured Output</strong></summary>
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const Joke = z.object({
 *   setup: z.string().describe("The setup of the joke"),
 *   punchline: z.string().describe("The punchline to the joke"),
 *   rating: z.number().optional().describe("How funny the joke is, from 1 to 10")
 * }).describe('Joke to tell user.');
 *
 * const structuredLlm = llm.withStructuredOutput(Joke, { name: "Joke" });
 * const jokeResult = await structuredLlm.invoke("Tell me a joke about cats");
 * console.log(jokeResult);
 * ```
 *
 * ```txt
 * {
 *   setup: "Why don't cats play poker in the jungle?",
 *   punchline: 'Too many cheetahs!',
 *   rating: 7
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Multimodal</strong></summary>
 *
 * ```typescript
 * import { HumanMessage } from '@langchain/core/messages';
 *
 * const imageUrl = "https://example.com/image.jpg";
 * const imageData = await fetch(imageUrl).then(res => res.arrayBuffer());
 * const base64Image = Buffer.from(imageData).toString('base64');
 *
 * const message = new HumanMessage({
 *   content: [
 *     { type: "text", text: "describe the weather in this image" },
 *     {
 *       type: "image_url",
 *       image_url: { url: `data:image/jpeg;base64,${base64Image}` },
 *     },
 *   ]
 * });
 *
 * const imageDescriptionAiMsg = await llm.invoke([message]);
 * console.log(imageDescriptionAiMsg.content);
 * ```
 *
 * ```txt
 * The weather in this image appears to be clear and pleasant. The sky is a vibrant blue with scattered white clouds, suggesting a sunny day with good visibility. The clouds are light and wispy, indicating fair weather conditions. There's no sign of rain, storm, or any adverse weather patterns. The lush green grass on the rolling hills looks well-watered and healthy, which could indicate recent rainfall or generally favorable weather conditions. Overall, the image depicts a beautiful, calm day with blue skies and sunshine - perfect weather for enjoying the outdoors.
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Usage Metadata</strong></summary>
 *
 * ```typescript
 * const aiMsgForMetadata = await llm.invoke(input);
 * console.log(aiMsgForMetadata.usage_metadata);
 * ```
 *
 * ```txt
 * { input_tokens: 25, output_tokens: 19, total_tokens: 44 }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Stream Usage Metadata</strong></summary>
 *
 * ```typescript
 * const streamForMetadata = await llm.stream(input);
 * let fullForMetadata: AIMessageChunk | undefined;
 * for await (const chunk of streamForMetadata) {
 *   fullForMetadata = !fullForMetadata ? chunk : concat(fullForMetadata, chunk);
 * }
 * console.log(fullForMetadata?.usage_metadata);
 * ```
 *
 * ```txt
 * { input_tokens: 25, output_tokens: 19, total_tokens: 44 }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Response Metadata</strong></summary>
 *
 * ```typescript
 * const aiMsgForResponseMetadata = await llm.invoke(input);
 * console.log(aiMsgForResponseMetadata.response_metadata);
 * ```
 *
 * ```txt
 * {
 *   '$metadata': {
 *     httpStatusCode: 200,
 *     requestId: '5de2a2e5-d1dc-4dff-bb02-31361f4107bc',
 *     extendedRequestId: undefined,
 *     cfId: undefined,
 *     attempts: 1,
 *     totalRetryDelay: 0
 *   },
 *   metrics: { latencyMs: 1163 },
 *   stopReason: 'end_turn',
 *   usage: { inputTokens: 25, outputTokens: 19, totalTokens: 44 }
 * }
 * ```
 * </details>
 *
 * <br />
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

  /**
   * Which types of `tool_choice` values the model supports.
   *
   * Inferred if not specified. Inferred as ['auto', 'any', 'tool'] if a 'claude-3'
   * model is used, ['auto', 'any'] if a 'mistral-large' model is used, empty otherwise.
   */
  supportsToolChoiceValues?: Array<"auto" | "any" | "tool">;

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

    this.client =
      fields?.client ??
      new BedrockRuntimeClient({
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

    if (rest?.supportsToolChoiceValues === undefined) {
      if (this.model.includes("claude-3")) {
        this.supportsToolChoiceValues = ["auto", "any", "tool"];
      } else if (this.model.includes("mistral-large")) {
        this.supportsToolChoiceValues = ["auto", "any"];
      } else {
        this.supportsToolChoiceValues = undefined;
      }
    } else {
      this.supportsToolChoiceValues = rest.supportsToolChoiceValues;
    }
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
          ? convertToBedrockToolChoice(options.tool_choice, tools, {
              model: this.model,
              supportsToolChoiceValues: this.supportsToolChoiceValues,
            })
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
    const response = await this.client.send(command, {
      abortSignal: options.signal,
    });
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
    const response = await this.client.send(command, {
      abortSignal: options.signal,
    });
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
      throw new Error(`ChatBedrockConverse does not support 'jsonMode'.`);
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

    const supportsToolChoiceValues = this.supportsToolChoiceValues ?? [];
    let toolChoiceObj: { tool_choice: string } | undefined;
    if (supportsToolChoiceValues.includes("tool")) {
      toolChoiceObj = {
        tool_choice: tools[0].function.name,
      };
    } else if (supportsToolChoiceValues.includes("any")) {
      toolChoiceObj = {
        tool_choice: "any",
      };
    }

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
