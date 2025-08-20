import {
  AIMessage,
  convertMessageLike,
  isMessage,
  isMessageLike,
  Message,
  MessageLike,
  MessageTuple,
} from "../_standard/message.js";
import { iife } from "../_standard/utils.js";
import { BasePromptValueInterface } from "../prompt_values.js";
import {
  Runnable,
  RunnableConfig,
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
  RunnableToolLike,
} from "../runnables/index.js";
import {
  CallbackManager,
  CallbackManagerForChatModelRun,
  Callbacks,
} from "../callbacks/manager.js";
import { concat } from "../utils/stream.js";
import { AsyncCaller, AsyncCallerParams } from "../utils/async_caller.js";
import { JSONSchema, toJsonSchema } from "../utils/json_schema.js";
import { callbackHandlerPrefersStreaming } from "../callbacks/base.js";
import { BaseCacheV1, InMemoryCacheV1 } from "../caches/v1.js";
import { AIMessageChunk, MessageChunk } from "../_standard/chunk.js";
import {
  getSchemaDescription,
  InteropZodType,
  isInteropZodSchema,
} from "../utils/types/zod.js";
import {
  StructuredToolInterface,
  StructuredToolParams,
} from "../tools/types.js";
import { FunctionDefinition } from "./base.js";

export type Constructor<T> = new (...args: unknown[]) => T;

export interface ToolDefinition {
  type: "function";
  function: FunctionDefinition;
}

export type ChatModelOutputParser<T = unknown> = Runnable<Message, T>;
export type InferChatModelOutput<
  TOutputParser extends ChatModelOutputParser | undefined
> = TOutputParser extends undefined
  ? Message[]
  : TOutputParser extends ChatModelOutputParser<infer T>
  ? T
  : never;

export type BindToolsInput =
  | StructuredToolInterface
  | StructuredToolParams
  | RunnableToolLike
  | ToolDefinition;

export type StructuredOutputMethodOptions<IncludeRaw extends boolean = false> =
  {
    name?: string;
    method?: "functionCalling" | "jsonMode" | "jsonSchema" | string;
    includeRaw?: IncludeRaw;
    strict?: boolean;
  };

export type LangSmithParams = {
  ls_provider?: string;
  ls_model_name?: string;
  ls_model_type: "chat";
  ls_temperature?: number;
  ls_max_tokens?: number;
  ls_stop?: Array<string>;
};

export interface BaseChatModelParams extends AsyncCallerParams {
  verbose?: boolean;
  callbacks?: Callbacks;
  tags?: string[];
  metadata?: Record<string, unknown>;
  /**
   * The cache to use for the model.
   * - If true, will use the global cache.
   * - If false, will not use a cache.
   * - If a cache instance is provided, will use the provided cache.
   */
  cache?: BaseCacheV1 | boolean;
  /**
   * Whether to disable streaming.
   * - If true, will always bypass streaming case.
   * - If false (default), will always use streaming case if available.
   */
  disableStreaming?: boolean;
}

export interface BaseChatModelTracingCallOptions {
  /**
   * Describes the format of structured outputs.
   * This should be provided if an output is structured
   */
  ls_structured_output_format?: {
    /**
     * An object containing the method used for structured output (e.g., "jsonMode").
     */
    kwargs: { method: string };
    /**
     * The JSON schema describing the expected output structure.
     */
    schema?: JSONSchema;
  };
}

export interface BaseChatModelCallOptions
  extends RunnableConfig,
    BaseChatModelTracingCallOptions {
  /**
   * Stop tokens to use for this call.
   * If not provided, the default stop tokens for the model will be used.
   */
  stop?: string[];
}

export type BaseChatModelInput =
  | BasePromptValueInterface
  | MessageLike[]
  | Exclude<MessageLike, MessageTuple>;

