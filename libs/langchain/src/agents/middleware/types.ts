/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodObject,
  InteropZodDefault,
  InteropZodOptional,
  InferInteropZodInput,
  InferInteropZodOutput,
} from "@langchain/core/utils/types";
import type { InteropZodToStateDefinition } from "@langchain/langgraph/zod";
import type { AnnotationRoot } from "@langchain/langgraph";
import type { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";
import type { Command } from "@langchain/langgraph";

import type { JumpToTarget } from "../constants.js";
import type { ClientTool, ServerTool } from "../tools.js";
import type { Runtime, AgentBuiltInState } from "../runtime.js";
import type { ModelRequest } from "../nodes/types.js";

type PromiseOrValue<T> = T | Promise<T>;

export type AnyAnnotationRoot = AnnotationRoot<any>;

type NormalizedSchemaInput<TSchema extends InteropZodObject | undefined = any> =
  TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {};

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
   * The BaseTool instance being invoked, or undefined if the tool is not
   * registered with the ToolNode.
   *
   * Provides access to tool metadata like name, description, schema, etc.
   *
   * When tool is undefined, this indicates an unregistered tool (e.g., schema-less
   * tools like Anthropic's text editor). Middleware can handle these by checking
   * the tool name and returning a result without calling the handler. If the
   * handler is called with an unregistered tool, validation will occur and return
   * an error message.
   */
  tool: ClientTool | ServerTool | undefined;
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
 * Takes a tool call request and returns the tool result or a command.
 */
export type ToolCallHandler<
  TSchema extends InteropZodObject | undefined = any,
  TContext = unknown
> = (
  request: ToolCallRequest<
    NormalizedSchemaInput<TSchema> & AgentBuiltInState,
    TContext
  >
) => PromiseOrValue<ToolMessage | Command>;

/**
 * Wrapper function type for the wrapToolCall hook.
 * Allows middleware to intercept and modify tool execution.
 */
export type WrapToolCallHook<
  TSchema extends InteropZodObject | undefined = any,
  TContext = unknown
> = (
  request: ToolCallRequest<
    NormalizedSchemaInput<TSchema> & AgentBuiltInState,
    TContext
  >,
  handler: ToolCallHandler<TSchema, TContext>
) => PromiseOrValue<ToolMessage | Command>;

/**
 * Handler function type for wrapping model calls.
 * Takes a model request and returns the AI message response.
 *
 * @param request - The model request containing model, messages, systemPrompt, tools, state, and runtime
 * @returns The AI message response from the model
 */
export type WrapModelCallHandler<
  TSchema extends InteropZodObject | undefined = any,
  TContext = unknown
> = (
  request: ModelRequest<
    NormalizedSchemaInput<TSchema> & AgentBuiltInState,
    TContext
  >
) => PromiseOrValue<AIMessage>;

/**
 * Wrapper function type for the wrapModelCall hook.
 * Allows middleware to intercept and modify model execution.
 * This enables you to:
 * - Modify the request before calling the model (e.g., change system prompt, add/remove tools)
 * - Handle errors and retry with different parameters
 * - Post-process the response
 * - Implement custom caching, logging, or other cross-cutting concerns
 *
 * @param request - The model request containing all parameters needed for the model call
 * @param handler - The function that invokes the model. Call this with a ModelRequest to get the response
 * @returns The AI message response from the model (or a modified version)
 */
export type WrapModelCallHook<
  TSchema extends InteropZodObject | undefined = any,
  TContext = unknown
> = (
  request: ModelRequest<
    NormalizedSchemaInput<TSchema> & AgentBuiltInState,
    TContext
  >,
  handler: WrapModelCallHandler<TSchema, TContext>
) => PromiseOrValue<AIMessage>;

/**
 * Handler function type for the beforeAgent hook.
 * Called once at the start of agent invocation before any model calls or tool executions.
 *
 * @param state - The current agent state (includes both middleware state and built-in state)
 * @param runtime - The runtime context containing metadata, signal, writer, interrupt, etc.
 * @returns A middleware result containing partial state updates or undefined to pass through
 */
export type BeforeAgentHandler<
  TSchema extends InteropZodObject | undefined = any,
  TContext = unknown
> = (
  state: NormalizedSchemaInput<TSchema> & AgentBuiltInState,
  runtime: Runtime<TContext>
) => PromiseOrValue<MiddlewareResult<Partial<NormalizedSchemaInput<TSchema>>>>;

/**
 * Hook type for the beforeAgent lifecycle event.
 * Can be either a handler function or an object with a handler and optional jump targets.
 * This hook is called once at the start of the agent invocation.
 */
export type BeforeAgentHook<
  TSchema extends InteropZodObject | undefined = any,
  TContext = unknown
> =
  | BeforeAgentHandler<TSchema, TContext>
  | {
      hook: BeforeAgentHandler<TSchema, TContext>;
      canJumpTo?: JumpToTarget[];
    };

/**
 * Handler function type for the beforeModel hook.
 * Called before the model is invoked and before the wrapModelCall hook.
 *
 * @param state - The current agent state (includes both middleware state and built-in state)
 * @param runtime - The runtime context containing metadata, signal, writer, interrupt, etc.
 * @returns A middleware result containing partial state updates or undefined to pass through
 */
export type BeforeModelHandler<
  TSchema extends InteropZodObject | undefined = any,
  TContext = unknown
> = (
  state: NormalizedSchemaInput<TSchema> & AgentBuiltInState,
  runtime: Runtime<TContext>
) => PromiseOrValue<MiddlewareResult<Partial<NormalizedSchemaInput<TSchema>>>>;

/**
 * Hook type for the beforeModel lifecycle event.
 * Can be either a handler function or an object with a handler and optional jump targets.
 * This hook is called before each model invocation.
 */
export type BeforeModelHook<
  TSchema extends InteropZodObject | undefined = any,
  TContext = unknown
> =
  | BeforeModelHandler<TSchema, TContext>
  | {
      hook: BeforeModelHandler<TSchema, TContext>;
      canJumpTo?: JumpToTarget[];
    };

/**
 * Handler function type for the afterModel hook.
 * Called after the model is invoked and before any tools are called.
 * Allows modifying the agent state after model invocation, e.g., to update tool call parameters.
 *
 * @param state - The current agent state (includes both middleware state and built-in state)
 * @param runtime - The runtime context containing metadata, signal, writer, interrupt, etc.
 * @returns A middleware result containing partial state updates or undefined to pass through
 */
export type AfterModelHandler<
  TSchema extends InteropZodObject | undefined = any,
  TContext = unknown
> = (
  state: NormalizedSchemaInput<TSchema> & AgentBuiltInState,
  runtime: Runtime<TContext>
) => PromiseOrValue<MiddlewareResult<Partial<NormalizedSchemaInput<TSchema>>>>;

/**
 * Hook type for the afterModel lifecycle event.
 * Can be either a handler function or an object with a handler and optional jump targets.
 * This hook is called after each model invocation.
 */
export type AfterModelHook<
  TSchema extends InteropZodObject | undefined = any,
  TContext = unknown
> =
  | AfterModelHandler<TSchema, TContext>
  | {
      hook: AfterModelHandler<TSchema, TContext>;
      canJumpTo?: JumpToTarget[];
    };

/**
 * Handler function type for the afterAgent hook.
 * Called once at the end of agent invocation after all model calls and tool executions are complete.
 *
 * @param state - The current agent state (includes both middleware state and built-in state)
 * @param runtime - The runtime context containing metadata, signal, writer, interrupt, etc.
 * @returns A middleware result containing partial state updates or undefined to pass through
 */
export type AfterAgentHandler<
  TSchema extends InteropZodObject | undefined = any,
  TContext = unknown
> = (
  state: NormalizedSchemaInput<TSchema> & AgentBuiltInState,
  runtime: Runtime<TContext>
) => PromiseOrValue<MiddlewareResult<Partial<NormalizedSchemaInput<TSchema>>>>;

/**
 * Hook type for the afterAgent lifecycle event.
 * Can be either a handler function or an object with a handler and optional jump targets.
 * This hook is called once at the end of the agent invocation.
 */
export type AfterAgentHook<
  TSchema extends InteropZodObject | undefined = any,
  TContext = unknown
> =
  | AfterAgentHandler<TSchema, TContext>
  | {
      hook: AfterAgentHandler<TSchema, TContext>;
      canJumpTo?: JumpToTarget[];
    };

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
  /**
   * The name of the middleware.
   */
  name: string;

  /**
   * The schema of the middleware state. Middleware state is persisted between multiple invocations. It can be either:
   * - A Zod object
   * - A Zod optional object
   * - A Zod default object
   * - Undefined
   */
  stateSchema?: TSchema;

  /**
   * The schema of the middleware context. Middleware context is read-only and not persisted between multiple invocations. It can be either:
   * - A Zod object
   * - A Zod optional object
   * - A Zod default object
   * - Undefined
   */
  contextSchema?: TContextSchema;

  /**
   * Additional tools registered by the middleware.
   */
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
   * @param handler - The function that executes the tool. Call this with a ToolCallRequest to get the result.
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
   *     const result = await handler(request);
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
   *   return handler(request);
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
   *   const result = await handler(request);
   *   cache.set(cacheKey, result);
   *   return result;
   * }
   * ```
   */
  wrapToolCall?: WrapToolCallHook<TSchema, TFullContext>;

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
   * wrapModelCall: async (request, handler) => {
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
  wrapModelCall?: WrapModelCallHook<TSchema, TFullContext>;

  /**
   * The function to run before the agent execution starts. This function is called once at the start of the agent invocation.
   * It allows to modify the state of the agent before any model calls or tool executions.
   *
   * @param state - The middleware state
   * @param runtime - The middleware runtime
   * @returns The modified middleware state or undefined to pass through
   */
  beforeAgent?: BeforeAgentHook<TSchema, TFullContext>;

  /**
   * The function to run before the model call. This function is called before the model is invoked and before the `wrapModelCall` hook.
   * It allows to modify the state of the agent.
   *
   * @param state - The middleware state
   * @param runtime - The middleware runtime
   * @returns The modified middleware state or undefined to pass through
   */
  beforeModel?: BeforeModelHook<TSchema, TFullContext>;

  /**
   * The function to run after the model call. This function is called after the model is invoked and before any tools are called.
   * It allows to modify the state of the agent after the model is invoked, e.g. to update tool call parameters.
   *
   * @param state - The middleware state
   * @param runtime - The middleware runtime
   * @returns The modified middleware state or undefined to pass through
   */
  afterModel?: AfterModelHook<TSchema, TFullContext>;

  /**
   * The function to run after the agent execution completes. This function is called once at the end of the agent invocation.
   * It allows to modify the final state of the agent after all model calls and tool executions are complete.
   *
   * @param state - The middleware state
   * @param runtime - The middleware runtime
   * @returns The modified middleware state or undefined to pass through
   */
  afterAgent?: AfterAgentHook<TSchema, TFullContext>;
}

/**
 * Helper type to filter out properties that start with underscore (private properties)
 */
type FilterPrivateProps<T> = {
  [K in keyof T as K extends `_${string}` ? never : K]: T[K];
};

export type InferChannelType<T extends AnyAnnotationRoot | InteropZodObject> =
  T extends AnyAnnotationRoot
    ? ToAnnotationRoot<T>["State"]
    : T extends InteropZodObject
    ? InferInteropZodInput<T>
    : {};

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

export type InferSchemaInput<
  A extends AnyAnnotationRoot | InteropZodObject | undefined
> = A extends AnyAnnotationRoot | InteropZodObject
  ? ToAnnotationRoot<A>["State"]
  : {};
