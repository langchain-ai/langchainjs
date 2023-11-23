/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { z } from "zod";
import { OpenAIClient } from "@langchain/openai";
import { AgentExecutor } from "../../../agents/executor.js";
import { StructuredTool } from "../../../tools/base.js";
import { OpenAIAssistantRunnable } from "../index.js";

function getCurrentWeather(location: string, _unit = "fahrenheit") {
  if (location.toLowerCase().includes("tokyo")) {
    return JSON.stringify({ location, temperature: "10", unit: "celsius" });
  } else if (location.toLowerCase().includes("san francisco")) {
    return JSON.stringify({ location, temperature: "72", unit: "fahrenheit" });
  } else {
    return JSON.stringify({ location, temperature: "22", unit: "celsius" });
  }
}

function convertWeatherToHumanReadable(location: string, temperature: string) {
  if (temperature.length > 1) {
    return JSON.stringify({ location, temperature, readable: "warm" });
  }
  return JSON.stringify({ location, temperature, readable: "cold" });
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

class HumanReadableChecker extends StructuredTool {
  schema = z.object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
    temperature: z.string().describe("The temperature in degrees"),
  });

  name = "get_human_readable_weather";

  description =
    "Check whether or not the weather in a given location is warm or cold";

  constructor() {
    super(...arguments);
  }

  async _call(input: { location: string; temperature: string }) {
    const { location, temperature } = input;
    const result = convertWeatherToHumanReadable(location, temperature);
    return result;
  }
}

test.skip("New OpenAIAssistantRunnable can be passed as an agent", async () => {
  const tools = [new WeatherTool(), new HumanReadableChecker()];
  const agent = await OpenAIAssistantRunnable.createAssistant({
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
    content:
      "What's the weather in San Francisco and Tokyo? And will it be warm or cold in those places?",
  });
  console.log(assistantResponse);
  /**
    {
      output: "The weather in San Francisco, CA is currently 72°F and it's warm. In Tokyo, Japan, the temperature is 10°C and it's also warm."
    }
   */
});

test("OpenAIAssistantRunnable create and delete assistant", async () => {
  const assistant = await OpenAIAssistantRunnable.createAssistant({
    name: "Personal Assistant",
    model: "gpt-4-1106-preview",
  });
  const deleteStatus = await assistant.deleteAssistant();
  expect(deleteStatus).toEqual({
    id: assistant.assistantId,
    object: "assistant.deleted",
    deleted: true,
  });
  console.log(deleteStatus);
  /**
    {
      id: 'asst_jwkJPzFkIL2ei9Kn1SZzmR6Y',
      object: 'assistant.deleted',
      deleted: true
    }
   */
});

test("OpenAIAssistantRunnable create and modify assistant", async () => {
  const assistant = await OpenAIAssistantRunnable.createAssistant({
    name: "Personal Assistant",
    model: "gpt-4-1106-preview",
  });
  const assistantResponse = await assistant.getAssistant();
  expect(assistantResponse.name).toEqual("Personal Assistant");
  const assistantResponseModified = await assistant.modifyAssistant({
    name: "Personal Assistant 2",
  });
  expect(assistantResponseModified.name).toEqual("Personal Assistant 2");
  expect(assistantResponseModified.model).toEqual("gpt-4-1106-preview");
});

test("OpenAIAssistantRunnable can be passed as an agent", async () => {
  const tools = [new WeatherTool(), new HumanReadableChecker()];
  const agent = new OpenAIAssistantRunnable({
    assistantId: process.env.TEST_OPENAI_ASSISTANT_ID!,
    asAgent: true,
  });
  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent,
    tools,
  });
  const assistantResponse = await agentExecutor.invoke({
    content:
      "What's the weather in San Francisco and Tokyo? And will it be warm or cold in those places?",
  });
  console.log(assistantResponse);
  /**
    {
      output: "The weather in San Francisco, CA is currently 72°F and it's warm. In Tokyo, Japan, the temperature is 10°C and it's also warm."
    }
   */
});

test.skip("Created OpenAIAssistantRunnable is invokeable", async () => {
  const assistant = await OpenAIAssistantRunnable.createAssistant({
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
  const content = (
    assistantResponse as OpenAIClient.Beta.Threads.ThreadMessage[]
  ).flatMap((res) => res.content);
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
