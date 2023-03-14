import { LLMChain } from "../../chains/index.js";
import {
  Agent,
  Tool,
  AgentInput,
  StaticAgent,
  staticImplements,
} from "../index.js";
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "../../prompts/index.js";
import { interpolateFString } from "../../prompts/template.js";
import {
  PREFIX,
  SUFFIX,
  FORMAT_INSTRUCTIONS,
  TEMPLATE_TOOL_RESPONSE,
} from "./prompt.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import {
  AgentStep,
  BaseChatMessage,
  AIChatMessage,
  HumanChatMessage,
} from "../../schema/index.js";
import {
  BaseOutputParser,
  SerializedOutputParser,
} from "../../output_parsers/base.js";

export class AgentOutputParser extends BaseOutputParser {
  parse(text: string): unknown {
    const cleanedOutput = text.trim();
    let jsonOutput = cleanedOutput;
    if (jsonOutput.includes("```json")) {
      jsonOutput = jsonOutput.split("```json")[1].trimLeft();
    }
    if (jsonOutput.startsWith("```")) {
      jsonOutput = jsonOutput.slice(3).trimLeft();
    }
    if (jsonOutput.endsWith("```")) {
      jsonOutput = jsonOutput.slice(0, -3).trimRight();
    }
    const response = JSON.parse(jsonOutput);
    return { action: response.action, action_input: response.action_input };
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
 * @augments StaticAgent
 */
@(staticImplements<StaticAgent>)
export class ChatConversationalAgent extends Agent {
  outputParser: BaseOutputParser;

  constructor(input: ZeroShotAgentInput, outputParser: BaseOutputParser) {
    super(input);
    this.outputParser = outputParser;
  }

  _agentType(): string {
    /** Not turning on serialization until more sure of abstractions. */
    throw new Error("Method not implemented.");
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

  constructScratchPad(steps: AgentStep[]): BaseChatMessage[] {
    const thoughts: BaseChatMessage[] = [];
    for (const step of steps) {
      thoughts.push(new AIChatMessage(step.action.log));
      thoughts.push(
        new HumanChatMessage(
          interpolateFString(TEMPLATE_TOOL_RESPONSE, {
            observation: step.observation,
          })
        )
      );
    }
    return thoughts;
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
      outputParser = new AgentOutputParser(),
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
    ChatConversationalAgent.validateTools(tools);
    const prompt = ChatConversationalAgent.createPrompt(tools, args);
    const chain = new LLMChain({ prompt, llm });
    const { outputParser = new AgentOutputParser() } = args ?? {};
    return new ChatConversationalAgent(
      {
        llmChain: chain,
        allowedTools: tools.map((t) => t.name),
      },
      outputParser
    );
  }

  extractToolAndInput(text: string): { tool: string; input: string } | null {
    try {
      const response = this.outputParser.parse(text) as {
        action: string;
        action_input: string;
      };
      return { tool: response.action, input: response.action_input };
    } catch {
      throw new Error(
        `Unable to parse JSON response from chat agent.\n\n${text}`
      );
    }
  }
}
