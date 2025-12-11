import { test, expect, describe } from "vitest";
import { xaiLiveSearch } from "../live_search.js";
import { ChatXAI } from "../../chat_models.js";

describe("xaiLiveSearch tool", () => {
  test("creates a tool with correct provider definition", async () => {
    const tool = xaiLiveSearch({
      maxSearchResults: 10,
      fromDate: "2024-01-01",
      returnCitations: true,
    });

    expect(tool.name).toBe("live_search");
    expect(tool.extras).toBeDefined();
    expect(tool.extras?.providerToolDefinition).toEqual({
      type: "live_search",
      max_search_results: 10,
      from_date: "2024-01-01",
      return_citations: true,
    });
  });

  test("creates a tool with default options", async () => {
    const tool = xaiLiveSearch();
    expect(tool.name).toBe("live_search");
    expect(tool.extras?.providerToolDefinition).toEqual({
      type: "live_search",
    });
  });

  test("creates a tool with web and news sources using excluded_websites", async () => {
    const tool = xaiLiveSearch({
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
    });

    expect(tool.name).toBe("live_search");
    expect(tool.extras?.providerToolDefinition).toEqual({
      type: "live_search",
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
    });
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
          allowed_websites: ["example.com"],
        },
      ],
    });

    // Access protected method for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedTools = (model as any).formatStructuredToolToXAI([
      searchTool,
    ]);

    expect(formattedTools).toHaveLength(1);
    expect(formattedTools[0]).toEqual({
      type: "live_search",
      max_search_results: 8,
      sources: [
        {
          type: "web",
          allowed_websites: ["example.com"],
        },
      ],
    });
  });

  test("invocationParams extracts parameters from formatted tools", () => {
    const model = new ChatXAI({ apiKey: "foo" });

    // Simulate the tools being passed in options (as they would be after bindTools -> withConfig -> invoke)
    const tools = [
      {
        type: "live_search",
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
      tools: tools as never,
    } as never);

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

    const tools = [
      {
        type: "live_search",
        max_search_results: 10,
        from_date: "2024-01-01",
      },
    ];

    const params = model.invocationParams({
      tools: tools as never,
    } as never);

    expect(params.search_parameters).toEqual({
      mode: "on",
      max_search_results: 5, // Overridden by constructor/option
      from_date: "2024-01-01", // Preserved from a tool
    });
  });
});
