import { DynamicTool } from "../../tools/dynamic.js";
import { Tool } from "../../tools/base.js";
import { LLMChain } from "../../chains/index.js";
import { Agent, OutputParserArgs } from "../agent.js";
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "../../prompts/index.js";
import { renderTemplate } from "../../prompts/template.js";
import {
  FORMAT_TEMPLATE,
  DEFAULT_PREFIX,
  DEFAULT_SUFFIX,
  TEMPLATE_TOOL_RESPONSE,
} from "./prompt.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import {
  AgentStep,
  BaseChatMessage,
  AIChatMessage,
  HumanChatMessage,
  BaseOutputParser,
} from "../../schema/index.js";
import { AgentActionOutputParser, AgentInput } from "../types.js";
import { ChatConversationalAgentOutputParser } from "./outputParser.js";
import { Optional } from "../../types/type-utils.js";

export type CreatePromptArgs = {
  /** String to put after the list of tools. */
  systemMessage?: string;
  /** String to put before the list of tools. */
  humanMessage?: string;
  /** List of input variables the final prompt will expect. */
  inputVariables?: string[];
  /** Output parser to use for formatting. */
  outputParser?: BaseOutputParser;
  /** The name of the tool used to return response. */
  finishToolName?: string;
};

export type ChatConversationalAgentInput = Optional<
  AgentInput,
  "outputParser"
> & {
  finishToolName?: string;
  tools: Tool[];
};

/**
 * Agent for the MRKL chain.
 * @augments Agent
 */
export class ChatConversationalAgent2 extends Agent {
  finished: string;

  tools: Tool[];

  constructor(input: ChatConversationalAgentInput) {
    const finishToolName = input.finishToolName ?? "finished";

    // should i just alter it?
    const t = (input.tools || []).slice();
    // throw away tool to trigger finishing, cant any any other ones because executor doesnt know about them
    t.push(
      new DynamicTool({
        name: finishToolName,
        description:
          "The final tool to use when you have a response to my request. The input MUST be your final response to my request, as I forget all other text.",
        func: () => {
          throw new Error("not implemented");
        },
      })
    );

    const outputParser =
      input?.outputParser ??
      ChatConversationalAgent2.getDefaultOutputParser({
        finishToolName,
        toolStrings: t.map((t: Tool) => t.name).join(),
        llm: input.llmChain.llm,
      });
    super({
      ...input,
      outputParser,
      allowedTools: input.tools.map((t) => t.name),
    });
    this.tools = t;
  }

  _agentType(): string {
    /** Not turning on serialization until more sure of abstractions. */
    throw new Error("Method not implemented.");
  }

  observationPrefix() {
    return "";
  }

  llmPrefix() {
    return "";
  }

  finishToolName(): string {
    return this.finished;
  }

  _stop(): string[] {
    return [];
  }

  static getDefaultOutputParser(
    fields?: OutputParserArgs
  ): AgentActionOutputParser {
    return new ChatConversationalAgentOutputParser(fields);
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
        new AIChatMessage(
          renderTemplate(TEMPLATE_TOOL_RESPONSE, "f-string", {
            observation: step.observation,
            toolName: step.action.tool,
          })
        )
      );
    }

    thoughts.push(
      new HumanChatMessage(
        renderTemplate(FORMAT_TEMPLATE, "f-string", {
          tools: this.tools
            .map((tool) => `${tool.name}: ${tool.description}`)
            .join("\n"),
          format_instructions: this.outputParser.getFormatInstructions(),
        })
      )
    );

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
  static createPrompt(_tools: Tool[], args?: CreatePromptArgs) {
    const { systemMessage = DEFAULT_PREFIX, humanMessage = DEFAULT_SUFFIX } =
      args ?? {};
    const messages = [
      SystemMessagePromptTemplate.fromTemplate(systemMessage),
      new MessagesPlaceholder("chat_history"),
      HumanMessagePromptTemplate.fromTemplate(humanMessage),
      new MessagesPlaceholder("agent_scratchpad"),
    ];
    return ChatPromptTemplate.fromPromptMessages(messages);
  }

  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: Tool[],
    args: CreatePromptArgs = {
      finishToolName: "finished",
    }
  ) {
    ChatConversationalAgent2.validateTools(tools);

    const prompt = ChatConversationalAgent2.createPrompt(tools, args);
    const chain = new LLMChain({ prompt, llm });

    return new ChatConversationalAgent2({
      llmChain: chain,
      tools,
      finishToolName: args.finishToolName,
    });
  }
}
