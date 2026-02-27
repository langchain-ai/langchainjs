import { expect } from "vitest";
import {
  toBeHumanMessage,
  toBeAIMessage,
  toBeSystemMessage,
  toBeToolMessage,
  toHaveToolCalls,
  toHaveToolCallCount,
  toContainToolCall,
  toHaveToolMessages,
  toHaveBeenInterrupted,
  toHaveStructuredResponse,
} from "@langchain/core/utils/testing";

expect.extend({
  toBeHumanMessage,
  toBeAIMessage,
  toBeSystemMessage,
  toBeToolMessage,
  toHaveToolCalls,
  toHaveToolCallCount,
  toContainToolCall,
  toHaveToolMessages,
  toHaveBeenInterrupted,
  toHaveStructuredResponse,
});
