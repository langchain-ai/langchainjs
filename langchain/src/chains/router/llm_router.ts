import { BasePromptTemplate } from "../../prompts/base.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { RouterChain } from "./multi_route.js";
import { CallbackManagerForChainRun } from "../../callbacks/manager.js";
import { ChainValues } from "../../schema/index.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { ChainInputs } from "../../chains/base.js";

/**
 * A type that represents the output schema of a router chain. It defines
 * the structure of the output data returned by the router chain.
 */
export type RouterOutputSchema = {
  destination: string;
  next_inputs: { [key: string]: string };
};

/**
 * An interface that extends the default ChainInputs interface and adds an
 * additional "llmChain" property.
 */
export interface LLMRouterChainInput extends ChainInputs {
  llmChain: LLMChain<RouterOutputSchema>;
}

/**
 * A class that represents an LLM router chain in the LangChain framework.
 * It extends the RouterChain class and implements the LLMRouterChainInput
 * interface. It provides additional functionality specific to LLMs and
 * routing based on LLM predictions.
 */
export class LLMRouterChain extends RouterChain implements LLMRouterChainInput {
  llmChain: LLMChain<RouterOutputSchema>;

  constructor(fields: LLMRouterChainInput) {
    super(fields);
    this.llmChain = fields.llmChain;
  }

  get inputKeys(): string[] {
    return this.llmChain.inputKeys;
  }

  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun | undefined
  ): Promise<RouterOutputSchema> {
    return this.llmChain.predict(values, runManager?.getChild());
  }

  _chainType(): string {
    return "llm_router_chain";
  }

  /**
   * A static method that creates an instance of LLMRouterChain from a
   * BaseLanguageModel and a BasePromptTemplate. It takes in an optional
   * options object and returns an instance of LLMRouterChain with the
   * specified LLMChain.
   * @param llm A BaseLanguageModel instance.
   * @param prompt A BasePromptTemplate instance.
   * @param options Optional LLMRouterChainInput object, excluding "llmChain".
   * @returns An instance of LLMRouterChain.
   */
  static fromLLM(
    llm: BaseLanguageModel,
    prompt: BasePromptTemplate,
    options?: Omit<LLMRouterChainInput, "llmChain">
  ) {
    const llmChain = new LLMChain<RouterOutputSchema>({ llm, prompt });
    return new LLMRouterChain({ ...options, llmChain });
  }
}
