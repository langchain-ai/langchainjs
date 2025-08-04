import { describe, it, expect, vi } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import z from "zod";

import { createReactAgent } from "../index.js";

import errorHandlingSpec from "./specifications/errorHandling.json";

interface TestScenario {
  /**
   * The name of the test scenario.
   */
  name: string;
  /**
   * The location where the error is thrown.
   * - `toolCall`: The error is thrown in the tool call.
   * - `prompt`: The error is thrown in the prompt call.
   * - `preModelHook`: The error is thrown in the preModelHook.
   * - `postModelHook`: The error is thrown in the postModelHook.
   */
  throwWithin: "toolCall" | "prompt" | "preModelHook" | "postModelHook";
  /**
   * The timing of the error.
   * - `immediate`: The error is thrown immediately.
   * - `delayed`: The error is thrown after a couple of tool calls.
   */
  throwTimming?: "immediate" | "delayed";
  /**
   * How the error should be handled.
   * - `bubbleUp`: rethrow the error in the handler.
   * - `cached`: return a cached result.
   */
  errorHandler?: "bubbleUp" | "cached";
  /**
   * The expected number of tool calls.
   */
  expectedToolCalls: number;
  /**
   * The expected error message.
   */
  expectedError?: string;
  /**
   * The expected result.
   */
  expectedResult?: string;
  /**
   * Whether to only run this test scenario.
   */
  only?: boolean;
  /**
   * Whether to skip this test scenario.
   */
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

/**
 * A simple error handler that throws the error.
 * @param toolCall - The tool call that caused the error.
 */
function bubbleUpErrorHandler(toolCall: { error: unknown }) {
  throw toolCall.error;
}

/**
 * A simple error handler that returns a cached result.
 * @param toolCall - The tool call that caused the error.
 */
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

const testScenarios: TestScenario[] = errorHandlingSpec as TestScenario[];

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

      const agent = createReactAgent({
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
