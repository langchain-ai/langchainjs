/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  HumanMessage,
  ToolMessage,
  isAIMessage,
  isAIMessageChunk,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { randomUUID } from "node:crypto";
import { ChatOpenAI } from "../chat_models.js";
import { REASONING_OUTPUT_MESSAGES } from "./data/computer-use-inputs.js";
import { ChatOpenAIReasoningSummary } from "../types.js";

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
  expect(message.response_metadata.service_tier).toBeDefined();
  for (const toolOutput of (message.additional_kwargs.tool_outputs ??
    []) as Record<string, unknown>[]) {
    expect(toolOutput.id).toBeDefined();
    expect(toolOutput.type).toBeDefined();
  }
}

test("Test with built-in web search", async () => {
  const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

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

test.each(["stream", "invoke"])(
  "Test function calling, %s",
  async (invocationType: string) => {
    const multiply = tool((args) => args.x * args.y, {
      name: "multiply",
      description: "Multiply two numbers",
      schema: z.object({ x: z.number(), y: z.number() }),
    });

    const llm = new ChatOpenAI({ model: "gpt-4o-mini" }).bindTools([
      multiply,
      { type: "web_search_preview" },
    ]);

    function invoke(
      invocationType: string,
      prompt: BaseLanguageModelInput
    ): Promise<AIMessage | AIMessageChunk> {
      if (invocationType === "invoke") {
        return llm.invoke(prompt);
      }

      return concatStream(llm.stream(prompt));
    }

    const messages = [new HumanMessage("whats 5 * 4")];

    const aiMessage = (await invoke(invocationType, messages)) as AIMessage;

    messages.push(aiMessage);

    expect(aiMessage.tool_calls).toMatchObject([
      { name: "multiply", args: { x: 5, y: 4 } },
    ]);

    const toolMessage: ToolMessage = await multiply.invoke(
      aiMessage.tool_calls![0]
    );
    messages.push(toolMessage);

    expect(toolMessage.tool_call_id).toMatch(/^call_[a-zA-Z0-9]+$/);
    expect(toolMessage.tool_call_id).toEqual(aiMessage.tool_calls![0].id);

    const finalAiMessage = await invoke(invocationType, messages);

    assertResponse(finalAiMessage);

    const noToolCallResponse = await invoke(
      invocationType,
      "whats some good news from today"
    );
    assertResponse(noToolCallResponse);
  }
);

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
    model: "gpt-4o-mini",
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
    model: "gpt-4o-mini",
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

test("Test tool binding with optional zod fields", async () => {
  const llm = new ChatOpenAI({ model: "gpt-4o-mini" });
  const multiply = tool((args) => args.x * args.y, {
    name: "multiply",
    description: "Multiply two numbers",
    schema: z.object({
      x: z.number(),
      y: z.number(),
      foo: z.number().optional(),
    }),
  });
  const response = await llm
    .bindTools([multiply], { strict: true })
    .invoke("whats 5 * 4");
  expect(response.tool_calls?.[0].args).toHaveProperty("foo");
  expect(response.tool_calls?.[0].args.foo).toBe(null);
});

test("Test reasoning", async () => {
  const llm = new ChatOpenAI({ model: "o3-mini", useResponsesApi: true });
  const response = await llm.invoke("Hello", { reasoning: { effort: "low" } });
  expect(response).toBeInstanceOf(AIMessage);
  expect(response.additional_kwargs.reasoning).toBeDefined();

  const llmWithEffort = new ChatOpenAI({
    model: "o3-mini",
    reasoning: { effort: "low" },
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
    model: "gpt-4o-mini",
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
  const llm = new ChatOpenAI({ model: "gpt-4o-mini" });
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

test("Test Code Interpreter", async () => {
  const model = new ChatOpenAI({
    model: "o4-mini",
    useResponsesApi: true,
  });

  const modelWithAutoInterpreter = model.bindTools([
    { type: "code_interpreter", container: { type: "auto" } },
  ]);

  const response = await modelWithAutoInterpreter.invoke(
    "Write and run code to answer the question: what is 3^3?"
  );
  assertResponse(response);
  expect(response.additional_kwargs.tool_outputs).toBeDefined();

  const toolOutputs = response.additional_kwargs.tool_outputs as Record<
    string,
    unknown
  >[];
  expect(toolOutputs).toBeTruthy();
  expect(Array.isArray(toolOutputs)).toBe(true);
  expect(
    toolOutputs.some((output) => output.type === "code_interpreter_call")
  ).toBe(true);

  // Test streaming using the same container
  expect(toolOutputs.length).toBe(1);
  const containerId = toolOutputs[0].container_id as string;
  const modelWithToolsReuse = model.bindTools([
    { type: "code_interpreter", container: containerId },
  ]);

  const full = await concatStream(
    modelWithToolsReuse.stream(
      "Write and run code to answer the question: what is 3^3?"
    )
  );

  expect(isAIMessageChunk(full)).toBe(true);
  const streamToolOutputs = full.additional_kwargs.tool_outputs as Record<
    string,
    unknown
  >[];
  expect(streamToolOutputs).toBeTruthy();
  expect(Array.isArray(streamToolOutputs)).toBe(true);
  expect(
    streamToolOutputs.some(
      (output: Record<string, unknown>) =>
        output.type === "code_interpreter_call"
    )
  ).toBe(true);
});

test("Test Remote MCP", async () => {
  const model = new ChatOpenAI({
    model: "o4-mini",
    useResponsesApi: true,
  }).bindTools([
    {
      type: "mcp",
      server_label: "deepwiki",
      server_url: "https://mcp.deepwiki.com/mcp",
      require_approval: {
        always: {
          tool_names: ["read_wiki_structure"],
        },
      },
    },
  ]);

  const response = await model.invoke(
    "What transport protocols does the 2025-03-26 version of the MCP spec (modelcontextprotocol/modelcontextprotocol) support?"
  );
  assertResponse(response);
  expect(response.additional_kwargs.tool_outputs).toBeDefined();

  const approvals = [];
  if (Array.isArray(response.additional_kwargs.tool_outputs)) {
    for (const content of response.additional_kwargs.tool_outputs) {
      if (content.type === "mcp_approval_request") {
        approvals.push({
          type: "mcp_approval_response",
          approval_request_id: content.id,
          approve: true,
        });
      }
    }
  }

  const response2 = await model.invoke(
    [new HumanMessage({ content: approvals })],
    {
      previous_response_id: response.response_metadata.id,
    }
  );
  assertResponse(response2);
});

describe("Test image generation", () => {
  const expectedOutputKeys = [
    "id",
    "background",
    "output_format",
    "quality",
    "result",
    "revised_prompt",
    "size",
    "status",
    "type",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function assertImageGenerationToolOutput(tool_outputs: any) {
    expect(tool_outputs).toBeDefined();
    expect(Array.isArray(tool_outputs)).toBe(true);
    expect(tool_outputs.length).toBe(1);
    expect(tool_outputs[0].type).toBe("image_generation_call");
    expectedOutputKeys.forEach((key) => {
      expect(Object.keys(tool_outputs[0])).toContain(key);
    });
  }

  test("with streaming", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4.1",
      useResponsesApi: true,
    }).bindTools([
      {
        type: "image_generation",
        partial_images: 1,
        quality: "low",
        output_format: "jpeg",
        output_compression: 100,
        size: "1024x1024",
      },
    ]);

    let full: AIMessageChunk | undefined;
    for await (const chunk of await model.stream(
      "Draw a random short word in green font."
    )) {
      expect(chunk).toBeInstanceOf(AIMessageChunk);
      full = full?.concat(chunk) ?? chunk;
    }
    assertImageGenerationToolOutput(full?.additional_kwargs.tool_outputs);
  });

  test("multi-turn", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4.1",
      useResponsesApi: true,
    }).bindTools([
      {
        type: "image_generation",
        quality: "low",
        output_format: "jpeg",
        output_compression: 100,
        size: "1024x1024",
      },
    ]);

    const response = await model.invoke(
      "Draw a random short word in green font."
    );
    assertResponse(response);
    assertImageGenerationToolOutput(response.additional_kwargs.tool_outputs);

    const response2 = await model.invoke([
      response,
      new HumanMessage(
        "Now, change the font to blue. Keep the word and everything else the same."
      ),
    ]);
    assertResponse(response2);
    assertImageGenerationToolOutput(response2.additional_kwargs.tool_outputs);
  });
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

test("external message ids", async () => {
  const model = new ChatOpenAI({ model: "gpt-4o-mini", useResponsesApi: true });
  const response = await model.invoke([
    new HumanMessage({
      id: randomUUID(),
      content: "What is 3 to the power of 3?",
    }),
    new AIMessage({ id: randomUUID(), content: "42" }),
    new HumanMessage({
      id: randomUUID(),
      content: "What is 42 to the power of 3?",
    }),
  ]);

  expect(response.id).toBeDefined();
});

describe("reasoning summaries", () => {
  const testReasoningSummaries = async (
    requestType: "stream" | "invoke",
    extraConfig: Record<string, unknown> = {},
    removePreviousOutputMetadata: boolean = false
  ) => {
    const prompt = "What is 3 to the power of 3?";
    const llm = new ChatOpenAI({
      model: "o4-mini",
      reasoning: {
        effort: "low",
        summary: "auto",
      },
      maxRetries: 0, // Ensure faster failure for testing
      ...extraConfig,
    });

    let aiMessage: AIMessage | AIMessageChunk;

    if (requestType === "stream") {
      const stream = await llm.stream(prompt);
      const chunks: AIMessageChunk[] = [];

      for await (const chunk of stream) {
        expect(chunk).toBeInstanceOf(AIMessageChunk);
        chunks.push(chunk);
      }
      const firstChunk = chunks[0];

      aiMessage =
        chunks.length > 1
          ? chunks
              .slice(1)
              .reduce((acc, chunk) => acc.concat(chunk), firstChunk)
          : firstChunk;
    } else {
      aiMessage = await llm.invoke(prompt);
    }

    expect(aiMessage.id).toMatch(/^msg_[a-f0-9]+$/);

    // Check the final aggregated message
    const reasoning = aiMessage?.additional_kwargs
      .reasoning as ChatOpenAIReasoningSummary;
    expect(reasoning).toBeDefined();
    expect(reasoning.id).toBeDefined();
    expect(typeof reasoning.id).toBe("string");
    expect(reasoning.id).toMatch(/^rs_[a-f0-9]+$/);
    expect(reasoning.type).toBe("reasoning");
    expect(reasoning.summary).toBeDefined();
    expect(Array.isArray(reasoning.summary)).toBe(true);
    expect(reasoning.summary.length).toBeGreaterThan(0);

    for (const summaryItem of reasoning.summary) {
      expect(summaryItem.type).toBe("summary_text");
      expect(typeof summaryItem.text).toBe("string");
      expect(summaryItem.text.length).toBeGreaterThan(0);
    }

    if (removePreviousOutputMetadata) {
      delete aiMessage.response_metadata.output;
    }

    // Test passing reasoning back (might be tricky in isolated test)
    const secondPrompt = "Thanks!";
    const messages: BaseMessage[] = [
      new HumanMessage(prompt),
      aiMessage, // Pass the AI message with reasoning
      new HumanMessage(secondPrompt),
    ];
    const secondResult = await llm.invoke(messages);
    expect(secondResult).toBeInstanceOf(AIMessage);
    expect(secondResult.content).toBeTruthy();
  };

  test.each(["stream", "invoke"])(
    "normal responses API usage (Zero Data Retention disabled), %s",
    async (requestType) => {
      await testReasoningSummaries(requestType as "stream" | "invoke");
    }
  );

  test.each(["stream", "invoke"])(
    "Zero Data Retention disabled, previous output metadata missing, %s",
    async (requestType) => {
      await testReasoningSummaries(
        requestType as "stream" | "invoke",
        {},
        true
      );
    }
  );

  test.each(["stream", "invoke"])(
    "Zero Data Retention enabled, %s",
    async (requestType) => {
      await testReasoningSummaries(requestType as "stream" | "invoke", {
        zdrEnabled: true,
      });
    }
  );

  test.each(["stream", "invoke"])(
    "Zero Data Retention enabled, and previous output metadata missing, %s",
    async (requestType) => {
      await testReasoningSummaries(
        requestType as "stream" | "invoke",
        { zdrEnabled: true },
        true
      );
    }
  );

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
      .withConfig({
        truncation: "auto",
      });

    // The REASONING_OUTPUT_MESSAGES array contains a series of messages, which include
    // one AI message that has both a reasoning output and a computer call.
    // This test ensures we pass the reasoning output back to the model, as the OpenAI API
    // requires it's passed back if managing the messages history manually.
    const response = await model.invoke(REASONING_OUTPUT_MESSAGES);

    expect(response).toBeDefined();
  });
});
