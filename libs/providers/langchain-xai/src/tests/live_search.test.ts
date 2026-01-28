import { describe, expect, test } from "vitest";

import {
  buildSearchParametersPayload,
  filterXAIBuiltInTools,
  mergeSearchParams,
  type XAISearchParameters,
  type XAISearchSource,
} from "../live_search.js";
import { XAI_LIVE_SEARCH_TOOL_TYPE } from "../tools/live_search.js";

describe("mergeSearchParams", () => {
  test("returns undefined when no params are provided", () => {
    expect(mergeSearchParams()).toBeUndefined();
  });

  test("returns instance params when only instance params are provided", () => {
    const instance: XAISearchParameters = {
      mode: "auto",
      max_search_results: 5,
    };

    const result = mergeSearchParams(instance, undefined, undefined);

    expect(result).toEqual(instance);
  });

  test("call-level params override instance-level params", () => {
    const instance: XAISearchParameters = {
      mode: "auto",
      max_search_results: 5,
      return_citations: true,
    };
    const call: XAISearchParameters = {
      mode: "on",
      max_search_results: 10,
    };

    const result = mergeSearchParams(instance, call, undefined);

    expect(result).toEqual({
      mode: "on",
      max_search_results: 10,
      return_citations: true,
    });
  });

  test("instance params override tool params", () => {
    const instance: XAISearchParameters = {
      max_search_results: 5,
    };
    const tool: XAISearchParameters = {
      max_search_results: 10,
      from_date: "2024-01-01",
    };

    const result = mergeSearchParams(instance, undefined, tool);

    expect(result).toEqual({
      max_search_results: 5,
      from_date: "2024-01-01",
    });
  });

  test("applies precedence: tool < instance < call", () => {
    const instance: XAISearchParameters = {
      mode: "auto",
      max_search_results: 5,
      return_citations: true,
    };
    const call: XAISearchParameters = {
      mode: "on",
      max_search_results: 10,
    };
    const tool: XAISearchParameters = {
      mode: "off",
      from_date: "2024-01-01",
      to_date: "2024-01-31",
    };

    const result = mergeSearchParams(instance, call, tool);

    expect(result).toEqual({
      // from tool
      from_date: "2024-01-01",
      to_date: "2024-01-31",
      // overridden by instance / call
      mode: "on",
      max_search_results: 10,
      return_citations: true,
    });
  });
});

describe("buildSearchParametersPayload", () => {
  test("returns undefined when params are undefined", () => {
    expect(buildSearchParametersPayload(undefined)).toBeUndefined();
  });

  test("builds payload with basic fields", () => {
    const params: XAISearchParameters = {
      mode: "on",
      max_search_results: 7,
      from_date: "2024-01-01",
      to_date: "2024-01-31",
      return_citations: false,
    };

    const payload = buildSearchParametersPayload(params);

    expect(payload).toEqual({
      mode: "on",
      max_search_results: 7,
      from_date: "2024-01-01",
      to_date: "2024-01-31",
      return_citations: false,
    });
  });

  test("includes sources only when non-empty", () => {
    const sources: XAISearchSource[] = [
      {
        type: "web",
        allowed_websites: ["x.ai"],
      },
      {
        type: "news",
        excluded_websites: ["example.com"],
      },
    ];

    const withSources = buildSearchParametersPayload({
      mode: "auto",
      sources,
    });

    expect(withSources).toEqual({
      mode: "auto",
      sources,
    });

    const withoutSources = buildSearchParametersPayload({
      mode: "auto",
      sources: [],
    });
    expect(withoutSources).toEqual({
      mode: "auto",
    });
  });
});

describe("filterXAIBuiltInTools", () => {
  test("returns undefined when no tools are provided", () => {
    expect(filterXAIBuiltInTools()).toBeUndefined();
    expect(filterXAIBuiltInTools({})).toBeUndefined();
    expect(filterXAIBuiltInTools({ tools: [] })).toBeUndefined();
  });

  test("returns tools unchanged when no excludedTypes are provided", () => {
    const tools = [{ type: "foo" }, { type: XAI_LIVE_SEARCH_TOOL_TYPE }];

    const result = filterXAIBuiltInTools({ tools });

    expect(result).toEqual(tools);
  });

  test("filters out tools whose type is in excludedTypes", () => {
    const liveSearchTool = { type: XAI_LIVE_SEARCH_TOOL_TYPE, name: "live" };
    const otherTool = { type: "some_other_tool", name: "other" };

    const result = filterXAIBuiltInTools({
      tools: [liveSearchTool, otherTool],
      excludedTypes: [XAI_LIVE_SEARCH_TOOL_TYPE],
    });

    expect(result).toEqual([otherTool]);
  });

  test("keeps tools without a type property", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = [
      { id: 1 }, // no type
      { type: XAI_LIVE_SEARCH_TOOL_TYPE },
    ];

    const result = filterXAIBuiltInTools({
      tools,
      excludedTypes: [XAI_LIVE_SEARCH_TOOL_TYPE],
    });

    // The tool without `type` should be kept, the built-in one should be filtered out
    expect(result).toEqual([{ id: 1 }]);
  });

  test("returns undefined when all tools are filtered out", () => {
    const tools = [{ type: XAI_LIVE_SEARCH_TOOL_TYPE }];

    const result = filterXAIBuiltInTools({
      tools,
      excludedTypes: [XAI_LIVE_SEARCH_TOOL_TYPE],
    });

    expect(result).toBeUndefined();
  });
});
