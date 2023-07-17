import { Example, Run } from "langsmith";
import { EvaluationResult, RunEvaluator } from "langsmith/evaluation";
import { BaseOutputParser } from "../../schema/output_parser.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { BaseChain } from "../../chains/base.js";
import { ChainValues } from "../../schema/index.js";
import { CallbackManagerForChainRun } from "../../callbacks/manager.js";

export abstract class RunEvaluatorInputMapper {
  /**
   * Maps a Run and an optional Example to a dictionary.
   *
   * @param run - The traced Run to evaluate.
   * @param example - The optional Example containing the ground truth outputs for the Run.
   * @returns A dictionary that represents the mapping.
   */
  abstract map(run: Run, example?: Example): ChainValues;
}

interface IRunEvaluatorOutputParser extends BaseOutputParser<EvaluationResult> {
  parseChainInput(output: ChainValues): Promise<EvaluationResult>;
}

/**
 * An abstract class that extends BaseOutputParser and implements IRunEvaluatorOutputParser.
 * It provides a method for parsing a dictionary to an EvaluationResult.
 */
export abstract class RunEvaluatorOutputParser
  extends BaseOutputParser<EvaluationResult>
  implements IRunEvaluatorOutputParser
{
  /**
   * The key in the chain output that contains the eval results
   */
  evalChain_output_key: string;

  constructor({
    evalChain_output_key,
  }: { evalChain_output_key?: string } = {}) {
    super();
    this.evalChain_output_key = evalChain_output_key || "text";
  }

  async parseChainInput(output: ChainValues): Promise<EvaluationResult> {
    const text = output[this.evalChain_output_key];
    return await this.parse(text);
  }
}

export interface RunEvaluatorChainOpts {
  inputMapper: RunEvaluatorInputMapper; // Convert the run and example into the right chain input object
  evalChain: LLMChain; // The LLMChain to use for running the core logic of the chain.
  outputParser: RunEvaluatorOutputParser; // Parse chain output into an EvaluationResult
}

export class RunEvaluatorChain extends BaseChain implements RunEvaluator {
  // Maps Run and Example objects to chain inputs
  inputMapper: RunEvaluatorInputMapper;

  // The LLMChain to use for running the core logic of the chain.
  evalChain: LLMChain;

  // Parses chain output into an EvaluationResult
  outputParser: RunEvaluatorOutputParser;

  constructor(options: RunEvaluatorChainOpts) {
    super();
    this.inputMapper = options.inputMapper;
    this.evalChain = options.evalChain;
    this.outputParser = options.outputParser;
  }

  get inputKeys(): string[] {
    return ["run", "example"];
  }

  get outputKeys(): string[] {
    return ["feedback"];
  }

  _chainType(): string {
    return "run_evaluator";
  }

  /**
   * Runs the core logic of this chain and returns the output.
   * @param values - The input values for the chain.
   * @param runManager - The optional CallbackManager
   * @returns The output of the chain.
   */

  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    const chain_input = this.inputMapper.map(values.run, values.example);
    const chain_output = await this.evalChain.call(
      chain_input,
      runManager?.getChild()
    );
    const feedback = this.outputParser.parseChainInput(chain_output);
    return { feedback };
  }

  /**
   * Evaluates a Run and returns the EvaluationResult.
   * @param run - The Run to evaluate.
   * @param example - The optional Example containing the ground truth outputs for the Run.
   * @returns The EvaluationResult.
   */
  async evaluateRun(run: Run, example?: Example): Promise<EvaluationResult> {
    const evaluationResult = await this._call({ run, example });
    return evaluationResult.feedback;
  }
}
