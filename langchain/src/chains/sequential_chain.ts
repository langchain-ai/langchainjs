import { BaseChain, ChainInputs } from "./base.js";
import { ChainValues } from "../schema/index.js";
import {
  SerializedBaseChain,
  SerializedSequentialChain,
  SerializedSimpleSequentialChain,
} from "./serde.js";
import { intersection, union, difference } from "../util/set.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";

function formatSet(input: Set<string>) {
  return Array.from(input)
    .map((i) => `"${i}"`)
    .join(", ");
}

/**
 * Interface for the input parameters of the SequentialChain class.
 */
export interface SequentialChainInput extends ChainInputs {
  /** Array of chains to run as a sequence. The chains are run in order they appear in the array. */
  chains: BaseChain[];
  /** Defines which variables should be passed as initial input to the first chain. */
  inputVariables: string[];
  /** Which variables should be returned as a result of executing the chain. If not specified, output of the last of the chains is used. */
  outputVariables?: string[];
  /** Whether or not to return all intermediate outputs and variables (excluding initial input variables). */
  returnAll?: boolean;
}

/**
 * Chain where the outputs of one chain feed directly into next.
 * @example
 * ```typescript
 * const promptTemplate = new PromptTemplate({
 *   template: `You are a playwright. Given the title of play and the era it is set in, it is your job to write a synopsis for that title.
 * Title: {title}
 * Era: {era}
 * Playwright: This is a synopsis for the above play:`,
 *   inputVariables: ["title", "era"],
 * });

 * const reviewPromptTemplate = new PromptTemplate({
 *   template: `You are a play critic from the New York Times. Given the synopsis of play, it is your job to write a review for that play.
 *   
 *     Play Synopsis:
 *     {synopsis}
 *     Review from a New York Times play critic of the above play:`,
 *   inputVariables: ["synopsis"],
 * });

 * const overallChain = new SequentialChain({
 *   chains: [
 *     new LLMChain({
 *       llm: new ChatOpenAI({ temperature: 0 }),
 *       prompt: promptTemplate,
 *       outputKey: "synopsis",
 *     }),
 *     new LLMChain({
 *       llm: new OpenAI({ temperature: 0 }),
 *       prompt: reviewPromptTemplate,
 *       outputKey: "review",
 *     }),
 *   ],
 *   inputVariables: ["era", "title"],
 *   outputVariables: ["synopsis", "review"],
 *   verbose: true,
 * });

 * const chainExecutionResult = await overallChain.call({
 *   title: "Tragedy at sunset on the beach",
 *   era: "Victorian England",
 * });
 * console.log(chainExecutionResult);
 * ```
 */
export class SequentialChain extends BaseChain implements SequentialChainInput {
  static lc_name() {
    return "SequentialChain";
  }

  chains: BaseChain[];

  inputVariables: string[];

  outputVariables: string[];

  returnAll?: boolean | undefined;

  get inputKeys() {
    return this.inputVariables;
  }

  get outputKeys(): string[] {
    return this.outputVariables;
  }

  constructor(fields: SequentialChainInput) {
    super(fields);
    this.chains = fields.chains;
    this.inputVariables = fields.inputVariables;
    this.outputVariables = fields.outputVariables ?? [];
    if (this.outputVariables.length > 0 && fields.returnAll) {
      throw new Error(
        "Either specify variables to return using `outputVariables` or use `returnAll` param. Cannot apply both conditions at the same time."
      );
    }
    this.returnAll = fields.returnAll ?? false;
    this._validateChains();
  }

