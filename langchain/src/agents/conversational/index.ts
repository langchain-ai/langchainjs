import { deserializeHelper } from "../helpers.js";
import { BaseLanguageModel } from "../../schema/index.js";
import { LLMChain } from "../../chains/index.js";
import {
  Agent,
  Tool,
  AgentInput,
  StaticAgent,
  staticImplements,
  SerializedAgentT,
} from "../index.js";
import { PromptTemplate } from "../../prompts/index.js";
import { PREFIX, SUFFIX, formatInstructions } from "./prompt.js";

type SerializedFromLLMAndTools = {
  prefix?: string;
  suffix?: string;
  input_variables?: string[];
  ai_prefix?: string;
  human_prefix?: string;
};

export type SerializedConversationalAgent = SerializedAgentT<
  "conversational-react-description",
  SerializedFromLLMAndTools,
  AgentInput
>;

export type CreatePromptArgs = {
  /** String to put before the list of tools. */
  prefix?: string;
  /** String to put after the list of tools. */
  suffix?: string;
  /** Prefix to use for AI generated responses. */
  aiPrefix?: string;
  /** Prefix to use for human responses. */
  humanPrefix?: string;
  /** List of input variables the final prompt will expect. */
  inputVariables?: string[];
};

export interface ConversationalAgentInput extends AgentInput {
  aiPrefix?: string;
}

/**
 * Agent for the MRKL chain.
 * @augments Agent
 * @augments StaticAgent
 */
@(staticImplements<StaticAgent>)
export class ConversationalAgent extends Agent {
  aiPrefix: string;

  constructor(input: ConversationalAgentInput) {
    super(input);
    this.aiPrefix = input.aiPrefix || "AI";
  }

  _agentType() {
    return "conversational-react-description" as const;
  }

  observationPrefix() {
    return "Observation: ";
  }

  llmPrefix() {
    return "Thought:";
  }

  finishToolName() {
    return this.aiPrefix;
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
   * Create prompt in the style of the conversational agent.
   *
   * @param tools - List of tools the agent will have access to, used to format the prompt.
   * @param args - Arguments to create the prompt with.
   * @param args.prefix - String to put before the list of tools.
   * @param args.suffix - String to put after the list of tools.
   * @param args.aiPrefix - Prefix to use for AI generated responses.
   * @param args.humanPrefix - Prefix to use for human responses.
   * @param args.inputVariables - List of input variables the final prompt will expect.
   */
  static createPrompt(tools: Tool[], args?: CreatePromptArgs) {
    const {
      prefix = PREFIX,
      suffix = SUFFIX,
      aiPrefix = "AI", // if you override this, remember to override aiPrefix in constructor for finishToolName
      humanPrefix = "Human",
      inputVariables = ["input", "chat_history", "agent_scratchpad"],
    } = args ?? {};

    const toolStrings = tools
      .map((tool) => `${tool.name}: ${tool.description}`)
      .join("\n");

    const toolNames = tools.map((tool) => tool.name).join("\n");

    const instructions = formatInstructions(toolNames, aiPrefix, humanPrefix);
    const template = [prefix, toolStrings, instructions, suffix].join("\n\n");
    return new PromptTemplate({
      template,
      inputVariables,
    });
  }

  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: Tool[],
    args?: CreatePromptArgs
  ) {
    ConversationalAgent.validateTools(tools);
    const prompt = ConversationalAgent.createPrompt(tools, args);
    const chain = new LLMChain({ prompt, llm });
    return new ConversationalAgent({
      llmChain: chain,
      allowedTools: tools.map((t) => t.name),
    });
  }

  extractToolAndInput(text: string): { tool: string; input: string } | null {
    if (text.includes(`${this.aiPrefix}:`)) {
      const parts = text.split(`${this.aiPrefix}:`);
      const input = parts[parts.length - 1].trim();
      return { tool: this.aiPrefix, input };
    }

    const match = /Action: (.*)\nAction Input: (.*)/s.exec(text);
    if (!match) {
      throw new Error(`Could not parse LLM output: ${text}`);
    }

    return {
      tool: match[1].trim(),
      input: match[2].trim().replace(/^"+|"+$/g, ""),
    };
  }

  static async deserialize(
    data: SerializedConversationalAgent & {
      llm?: BaseLanguageModel;
      tools?: Tool[];
    }
  ): Promise<ConversationalAgent> {
    const { llm, tools, ...rest } = data;
    return deserializeHelper(
      llm,
      tools,
      rest,
      (
        llm: BaseLanguageModel,
        tools: Tool[],
        args: SerializedFromLLMAndTools
      ) =>
        ConversationalAgent.fromLLMAndTools(llm, tools, {
          prefix: args.prefix,
          suffix: args.suffix,
          aiPrefix: args.ai_prefix,
          humanPrefix: args.human_prefix,
          inputVariables: args.input_variables,
        }),
      (args) => new ConversationalAgent(args)
    );
  }
}
