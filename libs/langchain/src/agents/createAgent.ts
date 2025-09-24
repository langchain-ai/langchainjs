/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodObject,
  InteropZodType,
} from "@langchain/core/utils/types";

import { MessagesAnnotation } from "@langchain/langgraph";

import type {
  AnyAnnotationRoot,
  ResponseFormatUndefined,
} from "./annotation.js";
import type { CreateAgentParams, ExtractZodArrayTypes } from "./types.js";
import type {
  ToolStrategy,
  TypedToolStrategy,
  ProviderStrategy,
  ResponseFormat,
  JsonSchemaFormat,
} from "./responses.js";
import { ReactAgent } from "./ReactAgent.js";

/**
 * Creates a StateGraph agent that relies on a chat model utilizing tool calling.
 *
 * @example
 * ```ts
 * import { ChatOpenAI } from "@langchain/openai";
 * import { createAgent, tool } from "langchain";
 * import { z } from "zod/v3";
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
 * const agent = createAgent({ llm: model, tools: [getWeather] });
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
export function createAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  T extends Record<string, any> = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateAgentParams<
    StateSchema,
    T,
    ContextSchema,
    InteropZodType<T>
  > & {
    responseFormat: InteropZodType<T>;
  }
): ReactAgent<StateSchema, T, ContextSchema>;

// Overload 2: With responseFormat as array of InteropZodTypes (infers union type)
export function createAgent<
  T extends readonly InteropZodType<any>[],
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateAgentParams<
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
export function createAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateAgentParams<
    StateSchema,
    Record<string, unknown>,
    ContextSchema,
    JsonSchemaFormat
  > & {
    responseFormat: JsonSchemaFormat;
  }
): ReactAgent<StateSchema, Record<string, unknown>, ContextSchema>;

// Overload 4: With responseFormat as array of JsonSchemaFormat (JSON schema objects)
export function createAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateAgentParams<
    StateSchema,
    Record<string, unknown>,
    ContextSchema,
    JsonSchemaFormat[]
  > & {
    responseFormat: JsonSchemaFormat[];
  }
): ReactAgent<StateSchema, Record<string, unknown>, ContextSchema>;

// Overload 4.5: With responseFormat as union of JsonSchemaFormat | JsonSchemaFormat[]
export function createAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateAgentParams<
    StateSchema,
    Record<string, unknown>,
    ContextSchema,
    JsonSchemaFormat | JsonSchemaFormat[]
  > & {
    responseFormat: JsonSchemaFormat | JsonSchemaFormat[];
  }
): ReactAgent<StateSchema, Record<string, unknown>, ContextSchema>;

// Overload 5: With responseFormat as TypedToolStrategy (for union types from toolStrategy)
export function createAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  T extends Record<string, any> = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateAgentParams<
    StateSchema,
    T,
    ContextSchema,
    TypedToolStrategy<T>
  > & {
    responseFormat: TypedToolStrategy<T>;
  }
): ReactAgent<StateSchema, T, ContextSchema>;

// Overload 6: With responseFormat as single ToolStrategy instance
export function createAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  T extends Record<string, any> = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateAgentParams<StateSchema, T, ContextSchema, ToolStrategy<T>> & {
    responseFormat: ToolStrategy<T>;
  }
): ReactAgent<StateSchema, T, ContextSchema>;

// Overload 7: With responseFormat as ProviderStrategy
export function createAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  T extends Record<string, any> = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateAgentParams<
    StateSchema,
    T,
    ContextSchema,
    ProviderStrategy<T>
  > & {
    responseFormat: ProviderStrategy<T>;
  }
): ReactAgent<StateSchema, T, ContextSchema>;

// Overload 8: Without responseFormat property at all
export function createAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: Omit<
    CreateAgentParams<
      StateSchema,
      ResponseFormatUndefined,
      ContextSchema,
      never
    >,
    "responseFormat"
  >
): ReactAgent<StateSchema, ResponseFormatUndefined, ContextSchema>;

// Overload 9: With responseFormat explicitly undefined
export function createAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: Omit<
    CreateAgentParams<
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

// Overload 10: For other ResponseFormat values (failsafe)
export function createAgent<
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = typeof MessagesAnnotation,
  StructuredResponseFormat extends Record<string, any> = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
>(
  params: CreateAgentParams<
    StateSchema,
    StructuredResponseFormat,
    ContextSchema,
    ResponseFormat
  > & {
    responseFormat: ResponseFormat;
  }
): ReactAgent<StateSchema, StructuredResponseFormat, ContextSchema>;

// Implementation
export function createAgent<
  StateSchema extends AnyAnnotationRoot | InteropZodObject,
  StructuredResponseFormat extends Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject
>(
  params: CreateAgentParams<
    StateSchema,
    StructuredResponseFormat,
    ContextSchema,
    any
  >
): ReactAgent<StateSchema, StructuredResponseFormat, ContextSchema> {
  return new ReactAgent(params);
}
