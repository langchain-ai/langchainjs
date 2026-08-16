import {
  ChatAnthropic,
  tools,
  type Memory20250818Command,
} from "@langchain/anthropic";

import { createAgent } from "langchain";

const memoryFiles = new Map<string, string>([
  [
    "/memories/weather_in_tokyo.txt",
    JSON.stringify(
      {
        weather: "sunny",
        temperature: 20,
        humidity: 50,
        wind_speed: 10,
        wind_direction: "N",
        wind_gust: 15,
        wind_gust_direction: "N",
        wind_gust_speed: 20,
        time: new Date().toISOString(),
      },
      null,
      2
    ),
  ],
]);

const memoryTool = tools.memory_20250818({
  execute: async (action: Memory20250818Command) => {
    switch (action.command) {
      case "view":
        return memoryFiles.get(action.path) ?? "File not found.";
      case "create":
        memoryFiles.set(action.path, action.file_text);
        return `Created ${action.path}`;
      case "str_replace": {
        const current = memoryFiles.get(action.path);
        if (current === undefined) {
          return "File not found.";
        }
        memoryFiles.set(
          action.path,
          current.replace(action.old_str, action.new_str)
        );
        return `Updated ${action.path}`;
      }
      case "insert": {
        const current = memoryFiles.get(action.path);
        if (current === undefined) {
          return "File not found.";
        }
        const lines = current.split("\n");
        lines.splice(action.insert_line, 0, action.insert_text);
        memoryFiles.set(action.path, lines.join("\n"));
        return `Inserted text into ${action.path}`;
      }
      case "delete":
        memoryFiles.delete(action.path);
        return `Deleted ${action.path}`;
      case "rename": {
        const current = memoryFiles.get(action.old_path);
        if (current === undefined) {
          return "File not found.";
        }
        memoryFiles.set(action.new_path, current);
        memoryFiles.delete(action.old_path);
        return `Renamed ${action.old_path} to ${action.new_path}`;
      }
      default:
        return "Unsupported command.";
    }
  },
});

const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
});

const agent = createAgent({
  model,
  tools: [memoryTool],
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
});

console.log(result.messages[result.messages.length - 1].content);
