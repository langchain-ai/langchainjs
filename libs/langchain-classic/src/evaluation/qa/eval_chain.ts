import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import { ChainValues } from "@langchain/core/utils/types";
import { PromptTemplate } from "@langchain/core/prompts";
import { QA_PROMPT } from "./prompt.js";
import { LLMChain, LLMChainInput } from "../../chains/llm_chain.js";

export interface EvaluateArgs {
  questionKey: string;
  answerKey: string;
  predictionKey: string;
}

const eqSet = (xs: Set<string>, ys: Set<string>) =>
  xs.size === ys.size && [...xs].every((x) => ys.has(x));

export class QAEvalChain extends LLMChain {
  static lc_name() {
    return "QAEvalChain";
  }

  static fromLlm(
    llm: BaseLanguageModelInterface,
    options: {
      prompt?: PromptTemplate;
      chainInput?: Omit<LLMChainInput, "llm">;
    } = {}
  ): QAEvalChain {
    const prompt = options.prompt || QA_PROMPT;
    const expectedInputVars: Set<string> = new Set([
      "query",
      "answer",
      "result",
    ]);
    // Create a Set from inputVariables for a valid comparison
    const inputVarsSet: Set<string> = new Set(prompt.inputVariables);

    if (!eqSet(expectedInputVars, inputVarsSet)) {
      throw new Error(
        `Input variables should be ${[...expectedInputVars]}, but got ${
          prompt.inputVariables
        }`
      );
    }
    return new this({ llm, prompt, ...options.chainInput });
  }

  async evaluate(
    examples: ChainValues,
    predictions: ChainValues,
    args: EvaluateArgs = {
      questionKey: "query",
      answerKey: "answer",
      predictionKey: "result",
    }
  ): Promise<ChainValues> {
    const inputs = examples.map((example: ChainValues, i: number) => ({
      query: example[args.questionKey],
      answer: example[args.answerKey],
      result: predictions[i][args.predictionKey],
    }));

    return await this.apply(inputs);
  }
}
