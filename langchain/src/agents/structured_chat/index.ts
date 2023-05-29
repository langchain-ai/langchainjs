import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";

import { BaseLanguageModel } from "../../base_language/index.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import {
  BaseMessagePromptTemplate,
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

export interface StructuredChatCreatePromptArgs {
  /** String to put after the list of tools. */
  suffix?: string;
  /** String to put before the list of tools. */
  prefix?: string;
  /** List of input variables the final prompt will expect. */
  inputVariables?: string[];
  /** List of historical prompts from memory.  */
  memoryPrompts?: BaseMessagePromptTemplate[];
}

export type StructuredChatAgentInput = Optional<AgentInput, "outputParser">;

/**
 * Agent that interoperates with Structured Tools using React logic.
 * @augments Agent
 */
export class StructuredChatAgent extends Agent {
  constructor(input: StructuredChatAgentInput) {
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

  static getDefaultOutputParser(
    fields?: OutputParserArgs & {
      toolNames: string[];
    }
  ) {
    if (fields?.llm) {
      return StructuredChatOutputParserWithRetries.fromLLM(fields.llm, {
        toolNames: fields.toolNames,
      });
    }
    return new StructuredChatOutputParserWithRetries({
      toolNames: fields?.toolNames,
    });
  }

  async constructScratchPad(steps: AgentStep[]): Promise<string> {
    const agentScratchpad = await super.constructScratchPad(steps);
    if (agentScratchpad) {
      return `This was your previous work (but I haven't seen any of it! I only see what you return as final answer):\n${agentScratchpad}`;
    }
    return agentScratchpad;
  }

  static createToolSchemasString(tools: StructuredTool[]) {
    return tools
      .map(
        (tool) =>
          `${tool.name}: ${tool.description}, args: ${JSON.stringify(
            (zodToJsonSchema(tool.schema) as JsonSchema7ObjectType).properties
          )}`
      )
      .join("\n");
  }

  /**
   * Create prompt in the style of the agent.
   *
   * @param tools - List of tools the agent will have access to, used to format the prompt.
   * @param args - Arguments to create the prompt with.
   * @param args.suffix - String to put after the list of tools.
   * @param args.prefix - String to put before the list of tools.
   * @param args.inputVariables List of input variables the final prompt will expect.
   * @param args.memoryPrompts List of historical prompts from memory.
   */
  static createPrompt(
    tools: StructuredTool[],
    args?: StructuredChatCreatePromptArgs
  ) {
    const {
      prefix = PREFIX,
      suffix = SUFFIX,
      inputVariables = ["input", "agent_scratchpad"],
      memoryPrompts = [],
    } = args ?? {};
    const template = [prefix, FORMAT_INSTRUCTIONS, suffix].join("\n\n");
    const humanMessageTemplate = "{input}\n\n{agent_scratchpad}";
    const messages = [
      new SystemMessagePromptTemplate(
        new PromptTemplate({
          template,
          inputVariables,
          partialVariables: {
            tool_schemas: StructuredChatAgent.createToolSchemasString(tools),
            tool_names: tools.map((tool) => tool.name).join(", "),
          },
        })
      ),
      ...memoryPrompts,
      new HumanMessagePromptTemplate(
        new PromptTemplate({
          template: humanMessageTemplate,
          inputVariables,
        })
      ),
    ];
    return ChatPromptTemplate.fromPromptMessages(messages);
  }

  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: StructuredTool[],
    args?: StructuredChatCreatePromptArgs & AgentArgs
  ) {
    StructuredChatAgent.validateTools(tools);
    const prompt = StructuredChatAgent.createPrompt(tools, args);
    const outputParser =
      args?.outputParser ??
      StructuredChatAgent.getDefaultOutputParser({
        llm,
        toolNames: tools.map((tool) => tool.name),
      });
    const chain = new LLMChain({
      prompt,
      llm,
      callbacks: args?.callbacks,
    });

    return new StructuredChatAgent({
      llmChain: chain,
      outputParser,
      allowedTools: tools.map((t) => t.name),
    });
  }
}
