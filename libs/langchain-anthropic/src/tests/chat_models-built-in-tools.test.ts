import { describe, it, expect } from "@jest/globals";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { _convertMessagesToAnthropicPayload } from "../utils/message_inputs.js";

describe("Anthropic Server Tools Content Blocks", () => {
  it("should handle server_tool_use content blocks", () => {
    const message = new AIMessage({
      content: [
        {
          type: "text",
          text: "I'll search for information about that topic.",
        },
        {
          type: "server_tool_use",
          id: "toolu_01ABC123",
          name: "web_search",
          input: {
            query: "latest developments in AI",
          },
        },
      ],
    });

    const result = _convertMessagesToAnthropicPayload([message]);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("assistant");
    expect(Array.isArray(result.messages[0].content)).toBe(true);

    const content = result.messages[0].content as any[];
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({
      type: "text",
      text: "I'll search for information about that topic.",
    });
    expect(content[1]).toEqual({
      type: "server_tool_use",
      id: "toolu_01ABC123",
      name: "web_search",
      input: {
        query: "latest developments in AI",
      },
    });
  });

  it("should handle web_search_tool_result content blocks", () => {
    const message = new HumanMessage({
      content: [
        {
          type: "web_search_tool_result",
          tool_use_id: "toolu_01ABC123",
          content: [
            {
              type: "web_search_result",
              title: "Latest AI Developments",
              url: "https://example.com/ai-news",
              content: "Recent breakthroughs in artificial intelligence...",
            },
            {
              type: "web_search_result",
              title: "AI Research Updates",
              url: "https://example.com/research",
              content: "New research papers and findings...",
            },
          ],
        },
      ],
    });

    const result = _convertMessagesToAnthropicPayload([message]);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    expect(Array.isArray(result.messages[0].content)).toBe(true);

    const content = result.messages[0].content as any[];
    expect(content).toHaveLength(1);
    expect(content[0]).toEqual({
      type: "web_search_tool_result",
      tool_use_id: "toolu_01ABC123",
      content: [
        {
          type: "web_search_result",
          title: "Latest AI Developments",
          url: "https://example.com/ai-news",
          content: "Recent breakthroughs in artificial intelligence...",
        },
        {
          type: "web_search_result",
          title: "AI Research Updates",
          url: "https://example.com/research",
          content: "New research papers and findings...",
        },
      ],
    });
  });

  it("should handle mixed content with server tools", () => {
    const messages = [
      new HumanMessage({
        content: "Can you search for recent AI developments?",
      }),
      new AIMessage({
        content: [
          {
            type: "text",
            text: "I'll search for that information.",
          },
          {
            type: "server_tool_use",
            id: "toolu_01ABC123",
            name: "web_search",
            input: {
              query: "recent AI developments 2024",
            },
          },
        ],
      }),
      new HumanMessage({
        content: [
          {
            type: "web_search_tool_result",
            tool_use_id: "toolu_01ABC123",
            content: [
              {
                type: "web_search_result",
                title: "AI Breakthrough 2024",
                url: "https://example.com/ai-breakthrough",
                content: "Major AI breakthrough announced...",
              },
            ],
          },
        ],
      }),
      new AIMessage({
        content:
          "Based on the search results, here are the latest AI developments...",
      }),
    ];

    const result = _convertMessagesToAnthropicPayload(messages);

    expect(result.messages).toHaveLength(4);

    // Check human message
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content).toBe(
      "Can you search for recent AI developments?"
    );

    // Check AI message with server_tool_use
    expect(result.messages[1].role).toBe("assistant");
    const aiContent = result.messages[1].content as any[];
    expect(aiContent).toHaveLength(2);
    expect(aiContent[0].type).toBe("text");
    expect(aiContent[1].type).toBe("server_tool_use");

    // Check human message with web_search_tool_result
    expect(result.messages[2].role).toBe("user");
    const userContent = result.messages[2].content as any[];
    expect(userContent).toHaveLength(1);
    expect(userContent[0].type).toBe("web_search_tool_result");

    // Check final AI response
    expect(result.messages[3].role).toBe("assistant");
    expect(result.messages[3].content).toBe(
      "Based on the search results, here are the latest AI developments..."
    );
  });

  it("should preserve cache_control in server tool content blocks", () => {
    const message = new AIMessage({
      content: [
        {
          type: "server_tool_use",
          id: "toolu_01ABC123",
          name: "web_search",
          input: {
            query: "test query",
          },
          cache_control: { type: "ephemeral" },
        },
      ],
    });

    const result = _convertMessagesToAnthropicPayload([message]);

    const content = result.messages[0].content as any[];
    expect(content[0]).toEqual({
      type: "server_tool_use",
      id: "toolu_01ABC123",
      name: "web_search",
      input: {
        query: "test query",
      },
      cache_control: { type: "ephemeral" },
    });
  });

  it("should handle web_search_result with all optional fields", () => {
    const message = new HumanMessage({
      content: [
        {
          type: "web_search_tool_result",
          tool_use_id: "toolu_01ABC123",
          content: [
            {
              type: "web_search_result",
              title: "Complete Example",
              url: "https://example.com/full",
              content: "Full content here...",
              publishedDate: "2024-01-15",
              snippet: "This is a snippet...",
            },
          ],
        },
      ],
    });

    const result = _convertMessagesToAnthropicPayload([message]);

    const content = result.messages[0].content as any[];
    expect(content[0].content[0]).toEqual({
      type: "web_search_result",
      title: "Complete Example",
      url: "https://example.com/full",
      content: "Full content here...",
      publishedDate: "2024-01-15",
      snippet: "This is a snippet...",
    });
  });
});
