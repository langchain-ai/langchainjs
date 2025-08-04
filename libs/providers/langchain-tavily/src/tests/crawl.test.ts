import { test, expect, jest, describe } from "@jest/globals";
import { TavilyCrawl } from "../tavily-crawl.js";
import {
  TavilyCrawlAPIWrapper,
  TavilyCrawlResponse,
  TavilyCrawlParams,
} from "../utils.js";

/**
 * A test implementation of TavilySearchAPIWrapper that doesn't need API keys
 */
class TestTavilyCrawlAPIWrapper extends TavilyCrawlAPIWrapper {
  constructor() {
    // Pass a dummy key
    super({ tavilyApiKey: "test-key" });

    this.tavilyApiKey = "test-key";
  }

  // Mock the raw results method with the correct overload signatures
  async rawResults(params: TavilyCrawlParams): Promise<TavilyCrawlResponse> {
    // This is overridden by mockImplementation in each test
    return {
      base_url: params.url,
      results: [],
      response_time: 0,
    };
  }
}

describe("TavilyCrawl", () => {
  test("initializes with custom parameters", () => {
    const mockWrapper = new TestTavilyCrawlAPIWrapper();
    const tool = new TavilyCrawl({
      apiWrapper: mockWrapper,
      name: "custom_crawl",
      description: "Custom description",
      extractDepth: "advanced",
      includeImages: true,
      maxDepth: 10,
      maxBreadth: 20,
      limit: 100,
      allowExternal: true,
      categories: ["Documentation"],
      selectPaths: ["example.com"],
      selectDomains: ["exclude.com"],
      excludePaths: ["exclude.com"],
      excludeDomains: ["exclude.com"],
      includeFavicon: true,
    });

    expect(tool.name).toBe("custom_crawl");
    expect(tool.description).toBe("Custom description");
    expect(tool.extractDepth).toBe("advanced");
    expect(tool.includeImages).toBe(true);
    expect(tool.maxDepth).toBe(10);
    expect(tool.maxBreadth).toBe(20);
    expect(tool.limit).toBe(100);
    expect(tool.allowExternal).toBe(true);
    expect(tool.categories).toEqual(["Documentation"]);
    expect(tool.selectPaths).toEqual(["example.com"]);
    expect(tool.selectDomains).toEqual(["exclude.com"]);
    expect(tool.excludePaths).toEqual(["exclude.com"]);
    expect(tool.excludeDomains).toEqual(["exclude.com"]);
    expect(tool.includeFavicon).toBe(true);
  });

  test("initializes with custom apiWrapper", () => {
    const mockWrapper = new TestTavilyCrawlAPIWrapper();
    const tool = new TavilyCrawl({ apiWrapper: mockWrapper });

    // Using a type assertion to access the property
    expect(
      (tool as unknown as { apiWrapper: TestTavilyCrawlAPIWrapper }).apiWrapper
    ).toBe(mockWrapper);
  });

  test("successfully performs a crawl", async () => {
    const mockResult: TavilyCrawlResponse = {
      base_url: "https://example.com",
      results: [
        {
          url: "https://example.com",
          raw_content: "Example content",
          images: [],
        },
      ],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyCrawlAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyCrawl({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      url: "https://example.com",
    });

    // The schema auto-defaults empty arrays
    expect(mockWrapper.rawResults).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com",
      })
    );

    expect(result).toEqual(mockResult);
  });

  test("respects input parameters", async () => {
    const mockResult: TavilyCrawlResponse = {
      base_url: "https://example.com",
      results: [
        {
          url: "https://example.com",
          raw_content: "Example content",
          images: [],
        },
      ],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyCrawlAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyCrawl({ apiWrapper: mockWrapper });
    await tool.invoke({
      url: "https://example.com",
      allowExternal: true,
      categories: ["Documentation"],
    });

    expect(mockWrapper.rawResults).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com",
        allowExternal: true,
        categories: ["Documentation"],
      })
    );
  });

  test("uses default parameters when not provided in input", async () => {
    const mockResult: TavilyCrawlResponse = {
      base_url: "https://example.com",
      results: [
        {
          url: "https://example.com",
          raw_content: "Example content",
          images: [],
        },
      ],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyCrawlAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    // Create a tool with custom defaults
    const tool = new TavilyCrawl({
      apiWrapper: mockWrapper,
      extractDepth: "advanced",
      includeImages: true,
      format: "markdown",
    });

    await tool.invoke({
      url: "https://example.com",
    });

    // We expect the constructor defaults to be respected
    expect(mockWrapper.rawResults).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com",
        extractDepth: "advanced",
        includeImages: true,
        format: "markdown",
      })
    );
  });

  test("handles API errors", async () => {
    const mockWrapper = new TestTavilyCrawlAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.reject(new Error("API error"))
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyCrawl({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      url: "https://example.com",
    });

    expect(result).toEqual({ error: "API error" });
  });

  test("handles empty results", async () => {
    const mockResult: TavilyCrawlResponse = {
      base_url: "https://example.com",
      results: [],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyCrawlAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyCrawl({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      url: "https://example.com",
    });

    expect(result).toEqual({
      error: expect.stringContaining(
        "No crawl results found for 'https://example.com'"
      ),
    });
  });

  test("generates suggestions when search fails", async () => {
    const mockResult: TavilyCrawlResponse = {
      base_url: "https://example.com",
      results: [],
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyCrawlAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyCrawl({
      apiWrapper: mockWrapper,
      extractDepth: "basic",
    });

    const result = await tool.invoke({
      url: "https://example.com",
    });

    // Verify that the error message contains the expected suggestions
    expect(result).toEqual({
      error: expect.stringContaining(
        "Try adding specific path filters using selectPaths"
      ),
    });
    expect(result).toEqual({
      error: expect.stringContaining(
        "Try adding domain filters using selectDomains"
      ),
    });
    expect(result).toEqual({
      error: expect.stringContaining(
        "Try excluding specific domains using excludeDomains"
      ),
    });
  });

  test("handles non-standard errors", async () => {
    const mockWrapper = new TestTavilyCrawlAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = jest
      .fn()
      .mockImplementation(() =>
        Promise.reject(new Error("String error without message property"))
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyCrawl({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      url: "https://example.com",
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
            base_url: "https://example.com",
            results: [],
            response_time: 0.5,
          }),
      } as Response)
    );
    global.fetch = mockFetch as typeof fetch;

    try {
      // Create a wrapper with test API key
      const wrapper = new TavilyCrawlAPIWrapper({ tavilyApiKey: "test-key" });

      // Call with camelCase parameters
      await wrapper.rawResults({
        url: "https://example.com",
        extractDepth: "advanced",
        includeImages: true,
        maxDepth: 3,
        maxBreadth: 20,
      });

      // Verify the parameters in the request body
      expect(mockFetch).toHaveBeenCalled();

      // Get the body from the mock call
      const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
      const bodyString = requestInit.body as string;
      const requestBody = JSON.parse(bodyString);

      // Check that parameters were converted to snake_case
      expect(requestBody.extract_depth).toEqual("advanced");
      expect(requestBody.include_images).toBe(true);
      expect(requestBody.max_depth).toBe(3);
      expect(requestBody.max_breadth).toBe(20);

      // Original camelCase keys should not be present
      expect(requestBody.extractDepth).toBeUndefined();
      expect(requestBody.includeImages).toBeUndefined();
      expect(requestBody.maxDepth).toBeUndefined();
      expect(requestBody.maxBreadth).toBeUndefined();
    } finally {
      // Restore original fetch
      global.fetch = originalFetch;
    }
  });
});
