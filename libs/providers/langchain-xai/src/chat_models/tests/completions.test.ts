import { test, expect, beforeEach, describe } from "vitest";
import {
  ChatXAI,
  isXAIBuiltInTool,
  type ChatXAICompletionsInvocationParams,
} from "../index.js";
import { XAISearchParameters } from "../../live_search.js";
import {
  XAI_LIVE_SEARCH_TOOL_NAME,
  XAI_LIVE_SEARCH_TOOL_TYPE,
  XAILiveSearchTool,
} from "../../tools/live_search.js";

beforeEach(() => {
  process.env.XAI_API_KEY = "foo";
});

test("Serialization", () => {
  delete process.env.XAI_API_KEY;
  const model = new ChatXAI({
    model: "grok-2-1212",
    apiKey: "bar",
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","xai","ChatXAI"],"kwargs":{"model":"grok-2-1212"}}`
  );
});

test("Serialization with no params", () => {
  const model = new ChatXAI();
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","xai","ChatXAI"],"kwargs":{"model":"grok-beta"}}`
  );
});

describe("Server Tool Calling", () => {
  describe("isXAIBuiltInTool", () => {
    test("should identify live_search as a built-in tool", () => {
      const liveSearchTool: XAILiveSearchTool = {
        name: XAI_LIVE_SEARCH_TOOL_NAME,
        type: XAI_LIVE_SEARCH_TOOL_TYPE,
      };
      expect(isXAIBuiltInTool(liveSearchTool)).toBe(true);
    });

    test("should not identify function tools as built-in", () => {
      const functionTool = {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get the weather",
          parameters: { type: "object", properties: {} },
        },
      };
      expect(isXAIBuiltInTool(functionTool)).toBe(false);
    });

    test("should not identify invalid objects as built-in", () => {
      expect(isXAIBuiltInTool(null as unknown as XAILiveSearchTool)).toBe(
        false
      );
      expect(isXAIBuiltInTool(undefined as unknown as XAILiveSearchTool)).toBe(
        false
      );
      expect(isXAIBuiltInTool({} as unknown as XAILiveSearchTool)).toBe(false);
      expect(
        isXAIBuiltInTool({ type: "other" } as unknown as XAILiveSearchTool)
      ).toBe(false);
    });
  });

  describe("ChatXAI with searchParameters", () => {
    test("should store searchParameters from constructor", () => {
      const searchParams: XAISearchParameters = {
        mode: "auto",
        max_search_results: 5,
      };
      const model = new ChatXAI({
        searchParameters: searchParams,
      });
      expect(model.searchParameters).toEqual(searchParams);
    });

    test("should have undefined searchParameters by default", () => {
      const model = new ChatXAI();
      expect(model.searchParameters).toBeUndefined();
    });

    test("should merge search parameters correctly", () => {
      const model = new ChatXAI({
        searchParameters: {
          mode: "auto",
          max_search_results: 5,
        },
      });

      // Access protected method via any cast for testing
      // eslint-disable-next-line dot-notation
      const effectiveParams = model["_getEffectiveSearchParameters"]({
        searchParameters: {
          max_search_results: 10,
          from_date: "2024-01-01",
        },
      });

      expect(effectiveParams).toEqual({
        mode: "auto",
        max_search_results: 10,
        from_date: "2024-01-01",
      });
    });
  });

  describe("invocationParams with server tools", () => {
    test("should add search_parameters when live_search tool is bound", () => {
      const model = new ChatXAI();

      const params: ChatXAICompletionsInvocationParams = model.invocationParams(
        {
          tools: [
            {
              type: XAI_LIVE_SEARCH_TOOL_TYPE,
              name: XAI_LIVE_SEARCH_TOOL_NAME,
            },
          ] satisfies [XAILiveSearchTool],
        } as unknown as ChatXAI["ParsedCallOptions"]
      );

      expect(params.search_parameters).toBeDefined();
      expect(params.search_parameters?.mode).toBe("auto");
    });

    test("should add search_parameters from call options", () => {
      const model = new ChatXAI();

      const params: ChatXAICompletionsInvocationParams = model.invocationParams(
        {
          searchParameters: {
            mode: "on",
            max_search_results: 10,
            from_date: "2024-01-01",
          },
        } as unknown as ChatXAI["ParsedCallOptions"]
      );

      expect(params.search_parameters).toEqual({
        mode: "on",
        max_search_results: 10,
        from_date: "2024-01-01",
      });
    });

    test("should include sources in search_parameters when provided", () => {
      const model = new ChatXAI();

      const params: ChatXAICompletionsInvocationParams = model.invocationParams(
        {
          searchParameters: {
            mode: "on",
            sources: [
              {
                type: "web",
                allowed_websites: ["x.ai"],
              },
              {
                type: "news",
                excluded_websites: ["bbc.co.uk"],
              },
              {
                type: "x",
                included_x_handles: ["xai"],
              },
              {
                type: "rss",
                links: ["https://example.com/feed.rss"],
              },
            ],
          },
        } as unknown as ChatXAI["ParsedCallOptions"]
      );

      expect(params.search_parameters).toBeDefined();
      expect(params.search_parameters?.sources).toEqual([
        {
          type: "web",
          allowed_websites: ["x.ai"],
        },
        {
          type: "news",
          excluded_websites: ["bbc.co.uk"],
        },
        {
          type: "x",
          included_x_handles: ["xai"],
        },
        {
          type: "rss",
          links: ["https://example.com/feed.rss"],
        },
      ]);
    });

    test("should omit sources field when none are configured", () => {
      const model = new ChatXAI();

      const params: ChatXAICompletionsInvocationParams = model.invocationParams(
        {
          searchParameters: {
            mode: "auto",
          },
        } as unknown as ChatXAI["ParsedCallOptions"]
      );

      expect(params.search_parameters).toEqual({
        mode: "auto",
      });
      expect(
        Object.prototype.hasOwnProperty.call(
          params.search_parameters as NonNullable<
            ChatXAICompletionsInvocationParams["search_parameters"]
          >,
          "sources"
        )
      ).toBe(false);
    });

    test("should merge instance and call option search parameters", () => {
      const model = new ChatXAI({
        searchParameters: {
          mode: "auto",
          max_search_results: 5,
          return_citations: true,
        },
      });

      const params: ChatXAICompletionsInvocationParams = model.invocationParams(
        {
          searchParameters: {
            max_search_results: 10,
          },
        } as unknown as ChatXAI["ParsedCallOptions"]
      );

      expect(params.search_parameters).toEqual({
        mode: "auto",
        max_search_results: 10,
        return_citations: true,
      });
    });

    test("should not add search_parameters when no search config is present", () => {
      const model = new ChatXAI();

      const params: ChatXAICompletionsInvocationParams = model.invocationParams(
        {} as ChatXAI["ParsedCallOptions"]
      );

      expect(params.search_parameters).toBeUndefined();
    });
  });

  describe("_hasBuiltInTools", () => {
    test("should return true when live_search tool is present", () => {
      const model = new ChatXAI();
      // eslint-disable-next-line dot-notation
      const result = model["_hasBuiltInTools"]([
        {
          type: XAI_LIVE_SEARCH_TOOL_TYPE,
          name: XAI_LIVE_SEARCH_TOOL_NAME,
        } satisfies XAILiveSearchTool,
        {
          type: "function",
          function: { name: "test", parameters: {} },
        },
      ]);
      expect(result).toBe(true);
    });

    test("should return false when no built-in tools are present", () => {
      const model = new ChatXAI();
      // eslint-disable-next-line dot-notation
      const result = model["_hasBuiltInTools"]([
        {
          type: "function",
          function: { name: "test", parameters: {} },
        },
      ]);
      expect(result).toBe(false);
    });

    test("should return false for undefined or empty tools", () => {
      const model = new ChatXAI();
      // eslint-disable-next-line dot-notation
      expect(model["_hasBuiltInTools"](undefined)).toBe(false);
      // eslint-disable-next-line dot-notation
      expect(model["_hasBuiltInTools"]([])).toBe(false);
    });
  });
});
