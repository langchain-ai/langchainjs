import type { Ai } from "@cloudflare/workers-types";
import { afterEach, expect, test, vi } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
import { ChatCloudflareWorkersAI } from "../chat_models.js";

function fixture(body: unknown) {
  const run = vi.fn(async () => Response.json(body));
  const model = new ChatCloudflareWorkersAI({
    binding: { run } as unknown as Ai,
    maxRetries: 0,
  });
  return { model, run };
}
const search = tool(async ({ query }) => query, {
  name: "search",
  description: "Search video evidence",
  schema: z.object({ query: z.string() }),
});
const rawCall = {
  id: "call-1",
  type: "function",
  function: { name: "search", arguments: '{"query":"diagram"}' },
};
const reply = {
  choices: [
    {
      message: { content: null, tool_calls: [rawCall] },
      finish_reason: "tool_calls",
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
};
afterEach(() => vi.unstubAllGlobals());

test("binds LangChain tools and preserves tool calls and usage", async () => {
  const { model, run } = fixture(reply);
  const result = await model
    .bindTools([search], { tool_choice: "search" })
    .invoke("Find the diagram");
  expect(result.tool_calls).toEqual([
    {
      id: "call-1",
      name: "search",
      args: { query: "diagram" },
      type: "tool_call",
    },
  ]);
  expect(result.usage_metadata).toEqual({
    input_tokens: 10,
    output_tokens: 3,
    total_tokens: 13,
  });
  expect(run).toHaveBeenCalledWith(
    model.model,
    expect.objectContaining({
      tools: [
        expect.objectContaining({
          type: "function",
          function: expect.objectContaining({ name: "search" }),
        }),
      ],
      tool_choice: { type: "function", function: { name: "search" } },
    }),
    expect.any(Object)
  );
});

test("replays assistant calls, reasoning, and tool results", async () => {
  const { model, run } = fixture({ response: "Found it" });
  await model.invoke([
    new HumanMessage("Find it"),
    new AIMessage({
      content: "",
      tool_calls: [
        { id: "call-1", name: "search", args: { query: "diagram" } },
      ],
      additional_kwargs: { reasoning_content: "Inspect the evidence" },
    }),
    new ToolMessage({ content: "Diagram at 10s", tool_call_id: "call-1" }),
  ]);
  expect(run).toHaveBeenCalledWith(
    model.model,
    expect.objectContaining({
      messages: [
        { role: "user", content: "Find it" },
        {
          role: "assistant",
          content: "",
          tool_calls: [rawCall],
          reasoning_content: "Inspect the evidence",
        },
        { role: "tool", content: "Diagram at 10s", tool_call_id: "call-1" },
      ],
    }),
    expect.any(Object)
  );
});

test("supports native tool calls without IDs", async () => {
  const { model } = fixture({
    response: "",
    tool_calls: [{ name: "search", arguments: { query: "diagram" } }],
  });
  const result = await model.invoke("Find it");
  expect(result.tool_calls?.[0]).toMatchObject({
    name: "search",
    args: { query: "diagram" },
    id: expect.any(String),
  });
});

test("reports invalid tool arguments", async () => {
  const { model } = fixture({
    choices: [
      {
        message: {
          tool_calls: [
            { ...rawCall, function: { name: "search", arguments: "{" } },
          ],
        },
      },
    ],
  });
  const result = await model.invoke("Find it");
  expect(result.tool_calls).toEqual([]);
  expect(result.invalid_tool_calls).toHaveLength(1);
});

test("forwards image content blocks", async () => {
  const { model, run } = fixture({ response: "A red circle" });
  const content = [
    { type: "text", text: "What shape?" },
    { type: "image_url", image_url: { url: "data:image/png;base64,fixture" } },
  ];
  await model.invoke([new HumanMessage({ content })]);
  expect(run).toHaveBeenCalledWith(
    model.model,
    expect.objectContaining({ messages: [{ role: "user", content }] }),
    expect.any(Object)
  );
});

test.each(["any", "required", "auto", "none"])(
  "normalizes tool choice %s",
  async (choice) => {
    const { model, run } = fixture({ response: "ok" });
    await model.bindTools([search], { tool_choice: choice }).invoke("Hi");
    expect(run).toHaveBeenCalledWith(
      model.model,
      expect.objectContaining({
        tool_choice: choice === "any" ? "required" : choice,
      }),
      expect.any(Object)
    );
  }
);

test.each([
  z.object({ answer: z.string() }),
  z4.object({ answer: z4.string() }),
])("validates structured tool output", async (schema) => {
  const { model } = fixture({
    choices: [
      {
        message: {
          tool_calls: [
            {
              id: "structured",
              function: { name: "extract", arguments: '{"answer":"yes"}' },
            },
          ],
        },
      },
    ],
  });
  expect(await model.withStructuredOutput(schema).invoke("Answer")).toEqual({
    answer: "yes",
  });
});

test("rejects structured output that fails Zod validation", async () => {
  const { model } = fixture({
    choices: [
      {
        message: {
          tool_calls: [
            {
              id: "structured",
              function: { name: "extract", arguments: '{"answer":123}' },
            },
          ],
        },
      },
    ],
  });
  await expect(
    model
      .withStructuredOutput(z.object({ answer: z.string() }))
      .invoke("Answer")
  ).rejects.toThrow();
});

test("includeRaw keeps raw output on a parse failure", async () => {
  const { model } = fixture({ response: "invalid json" });
  const result = await model
    .withStructuredOutput(z.object({ answer: z.string() }), {
      method: "jsonMode",
      includeRaw: true,
    })
    .invoke("Answer");
  expect(result.parsed).toBeNull();
  expect(result.raw.content).toBe("invalid json");
});

test("requests native JSON Schema output", async () => {
  const { model, run } = fixture({
    choices: [{ message: { content: '{"answer":"yes"}' } }],
  });
  const schema = z.object({ answer: z.string() });
  expect(
    await model
      .withStructuredOutput(schema, {
        method: "jsonSchema",
        name: "answer",
        strict: true,
      })
      .invoke("Answer")
  ).toEqual({ answer: "yes" });
  expect(run).toHaveBeenCalledWith(
    model.model,
    expect.objectContaining({
      response_format: {
        type: "json_schema",
        json_schema: expect.objectContaining({
          name: "answer",
          strict: true,
          schema: expect.objectContaining({ type: "object" }),
        }),
      },
    }),
    expect.any(Object)
  );
});

test("accepts object-valued native JSON responses", async () => {
  const { model } = fixture({ response: { answer: "yes" } });
  expect(
    await model
      .withStructuredOutput(z.object({ answer: z.string() }), {
        method: "jsonMode",
      })
      .invoke("Answer")
  ).toEqual({ answer: "yes" });
});

test("rejects malformed responses", async () => {
  const { model } = fixture({});
  await expect(model.invoke("Hi")).rejects.toThrow("no message");
});

function streamFixture(chunks: unknown[]) {
  const run = vi.fn(
    async () =>
      new Response(
        `${chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("")}data: [DONE]\n\n`
      )
  );
  return new ChatCloudflareWorkersAI({
    binding: { run } as unknown as Ai,
    maxRetries: 0,
  });
}

test("assembles split tool arguments and emits cumulative usage only once", async () => {
  const model = streamFixture([
    {
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call-1",
                function: { name: "search", arguments: '{"query":' },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
    },
    {
      choices: [
        {
          delta: {
            tool_calls: [{ index: 0, function: { arguments: '"diagram"}' } }],
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    },
    { usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 } },
  ]);
  let result: AIMessageChunk | undefined;
  for await (const chunk of await model.stream("Search"))
    result = result ? result.concat(chunk) : chunk;
  expect(result?.tool_calls).toEqual([
    {
      id: "call-1",
      name: "search",
      args: { query: "diagram" },
      type: "tool_call",
    },
  ]);
  expect(result?.usage_metadata).toMatchObject({
    input_tokens: 10,
    output_tokens: 3,
    total_tokens: 13,
  });
});

test("stream events preserve text and usage", async () => {
  const model = streamFixture([
    { choices: [{ delta: { content: "Hello" } }] },
    { choices: [{ delta: { content: " world" }, finish_reason: "stop" }] },
    { usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 } },
  ]);
  await expect(model.streamEvents("Hi")).toHaveStreamText("Hello world");
});

test("propagates stream error frames", async () => {
  const model = streamFixture([{ error: { message: "Inference failed" } }]);
  await expect(async () => {
    for await (const chunk of await model.stream("Hi"))
      expect(chunk).toBeDefined();
  }).rejects.toThrow("Inference failed");
});

test("preserves OpenAI-shaped responses inside REST envelopes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ result: reply }))
  );
  const model = new ChatCloudflareWorkersAI({
    cloudflareAccountId: "account",
    cloudflareApiToken: "token",
  });
  expect(
    (await model.bindTools([search]).invoke("Find it")).tool_calls?.[0]?.name
  ).toBe("search");
});

test("keeps parallel tool call indexes and generated IDs distinct", async () => {
  const model = streamFixture([
    {
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                function: { name: "search", arguments: '{"query":' },
              },
              {
                index: 1,
                function: { name: "search", arguments: '{"query":' },
              },
            ],
          },
        },
      ],
    },
    {
      choices: [
        {
          delta: {
            tool_calls: [
              { index: 1, function: { arguments: '"blue"}' } },
              { index: 0, function: { arguments: '"red"}' } },
            ],
          },
        },
      ],
    },
  ]);
  let result: AIMessageChunk | undefined;
  for await (const chunk of await model.stream("Search"))
    result = result ? result.concat(chunk) : chunk;
  expect(result?.tool_calls).toHaveLength(2);
  expect(result?.tool_calls?.map((call) => call.args.query)).toEqual([
    "red",
    "blue",
  ]);
  expect(new Set(result?.tool_calls?.map((call) => call.id)).size).toBe(2);
});

