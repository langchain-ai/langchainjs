import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { concat } from "@langchain/core/utils/stream";
import { ChatOllama } from "../chat_models.js";

const messageHistory = [
  new HumanMessage("What's the weather like today in Paris?"),
  new AIMessage({
    content: "",
    tool_calls: [
      {
        id: "89a1e453-0bce-4de3-a456-c54bed09c520",
        name: "get_current_weather",
        args: {
          location: "Paris, France",
        },
      },
    ],
  }),
  new ToolMessage({
    tool_call_id: "89a1e453-0bce-4de3-a456-c54bed09c520",
    content: "22",
  }),
  new AIMessage("The weather in Paris is 22 degrees."),
  new HumanMessage(
    "What's the weather like today in San Francisco? Ensure you use the 'get_current_weather' tool."
  ),
];

const weatherTool = tool((_) => "Da weather is weatherin", {
  name: "get_current_weather",
  description: "Get the current weather in a given location",
  schema: z.object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  }),
});

test("Ollama can call tools", async () => {
  const model = new ChatOllama({
    model: "llama3-groq-tool-use",
    maxRetries: 1,
  }).bindTools([weatherTool]);

  const result = await model.invoke(messageHistory);
  expect(result).toBeDefined();
  expect(result.tool_calls?.[0]).toBeDefined();
  if (!result.tool_calls?.[0]) return;
  expect(result.tool_calls[0].name).toBe("get_current_weather");
  expect(result.tool_calls[0].id).toBeDefined();
  expect(result.tool_calls[0].id).not.toBe("");
});

test("Ollama can stream tools", async () => {
  const model = new ChatOllama({
    model: "llama3-groq-tool-use",
    maxRetries: 1,
  }).bindTools([weatherTool]);

  let finalChunk: AIMessageChunk | undefined;
  for await (const chunk of await model.stream(messageHistory)) {
    finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
  }
  expect(finalChunk).toBeDefined();
  if (!finalChunk) return;
  expect(finalChunk.tool_calls?.[0]).toBeDefined();
  if (!finalChunk.tool_calls?.[0]) return;
  expect(finalChunk.tool_calls[0].name).toBe("get_current_weather");
  expect(finalChunk.tool_calls[0].id).toBeDefined();
  expect(finalChunk.tool_calls[0].id).not.toBe("");
});

test("Ollama can call withStructuredOutput", async () => {
  const model = new ChatOllama({
    model: "llama3-groq-tool-use",
    maxRetries: 1,
  }).withStructuredOutput(weatherTool.schema, {
    name: weatherTool.name,
  });

  const result = await model.invoke(messageHistory);
  expect(result).toBeDefined();
  expect(result.location).toBeDefined();
  expect(result.location).not.toBe("");
});

test("Ollama can call withStructuredOutput includeRaw JSON Schema", async () => {
  const model = new ChatOllama({
    model: "llama3-groq-tool-use",
    maxRetries: 1,
  }).withStructuredOutput(weatherTool.schema, {
    name: weatherTool.name,
    includeRaw: true,
  });

  const result = await model.invoke(messageHistory);
  expect(result).toBeDefined();
  expect(result.parsed.location).toBeDefined();
  expect(result.parsed.location).not.toBe("");
  expect((result.raw as AIMessage).tool_calls?.length).toBe(0);
});

test("Ollama can call withStructuredOutput includeRaw with tool calling", async () => {
  const model = new ChatOllama({
    model: "llama3-groq-tool-use",
    maxRetries: 1,
  }).withStructuredOutput(weatherTool.schema, {
    name: weatherTool.name,
    includeRaw: true,
    method: "functionCalling",
  });

  const result = await model.invoke(messageHistory);
  expect(result).toBeDefined();
  expect(result.parsed.location).toBeDefined();
  expect(result.parsed.location).not.toBe("");
  expect((result.raw as AIMessage).tool_calls?.[0]).toBeDefined();
  expect((result.raw as AIMessage).tool_calls?.[0].id).toBeDefined();
  expect((result.raw as AIMessage).tool_calls?.[0].id).not.toBe("");
});
