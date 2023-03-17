import { LLMChain } from "../../chains/index.js";
import { Agent, Tool, AgentInput } from "../index.js";
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "../../prompts/index.js";
import { interpolateFString } from "../../prompts/template.js";
import { PREFIX, SUFFIX, FORMAT_INSTRUCTIONS } from "./prompt.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import {
  AgentStep,
  BaseChatMessage,
  AIChatMessage,
} from "../../schema/index.js";
import { BaseOutputParser } from "../../output_parsers/base.js";
import { SerializedOutputParser } from "../../output_parsers/serde.js";

// presumably pointless to be a seperate parser class
export class AgentOputputParser extends BaseOutputParser {
  parse(text: string): unknown {
    return JSON.parse(text.trim());
  }

  getFormatInstructions(): string {
    return FORMAT_INSTRUCTIONS;
  }

  serialize(): SerializedOutputParser {
    throw new Error("Method not implemented.");
  }
}

export type CreatePromptArgs = {
  /** String to put after the list of tools. */
  systemMessage?: string;
  /** String to put before the list of tools. */
  humanMessage?: string;
  /** List of input variables the final prompt will expect. */
  inputVariables?: string[];
  /** Output parser to use for formatting. */
  outputParser?: BaseOutputParser;
};

type ZeroShotAgentInput = AgentInput;

/**
 * Agent for the MRKL chain.
 * @augments Agent
 */
export class ChatConversationalAgent2 extends Agent {
  outputParser: BaseOutputParser;

  constructor(input: ZeroShotAgentInput, outputParser: BaseOutputParser) {
    super(input);
    this.outputParser = outputParser;
  }

  _agentType(): string {
    /** Not turning on serialization until more sure of abstractions. */
    throw new Error("Method not implemented.");
  }

  llmPrefix() {
    return `{  "thought": "`;
  }

  jsonPrefix() {
    return `[\n${this.llmPrefix()}`;
  }

  finishToolName(): string {
    return "Finished";
  }

  // empty because were not stopping
  observationPrefix() {
    return "";
  }

  // empty we dont want to stop so we can parse the entire response as an object
  // needs a hack in agent.ts to bypass when empty
  _stop(): string[] {
    return [];
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

  constructScratchPad(steps: AgentStep[]): string | BaseChatMessage[] {
    if (steps.length === 0) {
      return [new AIChatMessage(this.jsonPrefix())];
    }

    const toolsText = steps.reduce((thoughts, { action, observation }) => {
      const tools = JSON.parse(this.jsonPrefix() + action.log);
      const tool = tools[0];
      tool.observation = observation;
      const val = [JSON.stringify(tool), this.llmPrefix()].join(",\n");
      return thoughts + val;
    }, "[");

    return [new AIChatMessage(toolsText)];
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
    const {
      systemMessage = PREFIX,
      humanMessage = SUFFIX,
      outputParser = new AgentOputputParser(),
    } = args ?? {};
    const toolStrings = tools
      .map((tool) => `${tool.name}: ${tool.description}`)
      .join("\n");
    const formatInstructions = interpolateFString(humanMessage, {
      format_instructions: outputParser.getFormatInstructions(),
    });

    const toolNames = tools.map((tool) => tool.name).join("\n");
    const finalPrompt = interpolateFString(formatInstructions, {
      tools: toolStrings,
      tool_names: toolNames,
    });
    const messages = [
      SystemMessagePromptTemplate.fromTemplate(systemMessage),
      new MessagesPlaceholder("chat_history"),
      HumanMessagePromptTemplate.fromTemplate(finalPrompt),
      new MessagesPlaceholder("agent_scratchpad"),
    ];
    return ChatPromptTemplate.fromPromptMessages(messages);
  }

  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: Tool[],
    args?: CreatePromptArgs
  ) {
    ChatConversationalAgent2.validateTools(tools);
    const prompt = ChatConversationalAgent2.createPrompt(tools, args);
    const chain = new LLMChain({ prompt, llm });
    const { outputParser = new AgentOputputParser() } = args ?? {};
    return new ChatConversationalAgent2(
      {
        llmChain: chain,
        allowedTools: tools.map((t) => t.name),
      },
      outputParser
    );
  }

  extractToolAndInput(text: string): { tool: string; input: string } | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actions = this.outputParser.parse(this.jsonPrefix() + text) as any[];
    if ("output" in actions[0]) {
      return { tool: this.finishToolName(), input: actions[0].output };
    }

    return { tool: actions[0].action, input: actions[0].action_input };
  }
}
