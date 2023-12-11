import { BaseChain, ChainInputs } from "./base.js";
import { BasePromptTemplate } from "../prompts/base.js";
import {
  BaseLanguageModel,
  BaseLanguageModelInput,
} from "../base_language/index.js";
import {
  ChainValues,
  Generation,
  BasePromptValue,
  BaseMessage,
} from "../schema/index.js";
import {
  BaseLLMOutputParser,
  BaseOutputParser,
} from "../schema/output_parser.js";
import { SerializedLLMChain } from "./serde.js";
import { CallbackManager } from "../callbacks/index.js";
import {
  BaseCallbackConfig,
  CallbackManagerForChainRun,
  Callbacks,
} from "../callbacks/manager.js";
import { NoOpOutputParser } from "../output_parsers/noop.js";
import { Runnable } from "../schema/runnable/base.js";

type LLMType =
  | BaseLanguageModel
  | Runnable<BaseLanguageModelInput, string>
  | Runnable<BaseLanguageModelInput, BaseMessage>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CallOptionsIfAvailable<T> = T extends { CallOptions: infer CO } ? CO : any;
/**
 * Interface for the input parameters of the LLMChain class.
 */
export interface LLMChainInput<
  T extends string | object = string,
  Model extends LLMType = LLMType
> extends ChainInputs {
  /** Prompt object to use */
  prompt: BasePromptTemplate;
  /** LLM Wrapper to use */
  llm: Model;
  /** Kwargs to pass to LLM */
  llmKwargs?: CallOptionsIfAvailable<Model>;
  /** OutputParser to use */
  outputParser?: BaseLLMOutputParser<T>;
  /** Key to use for output, defaults to `text` */
  outputKey?: string;
}

function isBaseLanguageModel(llmLike: unknown): llmLike is BaseLanguageModel {
  return typeof (llmLike as BaseLanguageModel)._llmType === "function";
}

function _getLanguageModel(llmLike: Runnable): BaseLanguageModel {
  if (isBaseLanguageModel(llmLike)) {
    return llmLike;
  } else if ("bound" in llmLike && Runnable.isRunnable(llmLike.bound)) {
    return _getLanguageModel(llmLike.bound);
  } else if (
    "runnable" in llmLike &&
    "fallbacks" in llmLike &&
    Runnable.isRunnable(llmLike.runnable)
  ) {
    return _getLanguageModel(llmLike.runnable);
  } else if ("default" in llmLike && Runnable.isRunnable(llmLike.default)) {
    return _getLanguageModel(llmLike.default);
  } else {
    throw new Error("Unable to extract BaseLanguageModel from llmLike object.");
  }
}

/**
 * Chain to run queries against LLMs.
 *
 * @example
 * ```ts
 * import { LLMChain } from "langchain/chains";
 * import { OpenAI } from "langchain/llms/openai";
 * import { PromptTemplate } from "langchain/prompts";
 *
 * const prompt = PromptTemplate.fromTemplate("Tell me a {adjective} joke");
 * const llm = new LLMChain({ llm: new OpenAI(), prompt });
 * ```
 */
