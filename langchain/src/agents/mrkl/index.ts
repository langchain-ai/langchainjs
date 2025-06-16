import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import { ToolInterface } from "@langchain/core/tools";
import { PromptTemplate, renderTemplate } from "@langchain/core/prompts";
import { LLMChain } from "../../chains/llm_chain.js";
import { Optional } from "../../types/type-utils.js";
import { Agent, AgentArgs, OutputParserArgs } from "../agent.js";
import { deserializeHelper } from "../helpers.js";
import {
  AgentInput,
  SerializedFromLLMAndTools,
  SerializedZeroShotAgent,
} from "../types.js";
import { ZeroShotAgentOutputParser } from "./outputParser.js";
import { FORMAT_INSTRUCTIONS, PREFIX, SUFFIX } from "./prompt.js";

/**
 * Interface for creating a prompt for the ZeroShotAgent.
 */
export interface ZeroShotCreatePromptArgs {
  /** String to put after the list of tools. */
  suffix?: string;
  /** String to put before the list of tools. */
  prefix?: string;
  /** List of input variables the final prompt will expect. */
  inputVariables?: string[];
}

/**
 * Type for the input to the ZeroShotAgent, with the 'outputParser'
 * property made optional.
 */
export type ZeroShotAgentInput = Optional<AgentInput, "outputParser">;

/**
 * Agent for the MRKL chain.
 * @augments Agent
 * @example
 * ```typescript
 *
 * const agent = new ZeroShotAgent({
 *   llmChain: new LLMChain({
 *     llm: new ChatOpenAI({ temperature: 0 }),
 *     prompt: ZeroShotAgent.createPrompt([new SerpAPI(), new Calculator()], {
 *       prefix: `Answer the following questions as best you can, but speaking as a pirate might speak. You have access to the following tools:`,
 *       suffix: `Begin! Remember to speak as a pirate when giving your final answer. Use lots of "Args"
 * Question: {input}
 * {agent_scratchpad}`,
 *       inputVariables: ["input", "agent_scratchpad"],
 *     }),
 *   }),
 *   allowedTools: ["search", "calculator"],
 * });
 *
 * const result = await agent.invoke({
 *   input: `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`,
 * });
 * ```
 *
 * @deprecated Use the {@link https://api.js.langchain.com/functions/langchain.agents.createReactAgent.html | createReactAgent method instead}.
 */
export class ZeroShotAgent extends Agent {
  static lc_name() {
    return "ZeroShotAgent";
  }

  lc_namespace = ["langchain", "agents", "mrkl"];

  declare ToolType: ToolInterface;

  constructor(input: ZeroShotAgentInput) {
    const outputParser =
      input?.outputParser ?? ZeroShotAgent.getDefaultOutputParser();
    super({ ...input, outputParser });
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

  /**
   * Returns the default output parser for the ZeroShotAgent.
   * @param fields Optional arguments for the output parser.
   * @returns An instance of ZeroShotAgentOutputParser.
   */
  static getDefaultOutputParser(fields?: OutputParserArgs) {
    return new ZeroShotAgentOutputParser(fields);
  }

  /**
   * Validates the tools for the ZeroShotAgent. Throws an error if any tool
   * does not have a description.
   * @param tools List of tools to validate.
   */
  static validateTools(tools: ToolInterface[]) {
    const descriptionlessTool = tools.find((tool) => !tool.description);
    if (descriptionlessTool) {
      const msg =
        `Got a tool ${descriptionlessTool.name} without a description.` +
        ` This agent requires descriptions for all tools.`;
      throw new Error(msg);
    }
  }

  /**
   * Create prompt in the style of the zero shot agent.
   *
   * @param tools - List of tools the agent will have access to, used to format the prompt.
   * @param args - Arguments to create the prompt with.
   * @param args.suffix - String to put after the list of tools.
   * @param args.prefix - String to put before the list of tools.
   * @param args.inputVariables - List of input variables the final prompt will expect.
   */
  static createPrompt(tools: ToolInterface[], args?: ZeroShotCreatePromptArgs) {
    const {
      prefix = PREFIX,
      suffix = SUFFIX,
      inputVariables = ["input", "agent_scratchpad"],
    } = args ?? {};
    const toolStrings = tools
      .map((tool) => `${tool.name}: ${tool.description}`)
      .join("\n");

    const toolNames = tools.map((tool) => `"${tool.name}"`).join(", ");

    const formatInstructions = renderTemplate(FORMAT_INSTRUCTIONS, "f-string", {
      tool_names: toolNames,
    });

    const template = [prefix, toolStrings, formatInstructions, suffix].join(
      "\n\n"
    );

    return new PromptTemplate({
      template,
      inputVariables,
    });
  }

  /**
   * Creates a ZeroShotAgent from a Large Language Model and a set of tools.
   * @param llm The Large Language Model to use.
   * @param tools The tools for the agent to use.
   * @param args Optional arguments for creating the agent.
   * @returns A new instance of ZeroShotAgent.
   */
  static fromLLMAndTools(
    llm: BaseLanguageModelInterface,
    tools: ToolInterface[],
    args?: ZeroShotCreatePromptArgs & AgentArgs
  ) {
    ZeroShotAgent.validateTools(tools);
    const prompt = ZeroShotAgent.createPrompt(tools, args);
    const outputParser =
      args?.outputParser ?? ZeroShotAgent.getDefaultOutputParser();
    const chain = new LLMChain({
      prompt,
      llm,
      callbacks: args?.callbacks ?? args?.callbackManager,
    });

    return new ZeroShotAgent({
      llmChain: chain,
      allowedTools: tools.map((t) => t.name),
      outputParser,
    });
  }

  static async deserialize(
    data: SerializedZeroShotAgent & {
      llm?: BaseLanguageModelInterface;
      tools?: ToolInterface[];
    }
  ): Promise<ZeroShotAgent> {
    const { llm, tools, ...rest } = data;
    return deserializeHelper(
      llm,
      tools,
      rest,
      (
        llm: BaseLanguageModelInterface,
        tools: ToolInterface[],
        args: SerializedFromLLMAndTools
      ) =>
        ZeroShotAgent.fromLLMAndTools(llm, tools, {
          prefix: args.prefix,
          suffix: args.suffix,
          inputVariables: args.input_variables,
        }),
      (args) => new ZeroShotAgent(args)
    );
  }
}
