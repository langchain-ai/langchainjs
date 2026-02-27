import { expect } from "vitest";
import {
  toBeHumanMessage,
  toBeAIMessage,
  toBeToolMessage,
  toHaveToolCalls,
  toHaveToolCallCount,
  toHaveToolMessages,
  toHaveBeenInterrupted,
  toHaveStructuredResponse,
} from "@langchain/core/utils/testing";

expect.extend({
  toBeHumanMessage,
  toBeAIMessage,
  toBeToolMessage,
  toHaveToolCalls,
  toHaveToolCallCount,
  toHaveToolMessages,
  toHaveBeenInterrupted,
  toHaveStructuredResponse,
});
