import { BaseLLMOutputParser } from "../../schema/output_parser.js";
import {
  eqSet,
  EvalOutputType,
  LLMEvalChainInput,
  LLMPairwiseStringEvaluator,
  LLMPairwiseStringEvaluatorArgs,
} from "../base.js";

import {
  ChainValues,
  ChatGeneration,
  Generation,
  RUN_KEY,
} from "../../schema/index.js";
import { PROMPT, PROMPT_WITH_REFERENCES } from "./prompt.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { Callbacks } from "../../callbacks/index.js";
import { BaseCallbackConfig } from "../../callbacks/manager.js";
import { BasePromptTemplate } from "../../prompts/index.js";
import { ConstitutionalPrinciple } from "../../chains/index.js";
import { Criteria, CriteriaLike } from "../criteria/criteria.js";

const SUPPORTED_CRITERIA: Record<Criteria, string> = /* #__PURE__ */ {
  conciseness: "Is the submission concise and to the point?",
  relevance: "Is the submission referring to a real quote from the text?",
  correctness: "Is the submission correct, accurate, and factual?",
  coherence: "Is the submission coherent, well-structured, and organized?",
  harmfulness: "Is the submission harmful, offensive, or inappropriate?",
  maliciousness: "Is the submission malicious in any way?",
  helpfulness: "Is the submission helpful, insightful, and appropriate?",
  controversiality: "Is the submission controversial or debatable?",
  misogyny: "Is the submission misogynistic? If so, response Y.",
  criminality: "Is the submission criminal in any way?",
  insensitivity: "Is the submission insensitive to any group of people?",
  depth: "Does the submission demonstrate depth of thought?",
  creativity: "Does the submission demonstrate novelty or unique ideas?",
  detail: "Does the submission demonstrate attention to detail?",
};

/**
 * A parser for the output of the PairwiseStringEvalChain.
 */
export class PairwiseStringResultOutputParser extends BaseLLMOutputParser<EvalOutputType> {
  static lc_name(): string {
    return "PairwiseStringResultOutputParser";
  }

  lc_namespace = ["langchain", "evaluation", "comparison"];

  parseResult(
    generations: Generation[] | ChatGeneration[],
    _callbacks: Callbacks | undefined
  ): Promise<EvalOutputType> {
    const { text } = generations[0];

    const parsed = text.trim().split("\n");
    let reasoning;
    let verdict;

    if (parsed.length === 1) {
      [verdict] = parsed;
    } else {
      // The last one is the verdict, the preceding one is the reasoning.
      reasoning = parsed.slice(0, parsed.length - 1).join("");
      verdict = parsed[parsed.length - 1];
    }

    verdict = verdict.replace(/\[+/, "").replace(/]+/, "");
    if (!["A", "B", "C"].includes(verdict)) {
      throw new Error(
        `Invalid verdict: ${verdict}. ` +
          "Verdict must be one of 'A', 'B', or 'C'."
      );
    }
    // C means the models are tied. Return 'None' meaning no preference
    const score = {
      A: 1,
      B: 0,
      C: 0.5,
    }[verdict];

    if (score === undefined) {
      throw new Error("Could not parse score from evaluator output.");
    }

    return Promise.resolve({
      reasoning: reasoning || "",
      value: verdict,
      score,
    });
  }
}

/**
 * A chain for comparing two outputs, such as the outputs
 * of two models, prompts, or outputs of a single model on similar inputs.
 */
export class PairwiseStringEvalChain extends LLMPairwiseStringEvaluator {
  static lc_name(): string {
    return "PairwiseStringEvalChain";
  }

  criterionName?: string;

  evaluationName?: string = this.criterionName;

  requiresInput = true;

  requiresReference = false;

  skipReferenceWarning = `Ignoring reference in ${this.constructor.name}, as it is not expected.
To use references, use the LabeledPairwiseStringEvalChain instead.`;

  outputParser = new PairwiseStringResultOutputParser();

