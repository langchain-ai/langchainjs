import { BaseLLMOutputParser } from "../../schema/output_parser.js";
import {
  AgentTrajectoryEvaluator,
  EvalOutputType,
  LLMEvalChainInput,
  LLMTrajectoryEvaluatorArgs,
} from "../base.js";

import {
  AgentStep,
  ChainValues,
  ChatGeneration,
  Generation,
  RUN_KEY,
} from "../../schema/index.js";
import { Callbacks } from "../../callbacks/index.js";
import { BaseCallbackConfig } from "../../callbacks/manager.js";
import { BasePromptTemplate } from "../../prompts/index.js";
import { StructuredTool } from "../../tools/index.js";
import { EVAL_CHAT_PROMPT, TOOL_FREE_EVAL_CHAT_PROMPT } from "./prompt.js";
import { BaseChatModel } from "../../chat_models/base.js";

/**
 * A parser for the output of the TrajectoryEvalChain.
 */
export class TrajectoryOutputParser extends BaseLLMOutputParser<EvalOutputType> {
  static lc_name(): string {
    return "TrajectoryOutputParser";
  }

  lc_namespace = ["langchain", "evaluation", "agents"];

  parseResult(
    generations: Generation[] | ChatGeneration[],
    _callbacks: Callbacks | undefined
  ): Promise<EvalOutputType> {
    const { text } = generations[0];

    if (!text.includes("Score:")) {
      throw new Error(`Could not find score in model eval output: ${text}`);
    }

    let [reasoning, scoreStr] = text.split("Score:", 2);
    reasoning = reasoning.trim();
    scoreStr = scoreStr.trim();

    // Use regex to extract the score.
    // This will get the number in the string, even if it is a float or more than 10.
    // E.g. "Score: 1" will return 1, "Score: 3.5" will return 3.5, and
    // "Score: 10" will return 10.
    // The score should be an integer digit in the range 1-5.

    const scoreMatch = scoreStr.match(/(\d+(\.\d+)?)/);
    if (scoreMatch === null || scoreMatch[1].includes(".")) {
      throw new Error(
        `Score is not an integer digit in the range 1-5: ${text}`
      );
    }

    const score = +scoreMatch[1];
    if (score < 1 || score > 5) {
      throw new Error(`Score is not a digit in the range 1-5: ${text}`);
    }

    const normalizedScore = (score - 1) / 4;

    return Promise.resolve({
      reasoning,
      score: normalizedScore,
    });
  }
}

/**
 * A chain for evaluating ReAct style agents.
 *
 * This chain is used to evaluate ReAct style agents by reasoning about
 * the sequence of actions taken and their outcomes.
 */
export class TrajectoryEvalChain extends AgentTrajectoryEvaluator {
  static lc_name(): string {
    return "TrajectoryEvalChain";
  }

  criterionName?: string;

  evaluationName?: string = this.criterionName;

  requiresInput = true;

  requiresReference = false;

  outputParser = new TrajectoryOutputParser();

  static resolveTrajectoryPrompt(
    prompt?: BasePromptTemplate | undefined,
    agentTools?: StructuredTool[]
  ) {
    let _prompt;
    if (prompt) {
      _prompt = prompt;
    } else if (agentTools) {
      _prompt = EVAL_CHAT_PROMPT;
    } else {
      _prompt = TOOL_FREE_EVAL_CHAT_PROMPT;
    }

    return _prompt;
  }

  /**
   * Get the description of the agent tools.
   *
   * @returns The description of the agent tools.
   */
  static toolsDescription(agentTools: StructuredTool[]): string {
    return agentTools
      .map(
        (tool, i) =>
          `Tool ${i + 1}: ${tool.name}\n Description: ${tool.description}`
      )
      .join("\n\n");
  }

  /**
   * Create a new TrajectoryEvalChain.
   * @param llm
   * @param agentTools - The tools used by the agent.
   * @param chainOptions - The options for the chain.
   */
  static async fromLLM(
    llm: BaseChatModel,
    agentTools?: StructuredTool[],
    chainOptions?: Partial<Omit<LLMEvalChainInput, "llm">>
  ) {
    let prompt = this.resolveTrajectoryPrompt(chainOptions?.prompt, agentTools);
    if (agentTools) {
      const toolDescriptions = this.toolsDescription(agentTools);
      prompt = await prompt.partial({ toolDescriptions });
    }

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

  /**
   * Get the agent trajectory as a formatted string.
   *
   * @param steps - The agent trajectory.
   * @returns The formatted agent trajectory.
   */
  getAgentTrajectory(steps: AgentStep[]): string {
    return steps
      .map((step, i) => {
        const { action, observation } = step;

        return (
          `Step ${i + 1}:\n` +
          `Tool used: ${action.tool}\n` +
          `Tool input: ${action.toolInput}\n` +
          `Tool output: ${observation}`
        );
      })
      .join("\n\n");
  }

  formatReference(reference?: string): string {
    if (!reference) {
      return "";
    }
    return `
The following is the expected answer. Use this to measure correctness:
[GROUND_TRUTH]
${reference}
[END_GROUND_TRUTH]
        `;
  }

  async _evaluateAgentTrajectory(
    args: LLMTrajectoryEvaluatorArgs,
    callOptions: this["llm"]["CallOptions"],
    config?: Callbacks | BaseCallbackConfig
  ): Promise<ChainValues> {
    const { input, prediction, reference, agentTrajectory } = args;

    const inputs = {
      question: input,
      agentTrajectory: this.getAgentTrajectory(agentTrajectory),
      answer: prediction,
      reference: this.formatReference(reference),
    };

    const result = await this.call({ ...inputs, ...callOptions }, config);

    return this._prepareOutput(result);
  }
}
