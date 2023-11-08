import { z } from "zod";
import { AgentExecutor } from "../../../agents/executor.js";
import { StructuredTool } from "../../../tools/base.js";
import { OpenAIAssistantRunnable } from "../openai_assistant.js";

function getCurrentWeather(location: string, _unit = "fahrenheit") {
  if (location.toLowerCase().includes("tokyo")) {
    return JSON.stringify({ location, temperature: "10", unit: "celsius" });
  } else if (location.toLowerCase().includes("san francisco")) {
    return JSON.stringify({ location, temperature: "72", unit: "fahrenheit" });
  } else {
    return JSON.stringify({ location, temperature: "22", unit: "celsius" });
  }
}

class WeatherTool extends StructuredTool {
  schema = z.object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
    unit: z.enum(["celsius", "fahrenheit"]).optional(),
  });

  name = "get_current_weather";

  description = "Get the current weather in a given location";

  constructor() {
    super(...arguments);
  }

  async _call(input: { location: string; unit: string }) {
    console.log("calling tool", input);
    const { location, unit } = input;
    const result = getCurrentWeather(location, unit);
    return result;
  }
}

test.only("OpenAIAssistantRunnable can be passed as an agent", async () => {
  const tools = [new WeatherTool()];
  const agent = await OpenAIAssistantRunnable.create({
    model: "gpt-3.5-turbo-1106",
    instructions:
      "You are a weather bot. Use the provided functions to answer questions.",
    name: "Weather Assistant",
    tools,
    asAgent: true,
  });

  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent,
    tools,
  });

  const assistantResponse = await agentExecutor.invoke({
    content: "What's the weather in San Francisco and Tokyo?",
  });
  console.log(assistantResponse);
  /**
    {
      output: '10 - 4 is 6, and 6 raised to the power of 2.7 is calculated as follows:\n' +
        '\n' +
        '\\( 6^{2.7} \\approx 246.418 \\)'
    }
   */
});

test("OpenAIAssistantRunnable is invokeable", async () => {
  const assistant = await OpenAIAssistantRunnable.create({
    model: "gpt-4",
    instructions:
      "You are a helpful assistant that provides answers to math problems.",
    name: "Math Assistant",
    tools: [{ type: "code_interpreter" }],
  });

  const assistantResponse = await assistant.invoke({
    content: "What's 10 - 4 raised to the 2.7",
  });
  console.log(assistantResponse);
  if (Array.isArray(assistantResponse) && "content" in assistantResponse[0]) {
    console.log(assistantResponse[0].content);
  }
  /**
    [
      {
        id: 'msg_OBH60nkVI40V9zY2PlxMzbEI',
        thread_id: 'thread_wKpj4cu1XaYEVeJlx4yFbWx5',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: {
              value: 'The result of 10 - 4 raised to the 2.7 is approximately -32.22.',
              annotations: []
            }
          }
        ],
        assistant_id: 'asst_RtW03Vs6laTwqSSMCQpVND7i',
        run_id: 'run_4Ve5Y9fyKMcSxHbaNHOFvdC6',
      }
    ]
   */
});
