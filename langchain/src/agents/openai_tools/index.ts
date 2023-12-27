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

export type CreateOpenAIToolsAgentParams = {
  llm: BaseChatModel<
    BaseChatModelCallOptions & {
      tools?: OpenAIClient.ChatCompletionTool[];
      tool_choice?: OpenAIClient.ChatCompletionToolChoiceOption;
    }
  >;
  tools: StructuredToolInterface[];
  prompt: ChatPromptTemplate;
};

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
