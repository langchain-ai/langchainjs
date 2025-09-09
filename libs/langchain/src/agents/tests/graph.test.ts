import { describe, it, expect } from "vitest";
import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";
import type { InteropZodType } from "@langchain/core/utils/types";

import { createAgent } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";

// Mock tools
const tool1 = tool(
  async (input) => {
    return `Tool 1 result for: ${input.query}`;
  },
  {
    name: "tool1",
    description: "First test tool",
    schema: z.object({
      query: z.string().describe("The query to process"),
    }),
  }
);

const tool2 = tool(
  async (input) => {
    return `Tool 2 result for: ${input.number}`;
  },
  {
    name: "tool2",
    description: "Second test tool",
    schema: z.object({
      number: z.number().describe("The number to process"),
    }),
  }
);

// Mock hooks
const preModelHook = (state: any) => {
  // Simple pre-model hook that adds a system message
  const systemMessage = {
    role: "system" as const,
    content: "Pre-model hook was called",
  };
  return {
    messages: [systemMessage, ...state.messages],
  };
};

const postModelHook = (state: any) => {
  // Simple post-model hook that logs
  console.log("Post-model hook called");
  return state;
};

// Response format schema
const ResponseFormatSchema = z.object({
  answer: z.string().describe("The final answer"),
  confidence: z.number().describe("Confidence score"),
});

describe("Graph", () => {
  const llm = new FakeToolCallingModel({
    toolCalls: [[{ id: "call_1", name: "tool1", args: { query: "test" } }]],
  });

  describe("React Agent Graph Structure", () => {
    // Test cases configuration
    const testCases = [
      // No tools cases
      {
        tools: [],
        name: "no_tools_no_hooks_no_format",
      },
      {
        tools: [],
        preModelHook,
        name: "no_tools_with_pre_hook_no_format",
      },
      {
        tools: [],
        postModelHook,
        name: "no_tools_with_post_hook_no_format",
      },
      {
        tools: [],
        preModelHook,
        postModelHook,
        name: "no_tools_with_both_hooks_no_format",
      },
      {
        tools: [],
        responseFormat: ResponseFormatSchema,
        name: "no_tools_no_hooks_with_format",
      },
      {
        tools: [],
        preModelHook,
        responseFormat: ResponseFormatSchema,
        name: "no_tools_with_pre_hook_with_format",
      },
      {
        tools: [],
        postModelHook,
        responseFormat: ResponseFormatSchema,
        name: "no_tools_with_post_hook_with_format",
      },
      {
        tools: [],
        preModelHook,
        postModelHook,
        responseFormat: ResponseFormatSchema,
        name: "no_tools_with_both_hooks_with_format",
      },

      // Two tools cases
      {
        tools: [tool1, tool2],
        name: "two_tools_no_hooks_no_format",
      },
      {
        tools: [tool1, tool2],
        preModelHook,
        name: "two_tools_with_pre_hook_no_format",
      },
      {
        tools: [tool1, tool2],
        postModelHook,
        name: "two_tools_with_post_hook_no_format",
      },
      {
        tools: [tool1, tool2],
        preModelHook,
        postModelHook,
        name: "two_tools_with_both_hooks_no_format",
      },
      {
        tools: [tool1, tool2],
        responseFormat: ResponseFormatSchema,
        name: "two_tools_no_hooks_with_format",
      },
      {
        tools: [tool1, tool2],
        preModelHook,
        responseFormat: ResponseFormatSchema,
        name: "two_tools_with_pre_hook_with_format",
      },
      {
        tools: [tool1, tool2],
        postModelHook,
        responseFormat: ResponseFormatSchema,
        name: "two_tools_with_post_hook_with_format",
      },
      {
        tools: [tool1, tool2],
        preModelHook,
        postModelHook,
        responseFormat: ResponseFormatSchema,
        name: "two_tools_with_both_hooks_with_format",
      },
    ];

    testCases.forEach(
      ({ tools, preModelHook, postModelHook, responseFormat, name }) => {
        it(`should create correct graph structure: ${name}`, async () => {
          const agent = createAgent({
            llm,
            tools,
            preModelHook,
            postModelHook,
            responseFormat: responseFormat as InteropZodType,
          });

          // Get the graph representation
          const graph = await agent.graph.getGraphAsync();
          const mermaidDiagram = graph.drawMermaid({ withStyles: false });

          // Use Vitest snapshot testing
          expect(mermaidDiagram).toMatchSnapshot();
        });
      }
    );
  });
});
