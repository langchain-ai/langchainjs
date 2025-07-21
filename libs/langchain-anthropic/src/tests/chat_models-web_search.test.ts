import Anthropic from "@anthropic-ai/sdk";
import { test, expect } from "@jest/globals";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { anthropicResponseToChatMessages } from "../utils/message_outputs.js";
import { _convertMessagesToAnthropicPayload } from "../utils/message_inputs.js";

test("Web Search Tool - Anthropic response to LangChain format", () => {
  // What Anthropic returns
  const anthropicResponse: Anthropic.ContentBlock[] = [
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

  const result = anthropicResponseToChatMessages(anthropicResponse, {
    id: "msg_01ABC123",
  });

  // What LangChain should produce
  expect(result[0].message).toEqual(
    new AIMessage({
      content: anthropicResponse,
      tool_calls: [
        {
          name: "web_search",
          args: { query: "Claude Shannon birth date" },
          id: "toolu_01ABC123",
          type: "tool_call",
        },
      ],
      additional_kwargs: { id: "msg_01ABC123" },
      response_metadata: { id: "msg_01ABC123" },
      id: "msg_01ABC123",
    })
  );
});

test("Web Search Tool - Only web_search server tools extracted", () => {
  // What Anthropic returns (multiple server tools)
  const anthropicResponse: Anthropic.ContentBlock[] = [
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

  const result = anthropicResponseToChatMessages(anthropicResponse, {});

  // What LangChain should produce (only web_search extracted)
  expect(result[0].message).toEqual(
    new AIMessage({
      content: anthropicResponse,
      tool_calls: [
        {
          name: "web_search",
          args: { query: "latest AI developments" },
          id: "toolu_web_001",
          type: "tool_call",
        },
        {
          name: "web_search",
          args: { query: "machine learning trends 2024" },
          id: "toolu_web_002",
          type: "tool_call",
        },
      ],
      additional_kwargs: {},
      response_metadata: {},
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
