import type { ToolInterface } from "@langchain/core/tools";
import { BasePromptTemplate } from "@langchain/core/prompts";
import type {
  BaseLanguageModel,
  BaseLanguageModelInterface,
} from "@langchain/core/language_models/base";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { AgentStep } from "@langchain/core/agents";
import { renderTextDescription } from "../../tools/render.js";
import { formatLogToString } from "../format_scratchpad/log.js";
import { ReActSingleInputOutputParser } from "./output_parser.js";

export type CreateReactAgentParams = {
  llm: BaseLanguageModelInterface;
  tools: ToolInterface[];
  prompt: BasePromptTemplate;
};

export async function createReactAgent({
  llm,
  tools,
  prompt,
}: CreateReactAgentParams) {
  const missingVariables = ["tools", "tool_names", "agent_scratchpad"].filter(
    (v) => prompt.inputVariables.includes(v)
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
    tools: renderTextDescription(tools),
    tool_names: toolNames.join(", "),
  });
  // TODO: Add .bind to core runnable interface.
  const llmWithStop = (llm as BaseLanguageModel).bind({
    stop: ["\nObservation:"],
  });
  const agent = RunnableSequence.from([
    RunnablePassthrough.assign({
      agent_scratchpad: (input: { steps: AgentStep[] }) =>
        formatLogToString(input.steps),
    }),
    partialedPrompt,
    llmWithStop,
    new ReActSingleInputOutputParser({
      toolNames,
    }),
  ]);
  return agent;
}
