import type { StructuredToolInterface } from "@langchain/core/tools";
import type {
  BaseChatModel,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { OpenAIClient } from "@langchain/openai";
import { formatToOpenAIToolMessages } from "../format_scratchpad/openai_tools.js";
import { formatToOpenAITool } from "../../tools/convert_to_openai.js";
import {
  OpenAIToolsAgentOutputParser,
  type ToolsAgentStep,
} from "../openai/output_parser.js";

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
      tools?: StructuredToolInterface[] | OpenAIClient.ChatCompletionTool[];
      tool_choice?: OpenAIClient.ChatCompletionToolChoiceOption;
    }
  >;
  /** Tools this agent has access to. */
  tools: StructuredToolInterface[];
  /** The prompt to use, must have an input key of `agent_scratchpad`. */
  prompt: ChatPromptTemplate;
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
 *   modelName: "gpt-3.5-turbo-1106",
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
}: CreateOpenAIToolsAgentParams) {
  if (!prompt.inputVariables.includes("agent_scratchpad")) {
    throw new Error(
      [
        `Prompt must have an input variable named "agent_scratchpad".`,
        `Found ${JSON.stringify(prompt.inputVariables)} instead.`,
      ].join("\n")
    );
  }
  const modelWithTools = llm.bind({ tools: tools.map(formatToOpenAITool) });
  const agent = RunnableSequence.from([
    RunnablePassthrough.assign({
      agent_scratchpad: (input: { steps: ToolsAgentStep[] }) =>
        formatToOpenAIToolMessages(input.steps),
    }),
    prompt,
    modelWithTools,
    new OpenAIToolsAgentOutputParser(),
  ]);
  return agent;
}
