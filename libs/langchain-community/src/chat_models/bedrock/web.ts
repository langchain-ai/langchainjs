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
} from "@langchain/core/language_models/chat_models";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
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
import { StructuredToolInterface } from "@langchain/core/tools";
import { isStructuredTool } from "@langchain/core/utils/function_calling";
import { ToolCall } from "@langchain/core/messages/tool";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  BaseBedrockInput,
  BedrockLLMInputOutputAdapter,
  type CredentialType,
} from "../../utils/bedrock/index.js";
import type { SerializedFields } from "../../load/map_keys.js";

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

/**
 * A type of Large Language Model (LLM) that interacts with the Bedrock
 * service. It extends the base `LLM` class and implements the
 * `BaseBedrockInput` interface. The class is designed to authenticate and
 * interact with the Bedrock service, which is a part of Amazon Web
 * Services (AWS). It uses AWS credentials for authentication and can be
 * configured with various parameters such as the model to use, the AWS
 * region, and the maximum number of tokens to generate.
 *
 * The `BedrockChat` class supports both synchronous and asynchronous interactions with the model,
 * allowing for streaming responses and handling new token callbacks. It can be configured with
 * optional parameters like temperature, stop sequences, and guardrail settings for enhanced control
 * over the generated responses.
 *
 * @example
 * ```typescript
 * import { BedrockChat } from 'path-to-your-bedrock-chat-module';
 * import { HumanMessage } from '@langchain/core/messages';
 *
 * async function run() {
 *   // Instantiate the BedrockChat model with the desired configuration
 *   const model = new BedrockChat({
 *     model: "anthropic.claude-v2",
 *     region: "us-east-1",
 *     credentials: {
 *       accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
 *       secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
 *     },
 *     maxTokens: 150,
 *     temperature: 0.7,
 *     stopSequences: ["\n", " Human:", " Assistant:"],
 *     streaming: false,
 *     trace: "ENABLED",
 *     guardrailIdentifier: "your-guardrail-id",
 *     guardrailVersion: "1.0",
 *     guardrailConfig: {
 *       tagSuffix: "example",
 *       streamProcessingMode: "SYNCHRONOUS",
 *     },
 *   });
 *
 *   // Prepare the message to be sent to the model
 *   const message = new HumanMessage("Tell me a joke");
 *
 *   // Invoke the model with the message
 *   const res = await model.invoke([message]);
 *
 *   // Output the response from the model
 *   console.log(res);
 * }
 *
 * run().catch(console.error);
 * ```
 *
 * For streaming responses, use the following example:
 * @example
 * ```typescript
 * import { BedrockChat } from 'path-to-your-bedrock-chat-module';
 * import { HumanMessage } from '@langchain/core/messages';
 *
 * async function runStreaming() {
 *   // Instantiate the BedrockChat model with the desired configuration
 *   const model = new BedrockChat({
 *     model: "anthropic.claude-3-sonnet-20240229-v1:0",
 *     region: "us-east-1",
 *     credentials: {
 *       accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
 *       secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
 *     },
 *     maxTokens: 150,
 *     temperature: 0.7,
 *     stopSequences: ["\n", " Human:", " Assistant:"],
 *     streaming: true,
 *     trace: "ENABLED",
 *     guardrailIdentifier: "your-guardrail-id",
 *     guardrailVersion: "1.0",
 *     guardrailConfig: {
 *       tagSuffix: "example",
 *       streamProcessingMode: "SYNCHRONOUS",
 *     },
 *   });
 *
 *   // Prepare the message to be sent to the model
 *   const message = new HumanMessage("Tell me a joke");
 *
 *   // Stream the response from the model
 *   const stream = await model.stream([message]);
 *   for await (const chunk of stream) {
 *     // Output each chunk of the response
 *     console.log(chunk);
 *   }
 * }
 *
 * runStreaming().catch(console.error);
 * ```
 */
export class BedrockChat extends BaseChatModel implements BaseBedrockInput {
  model = "amazon.titan-tg1-large";

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

