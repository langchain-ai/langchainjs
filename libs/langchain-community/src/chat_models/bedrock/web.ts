import { SignatureV4 } from "@smithy/signature-v4";
import { HttpRequest } from "@smithy/protocol-http";
import { EventStreamCodec } from "@smithy/eventstream-codec";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";
import { Sha256 } from "@aws-crypto/sha256-js";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel,
  LangSmithParams,
  BaseChatModelCallOptions,
  BindToolsInput,
} from "@langchain/core/language_models/chat_models";
import {
  BaseLanguageModelInput,
  isOpenAITool,
} from "@langchain/core/language_models/base";
import { Runnable } from "@langchain/core/runnables";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  AIMessageChunk,
  BaseMessage,
  AIMessage,
  ChatMessage,
  BaseMessageChunk,
  isAIMessage,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import {
  isLangChainTool,
  isStructuredTool,
} from "@langchain/core/utils/function_calling";
import { zodToJsonSchema } from "zod-to-json-schema";

import type { SerializedFields } from "../../load/map_keys.js";
import {
  BaseBedrockInput,
  BedrockLLMInputOutputAdapter,
  type CredentialType,
} from "../../utils/bedrock/index.js";
import {
  _toolsInParams,
  isAnthropicTool,
} from "../../utils/bedrock/anthropic.js";

type AnthropicTool = Record<string, unknown>;

type BedrockChatToolType = BindToolsInput | AnthropicTool;

const AWS_REGIONS = [
  "us",
  "sa",
  "me",
  "il",
  "eu",
  "cn",
  "ca",
  "ap",
  "af",
  "us-gov",
];

const ALLOWED_MODEL_PROVIDERS = [
  "ai21",
  "anthropic",
  "amazon",
  "cohere",
  "meta",
  "mistral",
];

const PRELUDE_TOTAL_LENGTH_BYTES = 4;

function convertOneMessageToText(
  message: BaseMessage,
  humanPrompt: string,
  aiPrompt: string
): string {
  if (message._getType() === "human") {
    return `${humanPrompt} ${message.content}`;
  } else if (message._getType() === "ai") {
    return `${aiPrompt} ${message.content}`;
  } else if (message._getType() === "system") {
    return `${humanPrompt} <admin>${message.content}</admin>`;
  } else if (message._getType() === "function") {
    return `${humanPrompt} ${message.content}`;
  } else if (ChatMessage.isInstance(message)) {
    return `\n\n${
      message.role[0].toUpperCase() + message.role.slice(1)
    }: {message.content}`;
  }
  throw new Error(`Unknown role: ${message._getType()}`);
}

export function convertMessagesToPromptAnthropic(
  messages: BaseMessage[],
  humanPrompt = "\n\nHuman:",
  aiPrompt = "\n\nAssistant:"
): string {
  const messagesCopy = [...messages];

  if (
    messagesCopy.length === 0 ||
    messagesCopy[messagesCopy.length - 1]._getType() !== "ai"
  ) {
    messagesCopy.push(new AIMessage({ content: "" }));
  }

  return messagesCopy
    .map((message) => convertOneMessageToText(message, humanPrompt, aiPrompt))
    .join("");
}

/**
 * Function that converts an array of messages into a single string prompt
 * that can be used as input for a chat model. It delegates the conversion
 * logic to the appropriate provider-specific function.
 * @param messages Array of messages to be converted.
 * @param options Options to be used during the conversion.
 * @returns A string prompt that can be used as input for a chat model.
 */
export function convertMessagesToPrompt(
  messages: BaseMessage[],
  provider: string
): string {
  if (provider === "anthropic") {
    return convertMessagesToPromptAnthropic(messages);
  }
  throw new Error(`Provider ${provider} does not support chat.`);
}

function formatTools(tools: BedrockChatCallOptions["tools"]): AnthropicTool[] {
  if (!tools || !tools.length) {
    return [];
  }
  if (tools.every(isLangChainTool)) {
    return tools.map((tc) => ({
      name: tc.name,
      description: tc.description,
      input_schema: zodToJsonSchema(tc.schema),
    }));
  }
  if (tools.every(isOpenAITool)) {
    return tools.map((tc) => ({
      name: tc.function.name,
      description: tc.function.description,
      input_schema: tc.function.parameters,
    }));
  }
  if (tools.every(isAnthropicTool)) {
    return tools;
  }
  if (
    tools.some(isStructuredTool) ||
    tools.some(isOpenAITool) ||
    tools.some(isAnthropicTool)
  ) {
    throw new Error(
      "All tools passed to BedrockChat must be of the same type."
    );
  }
  throw new Error("Invalid tool format received.");
}

