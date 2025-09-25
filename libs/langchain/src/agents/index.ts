/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodObject,
  InteropZodType,
} from "@langchain/core/utils/types";
import { MessagesAnnotation } from "@langchain/langgraph";

// Import v1 (without middleware)
import { createAgent as createAgentV1 } from "./createAgent.js";
import { ReactAgent as ReactAgentV1 } from "./ReactAgent.js";

// Import v2 (with middleware)
import { createAgent as createAgentV2 } from "./middlewareAgent/index.js";
import { ReactAgent as ReactAgentV2 } from "./middlewareAgent/ReactAgent.js";

import type {
  AnyAnnotationRoot,
  ResponseFormatUndefined,
} from "./annotation.js";
import type { CreateAgentParams, ExtractZodArrayTypes } from "./types.js";
import type {
  CreateAgentParams as CreateAgentParamsV2,
  AgentMiddleware,
} from "./middlewareAgent/types.js";
import type {
  ToolStrategy,
  TypedToolStrategy,
  ProviderStrategy,
  JsonSchemaFormat,
} from "./responses.js";

// Re-export types and utilities
export * from "./types.js";
export * from "./errors.js";
export * from "./interrupt.js";
export { ToolNode } from "./nodes/ToolNode.js";
export {
  toolStrategy,
  providerStrategy,
  ToolStrategy,
  ProviderStrategy,
  type ResponseFormat,
} from "./responses.js";
export { createMiddleware } from "./middlewareAgent/index.js";
export type { AgentMiddleware } from "./middlewareAgent/types.js";

