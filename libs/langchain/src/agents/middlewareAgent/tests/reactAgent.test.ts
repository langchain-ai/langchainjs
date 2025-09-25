import { describe, it, expect, vi } from "vitest";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";

import { createAgent, createMiddleware } from "../index.js";
import { FakeToolCallingModel } from "../../tests/utils.js";
import type { ToolCallResults } from "../types.js";

describe("reactAgent", () => {
  it("should work with middleware", async () => {
    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          { id: "call_1", name: "toolA", args: { name: "foo" } },
          { id: "call_2", name: "toolB", args: { name: "bar" } },
        ],
      ],
    });
    const toolA = tool(
      async () => {
        return "Hello, world!";
      },
      {
        name: "toolA",
      }
    );
    const toolB = tool(
      async () => {
        throw new Error("toolB failed");
      },
      {
        name: "toolB",
      }
    );

    const modifyModelRequest = vi.fn();
    const beforeModel = vi.fn();
    const afterModel = vi.fn();
    const middleware = createMiddleware({
      name: "middleware",
      modifyModelRequest,
      beforeModel,
      afterModel,
    });

    const agent = createAgent({
      model,
      tools: [toolA, toolB],
      middleware: [middleware],
    });

    await agent
      .invoke({
        messages: [new HumanMessage("Hello, world!")],
      })
      .catch(() => {
        /** test error property from toolb */
      });

    const sanitizedToolCalls = (toolCall: ToolCallResults) => {
      if (
        toolCall.result &&
        typeof toolCall.result === "object" &&
        "id" in toolCall.result
      ) {
        toolCall.result.id = "sanitized";
      }
      return toolCall;
    };
    const modifyModelRequestToolCalls =
      modifyModelRequest.mock.calls[0][2].toolCalls.map(sanitizedToolCalls);
    const beforeModelToolCalls =
      beforeModel.mock.calls[0][1].toolCalls.map(sanitizedToolCalls);
    const afterModelToolCalls =
      afterModel.mock.calls[0][1].toolCalls.map(sanitizedToolCalls);

    expect(modifyModelRequestToolCalls).toMatchInlineSnapshot(`
      [
        {
          "args": {
            "name": "foo",
          },
          "error": undefined,
          "id": "call_1",
          "name": "toolA",
          "result": {
            "id": [
              "langchain_core",
              "messages",
              "ToolMessage",
            ],
            "kwargs": {
              "additional_kwargs": {},
              "artifact": undefined,
              "content": "Hello, world!",
              "id": "sanitized",
              "name": "toolA",
              "response_metadata": {},
              "tool_call_id": "call_1",
            },
            "lc": 1,
            "type": "constructor",
          },
        },
        {
          "args": {
            "name": "bar",
          },
          "error": "toolB failed",
          "id": "call_2",
          "name": "toolB",
          "result": undefined,
        },
      ]
    `);
    expect(beforeModelToolCalls).toMatchInlineSnapshot(`
      [
        {
          "args": {
            "name": "foo",
          },
          "error": undefined,
          "id": "call_1",
          "name": "toolA",
          "result": {
            "id": [
              "langchain_core",
              "messages",
              "ToolMessage",
            ],
            "kwargs": {
              "additional_kwargs": {},
              "artifact": undefined,
              "content": "Hello, world!",
              "id": "sanitized",
              "name": "toolA",
              "response_metadata": {},
              "tool_call_id": "call_1",
            },
            "lc": 1,
            "type": "constructor",
          },
        },
        {
          "args": {
            "name": "bar",
          },
          "error": "toolB failed",
          "id": "call_2",
          "name": "toolB",
          "result": undefined,
        },
      ]
    `);
    expect(afterModelToolCalls).toMatchInlineSnapshot(`
      [
        {
          "args": {
            "name": "foo",
          },
          "error": undefined,
          "id": "call_1",
          "name": "toolA",
          "result": {
            "id": [
              "langchain_core",
              "messages",
              "ToolMessage",
            ],
            "kwargs": {
              "additional_kwargs": {},
              "artifact": undefined,
              "content": "Hello, world!",
              "id": "sanitized",
              "name": "toolA",
              "response_metadata": {},
              "tool_call_id": "call_1",
            },
            "lc": 1,
            "type": "constructor",
          },
        },
        {
          "args": {
            "name": "bar",
          },
          "error": "toolB failed",
          "id": "call_2",
          "name": "toolB",
          "result": undefined,
        },
      ]
    `);
  });
});
