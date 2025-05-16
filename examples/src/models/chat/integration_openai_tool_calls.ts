import { ChatOpenAI } from "@langchain/openai";
import { ToolMessage } from "@langchain/core/messages";

// Mocked out function, could be a database/API call in production
function getCurrentWeather(location: string, _unit?: string) {
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
}

// Bind function to the model as a tool
const chat = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
  maxTokens: 128,
})
  .bindTools([
    {
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
  ])
  .withConfig({
    tool_choice: "auto",
  });

// Ask initial question that requires multiple tool calls
const res = await chat.invoke([
  ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
]);
console.log(res.additional_kwargs.tool_calls);
/*
  [
    {
      id: 'call_IiOsjIZLWvnzSh8iI63GieUB',
      type: 'function',
      function: {
        name: 'get_current_weather',
        arguments: '{"location": "San Francisco", "unit": "celsius"}'
      }
    },
    {
      id: 'call_blQ3Oz28zSfvS6Bj6FPEUGA1',
      type: 'function',
      function: {
        name: 'get_current_weather',
        arguments: '{"location": "Tokyo", "unit": "celsius"}'
      }
    },
    {
      id: 'call_Kpa7FaGr3F1xziG8C6cDffsg',
      type: 'function',
      function: {
        name: 'get_current_weather',
        arguments: '{"location": "Paris", "unit": "celsius"}'
      }
    }
  ]
*/

// Format the results from calling the tool calls back to OpenAI as ToolMessages
const toolMessages = res.additional_kwargs.tool_calls?.map((toolCall) => {
  const toolCallResult = getCurrentWeather(
    JSON.parse(toolCall.function.arguments).location
  );
  return new ToolMessage({
    tool_call_id: toolCall.id,
    name: toolCall.function.name,
    content: toolCallResult,
  });
});

// Send the results back as the next step in the conversation
const finalResponse = await chat.invoke([
  ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
  res,
  ...(toolMessages ?? []),
]);

console.log(finalResponse);
/*
  AIMessage {
    content: 'The current weather in:\n' +
      '- San Francisco is 72°F\n' +
      '- Tokyo is 10°C\n' +
      '- Paris is 22°C',
    additional_kwargs: { function_call: undefined, tool_calls: undefined }
  }
*/
