/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodObject,
  InteropZodDefault,
  InteropZodOptional,
  InferInteropZodInput,
  InferInteropZodOutput,
} from "@langchain/core/utils/types";
import type { AIMessage, ToolMessage } from "@langchain/core/messages";

import type { JumpToTarget } from "./constants.js";
import type { ClientTool, ServerTool } from "../tools/index.js";
import type { Runtime } from "./runtime.js";
import type {
  AgentBuiltInState,
  AgentMiddleware,
  MiddlewareResult,
  ToolCallRequest,
  ToolCallHandler,
  ModelRequest,
} from "./types.js";
/**
 * Creates a middleware instance with automatic schema inference.
 *
 * @param config - Middleware configuration
 * @param config.name - The name of the middleware
 * @param config.stateSchema - The schema of the middleware state
 * @param config.contextSchema - The schema of the middleware context
 * @param config.wrapModelRequest - The function to wrap model invocation
 * @param config.beforeModel - The function to run before the model call
 * @param config.afterModel - The function to run after the model call
 * @returns A middleware instance
 *
 * @example
 * ```ts
 * const authMiddleware = createMiddleware({
 *   name: "AuthMiddleware",
 *   stateSchema: z.object({
 *     isAuthenticated: z.boolean().default(false),
 *   }),
 *   contextSchema: z.object({
 *     userId: z.string(),
 *   }),
 *   beforeModel: async (state, runtime, controls) => {
 *     if (!state.isAuthenticated) {
 *       return controls.terminate(new Error("Not authenticated"));
 *     }
 *   },
 * });
 * ```
 */
export function createMiddleware<
  TSchema extends InteropZodObject | undefined = undefined,
  TContextSchema extends
    | InteropZodObject
    | InteropZodOptional<InteropZodObject>
    | InteropZodDefault<InteropZodObject>
    | undefined = undefined,
  Command = void
