import { test, expect } from "@jest/globals";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  isAIMessage,
  isAIMessageChunk,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "../chat_models.js";

function assertResponse(message: BaseMessage | BaseMessageChunk | undefined) {
  if (!isAIMessage(message)) throw new Error("Message is not an AIMessage");
  expect(Array.isArray(message.content)).toBe(true);

  for (const block of message.content) {
    if (!(typeof block === "object" && block != null)) {
      throw new Error("Block is not an object");
    }

    if (block.type === "text") {
      expect(typeof block.text).toBe("string");

      for (const annotation of block.annotations ?? []) {
        expect(typeof annotation).toBe("object");
        expect(annotation).not.toBeNull();

        if (annotation.type === "file_citation") {
          expect(annotation).toHaveProperty("file_id");
          expect(annotation).toHaveProperty("filename");
          expect(annotation).toHaveProperty("index");
          expect(annotation).toHaveProperty("type");
        } else if (annotation.type === "web_search") {
          expect(annotation).toHaveProperty("end_index");
          expect(annotation).toHaveProperty("start_index");
          expect(annotation).toHaveProperty("title");
          expect(annotation).toHaveProperty("type");
          expect(annotation).toHaveProperty("url");
        }
      }
    }
  }

  expect(message.usage_metadata).toBeDefined();
  expect(message.usage_metadata.input_tokens).toBeGreaterThan(0);
  expect(message.usage_metadata.output_tokens).toBeGreaterThan(0);
  expect(message.usage_metadata.total_tokens).toBeGreaterThan(0);
  expect(message.response_metadata.model_name).toBeDefined();
  for (const toolOutput of message.additional_kwargs.tool_outputs ?? []) {
    expect(toolOutput.id).toBeDefined();
    expect(toolOutput.status).toBeDefined();
    expect(toolOutput.type).toBeDefined();
  }
}

test("Test ChatOpenAI with built-in web search", async () => {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" });

  // Test invoking with web search
  const firstResponse = await llm.invoke(
    "What was a positive news story from today?",
    { tools: [{ type: "web_search_preview" }] }
  );
  assertResponse(firstResponse);

  // Test streaming
  let full: AIMessageChunk | undefined;
  for await (const chunk of await llm.stream(
    "What was a positive news story from today?",
    { tools: [{ type: "web_search_preview" }] }
  )) {
    expect(isAIMessageChunk(chunk)).toBe(true);
    full = full?.concat(chunk as AIMessageChunk) ?? chunk;
  }
  assertResponse(full);

  // Use OpenAI's stateful API
  const response = await llm.invoke("what about a negative one", {
    tools: [{ type: "web_search_preview" }],
    previous_response_id: firstResponse.response_metadata.id,
  });
  assertResponse(response);

  // Manually pass in chat history
  const historyResponse = await llm.invoke(
    [
      firstResponse,
      {
        role: "user",
        content: [{ type: "text", text: "what about a negative one" }],
      },
    ],
    { tools: [{ type: "web_search_preview" }] }
  );
  assertResponse(historyResponse);

  // Bind tool
  const boundResponse = await llm
    .bindTools([{ type: "web_search_preview" }])
    .invoke("What was a positive news story from today?");

  assertResponse(boundResponse);
});

test("Test ChatOpenAI with built-in web search", async () => {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" });

  const firstResponse = await llm.invoke(
    "What was a positive news story from today?",
    { tools: [{ type: "web_search_preview" }] }
  );
  assertResponse(firstResponse);

  // Test streaming
  let full: AIMessageChunk | undefined;
  for await (const chunk of await llm.stream(
    "What was a positive news story from today?",
    { tools: [{ type: "web_search_preview" }] }
  )) {
    expect(isAIMessageChunk(chunk)).toBe(true);
    full = full?.concat(chunk as AIMessageChunk) ?? chunk;
  }
  assertResponse(full);

  // Use OpenAI's stateful API
  const response = await llm.invoke("what about a negative one", {
    tools: [{ type: "web_search_preview" }],
    previous_response_id: firstResponse.response_metadata.id,
  });
  assertResponse(response);

  // Manually pass in chat history
  const historyResponse = await llm.invoke(
    [
      firstResponse,
      {
        role: "user",
        content: [{ type: "text", text: "what about a negative one" }],
      },
    ],
    { tools: [{ type: "web_search_preview" }] }
  );
  assertResponse(historyResponse);

  // Bind tool
  const boundResponse = await llm
    .bindTools([{ type: "web_search_preview" }])
    .invoke("What was a positive news story from today?");

  assertResponse(boundResponse);
});

test("Test function calling", async () => {
  const multiply = tool((args) => args.x * args.y, {
    name: "multiply",
    description: "Multiply two numbers",
    schema: z.object({ x: z.number(), y: z.number() }),
  });

  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" }).bindTools([
    multiply,
    { type: "web_search_preview" },
  ]);

  const msg = (await llm.invoke("whats 5 * 4")) as AIMessage;
  expect(msg.tool_calls).toMatchObject([
    { name: "multiply", args: { x: 5, y: 4 } },
  ]);

  let full: AIMessageChunk | undefined;
  for await (const chunk of await llm.stream("whats 5 * 4")) {
    expect(isAIMessageChunk(chunk)).toBe(true);
    full = full?.concat(chunk as AIMessageChunk) ?? chunk;
  }
  expect(full.tool_calls).toMatchObject([
    { name: "multiply", args: { x: 5, y: 4 } },
  ]);

  const response = await llm.invoke("whats some good news from today");
  assertResponse(response);
});

test("Test stateful API", async () => {
  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    useResponsesApi: true,
  });
  const response = await llm.invoke("how are you, my name is Bobo");
  expect(response.response_metadata).toHaveProperty("id");

  const secondResponse = await llm.invoke("what's my name", {
    previous_response_id: response.response_metadata.id,
  });
  expect(Array.isArray(secondResponse.content)).toBe(true);
  expect(secondResponse.content[0].text.toLowerCase()).toContain("bobo");
});

test.skip("Test file search", async () => {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" });
  const tool = {
    type: "file_search",
    vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID],
  };
  const response = await llm.invoke("What is deep research by OpenAI?", {
    tools: [tool],
  });
  assertResponse(response);

  let full: AIMessageChunk | undefined;
  for await (const chunk of await llm.stream(
    "What is deep research by OpenAI?",
    { tools: [tool] }
  )) {
    expect(isAIMessageChunk(chunk)).toBe(true);
    full = full?.concat(chunk as AIMessageChunk) ?? chunk;
  }
  expect(isAIMessageChunk(full)).toBe(true);
  assertResponse(full);
});
