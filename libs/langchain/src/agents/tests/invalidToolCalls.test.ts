import { describe, it, expect, vi } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  ToolMessage,
  type InvalidToolCall,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v3";
import { createAgent, toolStrategy } from "../index.js";
import { patchInvalidToolCalls } from "../utils.js";
import { FakeToolCallingChatModel, createCheckpointer } from "./utils.js";

const ERROR_TEXT =
  "Tool call search with id call_1 could not be executed - arguments were malformed or truncated.";

function invalidCall(
  overrides: Partial<InvalidToolCall> = {}
): InvalidToolCall {
  return {
    type: "invalid_tool_call",
    id: "call_1",
    name: "search",
    args: '{"q": "pari',
    error: "Unterminated string",
    ...overrides,
  };
}

function aiWithInvalid(calls: InvalidToolCall[]) {
  return new AIMessage({ content: "", invalid_tool_calls: calls });
}

const searchTool = tool(() => "result", {
  name: "search",
  description: "Search for something",
  schema: z.object({ q: z.string() }),
});

function invalidSearchMessage() {
  return new AIMessage({
    content: "",
    invalid_tool_calls: [invalidCall()],
    additional_kwargs: {
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "search", arguments: '{"q": "pari' },
        },
      ],
    },
  });
}

describe("patchInvalidToolCalls", () => {
  it("answers one unanswered invalid call directly after its message", () => {
    const history = [new HumanMessage("hi"), aiWithInvalid([invalidCall()])];
    const patched = patchInvalidToolCalls(history);
    expect(patched).not.toBe(history);
    expect(history).toHaveLength(2);
    expect(patched).toHaveLength(3);
    expect(patched[2]).toBeInstanceOf(ToolMessage);
    expect((patched[2] as ToolMessage).tool_call_id).toBe("call_1");
    expect((patched[2] as ToolMessage).name).toBe("search");
    expect((patched[2] as ToolMessage).status).toBe("error");
    expect(patched[2].content).toBe(ERROR_TEXT);
  });

  it("answers only the invalid call when a valid call is mixed in", () => {
    const ai = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "search",
          args: { q: "paris" },
          id: "call_1",
          type: "tool_call",
        },
      ],
      invalid_tool_calls: [invalidCall({ id: "call_2", name: "search" })],
    });
    const patched = patchInvalidToolCalls([ai]);
    expect(patched).toHaveLength(2);
    expect((patched[1] as ToolMessage).tool_call_id).toBe("call_2");
  });

  it("leaves an already answered invalid call alone", () => {
    const history = [
      aiWithInvalid([invalidCall()]),
      new ToolMessage({ content: "already answered", tool_call_id: "call_1" }),
    ];
    expect(patchInvalidToolCalls(history)).toBe(history);
  });

  it("leaves an invalid call alone when its answer appears later in the history", () => {
    const history = [
      aiWithInvalid([invalidCall()]),
      new HumanMessage("later"),
      new ToolMessage({ content: "late answer", tool_call_id: "call_1" }),
    ];
    expect(patchInvalidToolCalls(history)).toBe(history);
  });

  it("skips invalid calls without an id, and with an empty id", () => {
    const noId = aiWithInvalid([invalidCall({ id: undefined })]);
    expect(patchInvalidToolCalls([noId])).toBeDefined();
    expect(patchInvalidToolCalls([noId])).toHaveLength(1);
    const emptyId = aiWithInvalid([invalidCall({ id: "" })]);
    expect(patchInvalidToolCalls([emptyId])).toHaveLength(1);
  });

  it("uses unknown when the invalid call has no name", () => {
    const patched = patchInvalidToolCalls([
      aiWithInvalid([invalidCall({ name: undefined })]),
    ]);
    expect((patched[1] as ToolMessage).name).toBe("unknown");
    expect(patched[1].content).toBe(
      "Tool call unknown with id call_1 could not be executed - arguments were malformed or truncated."
    );
  });

  it("answers several invalid calls in one message, in order", () => {
    const patched = patchInvalidToolCalls([
      aiWithInvalid([
        invalidCall({ id: "call_1" }),
        invalidCall({ id: "call_2" }),
      ]),
    ]);
    expect(patched).toHaveLength(3);
    expect((patched[1] as ToolMessage).tool_call_id).toBe("call_1");
    expect((patched[2] as ToolMessage).tool_call_id).toBe("call_2");
  });

  it("answers a repeated invalid id only once", () => {
    const patched = patchInvalidToolCalls([
      aiWithInvalid([invalidCall()]),
      aiWithInvalid([invalidCall()]),
    ]);
    expect(patched).toHaveLength(3);
    expect(patched.filter((m) => ToolMessage.isInstance(m))).toHaveLength(1);
  });

  it("inserts the answer right after its message in the middle of a history", () => {
    const history = [
      new HumanMessage("first"),
      aiWithInvalid([invalidCall()]),
      new HumanMessage("second"),
    ];
    const patched = patchInvalidToolCalls(history);
    expect(patched).toHaveLength(4);
    expect(patched[2]).toBeInstanceOf(ToolMessage);
    expect(patched[3]).toBeInstanceOf(HumanMessage);
  });

  it("answers invalid calls on an AIMessageChunk", () => {
    // A chunk only carries invalid calls through tool_call_chunks, which
    // collapse lazily into invalid_tool_calls, so build it that way.
    const chunk = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          name: "search",
          args: "not json at all",
          id: "call_1",
          index: 0,
          type: "tool_call_chunk",
        },
      ],
    });
    expect(chunk.invalid_tool_calls).toHaveLength(1);
    const patched = patchInvalidToolCalls([chunk]);
    expect(patched).toHaveLength(2);
    expect((patched[1] as ToolMessage).tool_call_id).toBe("call_1");
  });

  it("returns the same history when there is nothing to patch", () => {
    const history = [new HumanMessage("hi"), new AIMessage("hello")];
    expect(patchInvalidToolCalls(history)).toBe(history);
    const withValid = [
      new AIMessage({
        content: "",
        tool_calls: [{ name: "search", args: { q: "paris" }, id: "call_1" }],
      }),
    ];
    expect(patchInvalidToolCalls(withValid)).toBe(withValid);
  });

  it("answers an invalid structured output call as well", () => {
    const patched = patchInvalidToolCalls([
      aiWithInvalid([invalidCall({ id: "call_9", name: "extract-foo" })]),
    ]);
    expect(patched).toHaveLength(2);
    expect((patched[1] as ToolMessage).tool_call_id).toBe("call_9");
    expect((patched[1] as ToolMessage).name).toBe("extract-foo");
  });
});

