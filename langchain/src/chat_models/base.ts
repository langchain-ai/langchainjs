import {
  AIMessage,
  BaseMessage,
  BasePromptValue,
  ChatGeneration,
  ChatResult,
  HumanMessage,
  LLMResult,
  RUN_KEY,
} from "../schema/index.js";
import {
  BaseLanguageModel,
  BaseLanguageModelCallOptions,
  BaseLanguageModelParams,
} from "../base_language/index.js";
import {
  BaseCallbackConfig,
  CallbackManager,
  CallbackManagerForLLMRun,
  Callbacks,
} from "../callbacks/manager.js";

export type SerializedChatModel = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

// todo?
export type SerializedLLM = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

export type BaseChatModelParams = BaseLanguageModelParams;

export type BaseChatModelCallOptions = BaseLanguageModelCallOptions;

export abstract class BaseChatModel extends BaseLanguageModel {
  declare CallOptions: BaseChatModelCallOptions;

  declare ParsedCallOptions: Omit<
    this["CallOptions"],
    "timeout" | "tags" | "metadata" | "callbacks"
  >;

  lc_namespace = ["langchain", "chat_models", this._llmType()];

  constructor(fields: BaseChatModelParams) {
    super(fields);
  }

  abstract _combineLLMOutput?(
    ...llmOutputs: LLMResult["llmOutput"][]
  ): LLMResult["llmOutput"];

  async generate(
    messages: BaseMessage[][],
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<LLMResult> {
    // parse call options
    let parsedOptions: this["CallOptions"];
    if (Array.isArray(options)) {
      parsedOptions = { stop: options } as this["CallOptions"];
    } else if (options?.timeout && !options.signal) {
      parsedOptions = {
        ...options,
        signal: AbortSignal.timeout(options.timeout),
      };
    } else {
      parsedOptions = options ?? {};
    }
    const handledOptions: BaseCallbackConfig = {
      tags: parsedOptions.tags,
      metadata: parsedOptions.metadata,
      callbacks: parsedOptions.callbacks ?? callbacks,
    };
    delete parsedOptions.tags;
    delete parsedOptions.metadata;
    delete parsedOptions.callbacks;
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
    };
    const runManagers = await callbackManager_?.handleChatModelStart(
      this.toJSON(),
      messages,
      undefined,
      undefined,
      extra
    );
    // generate results
    const results = await Promise.allSettled(
      messages.map((messageList, i) =>
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

  async generatePrompt(
    promptValues: BasePromptValue[],
    options?: string[] | this["CallOptions"],
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

  async call(
    messages: BaseMessage[],
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<BaseMessage> {
    const result = await this.generate([messages], options, callbacks);
    const generations = result.generations as ChatGeneration[][];
    return generations[0][0].message;
  }

  async callPrompt(
    promptValue: BasePromptValue,
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<BaseMessage> {
    const promptMessages: BaseMessage[] = promptValue.toChatMessages();
    return this.call(promptMessages, options, callbacks);
  }

  async predictMessages(
    messages: BaseMessage[],
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<BaseMessage> {
    return this.call(messages, options, callbacks);
  }

  async predict(
    text: string,
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<string> {
    const message = new HumanMessage(text);
    const result = await this.call([message], options, callbacks);
    return result.content;
  }
}

export abstract class SimpleChatModel extends BaseChatModel {
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
