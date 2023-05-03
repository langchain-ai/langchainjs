import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";

import { BaseLanguageModel } from "../../base_language/index.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";
import { AgentStep } from "../../schema/index.js";
import { StructuredTool } from "../../tools/base.js";
import { Optional } from "../../types/type-utils.js";
import { Agent, AgentArgs, OutputParserArgs } from "../agent.js";
import { AgentInput } from "../types.js";
import { StructuredChatOutputParserWithRetries } from "./outputParser.js";
import { FORMAT_INSTRUCTIONS, PREFIX, SUFFIX } from "./prompt.js";

export interface ChatCreatePromptArgs {
  /** String to put after the list of tools. */
  suffix?: string;
  /** String to put before the list of tools. */
  prefix?: string;
  /** List of input variables the final prompt will expect. */
  inputVariables?: string[];
}

export type ChatAgentInput = Optional<AgentInput, "outputParser">;

/**
 * Agent that interoperates with Structured Tools using React logic.
 * @augments Agent
 */
export class StructuredChatAgent extends Agent {
  constructor(input: ChatAgentInput) {
    const outputParser =
      input?.outputParser ?? StructuredChatAgent.getDefaultOutputParser();
    super({ ...input, outputParser });
  }

  _agentType() {
    return "structured-chat-zero-shot-react-description" as const;
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

  static validateTools(tools: StructuredTool[]) {
    const descriptionlessTool = tools.find((tool) => !tool.description);
    if (descriptionlessTool) {
      const msg =
        `Got a tool ${descriptionlessTool.name} without a description.` +
        ` This agent requires descriptions for all tools.`;
      throw new Error(msg);
    }
  }

  static getDefaultOutputParser(fields?: OutputParserArgs) {
    if (fields?.llm) {
      return StructuredChatOutputParserWithRetries.fromLLM(fields.llm);
    }
    return new StructuredChatOutputParserWithRetries();
  }

  async constructScratchPad(steps: AgentStep[]): Promise<string> {
    const agentScratchpad = await super.constructScratchPad(steps);
    if (agentScratchpad) {
      return `This was your previous work (but I haven't seen any of it! I only see what you return as final answer):\n${agentScratchpad}`;
    }
    return agentScratchpad;
  }

  /**
   * Create prompt in the style of the agent.
   *
   * @param tools - List of tools the agent will have access to, used to format the prompt.
   * @param args - Arguments to create the prompt with.
   * @param args.suffix - String to put after the list of tools.
   * @param args.prefix - String to put before the list of tools.
   */
  static createPrompt(tools: StructuredTool[], args?: ChatCreatePromptArgs) {
    const { prefix = PREFIX, suffix = SUFFIX } = args ?? {};
    const toolStrings = tools
      .map(
        (tool) =>
          `${tool.name}: ${tool.description}, args: ${JSON.stringify(
            (zodToJsonSchema(tool.schema) as JsonSchema7ObjectType).properties
          )}`
      )
      .join("\n");
    const template = [
      prefix,
      FORMAT_INSTRUCTIONS,
      suffix,
    ].join("\n\n");
    const messages = [
      new SystemMessagePromptTemplate(
        new PromptTemplate({
          template,
          inputVariables: [],
          partialVariables: {
            tool_strings: toolStrings,
          },
        })
      ),
      HumanMessagePromptTemplate.fromTemplate("{input}\n\n{agent_scratchpad}"),
    ];
    return ChatPromptTemplate.fromPromptMessages(messages);
  }

  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: StructuredTool[],
    args?: ChatCreatePromptArgs & AgentArgs
  ) {
    StructuredChatAgent.validateTools(tools);
    const prompt = StructuredChatAgent.createPrompt(tools, args);
    const chain = new LLMChain({
      prompt,
      llm,
      callbacks: args?.callbacks,
    });

    return new StructuredChatAgent({
      llmChain: chain,
      outputParser:
        args?.outputParser ??
        StructuredChatAgent.getDefaultOutputParser({ llm }),
      allowedTools: tools.map((t) => t.name),
    });
  }
}
