/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodObject,
  InferInteropZodOutput,
  InferInteropZodInput,
  InteropZodDefault,
  InteropZodOptional,
} from "../utils/types/index.js";
import type { LanguageModelLike } from "../language_models/base.js";
import type { BaseMessage, AIMessage, ToolMessage } from "../messages/index.js";
import type { JumpToTarget } from "./constants.js";
import type { ClientTool, ServerTool } from "../tools/index.js";
import type { BaseRuntime as Runtime } from "./runtime.js";

/**
 * Configuration for modifying a model call at runtime.
 * All fields are optional and only provided fields will override defaults.
 *
 * @internal
 * @template TState - The agent's state type, must extend Record<string, unknown>. Defaults to Record<string, unknown>.
 * @template TRuntime - The runtime type. Defaults to Runtime<unknown>.
 */
export interface ModelRequest<
  TState extends Record<string, unknown> = Record<string, unknown>,
  TRuntime = Runtime<unknown>
> {
  /**
   * The model to use for this step.
   */
  model: LanguageModelLike;
  /**
   * The messages to send to the model.
   */
  messages: BaseMessage[];
  /**
   * The system message for this step.
   */
  systemPrompt?: string;
  /**
   * Tool choice configuration (model-specific format).
   * Can be one of:
   * - `"auto"`: means the model can pick between generating a message or calling one or more tools.
   * - `"none"`: means the model will not call any tool and instead generates a message.
   * - `"required"`: means the model must call one or more tools.
   * - `{ type: "function", function: { name: string } }`: The model will use the specified function.
   */
  toolChoice?:
    | "auto"
    | "none"
    | "required"
    | { type: "function"; function: { name: string } };

  /**
   * The tools to make available for this step.
   */
  tools: (ServerTool | ClientTool)[];

  /**
   * The current agent state (includes both middleware state and built-in state).
   */
  state: TState & AgentBuiltInState;

  /**
   * The runtime context containing metadata, signal, writer, interrupt, etc.
   */
  runtime: TRuntime;
}

/**
 * Information about a tool call that has been executed.
 *
 * @internal
 */
export interface ToolCall {
  /**
   * The ID of the tool call.
   */
  id: string;
  /**
   * The name of the tool that was called.
   */
  name: string;
  /**
   * The arguments that were passed to the tool.
   */
  args: Record<string, any>;
  /**
   * The result of the tool call.
   */
  result?: unknown;
  /**
   * An optional error message if the tool call failed.
   */
  error?: string;
}

/**
 * Result type for middleware functions.
 *
 * @internal
 */
export type MiddlewareResult<TState> = TState | void;

/**
 * Represents a tool call request for the wrapToolCall hook.
 * Contains the tool call information along with the agent's current state and runtime.
 *
 * @template TState - The agent's state type, must extend Record<string, unknown>. Defaults to Record<string, unknown>.
 * @template TRuntime - The runtime type. Defaults to Runtime<unknown>.
 * @internal
 */
export interface ToolCallRequest<
  TState extends Record<string, unknown> = Record<string, unknown>,
  TRuntime = Runtime<unknown>
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
  runtime: TRuntime;
}

/**
 * Handler function type for wrapping tool calls.
 * Takes a tool call and returns the tool result or a command.
 * @internal
 */
export type ToolCallHandler<
  Command,
  TState extends Record<string, unknown> = Record<string, unknown>,
  TRuntime = Runtime<unknown>
> = (
  request: ToolCallRequest<TState, TRuntime>
) => Promise<ToolMessage | Command> | ToolMessage | Command;

/**
 * Wrapper function type for the wrapToolCall hook.
 * Allows middleware to intercept and modify tool execution.
 * @internal
 */
export type ToolCallWrapper<
  Command,
  TState extends Record<string, unknown> = Record<string, unknown>,
  TRuntime = Runtime<unknown>
> = (
  request: ToolCallRequest<TState, TRuntime>,
  handler: ToolCallHandler<Command, TState, TRuntime>
) => Promise<ToolMessage | Command> | ToolMessage | Command;

