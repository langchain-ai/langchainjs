import Anthropic from "@anthropic-ai/sdk";
import { test, expect, describe } from "vitest";
import {
  AIMessage,
  ContentBlock,
  HumanMessage,
} from "@langchain/core/messages";
import {
  anthropicResponseToChatMessages,
  _makeMessageChunkFromAnthropicEvent,
} from "../utils/message_outputs.js";
import { _convertMessagesToAnthropicPayload } from "../utils/message_inputs.js";

test("Web Search Tool - Anthropic response to LangChain format", () => {
  // What Anthropic returns
  const anthropicResponse: ContentBlock[] = [
    {
      type: "text",
      text: "I'll search for that information.",
      citations: null,
    },
    {
      type: "server_tool_use",
      id: "toolu_01ABC123",
      name: "web_search",
      input: { query: "Claude Shannon birth date" },
    },
    {
      type: "web_search_tool_result",
      tool_use_id: "toolu_01ABC123",
      content: [
        {
          type: "web_search_result",
          title: "Claude Shannon - Wikipedia",
          url: "https://en.wikipedia.org/wiki/Claude_Shannon",
          encrypted_content:
            "eyJjb250ZW50IjoiQ2xhdWRlIEVsd29vZCBTaGFubm9uIChBcHJpbCAzMCwgMTkxNiDigJMgRmVicnVhcnkgMjQsIDIwMDEpIHdhcyBhbiBBbWVyaWNhbiBtYXRoZW1hdGljaWFuLCBlbGVjdHJpY2FsIGVuZ2luZWVyLCBjb21wdXRlciBzY2llbnRpc3QgYW5kIGNyeXB0b2dyYXBoZXIga25vd24gYXMgdGhlIGZhdGhlciBvZiBpbmZvcm1hdGlvbiB0aGVvcnkuIn0=",
          page_age: "April 30, 2025",
        },
      ],
    },
    {
      type: "text",
      text: "Claude Shannon was born on April 30, 1916.",
      citations: [
        {
          type: "web_search_result_location",
          url: "https://en.wikipedia.org/wiki/Claude_Shannon",
          title: "Claude Shannon - Wikipedia",
          cited_text:
            "Claude Elwood Shannon (April 30, 1916 – February 24, 2001)...",
          encrypted_index:
            "Eo8BCioIAhgBIiQyYjQ0OWJmZi1lNm1qLTQxYWUtOGVkYi1hNTc3MGZkZDllOGYSKENsYXVkZSBFbHdvb2QgU2hhbm5vbiAoQXByaWwgMzAsIDE5MTYgXu+/vSk=",
        },
      ],
    },
  ];

  const result = anthropicResponseToChatMessages(
    anthropicResponse as unknown as Anthropic.ContentBlock[],
    {
      id: "msg_01ABC123",
    }
  );

  // What LangChain should produce
  expect(result[0].message).toEqual(
    new AIMessage({
      content: anthropicResponse,
      tool_calls: [],
      additional_kwargs: { id: "msg_01ABC123" },
      response_metadata: { id: "msg_01ABC123", model_provider: "anthropic" },
      id: "msg_01ABC123",
    })
  );
});

test("Web Search Tool - Only web_search server tools extracted", () => {
  // What Anthropic returns (multiple server tools)
  const anthropicResponse: ContentBlock[] = [
    {
      type: "server_tool_use",
      id: "toolu_web_001",
      name: "web_search",
      input: { query: "latest AI developments" },
    },
    {
      type: "server_tool_use",
      id: "toolu_web_002",
      name: "web_search",
      input: { query: "machine learning trends 2024" },
    },
  ];

  const result = anthropicResponseToChatMessages(
    anthropicResponse as unknown as Anthropic.ContentBlock[],
    {}
  );

  // What LangChain should produce (only web_search extracted)
  expect(result[0].message).toEqual(
    new AIMessage({
      content: anthropicResponse,
      tool_calls: [],
      additional_kwargs: {},
      response_metadata: {
        model_provider: "anthropic",
      },
      usage_metadata: undefined,
      id: undefined,
    })
  );
});

