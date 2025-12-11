import { test, expect, describe } from "vitest";
import {
  XAI_LIVE_SEARCH_TOOL_NAME,
  XAI_LIVE_SEARCH_TOOL_TYPE,
  xaiLiveSearch,
  XAILiveSearchTool,
} from "../live_search.js";
import { ChatXAI } from "../../chat_models.js";

describe("xaiLiveSearch tool", () => {
  test("creates a tool with correct provider definition", async () => {
    const tool = xaiLiveSearch({
      maxSearchResults: 10,
      fromDate: "2024-01-01",
      returnCitations: true,
    });

    expect(tool).toMatchObject({
      type: XAI_LIVE_SEARCH_TOOL_TYPE,
      name: XAI_LIVE_SEARCH_TOOL_NAME,
      max_search_results: 10,
      from_date: "2024-01-01",
      return_citations: true,
    } satisfies XAILiveSearchTool);
  });

  test("creates a tool with default options", async () => {
    const tool = xaiLiveSearch();
    expect(tool).toMatchObject({
      type: XAI_LIVE_SEARCH_TOOL_TYPE,
      name: XAI_LIVE_SEARCH_TOOL_NAME,
    } satisfies XAILiveSearchTool);
  });

  test("creates a tool with web and news sources using excluded_websites", async () => {
    const tool = xaiLiveSearch({
      sources: [
        {
          type: "web",
          excludedWebsites: ["wikipedia.org"],
        },
        {
          type: "news",
          excludedWebsites: ["bbc.co.uk"],
        },
      ],
    });

    expect(tool).toMatchObject({
      type: XAI_LIVE_SEARCH_TOOL_TYPE,
      name: XAI_LIVE_SEARCH_TOOL_NAME,
      sources: [
        {
          type: "web",
          excluded_websites: ["wikipedia.org"],
        },
        {
          type: "news",
          excluded_websites: ["bbc.co.uk"],
        },
      ],
    } satisfies XAILiveSearchTool);
  });
});

describe("ChatXAI with xaiLiveSearch tool", () => {
  test("formatStructuredToolToXAI preserves provider definition", () => {
    const model = new ChatXAI({ apiKey: "foo" });
    const searchTool = xaiLiveSearch({
      maxSearchResults: 8,
      sources: [
        {
          type: "web",
          allowedWebsites: ["example.com"],
        },
      ],
    });

    // Access protected method for testing
    const formattedTools = model.formatStructuredToolToXAI([searchTool]);

    expect(formattedTools).toHaveLength(1);
    expect(formattedTools![0]).toMatchObject({
      type: XAI_LIVE_SEARCH_TOOL_TYPE,
      name: XAI_LIVE_SEARCH_TOOL_NAME,
      max_search_results: 8,
      sources: [
        {
          type: "web",
          allowed_websites: ["example.com"],
        },
      ],
    } satisfies XAILiveSearchTool);
  });

  test("invocationParams extracts parameters from formatted tools", () => {
    const model = new ChatXAI({ apiKey: "foo" });

    // Simulate the tools being passed in options (as they would be after bindTools -> withConfig -> invoke)
    const tools: [XAILiveSearchTool] = [
      {
        type: XAI_LIVE_SEARCH_TOOL_TYPE,
        name: XAI_LIVE_SEARCH_TOOL_NAME,
        max_search_results: 8,
        sources: [
          {
            type: "web",
            allowed_websites: ["example.com"],
          },
        ],
      },
    ];

    // Access protected method for testing
    const params = model.invocationParams({
      tools: tools,
    });

    expect(params.search_parameters).toEqual({
      mode: "auto",
      max_search_results: 8,
      sources: [
        {
          type: "web",
          allowed_websites: ["example.com"],
        },
      ],
    });
  });

  test("explicit searchParameters override tool parameters", () => {
    const model = new ChatXAI({
      apiKey: "foo",
      searchParameters: {
        mode: "on",
        max_search_results: 5, // This should override the tool's 10
      },
    });

    const tools: [XAILiveSearchTool] = [
      {
        type: XAI_LIVE_SEARCH_TOOL_TYPE,
        name: XAI_LIVE_SEARCH_TOOL_NAME,
        max_search_results: 10,
        from_date: "2024-01-01",
      },
    ];

    const params = model.invocationParams({
      tools: tools,
    });

    expect(params.search_parameters).toEqual({
      mode: "on",
      max_search_results: 5, // Overridden by constructor/option
      from_date: "2024-01-01", // Preserved from a tool
    });
  });
});
