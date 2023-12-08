import { SignatureV4 } from "@smithy/signature-v4";
import { HttpRequest } from "@smithy/protocol-http";
import { EventStreamCodec } from "@smithy/eventstream-codec";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";
import { Sha256 } from "@aws-crypto/sha256-js";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  SimpleChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  AIMessageChunk,
  BaseMessage,
  AIMessage,
  ChatMessage,
} from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";

import {
  BaseBedrockInput,
  BedrockLLMInputOutputAdapter,
  type CredentialType,
} from "../../utils/bedrock.js";
import type { SerializedFields } from "../../load/map_keys.js";

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
 * @example
 * ```typescript
 * const model = new BedrockChat({
 *   model: "anthropic.claude-v2",
 *   region: "us-east-1",
 * });
 * const res = await model.invoke([{ content: "Tell me a joke" }]);
 * console.log(res);
 * ```
 */
export class BedrockChat extends SimpleChatModel implements BaseBedrockInput {
  model = "amazon.titan-tg1-large";

  region: string;

  credentials: CredentialType;

  temperature?: number | undefined = undefined;

  maxTokens?: number | undefined = undefined;

  fetchFn: typeof fetch;

  endpointHost?: string;

  /** @deprecated */
  stopSequences?: string[];

  modelKwargs?: Record<string, unknown>;

  codec: EventStreamCodec = new EventStreamCodec(toUtf8, fromUtf8);

  streaming = false;

  lc_serializable = true;

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

  _llmType() {
    return "bedrock";
  }

  static lc_name() {
    return "BedrockChat";
  }

  constructor(fields?: Partial<BaseBedrockInput> & BaseChatModelParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    const allowedModels = ["ai21", "anthropic", "amazon", "cohere", "meta"];
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
  }

  /** Call out to Bedrock service model.
    Arguments:
      prompt: The prompt to pass into the model.

    Returns:
      The string generated by the model.

    Example:
      response = model.call("Tell me a joke.")
  */
  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const service = "bedrock-runtime";
    const endpointHost =
      this.endpointHost ?? `${service}.${this.region}.amazonaws.com`;
    const provider = this.model.split(".")[0];
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
      const messageContent = finalResult?.message.content;
      if (messageContent && typeof messageContent !== "string") {
        throw new Error(
          "Non-string output for ChatBedrock is currently not supported."
        );
      }
      return messageContent ?? "";
    }

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
    const text = BedrockLLMInputOutputAdapter.prepareOutput(provider, json);
    return text;
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
    const inputBody = BedrockLLMInputOutputAdapter.prepareInput(
      provider,
      convertMessagesToPromptAnthropic(messages),
      this.maxTokens,
      this.temperature,
      options.stop ?? this.stopSequences,
      this.modelKwargs,
      fields.bedrockMethod
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
    const provider = this.model.split(".")[0];
    const service = "bedrock-runtime";

    const endpointHost =
      this.endpointHost ?? `${service}.${this.region}.amazonaws.com`;

    const bedrockMethod =
      provider === "anthropic" || provider === "cohere" || provider === "meta"
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
      provider === "meta"
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
      if (buffer.byteLength === 0) return 0;
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

          while (buffer.byteLength > 0 && buffer.byteLength >= messageLength) {
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
}

/**
 * @deprecated Use `BedrockChat` instead.
 */
export const ChatBedrock = BedrockChat;
