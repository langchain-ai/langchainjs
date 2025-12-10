import { test, expect, vi, describe } from "vitest";
import { TavilyResearch } from "../tavily-research.js";
import {
  TavilyResearchAPIWrapper,
  TavilyResearchQueueResponse,
  TavilyResearchParams,
} from "../utils.js";

/**
 * A test implementation of TavilyResearchAPIWrapper that doesn't need API keys
 */
class TestTavilyResearchAPIWrapper extends TavilyResearchAPIWrapper {
  constructor() {
    // Pass a dummy key
    super({ tavilyApiKey: "test-key" });

    this.tavilyApiKey = "test-key";
  }

  // Mock the raw results method to return what we want
  async rawResults(
    params: TavilyResearchParams
  ): Promise<
    TavilyResearchQueueResponse | AsyncGenerator<Buffer, void, unknown>
  > {
    // This is overridden by mockImplementation in each test
    return {
      request_id: "test-request-id",
      created_at: "2024-01-01T00:00:00Z",
      status: "pending",
      input: params.input || "test input",
      model: params.model || "auto",
      response_time: 0,
    };
  }
}

describe("TavilyResearch", () => {
  test("initializes with custom parameters", () => {
    const mockWrapper = new TestTavilyResearchAPIWrapper();
    const tool = new TavilyResearch({
      apiWrapper: mockWrapper,
      name: "custom_research",
      description: "Custom description",
      model: "pro",
      outputSchema: {
        type: "object",
        properties: {
          company: { type: "string", description: "The name of the company" },
        },
      },
      stream: true,
      citationFormat: "apa",
    });

    expect(tool.name).toBe("custom_research");
    expect(tool.description).toBe("Custom description");
    expect(tool.model).toBe("pro");
    expect(tool.outputSchema).toEqual({
      type: "object",
      properties: {
        company: { type: "string", description: "The name of the company" },
      },
    });
    expect(tool.enableStream).toBe(true);
    expect(tool.citationFormat).toBe("apa");
  });

  test("initializes with custom apiWrapper", () => {
    const mockWrapper = new TestTavilyResearchAPIWrapper();
    const tool = new TavilyResearch({ apiWrapper: mockWrapper });

    // Using a type assertion to access the private property
    expect(
      (tool as unknown as { apiWrapper: TestTavilyResearchAPIWrapper })
        .apiWrapper
    ).toBe(mockWrapper);
  });

  test("successfully performs research (non-streaming)", async () => {
    const mockResult: TavilyResearchQueueResponse = {
      request_id: "test-request-id",
      created_at: "2024-01-01T00:00:00Z",
      status: "pending",
      input: "What is the capital of France?",
      model: "auto",
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyResearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      input: "What is the capital of France?",
    });

    expect(mockWrapper.rawResults).toHaveBeenCalledWith(
      expect.objectContaining({
        input: "What is the capital of France?",
        model: "auto",
        stream: false,
        citationFormat: "numbered",
      })
    );

    expect(result).toEqual(mockResult);
  });

  test("successfully performs research (streaming)", async () => {
    const mockChunks = [
      Buffer.from("Chunk 1"),
      Buffer.from("Chunk 2"),
      Buffer.from("Chunk 3"),
    ];

    async function* mockStreamGenerator() {
      for (const chunk of mockChunks) {
        yield chunk;
      }
    }

    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockStreamGenerator())
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyResearch({
      apiWrapper: mockWrapper,
      stream: true,
    });
    const result = await tool.invoke({
      input: "What is the capital of France?",
      stream: true,
    });

    expect(mockWrapper.rawResults).toHaveBeenCalledWith(
      expect.objectContaining({
        input: "What is the capital of France?",
        stream: true,
      })
    );

    // Verify it returns an async generator
    expect(result).toBeDefined();
    expect(
      typeof (result as AsyncGenerator<Buffer, void, unknown>)[
        Symbol.asyncIterator
      ]
    ).toBe("function");

    // Consume the stream and verify chunks
    const chunks: Buffer[] = [];
    for await (const chunk of result as AsyncGenerator<Buffer, void, unknown>) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(mockChunks);
  });

  test("respects input parameters", async () => {
    const mockResult: TavilyResearchQueueResponse = {
      request_id: "test-request-id",
      created_at: "2024-01-01T00:00:00Z",
      status: "pending",
      input: "Test research question",
      model: "pro",
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyResearch({ apiWrapper: mockWrapper });
    await tool.invoke({
      input: "Test research question",
      model: "pro",
      outputSchema: {
        type: "object",
        properties: {
          company: { type: "string", description: "The name of the company" },
        },
      },
      citationFormat: "mla",
    });

    expect(mockWrapper.rawResults).toHaveBeenCalledWith(
      expect.objectContaining({
        input: "Test research question",
        model: "pro",
        outputSchema: expect.objectContaining({
          properties: {
            company: expect.objectContaining({
              type: "string",
              description: "The name of the company",
            }),
          },
        }),
        citationFormat: "mla",
        stream: false,
      })
    );
  });

  test("uses default parameters when not provided in input", async () => {
    const mockResult: TavilyResearchQueueResponse = {
      request_id: "test-request-id",
      created_at: "2024-01-01T00:00:00Z",
      status: "pending",
      input: "Test research question",
      model: "mini",
      response_time: 0.5,
    };

    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockResult)
      ) as typeof mockWrapper.rawResults;

    // Create a tool with custom defaults
    const tool = new TavilyResearch({
      apiWrapper: mockWrapper,
      model: "mini",
      citationFormat: "chicago",
      stream: false,
    });

    await tool.invoke({
      input: "Test research question",
    });

    // We expect the constructor defaults to be respected
    expect(mockWrapper.rawResults).toHaveBeenCalledWith({
      input: "Test research question",
      model: "mini",
      citationFormat: "chicago",
      stream: false,
    });
  });

  test("handles API errors", async () => {
    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = vi
      .fn()
      .mockImplementation(() =>
        Promise.reject(new Error("API error"))
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyResearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      input: "Test research question",
    });

    expect(result).toEqual({ error: "API error" });
  });

  test("handles invalid response (non-streaming)", async () => {
    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the rawResults method to return invalid response
    mockWrapper.rawResults = vi.fn().mockImplementation(() =>
      Promise.resolve({
        invalid: "response",
      } as unknown as TavilyResearchQueueResponse)
    ) as typeof mockWrapper.rawResults;

    const tool = new TavilyResearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      input: "Test research question",
    });

    expect(result).toEqual({
      error: expect.stringContaining(
        "Invalid research queue response for 'Test research question'"
      ),
    });
  });

  test("handles non-standard errors", async () => {
    const mockWrapper = new TestTavilyResearchAPIWrapper();
    // Override the rawResults method for this test
    mockWrapper.rawResults = vi
      .fn()
      .mockImplementation(() =>
        Promise.reject(new Error("String error without message property"))
      ) as typeof mockWrapper.rawResults;

    const tool = new TavilyResearch({ apiWrapper: mockWrapper });
    const result = await tool.invoke({
      input: "Test research question",
    });

    expect(result).toEqual({
      error: "String error without message property",
    });
  });

  test("converts camelCase parameters to snake_case in API requests", async () => {
    // Mock fetch to intercept the actual API request
    const originalFetch = global.fetch;
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            request_id: "test-request-id",
            created_at: "2024-01-01T00:00:00Z",
            status: "pending",
            input: "test input",
            model: "auto",
            response_time: 0.5,
          }),
      } as Response)
    );
    global.fetch = mockFetch as typeof fetch;

    try {
      // Create a wrapper with test API key
      const wrapper = new TavilyResearchAPIWrapper({
        tavilyApiKey: "test-key",
      });

      // Call with camelCase parameters
      await wrapper.rawResults({
        input: "test input",
        model: "pro",
        citationFormat: "apa",
      });

      // Verify the parameters in the request body
      expect(mockFetch).toHaveBeenCalled();

      // Get the body from the mock call
      const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
      const bodyString = requestInit.body as string;
      const requestBody = JSON.parse(bodyString);

      // Check that parameters were converted to snake_case
      expect(requestBody.citation_format).toBe("apa");

      // Original camelCase keys should not be present
      expect(requestBody.citationFormat).toBeUndefined();
    } finally {
      // Restore original fetch
      global.fetch = originalFetch;
    }
  });
});
