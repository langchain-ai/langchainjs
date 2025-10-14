import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";
import { describe, expect, it, vi } from "vitest";
import { createAgent, createMiddleware } from "../index.js";

describe("modelSettings middleware support", () => {
  it("should pass modelSettings to real Anthropic model via bindTools", async () => {
    // Mock the Anthropic client
    const mockCreate = vi.fn().mockResolvedValue({
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Response from model" }],
      model: "claude-sonnet-4-20250514",
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 20 },
    });

    const mockClient = {
      messages: {
        create: mockCreate,
      },
    };

    // Create real ChatAnthropic with mocked client
    const model = new ChatAnthropic({
      model: "claude-sonnet-4-20250514",
      temperature: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createClient: () => mockClient as any,
    });

    const middleware = createMiddleware({
      name: "testMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          modelSettings: {
            headers: {
              "anthropic-beta":
                "code-execution-2025-08-25,files-api-2025-04-14",
            },
            container: "container_abc123",
          },
        });
      },
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [middleware] as const,
    });

    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });

    // Verify the client was called
    expect(mockCreate).toHaveBeenCalled();

    // Check the actual parameters passed to the Anthropic client
    const clientCallArgs = mockCreate.mock.calls[0][0];
    expect(clientCallArgs).toHaveProperty("container", "container_abc123");

    // Check that headers were passed via options (second parameter)
    const clientOptions = mockCreate.mock.calls[0][1];
    expect(clientOptions).toHaveProperty("headers");
    expect(clientOptions.headers).toHaveProperty(
      "anthropic-beta",
      "code-execution-2025-08-25,files-api-2025-04-14"
    );
  });
});
