import {
  AIChatMessage,
  BaseChatMessage,
  BasePromptValue,
  ChatGeneration,
  ChatResult,
  HumanChatMessage,
  LLMResult,
  RUN_KEY,
} from "../schema/index.js";
import {
  BaseLanguageModel,
  BaseLanguageModelCallOptions,
  BaseLanguageModelParams,
} from "../base_language/index.js";
import {
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

  declare ParsedCallOptions: Omit<this["CallOptions"], "timeout">;

  lc_namespace = ["langchain", "chat_models", this._llmType()];

  constructor(fields: BaseChatModelParams) {
    super(fields);
  }

  abstract _combineLLMOutput?(
    ...llmOutputs: LLMResult["llmOutput"][]
  ): LLMResult["llmOutput"];

  async generate(
    messages: BaseChatMessage[][],
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<LLMResult> {
    const generations: ChatGeneration[][] = [];
    const llmOutputs: LLMResult["llmOutput"][] = [];
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
    const callbackManager_ = await CallbackManager.configure(
      callbacks,
      this.callbacks,
      { verbose: this.verbose }
    );
    const invocationParams = { invocation_params: this?.invocationParams() };
    const runManager = await callbackManager_?.handleChatModelStart(
      { name: this._llmType() },
      messages,
      undefined,
      undefined,
      invocationParams
    );
    try {
      const results = await Promise.all(
        messages.map((messageList) =>
          this._generate(messageList, parsedOptions, runManager)
        )
      );
      for (const result of results) {
        if (result.llmOutput) {
          llmOutputs.push(result.llmOutput);
        }
        generations.push(result.generations);
      }
    } catch (err) {
      await runManager?.handleLLMError(err);
      throw err;
    }

    const output: LLMResult = {
      generations,
      llmOutput: llmOutputs.length
        ? this._combineLLMOutput?.(...llmOutputs)
        : undefined,
    };
    await runManager?.handleLLMEnd(output);
    Object.defineProperty(output, RUN_KEY, {
      value: runManager ? { runId: runManager?.runId } : undefined,
      configurable: true,
    });
    return output;
  }

  /**
   * Get the parameters used to invoke the model
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invocationParams(): any {
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
    const promptMessages: BaseChatMessage[][] = promptValues.map(
      (promptValue) => promptValue.toChatMessages()
    );
    return this.generate(promptMessages, options, callbacks);
  }

  abstract _generate(
    messages: BaseChatMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult>;

  async call(
    messages: BaseChatMessage[],
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<BaseChatMessage> {
    const result = await this.generate([messages], options, callbacks);
    const generations = result.generations as ChatGeneration[][];
    return generations[0][0].message;
  }

  async callPrompt(
    promptValue: BasePromptValue,
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<BaseChatMessage> {
    const promptMessages: BaseChatMessage[] = promptValue.toChatMessages();
    return this.call(promptMessages, options, callbacks);
  }

  async predictMessages(
    messages: BaseChatMessage[],
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<BaseChatMessage> {
    return this.call(messages, options, callbacks);
  }

  async predict(
    text: string,
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<string> {
    const message = new HumanChatMessage(text);
    const result = await this.call([message], options, callbacks);
    return result.text;
  }
}

export abstract class SimpleChatModel extends BaseChatModel {
  abstract _call(
    messages: BaseChatMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string>;

  async _generate(
    messages: BaseChatMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const text = await this._call(messages, options, runManager);
    const message = new AIChatMessage(text);
    return {
      generations: [
        {
          text: message.text,
          message,
        },
      ],
    };
  }
}