>(config: {
  /**
   * The name of the middleware
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
   * Explitictly defines which targets are allowed to be jumped to from the `beforeAgent` hook.
   */
  beforeAgentJumpTo?: JumpToTarget[];
  /**
   * Explitictly defines which targets are allowed to be jumped to from the `beforeModel` hook.
   */
  beforeModelJumpTo?: JumpToTarget[];
  /**
   * Explitictly defines which targets are allowed to be jumped to from the `afterModel` hook.
   */
  afterModelJumpTo?: JumpToTarget[];
  /**
   * Explitictly defines which targets are allowed to be jumped to from the `afterAgent` hook.
   */
  afterAgentJumpTo?: JumpToTarget[];
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
   */
  wrapToolCall?: (
    request: ToolCallRequest<
      (TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}) &
        AgentBuiltInState,
      TContextSchema extends InteropZodObject
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodDefault<any>
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodOptional<any>
        ? Partial<InferInteropZodOutput<TContextSchema>>
        : never
    >,
    handler: ToolCallHandler<Command>
  ) =>
    | Promise<ToolMessage | any /* Command */>
    | ToolMessage
    | any /* Command */;
  /**
   * Wraps the model invocation with custom logic. This allows you to:
   * - Modify the request before calling the model
   * - Handle errors and retry with different parameters
   * - Post-process the response
   * - Implement custom caching, logging, or other cross-cutting concerns
   *
   * The request parameter contains: model, messages, systemPrompt, tools, state, and runtime.
   *
   * @param request - The model request containing all the parameters needed.
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
  wrapModelRequest?: (
    request: ModelRequest<
      (TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}) &
        AgentBuiltInState,
      TContextSchema extends InteropZodObject
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodDefault<any>
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodOptional<any>
        ? Partial<InferInteropZodOutput<TContextSchema>>
        : never
    >,
    handler: (
      request: ModelRequest<
        (TSchema extends InteropZodObject
          ? InferInteropZodInput<TSchema>
          : {}) &
          AgentBuiltInState,
        TContextSchema extends InteropZodObject
          ? InferInteropZodOutput<TContextSchema>
          : TContextSchema extends InteropZodDefault<any>
          ? InferInteropZodOutput<TContextSchema>
          : TContextSchema extends InteropZodOptional<any>
          ? Partial<InferInteropZodOutput<TContextSchema>>
          : never
      >
    ) => Promise<AIMessage> | AIMessage
  ) => Promise<AIMessage> | AIMessage;
  /**
   * The function to run before the agent execution starts. This function is called once at the start of the agent invocation.
   * It allows to modify the state of the agent before any model calls or tool executions.
   *
   * @param state - The middleware state
   * @param runtime - The middleware runtime
   * @returns The modified middleware state or undefined to pass through
   */
  beforeAgent?: (
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
  ) =>
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
  /**
   * The function to run before the model call. This function is called before the model is invoked and before the `wrapModelRequest` hook.
   * It allows to modify the state of the agent.
   *
   * @param state - The middleware state
   * @param runtime - The middleware runtime
   * @returns The modified middleware state or undefined to pass through
   */
  beforeModel?: (
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
  ) =>
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
  /**
   * The function to run after the model call. This function is called after the model is invoked and before any tools are called.
   * It allows to modify the state of the agent after the model is invoked, e.g. to update tool call parameters.
   *
   * @param state - The middleware state
   * @param runtime - The middleware runtime
   * @returns The modified middleware state or undefined to pass through
   */
  afterModel?: (
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
  ) =>
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
  /**
   * The function to run after the agent execution completes. This function is called once at the end of the agent invocation.
   * It allows to modify the final state of the agent after all model calls and tool executions are complete.
   *
   * @param state - The middleware state
   * @param runtime - The middleware runtime
   * @returns The modified middleware state or undefined to pass through
   */
  afterAgent?: (
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
  ) =>
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
}): AgentMiddleware<TSchema, TContextSchema, any> {
  const middleware: AgentMiddleware<TSchema, TContextSchema, any> = {
    name: config.name,
    stateSchema: config.stateSchema,
    contextSchema: config.contextSchema,
    beforeAgentJumpTo: config.beforeAgentJumpTo,
    beforeModelJumpTo: config.beforeModelJumpTo,
    afterModelJumpTo: config.afterModelJumpTo,
    afterAgentJumpTo: config.afterAgentJumpTo,
    tools: config.tools ?? [],
  };

  if (config.wrapToolCall) {
    middleware.wrapToolCall = async (request, handler) =>
      Promise.resolve(config.wrapToolCall!(request, handler));
  }

  if (config.wrapModelRequest) {
    middleware.wrapModelRequest = async (request, handler) =>
      Promise.resolve(config.wrapModelRequest!(request, handler));
  }

  if (config.beforeAgent) {
    middleware.beforeAgent = async (state, runtime) =>
      Promise.resolve(
        config.beforeAgent!(
          state,
          runtime as Runtime<
            TContextSchema extends InteropZodObject
              ? InferInteropZodOutput<TContextSchema>
              : TContextSchema extends InteropZodDefault<any>
              ? InferInteropZodOutput<TContextSchema>
              : TContextSchema extends InteropZodOptional<any>
              ? Partial<InferInteropZodOutput<TContextSchema>>
              : never
          >
        )
      );
  }

  if (config.beforeModel) {
    middleware.beforeModel = async (state, runtime) =>
      Promise.resolve(
        config.beforeModel!(
          state,
          runtime as Runtime<
            TContextSchema extends InteropZodObject
              ? InferInteropZodOutput<TContextSchema>
              : TContextSchema extends InteropZodDefault<any>
              ? InferInteropZodOutput<TContextSchema>
              : TContextSchema extends InteropZodOptional<any>
              ? Partial<InferInteropZodOutput<TContextSchema>>
              : never
          >
        )
      );
  }

  if (config.afterModel) {
    middleware.afterModel = async (state, runtime) =>
      Promise.resolve(
        config.afterModel!(
          state,
          runtime as Runtime<
            TContextSchema extends InteropZodObject
              ? InferInteropZodOutput<TContextSchema>
              : TContextSchema extends InteropZodDefault<any>
              ? InferInteropZodOutput<TContextSchema>
              : TContextSchema extends InteropZodOptional<any>
              ? Partial<InferInteropZodOutput<TContextSchema>>
              : never
          >
        )
      );
  }

  if (config.afterAgent) {
    middleware.afterAgent = async (state, runtime) =>
      Promise.resolve(
        config.afterAgent!(
          state,
          runtime as Runtime<
            TContextSchema extends InteropZodObject
              ? InferInteropZodOutput<TContextSchema>
              : TContextSchema extends InteropZodDefault<any>
              ? InferInteropZodOutput<TContextSchema>
              : TContextSchema extends InteropZodOptional<any>
              ? Partial<InferInteropZodOutput<TContextSchema>>
              : never
          >
        )
      );
  }

  return middleware;
}
