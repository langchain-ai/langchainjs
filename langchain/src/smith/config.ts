import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { RunnableConfig } from "@langchain/core/runnables";
import { Example, Run } from "langsmith";
import { EvaluationResult, RunEvaluator } from "langsmith/evaluation";
import {
  Criteria as CriteriaType,
  type EmbeddingDistanceEvalChainInput,
} from "../evaluation/index.js";
import { LoadEvaluatorOptions } from "../evaluation/loader.js";
import { EvaluatorType } from "../evaluation/types.js";

export type EvaluatorInputs = {
  input?: string | unknown;
  prediction: string | unknown;
  reference?: string | unknown;
};

export type EvaluatorInputFormatter = ({
  rawInput,
  rawPrediction,
  rawReferenceOutput,
  run,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawInput: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawPrediction: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawReferenceOutput?: any;
  run: Run;
}) => EvaluatorInputs;

export type DynamicRunEvaluatorParams<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Input extends Record<string, any> = Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Prediction extends Record<string, any> = Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Reference extends Record<string, any> = Record<string, unknown>
> = {
  input: Input;
  prediction?: Prediction;
  reference?: Reference;
  run: Run;
  example?: Example;
};

/**
 * Type of a function that can be coerced into a RunEvaluator function.
 * While we have the class-based RunEvaluator, it's often more convenient to directly
 * pass a function to the runner. This type allows us to do that.
 */
export type RunEvaluatorLike =
  | ((
      props: DynamicRunEvaluatorParams,
      options?: { config?: RunnableConfig }
    ) => Promise<EvaluationResult>)
  | ((
      props: DynamicRunEvaluatorParams,
      options?: { config?: RunnableConfig }
    ) => EvaluationResult);

export function isOffTheShelfEvaluator<
  T extends keyof EvaluatorType,
  U extends RunEvaluator | RunEvaluatorLike = RunEvaluator | RunEvaluatorLike
>(evaluator: T | EvalConfig | U): evaluator is T | EvalConfig {
  return typeof evaluator === "string" || "evaluatorType" in evaluator;
}

export function isCustomEvaluator<
  T extends keyof EvaluatorType,
  U extends RunEvaluator | RunEvaluatorLike = RunEvaluator | RunEvaluatorLike
>(evaluator: T | EvalConfig | U): evaluator is U {
  return !isOffTheShelfEvaluator(evaluator);
}

export type RunEvalType<
  T extends keyof EvaluatorType =
    | "criteria"
    | "labeled_criteria"
    | "embedding_distance",
  U extends RunEvaluator | RunEvaluatorLike = RunEvaluator | RunEvaluatorLike
> = T | EvalConfig | U;

/**
 * Configuration class for running evaluations on datasets.
 *
 * @remarks
 * RunEvalConfig in LangSmith is a configuration class for running evaluations on datasets. Its primary purpose is to define the parameters and evaluators that will be applied during the evaluation of a dataset. This configuration can include various evaluators, custom evaluators, and different keys for inputs, predictions, and references.
 *
 * @typeparam T - The type of evaluators.
 * @typeparam U - The type of custom evaluators.
 */
export type RunEvalConfig<
  T extends keyof EvaluatorType =
    | "criteria"
    | "labeled_criteria"
    | "embedding_distance",
  U extends RunEvaluator | RunEvaluatorLike = RunEvaluator | RunEvaluatorLike