export interface BedrockChatCallOptions extends BaseChatModelCallOptions {
  tools?: BedrockChatToolType[];
}

export interface BedrockChatFields
  extends Partial<BaseBedrockInput>,
    BaseChatModelParams {}

/**
 * AWS Bedrock chat model integration.
 *
 * Setup:
 * Install `@langchain/community` and set the following environment variables:
 *
 * ```bash
 * npm install @langchain/openai
 * export AWS_REGION="your-aws-region"
 * export AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
 * export AWS_ACCESS_KEY_ID="your-aws-access-key-id"
 * ```
 *
 * ## [Constructor args](/classes/langchain_community_chat_models_bedrock.BedrockChat.html#constructor)
 *
 * ## [Runtime args](/interfaces/langchain_community_chat_models_bedrock_web.BedrockChatCallOptions.html)
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
 *     stop: ["stop on this token!"],
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
 * import { BedrockChat } from '@langchain/community/chat_models/bedrock/web';
 *
 * const llm = new BedrockChat({
 *   region: process.env.AWS_REGION,
 *   maxRetries: 0,
 *   model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
 *   temperature: 0,
 *   maxTokens: undefined,
 *   // other params...
 * });
 *
 * // You can also pass credentials in explicitly:
 * const llmWithCredentials = new BedrockChat({
 *   region: process.env.BEDROCK_AWS_REGION,
 *   model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
 *   credentials: {
 *     secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
 *     accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
 *   },
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
 *   "content": "Here's the translation to French:\n\nJ'adore la programmation.",
 *   "additional_kwargs": {
 *     "id": "msg_bdrk_01HCZHa2mKbMZeTeHjLDd286"
 *   },
 *   "response_metadata": {
 *     "type": "message",
 *     "role": "assistant",
 *     "model": "claude-3-5-sonnet-20240620",
 *     "stop_reason": "end_turn",
 *     "stop_sequence": null,
 *     "usage": {
 *       "input_tokens": 25,
 *       "output_tokens": 19
 *     }
 *   },
 *   "tool_calls": [],
 *   "invalid_tool_calls": []
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
 *   "content": "",
 *   "additional_kwargs": {
 *     "id": "msg_bdrk_01RhFuGR9uJ2bj5GbdAma4y6"
 *   },
 *   "response_metadata": {
 *     "type": "message",
 *     "role": "assistant",
 *     "model": "claude-3-5-sonnet-20240620",
 *     "stop_reason": null,
 *     "stop_sequence": null
 *   },
 * }
 * AIMessageChunk {
 *   "content": "J",
 * }
 * AIMessageChunk {
 *   "content": "'adore la",
 * }
 * AIMessageChunk {
 *   "content": " programmation.",
 * }
 * AIMessageChunk {
 *   "content": "",
 *   "additional_kwargs": {
 *     "stop_reason": "end_turn",
 *     "stop_sequence": null
 *   },
 * }
 * AIMessageChunk {
 *   "content": "",
 *   "response_metadata": {
 *     "amazon-bedrock-invocationMetrics": {
 *       "inputTokenCount": 25,
 *       "outputTokenCount": 11,
 *       "invocationLatency": 659,
 *       "firstByteLatency": 506
 *     }
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 11,
 *     "total_tokens": 36
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
 *   "content": "J'adore la programmation.",
 *   "additional_kwargs": {
 *     "id": "msg_bdrk_017b6PuBybA51P5LZ9K6gZHm",
 *     "stop_reason": "end_turn",
 *     "stop_sequence": null
 *   },
 *   "response_metadata": {
 *     "type": "message",
 *     "role": "assistant",
 *     "model": "claude-3-5-sonnet-20240620",
 *     "stop_reason": null,
 *     "stop_sequence": null,
 *     "amazon-bedrock-invocationMetrics": {
 *       "inputTokenCount": 25,
 *       "outputTokenCount": 11,
 *       "invocationLatency": 1181,
 *       "firstByteLatency": 1177
 *     }
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 11,
 *     "total_tokens": 36
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
 * import { AIMessage } from '@langchain/core/messages';
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
 * const llmWithTools = llm.bindTools([GetWeather, GetPopulation]);
 * const aiMsg: AIMessage = await llmWithTools.invoke(
 *   "Which city is hotter today and which is bigger: LA or NY?"
 * );
 * console.log(aiMsg.tool_calls);
 * ```
 *
 * ```txt
 * [
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'Los Angeles, CA' },
 *     id: 'toolu_bdrk_01R2daqwHR931r4baVNzbe38',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'New York, NY' },
 *     id: 'toolu_bdrk_01WDadwNc7PGqVZvCN7Dr7eD',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'Los Angeles, CA' },
 *     id: 'toolu_bdrk_014b8zLkpAgpxrPfewKinJFc',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'New York, NY' },
 *     id: 'toolu_bdrk_01Tt8K2MUP15kNuMDFCLEFKN',
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
 * const Joke = z.object({
 *   setup: z.string().describe("The setup of the joke"),
 *   punchline: z.string().describe("The punchline to the joke"),
 *   rating: z.number().optional().describe("How funny the joke is, from 1 to 10")
 * }).describe('Joke to tell user.');
 *
 * const structuredLlm = llm.withStructuredOutput(Joke);
 * const jokeResult = await structuredLlm.invoke("Tell me a joke about cats");
 * console.log(jokeResult);
 * ```
 *
 * ```txt
 * {
 *   setup: "Why don't cats play poker in the jungle?",
 *   punchline: 'Too many cheetahs!'
 * }
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
 * "response_metadata": {
 *   "type": "message",
 *   "role": "assistant",
 *   "model": "claude-3-5-sonnet-20240620",
 *   "stop_reason": "end_turn",
 *   "stop_sequence": null,
 *   "usage": {
 *     "input_tokens": 25,
 *     "output_tokens": 19
 *   }
 * }
 * ```
 * </details>
 */
