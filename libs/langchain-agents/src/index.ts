import type {
  InteropZodObject,
  InteropZodType,
} from "@langchain/core/utils/types";

import { MessagesAnnotation, getConfig } from "@langchain/langgraph";

import type {
  AnyAnnotationRoot,
  CreateReactAgentParams,
  ExtractZodArrayTypes,
  JsonSchemaFormat,
  ResponseFormatUndefined,
} from "./types.js";
import type {
  ToolOutput,
  TypedToolOutput,
  NativeOutput,
  ResponseFormat,
} from "./responses.js";
import { ReactAgent } from "./ReactAgent.js";

/**
 * Creates a StateGraph agent that relies on a chat model utilizing tool calling.
 *
 * @example
 * ```ts
 * import { ChatOpenAI } from "@langchain/openai";
 * import { createReactAgent, tool } from "langchain";
 * import { z } from "zod";
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
// Overload 1: With responseFormat as single InteropZodType
export function createReactAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  T extends Record<string, any> = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateReactAgentParams<
    StateSchema,
    T,
    ContextSchema,
    InteropZodType<T>
  > & {
    responseFormat: InteropZodType<T>;
  }
): ReactAgent<StateSchema, T, ContextSchema>;

// Overload 2: With responseFormat as array of InteropZodTypes (infers union type)
export function createReactAgent<
  T extends readonly InteropZodType<any>[],
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateReactAgentParams<
    StateSchema,
    ExtractZodArrayTypes<T> extends Record<string, any>
      ? ExtractZodArrayTypes<T>
      : Record<string, any>,
    ContextSchema,
    T
  > & {
    responseFormat: T;
  }
): ReactAgent<
  StateSchema,
  ExtractZodArrayTypes<T> extends Record<string, any>
    ? ExtractZodArrayTypes<T>
    : Record<string, any>,
  ContextSchema
>;

// Overload 3: With responseFormat as JsonSchemaFormat (JSON schema object)
export function createReactAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateReactAgentParams<
    StateSchema,
    Record<string, unknown>,
    ContextSchema,
    JsonSchemaFormat
  > & {
    responseFormat: JsonSchemaFormat;
  }
): ReactAgent<StateSchema, Record<string, unknown>, ContextSchema>;

// Overload 4: With responseFormat as array of JsonSchemaFormat (JSON schema objects)
export function createReactAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateReactAgentParams<
    StateSchema,
    Record<string, unknown>,
    ContextSchema,
    JsonSchemaFormat[]
  > & {
    responseFormat: JsonSchemaFormat[];
  }
): ReactAgent<StateSchema, Record<string, unknown>, ContextSchema>;

// Overload 5: With responseFormat as TypedToolOutput (for union types from toolOutput)
export function createReactAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  T extends Record<string, any> = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateReactAgentParams<
    StateSchema,
    T,
    ContextSchema,
    TypedToolOutput<T>
  > & {
    responseFormat: TypedToolOutput<T>;
  }
): ReactAgent<StateSchema, T, ContextSchema>;

// Overload 6: With responseFormat as single ToolOutput instance
export function createReactAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  T extends Record<string, any> = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateReactAgentParams<
    StateSchema,
    T,
    ContextSchema,
    ToolOutput<T>
  > & {
    responseFormat: ToolOutput<T>;
  }
): ReactAgent<StateSchema, T, ContextSchema>;

// Overload 7: With responseFormat as NativeOutput
export function createReactAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  T extends Record<string, any> = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateReactAgentParams<
    StateSchema,
    T,
    ContextSchema,
    NativeOutput<T>
  > & {
    responseFormat: NativeOutput<T>;
  }
): ReactAgent<StateSchema, T, ContextSchema>;

// Overload 8: Without responseFormat
export function createReactAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: Omit<
    CreateReactAgentParams<
      StateSchema,
      ResponseFormatUndefined,
      ContextSchema,
      never
    >,
    "responseFormat"
  > & {
    responseFormat?: undefined;
  }
): ReactAgent<StateSchema, ResponseFormatUndefined, ContextSchema>;

// Overload 9: For other ResponseFormat values (failsafe)
export function createReactAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  StructuredResponseFormat extends Record<string, any> = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateReactAgentParams<
    StateSchema,
    StructuredResponseFormat,
    ContextSchema,
    ResponseFormat
  > & {
    responseFormat: ResponseFormat;
  }
): ReactAgent<StateSchema, StructuredResponseFormat, ContextSchema>;

// Implementation
export function createReactAgent<
  StateSchema extends AnyAnnotationRoot | InteropZodObject,
  StructuredResponseFormat extends Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject
>(
  params: CreateReactAgentParams<
    StateSchema,
    StructuredResponseFormat,
    ContextSchema,
    any
  >
): ReactAgent<StateSchema, StructuredResponseFormat, ContextSchema> {
  return new ReactAgent(params);
}

export * from "./types.js";
export * from "./resume.js";
export * from "./stopWhen.js";
export type LangGraphRunnableConfig = ReturnType<typeof getConfig>;
export { interrupt } from "@langchain/langgraph";
export {
  toolOutput,
  nativeOutput,
  ToolOutput,
  NativeOutput,
  ResponseFormat,
} from "./responses.js";
