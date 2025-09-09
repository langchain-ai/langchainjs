import { test, expect, jest, describe } from "@jest/globals";
import { TavilySearch } from "../tavily-search.js";
import {
  TavilySearchAPIWrapper,
  TavilySearchResponse,
  TavilySearchParams,
  TavilySearchParamsWithSimpleImages,
  TavilySearchParamsWithImageDescriptions,
  TavilySearchResponseWithSimpleImages,
  TavilySearchResponseWithImageDescriptions,
} from "../utils.js";

/**
 * A test implementation of TavilySearchAPIWrapper that doesn't need API keys
 */
class TestTavilySearchAPIWrapper extends TavilySearchAPIWrapper {
  constructor() {
    // Pass a dummy key
    super({ tavilyApiKey: "test-key" });

    this.tavilyApiKey = "test-key";
  }

  // Mock the raw results method with the correct overload signatures
  async rawResults(
    params: TavilySearchParamsWithSimpleImages
  ): Promise<TavilySearchResponseWithSimpleImages>;

  async rawResults(
    params: TavilySearchParamsWithImageDescriptions
  ): Promise<TavilySearchResponseWithImageDescriptions>;

  async rawResults(params: TavilySearchParams): Promise<TavilySearchResponse> {
    // This is overridden by mockImplementation in each test
    return {
      query: params.query,
      results: [],
      response_time: 0,
    };
  }
}

