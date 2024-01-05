import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";

import type { StructuredToolInterface } from "@langchain/core/tools";
import type {
  BaseLanguageModel,
  BaseLanguageModelInterface,
} from "@langchain/core/language_models/base";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import type { BasePromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import {
  BaseMessagePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";
import { AgentStep } from "../../schema/index.js";
import { Optional } from "../../types/type-utils.js";
import { Agent, AgentArgs, OutputParserArgs } from "../agent.js";
import { AgentInput } from "../types.js";
import { StructuredChatOutputParserWithRetries } from "./outputParser.js";
import { FORMAT_INSTRUCTIONS, PREFIX, SUFFIX } from "./prompt.js";
import { renderTextDescriptionAndArgs } from "../../tools/render.js";
import { formatLogToString } from "../format_scratchpad/log.js";

/**
 * Interface for arguments used to create a prompt for a
 * StructuredChatAgent.
 */
export interface StructuredChatCreatePromptArgs {
  /** String to put after the list of tools. */
  suffix?: string;
  /** String to put before the list of tools. */
  prefix?: string;
  /** String to use directly as the human message template. */
  humanMessageTemplate?: string;
  /** List of input variables the final prompt will expect. */
  inputVariables?: string[];
  /** List of historical prompts from memory.  */
  memoryPrompts?: BaseMessagePromptTemplate[];
}

/**
 * Type for input data for creating a StructuredChatAgent, with the
 * 'outputParser' property made optional.
 */
export type StructuredChatAgentInput = Optional<AgentInput, "outputParser">;

/**
 * Agent that interoperates with Structured Tools using React logic.
 * @augments Agent
 */
export class StructuredChatAgent extends Agent {
  static lc_name() {
    return "StructuredChatAgent";
  }

  lc_namespace = ["langchain", "agents", "structured_chat"];

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

  /**
   * Validates that all provided tools have a description. Throws an error
   * if any tool lacks a description.
   * @param tools Array of StructuredTool instances to validate.
   */
  static validateTools(tools: StructuredToolInterface[]) {
    const descriptionlessTool = tools.find((tool) => !tool.description);
    if (descriptionlessTool) {
      const msg =
        `Got a tool ${descriptionlessTool.name} without a description.` +
        ` This agent requires descriptions for all tools.`;
      throw new Error(msg);
    }
  }

  /**
   * Returns a default output parser for the StructuredChatAgent. If an LLM
   * is provided, it creates an output parser with retry logic from the LLM.
   * @param fields Optional fields to customize the output parser. Can include an LLM and a list of tool names.
   * @returns An instance of StructuredChatOutputParserWithRetries.
   */
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

  /**
   * Constructs the agent's scratchpad from a list of steps. If the agent's
   * scratchpad is not empty, it prepends a message indicating that the
   * agent has not seen any previous work.
   * @param steps Array of AgentStep instances to construct the scratchpad from.
   * @returns A Promise that resolves to a string representing the agent's scratchpad.
   */
  async constructScratchPad(steps: AgentStep[]): Promise<string> {
    const agentScratchpad = await super.constructScratchPad(steps);
    if (agentScratchpad) {
      return `This was your previous work (but I haven't seen any of it! I only see what you return as final answer):\n${agentScratchpad}`;
    }
    return agentScratchpad;
  }

  /**
   * Creates a string representation of the schemas of the provided tools.
   * @param tools Array of StructuredTool instances to create the schemas string from.
   * @returns A string representing the schemas of the provided tools.
   */
  static createToolSchemasString(tools: StructuredToolInterface[]) {
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
    tools: StructuredToolInterface[],
    args?: StructuredChatCreatePromptArgs
  ) {
    const {
      prefix = PREFIX,
      suffix = SUFFIX,
      inputVariables = ["input", "agent_scratchpad"],
      humanMessageTemplate = "{input}\n\n{agent_scratchpad}",
      memoryPrompts = [],
    } = args ?? {};
    const template = [prefix, FORMAT_INSTRUCTIONS, suffix].join("\n\n");
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
    return ChatPromptTemplate.fromMessages(messages);
  }

  /**
   * Creates a StructuredChatAgent from an LLM and a list of tools.
   * Validates the tools, creates a prompt, and sets up an LLM chain for the
   * agent.
   * @param llm BaseLanguageModel instance to create the agent from.
   * @param tools Array of StructuredTool instances to create the agent from.
   * @param args Optional arguments to customize the creation of the agent. Can include arguments for creating the prompt and AgentArgs.
   * @returns A new instance of StructuredChatAgent.
   */
  static fromLLMAndTools(
    llm: BaseLanguageModelInterface,
    tools: StructuredToolInterface[],
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

/**
 * Params used by the createStructuredChatAgent function.
 */
export type CreateStructuredChatAgentParams = {
  /** LLM to use as the agent. */
  llm: BaseLanguageModelInterface;
  /** Tools this agent has access to. */
  tools: StructuredToolInterface[];
  /**
   * The prompt to use. Must have input keys for
   * `tools`, `tool_names`, and `agent_scratchpad`.
   */
  prompt: BasePromptTemplate;
};

/**
 * Create an agent aimed at supporting tools with multiple inputs.
 * @param params Params required to create the agent. Includes an LLM, tools, and prompt.
 * @returns A runnable sequence representing an agent. It takes as input all the same input
 *     variables as the prompt passed in does. It returns as output either an
 *     AgentAction or AgentFinish.
 *
 * @example
 * ```typescript
 * import { AgentExecutor, createStructuredChatAgent } from "langchain/agents";
 * import { pull } from "langchain/hub";
 * import type { ChatPromptTemplate } from "@langchain/core/prompts";
 * import { AIMessage, HumanMessage } from "@langchain/core/messages";
 *
 * import { ChatOpenAI } from "@langchain/openai";
 *
 * // Define the tools the agent will have access to.
 * const tools = [...];
 *
 * // Get the prompt to use - you can modify this!
 * // If you want to see the prompt in full, you can at:
 * // https://smith.langchain.com/hub/hwchase17/structured-chat-agent
 * const prompt = await pull<ChatPromptTemplate>(
 *   "hwchase17/structured-chat-agent"
 * );
 *
 * const llm = new ChatOpenAI({
 *   temperature: 0,
 *   modelName: "gpt-3.5-turbo-1106",
 * });
 *
 * const agent = await createStructuredChatAgent({
 *   llm,
 *   tools,
 *   prompt,
 * });
 *
 * const agentExecutor = new AgentExecutor({
 *   agent,
 *   tools,
 * });
 *
 * const result = await agentExecutor.invoke({
 *   input: "what is LangChain?",
 * });
 *
 * // With chat history
 * const result2 = await agentExecutor.invoke({
 *   input: "what's my name?",
 *   chat_history: [
 *     new HumanMessage("hi! my name is cob"),
 *     new AIMessage("Hello Cob! How can I assist you today?"),
 *   ],
 * });
 * ```
 */
export async function createStructuredChatAgent({
  llm,
  tools,
  prompt,
}: CreateStructuredChatAgentParams) {
  const missingVariables = ["tools", "tool_names", "agent_scratchpad"].filter(
    (v) => !prompt.inputVariables.includes(v)
  );
  if (missingVariables.length > 0) {
    throw new Error(
      `Provided prompt is missing required input variables: ${JSON.stringify(
        missingVariables
      )}`
    );
  }
  const toolNames = tools.map((tool) => tool.name);
  const partialedPrompt = await prompt.partial({
    tools: renderTextDescriptionAndArgs(tools),
    tool_names: toolNames.join(", "),
  });
  // TODO: Add .bind to core runnable interface.
  const llmWithStop = (llm as BaseLanguageModel).bind({
    stop: ["Observation"],
  });
  const agent = RunnableSequence.from([
    RunnablePassthrough.assign({
      agent_scratchpad: (input: { steps: AgentStep[] }) =>
        formatLogToString(input.steps),
    }),
    partialedPrompt,
    llmWithStop,
    StructuredChatOutputParserWithRetries.fromLLM(llm, {
      toolNames,
    }),
  ]);
  return agent;
}
