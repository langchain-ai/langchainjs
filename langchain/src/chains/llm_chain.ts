import { BaseChain, ChainInputs } from "./base.js";
import { BasePromptTemplate } from "../prompts/base.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { ChainValues, Generation, BasePromptValue } from "../schema/index.js";
import { BaseOutputParser } from "../schema/output_parser.js";
import { SerializedLLMChain } from "./serde.js";
import { CallbackManager } from "../callbacks/index.js";
import { CallbackManagerForChainRun, Callbacks } from "../callbacks/manager.js";

export interface LLMChainInput<T extends string | object = string>
  extends ChainInputs {
  /** Prompt object to use */
  prompt: BasePromptTemplate;
  /** LLM Wrapper to use */
  llm: BaseLanguageModel;
  /** OutputParser to use */
  outputParser?: BaseOutputParser<T>;
  /** Key to use for output, defaults to `text` */
  outputKey?: string;
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
export class LLMChain<T extends string | object = string>
  extends BaseChain
  implements LLMChainInput<T>
{
  prompt: BasePromptTemplate;

  llm: BaseLanguageModel;

  outputKey = "text";

  outputParser?: BaseOutputParser<T>;

  get inputKeys() {
    return this.prompt.inputVariables;
  }

  get outputKeys() {
    return [this.outputKey];
  }

  constructor(fields: LLMChainInput<T>) {
    super(fields);
    this.prompt = fields.prompt;
    this.llm = fields.llm;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.outputParser = fields.outputParser ?? this.outputParser;
    if (this.prompt.outputParser) {
      if (this.outputParser) {
        throw new Error("Cannot set both outputParser and prompt.outputParser");
      }
      this.outputParser = this.prompt.outputParser as BaseOutputParser<T>;
    }
  }

  /** @ignore */
  async _getFinalOutput(
    generations: Generation[],
    promptValue: BasePromptValue,
    runManager?: CallbackManagerForChainRun
  ): Promise<unknown> {
    const completion = generations[0].text;
    let finalCompletion: unknown;
    if (this.outputParser) {
      finalCompletion = await this.outputParser.parseWithPrompt(
        completion,
        promptValue,
        runManager?.getChild()
      );
    } else {
      finalCompletion = completion;
    }
    return finalCompletion;
  }

  /**
   * Run the core logic of this chain and add to output if desired.
   *
   * Wraps _call and handles memory.
   */
  call(
    values: ChainValues & this["llm"]["CallOptions"],
    callbacks?: Callbacks | undefined
  ): Promise<ChainValues> {
    return super.call(values, callbacks);
  }

  /** @ignore */
  async _call(
    values: ChainValues & this["llm"]["CallOptions"],
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    const valuesForPrompt = { ...values };
    const valuesForLLM: this["llm"]["CallOptions"] = {};
    for (const key of this.llm.callKeys) {
      if (key in values) {
        valuesForLLM[key as keyof this["llm"]["CallOptions"]] = values[key];
        delete valuesForPrompt[key];
      }
    }
    const promptValue = await this.prompt.formatPromptValue(valuesForPrompt);
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
    values: ChainValues & this["llm"]["CallOptions"],
    callbackManager?: CallbackManager
  ): Promise<T> {
    const output = await this.call(values, callbackManager);
    return output[this.outputKey];
  }

  _chainType() {
    return "llm_chain" as const;
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

  serialize(): SerializedLLMChain {
    return {
      _type: this._chainType(),
      llm: this.llm.serialize(),
      prompt: this.prompt.serialize(),
    };
  }
}
