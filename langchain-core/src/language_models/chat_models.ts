import {
  AIMessage,
  BaseMessage,
  BaseMessageChunk,
  type BaseMessageLike,
  HumanMessage,
  coerceMessageLikeToMessage,
} from "../messages/index.js";
import { BasePromptValue } from "../prompt_values.js";
import {
  LLMResult,
  RUN_KEY,
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "../outputs.js";
import {
  BaseLanguageModel,
  type BaseLanguageModelCallOptions,
  type BaseLanguageModelInput,
  type BaseLanguageModelParams,
} from "./base.js";
import {
  CallbackManager,
  CallbackManagerForLLMRun,
  Callbacks,
} from "../callbacks/manager.js";
import { RunnableConfig } from "../runnables/config.js";

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

/**
 * Base class for chat models. It extends the BaseLanguageModel class and
 * provides methods for generating chat based on input messages.
 */
export abstract class BaseChatModel<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions
> extends BaseLanguageModel<BaseMessageChunk, CallOptions> {
  declare ParsedCallOptions: Omit<
    CallOptions,
    keyof RunnableConfig & "timeout"
  >;

  // Only ever instantiated in main LangChain
  lc_namespace = ["langchain", "chat_models", this._llmType()];

  constructor(fields: BaseChatModelParams) {
    super(fields);
  }

  abstract _combineLLMOutput?(
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
   * Invokes the chat model with a single input.
   * @param input The input for the language model.
   * @param options The call options.
   * @returns A Promise that resolves to a BaseMessageChunk.
   */
  async invoke(
    input: BaseLanguageModelInput,
    options?: CallOptions
  ): Promise<BaseMessageChunk> {
    const promptValue = BaseChatModel._convertInputToPromptValue(input);
    const result = await this.generatePrompt(
      [promptValue],
      options,
      options?.callbacks
    );
    const chatGeneration = result.generations[0][0] as ChatGeneration;
    // TODO: Remove cast after figuring out inheritance
    return chatGeneration.message as BaseMessageChunk;
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
  ): AsyncGenerator<BaseMessageChunk> {
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
      const callbackManager_ = await CallbackManager.configure(
        runnableConfig.callbacks,
        this.callbacks,
        runnableConfig.tags,
        this.tags,
        runnableConfig.metadata,
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
        undefined,
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
          yield chunk.message;
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

  /** @ignore */
  async _generateUncached(
    messages: BaseMessageLike[][],
    parsedOptions: this["ParsedCallOptions"],
    handledOptions: RunnableConfig
  ): Promise<LLMResult> {
    const baseMessages = messages.map((messageList) =>
      messageList.map(coerceMessageLikeToMessage)
    );

    // create callback manager and start run
    const callbackManager_ = await CallbackManager.configure(
      handledOptions.callbacks,
      this.callbacks,
      handledOptions.tags,
      this.tags,
      handledOptions.metadata,
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
      undefined,
      undefined,
      extra,
      undefined,
      undefined,
      handledOptions.runName
    );
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
    const generations: ChatGeneration[][] = [];
    const llmOutputs: LLMResult["llmOutput"][] = [];
    await Promise.all(
      results.map(async (pResult, i) => {
        if (pResult.status === "fulfilled") {
          const result = pResult.value;
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

    const missingPromptIndices: number[] = [];
    const generations = await Promise.all(
      baseMessages.map(async (baseMessage, index) => {
        // Join all content into one string for the prompt index
        const prompt =
          BaseChatModel._convertInputToPromptValue(baseMessage).toString();
        const result = await cache.lookup(prompt, llmStringKey);
        if (!result) {
          missingPromptIndices.push(index);
        }

        return result;
      })
    );

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
    promptValues: BasePromptValue[],
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
   * Makes a single call to the chat model with a prompt value.
   * @param promptValue The value of the prompt.
   * @param options The call options or an array of stop sequences.
   * @param callbacks The callbacks for the language model.
   * @returns A Promise that resolves to a BaseMessage.
   */
  async callPrompt(
    promptValue: BasePromptValue,
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<BaseMessage> {
    const promptMessages: BaseMessage[] = promptValue.toChatMessages();
    return this.call(promptMessages, options, callbacks);
  }

  /**
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
