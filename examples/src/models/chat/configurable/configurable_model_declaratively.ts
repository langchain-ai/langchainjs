import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { initChatModel } from "langchain/chat_models/universal";

const GetWeather = z
  .object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  })
  .describe("Get the current weather in a given location");
const weatherTool = tool(
  (_) => {
    // do something
    return "138 degrees";
  },
  {
    name: "GetWeather",
    schema: GetWeather,
  }
);

const GetPopulation = z
  .object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  })
  .describe("Get the current population in a given location");
const populationTool = tool(
  (_) => {
    // do something
    return "one hundred billion";
  },
  {
    name: "GetPopulation",
    schema: GetPopulation,
  }
);

const llm = await initChatModel(undefined, { temperature: 0 });
const llmWithTools = llm.bindTools([weatherTool, populationTool]);

const toolCalls1 = (
  await llmWithTools.invoke("what's bigger in 2024 LA or NYC", {
    configurable: { model: "gpt-4o-mini" },
  })
).tool_calls;
console.log("toolCalls1: ", JSON.stringify(toolCalls1, null, 2));
/*
toolCalls1:  [
  {
    "name": "GetPopulation",
    "args": {
      "location": "Los Angeles, CA"
    },
    "type": "tool_call",
    "id": "call_DXRBVE4xfLYZfhZOsW1qRbr5"
  },
  {
    "name": "GetPopulation",
    "args": {
      "location": "New York, NY"
    },
    "type": "tool_call",
    "id": "call_6ec3m4eWhwGz97sCbNt7kOvC"
  }
]
*/

const toolCalls2 = (
  await llmWithTools.invoke("what's bigger in 2024 LA or NYC", {
    configurable: { model: "claude-3-5-sonnet-20240620" },
  })
).tool_calls;
console.log("toolCalls2: ", JSON.stringify(toolCalls2, null, 2));
/*
toolCalls2:  [
  {
    "name": "GetPopulation",
    "args": {
      "location": "Los Angeles, CA"
    },
    "id": "toolu_01K3jNU8jx18sJ9Y6Q9SooJ7",
    "type": "tool_call"
  },
  {
    "name": "GetPopulation",
    "args": {
      "location": "New York City, NY"
    },
    "id": "toolu_01UiANKaSwYykuF4hi3t5oNB",
    "type": "tool_call"
  }
]
*/
