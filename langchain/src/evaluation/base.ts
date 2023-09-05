import {BaseChain, LLMChain, LLMChainInput} from "../chains/index.js";
import {ChainValues} from "../schema/index.js";
import {BaseLanguageModel} from "../base_language/index.js";
import {Callbacks} from "../callbacks/index.js";
import {BaseCallbackConfig} from "../callbacks/manager.js";

/**
 * Base input for evaluators.
 */
export interface LLMEvalChainInput<T extends Record<string, string> = Record<string, string>, L extends BaseLanguageModel = BaseLanguageModel> extends LLMChainInput<T, L> {

}


/**
 * Base class for evaluators.
 */
export abstract class LLMEvalChain<
    T extends Record<string, string> = Record<string, string>,
    L extends BaseLanguageModel = BaseLanguageModel
>
    extends LLMChain<T, L> {

    requiresInput?: boolean = false;

    requiresReference?: boolean = false;

    skipInputWarning?: string = `Ignoring input in ${this.constructor.name}, as it is not expected.`;

    skipReferenceWarning?: string = `Ignoring reference in ${this.constructor.name}, as it is not expected.`;

    /**
     * Check if the evaluation arguments are valid.
     * @param reference  The reference label.
     * @param input The input string.
     * @throws {Error} If the evaluator requires an input string but none is provided, or if the evaluator requires a reference label but none is provided.
     */
    checkEvaluationArgs(reference?: string, input?: string): void {
        if (this.requiresInput && input == null) {
            throw new Error(`${this.constructor.name} requires an input string.`);
        } else if (input != null && !this.requiresInput) {
            console.warn(this.skipInputWarning);
        }
        if (this.requiresReference && reference == null) {
            throw new Error(`${this.constructor.name} requires a reference string.`);
        } else if (reference != null && !this.requiresReference) {
            console.warn(this.skipReferenceWarning);
        }
    }
}

export abstract class EvalChain<
    RunInput extends ChainValues = ChainValues,
    RunOutput extends ChainValues = ChainValues> extends BaseChain<RunInput, RunOutput> {

    requiresInput?: boolean = false;

    requiresReference?: boolean = false;

    skipInputWarning?: string = `Ignoring input in ${this.constructor.name}, as it is not expected.`;

    skipReferenceWarning?: string = `Ignoring reference in ${this.constructor.name}, as it is not expected.`;

    /**
     * Check if the evaluation arguments are valid.
     * @param reference  The reference label.
     * @param input The input string.
     * @throws {Error} If the evaluator requires an input string but none is provided, or if the evaluator requires a reference label but none is provided.
     */
    checkEvaluationArgs(reference?: string, input?: string): void {
        if (this.requiresInput && input == null) {
            throw new Error(`${this.constructor.name} requires an input string.`);
        } else if (input != null && !this.requiresInput) {
            console.warn(this.skipInputWarning);
        }
        if (this.requiresReference && reference == null) {
            throw new Error(`${this.constructor.name} requires a reference string.`);
        } else if (reference != null && !this.requiresReference) {
            console.warn(this.skipReferenceWarning);
        }
    }
}


export interface StringEvaluatorArgs {
    prediction: string;
    reference?: string;
    input?: string;
}

export interface PairwiseStringEvaluatorArgs {
    prediction: string;
    predictionB: string;
}

/**
 * Grade, tag, or otherwise evaluate predictions relative to their inputs
 * and/or reference labels
 */
export abstract class LLMStringEvaluator<
    T extends Record<string, string> = Record<string, string>,
    L extends BaseLanguageModel = BaseLanguageModel
