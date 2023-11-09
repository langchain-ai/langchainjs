import { z } from "zod";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { DynamicStructuredTool, formatToOpenAITool } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { ChatPromptTemplate, MessagesPlaceholder } from "langchain/prompts";
import { RunnableSequence } from "langchain/schema/runnable";
import { AgentExecutor } from "langchain/agents";
import { formatToOpenAIToolMessages } from "langchain/agents/format_scratchpad/openai_tools";
import {
  OpenAIToolsAgentOutputParser,
  type ToolsAgentStep,
} from "langchain/agents/openai/output_parser";

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
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
    unit: z.enum(["celsius", "fahrenheit"]),
  }),
});

const tools = [new Calculator(), weatherTool];

// Convert to OpenAI tool format
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
});

const res = await executor.invoke({
  input:
    "What is the sum of the current temperature in San Francisco, New York, and Tokyo?",
});

console.log(res);
