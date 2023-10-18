import { Tool } from "../../tools/base.js";
import { LLMChain } from "../../chains/llm_chain.js";
import {
  AgentStep,
  AgentAction,
  AgentFinish,
  ChainValues,
} from "../../schema/index.js";
import {
  AIMessagePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "../../prompts/chat.js";
import { AgentArgs, BaseSingleActionAgent } from "../agent.js";
import { OutputParserException } from "../../schema/output_parser.js";
import { AGENT_INSTRUCTIONS } from "./prompt.js";
import { CallbackManager } from "../../callbacks/manager.js";
import { BaseLanguageModel } from "../../base_language/index.js";

/**
 * Interface for the input to the XMLAgent class.
 */
export interface XMLAgentInput {
  tools: Tool[];
  llmChain: LLMChain;
}

/**
 * Parses the output text from the agent and returns an AgentAction or
 * AgentFinish object.
 * @param text The output text from the agent.
 * @returns An AgentAction or AgentFinish object.
 */
export async function parseOutput(
  text: string
): Promise<AgentAction | AgentFinish> {
  if (text.includes("</tool>")) {
    const [tool, toolInput] = text.split("</tool>");
    const _tool = tool.split("<tool>")[1];
    const _toolInput = toolInput.split("<tool_input>")[1];
    return { tool: _tool, toolInput: _toolInput, log: text };
  } else if (text.includes("<final_answer>")) {
    const [, answer] = text.split("<final_answer>");
    return { returnValues: { output: answer }, log: text };
  } else {
    throw new OutputParserException(`Could not parse LLM output: ${text}`);
  }
}

/**
 * Class that represents an agent that uses XML tags.
 */
export class XMLAgent extends BaseSingleActionAgent implements XMLAgentInput {
  static lc_name() {
    return "XMLAgent";
  }

  lc_namespace = ["langchain", "agents", "xml"];

  tools: Tool[];

  llmChain: LLMChain;

  _agentType() {
    return "xml" as const;
  }

  constructor(fields: XMLAgentInput) {
    super(fields);
    this.tools = fields.tools;
    this.llmChain = fields.llmChain;
  }

  get inputKeys() {
    return ["input"];
  }

  static createPrompt() {
    return ChatPromptTemplate.fromMessages([
      HumanMessagePromptTemplate.fromTemplate(AGENT_INSTRUCTIONS),
      AIMessagePromptTemplate.fromTemplate("{intermediate_steps}"),
    ]);
  }

  /**
   * Plans the next action or finish state of the agent based on the
   * provided steps, inputs, and optional callback manager.
   * @param steps The steps to consider in planning.
   * @param inputs The inputs to consider in planning.
   * @param callbackManager Optional CallbackManager to use in planning.
   * @returns A Promise that resolves to an AgentAction or AgentFinish object representing the planned action or finish state.
   */
  async plan(
    steps: AgentStep[],
    inputs: ChainValues,
    callbackManager?: CallbackManager
  ): Promise<AgentAction | AgentFinish> {
    let log = "";
    for (const { action, observation } of steps) {
      log += `<tool>${action.tool}</tool><tool_input>${action.toolInput}</tool_input><observation>${observation}</observation>`;
    }
    let tools = "";
    for (const tool of this.tools) {
      tools += `${tool.name}: ${tool.description}\n`;
    }
    const _inputs = {
      intermediate_steps: log,
      tools,
      question: inputs.input,
      stop: ["</tool_input>", "</final_answer>"],
    };
    const response = await this.llmChain.call(_inputs, callbackManager);
    return parseOutput(response[this.llmChain.outputKey]);
  }

  /**
   * Creates an XMLAgent from a BaseLanguageModel and a list of tools.
   * @param llm The BaseLanguageModel to use.
   * @param tools The tools to be used by the agent.
   * @param args Optional arguments for creating the agent.
   * @returns An instance of XMLAgent.
   */
  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: Tool[],
    args?: XMLAgentInput & Pick<AgentArgs, "callbacks">
  ) {
    const prompt = XMLAgent.createPrompt();
    const chain = new LLMChain({
      prompt,
      llm,
      callbacks: args?.callbacks,
    });
    return new XMLAgent({
      llmChain: chain,
      tools,
    });
  }
}
