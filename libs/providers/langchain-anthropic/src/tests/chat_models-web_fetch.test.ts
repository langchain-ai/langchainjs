import Anthropic from "@anthropic-ai/sdk";
import { test, expect } from "vitest";
import {
  AIMessage,
  ContentBlock,
  HumanMessage,
} from "@langchain/core/messages";
import { _makeMessageChunkFromAnthropicEvent } from "../utils/message_outputs.js";
import { _convertMessagesToAnthropicPayload } from "../utils/message_inputs.js";

test("Web Fetch Tool - streaming content_block_start is preserved on the chunk", () => {
  // What Anthropic streams once the server-side fetch resolves.
  const event = {
    type: "content_block_start",
    index: 1,
    content_block: {
      type: "web_fetch_tool_result",
      tool_use_id: "srvtoolu_01ABC123",
      content: {
        type: "web_fetch_result",
        url: "https://example.com",
        retrieved_at: "2025-01-01T00:00:00Z",
        content: {
          type: "document",
          title: "Example Domain",
          source: {
            type: "text",
            media_type: "text/plain",
            data: "This domain is for use in documentation examples.",
          },
        },
      },
    },
  };

  const result = _makeMessageChunkFromAnthropicEvent(
    event as unknown as Anthropic.Beta.Messages.BetaRawMessageStreamEvent,
    {
      streamUsage: true,
      coerceContentToString: false,
    }
  );

  expect(result).not.toBeNull();
  const content = result?.chunk.content as ContentBlock[];
  expect(content.some((block) => block.type === "web_fetch_tool_result")).toBe(
    true
  );
  // No tool call chunks are emitted for a result block.
  expect(result?.chunk.tool_call_chunks ?? []).toEqual([]);
});

test("Web Fetch Tool - LangChain message round-trips to Anthropic format", () => {
  // What LangChain holds after a web fetch response.
  const langChainMessage = new AIMessage({
    content: [
      {
        type: "server_tool_use",
        id: "srvtoolu_01DEF456",
        name: "web_fetch",
        input: { url: "https://example.com" },
      },
      {
        type: "web_fetch_tool_result",
        tool_use_id: "srvtoolu_01DEF456",
        content: {
          type: "web_fetch_result",
          url: "https://example.com",
          retrieved_at: "2025-01-01T00:00:00Z",
          content: {
            type: "document",
            title: "Example Domain",
            source: {
              type: "text",
              media_type: "text/plain",
              data: "This domain is for use in documentation examples.",
            },
          },
        },
      },
    ],
  });

  const result = _convertMessagesToAnthropicPayload([
    new HumanMessage("Follow up question about the fetched page"),
    langChainMessage,
  ]);

  // The web_fetch_tool_result block must survive serialization so Anthropic
  // can match it to the preceding web_fetch tool use on the next turn.
  const assistantContent = result.messages[1]
    .content as Anthropic.Beta.BetaContentBlockParam[];
  expect(
    assistantContent.some((block) => block.type === "web_fetch_tool_result")
  ).toBe(true);
});
