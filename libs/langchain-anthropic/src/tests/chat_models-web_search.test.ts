import { test, expect } from "@jest/globals";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { anthropicResponseToChatMessages } from "../utils/message_outputs.js";
import { _convertMessagesToAnthropicPayload } from "../utils/message_inputs.js";

test("Web Search Tool - Anthropic response to LangChain format", () => {
  // What Anthropic returns
  const anthropicResponse = [
    {
      type: "text",
      text: "I'll search for that information.",
    },
    {
      type: "server_tool_use",
      id: "toolu_01ABC123",
      name: "web_search",
      input: { query: "Claude Shannon birth date" }
    },
    {
      type: "web_search_tool_result",
      tool_use_id: "toolu_01ABC123",
      content: [
        {
          type: "web_search_result",
          title: "Claude Shannon - Wikipedia",
          url: "https://en.wikipedia.org/wiki/Claude_Shannon",
          content: "Claude Elwood Shannon (April 30, 1916 – February 24, 2001)..."
        }
      ]
    },
    {
      type: "text",
      text: "Claude Shannon was born on April 30, 1916.",
      citations: [
        {
          type: "web_search_result_location",
          url: "https://en.wikipedia.org/wiki/Claude_Shannon",
          title: "Claude Shannon - Wikipedia",
          cited_text: "Claude Elwood Shannon (April 30, 1916 – February 24, 2001)..."
        }
      ]
    }
  ];

  const result = anthropicResponseToChatMessages(anthropicResponse, { id: "msg_01ABC123" });

  // What LangChain should produce
  expect(result[0].message).toEqual(
    new AIMessage({
      content: anthropicResponse,
      tool_calls: [
        {
          name: "web_search",
          args: { query: "Claude Shannon birth date" },
          id: "toolu_01ABC123",
          type: "tool_call"
        }
      ],
      additional_kwargs: { id: "msg_01ABC123" },
      response_metadata: { id: "msg_01ABC123" },
      id: "msg_01ABC123"
    })
  );
});

test("Web Search Tool - Only web_search server tools extracted", () => {
  // What Anthropic returns (multiple server tools)
  const anthropicResponse = [
    {
      type: "server_tool_use",
      id: "toolu_web",
      name: "web_search",
      input: { query: "test" }
    },
    {
      type: "server_tool_use",
      id: "toolu_bash",
      name: "bash",
      input: { command: "ls" }
    }
  ];

  const result = anthropicResponseToChatMessages(anthropicResponse, {});

  // What LangChain should produce (only web_search extracted)
  expect(result[0].message).toEqual(
    new AIMessage({
      content: anthropicResponse,
      tool_calls: [
        {
          name: "web_search",
          args: { query: "test" },
          id: "toolu_web",
          type: "tool_call"
        }
      ],
      additional_kwargs: {},
      response_metadata: {},
      id: undefined
    })
  );
});

test("Web Search Tool - LangChain message to Anthropic format", () => {
  // What LangChain has (after a web search response)
  const langChainMessage = new AIMessage({
    content: [
      {
        type: "text",
        text: "Based on my search, Claude Shannon was born in 1916.",
        citations: [
          {
            type: "web_search_result_location",
            url: "https://en.wikipedia.org/wiki/Claude_Shannon",
            title: "Claude Shannon - Wikipedia",
            cited_text: "Claude Elwood Shannon (April 30, 1916..."
          }
        ]
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "toolu_01ABC123",
        content: [
          {
            type: "web_search_result",
            title: "Claude Shannon - Wikipedia",
            url: "https://en.wikipedia.org/wiki/Claude_Shannon",
            content: "Claude Elwood Shannon (April 30, 1916 – February 24, 2001)...",
            encrypted_index: "Eo8BCioIAhgBIiQyYjQ0OWJmZi1lNm.."
          }
        ]
      }
    ]
  });

  const result = _convertMessagesToAnthropicPayload([
    new HumanMessage("Follow up question"),
    langChainMessage
  ]);

  // What should be sent to Anthropic (preserving encrypted content for multi-turn)
  expect(result.messages[1]).toEqual({
    role: "assistant",
    content: [
      {
        type: "text",
        text: "Based on my search, Claude Shannon was born in 1916.",
        citations: [
          {
            type: "web_search_result_location",
            url: "https://en.wikipedia.org/wiki/Claude_Shannon",
            title: "Claude Shannon - Wikipedia",
            cited_text: "Claude Elwood Shannon (April 30, 1916..."
          }
        ]
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "toolu_01ABC123",
        content: [
          {
            type: "web_search_result",
            title: "Claude Shannon - Wikipedia",
            url: "https://en.wikipedia.org/wiki/Claude_Shannon",
            content: "Claude Elwood Shannon (April 30, 1916 – February 24, 2001)...",
            encrypted_index: "Eo8BCioIAhgBIiQyYjQ0OWJmZi1lNm.."
          }
        ]
      }
    ]
  });
});