/**
 * Base middleware interface.
 * @internal
 */
export interface AgentMiddleware<
  TSchema extends InteropZodObject | undefined = any,
  TContextSchema extends
    | InteropZodObject
    | InteropZodDefault<InteropZodObject>
    | InteropZodOptional<InteropZodObject>
    | undefined = any
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
    any,
    (TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}) &
      AgentBuiltInState,
    Runtime<
      TContextSchema extends InteropZodObject
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodDefault<any>
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodOptional<any>
        ? Partial<InferInteropZodOutput<TContextSchema>>
        : never
    >
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
   * wrapModelCall: async (request, handler) => {
   *   // Modify request before calling
   *   const modifiedCall = { ...request, systemPrompt: "You are helpful" };
   *
   *   try {
   *     // Call the model
   *     return await handler(modifiedCall);
   *   } catch (error) {
   *     // Handle errors and retry with fallback
   *     const fallbackRequest = { ...request, model: fallbackModel };
   *     return await handler(fallbackRequest);
   *   }
   * }
   * ```
   */
  wrapModelCall?(
    request: ModelRequest<
      (TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}) &
        AgentBuiltInState,
      Runtime<
        TContextSchema extends InteropZodObject
          ? InferInteropZodOutput<TContextSchema>
          : TContextSchema extends InteropZodDefault<any>
          ? InferInteropZodOutput<TContextSchema>
          : TContextSchema extends InteropZodOptional<any>
          ? Partial<InferInteropZodOutput<TContextSchema>>
          : never
      >
    >,
    handler: (
      request: ModelRequest<
        (TSchema extends InteropZodObject
          ? InferInteropZodInput<TSchema>
          : {}) &
          AgentBuiltInState,
        Runtime<
          TContextSchema extends InteropZodObject
            ? InferInteropZodOutput<TContextSchema>
            : TContextSchema extends InteropZodDefault<any>
            ? InferInteropZodOutput<TContextSchema>
            : TContextSchema extends InteropZodOptional<any>
            ? Partial<InferInteropZodOutput<TContextSchema>>
            : never
        >
      >
    ) => Promise<AIMessage> | AIMessage
  ): Promise<AIMessage> | AIMessage;
  beforeAgent?(
    state: (TSchema extends InteropZodObject
      ? InferInteropZodInput<TSchema>
      : {}) &
      AgentBuiltInState,
    runtime: Runtime<
      TContextSchema extends InteropZodObject
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodDefault<any>
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodOptional<any>
        ? Partial<InferInteropZodOutput<TContextSchema>>
        : never
    >
  ):
    | Promise<
        MiddlewareResult<
          Partial<
            TSchema extends InteropZodObject
              ? InferInteropZodInput<TSchema>
              : {}
          >
        >
      >
    | MiddlewareResult<
        Partial<
          TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}
        >
      >;
  beforeModel?(
    state: (TSchema extends InteropZodObject
      ? InferInteropZodInput<TSchema>
      : {}) &
      AgentBuiltInState,
    runtime: Runtime<
      TContextSchema extends InteropZodObject
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodDefault<any>
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodOptional<any>
        ? Partial<InferInteropZodOutput<TContextSchema>>
        : never
    >
  ):
    | Promise<
        MiddlewareResult<
          Partial<
            TSchema extends InteropZodObject
              ? InferInteropZodInput<TSchema>
              : {}
          >
        >
      >
    | MiddlewareResult<
        Partial<
          TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}
        >
      >;
  afterModel?(
    state: (TSchema extends InteropZodObject
      ? InferInteropZodInput<TSchema>
      : {}) &
      AgentBuiltInState,
    runtime: Runtime<
      TContextSchema extends InteropZodObject
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodDefault<any>
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodOptional<any>
        ? Partial<InferInteropZodOutput<TContextSchema>>
        : never
    >
  ):
    | Promise<
        MiddlewareResult<
          Partial<
            TSchema extends InteropZodObject
              ? InferInteropZodInput<TSchema>
              : {}
          >
        >
      >
    | MiddlewareResult<
        Partial<
          TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}
        >
      >;
  afterAgent?(
    state: (TSchema extends InteropZodObject
      ? InferInteropZodInput<TSchema>
      : {}) &
      AgentBuiltInState,
    runtime: Runtime<
      TContextSchema extends InteropZodObject
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodDefault<any>
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodOptional<any>
        ? Partial<InferInteropZodOutput<TContextSchema>>
        : never
    >
  ):
    | Promise<
        MiddlewareResult<
          Partial<
            TSchema extends InteropZodObject
              ? InferInteropZodInput<TSchema>
              : {}
          >
        >
      >
    | MiddlewareResult<
        Partial<
          TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}
        >
      >;
}

/**
 * Type for the agent's built-in state properties.
 * @internal
 */
export type AgentBuiltInState = {
  /**
   * Array of messages representing the conversation history.
   *
   * This includes all messages exchanged during the agent's execution:
   * - Human messages: Input from the user
   * - AI messages: Responses from the language model
   * - Tool messages: Results from tool executions
   * - System messages: System-level instructions or information
   *
   * Messages are accumulated throughout the agent's lifecycle and can be
   * accessed or modified by middleware hooks during execution.
   */
  messages: BaseMessage[];
  /**
   * Structured response data returned by the agent when a `responseFormat` is configured.
   *
   * This property is only populated when you provide a `responseFormat` schema
   * (as Zod or JSON schema) to the agent configuration. The agent will format
   * its final output to match the specified schema and store it in this property.
   *
   * Note: The type is specified as `Record<string, unknown>` because TypeScript cannot
   * infer the actual response format type in contexts like middleware, where the agent's
   * generic type parameters are not accessible. You may need to cast this to your specific
   * response type when accessing it.
   */
  structuredResponse?: Record<string, unknown>;
};

/**
 * Helper type to filter out properties that start with underscore (private properties)
 */
type FilterPrivateProps<T> = {
  [K in keyof T as K extends `_${string}` ? never : K]: T[K];
};

/**
 * Helper type to infer the state schema type from a middleware
 * This filters out private properties (those starting with underscore)
 * @internal
 */
export type InferMiddlewareState<T extends AgentMiddleware> =
  T extends AgentMiddleware<infer S>
    ? S extends InteropZodObject
      ? FilterPrivateProps<InferInteropZodOutput<S>>
      : {}
    : {};

/**
 * Helper type to infer the input state schema type from a middleware (all properties optional)
 * This filters out private properties (those starting with underscore)
 * @internal
 */
export type InferMiddlewareInputState<T extends AgentMiddleware> =
  T extends AgentMiddleware<infer S>
    ? S extends InteropZodObject
      ? FilterPrivateProps<InferInteropZodInput<S>>
      : {}
    : {};

/**
 * Helper type to infer merged state from an array of middleware (just the middleware states)
 * @internal
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
 * @internal
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
 * @internal
 */
export type InferMergedState<T extends readonly AgentMiddleware[]> =
  InferMiddlewareStates<T> & AgentBuiltInState;

/**
 * Helper type to infer merged input state from an array of middleware (includes built-in state)
 * @internal
 */
export type InferMergedInputState<T extends readonly AgentMiddleware[]> =
  InferMiddlewareInputStates<T> & AgentBuiltInState;

/**
 * Helper type to infer the context schema type from a middleware
 * @internal
 */
export type InferMiddlewareContext<T extends AgentMiddleware> =
  T extends AgentMiddleware<any, infer C>
    ? C extends InteropZodObject
      ? InferInteropZodInput<C>
      : {}
    : {};

/**
 * Helper type to infer the input context schema type from a middleware (with optional defaults)
 * @internal
 */
export type InferMiddlewareContextInput<T extends AgentMiddleware> =
  T extends AgentMiddleware<any, infer C>
    ? C extends InteropZodOptional<infer Inner>
      ? InferInteropZodInput<Inner> | undefined
      : C extends InteropZodObject
      ? InferInteropZodInput<C>
      : {}
    : {};

/**
 * Helper type to infer merged context from an array of middleware
 * @internal
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
 * @internal
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
