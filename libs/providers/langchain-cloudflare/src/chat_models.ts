import type {
  Ai,
  AbortSignal as WorkersAbortSignal,
} from "@cloudflare/workers-types";
import {
  LangSmithParams,
  BaseChatModel,
  type BindToolsInput,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import type {
  BaseLanguageModelCallOptions,
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import { Runnable } from "@langchain/core/runnables";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import {
  type InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import {
  type SerializableSchema,
  isSerializableSchema,
} from "@langchain/core/utils/standard_schema";
import {
  assembleStructuredOutputPipeline,
  createContentParser,
  createFunctionCallingParser,
} from "@langchain/core/language_models/structured_output";
import {
  parseToolCall,
  makeInvalidToolCall,
  convertLangChainToolCallToOpenAI,
} from "@langchain/core/output_parsers/openai_tools";

import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  isAIMessage,
  ToolMessage,
  type OpenAIToolCall,
  type UsageMetadata,
} from "@langchain/core/messages";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import {
  convertOpenAICompletionsStream,
  type OpenAICompletionsStreamChunk,
  type OpenAICompletionsUsage,
} from "@langchain/core/language_models/openai_completions_stream";
import { type ChatResult, ChatGenerationChunk } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

import type { CloudflareWorkersAIInput } from "./llms.js";
import { convertEventStreamToIterableReadableDataStream } from "./utils/event_source_parse.js";

/**
 * An interface defining the options for a Cloudflare Workers AI call. It extends
 * the BaseLanguageModelCallOptions interface.
 */
export interface ChatCloudflareWorkersAICallOptions extends BaseLanguageModelCallOptions {
  tools?: BindToolsInput[];
  tool_choice?:
    | "auto"
    | "none"
    | "required"
    | "any"
    | string
    | { type: "function"; function: { name: string } };
  response_format?:
    | { type: "json_object" }
    | { type: "json_schema"; json_schema: Record<string, unknown> };
  temperature?: number;
  max_tokens?: number;
  modelKwargs?: Record<string, unknown>;
}

/** Configuration for a Cloudflare Workers AI chat model. */
export interface ChatCloudflareWorkersAIInput extends CloudflareWorkersAIInput {
  /** Workers AI binding. When provided, REST credentials are not required. */
  binding?: Ai;
  temperature?: number;
  maxTokens?: number;
  /** Additional model-specific inference parameters. */
  modelKwargs?: Record<string, unknown>;
}

/**
 * A class that enables calls to the Cloudflare Workers AI API to access large language
 * models in a chat-like fashion. It extends the BaseChatModel class and
 * implements the CloudflareWorkersAIInput interface.
 * @example
 * ```typescript
 * const model = new ChatCloudflareWorkersAI({
 *   model: "@cf/meta/llama-2-7b-chat-int8",
 *   cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
 *   cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN
 * });
 *
 * const response = await model.invoke([
 *   ["system", "You are a helpful assistant that translates English to German."],
 *   ["human", `Translate "I love programming".`]
 * ]);
 *
 * console.log(response);
 * ```
 */
export class ChatCloudflareWorkersAI
  extends BaseChatModel<ChatCloudflareWorkersAICallOptions>
  implements CloudflareWorkersAIInput
{
  static lc_name() {
    return "ChatCloudflareWorkersAI";
  }

  lc_serializable = true;

  model = "@cf/meta/llama-2-7b-chat-int8";

  cloudflareAccountId?: string;

  cloudflareApiToken?: string;

  baseUrl: string;

  streaming = false;

  binding?: Ai;

  temperature?: number;

  maxTokens?: number;

  modelKwargs: Record<string, unknown>;

  constructor(
    model: string,
    params?: Omit<ChatCloudflareWorkersAIInput & BaseChatModelParams, "model">
  );
  constructor(fields?: ChatCloudflareWorkersAIInput & BaseChatModelParams);
  constructor(
    modelOrFields?:
      | string
      | (ChatCloudflareWorkersAIInput & BaseChatModelParams),
    paramsArg?: Omit<
      ChatCloudflareWorkersAIInput & BaseChatModelParams,
      "model"
    >
  ) {
    const fields =
      typeof modelOrFields === "string"
        ? { ...(paramsArg ?? {}), model: modelOrFields }
        : (modelOrFields ?? {});
    super(fields);
    this._addVersion("@langchain/cloudflare", __PKG_VERSION__);

    this.temperature = fields.temperature;
    this.maxTokens = fields.maxTokens;
    this.modelKwargs = fields.modelKwargs ?? {};
    this.binding = fields.binding;
    // A runtime binding cannot be reconstructed from serialized configuration.
    if (this.binding) this.lc_serializable = false;
    this.model = fields.model ?? this.model;
    this.streaming = fields.streaming ?? this.streaming;
    this.cloudflareAccountId =
      fields.cloudflareAccountId ??
      getEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID");
    this.cloudflareApiToken =
      fields.cloudflareApiToken ??
      getEnvironmentVariable("CLOUDFLARE_API_TOKEN");
    this.baseUrl =
      fields.baseUrl ??
      `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/ai/run`;
    if (this.baseUrl.endsWith("/")) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    return {
      ls_provider: "cloudflare",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_stop: options.stop,
      ls_temperature: options.temperature ?? this.temperature,
      ls_max_tokens: options.max_tokens ?? this.maxTokens,
    };
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      cloudflareApiToken: "CLOUDFLARE_API_TOKEN",
    };
  }

  _llmType() {
    return "cloudflare";
  }

  /** Get the identifying parameters for this LLM. */
  get identifyingParams() {
    return { model: this.model };
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(options?: this["ParsedCallOptions"]) {
    const choice = options?.tool_choice;
    return {
      ...this.modelKwargs,
      ...options?.modelKwargs,
      temperature: options?.temperature ?? this.temperature,
      max_tokens: options?.max_tokens ?? this.maxTokens,
      stop: options?.stop,
      tools: options?.tools?.map((tool) => convertToOpenAITool(tool)),
      tool_choice:
        choice === "any"
          ? "required"
          : typeof choice === "string" &&
              !["auto", "none", "required"].includes(choice)
            ? { type: "function", function: { name: choice } }
            : choice,
      response_format: options?.response_format,
    };
  }

  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<ChatCloudflareWorkersAICallOptions>
  ) {
    return this.withConfig({
      ...kwargs,
      tools: tools.map((tool) => convertToOpenAITool(tool)),
    });
  }

  _combineLLMOutput() {
    return {};
  }

  /**
   * Method to validate the environment.
   */
  validateEnvironment() {
    if (this.binding) return;
    if (!this.cloudflareAccountId) {
      throw new Error(
        `No Cloudflare account ID found. Please provide it when instantiating the CloudflareWorkersAI class, or set it as "CLOUDFLARE_ACCOUNT_ID" in your environment variables.`
      );
    }
    if (!this.cloudflareApiToken) {
      throw new Error(
        `No Cloudflare API key found. Please provide it when instantiating the CloudflareWorkersAI class, or set it as "CLOUDFLARE_API_TOKEN" in your environment variables.`
      );
    }
  }

  async _request(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    stream?: boolean
  ) {
    options.signal?.throwIfAborted();
    this.validateEnvironment();
    const data = {
      ...this.invocationParams(options),
      messages: this._formatMessages(messages),
      stream,
    };
    return this.caller.callWithOptions({ signal: options.signal }, async () => {
      options.signal?.throwIfAborted();
      // Workers and DOM Response/AbortSignal types differ, but expose the same
      // runtime interfaces used by this transport.
      const response = this.binding
        ? ((await this.binding.run(this.model, data, {
            returnRawResponse: true,
            signal: options.signal as unknown as WorkersAbortSignal | undefined,
          })) as unknown as Response)
        : await fetch(`${this.baseUrl}/${this.model}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.cloudflareApiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
            signal: options.signal,
          });
      if (!response.ok) {
        throw Object.assign(
          new Error(
            `Cloudflare LLM call failed with status code ${response.status}`
          ),
          { response }
        );
      }
      return response;
    });
  }

  /** Normalize only the provider wire format; LangChain handles tool semantics. */
  private async *_streamCompletionChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): AsyncGenerator<OpenAICompletionsStreamChunk> {
    const response = await this._request(messages, options, true);
    if (!response.body)
      throw new Error("Empty response from Cloudflare. Please try again.");
    const stream = convertEventStreamToIterableReadableDataStream(
      response.body
    );
    let usage: OpenAICompletionsUsage | undefined;
    const ids = new Map<number, string | undefined>();
    for await (const chunk of stream) {
      options.signal?.throwIfAborted();
      if (chunk === "[DONE]") break;
      const data = JSON.parse(chunk) as CloudflareChatResponse;
      if (data.error)
        throw new Error(
          `Cloudflare stream error: ${JSON.stringify(data.error)}`
        );
      if (data.usage) usage = data.usage;
      const choice = data.choices?.[0];
      const delta = choice?.delta;
      const tools = delta?.tool_calls ?? data.tool_calls;
      const tool_calls = tools?.map((call, position) => {
        const index = call.index ?? position;
        const previousId = ids.get(index);
        const id = previousId === undefined ? call.id : undefined;
        ids.set(index, previousId ?? id);
        const args = call.function?.arguments ?? call.arguments;
        return {
          index,
          id,
          type: "function" as const,
          function: {
            name: call.function?.name ?? call.name,
            arguments:
              typeof args === "string"
                ? args
                : args === undefined
                  ? undefined
                  : JSON.stringify(args),
          },
        };
      });
      yield {
        id: data.id,
        model: data.model ?? this.model,
        choices: [
          {
            index: 0,
            finish_reason: choice?.finish_reason,
            delta: {
              ...delta,
              content:
                delta?.content ??
                (typeof data.response === "string" ? data.response : undefined),
              tool_calls,
            },
          },
        ],
      };
    }
    options.signal?.throwIfAborted();
    // Legacy native calls have no IDs. Supply them without buffering arguments.
    for (const [index, id] of ids) {
      if (id === undefined)
        yield {
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  { index, id: crypto.randomUUID(), type: "function" },
                ],
              },
            },
          ],
        };
    }
    // Native streams report cumulative usage repeatedly. Both consumers receive
    // only the final aggregate, avoiding additive usage overcounting.
    if (usage) yield { choices: [], usage };
  }

  override async *_streamChatModelEvents(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatModelStreamEvent> {
    yield* convertOpenAICompletionsStream(
      this._streamCompletionChunks(messages, options),
      {
        provider: "cloudflare",
        streamUsage: true,
      }
    );
  }

  // As in ChatGroq, retain the legacy ChatGenerationChunk interface alongside
  // the shared event converter. Both paths consume the same normalized stream.
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    for await (const data of this._streamCompletionChunks(messages, options)) {
      const choice = data.choices?.[0];
      const delta = choice?.delta;
      const text = delta?.content ?? "";
      const generation = new ChatGenerationChunk({
        text,
        message: new AIMessageChunk({
          content: text,
          id: data.id,
          tool_call_chunks: delta?.tool_calls?.map((call) => ({
            index: call.index,
            id: call.id,
            name: call.function?.name,
            args: call.function?.arguments ?? "",
            type: "tool_call_chunk",
          })),
          additional_kwargs: delta?.reasoning_content
            ? { reasoning_content: delta.reasoning_content }
            : {},
          usage_metadata: data.usage ? usageMetadata(data.usage) : undefined,
          response_metadata: choice?.finish_reason
            ? { finish_reason: choice.finish_reason, model_name: data.model }
            : {},
        }),
        generationInfo: choice?.finish_reason
          ? { finish_reason: choice.finish_reason }
          : undefined,
      });
      yield generation;
      if (text)
        await runManager?.handleLLMNewToken(
          text,
          undefined,
          undefined,
          undefined,
          undefined,
          { chunk: generation }
        );
    }
  }

  protected _formatMessages(
    messages: BaseMessage[]
  ): Record<string, unknown>[] {
    return messages.map((message) => {
      let role: string;
      if (message._getType() === "human") role = "user";
      else if (message._getType() === "ai") role = "assistant";
      else if (message._getType() === "system") role = "system";
      else if (ToolMessage.isInstance(message)) role = "tool";
      else if (ChatMessage.isInstance(message)) role = message.role;
      else
        throw new Error(
          `Unsupported message type passed to Cloudflare: "${message._getType()}"`
        );
      const formatted: Record<string, unknown> = {
        role,
        content: message.content,
      };
      if (ToolMessage.isInstance(message))
        formatted.tool_call_id = message.tool_call_id;
      if (isAIMessage(message)) {
        // Core stream events produce standard content blocks. The provider
        // expects tool calls and reasoning outside the text content field.
        if (
          message.response_metadata.output_version === "v1" &&
          Array.isArray(message.content)
        ) {
          formatted.content = message.text;
          const reasoning = message.content
            .flatMap((block) =>
              typeof block !== "string" &&
              block.type === "reasoning" &&
              typeof block.reasoning === "string"
                ? [block.reasoning]
                : []
            )
            .join("");
          if (reasoning) formatted.reasoning_content = reasoning;
        }
        if (message.tool_calls?.length)
          formatted.tool_calls = message.tool_calls.map(
            convertLangChainToolCallToOpenAI
          );
        else if (message.additional_kwargs.tool_calls)
          formatted.tool_calls = message.additional_kwargs.tool_calls;
        if (message.additional_kwargs.reasoning_content)
          formatted.reasoning_content =
            message.additional_kwargs.reasoning_content;
      }
      return formatted;
    });
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    options.signal?.throwIfAborted();
    if (this.streaming) {
      let result: ChatGenerationChunk | undefined;
      for await (const chunk of this._streamResponseChunks(
        messages,
        options,
        runManager
      ))
        result = result ? result.concat(chunk) : chunk;
      if (!result)
        throw new Error("Empty response from Cloudflare. Please try again.");
      return { generations: [result] };
    }
    const response = await this._request(messages, options);
    const body = await response.json();
    const data = (this.binding ? body : body.result) as CloudflareChatResponse;
    if (!data || data.error)
      throw new Error(
        `Invalid Cloudflare response: ${JSON.stringify(data?.error)}`
      );
    const choice = data.choices?.[0];
    const output = choice?.message;
    const text =
      output?.content ??
      (typeof data.response === "string"
        ? data.response
        : data.response == null
          ? ""
          : JSON.stringify(data.response));
    const rawTools: OpenAIToolCall[] = (
      output?.tool_calls ??
      data.tool_calls ??
      []
    ).map((call) => ({
      id: call.id ?? crypto.randomUUID(),
      type: "function",
      function: {
        name: call.function?.name ?? call.name ?? "",
        arguments:
          typeof (call.function?.arguments ?? call.arguments) === "string"
            ? ((call.function?.arguments ?? call.arguments) as string)
            : JSON.stringify(call.arguments ?? {}),
      },
    }));
    const tool_calls = [];
    const invalid_tool_calls = [];
    for (const raw of rawTools) {
      try {
        tool_calls.push(parseToolCall(raw, { returnId: true }));
      } catch (error) {
        invalid_tool_calls.push(makeInvalidToolCall(raw, String(error)));
      }
    }
    if (data.response === undefined && !output && rawTools.length === 0)
      throw new Error("Cloudflare response contains no message.");
    const message = new AIMessage({
      content: text,
      id: data.id,
      tool_calls,
      invalid_tool_calls,
      additional_kwargs: {
        ...(rawTools.length ? { tool_calls: rawTools } : {}),
        ...(output?.reasoning_content
          ? { reasoning_content: output.reasoning_content }
          : {}),
      },
      usage_metadata: data.usage ? usageMetadata(data.usage) : undefined,
      response_metadata: {
        model_name: data.model ?? this.model,
        ...(choice?.finish_reason
          ? { finish_reason: choice.finish_reason }
          : {}),
      },
    });
    return {
      generations: [
        {
          text,
          message,
          generationInfo: choice?.finish_reason
            ? { finish_reason: choice.finish_reason }
            : undefined,
        },
      ],
    };
  }

  withStructuredOutput<
    RunOutput extends Record<string, unknown> = Record<string, unknown>,
  >(
    schema:
      | InteropZodType<RunOutput>
      | SerializableSchema<RunOutput>
      | Record<string, unknown>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;
  withStructuredOutput<
    RunOutput extends Record<string, unknown> = Record<string, unknown>,
  >(
    schema:
      | InteropZodType<RunOutput>
      | SerializableSchema<RunOutput>
      | Record<string, unknown>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;
  withStructuredOutput<
    RunOutput extends Record<string, unknown> = Record<string, unknown>,
  >(
    schema:
      | InteropZodType<RunOutput>
      | SerializableSchema<RunOutput>
      | Record<string, unknown>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    const method = config?.method ?? "functionCalling";
    const name = config?.name ?? "extract";
    const jsonSchema =
      isInteropZodSchema(schema) || isSerializableSchema(schema)
        ? toJsonSchema(schema)
        : schema;
    let model: Runnable<BaseLanguageModelInput>;
    let parser;
    if (method === "functionCalling") {
      model = this.bindTools(
        [
          {
            type: "function",
            function: {
              name,
              description: jsonSchema.description ?? "Extract structured data",
              parameters: jsonSchema,
              ...(config?.strict === undefined
                ? {}
                : { strict: config.strict }),
            },
          },
        ],
        { tool_choice: name }
      );
      parser = createFunctionCallingParser(schema, name);
    } else if (method === "jsonMode" || method === "jsonSchema") {
      if (config?.strict && method === "jsonMode")
        throw new Error("strict is not supported with jsonMode.");
      model = this.withConfig({
        response_format:
          method === "jsonMode"
            ? { type: "json_object" }
            : {
                type: "json_schema",
                json_schema: {
                  name,
                  schema: jsonSchema,
                  ...(config?.strict === undefined
                    ? {}
                    : { strict: config.strict }),
                },
              },
      });
      parser = createContentParser(schema);
    } else throw new Error(`Unsupported structured output method: ${method}`);
    return assembleStructuredOutputPipeline(
      model,
      parser,
      config?.includeRaw,
      "CloudflareStructuredOutput"
    );
  }
}

type CloudflareToolCall = {
  index?: number;
  id?: string;
  name?: string;
  arguments?: string | Record<string, unknown>;
  function?: { name?: string; arguments?: string };
};
type CloudflareChatResponse = {
  id?: string;
  model?: string;
  error?: unknown;
  response?: string | Record<string, unknown>;
  tool_calls?: CloudflareToolCall[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: CloudflareToolCall[];
      reasoning_content?: string;
    };
    delta?: {
      content?: string | null;
      tool_calls?: CloudflareToolCall[];
      reasoning_content?: string;
    };
    finish_reason?: string | null;
  }[];
};
function usageMetadata(
  usage: NonNullable<CloudflareChatResponse["usage"]>
): UsageMetadata {
  const input_tokens = usage.prompt_tokens ?? 0;
  const output_tokens = usage.completion_tokens ?? 0;
  return {
    input_tokens,
    output_tokens,
    total_tokens: usage.total_tokens ?? input_tokens + output_tokens,
  };
}
