import { BaseLanguageModel } from "../../base_language/index.js";
import { LLMChain } from "../../chains/llm_chain.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";
import { AgentStep } from "../../schema/index.js";
import { Tool } from "../../tools/base.js";
import { Optional } from "../../types/type-utils.js";
import { Agent, AgentArgs, OutputParserArgs } from "../agent.js";
import { AgentInput } from "../types.js";
import { ChatAgentOutputParser } from "./outputParser.js";
import { FORMAT_INSTRUCTIONS, PREFIX, SUFFIX } from "./prompt.js";

const DEFAULT_HUMAN_MESSAGE_TEMPLATE = "{input}\n\n{agent_scratchpad}";

export interface ChatCreatePromptArgs {
  /** String to put after the list of tools. */
  suffix?: string;
  /** String to put before the list of tools. */
  prefix?: string;
  /** String to use directly as the human message template. */
  humanMessageTemplate?: string;
  /** List of input variables the final prompt will expect. */
  inputVariables?: string[];
}

export type ChatAgentInput = Optional<AgentInput, "outputParser">;

/**
 * Agent for the MRKL chain.
 * @augments Agent
 */
export class ChatAgent extends Agent {
  constructor(input: ChatAgentInput) {
    const outputParser =
      input?.outputParser ?? ChatAgent.getDefaultOutputParser();
    super({ ...input, outputParser });
  }

  _agentType() {
    return "chat-zero-shot-react-description" as const;
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

  static getDefaultOutputParser(_fields?: OutputParserArgs) {
    return new ChatAgentOutputParser();
  }

  async constructScratchPad(steps: AgentStep[]): Promise<string> {
    const agentScratchpad = await super.constructScratchPad(steps);
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
   * @param args.humanMessageTemplate - String to use directly as the human message template
   */
  static createPrompt(tools: Tool[], args?: ChatCreatePromptArgs) {
    const {
      prefix = PREFIX,
      suffix = SUFFIX,
      humanMessageTemplate = DEFAULT_HUMAN_MESSAGE_TEMPLATE,
    } = args ?? {};
    const toolStrings = tools
      .map((tool) => `${tool.name}: ${tool.description}`)
      .join("\n");
    const template = [prefix, toolStrings, FORMAT_INSTRUCTIONS, suffix].join(
      "\n\n"
    );
    const messages = [
      SystemMessagePromptTemplate.fromTemplate(template),
      HumanMessagePromptTemplate.fromTemplate(humanMessageTemplate),
    ];
    return ChatPromptTemplate.fromPromptMessages(messages);
  }

  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: Tool[],
    args?: ChatCreatePromptArgs & AgentArgs
  ) {
    ChatAgent.validateTools(tools);
    const prompt = ChatAgent.createPrompt(tools, args);
    const chain = new LLMChain({
      prompt,
      llm,
      callbacks: args?.callbacks ?? args?.callbackManager,
    });
    const outputParser =
      args?.outputParser ?? ChatAgent.getDefaultOutputParser();

    return new ChatAgent({
      llmChain: chain,
      outputParser,
      allowedTools: tools.map((t) => t.name),
    });
  }
}
