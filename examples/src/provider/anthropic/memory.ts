import { ChatAnthropic, tools, StateFileSystem } from "@langchain/anthropic";

import { createAgent } from "langchain";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
  clientOptions: {
    defaultHeaders: {
      "anthropic-beta": "context-management-2025-06-27",
    },
  },
});

const files = {
  "/memories/weather_in_tokyo.txt": {
    content: JSON.stringify({
      weather: "sunny",
      temperature: 20,
      humidity: 50,
      wind_speed: 10,
      wind_direction: "N",
      wind_gust: 15,
      wind_gust_direction: "N",
      wind_gust_speed: 20,
      time: new Date().toISOString(),
    }),
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
  },
};
const filesystem = new StateFileSystem(files, [], (files) => {
  Object.assign(files, files);
});

const agent = createAgent({
  model,
  tools: [tools.memory({ filesystem })],
});

const result = await agent.invoke({
  messages: "What is the weather in Tokyo?",
});

console.log(result);