  protected _anthropicTools?: Record<string, unknown>[];

  get lc_aliases(): Record<string, string> {
    return {
      model: "model_id",
      region: "region_name",
    };
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      "credentials.accessKeyId": "BEDROCK_AWS_ACCESS_KEY_ID",
      "credentials.secretAccessKey": "BEDROCK_AWS_SECRET_ACCESS_KEY",
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

  constructor(fields?: Partial<BaseBedrockInput> & BaseChatModelParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    const allowedModels = [
      "ai21",
      "anthropic",
      "amazon",
      "cohere",
      "meta",
      "mistral",
    ];
    if (!allowedModels.includes(this.model.split(".")[0])) {
      throw new Error(
        `Unknown model: '${this.model}', only these are supported: ${allowedModels}`
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

    const credentials = fields?.credentials;
    if (!credentials) {
      throw new Error(
        "Please set the AWS credentials in the 'credentials' field."
      );
    }
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
    return {
      tools: this._anthropicTools,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stop: options?.stop,
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
    options: Partial<BaseChatModelParams>,
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
    options: Partial<BaseChatModelParams>,
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const service = "bedrock-runtime";
    const endpointHost =
      this.endpointHost ?? `${service}.${this.region}.amazonaws.com`;
    const provider = this.model.split(".")[0];
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
    const inputBody = this.usesMessagesApi
      ? BedrockLLMInputOutputAdapter.prepareMessagesInput(
          provider,
          messages,
          this.maxTokens,
          this.temperature,
          options.stop ?? this.stopSequences,
          this.modelKwargs,
          this.guardrailConfig,
          this._anthropicTools
        )
      : BedrockLLMInputOutputAdapter.prepareInput(
          provider,
          convertMessagesToPromptAnthropic(messages),
          this.maxTokens,
          this.temperature,
          options.stop ?? this.stopSequences,
          this.modelKwargs,
          fields.bedrockMethod,
          this.guardrailConfig
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
    if (this._anthropicTools) {
      const { generations } = await this._generateNonStreaming(
        messages,
        options
      );
      const result = generations[0].message as AIMessage;
      const toolCallChunks = result.tool_calls?.map(
        (toolCall: ToolCall, index: number) => ({
          name: toolCall.name,
          args: JSON.stringify(toolCall.args),
          id: toolCall.id,
          index,
        })
      );
      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: result.content,
          additional_kwargs: result.additional_kwargs,
          tool_call_chunks: toolCallChunks,
        }),
        text: generations[0].text,
      });
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(generations[0].text);
    } else {
      const provider = this.model.split(".")[0];
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
                chunkResult
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
                    finalMetrics.inputTokenCount +
                    finalMetrics.outputTokenCount,
                };
              }
              if (isChatGenerationChunk(chunk)) {
                yield chunk;
              }
              // eslint-disable-next-line no-void
              void runManager?.handleLLMNewToken(chunk.text);
            } else {
              const text = BedrockLLMInputOutputAdapter.prepareOutput(
                provider,
                chunkResult
              );
              yield new ChatGenerationChunk({
                text,
                message: new AIMessageChunk({ content: text }),
              });
              // eslint-disable-next-line no-void
              void runManager?.handleLLMNewToken(text);
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
    tools: (StructuredToolInterface | Record<string, unknown>)[],
    _kwargs?: Partial<BaseChatModelCallOptions>
  ): Runnable<
    BaseLanguageModelInput,
    BaseMessageChunk,
    BaseChatModelCallOptions
  > {
    const provider = this.model.split(".")[0];
    if (provider !== "anthropic") {
      throw new Error(
        "Currently, tool calling through Bedrock is only supported for Anthropic models."
      );
    }
    this._anthropicTools = tools.map((tool) => {
      if (isStructuredTool(tool)) {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: zodToJsonSchema(tool.schema),
        };
      }
      return tool;
    });
    return this;
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
  const modelProviderName = model.split(".")[0];

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

/**
 * @deprecated Use `BedrockChat` instead.
 */
export const ChatBedrock = BedrockChat;
