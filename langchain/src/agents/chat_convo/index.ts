import { BaseLanguageModel } from "../../base_language/index.js";
import { LLMChain } from "../../chains/llm_chain.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";
import { renderTemplate } from "../../prompts/template.js";
import {
  AIChatMessage,
  AgentStep,
  BaseChatMessage,
  HumanChatMessage,
} from "../../schema/index.js";
import { Tool } from "../../tools/base.js";
import { Optional } from "../../types/type-utils.js";
import { Agent, AgentArgs, OutputParserArgs } from "../agent.js";
import { AgentActionOutputParser, AgentInput } from "../types.js";
import { ChatConversationalAgentOutputParser } from "./outputParser.js";
import {
  PREFIX_END,
  DEFAULT_PREFIX,
  DEFAULT_SUFFIX,
  TEMPLATE_TOOL_RESPONSE,
} from "./prompt.js";

export interface ChatConversationalCreatePromptArgs {
  /** String to put after the list of tools. */
  systemMessage?: string;
  /** String to put before the list of tools. */
  humanMessage?: string;
  /** List of input variables the final prompt will expect. */
  inputVariables?: string[];
  /** Output parser to use for formatting. */
  outputParser?: AgentActionOutputParser;
}

export type ChatConversationalAgentInput = Optional<AgentInput, "outputParser">;

/**
 * Agent for the MRKL chain.
 * @augments Agent
 */
export class ChatConversationalAgent extends Agent {
  constructor(input: ChatConversationalAgentInput) {
    const outputParser =
      input.outputParser ?? ChatConversationalAgent.getDefaultOutputParser();
    super({ ...input, outputParser });
  }

  _agentType() {
    return "chat-conversational-react-description" as const;
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

  async constructScratchPad(steps: AgentStep[]): Promise<BaseChatMessage[]> {
    const thoughts: BaseChatMessage[] = [];
    for (const step of steps) {
      thoughts.push(new AIChatMessage(step.action.log));
      thoughts.push(
        new HumanChatMessage(
          renderTemplate(TEMPLATE_TOOL_RESPONSE, "f-string", {
            observation: step.observation,
          })
        )
      );
    }
    return thoughts;
  }

  static getDefaultOutputParser(
    _fields?: OutputParserArgs
  ): AgentActionOutputParser {
    return new ChatConversationalAgentOutputParser();
  }

  /**
   * Create prompt in the style of the ChatConversationAgent.
   *
   * @param tools - List of tools the agent will have access to, used to format the prompt.
   * @param args - Arguments to create the prompt with.
   * @param args.systemMessage - String to put before the list of tools.
   * @param args.humanMessage - String to put after the list of tools.
   */
  static createPrompt(
    tools: Tool[],
    args?: ChatConversationalCreatePromptArgs
  ) {
    const systemMessage = (args?.systemMessage ?? DEFAULT_PREFIX) + PREFIX_END;
    const humanMessage = args?.humanMessage ?? DEFAULT_SUFFIX;
    const outputParser =
      args?.outputParser ?? new ChatConversationalAgentOutputParser();
    const toolStrings = tools
      .map((tool) => `${tool.name}: ${tool.description}`)
      .join("\n");
    const formatInstructions = renderTemplate(humanMessage, "f-string", {
      format_instructions: outputParser.getFormatInstructions(),
    });
    const toolNames = tools.map((tool) => tool.name).join("\n");
    const finalPrompt = renderTemplate(formatInstructions, "f-string", {
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
    args?: ChatConversationalCreatePromptArgs & AgentArgs
  ) {
    ChatConversationalAgent.validateTools(tools);
    const prompt = ChatConversationalAgent.createPrompt(tools, args);
    const chain = new LLMChain({
      prompt,
      llm,
      callbacks: args?.callbacks ?? args?.callbackManager,
    });
    const outputParser =
      args?.outputParser ?? ChatConversationalAgent.getDefaultOutputParser();

    return new ChatConversationalAgent({
      llmChain: chain,
      outputParser,
      allowedTools: tools.map((t) => t.name),
    });
  }
}
