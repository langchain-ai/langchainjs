/* eslint-disable no-process-env */
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
import { REASONING_OUTPUT_MESSAGES } from "./data/computer-use-inputs.js";

async function concatStream(stream: Promise<AsyncIterable<AIMessageChunk>>) {
  let full: AIMessageChunk | undefined;
  for await (const c of await stream) {
    expect(isAIMessageChunk(c)).toBe(true);
    full = full?.concat(c) ?? c;
  }

  if (full == null) throw new Error("`full` is null");
  return full;
}

function assertResponse(message: BaseMessage | BaseMessageChunk | undefined) {
  if (message == null) throw new Error("`message` is null");
  if (!isAIMessage(message)) throw new Error("Message is not an AIMessage");
  expect(Array.isArray(message.content)).toBe(true);

  for (const block of message.content) {
    if (!(typeof block === "object" && block != null)) {
      throw new Error("Block is not an object");
    }

    if (block.type === "text") {
      expect(typeof block.text).toBe("string");

      // TODO: add `annotations` to `MessageContentText`
      // @ts-expect-error `annotations` is not typed
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
  expect(message.usage_metadata?.input_tokens).toBeGreaterThan(0);
  expect(message.usage_metadata?.output_tokens).toBeGreaterThan(0);
  expect(message.usage_metadata?.total_tokens).toBeGreaterThan(0);
  expect(message.response_metadata.model_name).toBeDefined();
  for (const toolOutput of (message.additional_kwargs.tool_outputs ??
    []) as Record<string, unknown>[]) {
    expect(toolOutput.id).toBeDefined();
    expect(toolOutput.status).toBeDefined();
    expect(toolOutput.type).toBeDefined();
  }
}

test("Test with built-in web search", async () => {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" });

  // Test invoking with web search
  const firstResponse = await llm.invoke(
    "What was a positive news story from today?",
    { tools: [{ type: "web_search_preview" }] }
  );
  assertResponse(firstResponse);

  // Test streaming
  const full = await concatStream(
    llm.stream("What was a positive news story from today?", {
      tools: [{ type: "web_search_preview" }],
    })
  );
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

  const full = await concatStream(llm.stream("whats 5 * 4"));
  expect(full?.tool_calls).toMatchObject([
    { name: "multiply", args: { x: 5, y: 4 } },
  ]);

  const response = await llm.invoke("whats some good news from today");
  assertResponse(response);
});

test("Test structured output", async () => {
  const schema = z.object({ response: z.string() });
  const response_format = {
    type: "json_schema" as const,
    json_schema: {
      name: "get_output",
      description: "Get output for user",
      schema,
      strict: true,
    },
  };

  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    useResponsesApi: true,
  });
  const response = await llm.invoke("how are ya", { response_format });

  const parsed = schema.parse(JSON.parse(response.text));
  expect(parsed).toEqual(response.additional_kwargs.parsed);
  expect(parsed.response).toBeDefined();

  // test stream
  const full = await concatStream(
    llm.stream("how are ya", { response_format })
  );
  const parsedFull = schema.parse(JSON.parse(full?.text ?? ""));
  expect(parsedFull).toEqual(full?.additional_kwargs.parsed);
  expect(parsedFull.response).toBeDefined();
});

test("Test function calling and structured output", async () => {
  const multiply = tool((args) => args.x * args.y, {
    name: "multiply",
    description: "Multiply two numbers",
    schema: z.object({ x: z.number(), y: z.number() }),
  });

  const schema = z.object({ response: z.string() });
  const response_format = {
    type: "json_schema" as const,
    json_schema: {
      name: "get_output",
      description: "Get output for user",
      schema,
      strict: true,
    },
  };

  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    useResponsesApi: true,
  });

  // Test structured output
  const response = await llm.invoke("how are ya", { response_format });
  let parsed = schema.parse(JSON.parse(response.text));
  expect(parsed).toEqual(response.additional_kwargs.parsed);
  expect(parsed.response).toBeDefined();

  // Test function calling
  let aiMsg = await llm
    .bindTools([multiply], { response_format, strict: true })
    .invoke("whats 5 * 4");

  expect(aiMsg.tool_calls?.length).toBe(1);
  expect(aiMsg.tool_calls?.[0].name).toBe("multiply");
  expect(new Set(Object.keys(aiMsg.tool_calls?.[0].args ?? {}))).toEqual(
    new Set(["x", "y"])
  );

  aiMsg = await llm
    .bindTools([multiply], { response_format, strict: true })
    .invoke("Tell me a joke");

  parsed = schema.parse(JSON.parse(response.text));
  expect(parsed).toEqual(response.additional_kwargs.parsed);
  expect(parsed.response).toBeDefined();
});

