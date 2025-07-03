import type { StructuredToolInterface } from "@langchain/core/tools";
import type {
  BaseChatModel,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnablePassthrough } from "@langchain/core/runnables";
import { OpenAIClient } from "@langchain/openai";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { ToolDefinition } from "@langchain/core/language_models/base";
import { formatToOpenAIToolMessages } from "../format_scratchpad/openai_tools.js";
import {
  OpenAIToolsAgentOutputParser,
  type ToolsAgentStep,
} from "./output_parser.js";
import { AgentRunnableSequence } from "../agent.js";

export { OpenAIToolsAgentOutputParser, type ToolsAgentStep };

/**
 * Params used by the createOpenAIToolsAgent function.
 */
export type CreateOpenAIToolsAgentParams = {
  /**
   * LLM to use as the agent. Should work with OpenAI tool calling,
   * so must either be an OpenAI model that supports that or a wrapper of
   * a different model that adds in equivalent support.
   */
  llm: BaseChatModel<
    BaseChatModelCallOptions & {
      tools?:
        | StructuredToolInterface[]
        | OpenAIClient.ChatCompletionTool[]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        | any[];
    }
  >;
  /** Tools this agent has access to. */
  tools: StructuredToolInterface[] | ToolDefinition[];
  /** The prompt to use, must have an input key of `agent_scratchpad`. */
  prompt: ChatPromptTemplate;
  /**
   * Whether to invoke the underlying model in streaming mode,
   * allowing streaming of intermediate steps. Defaults to true.
   */
  streamRunnable?: boolean;
};

/**
 * Create an agent that uses OpenAI-style tool calling.
 * @param params Params required to create the agent. Includes an LLM, tools, and prompt.
 * @returns A runnable sequence representing an agent. It takes as input all the same input
 *     variables as the prompt passed in does. It returns as output either an
 *     AgentAction or AgentFinish.
 *
 * @example
 * ```typescript
 * import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
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
 * // https://smith.langchain.com/hub/hwchase17/openai-tools-agent
 * const prompt = await pull<ChatPromptTemplate>(
 *   "hwchase17/openai-tools-agent"
 * );
 *
 * const llm = new ChatOpenAI({
 *   temperature: 0,
 *   model: "gpt-3.5-turbo-1106",
 * });
 *
 * const agent = await createOpenAIToolsAgent({
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
export async function createOpenAIToolsAgent({
  llm,
  tools,
  prompt,
  streamRunnable,
}: CreateOpenAIToolsAgentParams) {
  if (!prompt.inputVariables.includes("agent_scratchpad")) {
    throw new Error(
      [
        `Prompt must have an input variable named "agent_scratchpad".`,
        `Found ${JSON.stringify(prompt.inputVariables)} instead.`,
      ].join("\n")
    );
  }
  const modelWithTools = llm.bindTools
    ? llm.bindTools(tools)
    : llm.withConfig({
        tools: tools.map((tool) => convertToOpenAITool(tool)),
      });
  const agent = AgentRunnableSequence.fromRunnables(
    [
      RunnablePassthrough.assign({
        agent_scratchpad: (input: { steps: ToolsAgentStep[] }) =>
          formatToOpenAIToolMessages(input.steps),
      }),
      prompt,
      modelWithTools,
      new OpenAIToolsAgentOutputParser(),
    ],
    {
      name: "OpenAIToolsAgent",
      streamRunnable,
      singleAction: false,
    }
  );
  return agent;
}
