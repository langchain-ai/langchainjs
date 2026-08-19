import Anthropic from "@anthropic-ai/sdk";
import { test, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { _makeMessageChunkFromAnthropicEvent } from "../utils/message_outputs.js";
import { _convertMessagesToAnthropicPayload } from "../utils/message_inputs.js";

// The `content` shape below is illustrative — the utils pass the server-tool
// result block through unchanged, so these tests assert preservation, not the
// internal representation of a discovered tool.
const toolSearchResultBlock = {
  type: "tool_search_tool_bm25_tool_result",
  tool_use_id: "srvtoolu_01ABC123",
  content: [
    {
      type: "tool_search_result",
      tool_name: "send_email",
    },
  ],
};

test("Tool Search Tool - streaming content_block_start is captured", () => {
  // A deferred-tool search returns its result as a server-tool result block in
  // the same assistant turn. The streaming parser must capture it, otherwise the
  // accumulated message keeps the server_tool_use without its result and the next
  // request fails with INVALID_TOOL_RESULTS.
  const result = _makeMessageChunkFromAnthropicEvent(
    {
      type: "content_block_start",
      index: 1,
      content_block: toolSearchResultBlock,
    } as unknown as Anthropic.Beta.Messages.BetaRawMessageStreamEvent,
    { streamUsage: true, coerceContentToString: false }
  );

  expect(result).not.toBeNull();
  const content = result?.chunk.content;
  expect(Array.isArray(content)).toBe(true);
  expect(
    (content as { type?: string }[]).some(
      (block) => block.type === "tool_search_tool_bm25_tool_result"
    )
  ).toBe(true);
});

test("Tool Search Tool - LangChain message to Anthropic format", () => {
  // A follow-up turn replays the prior assistant message. The server-tool result
  // block must survive the round-trip so its paired server_tool_use is not left
  // dangling on the next request.
  const langChainMessage = new AIMessage({
    content: [
      {
        type: "text",
        text: "Let me find the right tool.",
        citations: null,
      },
      {
        type: "server_tool_use",
        id: "srvtoolu_01ABC123",
        name: "tool_search_tool_bm25",
        input: { query: "send an email" },
      },
      toolSearchResultBlock,
    ],
  });

  const result = _convertMessagesToAnthropicPayload([
    new HumanMessage("Email the team the summary"),
    langChainMessage,
  ]);

  const assistant = result.messages[1];
  expect(assistant.role).toBe("assistant");
  expect(
    (assistant.content as { type?: string }[]).some(
      (block) => block.type === "tool_search_tool_bm25_tool_result"
    )
  ).toBe(true);
});
