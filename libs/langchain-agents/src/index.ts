import type { InteropZodObject } from "@langchain/core/utils/types";

import { MessagesAnnotation, getConfig } from "@langchain/langgraph";

import type { AnyAnnotationRoot, CreateReactAgentParams } from "./types.js";
import { ReactAgent } from "./ReactAgent.js";

/**
 * Creates a StateGraph agent that relies on a chat model utilizing tool calling.
 *
 * @example
 * ```ts
 * import { ChatOpenAI } from "@langchain/openai";
 * import { tool } from "@langchain/core/tools";
 * import { z } from "zod";
 * import { createReactAgent } from "@langchain/langgraph/prebuilt";
 *
 * const model = new ChatOpenAI({
 *   model: "gpt-4o",
 * });
 *
 * const getWeather = tool((input) => {
 *   if (["sf", "san francisco"].includes(input.location.toLowerCase())) {
 *     return "It's 60 degrees and foggy.";
 *   } else {
 *     return "It's 90 degrees and sunny.";
 *   }
 * }, {
 *   name: "get_weather",
 *   description: "Call to get the current weather.",
 *   schema: z.object({
 *     location: z.string().describe("Location to get the weather for."),
 *   })
 * })
 *
 * const agent = createReactAgent({ llm: model, tools: [getWeather] });
 *
 * const inputs = {
 *   messages: [{ role: "user", content: "what is the weather in SF?" }],
 * };
 *
 * const stream = await agent.stream(inputs, { streamMode: "values" });
 *
 * for await (const { messages } of stream) {
 *   console.log(messages);
 * }
 * // Returns the messages in the state at each step of execution
 * ```
 */
export function createReactAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateReactAgentParams<
    StateSchema,
    StructuredResponseFormat,
    ContextSchema
  >
): ReactAgent<StateSchema, StructuredResponseFormat, ContextSchema> {
  return new ReactAgent(params);
}

export * from "./types.js";
export * from "./resume.js";
export type LangGraphRunnableConfig = ReturnType<typeof getConfig>;
export { interrupt } from "@langchain/langgraph";