> = {
  /**
   * Evaluators to apply to a dataset run.
   * You can optionally specify these by name, or by
   * configuring them with an EvalConfig object.
   */
  evaluators?: RunEvalType<T, U>[];

  /**
   * Convert the evaluation data into formats that can be used by the evaluator.
   * This should most commonly be a string.
   * Parameters are the raw input from the run, the raw output, raw reference output, and the raw run.
   * @example
   * ```ts
   * // Chain input: { input: "some string" }
   * // Chain output: { output: "some output" }
   * // Reference example output format: { output: "some reference output" }
   * const formatEvaluatorInputs = ({
   *   rawInput,
   *   rawPrediction,
   *   rawReferenceOutput,
   * }) => {
   *   return {
   *     input: rawInput.input,
   *     prediction: rawPrediction.output,
   *     reference: rawReferenceOutput.output,
   *   };
   * };
   * ```
   * @returns The prepared data.
   */
  formatEvaluatorInputs?: EvaluatorInputFormatter;

  /**
   * Custom evaluators to apply to a dataset run.
   * Each evaluator is provided with a run trace containing the model
   * outputs, as well as an "example" object representing a record
   * in the dataset.
   *
   * @deprecated Use `evaluators` instead.
   */
  customEvaluators?: U[];
};

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
   * Convert the evaluation data into formats that can be used by the evaluator.
   * This should most commonly be a string.
   * Parameters are the raw input from the run, the raw output, raw reference output, and the raw run.
   * @example
   * ```ts
   * // Chain input: { input: "some string" }
   * // Chain output: { output: "some output" }
   * // Reference example output format: { output: "some reference output" }
   * const formatEvaluatorInputs = ({
   *   rawInput,
   *   rawPrediction,
   *   rawReferenceOutput,
   * }) => {
   *   return {
   *     input: rawInput.input,
   *     prediction: rawPrediction.output,
   *     reference: rawReferenceOutput.output,
   *   };
   * };
   * ```
   * @returns The prepared data.
   */
  formatEvaluatorInputs: EvaluatorInputFormatter;
}

const isStringifiableValue = (
  value: unknown
): value is string | number | boolean | bigint =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  typeof value === "bigint";

const getSingleStringifiedValue = (value: unknown) => {
  if (isStringifiableValue(value)) {
    return `${value}`;
  }

  if (typeof value === "object" && value != null && !Array.isArray(value)) {
    const entries = Object.entries(value);

    if (entries.length === 1 && isStringifiableValue(entries[0][1])) {
      return `${entries[0][1]}`;
    }
  }

  console.warn("Non-stringifiable value found when coercing", value);
  return `${value}`;
};

/**
 * Configuration to load a "CriteriaEvalChain" evaluator,
 * which prompts an LLM to determine whether the model's
 * prediction complies with the provided criteria.
 * @param criteria - The criteria to use for the evaluator.
 * @param llm - The language model to use for the evaluator.
 * @returns The configuration for the evaluator.
 * @example
 * ```ts
 * const evalConfig = {
 *   evaluators: [Criteria("helpfulness")],
 * };
 * @example
 * ```ts
 * const evalConfig = {
 *   evaluators: [
 *     Criteria({
 *       "isCompliant": "Does the submission comply with the requirements of XYZ"
 *     })
 *   ],
 * };
 * @example
 * ```ts
 * const evalConfig = {
 *   evaluators: [{
 *     evaluatorType: "criteria",
 *     criteria: "helpfulness"
 *     formatEvaluatorInputs: ...
 *   }]
 * };
 * ```
 * @example
 * ```ts
 * const evalConfig = {
 *   evaluators: [{
 *     evaluatorType: "criteria",
 *     criteria: { "isCompliant": "Does the submission comply with the requirements of XYZ" },
 *     formatEvaluatorInputs: ...
 *   }]
 * };
 */
export type Criteria = EvalConfig & {
  evaluatorType: "criteria";

  /**
   * The "criteria" to insert into the prompt template
   * used for evaluation. See the prompt at
   * https://smith.langchain.com/hub/langchain-ai/criteria-evaluator
   * for more information.
   */
  criteria?: CriteriaType | Record<string, string>;

  /**
   * The language model to use as the evaluator, defaults to GPT-4
   */
  llm?: BaseLanguageModel;
};

// for compatibility reasons
export type CriteriaEvalChainConfig = Criteria;

