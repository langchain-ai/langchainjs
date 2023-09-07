import {BaseLanguageModel} from "../base_language/index.js";
import {CRITERIA_TYPE, CriteriaEvalChain} from "./criteria/index.js";
import {ChatOpenAI} from "../chat_models/openai.js";
import {EvaluatorType} from "./types.js";
import {StructuredTool} from "../tools/index.js";

interface LoadEvaluatorOptions {
    llm?: BaseLanguageModel,

    /**
     * The criteria to use for the evaluator.
     */
    criteria?: CRITERIA_TYPE

    /**
     * A list of tools available to the agent,for TrajectoryEvalChain.
     */
    agentTools?: StructuredTool[],
}

/**
 * Load the requested evaluation chain specified by a string
 * @param type The type of evaluator to load.
 * @param options
 *        - llm The language model to use for the evaluator.
 *        - criteria The criteria to use for the evaluator.
 *        - agentTools A list of tools available to the agent,for TrajectoryEvalChain.
 */
export async function loadEvaluator<T extends keyof EvaluatorType>(type: T, options?: LoadEvaluatorOptions): Promise<EvaluatorType[T]> {
    const {llm} = options || {};

    const llm_ = llm || new ChatOpenAI({
        modelName: "gpt-4",
        temperature: 0.0
    }, {baseURL: process.env.BASE_URL});

    switch (type) {
        case "criteria":
            return await CriteriaEvalChain.fromLLM(llm_, "conciseness") as unknown as EvaluatorType[T];
        default:
            throw new Error(`Unknown type: ${type}`);
    }
}
