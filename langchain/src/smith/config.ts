import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { Example, Run } from "langsmith";
import { EvaluationResult, RunEvaluator } from "langsmith/evaluation";
import { Criteria } from "../evaluation/index.js";
import { LoadEvaluatorOptions } from "../evaluation/loader.js";
import { EvaluatorType } from "../evaluation/types.js";

/**
 * Type of a function that can be coerced into a RunEvaluator function.
 * While we have the class-based RunEvaluator, it's often more convenient to directly
 * pass a function to the runner. This type allows us to do that.
 */
export type RunEvaluatorLike =
  | (({
      run,
      example,
    }: {
      run: Run;
      example?: Example;
    }) => Promise<EvaluationResult>)
  | (({ run, example }: { run: Run; example?: Example }) => EvaluationResult);

export interface EvalConfig extends LoadEvaluatorOptions {
  /**
   * The name of the evaluator to use.
   * Example: labeled_criteria, criteria, etc.
   */
  evaluatorType: keyof EvaluatorType;

  /**
   * The feedback (or metric) name to use for the logged
   * evaluation results. If none provided, we default to
   * the evaluationName.
   */
  feedbackKey?: string;

  /**
   * Convert the evaluation data into a format that can be used by the evaluator.
   * By default, we pass the first value of the run.inputs, run.outputs (predictions),
   * and references (example.outputs)
   * If this is specified, it will override the prepareData function in the RunEvalConfig
   * for this particular evaluator.
   * @param data The data to prepare.
   * @returns The prepared data.
   */
  prepareData?: (data: {
    run: Run;
    reference_outputs?: Record<string, unknown>;
  }) => {
    prediction: string | unknown;
    input?: string | unknown;
    reference?: string | unknown;
  };
}

export type PrepareDataT = ({
  run,
  reference_outputs,
}: {
  run: Run;
  reference_outputs?: Record<string, unknown>;
}) => {
  prediction: string | unknown;
  input?: string | unknown;
  reference?: string | unknown;
};

export const defaultPrepareData: PrepareDataT = ({
  run,
  reference_outputs,
}: {
  run: Run;
  reference_outputs?: Record<string, unknown>;
}) => {
  const prediction = run?.outputs ? Object.values(run.outputs)[0] : undefined;
  const input = run?.inputs ? Object.values(run.inputs)[0] : undefined;
  const reference = reference_outputs
    ? Object.values(reference_outputs)[0]
    : undefined;
  return { prediction, input, reference };
};

/**
 * Configuration class for running evaluations on datasets.
 *
 * @remarks
 * RunEvalConfig in LangSmith is a configuration class for running evaluations on datasets. Its primary purpose is to define the parameters and evaluators that will be applied during the evaluation of a dataset. This configuration can include various evaluators, custom evaluators, and different keys for inputs, predictions, and references.
 *
 * @typeparam T - The type of evaluators.
 * @typeparam U - The type of custom evaluators.
 */
export class RunEvalConfig<
  T extends keyof EvaluatorType = keyof EvaluatorType,
  U extends RunEvaluator | RunEvaluatorLike = RunEvaluator | RunEvaluatorLike
> {
  /**
   * Custom evaluators to apply to a dataset run.
   * Each evaluator is provided with a run trace containing the model
   * outputs, as well as an "example" object representing a record
   * in the dataset.
   */
  customEvaluators?: U[];

  /**
   * LangChain evaluators to apply to a dataset run.
   * You can optionally specify these by name, or by
   * configuring them with an EvalConfig object.
   */
  evaluators?: (T | EvalConfig)[];

  /**
   * Convert the evaluation data into a format that can be used by the evaluator.
   * By default, we pass the first value of the run.inputs, run.outputs (predictions),
   * and references (example.outputs)
   *
   * @returns The prepared data.
   */
  prepareData?: PrepareDataT;

  /**
   * The language model specification for evaluators that require one.
   */
  eval_llm?: string;

  /**
   * Configuration to load a "CriteriaEvalChain" evaluator,
   * which prompts an LLM to determine whether the model's
   * prediction complies with the provided criteria.
   * @param criteria - The criteria to use for the evaluator.
   * @param llm - The language model to use for the evaluator.
   * @returns The configuration for the evaluator.
   * @example
   * ```ts
   * const evalConfig = new RunEvalConfig(
   *  [new RunEvalConfig.Criteria("helpfulness")],
   * );
   * ```
   * @example
   * ```ts
   * const evalConfig = new RunEvalConfig(
   * [new RunEvalConfig.Criteria(
   *      { "isCompliant": "Does the submission comply with the requirements of XYZ"
   *  })],
   */
  static Criteria = class implements EvalConfig {
    evaluatorType: keyof EvaluatorType = "criteria";

    /**
     * The "criteria" to insert into the prompt template
     * used for evaluation. See the prompt at
     * https://smith.langchain.com/hub/langchain-ai/criteria-evaluator
     * for more information.
     */
    criteria?: Criteria | Record<string, string>;

    /**
     * The feedback (or metric) name to use for the logged
     * evaluation results. If none provided, we default to
     * the evaluationName.
     */
    feedbackKey?: string;

    /**
     * The language model to use as the evaluator.
     */
    llm?: BaseLanguageModel;

    constructor(props: {
      criteria?: Criteria | Record<string, string>;
      llm?: BaseLanguageModel;
      feedbackKey?: string;
    }) {
      this.criteria = props.criteria;
      this.llm = props.llm;
      this.feedbackKey = props.feedbackKey;
    }
  };

  /**
   * Configuration to load a "LabeledCriteriaEvalChain" evaluator,
   * which prompts an LLM to determine whether the model's
   * prediction complies with the provided criteria and also
   * provides a "ground truth" label for the evaluator to incorporate
   * in its evaluation.
   * @param criteria - The criteria to use for the evaluator.
   * @param llm - The language model to use for the evaluator.
   * @returns The configuration for the evaluator.
   * @example
   * ```ts
   * const evalConfig = new RunEvalConfig(
   *  [new RunEvalConfig.LabeledCriteria("correctness")],
   * );
   * ```
   * @example
   * ```ts
   * const evalConfig = new RunEvalConfig(
   * [new RunEvalConfig.Criteria(
   *      { "mentionsAllFacts": "Does the include all facts provided in the reference?"
   *  })],
   */
  static LabeledCriteria = class implements EvalConfig {
    evaluatorType: keyof EvaluatorType = "labeled_criteria";

    /**
     * The "criteria" to insert into the prompt template
     * used for evaluation. See the prompt at
     * https://smith.langchain.com/hub/langchain-ai/labeled-criteria
     * for more information.
     */
    criteria?: Criteria | Record<string, string>;

    /**
     * The feedback (or metric) name to use for the logged
     * evaluation results. If none provided, we default to
     * the evaluationName.
     */
    feedbackKey?: string;

    /**
     * The language model to use as the evaluator.
     */
    llm?: BaseLanguageModel;

    constructor(props: {
      criteria?: Criteria | Record<string, string>;
      llm?: BaseLanguageModel;
      feedbackKey?: string;
    }) {
      this.criteria = props.criteria;
      this.llm = props.llm;
      this.feedbackKey = props.feedbackKey;
    }
  };

  constructor(
    config: {
      evaluators?: (T | EvalConfig)[];
      customEvaluators?: U[];
      prepareData?: PrepareDataT;
      eval_llm?: string;
    } = {}
  ) {
    this.evaluators = config.evaluators;
    this.customEvaluators = config.customEvaluators;
    this.prepareData = config.prepareData;
    this.eval_llm = config.eval_llm;
  }
}