export abstract class BaseChatModelV1<
    CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
    TOutputParser extends ChatModelOutputParser | undefined = undefined
  >
  extends Runnable<
    BaseChatModelInput,
    InferChatModelOutput<TOutputParser>,
    CallOptions
  >
  implements BaseChatModelParams
{
  lc_namespace = ["langchain", "chat_models", this._llmType()];

  disableStreaming = false;

  caller: AsyncCaller;

  cache?: BaseCacheV1;

  verbose: boolean;

  callbacks?: Callbacks;

  tags?: string[];

  metadata?: Record<string, unknown>;

  /** @internal */
  protected defaultOptions: CallOptions;

  /** @internal */
  protected outputParser: TOutputParser;

  invocationParams(_options?: CallOptions): unknown {
    return {};
  }

  _modelType(): string {
    return "base_chat_model" as const;
  }

  _identifyingParams(): Record<string, unknown> {
    return {};
  }

  abstract _llmType(): string;

  _separateRunnableConfigFromCallOptions(
    options?: Partial<CallOptions>
  ): [RunnableConfig, CallOptions] {
    // For backwards compat, keep `signal` in both runnableConfig and callOptions
    const [runnableConfig, callOptions] =
      super._separateRunnableConfigFromCallOptions(options);
    (callOptions as CallOptions).signal = runnableConfig.signal;
    return [runnableConfig, callOptions as CallOptions];
  }

  getLsParams(options: CallOptions): LangSmithParams {
    const providerName = this.getName().startsWith("Chat")
      ? this.getName().replace("Chat", "")
      : this.getName();

    return {
      ls_model_type: "chat",
      ls_stop: options.stop,
      ls_provider: providerName,
    };
  }

  protected _combineCallOptions(
    additionalOptions?: Partial<CallOptions>
  ): CallOptions {
    return {
      ...this.defaultOptions,
      ...(additionalOptions ?? {}),
    };
  }

  get callKeys(): string[] {
    return ["stop", "timeout", "signal", "tags", "metadata", "callbacks"];
  }

  get lc_attributes(): { [key: string]: undefined } | undefined {
    return {
      callbacks: undefined,
      verbose: undefined,
    };
  }

  constructor(protected params: BaseChatModelParams) {
    super(params);
    this.verbose = params.verbose ?? false;
    this.callbacks = params.callbacks;
    this.tags = params.tags ?? [];
    this.metadata = params.metadata ?? {};
    this.cache = iife(() => {
      if (typeof params.cache === "object") {
        return params.cache;
      } else if (params.cache) {
        return InMemoryCacheV1.global();
      }
      return undefined;
    });
    this.caller = new AsyncCaller(params ?? {});
  }

  async invoke(
    input: BaseChatModelInput,
    options: CallOptions
  ): Promise<InferChatModelOutput<TOutputParser>> {
    const messages = convertChatModelInput(input);
    // TODO: assess if we need to treat an options array as a stop token
    const parsedOptions = this._combineCallOptions(options);
    const [runnableConfig, callOptions] =
      this._separateRunnableConfigFromCallOptions(parsedOptions);

    const inheritableMetadata = {
      ...runnableConfig.metadata,
      ...this.getLsParams(callOptions),
    };
    const callbackManager = await CallbackManager.configure(
      runnableConfig.callbacks,
      this.callbacks,
      runnableConfig.tags,
      this.tags,
      inheritableMetadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const runManagers = await callbackManager?.handleChatModelStart(
      this.toJSON(),
      messages.map(formatMessagesForTracing),
      runnableConfig.runId,
      undefined,
      {
        options: callOptions,
        invocation_params: this.invocationParams(callOptions),
        batch_size: 1,
      },
      undefined,
      undefined,
      runnableConfig.runName
    );
    const output = await iife(async () => {
      if (this.cache) {
        return this.generateCached(messages, this.cache, options, runManagers);
      }
      return this.generateUncached(messages, options, runManagers);
    });
    if (this.outputParser === undefined) {
      return output as InferChatModelOutput<TOutputParser>;
    } else {
      return this.outputParser.invoke(
        output,
        options
      ) as InferChatModelOutput<TOutputParser>;
    }
  }

  async *_streamIterator(
    input: BaseChatModelInput,
    options: CallOptions
  ): AsyncGenerator<InferChatModelOutput<TOutputParser>> {
    const shouldStream = iife(() => {
      if (this.disableStreaming) return false;
      if (
        this.streamResponseChunks ===
        BaseChatModelV1.prototype.streamResponseChunks
      ) {
        return false;
      }
      return true;
    });
    if (!shouldStream) {
      yield this.invoke(input, options);
    }

    const messages = convertChatModelInput(input);
    const parsedOptions = this._combineCallOptions(options);
    const [runnableConfig, callOptions] =
      this._separateRunnableConfigFromCallOptions(parsedOptions);

    const inheritableMetadata = {
      ...runnableConfig.metadata,
      ...this.getLsParams(callOptions),
    };
    const callbackManager = await CallbackManager.configure(
      runnableConfig.callbacks,
      this.callbacks,
      runnableConfig.tags,
      this.tags,
      inheritableMetadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const runManager = await callbackManager?.handleChatModelStart(
      this.toJSON(),
      messages.map(formatMessagesForTracing),
      runnableConfig.runId,
      undefined,
      {
        options: callOptions,
        invocation_params: this.invocationParams(callOptions),
        batch_size: 1,
      },
      undefined,
      undefined,
      runnableConfig.runName
    );
    try {
      let aggregated;
      for await (const chunk of this.streamResponseChunks(
        messages,
        callOptions,
        runManager
      )) {
        aggregated = aggregated ? concat(aggregated, chunk) : chunk;
        if (this.outputParser === undefined) {
          yield chunk as InferChatModelOutput<TOutputParser>;
        } else {
          yield this.outputParser.invoke(
            chunk,
            callOptions
          ) as InferChatModelOutput<TOutputParser>;
        }
      }
      if (aggregated) {
        await runManager?.handleChatModelEnd(aggregated);
      }
      return aggregated;
    } catch (err) {
      await runManager?.handleChatModelError(err);
      throw err;
    }
  }

  protected abstract streamResponseChunks(
    input: BaseChatModelInput,
    options: CallOptions,
    runManager?: CallbackManagerForChatModelRun
  ): AsyncGenerator<MessageChunk>;

  protected abstract generate(
    input: BaseChatModelInput,
    options: CallOptions,
    runManager?: CallbackManagerForChatModelRun
  ): Promise<Message>;

  /** @internal */
  protected async generateCached(
    messages: Message[],
    cache: BaseCacheV1,
    options: CallOptions,
    runManager?: CallbackManagerForChatModelRun
  ): Promise<Message> {
    const [, callOptions] =
      this._separateRunnableConfigFromCallOptions(options);
    const cacheKey = getSerializedCacheKey({
      ...this._identifyingParams(),
      ...callOptions,
      _type: this._llmType(),
      _model: this._modelType(),
    });

    try {
      const promptKey = getSerializedCacheKey({ messages });
      const cacheResult = await cache.lookup(promptKey, cacheKey);
      if (cacheResult == null || cacheResult.length === 0) {
        const result = await this.generateUncached(
          messages,
          options,
          runManager
        );
        await cache.update(promptKey, cacheKey, [result]);
        return result;
      }
      const lastMessage = cacheResult[cacheResult.length - 1];
      if (isMessage(lastMessage) && AIMessage.isInstance(lastMessage)) {
        lastMessage.usageMetadata = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        };
        await runManager?.handleChatModelToken(lastMessage.text);
      }
      await runManager?.handleChatModelEnd(
        lastMessage,
        undefined,
        undefined,
        undefined,
        { cached: true }
      );
      return lastMessage;
    } catch (err) {
      await runManager?.handleChatModelError(
        err,
        undefined,
        undefined,
        undefined,
        { cached: true }
      );
      throw err;
    }
  }

  /** @internal */
  protected async generateUncached(
    messages: Message[],
    options: CallOptions,
    runManager?: CallbackManagerForChatModelRun
  ) {
    const [, callOptions] =
      this._separateRunnableConfigFromCallOptions(options);
    const shouldStream = iife(() => {
      if (this.disableStreaming) return false;
      if (
        this.streamResponseChunks ===
        BaseChatModelV1.prototype.streamResponseChunks
      ) {
        return false;
      }
      if (!runManager?.handlers.find(callbackHandlerPrefersStreaming)) {
        return false;
      }
      return true;
    });

    try {
      const output = await iife(async () => {
        if (shouldStream) {
          const stream = this.streamResponseChunks(
            messages,
            callOptions,
            runManager
          );
          let aggregated;
          for await (const chunk of stream) {
            aggregated = aggregated ? concat(aggregated, chunk) : chunk;
          }
          if (!aggregated) {
            // TODO: see if we need this
            throw new Error("No output from stream");
          }
          return aggregated;
        } else {
          return this.generate(messages, options, runManager);
        }
      });
      await runManager?.handleChatModelEnd(output);
      return output;
    } catch (err) {
      await runManager?.handleChatModelError(err);
      throw err;
    }
  }

  async getNumTokens() {}

  /** @internal */
  protected withOutputParser<T extends ChatModelOutputParser>(
    outputParser: T
  ): BaseChatModelV1<CallOptions, T> {
    const Cls = this.constructor as Constructor<
      BaseChatModelV1<CallOptions, T>
    >;
    const instance = new Cls(this.params);
    instance.outputParser = outputParser;
    return instance;
  }

  withConfig(config: Partial<CallOptions>): this {
    const Cls = this.constructor as Constructor<this>;
    const instance = new Cls(this.params);
    instance.defaultOptions = this._combineCallOptions(config);
    return instance;
  }

  withStructuredOutput<Output>(
    schema: InteropZodType<Output> | JSONSchema,
    config?: StructuredOutputMethodOptions<false>
  ): BaseChatModelV1<CallOptions, Runnable<Message, Output>>;

  withStructuredOutput<Output>(
    schema: InteropZodType<Output> | JSONSchema,
    config?: StructuredOutputMethodOptions<true>
  ): BaseChatModelV1<
    CallOptions,
    Runnable<Message, { raw: Message; parsed: Output }>
  >;

  withStructuredOutput<Output>(
    schema: InteropZodType<Output> | JSONSchema,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | BaseChatModelV1<CallOptions, Runnable<Message, Output>>
    | BaseChatModelV1<
        CallOptions,
        Runnable<Message, { raw: Message; parsed: Output }>
      >;

  withStructuredOutput<Output>(
    schema: InteropZodType<Output> | JSONSchema,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | BaseChatModelV1<CallOptions, Runnable<Message, Output>>
    | BaseChatModelV1<
        CallOptions,
        Runnable<Message, { raw: Message; parsed: Output }>
      > {
    if (typeof this.bindTools !== "function") {
      throw new Error(
        `Chat model must implement ".bindTools()" to use withStructuredOutput.`
      );
    }
    if (config?.strict) {
      throw new Error(
        `"strict" mode is not supported for this model by default.`
      );
    }

    const tools = iife(() => {
      let functionName = config?.name ?? "extract";
      if (isInteropZodSchema(schema)) {
        return [
          {
            type: "function" as const,
            function: {
              name: functionName,
              description: getSchemaDescription(schema),
              parameters: toJsonSchema(schema),
            },
          },
        ];
      } else {
        if ("name" in schema && typeof schema.name === "string") {
          functionName = schema.name;
        }
        return [
          {
            type: "function" as const,
            function: {
              name: functionName,
              description: getSchemaDescription(schema),
              parameters: schema,
            },
          },
        ];
      }
    });

    const instance = this.bindTools(tools);

    const toolMessageParser = RunnableLambda.from<AIMessageChunk, Output>(
      (input: AIMessageChunk): Output => {
        const functionName = tools[0].function.name;
        if (!input.toolCalls || input.toolCalls.length === 0) {
          throw new Error("No tool calls found in the response.");
        }
        const toolCall = input.toolCalls.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tc) => (tc as any).name === functionName
        );
        if (!toolCall) {
          throw new Error(`No tool call found with name ${functionName}.`);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (toolCall as any).args as Output;
      }
    );

    if (!config?.includeRaw) {
      return instance.withOutputParser(
        toolMessageParser.withConfig({
          runName: "StructuredOutput",
        })
      );
    }

    const parserAssign = RunnablePassthrough.assign({
      parsed: (input: any, config) =>
        toolMessageParser.invoke(input.raw, config),
    });
    const parserNone = RunnablePassthrough.assign({
      parsed: () => null,
    });
    const parserWithFallback = parserAssign.withFallbacks({
      fallbacks: [parserNone],
    });
    return instance.withOutputParser(
      RunnableSequence.from<Message, { raw: Message; parsed: Output }>([
        {
          raw: instance,
        },
        parserWithFallback,
      ]).withConfig({
        runName: "StructuredOutputRunnable",
      })
    );
  }

  abstract bindTools?(
    tools: BindToolsInput[],
    config?: Partial<CallOptions>
  ): this;
}

export function convertChatModelInput(input: BaseChatModelInput): Message[] {
  const messages: Message[] = [];

  // // BasePromptValueInterface
  // if (isPromptValue(input)) {
  //   // TODO: Implement
  //   throw new Error("not implemented");
  // }
  // MessageLike[]
  if (Array.isArray(input)) {
    for (const message of input) {
      const converted = convertMessageLike(message);
      if (converted) messages.push(converted);
    }
  }
  // Exclude<MessageLike, MessageTuple>
  else if (isMessageLike(input)) {
    const converted = convertMessageLike(input);
    if (converted) messages.push(converted);
  }
  return messages;
}

function formatMessagesForTracing(message: Message): Message {
  return message;
}

function getSerializedCacheKey(params: Record<string, unknown>): string {
  const filteredEntries = Object.entries(params).filter(
    ([_, value]) => value !== undefined
  );
  return filteredEntries
    .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
    .sort()
    .join(",");
}