test("Web Search Tool - LangChain message to Anthropic format", () => {
  // What LangChain has (after a web search response)
  const langChainMessage = new AIMessage({
    content: [
      {
        type: "text",
        text: "Based on my search, Claude Shannon was born in 1916 and made foundational contributions to information theory.",
        citations: [
          {
            type: "web_search_result_location",
            url: "https://en.wikipedia.org/wiki/Claude_Shannon",
            title: "Claude Shannon - Wikipedia",
            cited_text:
              "Claude Elwood Shannon (April 30, 1916 – February 24, 2001) was an American mathematician...",
            encrypted_index:
              "Eo8BCioIAhgBIiQyYjQ0OWJmZi1lNm1qLWJkZGUtNDI0YS1hMjZlLWNmOTNjMGEzNGE2YxIkQ2xhdWRlIEVsd29vZCBTaGFubm9uIChBcHJpbCAzMCwgMTkxNiA+z+/fSk=",
          },
        ],
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "toolu_01DEF456",
        content: [
          {
            type: "web_search_result",
            title: "Claude Shannon - Wikipedia",
            url: "https://en.wikipedia.org/wiki/Claude_Shannon",
            encrypted_content:
              "eyJjb250ZW50IjoiQ2xhdWRlIEVsd29vZCBTaGFubm9uIChBcHJpbCAzMCwgMTkxNiDigJMgRmVicnVhcnkgMjQsIDIwMDEpIHdhcyBhbiBBbWVyaWNhbiBtYXRoZW1hdGljaWFuLCBlbGVjdHJpY2FsIGVuZ2luZWVyLCBjb21wdXRlciBzY2llbnRpc3QgYW5kIGNyeXB0b2dyYXBoZXIga25vd24gYXMgdGhlIGZhdGhlciBvZiBpbmZvcm1hdGlvbiB0aGVvcnkuIn0=",
            page_age: "April 30, 2025",
          },
          {
            type: "web_search_result",
            title: "Information Theory - Britannica",
            url: "https://www.britannica.com/science/information-theory",
            encrypted_content:
              "eyJjb250ZW50IjoiSW5mb3JtYXRpb24gdGhlb3J5LCBhIG1hdGhlbWF0aWNhbCByZXByZXNlbnRhdGlvbiBvZiB0aGUgY29uZGl0aW9ucyBhbmQgcGFyYW1ldGVycyBhZmZlY3RpbmcgdGhlIHRyYW5zbWlzc2lvbiBhbmQgcHJvY2Vzc2luZyBvZiBpbmZvcm1hdGlvbi4ifQ==",
            page_age: "April 30, 2025",
          },
        ],
      },
    ],
  });

  const result = _convertMessagesToAnthropicPayload([
    new HumanMessage("Follow up question about information theory"),
    langChainMessage,
  ]);

  // What should be sent to Anthropic (preserving encrypted content for multi-turn)
  expect(result.messages[1]).toEqual({
    role: "assistant",
    content: [
      {
        type: "text",
        text: "Based on my search, Claude Shannon was born in 1916 and made foundational contributions to information theory.",
        citations: [
          {
            type: "web_search_result_location",
            url: "https://en.wikipedia.org/wiki/Claude_Shannon",
            title: "Claude Shannon - Wikipedia",
            cited_text:
              "Claude Elwood Shannon (April 30, 1916 – February 24, 2001) was an American mathematician...",
            encrypted_index:
              "Eo8BCioIAhgBIiQyYjQ0OWJmZi1lNm1qLWJkZGUtNDI0YS1hMjZlLWNmOTNjMGEzNGE2YxIkQ2xhdWRlIEVsd29vZCBTaGFubm9uIChBcHJpbCAzMCwgMTkxNiA+z+/fSk=",
          },
        ],
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "toolu_01DEF456",
        content: [
          {
            type: "web_search_result",
            title: "Claude Shannon - Wikipedia",
            url: "https://en.wikipedia.org/wiki/Claude_Shannon",
            encrypted_content:
              "eyJjb250ZW50IjoiQ2xhdWRlIEVsd29vZCBTaGFubm9uIChBcHJpbCAzMCwgMTkxNiDigJMgRmVicnVhcnkgMjQsIDIwMDEpIHdhcyBhbiBBbWVyaWNhbiBtYXRoZW1hdGljaWFuLCBlbGVjdHJpY2FsIGVuZ2luZWVyLCBjb21wdXRlciBzY2llbnRpc3QgYW5kIGNyeXB0b2dyYXBoZXIga25vd24gYXMgdGhlIGZhdGhlciBvZiBpbmZvcm1hdGlvbiB0aGVvcnkuIn0=",
            page_age: "April 30, 2025",
          },
          {
            type: "web_search_result",
            title: "Information Theory - Britannica",
            url: "https://www.britannica.com/science/information-theory",
            encrypted_content:
              "eyJjb250ZW50IjoiSW5mb3JtYXRpb24gdGhlb3J5LCBhIG1hdGhlbWF0aWNhbCByZXByZXNlbnRhdGlvbiBvZiB0aGUgY29uZGl0aW9ucyBhbmQgcGFyYW1ldGVycyBhZmZlY3RpbmcgdGhlIHRyYW5zbWlzc2lvbiBhbmQgcHJvY2Vzc2luZyBvZiBpbmZvcm1hdGlvbi4ifQ==",
            page_age: "April 30, 2025",
          },
        ],
      },
    ],
  });
});

