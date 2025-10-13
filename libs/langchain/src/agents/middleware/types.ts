/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodObject,
  InteropZodDefault,
  InteropZodOptional,
  InferInteropZodInput,
  InferInteropZodOutput,
} from "@langchain/core/utils/types";
import type { AnnotationRoot } from "@langchain/langgraph";
import type { InteropZodToStateDefinition } from "@langchain/langgraph/zod";
import type { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";
import type { Command } from "@langchain/langgraph";

import type { JumpToTarget } from "../constants.js";
import type { ClientTool, ServerTool } from "../tools.js";
import type { Runtime, AgentBuiltInState } from "../runtime.js";
import type { ModelRequest } from "../nodes/types.js";

export type AnyAnnotationRoot = AnnotationRoot<any>;

/**
 * Result type for middleware functions.
 */
export type MiddlewareResult<TState> = TState | void;

/**
 * Represents a tool call request for the wrapToolCall hook.
 * Contains the tool call information along with the agent's current state and runtime.
 */
export interface ToolCallRequest<
  TState extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown
> {
  /**
   * The tool call to be executed
   */
  toolCall: ToolCall;
  /**
   * The BaseTool instance being invoked.
   * Provides access to tool metadata like name, description, schema, etc.
   */
  tool: ClientTool | ServerTool;
  /**
   * The current agent state (includes both middleware state and built-in state).
   */
  state: TState & AgentBuiltInState;
  /**
   * The runtime context containing metadata, signal, writer, interrupt, etc.
   */
  runtime: Runtime<TContext>;
}

/**
 * Handler function type for wrapping tool calls.
 * Takes a tool call and returns the tool result or a command.
 */
export type ToolCallHandler = (
  toolCall: ToolCall
) => Promise<ToolMessage | Command> | ToolMessage | Command;

/**
 * Wrapper function type for the wrapToolCall hook.
 * Allows middleware to intercept and modify tool execution.
 */
export type ToolCallWrapper<
  TState extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown
> = (
  request: ToolCallRequest<TState, TContext>,
  handler: ToolCallHandler
) => Promise<ToolMessage | Command> | ToolMessage | Command;

/**
 * Base middleware interface.
 */
export interface AgentMiddleware<
  TSchema extends InteropZodObject | undefined = any,
  TContextSchema extends
    | InteropZodObject
    | InteropZodDefault<InteropZodObject>
    | InteropZodOptional<InteropZodObject>
    | undefined = any,
  TFullContext = any
> {
  stateSchema?: TSchema;
  contextSchema?: TContextSchema;
  name: string;
  beforeAgentJumpTo?: JumpToTarget[];
  beforeModelJumpTo?: JumpToTarget[];
  afterModelJumpTo?: JumpToTarget[];
  afterAgentJumpTo?: JumpToTarget[];
  tools?: (ClientTool | ServerTool)[];
  /**
   * Wraps tool execution with custom logic. This allows you to:
   * - Modify tool call parameters before execution
   * - Handle errors and retry with different parameters
   * - Post-process tool results
   * - Implement caching, logging, authentication, or other cross-cutting concerns
   * - Return Command objects for advanced control flow
   *
   * The handler receives a ToolCallRequest containing the tool call, state, and runtime,
   * along with a handler function to execute the actual tool.
   *
   * @param request - The tool call request containing toolCall, state, and runtime.
   * @param handler - The function that executes the tool. Call this with a ToolCall to get the result.
   * @returns The tool result as a ToolMessage or a Command for advanced control flow.
   *
   * @example
   * ```ts
   * wrapToolCall: async (request, handler) => {
   *   console.log(`Calling tool: ${request.tool.name}`);
   *   console.log(`Tool description: ${request.tool.description}`);
   *
   *   try {
   *     // Execute the tool
   *     const result = await handler(request.toolCall);
   *     console.log(`Tool ${request.tool.name} succeeded`);
   *     return result;
   *   } catch (error) {
   *     console.error(`Tool ${request.tool.name} failed:`, error);
   *     // Could return a custom error message or retry
   *     throw error;
   *   }
   * }
   * ```
   *
   * @example Authentication
   * ```ts
   * wrapToolCall: async (request, handler) => {
   *   // Check if user is authorized for this tool
   *   if (!request.runtime.context.isAuthorized(request.tool.name)) {
   *     return new ToolMessage({
   *       content: "Unauthorized to call this tool",
   *       tool_call_id: request.toolCall.id,
   *     });
   *   }
   *   return handler(request.toolCall);
   * }
   * ```
   *
   * @example Caching
   * ```ts
   * const cache = new Map();
   * wrapToolCall: async (request, handler) => {
   *   const cacheKey = `${request.tool.name}:${JSON.stringify(request.toolCall.args)}`;
   *   if (cache.has(cacheKey)) {
   *     return cache.get(cacheKey);
   *   }
   *   const result = await handler(request.toolCall);
   *   cache.set(cacheKey, result);
   *   return result;
   * }
   * ```
   */
  wrapToolCall?: ToolCallWrapper<
    (TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}) &
      AgentBuiltInState,
    TFullContext
  >;
  /**
   * Wraps the model invocation with custom logic. This allows you to:
   * - Modify the request before calling the model
   * - Handle errors and retry with different parameters
   * - Post-process the response
   * - Implement custom caching, logging, or other cross-cutting concerns
   *
   * @param request - The model request containing model, messages, systemPrompt, tools, state, and runtime.
   * @param handler - The function that invokes the model. Call this with a ModelRequest to get the response.
   * @returns The response from the model (or a modified version).
   *
   * @example
   * ```ts
   * wrapModelRequest: async (request, handler) => {
   *   // Modify request before calling
   *   const modifiedRequest = { ...request, systemPrompt: "You are helpful" };
   *
   *   try {
   *     // Call the model
   *     return await handler(modifiedRequest);
   *   } catch (error) {
   *     // Handle errors and retry with fallback
   *     const fallbackRequest = { ...request, model: fallbackModel };
   *     return await handler(fallbackRequest);
   *   }
   * }
   * ```
   */
  wrapModelRequest?(
    request: ModelRequest<
      (TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}) &
        AgentBuiltInState,
      TFullContext
    >,
    handler: (
      request: ModelRequest<
        (TSchema extends InteropZodObject
          ? InferInteropZodInput<TSchema>
          : {}) &
          AgentBuiltInState,
        TFullContext
      >
    ) => Promise<AIMessage> | AIMessage
  ): Promise<AIMessage> | AIMessage;
  beforeAgent?(
    state: (TSchema extends InteropZodObject
      ? InferInteropZodInput<TSchema>
      : {}) &
      AgentBuiltInState,
    runtime: Runtime<TFullContext>
  ): Promise<
    MiddlewareResult<
      Partial<
        TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}
      >
    >
  >;
  beforeModel?(
    state: (TSchema extends InteropZodObject
      ? InferInteropZodInput<TSchema>
      : {}) &
      AgentBuiltInState,
    runtime: Runtime<TFullContext>
  ): Promise<
    MiddlewareResult<
      Partial<
        TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}
      >
    >
  >;
  afterModel?(
    state: (TSchema extends InteropZodObject
      ? InferInteropZodInput<TSchema>
      : {}) &
      AgentBuiltInState,
    runtime: Runtime<TFullContext>
  ): Promise<
    MiddlewareResult<
      Partial<
        TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}
      >
    >
  >;
  afterAgent?(
    state: (TSchema extends InteropZodObject
      ? InferInteropZodInput<TSchema>
      : {}) &
      AgentBuiltInState,
    runtime: Runtime<TFullContext>
  ): Promise<
    MiddlewareResult<
      Partial<
        TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}
      >
    >
  >;
}

