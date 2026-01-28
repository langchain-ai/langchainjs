import { describe, it, expect, vi } from "vitest";
import { ChatOpenAI } from "@langchain/openai";

import { createAgent, createMiddleware } from "../index.js";
import { SystemMessage } from "@langchain/core/messages";

describe("systemMessage", () => {
  it("should set system message correctly", async () => {
    const mockFetch = vi.fn((url, options) => fetch(url, options));
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      configuration: {
        fetch: mockFetch,
      },
    });
    const middlewareA = createMiddleware({
      name: "TestMiddlewareA",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat(" You like to help."),
        });
      },
    });
    const middlewareB = createMiddleware({
      name: "TestMiddlewareB",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat(
            new SystemMessage({
              content: [{ type: "text", text: "You really do!" }],
            })
          ),
        });
      },
    });

    const agent = createAgent({
      model,
      systemPrompt: new SystemMessage("You are a helpful assistant."),
      middleware: [middlewareA, middlewareB],
    });
    await agent.invoke({ messages: "Hello World!" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchInlineSnapshot(`
      {
        "messages": [
          {
            "content": [
              {
                "text": "You are a helpful assistant. You like to help.",
                "type": "text",
              },
              {
                "text": "You really do!",
                "type": "text",
              },
            ],
            "role": "system",
          },
          {
            "content": "Hello World!",
            "role": "user",
          },
        ],
        "model": "gpt-4o-mini",
        "stream": false,
      }
    `);
  });
});