> extends LLMEvalChain<T, L> {

    /**
     * The name of the evaluation.
     */
    evaluationName?: string = this.constructor.name;

    /**
     * Evaluate Chain or LLM output, based on optional input and label.
     * @returns The evaluation results containing the score or value. It is recommended that the dictionary contain the following keys:
     * - score: the score of the evaluation, if applicable.
     * - value: the string value of the evaluation, if applicable.
     * - reasoning: the reasoning for the evaluation, if applicable.
     * @param args
     * @param callOptions
     * @param config
     */
    abstract _evaluateStrings(args: StringEvaluatorArgs, callOptions?: this["llm"]["CallOptions"], config?: Callbacks | BaseCallbackConfig): Promise<ChainValues>

    /**
     * Evaluate Chain or LLM output, based on optional input and label.
     * @returns The evaluation results containing the score or value. It is recommended that the dictionary contain the following keys:
     * - score: the score of the evaluation, if applicable.
     * - value: the string value of the evaluation, if applicable.
     * - reasoning: the reasoning for the evaluation, if applicable.
     * @param args
     * @param callOptions
     * @param config
     */
    evaluateStrings(args: StringEvaluatorArgs, callOptions?: this["llm"]["CallOptions"], config?: Callbacks | BaseCallbackConfig): Promise<ChainValues> {
        this.checkEvaluationArgs(args.reference, args.input);
        return this._evaluateStrings(args, callOptions, config);
    }
}

/**
 * Grade, tag, or otherwise evaluate predictions relative to their inputs
 * and/or reference labels
 */
export abstract class StringEvaluator extends EvalChain {

    /**
     * The name of the evaluation.
     */
    evaluationName?: string = this.constructor.name;

    /**
     * Evaluate Chain or LLM output, based on optional input and label.
     * @returns The evaluation results containing the score or value. It is recommended that the dictionary contain the following keys:
     * - score: the score of the evaluation, if applicable.
     * - value: the string value of the evaluation, if applicable.
     * - reasoning: the reasoning for the evaluation, if applicable.
     * @param args
     * @param callOptions
     * @param config
     */
    abstract _evaluateStrings(args: StringEvaluatorArgs, config?: Callbacks | BaseCallbackConfig): Promise<ChainValues>

    /**
     * Evaluate Chain or LLM output, based on optional input and label.
     * @returns The evaluation results containing the score or value. It is recommended that the dictionary contain the following keys:
     * - score: the score of the evaluation, if applicable.
     * - value: the string value of the evaluation, if applicable.
     * - reasoning: the reasoning for the evaluation, if applicable.
     * @param args
     * @param callOptions
     * @param config
     */
    evaluateStrings(args: StringEvaluatorArgs, config?: Callbacks | BaseCallbackConfig): Promise<ChainValues> {
        this.checkEvaluationArgs(args.reference, args.input);
        return this._evaluateStrings(args, config);
    }
}


/**
 * Grade, tag, or otherwise evaluate predictions relative to their inputs
 * and/or reference labels
 */
export abstract class PairwiseStringEvaluator extends EvalChain {

    /**
     * The name of the evaluation.
     */
    evaluationName?: string = this.constructor.name;

    /**
     * Evaluate Chain or LLM output, based on optional input and label.
     * @returns The evaluation results containing the score or value. It is recommended that the dictionary contain the following keys:
     * - score: the score of the evaluation, if applicable.
     * - value: the string value of the evaluation, if applicable.
     * - reasoning: the reasoning for the evaluation, if applicable.
     * @param args
     * @param callOptions
     * @param config
     */
    abstract _evaluateStringPairs(args: PairwiseStringEvaluatorArgs, config?: Callbacks | BaseCallbackConfig): Promise<ChainValues>

    /**
     * Evaluate Chain or LLM output, based on optional input and label.
     * @returns The evaluation results containing the score or value. It is recommended that the dictionary contain the following keys:
     * - score: the score of the evaluation, if applicable.
     * - value: the string value of the evaluation, if applicable.
     * - reasoning: the reasoning for the evaluation, if applicable.
     * @param args
     * @param callOptions
     * @param config
     */
    evaluateStringPairs(args: PairwiseStringEvaluatorArgs, config?: Callbacks | BaseCallbackConfig): Promise<ChainValues> {
        return this._evaluateStringPairs(args, config);
    }
}