test("stream events preserve tool arguments", async () => {
  const model = streamFixture([
    { choices: [{ delta: { tool_calls: [{ index: 0, ...rawCall }] } }] },
  ]);
  const result = await model.streamEvents("Search");
  expect(result.tool_calls).toMatchObject([
    { id: "call-1", name: "search", args: { query: "diagram" } },
  ]);
});

test("forwards inference settings and model-specific parameters", async () => {
  const { model, run } = fixture({ response: "ok" });
  model.temperature = 0.6;
  model.maxTokens = 512;
  model.modelKwargs = { chat_template_kwargs: { enable_thinking: false } };
  await model.invoke("Hi", { temperature: 0, max_tokens: 64, stop: ["END"] });
  expect(run).toHaveBeenCalledWith(
    model.model,
    expect.objectContaining({
      temperature: 0,
      max_tokens: 64,
      stop: ["END"],
      chat_template_kwargs: { enable_thinking: false },
    }),
    expect.any(Object)
  );
});

test("rejects strict JSON mode instead of silently ignoring strictness", () => {
  const { model } = fixture({ response: "ok" });
  expect(() =>
    model.withStructuredOutput(z.object({ answer: z.string() }), {
      method: "jsonMode",
      strict: true,
    })
  ).toThrow("strict");
});