export class LLMChain<
    T extends string | object = string,
    Model extends LLMType = LLMType
  >
  extends BaseChain
  implements LLMChainInput<T>
{
  static lc_name() {
    return "LLMChain";
  }

  lc_serializable = true;

  prompt: BasePromptTemplate;

  llm: Model;

  llmKwargs?: CallOptionsIfAvailable<Model>;

  outputKey = "text";

  outputParser?: BaseLLMOutputParser<T>;

  get inputKeys() {
    return this.prompt.inputVariables;
  }

  get outputKeys() {
    return [this.outputKey];
  }

  constructor(fields: LLMChainInput<T, Model>) {
    super(fields);
    this.prompt = fields.prompt;
    this.llm = fields.llm;
    this.llmKwargs = fields.llmKwargs;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.outputParser =
      fields.outputParser ?? (new NoOpOutputParser() as BaseOutputParser<T>);
    if (this.prompt.outputParser) {
      if (fields.outputParser) {
        throw new Error("Cannot set both outputParser and prompt.outputParser");
      }
      this.outputParser = this.prompt.outputParser as BaseOutputParser<T>;
    }
  }

  private getCallKeys(): string[] {
    const callKeys = "callKeys" in this.llm ? this.llm.callKeys : [];
    return callKeys;
  }

  /** @ignore */
  _selectMemoryInputs(values: ChainValues): ChainValues {
    const valuesForMemory = super._selectMemoryInputs(values);
    const callKeys = this.getCallKeys();
    for (const key of callKeys) {
      if (key in values) {
        delete valuesForMemory[key];
      }
    }
    return valuesForMemory;
  }

  /** @ignore */
  async _getFinalOutput(
    generations: Generation[],
    promptValue: BasePromptValue,
    runManager?: CallbackManagerForChainRun
  ): Promise<unknown> {
    let finalCompletion: unknown;
    if (this.outputParser) {
      finalCompletion = await this.outputParser.parseResultWithPrompt(
        generations,
        promptValue,
        runManager?.getChild()
      );
    } else {
      finalCompletion = generations[0].text;
    }
    return finalCompletion;
  }

  /**
   * Run the core logic of this chain and add to output if desired.
   *
   * Wraps _call and handles memory.
   */
  call(
    values: ChainValues & CallOptionsIfAvailable<Model>,
    config?: Callbacks | BaseCallbackConfig
  ): Promise<ChainValues> {
    return super.call(values, config);
  }

  /** @ignore */
  async _call(
    values: ChainValues & CallOptionsIfAvailable<Model>,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    const valuesForPrompt = { ...values };
    const valuesForLLM = {
      ...this.llmKwargs,
    } as CallOptionsIfAvailable<Model>;
    const callKeys = this.getCallKeys();
    for (const key of callKeys) {
      if (key in values) {
        if (valuesForLLM) {
          valuesForLLM[key as keyof CallOptionsIfAvailable<Model>] =
            values[key];
          delete valuesForPrompt[key];
        }
      }
    }
    const promptValue = await this.prompt.formatPromptValue(valuesForPrompt);
    if ("generatePrompt" in this.llm) {
      const { generations } = await this.llm.generatePrompt(
        [promptValue],
        valuesForLLM,
        runManager?.getChild()
      );
      return {
        [this.outputKey]: await this._getFinalOutput(
          generations[0],
          promptValue,
          runManager
        ),
      };
    }

    const modelWithParser = this.outputParser
      ? this.llm.pipe(this.outputParser)
      : this.llm;
    const response = await modelWithParser.invoke(
      promptValue,
      runManager?.getChild()
    );
    return {
      [this.outputKey]: response,
    };
  }

  /**
   * Format prompt with values and pass to LLM
   *
   * @param values - keys to pass to prompt template
   * @param callbackManager - CallbackManager to use
   * @returns Completion from LLM.
   *
   * @example
   * ```ts
   * llm.predict({ adjective: "funny" })
   * ```
   */
  async predict(
    values: ChainValues & CallOptionsIfAvailable<Model>,
    callbackManager?: CallbackManager
  ): Promise<T> {
    const output = await this.call(values, callbackManager);
    return output[this.outputKey];
  }

  _chainType() {
    return "llm" as const;
  }

  static async deserialize(data: SerializedLLMChain) {
    const { llm, prompt } = data;
    if (!llm) {
      throw new Error("LLMChain must have llm");
    }
    if (!prompt) {
      throw new Error("LLMChain must have prompt");
    }

    return new LLMChain({
      llm: await BaseLanguageModel.deserialize(llm),
      prompt: await BasePromptTemplate.deserialize(prompt),
    });
  }

  /** @deprecated */
  serialize(): SerializedLLMChain {
    const serialize =
      "serialize" in this.llm ? this.llm.serialize() : undefined;
    return {
      _type: `${this._chainType()}_chain`,
      llm: serialize,
      prompt: this.prompt.serialize(),
    };
  }

  _getNumTokens(text: string): Promise<number> {
    return _getLanguageModel(this.llm).getNumTokens(text);
  }
}