/**
 * Helper type to filter out properties that start with underscore (private properties)
 */
type FilterPrivateProps<T> = {
  [K in keyof T as K extends `_${string}` ? never : K]: T[K];
};

/**
 * Helper type to infer the state schema type from a middleware
 * This filters out private properties (those starting with underscore)
 */
export type InferMiddlewareState<T extends AgentMiddleware> =
  T extends AgentMiddleware<infer S, any, any>
    ? S extends InteropZodObject
      ? FilterPrivateProps<InferInteropZodOutput<S>>
      : {}
    : {};

/**
 * Helper type to infer the input state schema type from a middleware (all properties optional)
 * This filters out private properties (those starting with underscore)
 */
export type InferMiddlewareInputState<T extends AgentMiddleware> =
  T extends AgentMiddleware<infer S, any, any>
    ? S extends InteropZodObject
      ? FilterPrivateProps<InferInteropZodInput<S>>
      : {}
    : {};

/**
 * Helper type to infer merged state from an array of middleware (just the middleware states)
 */
export type InferMiddlewareStates<T = AgentMiddleware[]> = T extends readonly []
  ? {}
  : T extends readonly [infer First, ...infer Rest]
  ? First extends AgentMiddleware
    ? Rest extends readonly AgentMiddleware[]
      ? InferMiddlewareState<First> & InferMiddlewareStates<Rest>
      : InferMiddlewareState<First>
    : {}
  : {};