export class BedrockChat
  extends BaseChatModel<BedrockChatCallOptions, AIMessageChunk>
  implements BaseBedrockInput
{
  model = "amazon.titan-tg1-large";

  modelProvider: string;

  region: string;

  credentials: CredentialType;

  temperature?: number | undefined = undefined;

  maxTokens?: number | undefined = undefined;

  fetchFn: typeof fetch;

  endpointHost?: string;

  /** @deprecated Use as a call option using .bind() instead. */
  stopSequences?: string[];

  modelKwargs?: Record<string, unknown>;

  codec: EventStreamCodec = new EventStreamCodec(toUtf8, fromUtf8);

  streaming = false;

  usesMessagesApi = false;

  lc_serializable = true;

  trace?: "ENABLED" | "DISABLED";

  guardrailIdentifier = "";

  guardrailVersion = "";

  guardrailConfig?: {
    tagSuffix: string;
    streamProcessingMode: "SYNCHRONOUS" | "ASYNCHRONOUS";
  };

  get lc_aliases(): Record<string, string> {
    return {
      model: "model_id",
      region: "region_name",
    };
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      "credentials.accessKeyId": "AWS_ACCESS_KEY_ID",
      "credentials.secretAccessKey": "AWS_SECRET_ACCESS_KEY",
      "credentials.sessionToken": "AWS_SECRET_ACCESS_KEY",
      awsAccessKeyId: "AWS_ACCESS_KEY_ID",
      awsSecretAccessKey: "AWS_SECRET_ACCESS_KEY",
      awsSessionToken: "AWS_SESSION_TOKEN",
    };
  }

  get lc_attributes(): SerializedFields | undefined {
    return { region: this.region };
  }

  _identifyingParams(): Record<string, string> {
    return {
      model: this.model,
    };
  }

  _llmType() {
    return "bedrock";
  }

  static lc_name() {
    return "BedrockChat";
  }

  constructor(fields?: BedrockChatFields) {
    const awsAccessKeyId =
      fields?.awsAccessKeyId ?? getEnvironmentVariable("AWS_ACCESS_KEY_ID");
    const awsSecretAccessKey =
      fields?.awsSecretAccessKey ??
      getEnvironmentVariable("AWS_SECRET_ACCESS_KEY");
    const awsSessionToken =
      fields?.awsSessionToken ?? getEnvironmentVariable("AWS_SESSION_TOKEN");

    let credentials = fields?.credentials;
    if (credentials === undefined) {
      if (awsAccessKeyId === undefined || awsSecretAccessKey === undefined) {
        throw new Error(
          "Please set your AWS credentials in the 'credentials' field or set env vars AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, and optionally AWS_SESSION_TOKEN."
        );
      }
      credentials = {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
        sessionToken: awsSessionToken,
      };
    }

    // eslint-disable-next-line no-param-reassign
    fields = { ...fields, awsAccessKeyId, awsSecretAccessKey, awsSessionToken };

    super(fields);

    this.model = fields?.model ?? this.model;
    this.modelProvider = getModelProvider(this.model);

    if (!ALLOWED_MODEL_PROVIDERS.includes(this.modelProvider)) {
      throw new Error(
        `Unknown model provider: '${this.modelProvider}', only these are supported: ${ALLOWED_MODEL_PROVIDERS}`
      );
    }
    const region =
      fields?.region ?? getEnvironmentVariable("AWS_DEFAULT_REGION");
    if (!region) {
      throw new Error(
        "Please set the AWS_DEFAULT_REGION environment variable or pass it to the constructor as the region field."
      );
    }
    this.region = region;

    this.credentials = credentials;

    this.temperature = fields?.temperature ?? this.temperature;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.fetchFn = fields?.fetchFn ?? fetch.bind(globalThis);
    this.endpointHost = fields?.endpointHost ?? fields?.endpointUrl;
    this.stopSequences = fields?.stopSequences;
    this.modelKwargs = fields?.modelKwargs;
    this.streaming = fields?.streaming ?? this.streaming;
    this.usesMessagesApi = canUseMessagesApi(this.model);
    this.trace = fields?.trace ?? this.trace;
    this.guardrailVersion = fields?.guardrailVersion ?? this.guardrailVersion;
    this.guardrailIdentifier =
      fields?.guardrailIdentifier ?? this.guardrailIdentifier;
    this.guardrailConfig = fields?.guardrailConfig;
  }

  override invocationParams(options?: this["ParsedCallOptions"]) {
    if (options?.tool_choice) {
      throw new Error(
        "'tool_choice' call option is not supported by BedrockChat."
      );
    }

    return {
      tools: options?.tools ? formatTools(options.tools) : undefined,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stop: options?.stop ?? this.stopSequences,
      modelKwargs: this.modelKwargs,
      guardrailConfig: this.guardrailConfig,
    };
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "bedrock",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature ?? undefined,
      ls_max_tokens: params.max_tokens ?? undefined,
      ls_stop: options.stop,
    };
  }

  async _generate(
    messages: BaseMessage[],
    options: Partial<this["ParsedCallOptions"]>,
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
    const service = "bedrock-runtime";
    const endpointHost =
      this.endpointHost ?? `${service}.${this.region}.amazonaws.com`;
    const provider = this.modelProvider;
    const response = await this._signedFetch(messages, options, {
      bedrockMethod: "invoke",
      endpointHost,
      provider,
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(
        `Error ${response.status}: ${json.message ?? JSON.stringify(json)}`
      );
    }
    if (this.usesMessagesApi) {
      const outputGeneration =
        BedrockLLMInputOutputAdapter.prepareMessagesOutput(provider, json);
      if (outputGeneration === undefined) {
        throw new Error("Failed to parse output generation.");
      }
      return {
        generations: [outputGeneration],
        llmOutput: outputGeneration.generationInfo,
      };
    } else {
      const text = BedrockLLMInputOutputAdapter.prepareOutput(provider, json);
      return { generations: [{ text, message: new AIMessage(text) }] };
    }
  }

  async _signedFetch(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    fields: {
      bedrockMethod: "invoke" | "invoke-with-response-stream";
      endpointHost: string;
      provider: string;
    }
  ) {
    const { bedrockMethod, endpointHost, provider } = fields;
    const {
      max_tokens,
      temperature,
      stop,
      modelKwargs,
      guardrailConfig,
      tools,
    } = this.invocationParams(options);
    const inputBody = this.usesMessagesApi
      ? BedrockLLMInputOutputAdapter.prepareMessagesInput(
          provider,
          messages,
          max_tokens,
          temperature,
          stop,
          modelKwargs,
          guardrailConfig,
          tools
        )
      : BedrockLLMInputOutputAdapter.prepareInput(
          provider,
          convertMessagesToPromptAnthropic(messages),
          max_tokens,
          temperature,
          stop,
          modelKwargs,
          fields.bedrockMethod,
          guardrailConfig
        );

    const url = new URL(
      `https://${endpointHost}/model/${this.model}/${bedrockMethod}`
    );

    const request = new HttpRequest({
      hostname: url.hostname,
      path: url.pathname,
      protocol: url.protocol,
      method: "POST", // method must be uppercase
      body: JSON.stringify(inputBody),
      query: Object.fromEntries(url.searchParams.entries()),
      headers: {
        // host is required by AWS Signature V4: https://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
        host: url.host,
        accept: "application/json",
        "content-type": "application/json",
        ...(this.trace &&
          this.guardrailIdentifier &&
          this.guardrailVersion && {
            "X-Amzn-Bedrock-Trace": this.trace,
            "X-Amzn-Bedrock-GuardrailIdentifier": this.guardrailIdentifier,
            "X-Amzn-Bedrock-GuardrailVersion": this.guardrailVersion,
          }),
      },
    });

    const signer = new SignatureV4({
      credentials: this.credentials,
      service: "bedrock",
      region: this.region,
      sha256: Sha256,
    });

    const signedRequest = await signer.sign(request);

    // Send request to AWS using the low-level fetch API
    const response = await this.caller.callWithOptions(
      { signal: options.signal },
      async () =>
        this.fetchFn(url, {
          headers: signedRequest.headers,
          body: signedRequest.body,
          method: signedRequest.method,
        })
    );
    return response;
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const provider = this.modelProvider;
    const service = "bedrock-runtime";

    const endpointHost =
      this.endpointHost ?? `${service}.${this.region}.amazonaws.com`;

    const bedrockMethod =
      provider === "anthropic" ||
      provider === "cohere" ||
      provider === "meta" ||
      provider === "mistral"
        ? "invoke-with-response-stream"
        : "invoke";

    const response = await this._signedFetch(messages, options, {
      bedrockMethod,
      endpointHost,
      provider,
    });

    if (response.status < 200 || response.status >= 300) {
      throw Error(
        `Failed to access underlying url '${endpointHost}': got ${
          response.status
        } ${response.statusText}: ${await response.text()}`
      );
    }

    if (
      provider === "anthropic" ||
      provider === "cohere" ||
      provider === "meta" ||
      provider === "mistral"
    ) {
      const toolsInParams = _toolsInParams(options);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      for await (const chunk of this._readChunks(reader)) {
        const event = this.codec.decode(chunk);
        if (
          (event.headers[":event-type"] !== undefined &&
            event.headers[":event-type"].value !== "chunk") ||
          event.headers[":content-type"].value !== "application/json"
        ) {
          throw Error(`Failed to get event chunk: got ${chunk}`);
        }
        const body = JSON.parse(decoder.decode(event.body));
        if (body.message) {
          throw new Error(body.message);
        }
        if (body.bytes !== undefined) {
          const chunkResult = JSON.parse(
            decoder.decode(
              Uint8Array.from(atob(body.bytes), (m) => m.codePointAt(0) ?? 0)
            )
          );
          if (this.usesMessagesApi) {
            const chunk = BedrockLLMInputOutputAdapter.prepareMessagesOutput(
              provider,
              chunkResult,
              {
                // Content should _ONLY_ be coerced if tools are not in params
                // If they are, we need content to be of type MessageTypeComplex
                // so the tools can be passed through.
                coerceContentToString: !toolsInParams,
              }
            );
            if (chunk === undefined) {
              continue;
            }
            if (
              provider === "anthropic" &&
              chunk.generationInfo?.usage !== undefined
            ) {
              // Avoid bad aggregation in chunks, rely on final Bedrock data
              delete chunk.generationInfo.usage;
            }
            const finalMetrics =
              chunk.generationInfo?.["amazon-bedrock-invocationMetrics"];
            if (
              finalMetrics != null &&
              typeof finalMetrics === "object" &&
              isAIMessage(chunk.message)
            ) {
              chunk.message.usage_metadata = {
                input_tokens: finalMetrics.inputTokenCount,
                output_tokens: finalMetrics.outputTokenCount,
                total_tokens:
                  finalMetrics.inputTokenCount + finalMetrics.outputTokenCount,
              };
            }
            if (isChatGenerationChunk(chunk)) {
              yield chunk;
              // eslint-disable-next-line no-void
              void runManager?.handleLLMNewToken(
                chunk.text,
                undefined,
                undefined,
                undefined,
                undefined,
                {
                  chunk,
                }
              );
            } else {
              // eslint-disable-next-line no-void
              void runManager?.handleLLMNewToken(chunk.text);
            }
          } else {
            const text = BedrockLLMInputOutputAdapter.prepareOutput(
              provider,
              chunkResult
            );
            const chunk = new ChatGenerationChunk({
              text,
              message: new AIMessageChunk({ content: text }),
            });
            yield chunk;
            // eslint-disable-next-line no-void
            void runManager?.handleLLMNewToken(
              text,
              undefined,
              undefined,
              undefined,
              undefined,
              { chunk }
            );
          }
        }
      }
    } else {
      const json = await response.json();
      const text = BedrockLLMInputOutputAdapter.prepareOutput(provider, json);
      yield new ChatGenerationChunk({
        text,
        message: new AIMessageChunk({ content: text }),
      });
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(text);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _readChunks(reader: any) {
    function _concatChunks(a: Uint8Array, b: Uint8Array) {
      const newBuffer = new Uint8Array(a.length + b.length);
      newBuffer.set(a);
      newBuffer.set(b, a.length);
      return newBuffer;
    }

    function getMessageLength(buffer: Uint8Array) {
      if (buffer.byteLength < PRELUDE_TOTAL_LENGTH_BYTES) return 0;
      const view = new DataView(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength
      );

      return view.getUint32(0, false);
    }

    return {
      async *[Symbol.asyncIterator]() {
        let readResult = await reader.read();

        let buffer: Uint8Array = new Uint8Array(0);
        while (!readResult.done) {
          const chunk: Uint8Array = readResult.value;

          buffer = _concatChunks(buffer, chunk);
          let messageLength = getMessageLength(buffer);

          while (
            buffer.byteLength >= PRELUDE_TOTAL_LENGTH_BYTES &&
            buffer.byteLength >= messageLength
          ) {
            yield buffer.slice(0, messageLength);
            buffer = buffer.slice(messageLength);
            messageLength = getMessageLength(buffer);
          }

          readResult = await reader.read();
        }
      },
    };
  }

  _combineLLMOutput() {
    return {};
  }

  override bindTools(
    tools: BedrockChatToolType[],
    _kwargs?: Partial<this["ParsedCallOptions"]>
  ): Runnable<
    BaseLanguageModelInput,
    BaseMessageChunk,
    this["ParsedCallOptions"]
  > {
    const provider = this.modelProvider;
    if (provider !== "anthropic") {
      throw new Error(
        "Currently, tool calling through Bedrock is only supported for Anthropic models."
      );
    }
    return this.bind({
      tools: formatTools(tools),
    });
  }
}

function isChatGenerationChunk(
  x?: ChatGenerationChunk | ChatGeneration
): x is ChatGenerationChunk {
  return (
    x !== undefined && typeof (x as ChatGenerationChunk).concat === "function"
  );
}

function canUseMessagesApi(model: string): boolean {
  const modelProviderName = getModelProvider(model);

  if (
    modelProviderName === "anthropic" &&
    !model.includes("claude-v2") &&
    !model.includes("claude-instant-v1")
  ) {
    return true;
  }

  if (modelProviderName === "cohere") {
    if (model.includes("command-r-v1")) {
      return true;
    }
    if (model.includes("command-r-plus-v1")) {
      return true;
    }
  }

  return false;
}

function isInferenceModel(modelId: string): boolean {
  const parts = modelId.split(".");
  return AWS_REGIONS.some((region) => parts[0] === region);
}

function getModelProvider(modelId: string): string {
  const parts = modelId.split(".");
  if (isInferenceModel(modelId)) {
    return parts[1];
  } else {
    return parts[0];
  }
}

/**
 * @deprecated Use `BedrockChat` instead.
 */
export const ChatBedrock = BedrockChat;
