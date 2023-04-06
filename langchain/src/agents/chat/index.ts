import { LLMChain } from "../../chains/llm_chain.js";
import { Agent } from "../agent.js";
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from "../../prompts/chat.js";
import { PREFIX, SUFFIX, FORMAT_INSTRUCTIONS } from "./prompt.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { AgentStep } from "../../schema/index.js";
import { AgentInput } from "../types.js";
import { Tool } from "../tools/base.js";

const FINAL_ANSWER_ACTION = "Final Answer:";

export type CreatePromptArgs = {
  /** String to put after the list of tools. */
  suffix?: string;
  /** String to put before the list of tools. */
  prefix?: string;
  /** List of input variables the final prompt will expect. */
  inputVariables?: string[];
};

type ZeroShotAgentInput = AgentInput;

/**
 * Agent for the MRKL chain.
 * @augments Agent
 */
export class ChatAgent extends Agent {
  constructor(input: ZeroShotAgentInput) {
    super(input);
  }

  _agentType() {
    return "zero-shot-react-description" as const;
  }

  observationPrefix() {
    return "Observation: ";
  }

  llmPrefix() {
    return "Thought:";
  }

  _stop(): string[] {
    return ["Observation:"];
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

  constructScratchPad(steps: AgentStep[]): string {
    const agentScratchpad = super.constructScratchPad(steps);
    if (agentScratchpad) {
      return `This was your previous work (but I haven't seen any of it! I only see what you return as final answer):\n${agentScratchpad}`;
    }
    return agentScratchpad;
  }

  /**
   * Create prompt in the style of the zero shot agent.
   *
   * @param tools - List of tools the agent will have access to, used to format the prompt.
   * @param args - Arguments to create the prompt with.
   * @param args.suffix - String to put after the list of tools.
   * @param args.prefix - String to put before the list of tools.
   */
  static createPrompt(tools: Tool[], args?: CreatePromptArgs) {
    const { prefix = PREFIX, suffix = SUFFIX } = args ?? {};
    const toolStrings = tools
      .map((tool) => `${tool.name}: ${tool.description}`)
      .join("\n");
    const template = [prefix, toolStrings, FORMAT_INSTRUCTIONS, suffix].join(
      "\n\n"
    );
    const messages = [
      SystemMessagePromptTemplate.fromTemplate(template),
      HumanMessagePromptTemplate.fromTemplate("{input}\n\n{agent_scratchpad}"),
    ];
    return ChatPromptTemplate.fromPromptMessages(messages);
  }

  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: Tool[],
    args?: CreatePromptArgs
  ) {
    ChatAgent.validateTools(tools);
    const prompt = ChatAgent.createPrompt(tools, args);
    const chain = new LLMChain({ prompt, llm });
    return new ChatAgent({
      llmChain: chain,
      allowedTools: tools.map((t) => t.name),
    });
  }

  async extractToolAndInput(
    text: string
  ): Promise<{ tool: string; input: string } | null> {
    if (text.includes(FINAL_ANSWER_ACTION)) {
      const parts = text.split(FINAL_ANSWER_ACTION);
      const input = parts[parts.length - 1].trim();
      return { tool: "Final Answer", input };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, action, __] = text.split("```");
    try {
      const response = JSON.parse(action.trim());
      return { tool: response.action, input: response.action_input };
    } catch {
      throw new Error(
        `Unable to parse JSON response from chat agent.\n\n${text}`
      );
    }
  }
}