test("bound runnable events preserve the final tool call", async () => {
  const model = streamFixture([
    { choices: [{ delta: { tool_calls: [{ index: 0, ...rawCall }] } }] },
  ]);
  const bound = model.bindTools([search]);
  let output;
  for await (const event of bound.streamEvents("Search", { version: "v2" })) {
    if (event.event === "on_chat_model_end") output = event.data.output;
  }
  expect(output.tool_calls).toMatchObject([
    { name: "search", args: { query: "diagram" } },
  ]);
});

const nullableSearch = tool(async (args) => JSON.stringify(args), {
  name: "search_scenes",
  description: "Search scenes with optional IDs",
  schema: z4.object({
    query: z4.string(),
    video_ids: z4.array(z4.number()).nullable(),
    label: z4.string().nullable(),
  }),
});
const nullableArgs = { query: "null", video_ids: "null", label: "null" };

test("repairs string null before normal LangChain tool validation", async () => {
  const { model } = fixture({
    choices: [
      {
        message: {
          tool_calls: [
            {
              id: "nullable",
              function: {
                name: "search_scenes",
                arguments: JSON.stringify(nullableArgs),
              },
            },
          ],
        },
      },
    ],
  });
  const result = await model.bindTools([nullableSearch]).invoke("Search");
  expect(result.tool_calls?.[0]?.args).toEqual({
    ...nullableArgs,
    video_ids: null,
  });
  expect(
    JSON.parse(result.additional_kwargs.tool_calls![0].function.arguments)
  ).toEqual({ ...nullableArgs, video_ids: null });
  expect(await nullableSearch.invoke(result.tool_calls![0])).toMatchObject({
    content: JSON.stringify({ ...nullableArgs, video_ids: null }),
  });
});

test("repairs fragmented streamed arguments before exposing the completed call", async () => {
  const model = streamFixture([
    {
      choices: [
        {
          delta: {
            content: "Checking",
            tool_calls: [
              {
                index: 0,
                id: "nullable",
                function: {
                  name: "search_",
                  arguments: '{"query":"null","video_ids":"nu',
                },
              },
            ],
          },
        },
      ],
    },
    {
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                function: { name: "scenes", arguments: 'll","label":"null"}' },
              },
            ],
          },
        },
      ],
    },
  ]);
  let result: AIMessageChunk | undefined;
  const chunks: AIMessageChunk[] = [];
  for await (const chunk of await model
    .bindTools([nullableSearch])
    .stream("Search")) {
    chunks.push(chunk);
    result = result ? result.concat(chunk) : chunk;
  }
  expect(chunks[0].content).toBe("Checking");
  expect(chunks[0].tool_call_chunks).toHaveLength(0);
  expect(result?.tool_calls?.[0]?.args).toEqual({
    ...nullableArgs,
    video_ids: null,
  });
  expect(await nullableSearch.invoke(result!.tool_calls![0])).toMatchObject({
    content: JSON.stringify({ ...nullableArgs, video_ids: null }),
  });
});

test("repair does not bypass validation of other incorrect arguments", async () => {
  const { model } = fixture({
    response: "",
    tool_calls: [
      { name: "search_scenes", arguments: { ...nullableArgs, query: 42 } },
    ],
  });
  const result = await model.bindTools([nullableSearch]).invoke("Search");
  expect(result.tool_calls?.[0]?.args.video_ids).toBeNull();
  await expect(nullableSearch.invoke(result.tool_calls![0])).rejects.toThrow();
});

test("runnable stream events expose repaired arguments to the agent", async () => {
  const model = streamFixture([
    { tool_calls: [{ name: "search_scenes", arguments: nullableArgs }] },
  ]);
  let result;
  for await (const event of model
    .bindTools([nullableSearch])
    .streamEvents("Search", { version: "v2" })) {
    if (event.event === "on_chat_model_end") result = event.data.output;
  }
  expect(result.tool_calls[0].args).toEqual({
    ...nullableArgs,
    video_ids: null,
  });
  expect(await nullableSearch.invoke(result.tool_calls[0])).toMatchObject({
    status: "success",
  });
});
