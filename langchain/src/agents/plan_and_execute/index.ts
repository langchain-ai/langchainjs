import { BaseLanguageModel } from "../../base_language/index.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { Tool } from "../../tools/base.js";
import { BasePlanAndExecuteAgent, BasePlanAndExecuteAgentInput, BasePlanner, BaseStepExecutor, LLMChainPlanner, ChainStepExecutor } from "./base.js";
import { CHAT_PROMPT } from "./prompt.js";
import { PlanOutputParser } from "./outputParser.js";
import { ChatAgent } from "../chat/index.js";
import { AgentExecutor } from "../executor.js";

export interface ZeroShotCreatePromptArgs {
  /** String to put after the list of tools. */
  suffix?: string;
  /** String to put before the list of tools. */
  prefix?: string;
  /** List of input variables the final prompt will expect. */
  inputVariables?: string[];
}

export interface PlanAndExecuteAgentArgs {
  planner?: BasePlanner;
  stepExecutor?: BaseStepExecutor;
}

/**
 * Agent for the PlanAndExecute chain.
 * @augments BasePlanAndExecuteAgent
 */
export class PlanAndExecuteAgent extends BasePlanAndExecuteAgent {

  constructor(input: BasePlanAndExecuteAgentInput) {
    // const outputParser =
    //   input?.outputParser ?? PlanAndExecuteAgent.getDefaultOutputParser();
    super({ ...input});
  }

  _agentType() {
    return "plan-and-execute" as const;
  }

  // observationPrefix() {
  //   return "Observation: ";
  // }

  // llmPrefix() {
  //   return "Thought:";
  // }

  static getDefaultPlanner(llm: BaseLanguageModel) {
    const plannerLlmChain = new LLMChain({
      llm,
      prompt: PlanAndExecuteAgent.createPlannerPrompt(),
      verbose: true
    });
    return new LLMChainPlanner(plannerLlmChain, new PlanOutputParser());
  }

  static getDefaultStepExecutor(llm: BaseLanguageModel, tools: Tool[]) {
    const agent = ChatAgent.fromLLMAndTools(llm, tools, {
      humanMessageTemplate: `Previous steps: {previous_steps}\n\nCurrent objective: {current_step}\n\n{agent_scratchpad}`,
    });
    return new ChainStepExecutor(
      AgentExecutor.fromAgentAndTools({
        agent,
        tools
      })
    );
  }

  static validateTools(tools: Tool[]) {
    const invalidTool = tools.find((tool) => !tool.description);
    if (invalidTool) {
      const msg =
        `Got a tool ${invalidTool.name} without a description.` +
        ` This agent requires descriptions for all tools.`;
      throw new Error(msg);
    }
  }

  /**
   * Create prompt in the style of the zero shot agent.
   *
   * @param tools - List of tools the agent will have access to, used to format the prompt.
   * @param args - Arguments to create the prompt with.
   * @param args.suffix - String to put after the list of tools.
   * @param args.prefix - String to put before the list of tools.
   * @param args.inputVariables - List of input variables the final prompt will expect.
   */
  static createPlannerPrompt() {
    return CHAT_PROMPT;
  }

  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: Tool[],
    args?: PlanAndExecuteAgentArgs
  ) {
    PlanAndExecuteAgent.validateTools(tools);
    const planner = args?.planner ?? PlanAndExecuteAgent.getDefaultPlanner(llm);
    const stepExecutor = args?.stepExecutor ?? PlanAndExecuteAgent.getDefaultStepExecutor(llm, tools);
    return new PlanAndExecuteAgent({
      planner,
      stepExecutor,
    });
  }

  // static async deserialize(
  //   data: SerializedZeroShotAgent & { llm?: BaseLanguageModel; tools?: Tool[] }
  // ): Promise<PlanAndExecuteAgent> {
  //   const { llm, tools, ...rest } = data;
  //   return deserializeHelper(
  //     llm,
  //     tools,
  //     rest,
  //     (
  //       llm: BaseLanguageModel,
  //       tools: Tool[],
  //       args: SerializedFromLLMAndTools
  //     ) =>
  //       ZeroShotAgent.fromLLMAndTools(llm, tools, {
  //         prefix: args.prefix,
  //         suffix: args.suffix,
  //         inputVariables: args.input_variables,
  //       }),
  //     (args) => new ZeroShotAgent(args)
  //   );
  // }
}
