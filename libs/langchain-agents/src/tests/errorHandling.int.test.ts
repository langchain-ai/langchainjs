import { describe, it, expect, vi } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import z from "zod";

import { createAgent } from "../index.js";

interface TestScenario {
  name: string;
  throwWithin: "toolCall" | "llm" | "prompt" | "preModelHook" | "postModelHook";
  throwTimming?: "immediate" | "delayed";
  errorHandler?: "bubbleUp" | "cached";
  expectedToolCalls: number;
  expectedError?: string;
  expectedResult?: string;
  only?: boolean;
  skip?: boolean;
}

const THROW_DELAY_COUNT = 3;

// define a llm
const llm = new ChatAnthropic({
  model: "claude-sonnet-4-0",
  temperature: 0,
});

interface ToolParams {
  throw?: boolean;
  throwTimming?: "immediate" | "delayed";
}

/**
 * A deterministic poll tool: returns "pending" for the first 10 calls, then "succeeded".
 * @returns A tool that polls a job and returns the status and number of attempts.
 */
function makePollTool(params?: ToolParams) {
  let counter = 0;

  const mock = vi.fn(({ inputValue }: { inputValue: number }) => {
    if (params?.throwTimming === "delayed") {
      counter += 1;
      if (counter > THROW_DELAY_COUNT) {
        throw new Error("tool call error");
      }
    }

    if (params?.throwTimming === "immediate") {
      throw new Error("tool call error");
    }

    return { result: inputValue + 1 };
  });

  return {
    tool: tool(mock, {
      name: "addRandom",
      description: "Add a random number to the input",
      schema: z.object({
        inputValue: z.number(),
      }),
    }),
    mock,
  };
}

function bubbleUpErrorHandler(toolCall: { error: unknown }) {
  throw toolCall.error;
}

function cachedErrorHandler(toolCall: {
  error: unknown;
  name: string;
  id: string;
}) {
  return new ToolMessage({
    content: JSON.stringify({ result: "123" }),
    name: toolCall.name,
    tool_call_id: toolCall.id ?? "",
  });
}

// Agent prompt used across all tests
const prompt = `You are a helpful assistant.
Use the addRandom tool to add random numbers to 1 until your result is 10.
Note, don't come up with any numbers yourself, ensure you are using the tool as often as you can.`;

const testScenarios: TestScenario[] = [
  {
    name: "throw immediate in tool call",
    throwWithin: "toolCall",
    throwTimming: "immediate",
    errorHandler: "bubbleUp",
    expectedToolCalls: 1,
    expectedError: "tool call error",
  },
  {
    name: "throw delayed in tool call",
    throwWithin: "toolCall",
    throwTimming: "delayed",
    errorHandler: "bubbleUp",
    expectedToolCalls: 4,
    expectedError: "tool call error",
  },
  {
    name: "throw immediate in tool call",
    throwWithin: "toolCall",
    throwTimming: "immediate",
    errorHandler: "cached",
    expectedToolCalls: 1,
    expectedResult: "123",
  },
  {
    name: "throw delayed in tool call",
    throwWithin: "toolCall",
    throwTimming: "delayed",
    errorHandler: "cached",
    expectedToolCalls: 4,
    expectedResult: "123",
  },
  /**
   * `llm` if provided as a function, it will be called only once.
   */
  {
    name: "throw immediate in llm",
    throwWithin: "llm",
    throwTimming: "immediate",
    expectedToolCalls: 0,
    expectedError: "llm error",
  },
  {
    name: "throw immediate in prompt",
    throwWithin: "prompt",
    throwTimming: "immediate",
    expectedToolCalls: 0,
    expectedError: "prompt error",
  },
  {
    name: "throw delayed in prompt",
    throwWithin: "prompt",
    throwTimming: "delayed",
    expectedToolCalls: THROW_DELAY_COUNT,
    expectedError: "prompt error",
  },
  {
    name: "throw immediate in preModelHook",
    throwWithin: "preModelHook",
    throwTimming: "immediate",
    expectedToolCalls: 0,
    expectedError: "preModelHook error",
  },
  {
    name: "throw delayed in preModelHook",
    throwWithin: "preModelHook",
    throwTimming: "delayed",
    expectedToolCalls: THROW_DELAY_COUNT,
    expectedError: "preModelHook error",
  },
  {
    name: "throw immediate in postModelHook",
    throwWithin: "postModelHook",
    throwTimming: "immediate",
    expectedToolCalls: 0,
    expectedError: "postModelHook error",
  },
  {
    name: "throw delayed in postModelHook",
    throwWithin: "postModelHook",
    throwTimming: "delayed",
    expectedToolCalls: THROW_DELAY_COUNT,
    expectedError: "postModelHook error",
  },
];

describe("stopWhen Tests", () => {
  testScenarios.forEach((scenario) => {
    const testFn = scenario.only
      ? it.only
      : scenario.skip
      ? it.skip
      : it.concurrent;
    testFn(scenario.name, async () => {
      const { tool: pollJob, mock } = makePollTool({
        throw: scenario.throwWithin === "toolCall",
        throwTimming: scenario.throwTimming,
      });

      let counter = 0;
      const dynamicPrompt = (state: any) => {
        if (scenario.throwTimming === "immediate") {
          throw new Error("prompt error");
        }
        if (scenario.throwTimming === "delayed") {
          counter += 1;
          if (counter > THROW_DELAY_COUNT) {
            throw new Error("prompt error");
          }
        }
        return [new SystemMessage(prompt), ...state.messages];
      };

      const getDynamicHook = (hook: "preModelHook" | "postModelHook") => {
        return (state: any) => {
          if (scenario.throwTimming === "immediate") {
            throw new Error(`${hook} error`);
          }
          if (scenario.throwTimming === "delayed") {
            counter += 1;
            if (counter > THROW_DELAY_COUNT) {
              throw new Error(`${hook} error`);
            }
          }
          return state;
        };
      };

      const agent = createAgent({
        tools: [pollJob],
        llm,
        prompt: scenario.throwWithin === "prompt" ? dynamicPrompt : prompt,
        preModelHook:
          scenario.throwWithin === "preModelHook"
            ? getDynamicHook("preModelHook")
            : undefined,
        postModelHook:
          scenario.throwWithin === "postModelHook"
            ? getDynamicHook("postModelHook")
            : undefined,
        ...(scenario.errorHandler === "bubbleUp"
          ? {
              onToolCallError: bubbleUpErrorHandler,
            }
          : {
              onToolCallError: cachedErrorHandler,
            }),
      });

      if (scenario.expectedError) {
        await expect(() =>
          agent.invoke({
            messages: [
              new HumanMessage("Get a result that is greater or equal to 10"),
            ],
          })
        ).rejects.toThrow();
      } else {
        const res = await agent.invoke({
          messages: [
            new HumanMessage("Get a result that is greater or equal to 10"),
          ],
        });
        expect(res.messages.at(-1)?.content).toContain(scenario.expectedResult);
      }

      expect(mock).toHaveBeenCalledTimes(scenario.expectedToolCalls);
    });
  });
});