  /** @ignore */
  _validateChains() {
    if (this.chains.length === 0) {
      throw new Error("Sequential chain must have at least one chain.");
    }

    const memoryKeys = this.memory?.memoryKeys ?? [];
    const inputKeysSet = new Set(this.inputKeys);
    const memoryKeysSet = new Set(memoryKeys);
    const keysIntersection = intersection(inputKeysSet, memoryKeysSet);
    if (keysIntersection.size > 0) {
      throw new Error(
        `The following keys: ${formatSet(
          keysIntersection
        )} are overlapping between memory and input keys of the chain variables. This can lead to unexpected behaviour. Please use input and memory keys that don't overlap.`
      );
    }

    const availableKeys = union(inputKeysSet, memoryKeysSet);
    for (const chain of this.chains) {
      let missingKeys = difference(new Set(chain.inputKeys), availableKeys);

      if (chain.memory) {
        missingKeys = difference(missingKeys, new Set(chain.memory.memoryKeys));
      }

      if (missingKeys.size > 0) {
        throw new Error(
          `Missing variables for chain "${chain._chainType()}": ${formatSet(
            missingKeys
          )}. Only got the following variables: ${formatSet(availableKeys)}.`
        );
      }
      const outputKeysSet = new Set(chain.outputKeys);
      const overlappingOutputKeys = intersection(availableKeys, outputKeysSet);
      if (overlappingOutputKeys.size > 0) {
        throw new Error(
          `The following output variables for chain "${chain._chainType()}" are overlapping: ${formatSet(
            overlappingOutputKeys
          )}. This can lead to unexpected behaviour.`
        );
      }

      for (const outputKey of outputKeysSet) {
        availableKeys.add(outputKey);
      }
    }

    if (this.outputVariables.length === 0) {
      if (this.returnAll) {
        const outputKeys = difference(availableKeys, inputKeysSet);
        this.outputVariables = Array.from(outputKeys);
      } else {
        this.outputVariables = this.chains[this.chains.length - 1].outputKeys;
      }
    } else {
      const missingKeys = difference(
        new Set(this.outputVariables),
        new Set(availableKeys)
      );
      if (missingKeys.size > 0) {
        throw new Error(
          `The following output variables were expected to be in the final chain output but were not found: ${formatSet(
            missingKeys
          )}.`
        );
      }
    }
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    let input: ChainValues = {};
    const allChainValues: ChainValues = values;
    let i = 0;
    for (const chain of this.chains) {
      i += 1;
      input = await chain.call(
        allChainValues,
        runManager?.getChild(`step_${i}`)
      );
      for (const key of Object.keys(input)) {
        allChainValues[key] = input[key];
      }
    }
    const output: ChainValues = {};
    for (const key of this.outputVariables) {
      output[key] = allChainValues[key];
    }

    return output;
  }

  _chainType() {
    return "sequential_chain" as const;
  }

  static async deserialize(data: SerializedSequentialChain) {
    const chains: BaseChain[] = [];
    const inputVariables: string[] = data.input_variables;
    const outputVariables: string[] = data.output_variables;
    const serializedChains = data.chains;
    for (const serializedChain of serializedChains) {
      const deserializedChain = await BaseChain.deserialize(serializedChain);
      chains.push(deserializedChain);
    }
    return new SequentialChain({ chains, inputVariables, outputVariables });
  }

  serialize(): SerializedSequentialChain {
    const chains: SerializedBaseChain[] = [];
    for (const chain of this.chains) {
      chains.push(chain.serialize());
    }
    return {
      _type: this._chainType(),
      input_variables: this.inputVariables,
      output_variables: this.outputVariables,
      chains,
    };
  }
}

/**
 * Interface for the input parameters of the SimpleSequentialChain class.
 */
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
 * const reviewPromptTemplate = new PromptTemplate({ template: reviewTemplate, inputVariables: ["synopsis"] });
 * const reviewChain = new LLMChain({ llm: reviewLLM, prompt: reviewPromptTemplate });
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
  static lc_name() {
    return "SimpleSequentialChain";
  }

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
    super(fields);
    this.chains = fields.chains;
    this.trimOutputs = fields.trimOutputs ?? false;
    this._validateChains();
  }

  /** @ignore */
  _validateChains() {
    for (const chain of this.chains) {
      if (
        chain.inputKeys.filter(
          (k) => !chain.memory?.memoryKeys.includes(k) ?? true
        ).length !== 1
      ) {
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
  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    let input: string = values[this.inputKey];
    let i = 0;
    for (const chain of this.chains) {
      i += 1;
      input = (
        await chain.call(
          { [chain.inputKeys[0]]: input, signal: values.signal },
          runManager?.getChild(`step_${i}`)
        )
      )[chain.outputKeys[0]];
      if (this.trimOutputs) {
        input = input.trim();
      }
      await runManager?.handleText(input);
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
