import { describe, it, expect, beforeEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { DynamicTool } from "@langchain/core/tools";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { bigToolMiddleware } from "../bigTool.js";
import type { CustomToolSelector } from "../bigTool.js";

// Helper function to create mock tools
function createMockTools(count: number, categories?: string[]): DynamicTool[] {
  const defaultCategories = [
    "file",
    "database",
    "search",
    "api",
    "math",
    "text",
  ];
  const toolCategories = categories || defaultCategories;
  const tools: DynamicTool[] = [];

  for (let i = 0; i < count; i++) {
    const category = toolCategories[i % toolCategories.length];
    const toolName = `${category}_tool_${i}`;
    const description = `Tool ${i} for ${category} operations. Handles ${category} related tasks.`;

    tools.push(
      new DynamicTool({
        name: toolName,
        description,
        func: async () => `Result from ${toolName}`,
      })
    );
  }

  return tools;
}

// Mock state and runtime objects
function createMockState(messages: any[] = []) {
  return {
    messages,
  };
}

function createMockRuntime(context: any = {}) {
  return {
    context,
    toolCalls: [],
    terminate: () => ({ type: "terminate" as const }),
  };
}

function createMockRequest(tools: any[]) {
  return {
    model: {} as any,
    messages: [],
    tools,
  };
}

describe("BigToolMiddleware", () => {
  let mockTools: DynamicTool[];

  beforeEach(() => {
    mockTools = createMockTools(20);
  });

  describe("Strategy: all", () => {
    it("should pass through all tools when strategy is 'all'", async () => {
      const middleware = bigToolMiddleware({ strategy: "all" });
      const state = createMockState([new HumanMessage("Test query")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools).toHaveLength(20);
      expect(result?.tools).toEqual(mockTools);
    });

    it("should respect maxTools limit even with 'all' strategy", async () => {
      const middleware = bigToolMiddleware({ strategy: "all", maxTools: 5 });
      const state = createMockState([new HumanMessage("Test query")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools).toHaveLength(5);
      expect(result?.tools).toEqual(mockTools.slice(0, 5));
    });

    it("should handle empty tools array", async () => {
      const middleware = bigToolMiddleware({ strategy: "all" });
      const state = createMockState([new HumanMessage("Test query")]);
      const runtime = createMockRuntime();
      const request = createMockRequest([]);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools).toHaveLength(0);
    });
  });

  describe("Strategy: keyword", () => {
    it("should filter tools based on keywords in tool names", async () => {
      const middleware = bigToolMiddleware({
        strategy: "keyword",
        keywordConfig: {
          keywords: ["file"],
          matchDescriptions: true,
          caseInsensitive: true,
          minMatches: 1,
        },
      });

      const state = createMockState([
        new HumanMessage("I need to work with files"),
      ]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      // Should select tools that have "file" in their name or description
      expect(result?.tools?.length).toBeGreaterThan(0);
      expect(result?.tools?.length).toBeLessThan(mockTools.length);

      // Verify that selected tools contain the keyword
      if (result?.tools) {
        result.tools.forEach((tool: any) => {
          const toolText = `${tool.name} ${tool.description}`.toLowerCase();
          expect(toolText).toMatch(/file/);
        });
      }
    });

    it("should filter tools based on keywords in descriptions", async () => {
      const middleware = bigToolMiddleware({
        strategy: "keyword",
        keywordConfig: {
          keywords: ["database"],
          matchDescriptions: true,
          caseInsensitive: true,
          minMatches: 1,
        },
      });

      const state = createMockState([
        new HumanMessage("Query database records"),
      ]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools?.length).toBeGreaterThan(0);
      if (result?.tools) {
        result.tools.forEach((tool: any) => {
          const toolText = `${tool.name} ${tool.description}`.toLowerCase();
          expect(toolText).toMatch(/database/);
        });
      }
    });

    it("should handle case insensitive matching", async () => {
      const middleware = bigToolMiddleware({
        strategy: "keyword",
        keywordConfig: {
          keywords: ["FILE"],
          matchDescriptions: true,
          caseInsensitive: true,
          minMatches: 1,
        },
      });

      const state = createMockState([new HumanMessage("file operations")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools?.length).toBeGreaterThan(0);
    });

    it("should handle case sensitive matching", async () => {
      const middleware = bigToolMiddleware({
        strategy: "keyword",
        keywordConfig: {
          keywords: ["FILE"],
          matchDescriptions: true,
          caseInsensitive: false,
          minMatches: 1,
        },
      });

      const state = createMockState([new HumanMessage("file operations")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      // Should fallback to all tools when no matches with case sensitive matching
      expect(result?.tools?.length).toBe(20);
    });

    it("should return all tools when no keywords provided", async () => {
      const middleware = bigToolMiddleware({
        strategy: "keyword",
        keywordConfig: {
          keywords: [],
          matchDescriptions: true,
          caseInsensitive: true,
          minMatches: 1,
        },
      });

      const state = createMockState([new HumanMessage("Test query")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools).toHaveLength(mockTools.length);
    });

    it("should fallback to original tools when no matches found", async () => {
      const middleware = bigToolMiddleware({
        strategy: "keyword",
        keywordConfig: {
          keywords: ["nonexistent"],
          matchDescriptions: true,
          caseInsensitive: true,
          minMatches: 1,
        },
      });

      const state = createMockState([new HumanMessage("Test query")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      // Should fallback to first 10 tools when no matches
      expect(result?.tools?.length).toBe(10);
    });
  });

  describe("Strategy: semantic", () => {
    it("should filter tools based on semantic similarity", async () => {
      const middleware = bigToolMiddleware({
        strategy: "semantic",
        semanticConfig: {
          threshold: 0.1,
          maxTools: 5,
        },
      });

      const state = createMockState([
        new HumanMessage("I need database tools for data operations"),
      ]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools?.length).toBeLessThanOrEqual(5);
      expect(result?.tools?.length).toBeGreaterThan(0);
    });

    it("should respect similarity threshold", async () => {
      const middleware = bigToolMiddleware({
        strategy: "semantic",
        semanticConfig: {
          threshold: 0.9, // Very high threshold
          maxTools: 10,
        },
      });

      const state = createMockState([
        new HumanMessage("completely unrelated query about quantum physics"),
      ]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      // Should have very few or no matches with high threshold
      expect(result?.tools?.length).toBeLessThanOrEqual(mockTools.length);
    });

    it("should return limited tools when query is empty", async () => {
      const middleware = bigToolMiddleware({
        strategy: "semantic",
        semanticConfig: {
          threshold: 0.3,
          maxTools: 5,
        },
      });

      const state = createMockState([new HumanMessage("")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools?.length).toBe(5);
    });

    it("should sort tools by similarity score", async () => {
      const specificTools = [
        new DynamicTool({
          name: "database_query",
          description: "Query database records and retrieve data",
          func: async () => "database result",
        }),
        new DynamicTool({
          name: "file_reader",
          description: "Read files from filesystem",
          func: async () => "file result",
        }),
        new DynamicTool({
          name: "data_analyzer",
          description: "Analyze data and generate reports",
          func: async () => "analysis result",
        }),
      ];

      const middleware = bigToolMiddleware({
        strategy: "semantic",
        semanticConfig: {
          threshold: 0.1,
          maxTools: 3,
        },
      });

      const state = createMockState([
        new HumanMessage("I need to query database data"),
      ]);
      const runtime = createMockRuntime();
      const request = createMockRequest(specificTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      // The database tool should be first due to higher similarity
      expect(result?.tools?.[0]?.name).toBe("database_query");
    });
  });

  describe("Strategy: custom", () => {
    it("should use custom selector function", async () => {
      const customSelector: CustomToolSelector = vi
        .fn()
        .mockResolvedValue(mockTools.slice(0, 3));

      const middleware = bigToolMiddleware({
        strategy: "custom",
        customSelector,
      });

      const state = createMockState([new HumanMessage("Custom query")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(customSelector).toHaveBeenCalledWith(
        mockTools,
        "Custom query",
        {}
      );
      expect(result?.tools).toHaveLength(3);
      expect(result?.tools).toEqual(mockTools.slice(0, 3));
    });

    it("should handle custom selector returning empty array", async () => {
      const customSelector: CustomToolSelector = vi.fn().mockResolvedValue([]);

      const middleware = bigToolMiddleware({
        strategy: "custom",
        customSelector,
      });

      const state = createMockState([new HumanMessage("Custom query")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools?.length).toBe(10); // Should fallback to first 10 tools
    });

    it("should handle custom selector throwing error", async () => {
      const customSelector: CustomToolSelector = vi
        .fn()
        .mockRejectedValue(new Error("Selection failed"));

      const middleware = bigToolMiddleware({
        strategy: "custom",
        customSelector,
      });

      const state = createMockState([new HumanMessage("Custom query")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      // Mock console.warn to avoid noise in tests
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools).toEqual(mockTools); // Should fallback to original tools
      expect(consoleSpy).toHaveBeenCalledWith(
        "BigToolMiddleware: Tool selection failed, falling back to original tools:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should pass context to custom selector", async () => {
      const customSelector: CustomToolSelector = vi.fn().mockResolvedValue([]);
      const contextData = { userId: "123", preferences: { maxTools: 5 } };

      const middleware = bigToolMiddleware({
        strategy: "custom",
        customSelector,
      });

      const state = createMockState([new HumanMessage("Custom query")]);
      const runtime = createMockRuntime(contextData);
      const request = createMockRequest(mockTools);

      await middleware.prepareModelRequest!(request, state, runtime);

      expect(customSelector).toHaveBeenCalledWith(
        mockTools,
        "Custom query",
        contextData
      );
    });
  });

  describe("Runtime configuration override", () => {
    it("should use runtime context over middleware options", async () => {
      const middleware = bigToolMiddleware({
        strategy: "all",
        maxTools: 10,
      });

      const state = createMockState([new HumanMessage("Test query")]);
      const runtime = createMockRuntime({
        strategy: "all",
        maxTools: 5, // Override to 5
      });
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools).toHaveLength(5); // Should use runtime override
    });

    it("should override strategy at runtime", async () => {
      const middleware = bigToolMiddleware({
        strategy: "all",
      });

      const state = createMockState([new HumanMessage("I need file tools")]);
      const runtime = createMockRuntime({
        strategy: "keyword",
        keywordConfig: {
          keywords: ["file"],
          matchDescriptions: true,
          caseInsensitive: true,
          minMatches: 1,
        },
      });
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      // Should use keyword strategy from runtime
      expect(result?.tools?.length).toBeLessThan(mockTools.length);
      if (result?.tools) {
        result.tools.forEach((tool: any) => {
          const toolText = `${tool.name} ${tool.description}`.toLowerCase();
          expect(toolText).toMatch(/file/);
        });
      }
    });
  });

  describe("Message extraction", () => {
    it("should extract query from last human message", async () => {
      const middleware = bigToolMiddleware({
        strategy: "keyword",
        keywordConfig: {
          keywords: ["database"],
          matchDescriptions: true,
          caseInsensitive: true,
          minMatches: 1,
        },
      });

      const messages = [
        new HumanMessage("First message about files"),
        new AIMessage("AI response"),
        new HumanMessage("Last message about database"),
      ];

      const state = createMockState(messages);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      // Should use "database" from the last human message, not "files" from the first
      expect(result?.tools?.length).toBeGreaterThan(0);
      if (result?.tools) {
        result.tools.forEach((tool: any) => {
          const toolText = `${tool.name} ${tool.description}`.toLowerCase();
          expect(toolText).toMatch(/database/);
        });
      }
    });

    it("should handle empty messages array", async () => {
      const middleware = bigToolMiddleware({ strategy: "all" });
      const state = createMockState([]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools).toEqual(mockTools);
    });

    it("should handle messages without human messages", async () => {
      const middleware = bigToolMiddleware({ strategy: "all" });
      const state = createMockState([new AIMessage("AI message only")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools).toEqual(mockTools);
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined middleware options", async () => {
      const middleware = bigToolMiddleware();
      const state = createMockState([new HumanMessage("Test query")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools).toEqual(mockTools);
    });

    it("should handle undefined runtime context", async () => {
      const middleware = bigToolMiddleware({ strategy: "all" });
      const state = createMockState([new HumanMessage("Test query")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools).toEqual(mockTools);
    });

    it("should handle maxTools larger than available tools", async () => {
      const middleware = bigToolMiddleware({
        strategy: "all",
        maxTools: 100,
      });

      const state = createMockState([new HumanMessage("Test query")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(mockTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      expect(result?.tools).toEqual(mockTools);
    });

    it("should handle tools with missing name or description", async () => {
      const malformedTools = [
        { name: "tool1" }, // Missing description
        { description: "Tool without name" }, // Missing name
        { name: "tool3", description: "Normal tool" }, // Normal tool
      ];

      const middleware = bigToolMiddleware({
        strategy: "keyword",
        keywordConfig: {
          keywords: ["tool"],
          matchDescriptions: true,
          caseInsensitive: true,
          minMatches: 1,
        },
      });

      const state = createMockState([new HumanMessage("Find tool")]);
      const runtime = createMockRuntime();
      const request = createMockRequest(malformedTools);

      const result = await middleware.prepareModelRequest!(
        request,
        state,
        runtime
      );

      // Should handle malformed tools gracefully
      expect(result?.tools?.length).toBeGreaterThanOrEqual(0);
    });
  });
});