describe("TavilySearch", () => {
  test("initializes with custom parameters", () => {
    const mockWrapper = new TestTavilySearchAPIWrapper();
    const tool = new TavilySearch({
      apiWrapper: mockWrapper,
      name: "custom_search",
      description: "Custom description",
      searchDepth: "advanced",
      includeImages: true,
      maxResults: 10,
      topic: "news",
      includeAnswer: true,
      includeRawContent: true,
      includeImageDescriptions: true,
      includeDomains: ["example.com"],
      excludeDomains: ["exclude.com"],
      timeRange: "day",
    });

    expect(tool.name).toBe("custom_search");
    expect(tool.description).toBe("Custom description");
    expect(tool.searchDepth).toBe("advanced");
    expect(tool.includeImages).toBe(true);
    expect(tool.maxResults).toBe(10);
    expect(tool.topic).toBe("news");
    expect(tool.includeAnswer).toBe(true);
    expect(tool.includeRawContent).toBe(true);
    expect(tool.includeImageDescriptions).toBe(true);
    expect(tool.includeDomains).toEqual(["example.com"]);
    expect(tool.excludeDomains).toEqual(["exclude.com"]);
    expect(tool.timeRange).toBe("day");
  });

  test("initializes with custom apiWrapper", () => {
    const mockWrapper = new TestTavilySearchAPIWrapper();
    const tool = new TavilySearch({ apiWrapper: mockWrapper });

    // Using a type assertion to access the property
    expect(
      (tool as unknown as { apiWrapper: TestTavilySearchAPIWrapper }).apiWrapper
    ).toBe(mockWrapper);
  });

  test("successfully performs a search", async () => {
    const mockResult: TavilySearchResponse = {
      query: "test query",
      results: [
        {
          title: "Test Result",
          url: "https://example.com",
          content: "Example content",
          score: 0.95,
          raw_content: null,
        },
      ],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilySearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilySearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      query: "test query",
    });

    // The schema auto-defaults empty arrays
    expect(mockWrapper.rawResults).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "test query",
      })
    );

    expect(result).toEqual(mockResult);
  });

  test("respects input parameters", async () => {
    const mockResult: TavilySearchResponse = {
      query: "test query",
      results: [
        {
          title: "Test Result",
          url: "https://example.com",
          content: "Example content",
          score: 0.95,
          raw_content: null,
        },
      ],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilySearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilySearch({ apiWrapper: mockWrapper });
    await tool.invoke({
      query: "test query",
      includeDomains: ["example.com"],
      excludeDomains: ["exclude.com"],
      searchDepth: "advanced",
      includeImages: true,
      timeRange: "week",
      topic: "news",
    });

    expect(mockWrapper.rawResults).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "test query",
        includeDomains: ["example.com"],
        excludeDomains: ["exclude.com"],
        searchDepth: "advanced",
        includeImages: true,
        timeRange: "week",
        topic: "news",
      })
    );
  });

  test("uses default parameters when not provided in input", async () => {
    const mockResult: TavilySearchResponse = {
      query: "test query",
      results: [
        {
          title: "Test Result",
          url: "https://example.com",
          content: "Example content",
          score: 0.95,
          raw_content: null,
        },
      ],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilySearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    // Create a tool with custom defaults
    const tool = new TavilySearch({
      apiWrapper: mockWrapper,
      searchDepth: "advanced",
      includeImages: true,
      maxResults: 10,
      topic: "finance",
      includeAnswer: true,
      includeRawContent: true,
    });

    await tool.invoke({
      query: "test query",
    });

    // We expect the constructor defaults to be respected
    expect(mockWrapper.rawResults).toHaveBeenCalledWith({
      query: "test query",
      searchDepth: "advanced",
      includeImages: true,
      topic: "finance",
      maxResults: 10,
      includeAnswer: true,
      includeRawContent: true,
    });
  });

  test("handles API errors", async () => {
    const mockWrapper = new TestTavilySearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.reject(new Error("API error"))
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilySearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      query: "test query",
    });

    expect(result).toEqual({ error: "API error" });
  });

  test("handles empty results", async () => {
    const mockResult: TavilySearchResponse = {
      query: "test query",
      results: [],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilySearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilySearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      query: "test query",
    });

    expect(result).toEqual({
      error: expect.stringContaining(
        "No search results found for 'test query'"
      ),
    });
  });

  test("generates suggestions when search fails", async () => {
    const mockResult: TavilySearchResponse = {
      query: "test query",
      results: [],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilySearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilySearch({
      apiWrapper: mockWrapper,
      searchDepth: "basic",
      timeRange: "day",
      includeDomains: ["example.com"],
    });

    const result = await tool.invoke({
      query: "test query",
    });

    // Verify that the error message contains the expected suggestions
    expect(result).toEqual({
      error: expect.stringContaining("Remove time_range argument"),
    });
    expect(result).toEqual({
      error: expect.stringContaining(
        "Try a more detailed search using 'advanced' search_depth"
      ),
    });
  });

  test("handles non-standard errors", async () => {
    const mockWrapper = new TestTavilySearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.reject(new Error("String error without message property"))
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilySearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      query: "test query",
    });

    expect(result).toEqual({
      error: "String error without message property",
    });
  });

  test("converts camelCase parameters to snake_case in API requests", async () => {
    // Mock fetch to intercept the actual API request
    const originalFetch = global.fetch;
    const mockFetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            query: "test query",
            results: [],
            response_time: 0.5,
          }),
      } as Response)
    );
    global.fetch = mockFetch as typeof fetch;

    try {
      // Create a wrapper with test API key
      const wrapper = new TavilySearchAPIWrapper({ tavilyApiKey: "test-key" });

      // Call with camelCase parameters
      await wrapper.rawResults({
        query: "test query",
        includeDomains: ["example.com"],
        searchDepth: "advanced",
        includeImages: true,
        timeRange: "week",
      });

      // Verify the parameters in the request body
      expect(mockFetch).toHaveBeenCalled();

      // Get the body from the mock call
      const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
      const bodyString = requestInit.body as string;
      const requestBody = JSON.parse(bodyString);

      // Check that parameters were converted to snake_case
      expect(requestBody.include_domains).toEqual(["example.com"]);
      expect(requestBody.search_depth).toBe("advanced");
      expect(requestBody.include_images).toBe(true);
      expect(requestBody.time_range).toBe("week");

      // Original camelCase keys should not be present
      expect(requestBody.includeDomains).toBeUndefined();
      expect(requestBody.searchDepth).toBeUndefined();
      expect(requestBody.includeImages).toBeUndefined();
      expect(requestBody.timeRange).toBeUndefined();
    } finally {
      // Restore original fetch
      global.fetch = originalFetch;
    }
  });
});
