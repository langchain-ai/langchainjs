/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { z } from "zod";
import { Calculator } from "../../tools/calculator.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { AgentExecutor } from "../executor.js";
import { formatToOpenAIToolMessages } from "../format_scratchpad/openai_tools.js";
import {
  OpenAIToolsAgentOutputParser,
  ToolsAgentStep,
} from "../openai/output_parser.js";
import { ChatPromptTemplate, MessagesPlaceholder } from "../../prompts/chat.js";
import { RunnableSequence } from "../../schema/runnable/base.js";
import { DynamicStructuredTool } from "../../tools/dynamic.js";
import { formatToOpenAITool } from "../../tools/convert_to_openai.js";

test("OpenAIToolsAgent", async () => {
  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 0,
  });

  const weatherTool = new DynamicStructuredTool({
    name: "get_current_weather",
    description: "Get the current weather in a given location",
    func: async ({ location }) => {
      if (location.toLowerCase().includes("tokyo")) {
        return JSON.stringify({ location, temperature: "10", unit: "celsius" });
      } else if (location.toLowerCase().includes("san francisco")) {
        return JSON.stringify({
          location,
          temperature: "72",
          unit: "fahrenheit",
        });
      } else {
        return JSON.stringify({ location, temperature: "22", unit: "celsius" });
      }
    },
    schema: z.object({
      location: z
        .string()
        .describe("The city and state, e.g. San Francisco, CA"),
      unit: z.enum(["celsius", "fahrenheit"]),
    }),
  });

  const tools = [new Calculator(), weatherTool];

  const modelWithTools = model.bind({ tools: tools.map(formatToOpenAITool) });

  const prompt = ChatPromptTemplate.fromMessages([
    ["ai", "You are a helpful assistant"],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const runnableAgent = RunnableSequence.from([
    {
      input: (i: { input: string; steps: ToolsAgentStep[] }) => i.input,
      agent_scratchpad: (i: { input: string; steps: ToolsAgentStep[] }) =>
        formatToOpenAIToolMessages(i.steps),
    },
    prompt,
    modelWithTools,
    new OpenAIToolsAgentOutputParser(),
  ]).withConfig({ runName: "OpenAIToolsAgent" });

  const executor = AgentExecutor.fromAgentAndTools({
    agent: runnableAgent,
    tools,
    verbose: true,
  });

  const res = await executor.invoke({
    input:
      "What is the sum of the current temperature in San Francisco, New York, and Tokyo?",
  });

  console.log(res);
});
