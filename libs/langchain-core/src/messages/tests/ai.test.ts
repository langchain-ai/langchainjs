import { describe, expect, it } from "vitest";
import { AIMessage } from "../ai.js";

describe("AIMessage", () => {
  it("can be constructed with tool calls", () => {
    const message = new AIMessage({
      content: "Hello, world!",
      tool_calls: [
        {
          id: "123",
          name: "get_weather",
          args: {
            location: "San Francisco",
          },
        },
      ],
    });
    expect(message.content).toEqual("Hello, world!");
    expect(message.tool_calls).toEqual([
      {
        id: "123",
        name: "get_weather",
        args: {
          location: "San Francisco",
        },
      },
    ]);
  });

  describe(".contentBlocks", () => {
    it("should have tool call content blocks from .tool_calls", () => {
      const message = new AIMessage({
        content: "Hello, world!",
        tool_calls: [
          {
            id: "123",
            name: "get_weather",
            args: {
              location: "San Francisco",
            },
          },
        ],
      });
      expect(message.contentBlocks).toEqual([
        {
          type: "tool_call",
          id: "123",
          name: "get_weather",
          args: {
            location: "San Francisco",
          },
        },
      ]);
    });

    it("should include tool calls not included in constructor options", () => {
      const message = new AIMessage({
        contentBlocks: [
          {
            type: "reasoning",
            reasoning: "foo",
          },
          {
            type: "text",
            text: "bar",
          },
          {
            type: "text",
            text: "baz",
            annotations: [
              {
                type: "citation",
                url: "https://example.com",
              },
            ],
          },
          {
            type: "tool_call",
            id: "123",
            name: "get_weather",
            args: {
              location: "San Francisco",
            },
          },
        ],
        tool_calls: [
          {
            type: "tool_call",
            id: "456",
            // tool call thats included in contentBlocks but not in tool_calls
            name: "missing",
            args: {},
          },
        ],
      });
      expect(message.contentBlocks).toBe(
        expect.arrayContaining([
          {
            type: "tool_call",
            id: "123",
            name: "get_weather",
            args: {
              location: "San Francisco",
            },
          },
          {
            type: "tool_call",
            id: "456",
            name: "missing",
            args: {},
          },
        ])
      );
    });

    it("should populate .tool_calls from content blocks", () => {
      const message = new AIMessage({
        contentBlocks: [
          {
            type: "tool_call",
            id: "123",
            name: "get_weather",
            args: {
              location: "San Francisco",
            },
          },
        ],
      });
      expect(message.tool_calls).toEqual([
        {
          id: "123",
          name: "get_weather",
          args: {
            location: "San Francisco",
          },
        },
      ]);
    });
  });
});
