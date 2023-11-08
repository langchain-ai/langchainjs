import { z } from "zod";
import { ThreadMessage } from "openai/resources/beta/threads/index.mjs";
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
    const { location, unit } = input;
    const result = getCurrentWeather(location, unit);
    return result;
  }
}

test("OpenAIAssistantRunnable can be passed as an agent", async () => {
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
      output: 'The current weather in San Francisco is 72°F, and in Tokyo, it is 10°C.'
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
  /**
    [
      {
        id: 'msg_egqSo3AZTWJ0DAelzR6DdKbs',
        object: 'thread.message',
        created_at: 1699409656,
        thread_id: 'thread_lAktOZkUetJ7Gl3hzMFdi42E',
        role: 'assistant',
        content: [ [Object] ],
        file_ids: [],
        assistant_id: 'asst_fPjLqVmN21EFGLNQb8iZckEy',
        run_id: 'run_orPmWI9ri1HnqBXmX7LCWWax',
        metadata: {}
      }
    ]
   */
  const content = (assistantResponse as ThreadMessage[]).flatMap(
    (res) => res.content
  );
  console.log(content);
  /**
    [
      {
        type: 'text',
        text: {
          value: '10 - 4 raised to the 2.7 is approximately -32.22.',
          annotations: []
        }
      }
    ]
   */
});