describe("createAgent invalid_tool_calls", () => {
  it("answers an unanswered invalid tool call before the next model call and persists the answer", async () => {
    const model = new FakeToolCallingChatModel({
      responses: [
        invalidSearchMessage(),
        new AIMessage("done"),
        new AIMessage("done again"),
      ],
      sleep: 0,
    });
    const spy = vi.spyOn(model, "invoke");
    const checkpointer = createCheckpointer();
    const agent = createAgent({
      model,
      tools: [searchTool],
      checkpointer,
    });
    const thread = { configurable: { thread_id: "invalid-call-thread" } };

    const first = await agent.invoke(
      { messages: [new HumanMessage("hi")] },
      thread
    );
    expect(
      first.messages.filter((m) => ToolMessage.isInstance(m))
    ).toHaveLength(0);

    const second = await agent.invoke(
      { messages: [new HumanMessage("continue")] },
      thread
    );
    const modelMessages = spy.mock.calls.at(-1)?.[0] as
      | Parameters<typeof model.invoke>[0]
      | undefined;
    expect(modelMessages).toBeDefined();
    const patched = (modelMessages as unknown[]).filter(
      (m) =>
        ToolMessage.isInstance(m as never) &&
        (m as ToolMessage).tool_call_id === "call_1"
    ) as ToolMessage[];
    expect(patched).toHaveLength(1);
    expect(patched[0].status).toBe("error");
    expect(patched[0].content).toBe(
      "Tool call search with id call_1 could not be executed - arguments were malformed or truncated."
    );

    const saved = await checkpointer.get(thread);
    const savedTools = (saved?.channel_values.messages as unknown[]).filter(
      (m) =>
        ToolMessage.isInstance(m as never) &&
        (m as ToolMessage).tool_call_id === "call_1"
    );
    expect(savedTools).toHaveLength(1);
    expect(second.messages.some((m) => ToolMessage.isInstance(m))).toBe(true);

    await agent.invoke({ messages: [new HumanMessage("again")] }, thread);
    const savedAgain = await checkpointer.get(thread);
    const savedToolsAgain = (
      savedAgain?.channel_values.messages as unknown[]
    ).filter(
      (m) =>
        ToolMessage.isInstance(m as never) &&
        (m as ToolMessage).tool_call_id === "call_1"
    );
    expect(savedToolsAgain).toHaveLength(1);
  });

  it("does not persist the repair when the model call throws, and patches again on the next invoke", async () => {
    const model = new FakeToolCallingChatModel({
      responses: [invalidSearchMessage(), new AIMessage("done")],
      sleep: 0,
    });
    const checkpointer = createCheckpointer();
    const agent = createAgent({
      model,
      tools: [searchTool],
      checkpointer,
    });
    const thread = { configurable: { thread_id: "throw-thread" } };
    await agent.invoke({ messages: [new HumanMessage("hi")] }, thread);
    model.thrownErrorString = "boom";
    await expect(
      agent.invoke({ messages: [new HumanMessage("again")] }, thread)
    ).rejects.toThrow("boom");
    const savedAfterThrow = await checkpointer.get(thread);
    const afterThrow = (
      savedAfterThrow?.channel_values.messages as BaseMessage[]
    ).filter(
      (m) =>
        ToolMessage.isInstance(m) &&
        (m as ToolMessage).tool_call_id === "call_1"
    );
    expect(afterThrow).toHaveLength(0);
    model.thrownErrorString = undefined;
    await agent.invoke({ messages: [new HumanMessage("once more")] }, thread);
    const saved = await checkpointer.get(thread);
    const answers = (saved?.channel_values.messages as BaseMessage[]).filter(
      (m) =>
        ToolMessage.isInstance(m) &&
        (m as ToolMessage).tool_call_id === "call_1"
    );
    expect(answers).toHaveLength(1);
  });

  it("does not add a second answer when the call was already answered", async () => {
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("done")],
      sleep: 0,
    });
    const spy = vi.spyOn(model, "invoke");
    const agent = createAgent({
      model,
      tools: [searchTool],
      checkpointer: createCheckpointer(),
    });
    await agent.invoke(
      {
        messages: [
          new HumanMessage("hi"),
          invalidSearchMessage(),
          new ToolMessage({ content: "manual answer", tool_call_id: "call_1" }),
        ],
      },
      { configurable: { thread_id: "answered-thread" } }
    );
    const modelMessages = spy.mock.calls.at(-1)?.[0] as unknown[];
    const answers = modelMessages.filter(
      (m) =>
        ToolMessage.isInstance(m as never) &&
        (m as ToolMessage).tool_call_id === "call_1"
    );
    expect(answers).toHaveLength(1);
    expect((answers[0] as ToolMessage).content).toBe("manual answer");
  });

  it("persists the repair when the run ends with a structured response", async () => {
    const responseFormat = toolStrategy(
      z.object({
        temperature: z.number().describe("The temperature in fahrenheit"),
      })
    );
    const structured = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: responseFormat[0].tool.function.name,
          args: { temperature: 75 },
          id: "call_s",
          type: "tool_call",
        },
      ],
    });
    const model = new FakeToolCallingChatModel({
      responses: [invalidSearchMessage(), structured],
      sleep: 0,
    });
    const checkpointer = createCheckpointer();
    const agent = createAgent({
      model,
      tools: [searchTool],
      responseFormat,
      checkpointer,
    });
    const thread = { configurable: { thread_id: "structured-thread" } };
    await agent.invoke({ messages: [new HumanMessage("hi")] }, thread);
    const result = await agent.invoke(
      { messages: [new HumanMessage("again")] },
      thread
    );
    expect(result.structuredResponse).toEqual({ temperature: 75 });
    const saved = await checkpointer.get(thread);
    const savedMessages = saved?.channel_values.messages as BaseMessage[];
    const answers = savedMessages.filter(
      (m) =>
        ToolMessage.isInstance(m) &&
        (m as ToolMessage).tool_call_id === "call_1"
    );
    expect(answers).toHaveLength(1);
  });

  it("answers the invalid call in a mixed valid and invalid message, and runs the valid call", async () => {
    const mixed = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "search",
          args: { q: "paris" },
          id: "call_1",
          type: "tool_call",
        },
      ],
      invalid_tool_calls: [invalidCall({ id: "call_2" })],
    });
    const model = new FakeToolCallingChatModel({
      responses: [mixed, new AIMessage("done")],
      sleep: 0,
    });
    const spy = vi.spyOn(model, "invoke");
    const checkpointer = createCheckpointer();
    const agent = createAgent({
      model,
      tools: [searchTool],
      checkpointer,
    });
    const thread = { configurable: { thread_id: "mixed-thread" } };
    const result = await agent.invoke(
      { messages: [new HumanMessage("hi")] },
      thread
    );
    const toolMessages = result.messages.filter((m) =>
      ToolMessage.isInstance(m)
    ) as ToolMessage[];
    expect(toolMessages.map((m) => m.tool_call_id).sort()).toEqual([
      "call_1",
      "call_2",
    ]);
    expect(toolMessages.find((m) => m.tool_call_id === "call_2")?.status).toBe(
      "error"
    );
    expect(
      toolMessages.find((m) => m.tool_call_id === "call_1")?.status
    ).not.toBe("error");
    const secondCallMessages = spy.mock.calls.at(-1)?.[0] as unknown[];
    expect(
      secondCallMessages.filter(
        (m) =>
          ToolMessage.isInstance(m as never) &&
          (m as ToolMessage).tool_call_id === "call_2"
      )
    ).toHaveLength(1);
  });
});