test("Test reasoning", async () => {
  const llm = new ChatOpenAI({ modelName: "o3-mini", useResponsesApi: true });
  const response = await llm.invoke("Hello", { reasoning_effort: "low" });
  expect(response).toBeInstanceOf(AIMessage);
  expect(response.additional_kwargs.reasoning).toBeDefined();

  const llmWithEffort = new ChatOpenAI({
    modelName: "o3-mini",
    reasoningEffort: "low",
    useResponsesApi: true,
  });
  const response2 = await llmWithEffort.invoke("Hello");
  expect(response2).toBeInstanceOf(AIMessage);
  expect(response2.additional_kwargs.reasoning).toBeDefined();

  const response3 = await llmWithEffort.invoke(["Hello", response2]);
  expect(response3).toBeInstanceOf(AIMessage);
  expect(response3.additional_kwargs.reasoning).toBeDefined();
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

  let text: string | undefined;
  if (typeof secondResponse.content === "string") {
    text = secondResponse.content;
  } else if (secondResponse.content[0]?.type === "text") {
    text = secondResponse.content[0].text;
  }

  expect(text?.toLowerCase()).toContain("bobo");
});

test("Test file search", async () => {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" });
  const tool = {
    type: "file_search",
    vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID],
  };
  const response = await llm.invoke("What is deep research by OpenAI?", {
    tools: [tool],
  });
  assertResponse(response);

  const full = await concatStream(
    llm.stream("What is deep research by OpenAI?", { tools: [tool] })
  );

  expect(isAIMessageChunk(full)).toBe(true);
  assertResponse(full);
});

test("Test computer call", async () => {
  const fs = await import("node:fs/promises");
  const url = await import("node:url");

  const screenshot = await fs.readFile(
    url.fileURLToPath(new URL("./data/screenshot.jpg", import.meta.url)),
    { encoding: "base64" }
  );

  const findComputerCall = (
    message: AIMessage | AIMessageChunk | undefined
  ) => {
    if (message == null) return undefined;
    const toolOutputs = message.additional_kwargs.tool_outputs as
      | { type: "computer_call"; call_id: string; action: { type: string } }[]
      | undefined;

    return toolOutputs?.find(
      (toolOutput) => toolOutput.type === "computer_call"
    );
  };

  const llm = new ChatOpenAI({ model: "computer-use-preview" }).bindTools([
    {
      type: "computer-preview",
      display_width: 1024,
      display_height: 768,
      environment: "browser",
    },
  ]);

  const humanMessage = {
    type: "human" as const,
    content: "Check the latest LangChain news on bing.com.",
  };

  // invoke
  let aiMessage = await llm.invoke([humanMessage], { truncation: "auto" });
  let computerCall = findComputerCall(aiMessage);
  expect(computerCall).toBeDefined();

  aiMessage = await llm.invoke(
    [
      humanMessage,
      aiMessage,
      {
        type: "tool" as const,
        additional_kwargs: { type: "computer_call_output" },
        tool_call_id: computerCall!.call_id,
        content: [
          {
            type: "image_url",
            image_url: `data:image/png;base64,${screenshot}`,
          },
        ],
      },
    ],
    { truncation: "auto" }
  );
  expect(computerCall).toBeDefined();

  // streaming
  aiMessage = await concatStream(
    llm.stream([humanMessage], { truncation: "auto" })
  );
  computerCall = findComputerCall(aiMessage);
  expect(computerCall).toBeDefined();

  aiMessage = await concatStream(
    llm.stream(
      [
        humanMessage,
        aiMessage,
        {
          type: "tool",
          tool_call_id: computerCall!.call_id,
          additional_kwargs: { type: "computer_call_output" },
          content: [
            {
              type: "image_url",
              image_url: `data:image/png;base64,${screenshot}`,
            },
          ],
        },
      ],
      { truncation: "auto" }
    )
  );

  computerCall = findComputerCall(aiMessage);
  expect(computerCall).toBeDefined();
});

test("it can handle passing back reasoning outputs alongside computer calls", async () => {
  const model = new ChatOpenAI({
    model: "computer-use-preview",
    useResponsesApi: true,
  })
    .bindTools([
      {
        type: "computer_use_preview",
        display_width: 1024,
        display_height: 768,
        environment: "browser",
      },
    ])
    .bind({
      truncation: "auto",
    });

  // The REASONING_OUTPUT_MESSAGES array contains a series of messages, which include
  // one AI message that has both a reasoning output and a computer call.
  // This test ensures we pass the reasoning output back to the model, as the OpenAI API
  // requires it's passed back if managing the messages history manually.
  const response = await model.invoke(REASONING_OUTPUT_MESSAGES);

  expect(response).toBeDefined();
});