  static resolvePairwiseCriteria(
    criteria?: CriteriaLike
  ): Record<string, string> {
    if (criteria === undefined) {
      const defaultCriteria: Criteria[] = [
        "helpfulness",
        "relevance",
        "correctness",
        "depth",
      ];

      return defaultCriteria.reduce(
        (accumulator: Record<string, string>, currentValue) => {
          accumulator[currentValue] = SUPPORTED_CRITERIA[currentValue];
          return accumulator;
        },
        {}
      );
    }

    let criteria_: { [key: string]: string } = {};

    if (typeof criteria === "string") {
      if (criteria in SUPPORTED_CRITERIA) {
        criteria_ = { [criteria]: SUPPORTED_CRITERIA[criteria] };
      }
      // eslint-disable-next-line no-instanceof/no-instanceof
    } else if (criteria instanceof ConstitutionalPrinciple) {
      criteria_ = { [criteria.name]: criteria.critiqueRequest };
    } else {
      if (!criteria) {
        throw new Error(
          "Criteria cannot be empty. " +
            "Please provide a criterion name or a mapping of the criterion name" +
            " to its description."
        );
      }
      criteria_ = { ...criteria };
    }
    return criteria_;
  }

  static resolvePairwisePrompt(prompt?: BasePromptTemplate) {
    const _prompt = prompt || PROMPT;
    const expectedInputVars: Set<string> = new Set([
      "prediction",
      "predictionB",
      "input",
      "criteria",
    ]);
    // Create a Set from inputVariables for a valid comparison
    const inputVarsSet: Set<string> = new Set(_prompt.inputVariables);

    if (!eqSet(expectedInputVars, inputVarsSet)) {
      throw new Error(
        `Input variables should be ${[...expectedInputVars]}, but got ${
          _prompt.inputVariables
        }`
      );
    }
    return _prompt;
  }

  /**
   * Create a new instance of the PairwiseStringEvalChain.
   * @param llm
   * @param criteria The criteria to use for evaluation.
   * @param chainOptions Options to pass to the chain.
   */
  static async fromLLM(
    llm: BaseLanguageModel,
    criteria?: CriteriaLike,
    chainOptions?: Partial<Omit<LLMEvalChainInput, "llm">>
  ) {
    let prompt = this.resolvePairwisePrompt(chainOptions?.prompt);

    const criteria_ = this.resolvePairwiseCriteria(criteria);
    const criteriaStr = Object.entries(criteria_)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    prompt = await prompt.partial({ criteria: criteriaStr });

    const options = chainOptions;
    if (options) {
      // remove prompt from chainOptions
      delete options.prompt;
    }

    return new this({
      llm,
      prompt,
      ...options,
    });
  }

  _prepareOutput(result: ChainValues) {
    const parsed = result[this.outputKey];
    if (RUN_KEY in result && result[RUN_KEY]) {
      parsed[RUN_KEY] = result[RUN_KEY];
    }
    return parsed;
  }

  async _evaluateStringPairs(
    args: LLMPairwiseStringEvaluatorArgs,
    callOptions: this["llm"]["CallOptions"],
    config?: Callbacks | BaseCallbackConfig
  ): Promise<ChainValues> {
    const result = await this.call({ ...args, ...callOptions }, config);

    return this._prepareOutput(result);
  }
}

/**
 * A chain for comparing two outputs, such as the outputs
 * of two models, prompts, or outputs of a single model on similar inputs,
 * with labeled preferences.
 */
export class LabeledPairwiseStringEvalChain extends PairwiseStringEvalChain {
  static lc_name(): string {
    return "LabeledPairwiseStringEvalChain";
  }

  requiresReference = true;

  static resolvePairwisePrompt(prompt?: BasePromptTemplate) {
    const _prompt = prompt || PROMPT_WITH_REFERENCES;
    const expectedInputVars: Set<string> = new Set([
      "input",
      "prediction",
      "predictionB",
      "reference",
      "criteria",
    ]);
    // Create a Set from inputVariables for a valid comparison
    const inputVarsSet: Set<string> = new Set(_prompt.inputVariables);

    if (!eqSet(expectedInputVars, inputVarsSet)) {
      throw new Error(
        `Input variables should be ${[...expectedInputVars]}, but got ${
          _prompt.inputVariables
        }`
      );
    }
    return _prompt;
  }
}
