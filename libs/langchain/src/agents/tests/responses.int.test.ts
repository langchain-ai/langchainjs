/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import z from "zod/v3";

import { createAgent, toolStrategy } from "../index.js";
import type { JsonSchemaFormat } from "../responses.js";

import responsesSpec from "./specifications/responses.json";

/**
 * Creates a tool as mock
 * @param fn - The tool function
 * @param args - The tool arguments
 * @returns an object with the tool and the mock
 */
function makeTool(
  fn: (args: any) => any,
  args: {
    name: string;
    description: string;
    returnDirect?: boolean;
    schema: z.ZodSchema;
  }
) {
  const mock = vi.fn(fn);

  return {
    tool: tool(mock, args),
    mock,
  };
}

// Agent prompt used across all tests
const AGENT_PROMPT = `You are an HR assistant.`;

interface TestCase {
  name: string;
  responseFormat: JsonSchemaFormat | JsonSchemaFormat[];
  assertionsByInvocation: {
    prompt: string;
    toolsWithExpectedCalls: Record<string, number>;
    expectedLastMessage: string;
    expectedStructuredResponse?: unknown;
    llmRequestCount: number;
  }[];
  only?: boolean;
}

interface Employee {
  name: string;
  role: string;
  department: string;
}

const employees: Employee[] = [
  { name: "Sabine", role: "Developer", department: "IT" },
  { name: "Henrik", role: "Product Manager", department: "IT" },
  { name: "Jessica", role: "HR", department: "People" },
];

describe("responses Matrix Tests", () => {
  const testCases = responsesSpec as TestCase[];
  testCases.forEach((testCase) => {
    let testFn = it.concurrent;
    if (testCase.only) {
      testFn = it.only;
    }
    testFn(testCase.name, async () => {
      const fetchMock = vi.fn(fetch);

      // Create LLM instance
      const model = new ChatAnthropic({
        model: "claude-sonnet-4-5-20250929",
        temperature: 0, // Make it deterministic
        clientOptions: {
          fetch: fetchMock,
        },
      });

      // Create poll tool with specified returnDirect setting
      const { tool: getEmployeeRoleTool, mock: getEmployeeRoleMock } = makeTool(
        ({ name }: { name: string }) =>
          employees.find((e) => e.name === name)?.role,
        {
          name: "getEmployee",
          description: "Get the employee role by name",
          schema: z.object({
            name: z.string(),
          }),
        }
      );

      const {
        tool: getEmployeeDepartmentTool,
        mock: getEmployeeDepartmentMock,
      } = makeTool(
        ({ name }: { name: string }) =>
          employees.find((e) => e.name === name)?.department,
        {
          name: "getEmployeeDepartment",
          description: "Get the employee department by name",
          schema: z.object({
            name: z.string(),
          }),
        }
      );

      // Create agent with specified configuration
      const agent = createAgent({
        model,
        tools: [getEmployeeRoleTool, getEmployeeDepartmentTool],
        systemPrompt: AGENT_PROMPT,
        responseFormat: testCase.responseFormat,
      });

      for (const assertion of testCase.assertionsByInvocation) {
        // Invoke the agent
        const result = await agent.invoke({
          messages: [new HumanMessage(assertion.prompt)],
        });

        // Count tool calls
        expect(getEmployeeRoleMock).toHaveBeenCalledTimes(
          assertion.toolsWithExpectedCalls.getEmployeeRole
        );
        expect(getEmployeeDepartmentMock).toHaveBeenCalledTimes(
          assertion.toolsWithExpectedCalls.getEmployeeDepartment
        );

        // Count LLM calls
        if (assertion.llmRequestCount !== -1) {
          expect(fetchMock).toHaveBeenCalledTimes(assertion.llmRequestCount);
        }

        // Check last message content
        const lastMessage = result.messages.at(-1);
        const lastMessageContent = lastMessage?.content;
        expect(lastMessageContent).toBeDefined();
      }
    });
  });
});

describe("structured output handling", () => {
  describe("toolStrategy", () => {
    it("should handle multi-turn structured output calls", async () => {
      // Create LLM instance
      const model = new ChatAnthropic({
        model: "claude-sonnet-4-5-20250929",
        temperature: 0, // Make it deterministic
      });
      const agent = createAgent({
        model,
        tools: [],
        responseFormat: toolStrategy(
          z.object({
            foo: z.string(),
          })
        ),
      });
      const res = await agent.invoke({
        messages: [{ role: "user", content: "hi" }],
      });
      expect(res.structuredResponse.foo).toBeDefined();
      expect(res.messages.length).toBe(4);
      expect(res.messages[0].content).toBe("hi");
      expect(res.messages.at(-1)?.content).toContain(
        'Returning structured response: {"foo":"'
      );
      const res2 = await agent.invoke({
        messages: [...res.messages, { role: "user", content: "hi" }],
      });
      expect(res2.structuredResponse.foo).toBeDefined();
      expect(res2.messages.length).toBe(8);
      expect(res2.messages.at(-1)?.content).toContain(
        'Returning structured response: {"foo":"'
      );
    });
  });
});