describe("Streaming: server_tool_use blocks", () => {
  test("input_json_delta for server_tool_use does NOT emit tool_call_chunks", () => {
    const blockTypesByIndex = new Map<number, string>();

    // Simulate content_block_start for server_tool_use
    const startResult = _makeMessageChunkFromAnthropicEvent(
      {
        type: "content_block_start",
        index: 1,
        content_block: {
          type: "server_tool_use",
          id: "srvtoolu_014hJH82Qum7Td6UV8gDXThB",
          name: "web_search",
          input: {},
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      {
        streamUsage: false,
        coerceContentToString: false,
        blockTypesByIndex,
      }
    );
    expect(startResult).not.toBeNull();
    expect(startResult!.chunk.tool_call_chunks).toEqual([]);

    // Simulate input_json_delta for the same server_tool_use index
    const deltaResult = _makeMessageChunkFromAnthropicEvent(
      {
        type: "content_block_delta",
        index: 1,
        delta: {
          type: "input_json_delta",
          partial_json: '{"query": "weather NYC today"}',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      {
        streamUsage: false,
        coerceContentToString: false,
        blockTypesByIndex,
      }
    );
    expect(deltaResult).not.toBeNull();
    // server_tool_use input_json_delta should NOT produce tool_call_chunks
    expect(deltaResult!.chunk.tool_call_chunks).toEqual([]);
    // But the content block should still be emitted
    expect(deltaResult!.chunk.content).toEqual([
      {
        index: 1,
        input: '{"query": "weather NYC today"}',
        type: "input_json_delta",
      },
    ]);
  });

  test("input_json_delta for regular tool_use still emits tool_call_chunks", () => {
    const blockTypesByIndex = new Map<number, string>();

    // Simulate content_block_start for regular tool_use
    _makeMessageChunkFromAnthropicEvent(
      {
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "tool_use",
          id: "toolu_user_001",
          name: "get_weather",
          input: {},
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      {
        streamUsage: false,
        coerceContentToString: false,
        blockTypesByIndex,
      }
    );

    // Simulate input_json_delta for the regular tool_use
    const deltaResult = _makeMessageChunkFromAnthropicEvent(
      {
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "input_json_delta",
          partial_json: '{"location": "NYC"}',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      {
        streamUsage: false,
        coerceContentToString: false,
        blockTypesByIndex,
      }
    );
    expect(deltaResult).not.toBeNull();
    // Regular tool_use SHOULD produce tool_call_chunks
    expect(deltaResult!.chunk.tool_call_chunks).toHaveLength(1);
    expect(deltaResult!.chunk.tool_call_chunks![0]).toEqual({
      index: 0,
      args: '{"location": "NYC"}',
    });
  });

  test("mixed tool_use and server_tool_use in same stream are handled correctly", () => {
    const blockTypesByIndex = new Map<number, string>();

    // Start regular tool_use at index 0
    _makeMessageChunkFromAnthropicEvent(
      {
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "tool_use",
          id: "toolu_user_001",
          name: "get_weather",
          input: {},
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { streamUsage: false, coerceContentToString: false, blockTypesByIndex }
    );

    // Start server_tool_use at index 1
    _makeMessageChunkFromAnthropicEvent(
      {
        type: "content_block_start",
        index: 1,
        content_block: {
          type: "server_tool_use",
          id: "srvtoolu_001",
          name: "web_search",
          input: {},
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { streamUsage: false, coerceContentToString: false, blockTypesByIndex }
    );

    // Delta for tool_use (index 0) -> should have tool_call_chunks
    const clientDelta = _makeMessageChunkFromAnthropicEvent(
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"loc": "NYC"}' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { streamUsage: false, coerceContentToString: false, blockTypesByIndex }
    );
    expect(clientDelta!.chunk.tool_call_chunks).toHaveLength(1);

    // Delta for server_tool_use (index 1) -> should NOT have tool_call_chunks
    const serverDelta = _makeMessageChunkFromAnthropicEvent(
      {
        type: "content_block_delta",
        index: 1,
        delta: {
          type: "input_json_delta",
          partial_json: '{"query": "weather"}',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { streamUsage: false, coerceContentToString: false, blockTypesByIndex }
    );
    expect(serverDelta!.chunk.tool_call_chunks).toEqual([]);
  });

  test("web_search_tool_result content_block_start is handled", () => {
    const blockTypesByIndex = new Map<number, string>();
    const result = _makeMessageChunkFromAnthropicEvent(
      {
        type: "content_block_start",
        index: 2,
        content_block: {
          type: "web_search_tool_result",
          tool_use_id: "srvtoolu_014hJH82Qum7Td6UV8gDXThB",
          content: [
            {
              type: "web_search_result",
              title: "Test Result",
              url: "https://example.com",
              encrypted_content: "abc123",
              page_age: null,
            },
          ],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { streamUsage: false, coerceContentToString: false, blockTypesByIndex }
    );
    expect(result).not.toBeNull();
    expect(result!.chunk.tool_call_chunks).toEqual([]);
  });

  test("web_fetch_tool_result content_block_start is not dropped", () => {
    const blockTypesByIndex = new Map<number, string>();
    const result = _makeMessageChunkFromAnthropicEvent(
      {
        type: "content_block_start",
        index: 3,
        content_block: {
          type: "web_fetch_tool_result",
          tool_use_id: "srvtoolu_fetch_001",
          content: "Page content here...",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { streamUsage: false, coerceContentToString: false, blockTypesByIndex }
    );
    expect(result).not.toBeNull();
    expect(result!.chunk.tool_call_chunks).toEqual([]);
  });
});

test("Web Search Tool - web_fetch_tool_result round-trips through message formatting", () => {
  const langChainMessage = new AIMessage({
    content: [
      {
        type: "server_tool_use",
        id: "srvtoolu_fetch_001",
        name: "web_fetch",
        input: { url: "https://example.com" },
      },
      {
        type: "web_fetch_tool_result",
        tool_use_id: "srvtoolu_fetch_001",
        content: "Page content here...",
      },
    ],
  });

  const result = _convertMessagesToAnthropicPayload([
    new HumanMessage("Fetch this page"),
    langChainMessage,
  ]);

  // Both blocks should be preserved (not dropped)
  expect(result.messages[1].content).toHaveLength(2);
  expect(
    (result.messages[1].content as ContentBlock[])[0].type
  ).toBe("server_tool_use");
  expect(
    (result.messages[1].content as ContentBlock[])[1].type
  ).toBe("web_fetch_tool_result");
});
