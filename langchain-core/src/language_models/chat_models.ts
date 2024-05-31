import {
  AIMessage,
  type BaseMessage,
  BaseMessageChunk,
  type BaseMessageLike,
  HumanMessage,
  coerceMessageLikeToMessage,
} from "../messages/index.js";
import type { BasePromptValueInterface } from "../prompt_values.js";
import {
  LLMResult,
  RUN_KEY,
  type ChatGeneration,
  ChatGenerationChunk,
  type ChatResult,
  type Generation,
} from "../outputs.js";
import {
  BaseLanguageModel,
  type BaseLanguageModelCallOptions,
  type BaseLanguageModelInput,
  type BaseLanguageModelParams,
} from "./base.js";
import {
  CallbackManager,
  type CallbackManagerForLLMRun,
  type Callbacks,
} from "../callbacks/manager.js";
import type { RunnableConfig } from "../runnables/config.js";
import type { BaseCache } from "../caches.js";
import { StructuredToolInterface } from "../tools.js";
import { Runnable } from "../runnables/base.js";
import { isStreamEventsHandler } from "../tracers/event_stream.js";
import { isLogStreamHandler } from "../tracers/log_stream.js";
import { concat } from "../utils/stream.js";

/**
 * Represents a serialized chat model.
 */
export type SerializedChatModel = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

// todo?
/**
 * Represents a serialized large language model.
 */
export type SerializedLLM = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

/**
 * Represents the parameters for a base chat model.
 */
export type BaseChatModelParams = BaseLanguageModelParams;

/**
 * Represents the call options for a base chat model.
 */
export type BaseChatModelCallOptions = BaseLanguageModelCallOptions;

/**
 * Creates a transform stream for encoding chat message chunks.
 * @deprecated Use {@link BytesOutputParser} instead
 * @returns A TransformStream instance that encodes chat message chunks.
 */
export function createChatMessageChunkEncoderStream() {
  const textEncoder = new TextEncoder();
  return new TransformStream<BaseMessageChunk>({
    transform(chunk: BaseMessageChunk, controller) {
      controller.enqueue(
        textEncoder.encode(
          typeof chunk.content === "string"
            ? chunk.content
            : JSON.stringify(chunk.content)
        )
      );
    },
  });
}

export type LangSmithParams = {
  ls_provider?: string;
  ls_model_name?: string;
  ls_model_type: "chat";
  ls_temperature?: number;
  ls_max_tokens?: number;
  ls_stop?: Array<string>;
};

interface ChatModelGenerateCachedParameters<
  T extends BaseChatModel<CallOptions>,
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions
> {
  messages: BaseMessageLike[][];
  cache: BaseCache<Generation[]>;
  llmStringKey: string;
  parsedOptions: T["ParsedCallOptions"];
  handledOptions: RunnableConfig;
}

/**
 * Base class for chat models. It extends the BaseLanguageModel class and
 * provides methods for generating chat based on input messages.
 */
