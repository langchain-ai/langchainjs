import { AgentExecutor } from "../../../agents/executor.js";
import { Tool } from "../../../tools/base.js";
import { OpenAIAssistantRunnable } from "../assistant.js";
import { OpenAIToolType } from "../schema.js";

// Example dummy function hard coded to return the same weather
// In production, this could be your backend API or an external API
function getCurrentWeather(location: string, unit = "fahrenheit") {
  console.log("getCurrentWeather", location, unit);
  if (location.toLowerCase().includes("tokyo")) {
    return JSON.stringify({ location, temperature: "10", unit: "celsius" });
  } else if (location.toLowerCase().includes("san francisco")) {
    return JSON.stringify({ location, temperature: "72", unit: "fahrenheit" });
  } else {
    return JSON.stringify({ location, temperature: "22", unit: "celsius" });
  }
}

class WeatherTool extends Tool {
  name = "get_current_weather";

  description = "Get the current weather in a given location";

  constructor() {
    super();
  }

  async _call(input: { location: string; unit: string }) {
    console.log("calling", input);
    const { location, unit } = input;
    const result = getCurrentWeather(location, unit);
    return result;
  }
}

const tools: OpenAIToolType = [
  {
    type: "function",
    function: {
      name: "get_current_weather",
      description: "Get the current weather in a given location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state, e.g. San Francisco, CA",
          },
          unit: { type: "string", enum: ["celsius", "fahrenheit"] },
        },
        required: ["location"],
      },
    },
  },
];

test("works", async () => {
  const agent = await OpenAIAssistantRunnable.create({
    model: "gpt-4-1106-preview",
    instructions:
      "You are a helpful assistant that provides weather information.",
    name: "Weather Assistant",
    tools,
    asAgent: true,
  });

  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent,
    tools: [new WeatherTool()],
  });

  const assistantResponse = await agentExecutor.invoke({
    content: "What's 10 - 4 raised to the 2.7",
  });

  console.log(assistantResponse);
});
