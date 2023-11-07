import { AssistantCreateParams } from "openai/resources/beta/index";
import { OpenAIAssistant } from "../assistant.js";

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

const tools: Array<AssistantCreateParams.AssistantToolsFunction> = [
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
  const assistant = await OpenAIAssistant.fromAssistant(
    {
      model: "gpt-4-1106-preview",
      description:
        "You are a helpful assistant that provides weather information.",
      name: "Weather Assistant",
      tools,
    },
    {
      functions: {
        get_current_weather: getCurrentWeather,
      },
    }
  );

  await assistant.addMessage({
    content: "What is the weather like in san francisco and tokyo?",
    role: "user",
  });

  const res = await assistant.invoke({
    shouldHandleToolActions: true,
  });

  console.log("res", res);

  const messages = await assistant.listMessages();
  const messageContent = messages.data.map((m) => m.content[0]);

  console.log(
    "messageContent",
    messageContent.map((m) => m.type === "text" && m.text)
  );

  const steps = await assistant.listRunSteps(res.id);
  const stepsContent = steps.data.map((s) => s.step_details);

  const functionOutputs = stepsContent.map((step) => ({
    ...(step.type === "tool_calls" &&
      step.tool_calls.map(
        (toolCall) => toolCall.type === "function" && toolCall.function
      )),
  }));

  console.log(functionOutputs);

  /**
    [
      {
        '0': {
          name: 'get_current_weather',
          arguments: '{"location": "San Francisco, CA", "unit": "fahrenheit"}',
          output: '{"location":"{\\"location\\": \\"San Francisco, CA\\", \\"unit\\": \\"fahrenheit\\"}","temperature":"72","unit":"fahrenheit"}'
        },
        '1': {
          name: 'get_current_weather',
          arguments: '{"location": "Tokyo, Japan", "unit": "celsius"}',
          output: '{"location":"{\\"location\\": \\"Tokyo, Japan\\", \\"unit\\": \\"celsius\\"}","temperature":"10","unit":"celsius"}'
        }
      }
    ]
   */
});
