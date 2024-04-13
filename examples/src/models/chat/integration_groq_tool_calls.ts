import { ChatGroq } from "@langchain/groq";

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
const chat = new ChatGroq({
  model: "mixtral-8x7b-32768",
  maxTokens: 128,
}).bind({
  tools: [
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
  ],
  tool_choice: "auto",
});

const res = await chat.invoke([
  ["human", "What's the weather like in San Francisco?"],
]);
console.log(res.additional_kwargs.tool_calls);
/*
  [
    {
      id: 'call_01htk055jpftwbb9tvphyf9bnf',
      type: 'function',
      function: {
        name: 'get_current_weather',
        arguments: '{"location":"San Francisco, CA"}'
      }
    }
  ]
*/
