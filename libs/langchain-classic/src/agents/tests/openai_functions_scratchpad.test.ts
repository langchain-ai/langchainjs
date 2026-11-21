import { test, expect } from "vitest";
import type { AgentStep } from "@langchain/core/agents";
import { AIMessage, FunctionMessage } from "@langchain/core/messages";
import { formatToOpenAIFunctionMessages } from "../format_scratchpad/openai_functions.js";
import { _formatIntermediateSteps } from "../openai_functions/index.js";
import type { FunctionsAgentAction } from "../openai_functions/output_parser.js";

const action: FunctionsAgentAction = {
  tool: "search",
  toolInput: { query: "weather in SF" },
  log: "",
  messageLog: [
    new AIMessage({
      content: "",
      additional_kwargs: {
        function_call: {
          name: "search",
          arguments: '{"query":"weather in SF"}',
        },
      },
    }),
  ],
};
const steps: AgentStep[] = [{ action, observation: "Sunny, 20C" }];

test.each([
  ["formatToOpenAIFunctionMessages", formatToOpenAIFunctionMessages],
  ["_formatIntermediateSteps", _formatIntermediateSteps],
])("%s names each function message after its tool", (_, format) => {
  const messages = format(steps);

  expect(messages).toHaveLength(2);
  expect(FunctionMessage.isInstance(messages[1])).toBe(true);
  expect(messages[1]).toMatchObject({ content: "Sunny, 20C", name: "search" });
});