export function Criteria(
  criteria: CriteriaType | Record<string, string>,
  config?: Pick<
    Partial<LabeledCriteria>,
    "formatEvaluatorInputs" | "llm" | "feedbackKey"
  >
): EvalConfig {
  const formatEvaluatorInputs =
    config?.formatEvaluatorInputs ??
    ((payload) => ({
      prediction: getSingleStringifiedValue(payload.rawPrediction),
      input: getSingleStringifiedValue(payload.rawInput),
    }));

  if (typeof criteria !== "string" && Object.keys(criteria).length !== 1) {
    throw new Error(
      "Only one criteria key is allowed when specifying custom criteria."
    );
  }

  const criteriaKey =
    typeof criteria === "string" ? criteria : Object.keys(criteria)[0];

  return {
    evaluatorType: "criteria",
    criteria,
    feedbackKey: config?.feedbackKey ?? criteriaKey,
    llm: config?.llm,
    formatEvaluatorInputs,
  };
}

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
 * const evalConfig = {
 *   evaluators: [LabeledCriteria("correctness")],
 * };
 * @example
 * ```ts
 * const evalConfig = {
 *   evaluators: [
 *     LabeledCriteria({
 *       "mentionsAllFacts": "Does the include all facts provided in the reference?"
 *     })
 *   ],
 * };
 * @example
 * ```ts
 * const evalConfig = {
 *   evaluators: [{
 *     evaluatorType: "labeled_criteria",
 *     criteria: "correctness",
 *     formatEvaluatorInputs: ...
 *   }],
 * };
 * ```
 * @example
 * ```ts
 * const evalConfig = {
 *   evaluators: [{
 *     evaluatorType: "labeled_criteria",
 *     criteria: { "mentionsAllFacts": "Does the include all facts provided in the reference?" },
 *     formatEvaluatorInputs: ...
 *   }],
 * };
 */
export type LabeledCriteria = EvalConfig & {
  evaluatorType: "labeled_criteria";

  /**
   * The "criteria" to insert into the prompt template
   * used for evaluation. See the prompt at
   * https://smith.langchain.com/hub/langchain-ai/labeled-criteria
   * for more information.
   */
  criteria?: CriteriaType | Record<string, string>;

  /**
   * The language model to use as the evaluator, defaults to GPT-4
   */
  llm?: BaseLanguageModel;
};

export function LabeledCriteria(
  criteria: CriteriaType | Record<string, string>,
  config?: Pick<
    Partial<LabeledCriteria>,
    "formatEvaluatorInputs" | "llm" | "feedbackKey"
  >
): LabeledCriteria {
  const formatEvaluatorInputs =
    config?.formatEvaluatorInputs ??
    ((payload) => ({
      prediction: getSingleStringifiedValue(payload.rawPrediction),
      input: getSingleStringifiedValue(payload.rawInput),
      reference: getSingleStringifiedValue(payload.rawReferenceOutput),
    }));

  if (typeof criteria !== "string" && Object.keys(criteria).length !== 1) {
    throw new Error(
      "Only one labeled criteria key is allowed when specifying custom criteria."
    );
  }

  const criteriaKey =
    typeof criteria === "string" ? criteria : Object.keys(criteria)[0];

  return {
    evaluatorType: "labeled_criteria",
    criteria,
    feedbackKey: config?.feedbackKey ?? criteriaKey,
    llm: config?.llm,
    formatEvaluatorInputs,
  };
}

/**
 * Configuration to load a "EmbeddingDistanceEvalChain" evaluator,
 * which embeds distances to score semantic difference between
 * a prediction and reference.
 */
export type EmbeddingDistance = EvalConfig &
  EmbeddingDistanceEvalChainInput & { evaluatorType: "embedding_distance" };

export function EmbeddingDistance(
  distanceMetric: EmbeddingDistanceEvalChainInput["distanceMetric"],
  config?: Pick<
    Partial<LabeledCriteria>,
    "formatEvaluatorInputs" | "embedding" | "feedbackKey"
  >
): EmbeddingDistance {
  const formatEvaluatorInputs =
    config?.formatEvaluatorInputs ??
    ((payload) => ({
      prediction: getSingleStringifiedValue(payload.rawPrediction),
      reference: getSingleStringifiedValue(payload.rawReferenceOutput),
    }));

  return {
    evaluatorType: "embedding_distance",
    embedding: config?.embedding,
    distanceMetric,
    feedbackKey: config?.feedbackKey ?? "embedding_distance",
    formatEvaluatorInputs,
  };
}
