import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { Calculator } from "@langchain/community/tools/calculator";
import { AgentExecutor } from "langchain/agents";
import { formatToOpenAIToolMessages } from "langchain/agents/format_scratchpad/openai_tools";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import {
  OpenAIToolsAgentOutputParser,
  type ToolsAgentStep,
} from "langchain/agents/openai/output_parser";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { DynamicStructuredTool } from "@langchain/core/tools";

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
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
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
    unit: z.enum(["celsius", "fahrenheit"]),
  }),
});

const tools = [new Calculator(), weatherTool];

// Convert to OpenAI tool format
const modelWithTools = model.bind({ tools: tools.map(convertToOpenAITool) });

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
});

const res = await executor.invoke({
  input:
    "What is the sum of the current temperature in San Francisco, New York, and Tokyo?",
});

console.log(res);
