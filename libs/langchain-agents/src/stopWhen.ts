import { RunnableConfig } from "@langchain/core/runnables";

import { PreHookAnnotation } from "./annotation.js";
import {
  AgentState,
  PredicateFunction,
  PredicateFunctionReturn,
} from "./types.js";

/**
 * Stop when a predicate is met. This is a general multi-purpose stop condition
 * that allows you to define custom stopping logic based on the agent's state.
 *
 * The predicate function receives the current agent state and config, and should
 * return an object with:
 * - `shouldStop`: boolean indicating whether to stop
 * - `description`: optional string explaining why the agent is stopping
 *
 * @param predicate - The predicate function that determines when to stop.
 * @returns A predicate function that can be used to stop the agent.
 *
 * @example
 * ```typescript
 * // Stop after 10 messages
 * const stopAfterTenMessages = stopWhen((state) => ({
 *   shouldStop: state.messages.length >= 10,
 *   description: "Reached maximum message limit of 10"
 * }));
 *
 * // Stop when a specific word appears in the last message
 * const stopOnKeyword = stopWhen((state) => {
 *   const lastMessage = state.messages[state.messages.length - 1];
 *   const content = lastMessage?.content?.toString() || "";
 *   return {
 *     shouldStop: content.includes("STOP"),
 *     description: "Found STOP keyword in message"
 *   };
 * });
 *
 * // Stop based on execution time using config
 * const stopAfterTimeout = stopWhen((state, config) => {
 *   const startTime = config?.metadata?.startTime;
 *   if (!startTime) return { shouldStop: false };
 *
 *   const elapsed = Date.now() - startTime;
 *   return {
 *     shouldStop: elapsed > 30000, // 30 seconds
 *     description: `Execution time exceeded 30 seconds (${elapsed}ms)`
 *   };
 * });
 *
 * // Use with createReactAgent
 * const agent = createReactAgent({
 *   model: yourModel,
 *   tools: [yourTool],
 *   beforeReturnHook: stopAfterTenMessages
 * });
 * ```
 */
export function stopWhen<
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >
>(predicate: PredicateFunction<StructuredResponseFormat>) {
  if (typeof predicate !== "function") {
    throw new Error("stopWhen must be a function");
  }

  return async (
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
    config: RunnableConfig
  ): Promise<PredicateFunctionReturn> => {
    return predicate(state, config);
  };
}

/**
 * Stop when a specific tool is called a certain number of times.
 *
 * This is useful for:
 * - Preventing infinite loops with specific tools
 * - Limiting API calls to expensive tools
 * - Implementing tool-based conversation flow control
 * - Testing and debugging agent behavior
 *
 * The function counts all tool messages with the specified name in the
 * conversation history, not just consecutive calls.
 *
 * @param toolName - The name of the tool to monitor. Must match exactly.
 * @param toolCallCount - The maximum number of times the tool can be called
 *                        before stopping. Defaults to 1 (stop after first call).
 * @returns A predicate function that can be used to stop the agent.
 *
 * @example
 * ```typescript
 * // Stop after the first call to a search tool
 * const stopAfterFirstSearch = stopWhenToolCall("web_search");
 *
 * // Allow up to 3 API calls before stopping
 * const limitApiCalls = stopWhenToolCall("expensive_api_tool", 3);
 *
 * // Stop after calculator is used once
 * const stopAfterCalculation = stopWhenToolCall("calculator", 1);
 *
 * // Use with createReactAgent
 * const agent = createReactAgent({
 *   model: yourModel,
 *   tools: [webSearchTool, calculatorTool],
 *   beforeReturnHook: stopAfterFirstSearch
 * });
 *
 * // Combine multiple stop conditions
 * const stopOnSearchOrTimeout = stopWhen((state, config) => {
 *   // Check if search tool was called
 *   const searchStop = stopWhenToolCall("web_search")(state);
 *   if (searchStop.shouldStop) return searchStop;
 *
 *   // Otherwise check timeout
 *   const elapsed = Date.now() - (config?.metadata?.startTime || 0);
 *   return {
 *     shouldStop: elapsed > 30000,
 *     description: `Timeout after ${elapsed}ms`
 *   };
 * });
 * ```
 */
export function stopWhenToolCall(toolName: string, toolCallCount = 1) {
  if (toolCallCount < 1 || !Number.isInteger(toolCallCount)) {
    throw new Error("toolCallCount must be a positive integer");
  }

  return (state: AgentState<any>): PredicateFunctionReturn => {
    const toolCalls = state.messages.filter(
      (msg) => msg.getType() === "tool" && msg.name === toolName
    );
    return {
      shouldStop: toolCalls.length >= toolCallCount,
      description: `Tool call count for ${toolName} is ${toolCalls.length} and exceeded the limit of ${toolCallCount}`,
    };
  };
}

/**
 * Stop when the agent has made a certain number of model calls (steps).
 *
 * This is useful for:
 * - Preventing runaway agent loops
 * - Limiting token usage and costs
 * - Ensuring predictable agent behavior
 * - Testing and debugging with controlled iteration counts
 *
 * The function counts all AI/model messages in the conversation history,
 * which represents each time the model has generated a response.
 *
 * @param maxSteps - The maximum number of model calls allowed before stopping.
 *                   Must be a positive integer.
 * @returns A predicate function that can be used to stop the agent.
 *
 * @example
 * ```typescript
 * // Stop after 5 model calls
 * const limitToFiveSteps = stopWhenMaxSteps(5);
 *
 * // Stop after a single response (useful for one-shot tasks)
 * const oneStepOnly = stopWhenMaxSteps(1);
 *
 * // Use with createReactAgent
 * const agent = createReactAgent({
 *   model: yourModel,
 *   tools: [searchTool, calculatorTool],
 *   beforeReturnHook: limitToFiveSteps
 * });
 *
 * // Combine with other stop conditions
 * const stopOnSuccessOrMaxSteps = stopWhen((state, config) => {
 *   // First check if we've hit max steps
 *   const maxStepsCheck = stopWhenMaxSteps(10)(state);
 *   if (maxStepsCheck.shouldStop) return maxStepsCheck;
 *
 *   // Then check for success condition
 *   const lastMessage = state.messages[state.messages.length - 1];
 *   const hasResult = lastMessage?.content?.toString().includes("Final Answer:");
 *   return {
 *     shouldStop: hasResult,
 *     description: hasResult ? "Found final answer" : "Continue searching"
 *   };
 * });
 *
 * // Use different limits for different scenarios
 * const devLimit = stopWhenMaxSteps(3);    // Strict limit for development
 * const prodLimit = stopWhenMaxSteps(20);  // More generous for production
 * ```
 */
export function stopWhenMaxSteps(maxSteps: number) {
  if (maxSteps < 1 || !Number.isInteger(maxSteps)) {
    throw new Error("maxSteps must be a positive integer");
  }

  return (state: AgentState<any>): PredicateFunctionReturn => {
    const modelCalls = state.messages.filter((msg) => msg.getType() === "ai");
    return {
      shouldStop: modelCalls.length >= maxSteps,
      description: `Model call count is ${modelCalls.length} and reached the limit of ${maxSteps}`,
    };
  };
}
