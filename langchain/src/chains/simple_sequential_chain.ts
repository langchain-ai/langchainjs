import { BaseChain, ChainInputs } from "./base.js";
import { ChainValues } from "../schema/index.js";
import {
  SerializedBaseChain,
  SerializedSimpleSequentialChain,
} from "./serde.js";

export interface SimpleSequentialChainInput extends ChainInputs {
  /** Array of chains to run as a sequence. The chains are run in order they appear in the array. */
  chains: Array<BaseChain>;
  /** Whether or not to trim the intermediate outputs. */
  trimOutputs?: boolean;
}

/**
 * Simple chain where a single string output of one chain is fed directly into the next.
 * @augments BaseChain
 * @augments SimpleSequentialChainInput
 *
 * @example
 * ```ts
 * import { SimpleSequentialChain, LLMChain } from "langchain/chains";
 * import { OpenAI } from "langchain/llms/openai";
 * import { PromptTemplate } from "langchain/prompts";
 *
 * // This is an LLMChain to write a synopsis given a title of a play.
 * const llm = new OpenAI({ temperature: 0 });
 * const template = `You are a playwright. Given the title of play, it is your job to write a synopsis for that title.
 *
 * Title: {title}
 * Playwright: This is a synopsis for the above play:`
 * const promptTemplate = new PromptTemplate({ template, inputVariables: ["title"] });
 * const synopsisChain = new LLMChain({ llm, prompt: promptTemplate });
 *
 *
 * // This is an LLMChain to write a review of a play given a synopsis.
 * const reviewLLM = new OpenAI({ temperature: 0 })
 * const reviewTemplate = `You are a play critic from the New York Times. Given the synopsis of play, it is your job to write a review for that play.
 *
 * Play Synopsis:
 * {synopsis}
 * Review from a New York Times play critic of the above play:`
 * const reviewPromptTempalte = new PromptTemplate({ template: reviewTemplate, inputVariables: ["synopsis"] });
 * const reviewChain = new LLMChain({ llm: reviewLLM, prompt: reviewPromptTempalte });
 *
 * const overallChain = new SimpleSequentialChain({chains: [synopsisChain, reviewChain], verbose:true})
 * const review = await overallChain.run("Tragedy at sunset on the beach")
 * // the variable review contains resulting play review.
 * ```
 */
export class SimpleSequentialChain
  extends BaseChain
  implements SimpleSequentialChainInput
{
  chains: Array<BaseChain>;

  inputKey = "input";

  outputKey = "output";

  trimOutputs: boolean;

  get inputKeys() {
    return [this.inputKey];
  }

  get outputKeys(): string[] {
    return [this.outputKey];
  }

  constructor(fields: SimpleSequentialChainInput) {
    super(fields.memory, fields.verbose, fields.callbackManager);
    this.chains = fields.chains;
    this.trimOutputs = fields.trimOutputs ?? false;
    this._validateChains();
  }

  /** @ignore */
  _validateChains() {
    for (const chain of this.chains) {
      if (chain.inputKeys.length !== 1) {
        throw new Error(
          `Chains used in SimpleSequentialChain should all have one input, got ${
            chain.inputKeys.length
          } for ${chain._chainType()}.`
        );
      }
      if (chain.outputKeys.length !== 1) {
        throw new Error(
          `Chains used in SimpleSequentialChain should all have one output, got ${
            chain.outputKeys.length
          } for ${chain._chainType()}.`
        );
      }
    }
  }

  /** @ignore */
  async _call(values: ChainValues): Promise<ChainValues> {
    let input: string = values[this.inputKey];
    for (const chain of this.chains) {
      input = await chain.run(input);
      if (this.trimOutputs) {
        input = input.trim();
      }
      await this.callbackManager.handleText(input, this.verbose);
    }
    return { [this.outputKey]: input };
  }

  _chainType() {
    return "simple_sequential_chain" as const;
  }

  static async deserialize(data: SerializedSimpleSequentialChain) {
    const chains: Array<BaseChain> = [];
    const serializedChains = data.chains;
    for (const serializedChain of serializedChains) {
      const deserializedChain = await BaseChain.deserialize(serializedChain);
      chains.push(deserializedChain);
    }
    return new SimpleSequentialChain({ chains });
  }

  serialize(): SerializedSimpleSequentialChain {
    const chains: Array<SerializedBaseChain> = [];
    for (const chain of this.chains) {
      chains.push(chain.serialize());
    }
    return {
      _type: this._chainType(),
      chains,
    };
  }
}
