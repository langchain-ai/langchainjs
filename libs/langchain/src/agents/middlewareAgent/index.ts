/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodObject,
  InteropZodType,
} from "@langchain/core/utils/types";

import { type AnyAnnotationRoot } from "../annotation.js";
import type { CreateAgentParams, AgentMiddleware } from "./types.js";
import type { ExtractZodArrayTypes } from "../types.js";
import type {
  ToolStrategy,
  TypedToolStrategy,
  ProviderStrategy,
  ResponseFormat,
  ResponseFormatUndefined,
  JsonSchemaFormat,
} from "../responses.js";
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
  T extends Record<string, any> = Record<string, any>,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<
    any,
    any,
    any
  >[] = readonly AgentMiddleware<any, any, any>[]
>(
  params: CreateAgentParams<T, ContextSchema, InteropZodType<T>> & {
    responseFormat: InteropZodType<T>;
    middleware?: TMiddleware;
  }
): ReactAgent<T, ContextSchema, TMiddleware>;

// Overload 2: With responseFormat as array of InteropZodTypes (infers union type)
export function createAgent<
  T extends readonly InteropZodType<any>[],
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<
    any,
    any,
    any
  >[] = readonly AgentMiddleware<any, any, any>[]
>(
  params: CreateAgentParams<
    ExtractZodArrayTypes<T> extends Record<string, any>
      ? ExtractZodArrayTypes<T>
      : Record<string, any>,
    ContextSchema,
    T
  > & {
    responseFormat: T;
    middleware?: TMiddleware;
  }
): ReactAgent<
  ExtractZodArrayTypes<T> extends Record<string, any>
    ? ExtractZodArrayTypes<T>
    : Record<string, any>,
  ContextSchema,
  TMiddleware
>;

// Overload 3: With responseFormat as JsonSchemaFormat (JSON schema object)
export function createAgent<
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<
    any,
    any,
    any
  >[] = readonly AgentMiddleware<any, any, any>[]
>(
  params: CreateAgentParams<
    Record<string, unknown>,
    ContextSchema,
    JsonSchemaFormat
  > & {
    responseFormat: JsonSchemaFormat;
    middleware?: TMiddleware;
  }
): ReactAgent<Record<string, unknown>, ContextSchema, TMiddleware>;

// Overload 4: With responseFormat as array of JsonSchemaFormat (JSON schema objects)
export function createAgent<
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<
    any,
    any,
    any
  >[] = readonly AgentMiddleware<any, any, any>[]
>(
  params: CreateAgentParams<
    Record<string, unknown>,
    ContextSchema,
    JsonSchemaFormat[]
  > & {
    responseFormat: JsonSchemaFormat[];
    middleware?: TMiddleware;
  }
): ReactAgent<Record<string, unknown>, ContextSchema, TMiddleware>;

// Overload 4.5: With responseFormat as union of JsonSchemaFormat | JsonSchemaFormat[]
export function createAgent<
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<
    any,
    any,
    any
  >[] = readonly AgentMiddleware<any, any, any>[]
>(
  params: CreateAgentParams<
    Record<string, unknown>,
    ContextSchema,
    JsonSchemaFormat | JsonSchemaFormat[]
  > & {
    responseFormat: JsonSchemaFormat | JsonSchemaFormat[];
    middleware?: TMiddleware;
  }
): ReactAgent<Record<string, unknown>, ContextSchema, TMiddleware>;

// Overload 5: With responseFormat as TypedToolStrategy (for union types from toolStrategy)
export function createAgent<
  T extends Record<string, any> = Record<string, any>,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<
    any,
    any,
    any
  >[] = readonly AgentMiddleware<any, any, any>[]
>(
  params: CreateAgentParams<T, ContextSchema, TypedToolStrategy<T>> & {
    responseFormat: TypedToolStrategy<T>;
    middleware?: TMiddleware;
  }
): ReactAgent<T, ContextSchema, TMiddleware>;

// Overload 6: With responseFormat as single ToolStrategy instance
export function createAgent<
  T extends Record<string, any> = Record<string, any>,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<
    any,
    any,
    any
  >[] = readonly AgentMiddleware<any, any, any>[]
>(
  params: CreateAgentParams<T, ContextSchema, ToolStrategy<T>> & {
    responseFormat: ToolStrategy<T>;
    middleware?: TMiddleware;
  }
): ReactAgent<T, ContextSchema, TMiddleware>;

// Overload 7: With responseFormat as ProviderStrategy
export function createAgent<
  T extends Record<string, any> = Record<string, any>,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<
    any,
    any,
    any
  >[] = readonly AgentMiddleware<any, any, any>[]
>(
  params: CreateAgentParams<T, ContextSchema, ProviderStrategy<T>> & {
    responseFormat: ProviderStrategy<T>;
    middleware?: TMiddleware;
  }
): ReactAgent<T, ContextSchema, TMiddleware>;

// Overload 8: Without responseFormat property at all - with proper middleware state typing
export function createAgent<
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<
    any,
    any,
    any
  >[] = readonly AgentMiddleware<any, any, any>[]
>(
  params: Omit<
    CreateAgentParams<ResponseFormatUndefined, ContextSchema, never>,
    "responseFormat"
  > & { middleware?: TMiddleware }
): ReactAgent<ResponseFormatUndefined, ContextSchema, TMiddleware>;

// Overload 9: With responseFormat explicitly undefined
export function createAgent<
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<
    any,
    any,
    any
  >[] = readonly AgentMiddleware<any, any, any>[]
>(
  params: Omit<
    CreateAgentParams<ResponseFormatUndefined, ContextSchema, never>,
    "responseFormat"
  > & {
    responseFormat?: undefined;
    middleware?: TMiddleware;
  }
): ReactAgent<ResponseFormatUndefined, ContextSchema, TMiddleware>;

// Overload 10: For other ResponseFormat values (failsafe)
export function createAgent<
  StructuredResponseFormat extends Record<string, any> = Record<string, any>,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<
    any,
    any,
    any
  >[] = readonly AgentMiddleware<any, any, any>[]
>(
  params: CreateAgentParams<
    StructuredResponseFormat,
    ContextSchema,
    ResponseFormat
  > & {
    responseFormat: ResponseFormat;
    middleware?: TMiddleware;
  }
): ReactAgent<StructuredResponseFormat, ContextSchema, TMiddleware>;

// Implementation
export function createAgent<
  StructuredResponseFormat extends Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject,
  TMiddleware extends readonly AgentMiddleware<any, any, any>[] = []
>(
  params: CreateAgentParams<StructuredResponseFormat, ContextSchema, any>
): ReactAgent<StructuredResponseFormat, ContextSchema, TMiddleware> {
  return new ReactAgent(params);
}

export { createMiddleware } from "./middleware.js";