/**
 * Helper type to infer merged input state from an array of middleware (with optional defaults)
 */
export type InferMiddlewareInputStates<T extends readonly AgentMiddleware[]> =
  T extends readonly []
    ? {}
    : T extends readonly [infer First, ...infer Rest]
    ? First extends AgentMiddleware
      ? Rest extends readonly AgentMiddleware[]
        ? InferMiddlewareInputState<First> & InferMiddlewareInputStates<Rest>
        : InferMiddlewareInputState<First>
      : {}
    : {};

/**
 * Helper type to infer merged state from an array of middleware (includes built-in state)
 */
export type InferMergedState<T extends readonly AgentMiddleware[]> =
  InferMiddlewareStates<T> & AgentBuiltInState;

/**
 * Helper type to infer merged input state from an array of middleware (includes built-in state)
 */
export type InferMergedInputState<T extends readonly AgentMiddleware[]> =
  InferMiddlewareInputStates<T> & AgentBuiltInState;

/**
 * Helper type to infer the context schema type from a middleware
 */
export type InferMiddlewareContext<T extends AgentMiddleware> =
  T extends AgentMiddleware<any, infer C, any>
    ? C extends InteropZodObject
      ? InferInteropZodInput<C>
      : {}
    : {};

/**
 * Helper type to infer the input context schema type from a middleware (with optional defaults)
 */
export type InferMiddlewareContextInput<T extends AgentMiddleware> =
  T extends AgentMiddleware<any, infer C, any>
    ? C extends InteropZodOptional<infer Inner>
      ? InferInteropZodInput<Inner> | undefined
      : C extends InteropZodObject
      ? InferInteropZodInput<C>
      : {}
    : {};

/**
 * Helper type to infer merged context from an array of middleware
 */
export type InferMiddlewareContexts<T extends readonly AgentMiddleware[]> =
  T extends readonly []
    ? {}
    : T extends readonly [infer First, ...infer Rest]
    ? First extends AgentMiddleware
      ? Rest extends readonly AgentMiddleware[]
        ? InferMiddlewareContext<First> & InferMiddlewareContexts<Rest>
        : InferMiddlewareContext<First>
      : {}
    : {};

/**
 * Helper to merge two context types, preserving undefined unions
 */
type MergeContextTypes<A, B> = [A] extends [undefined]
  ? [B] extends [undefined]
    ? undefined
    : B | undefined
  : [B] extends [undefined]
  ? A | undefined
  : [A] extends [B]
  ? A
  : [B] extends [A]
  ? B
  : A & B;

/**
 * Helper type to infer merged input context from an array of middleware (with optional defaults)
 */
export type InferMiddlewareContextInputs<T extends readonly AgentMiddleware[]> =
  T extends readonly []
    ? {}
    : T extends readonly [infer First, ...infer Rest]
    ? First extends AgentMiddleware
      ? Rest extends readonly AgentMiddleware[]
        ? MergeContextTypes<
            InferMiddlewareContextInput<First>,
            InferMiddlewareContextInputs<Rest>
          >
        : InferMiddlewareContextInput<First>
      : {}
    : {};

/**
 * Helper type to extract input type from context schema (with optional defaults)
 */
export type InferContextInput<
  ContextSchema extends AnyAnnotationRoot | InteropZodObject
> = ContextSchema extends InteropZodObject
  ? InferInteropZodInput<ContextSchema>
  : ContextSchema extends AnyAnnotationRoot
  ? ToAnnotationRoot<ContextSchema>["State"]
  : {};

export type ToAnnotationRoot<A extends AnyAnnotationRoot | InteropZodObject> =
  A extends AnyAnnotationRoot
    ? A
    : A extends InteropZodObject
    ? AnnotationRoot<InteropZodToStateDefinition<A>>
    : never;