export abstract class BaseChatModel<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  // TODO: Fix the parameter order on the next minor version.
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
> extends BaseLanguageModel<OutputMessageType, CallOptions> {
  declare ParsedCallOptions: Omit<
    CallOptions,
    keyof RunnableConfig & "timeout"
  >;

  // Only ever instantiated in main LangChain
  lc_namespace = ["langchain", "chat_models", this._llmType()];

  constructor(fields: BaseChatModelParams) {
    super(fields);
  }

  _combineLLMOutput?(
    ...llmOutputs: LLMResult["llmOutput"][]
  ): LLMResult["llmOutput"];

  protected _separateRunnableConfigFromCallOptions(
    options?: Partial<CallOptions>
  ): [RunnableConfig, this["ParsedCallOptions"]] {
    const [runnableConfig, callOptions] =
      super._separateRunnableConfigFromCallOptions(options);
    if (callOptions?.timeout && !callOptions.signal) {
      callOptions.signal = AbortSignal.timeout(callOptions.timeout);
    }
    return [runnableConfig, callOptions as this["ParsedCallOptions"]];
  }

  /**
   * Bind tool-like objects to this chat model.
   *
   * @param tools A list of tool definitions to bind to this chat model.
   * Can be a structured tool or an object matching the provider's
   * specific tool schema.
   * @param kwargs Any additional parameters to bind.
   */
  bindTools?(
    tools: (StructuredToolInterface | Record<string, unknown>)[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, OutputMessageType, CallOptions>;

  /**
   * Invokes the chat model with a single input.
   * @param input The input for the language model.
   * @param options The call options.
   * @returns A Promise that resolves to a BaseMessageChunk.
   */
  async invoke(
    input: BaseLanguageModelInput,
    options?: CallOptions
  ): Promise<OutputMessageType> {
    const promptValue = BaseChatModel._convertInputToPromptValue(input);
    const result = await this.generatePrompt(
      [promptValue],
      options,
      options?.callbacks
    );
    const chatGeneration = result.generations[0][0] as ChatGeneration;
    // TODO: Remove cast after figuring out inheritance
    return chatGeneration.message as OutputMessageType;
  }

  // eslint-disable-next-line require-yield
  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    throw new Error("Not implemented.");
  }

  async *_streamIterator(
    input: BaseLanguageModelInput,
    options?: CallOptions
  ): AsyncGenerator<OutputMessageType> {
    // Subclass check required to avoid double callbacks with default implementation
    if (
      this._streamResponseChunks ===
      BaseChatModel.prototype._streamResponseChunks
    ) {
      yield this.invoke(input, options);
    } else {
      const prompt = BaseChatModel._convertInputToPromptValue(input);
      const messages = prompt.toChatMessages();
      const [runnableConfig, callOptions] =
        this._separateRunnableConfigFromCallOptions(options);

      const inheritableMetadata = {
        ...runnableConfig.metadata,
        ...this.getLsParams(callOptions),
      };
      const callbackManager_ = await CallbackManager.configure(
        runnableConfig.callbacks,
        this.callbacks,
        runnableConfig.tags,
        this.tags,
        inheritableMetadata,
        this.metadata,
        { verbose: this.verbose }
      );
      const extra = {
        options: callOptions,
        invocation_params: this?.invocationParams(callOptions),
        batch_size: 1,
      };
      const runManagers = await callbackManager_?.handleChatModelStart(
        this.toJSON(),
        [messages],
        runnableConfig.runId,
        undefined,
        extra,
        undefined,
        undefined,
        runnableConfig.runName
      );
      let generationChunk: ChatGenerationChunk | undefined;
      try {
        for await (const chunk of this._streamResponseChunks(
          messages,
          callOptions,
          runManagers?.[0]
        )) {
          chunk.message.response_metadata = {
            ...chunk.generationInfo,
            ...chunk.message.response_metadata,
          };
          yield chunk.message as OutputMessageType;
          if (!generationChunk) {
            generationChunk = chunk;
          } else {
            generationChunk = generationChunk.concat(chunk);
          }
        }
      } catch (err) {
        await Promise.all(
          (runManagers ?? []).map((runManager) =>
            runManager?.handleLLMError(err)
          )
        );
        throw err;
      }
      await Promise.all(
        (runManagers ?? []).map((runManager) =>
          runManager?.handleLLMEnd({
            // TODO: Remove cast after figuring out inheritance
            generations: [[generationChunk as ChatGeneration]],
          })
        )
      );
    }
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    return {
      ls_model_type: "chat",
      ls_stop: options.stop,
    };
  }

  /** @ignore */
  async _generateUncached(
    messages: BaseMessageLike[][],
    parsedOptions: this["ParsedCallOptions"],
    handledOptions: RunnableConfig
  ): Promise<LLMResult> {
    const baseMessages = messages.map((messageList) =>
      messageList.map(coerceMessageLikeToMessage)
    );

    const inheritableMetadata = {
      ...handledOptions.metadata,
      ...this.getLsParams(parsedOptions),
    };
    // create callback manager and start run
    const callbackManager_ = await CallbackManager.configure(
      handledOptions.callbacks,
      this.callbacks,
      handledOptions.tags,
      this.tags,
      inheritableMetadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const extra = {
      options: parsedOptions,
      invocation_params: this?.invocationParams(parsedOptions),
      batch_size: 1,
    };
    const runManagers = await callbackManager_?.handleChatModelStart(
      this.toJSON(),
      baseMessages,
      handledOptions.runId,
      undefined,
      extra,
      undefined,
      undefined,
      handledOptions.runName
    );
    const generations: ChatGeneration[][] = [];
    const llmOutputs: LLMResult["llmOutput"][] = [];
    // Even if stream is not explicitly called, check if model is implicitly
    // called from streamEvents() or streamLog() to get all streamed events.
    // Bail out if _streamResponseChunks not overridden
    const hasStreamingHandler = !!runManagers?.[0].handlers.find((handler) => {
      return isStreamEventsHandler(handler) || isLogStreamHandler(handler);
    });
    if (
      hasStreamingHandler &&
      baseMessages.length === 1 &&
      this._streamResponseChunks !==
        BaseChatModel.prototype._streamResponseChunks
    ) {
      try {
        const stream = await this._streamResponseChunks(
          baseMessages[0],
          parsedOptions,
          runManagers?.[0]
        );
        let aggregated;
        for await (const chunk of stream) {
          if (aggregated === undefined) {
            aggregated = chunk;
          } else {
            aggregated = concat(aggregated, chunk);
          }
        }
        if (aggregated === undefined) {
          throw new Error("Received empty response from chat model call.");
        }
        generations.push([aggregated]);
        await runManagers?.[0].handleLLMEnd({
          generations,
          llmOutput: {},
        });
      } catch (e) {
        await runManagers?.[0].handleLLMError(e);
        throw e;
      }
    } else {
      // generate results
      const results = await Promise.allSettled(
        baseMessages.map((messageList, i) =>
          this._generate(
            messageList,
            { ...parsedOptions, promptIndex: i },
            runManagers?.[i]
          )
        )
      );
      // handle results
      await Promise.all(
        results.map(async (pResult, i) => {
          if (pResult.status === "fulfilled") {
            const result = pResult.value;
            for (const generation of result.generations) {
              generation.message.response_metadata = {
                ...generation.generationInfo,
                ...generation.message.response_metadata,
              };
            }
            if (result.generations.length === 1) {
              result.generations[0].message.response_metadata = {
                ...result.llmOutput,
                ...result.generations[0].message.response_metadata,
              };
            }
            generations[i] = result.generations;
            llmOutputs[i] = result.llmOutput;
            return runManagers?.[i]?.handleLLMEnd({
              generations: [result.generations],
              llmOutput: result.llmOutput,
            });
          } else {
            // status === "rejected"
            await runManagers?.[i]?.handleLLMError(pResult.reason);
            return Promise.reject(pResult.reason);
          }
        })
      );
    }
    // create combined output
    const output: LLMResult = {
      generations,
      llmOutput: llmOutputs.length
        ? this._combineLLMOutput?.(...llmOutputs)
        : undefined,
    };
    Object.defineProperty(output, RUN_KEY, {
      value: runManagers
        ? { runIds: runManagers?.map((manager) => manager.runId) }
        : undefined,
      configurable: true,
    });
    return output;
  }

  async _generateCached({
    messages,
    cache,
    llmStringKey,
    parsedOptions,
    handledOptions,
  }: ChatModelGenerateCachedParameters<typeof this>): Promise<
    LLMResult & { missingPromptIndices: number[] }
  > {
    const baseMessages = messages.map((messageList) =>
      messageList.map(coerceMessageLikeToMessage)
    );

    const inheritableMetadata = {
      ...handledOptions.metadata,
      ...this.getLsParams(parsedOptions),
    };
    // create callback manager and start run
    const callbackManager_ = await CallbackManager.configure(
      handledOptions.callbacks,
      this.callbacks,
      handledOptions.tags,
      this.tags,
      inheritableMetadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const extra = {
      options: parsedOptions,
      invocation_params: this?.invocationParams(parsedOptions),
      batch_size: 1,
      cached: true,
    };
    const runManagers = await callbackManager_?.handleChatModelStart(
      this.toJSON(),
      baseMessages,
      handledOptions.runId,
      undefined,
      extra,
      undefined,
      undefined,
      handledOptions.runName
    );

    // generate results
    const missingPromptIndices: number[] = [];
    const results = await Promise.allSettled(
      baseMessages.map(async (baseMessage, index) => {
        // Join all content into one string for the prompt index
        const prompt =
          BaseChatModel._convertInputToPromptValue(baseMessage).toString();
        const result = await cache.lookup(prompt, llmStringKey);

        if (result == null) {
          missingPromptIndices.push(index);
        }

        return result;
      })
    );

    // Map run managers to the results before filtering out null results
    // Null results are just absent from the cache.
    const cachedResults = results
      .map((result, index) => ({ result, runManager: runManagers?.[index] }))
      .filter(
        ({ result }) =>
          (result.status === "fulfilled" && result.value != null) ||
          result.status === "rejected"
      );

    // Handle results and call run managers
    const generations: Generation[][] = [];
    await Promise.all(
      cachedResults.map(async ({ result: promiseResult, runManager }, i) => {
        if (promiseResult.status === "fulfilled") {
          const result = promiseResult.value as Generation[];
          generations[i] = result;
          if (result.length) {
            await runManager?.handleLLMNewToken(result[0].text);
          }
          return runManager?.handleLLMEnd({
            generations: [result],
          });
        } else {
          // status === "rejected"
          await runManager?.handleLLMError(promiseResult.reason);
          return Promise.reject(promiseResult.reason);
        }
      })
    );

    const output = {
      generations,
      missingPromptIndices,
    };

    // This defines RUN_KEY as a non-enumerable property on the output object
    // so that it is not serialized when the output is stringified, and so that
    // it isnt included when listing the keys of the output object.
    Object.defineProperty(output, RUN_KEY, {
      value: runManagers
        ? { runIds: runManagers?.map((manager) => manager.runId) }
        : undefined,
      configurable: true,
    });

    return output;
  }

  /**
   * Generates chat based on the input messages.
   * @param messages An array of arrays of BaseMessage instances.
   * @param options The call options or an array of stop sequences.
   * @param callbacks The callbacks for the language model.
   * @returns A Promise that resolves to an LLMResult.
   */
  async generate(
    messages: BaseMessageLike[][],
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<LLMResult> {
    // parse call options
    let parsedOptions: CallOptions | undefined;
    if (Array.isArray(options)) {
      parsedOptions = { stop: options } as CallOptions;
    } else {
      parsedOptions = options;
    }

    const baseMessages = messages.map((messageList) =>
      messageList.map(coerceMessageLikeToMessage)
    );

    const [runnableConfig, callOptions] =
      this._separateRunnableConfigFromCallOptions(parsedOptions);
    runnableConfig.callbacks = runnableConfig.callbacks ?? callbacks;

    if (!this.cache) {
      return this._generateUncached(baseMessages, callOptions, runnableConfig);
    }

    const { cache } = this;
    const llmStringKey =
      this._getSerializedCacheKeyParametersForCall(callOptions);

    const { generations, missingPromptIndices } = await this._generateCached({
      messages: baseMessages,
      cache,
      llmStringKey,
      parsedOptions: callOptions,
      handledOptions: runnableConfig,
    });

    let llmOutput = {};
    if (missingPromptIndices.length > 0) {
      const results = await this._generateUncached(
        missingPromptIndices.map((i) => baseMessages[i]),
        callOptions,
        runnableConfig
      );
      await Promise.all(
        results.generations.map(async (generation, index) => {
          const promptIndex = missingPromptIndices[index];
          generations[promptIndex] = generation;
          // Join all content into one string for the prompt index
          const prompt = BaseChatModel._convertInputToPromptValue(
            baseMessages[promptIndex]
          ).toString();
          return cache.update(prompt, llmStringKey, generation);
        })
      );
      llmOutput = results.llmOutput ?? {};
    }

    return { generations, llmOutput } as LLMResult;
  }

  /**
   * Get the parameters used to invoke the model
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invocationParams(_options?: this["ParsedCallOptions"]): any {
    return {};
  }

  _modelType(): string {
    return "base_chat_model" as const;
  }

  abstract _llmType(): string;

  /**
   * @deprecated
   * Return a json-like object representing this LLM.
   */
  serialize(): SerializedLLM {
    return {
      ...this.invocationParams(),
      _type: this._llmType(),
      _model: this._modelType(),
    };
  }

  /**
   * Generates a prompt based on the input prompt values.
   * @param promptValues An array of BasePromptValue instances.
   * @param options The call options or an array of stop sequences.
   * @param callbacks The callbacks for the language model.
   * @returns A Promise that resolves to an LLMResult.
   */
  async generatePrompt(
    promptValues: BasePromptValueInterface[],
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<LLMResult> {
    const promptMessages: BaseMessage[][] = promptValues.map((promptValue) =>
      promptValue.toChatMessages()
    );
    return this.generate(promptMessages, options, callbacks);
  }

  abstract _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult>;

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.2.0.
   *
   * Makes a single call to the chat model.
   * @param messages An array of BaseMessage instances.
   * @param options The call options or an array of stop sequences.
   * @param callbacks The callbacks for the language model.
   * @returns A Promise that resolves to a BaseMessage.
   */
  async call(
    messages: BaseMessageLike[],
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<BaseMessage> {
    const result = await this.generate(
      [messages.map(coerceMessageLikeToMessage)],
      options,
      callbacks
    );
    const generations = result.generations as ChatGeneration[][];
    return generations[0][0].message;
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.2.0.
   *
   * Makes a single call to the chat model with a prompt value.
   * @param promptValue The value of the prompt.
   * @param options The call options or an array of stop sequences.
   * @param callbacks The callbacks for the language model.
   * @returns A Promise that resolves to a BaseMessage.
   */
  async callPrompt(
    promptValue: BasePromptValueInterface,
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<BaseMessage> {
    const promptMessages: BaseMessage[] = promptValue.toChatMessages();
    return this.call(promptMessages, options, callbacks);
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.2.0.
   *
   * Predicts the next message based on the input messages.
   * @param messages An array of BaseMessage instances.
   * @param options The call options or an array of stop sequences.
   * @param callbacks The callbacks for the language model.
   * @returns A Promise that resolves to a BaseMessage.
   */
  async predictMessages(
    messages: BaseMessage[],
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<BaseMessage> {
    return this.call(messages, options, callbacks);
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.2.0.
   *
   * Predicts the next message based on a text input.
   * @param text The text input.
   * @param options The call options or an array of stop sequences.
   * @param callbacks The callbacks for the language model.
   * @returns A Promise that resolves to a string.
   */
  async predict(
    text: string,
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<string> {
    const message = new HumanMessage(text);
    const result = await this.call([message], options, callbacks);
    if (typeof result.content !== "string") {
      throw new Error("Cannot use predict when output is not a string.");
    }
    return result.content;
  }
}

/**
 * An abstract class that extends BaseChatModel and provides a simple
 * implementation of _generate.
 */
export abstract class SimpleChatModel<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions
> extends BaseChatModel<CallOptions> {
  abstract _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string>;

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const text = await this._call(messages, options, runManager);
    const message = new AIMessage(text);
    if (typeof message.content !== "string") {
      throw new Error(
        "Cannot generate with a simple chat model when output is not a string."
      );
    }
    return {
      generations: [
        {
          text: message.content,
          message,
        },
      ],
    };
  }
}