/**
 * Agents combine language models with tools to create systems that can reason
 * about tasks, decide which tools to use, and iteratively work towards solutions.
 * {@link createAgent} provides a production-ready ReAct (Reasoning + Acting)
 * agent implementation based on the paper {@link https://arxiv.org/abs/2210.03629|ReAct: Synergizing Reasoning and Acting in Language Models.}
 *
 * @example
 * ```ts
 * import { createAgent, tool } from "langchain";
 * import { z } from "zod/v3";
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
 * const agent = createAgent({
 *   // use chat model from "@langchain/openai"
 *   model: "openai:gpt-4o-mini",
 *   tools: [getWeather]
 * });
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

// ===== V1 OVERLOADS (WITHOUT MIDDLEWARE) =====
// These overloads come first to ensure proper type inference when middleware is NOT provided

// Overload 1: V1 - With responseFormat as single InteropZodType
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
): ReactAgentV1<StateSchema, T, ContextSchema>;

// Overload 2: V1 - With responseFormat as array of InteropZodTypes
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
): ReactAgentV1<
  StateSchema,
  ExtractZodArrayTypes<T> extends Record<string, any>
    ? ExtractZodArrayTypes<T>
    : Record<string, any>,
  ContextSchema
>;

// Overload 3: V1 - With responseFormat as JsonSchemaFormat
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
): ReactAgentV1<StateSchema, Record<string, unknown>, ContextSchema>;

// Overload 4: V1 - With responseFormat as array of JsonSchemaFormat
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
): ReactAgentV1<StateSchema, Record<string, unknown>, ContextSchema>;

// Overload 5: V1 - With responseFormat as union of JsonSchemaFormat | JsonSchemaFormat[]
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
): ReactAgentV1<StateSchema, Record<string, unknown>, ContextSchema>;

// Overload 6: V1 - With responseFormat as TypedToolStrategy
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
): ReactAgentV1<StateSchema, T, ContextSchema>;

// Overload 7: V1 - With responseFormat as single ToolStrategy
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
): ReactAgentV1<StateSchema, T, ContextSchema>;

// Overload 8: V1 - With responseFormat as ProviderStrategy
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
): ReactAgentV1<StateSchema, T, ContextSchema>;

// Overload 9: V1 - Without responseFormat property at all
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
): ReactAgentV1<StateSchema, ResponseFormatUndefined, ContextSchema>;

// Overload 10: V1 - With responseFormat explicitly undefined
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
): ReactAgentV1<StateSchema, ResponseFormatUndefined, ContextSchema>;

// Overload 11: V1 - For other ResponseFormat values (failsafe)
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
    any
  > & {
    responseFormat: any;
  }
): ReactAgentV1<StateSchema, StructuredResponseFormat, ContextSchema>;

// ===== V2 OVERLOADS (WITH MIDDLEWARE) =====
// These overloads explicitly require the middleware property

// Overload 12: With responseFormat as single InteropZodType and middleware
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
  params: CreateAgentParamsV2<T, ContextSchema, InteropZodType<T>> & {
    responseFormat: InteropZodType<T>;
    middleware: TMiddleware;
  }
): ReactAgentV2<T, ContextSchema, TMiddleware>;

// Overload 13: With responseFormat as array of InteropZodTypes and middleware
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
  params: CreateAgentParamsV2<
    ExtractZodArrayTypes<T> extends Record<string, any>
      ? ExtractZodArrayTypes<T>
      : Record<string, any>,
    ContextSchema,
    T
  > & {
    responseFormat: T;
    middleware: TMiddleware;
  }
): ReactAgentV2<
  ExtractZodArrayTypes<T> extends Record<string, any>
    ? ExtractZodArrayTypes<T>
    : Record<string, any>,
  ContextSchema,
  TMiddleware
>;

// Overload 14: With responseFormat as JsonSchemaFormat and middleware
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
  params: CreateAgentParamsV2<
    Record<string, unknown>,
    ContextSchema,
    JsonSchemaFormat
  > & {
    responseFormat: JsonSchemaFormat;
    middleware: TMiddleware;
  }
): ReactAgentV2<Record<string, unknown>, ContextSchema, TMiddleware>;

// Overload 15: With responseFormat as array of JsonSchemaFormat and middleware
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
  params: CreateAgentParamsV2<
    Record<string, unknown>,
    ContextSchema,
    JsonSchemaFormat[]
  > & {
    responseFormat: JsonSchemaFormat[];
    middleware: TMiddleware;
  }
): ReactAgentV2<Record<string, unknown>, ContextSchema, TMiddleware>;

// Overload 16: With responseFormat as union of JsonSchemaFormat | JsonSchemaFormat[] and middleware
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
  params: CreateAgentParamsV2<
    Record<string, unknown>,
    ContextSchema,
    JsonSchemaFormat | JsonSchemaFormat[]
  > & {
    responseFormat: JsonSchemaFormat | JsonSchemaFormat[];
    middleware: TMiddleware;
  }
): ReactAgentV2<Record<string, unknown>, ContextSchema, TMiddleware>;

// Overload 17: With responseFormat as TypedToolStrategy and middleware
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
  params: CreateAgentParamsV2<T, ContextSchema, TypedToolStrategy<T>> & {
    responseFormat: TypedToolStrategy<T>;
    middleware: TMiddleware;
  }
): ReactAgentV2<T, ContextSchema, TMiddleware>;

// Overload 18: With responseFormat as single ToolStrategy and middleware
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
  params: CreateAgentParamsV2<T, ContextSchema, ToolStrategy<T>> & {
    responseFormat: ToolStrategy<T>;
    middleware: TMiddleware;
  }
): ReactAgentV2<T, ContextSchema, TMiddleware>;

// Overload 19: With responseFormat as ProviderStrategy and middleware
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
  params: CreateAgentParamsV2<T, ContextSchema, ProviderStrategy<T>> & {
    responseFormat: ProviderStrategy<T>;
    middleware: TMiddleware;
  }
): ReactAgentV2<T, ContextSchema, TMiddleware>;

// Overload 20: Without responseFormat but with middleware
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
    CreateAgentParamsV2<ResponseFormatUndefined, ContextSchema, never>,
    "responseFormat"
  > & { middleware: TMiddleware }
): ReactAgentV2<ResponseFormatUndefined, ContextSchema, TMiddleware>;

// Overload 21: With responseFormat explicitly undefined and middleware
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
    CreateAgentParamsV2<ResponseFormatUndefined, ContextSchema, never>,
    "responseFormat"
  > & {
    responseFormat?: undefined;
    middleware: TMiddleware;
  }
): ReactAgentV2<ResponseFormatUndefined, ContextSchema, TMiddleware>;

// Overload 22: For other ResponseFormat values with middleware (failsafe)
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
  params: CreateAgentParamsV2<StructuredResponseFormat, ContextSchema, any> & {
    responseFormat: any;
    middleware: TMiddleware;
  }
): ReactAgentV2<StructuredResponseFormat, ContextSchema, TMiddleware>;

export function createAgent(params: any): any {
  /**
   * Check if middleware property is present
   */
  if ("middleware" in params && params.middleware !== undefined) {
    /**
     * The user wants to use the middleware version of the agent.
     * Let's verify that `preModelHook` and `postModelHook` are not provided
     */
    if ("preModelHook" in params || "postModelHook" in params) {
      throw new Error(
        "The `preModelHook` and `postModelHook` parameters are not supported in the middleware version of the agent."
      );
    }

    /**
     * Use v2 (middleware version)
     */
    return createAgentV2(params);
  } else {
    /**
     * Use v1 (original version)
     */
    return createAgentV1(params);
  }
}
