/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodObject,
  InteropZodDefault,
  InteropZodOptional,
  InferInteropZodInput,
  InferInteropZodOutput,
} from "@langchain/core/utils/types";
import type {
  AgentMiddleware,
  Runtime,
  MiddlewareResult,
  AgentBuiltInState,
  ModelRequest,
  JumpToTarget,
} from "./types.js";
import type { ClientTool, ServerTool } from "../types.js";

/**
 * Creates a middleware instance with automatic schema inference.
 *
 * @param config - Middleware configuration
 * @param config.name - The name of the middleware
 * @param config.stateSchema - The schema of the middleware state
 * @param config.contextSchema - The schema of the middleware context
 * @param config.modifyModelRequest - The function to prepare the model request
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
    | InteropZodOptional<any>
    | InteropZodDefault
    | undefined = undefined
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
   * Explitictly defines which targets are allowed to be jumped to from the `beforeModel` hook.
   */
  beforeModelJumpTo?: JumpToTarget[];
  /**
   * Explitictly defines which targets are allowed to be jumped to from the `afterModel` hook.
   */
  afterModelJumpTo?: JumpToTarget[];
  /**
   * Additional tools registered by the middleware.
   */
  tools?: (ClientTool | ServerTool)[];
  /**
   * The function to modify the model request. This function is called after the `beforeModel` hook of this middleware and before the model is invoked.
   * It allows to modify the model request before it is passed to the model.
   *
   * @param request - The model request
   * @param request.model - The model to use for this step.
   * @param request.messages - The messages to send to the model.
   * @param request.systemMessage - The system message for this step.
   * @param request.toolChoice - The tool choice configuration for this step.
   * @param request.tools - The tools to make available for this step.
   * @param state - The middleware state
   * @param runtime - The middleware runtime
   * @returns The modified model request or undefined to pass through
   */
  modifyModelRequest?: (
    options: ModelRequest,
    state: (TSchema extends InteropZodObject
      ? InferInteropZodInput<TSchema>
      : {}) &
      AgentBuiltInState,
    runtime: Runtime<
      (TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}) &
        AgentBuiltInState,
      TContextSchema extends InteropZodObject
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodDefault
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodOptional<any>
        ? Partial<InferInteropZodOutput<TContextSchema>>
        : never
    >
  ) => Promise<ModelRequest | void> | ModelRequest | void;
  /**
   * The function to run before the model call. This function is called before the model is invoked and before the `modifyModelRequest` hook.
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
      (TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}) &
        AgentBuiltInState,
      TContextSchema extends InteropZodObject
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodDefault
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
      (TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}) &
        AgentBuiltInState,
      TContextSchema extends InteropZodObject
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodDefault
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
    beforeModelJumpTo: config.beforeModelJumpTo,
    afterModelJumpTo: config.afterModelJumpTo,
    tools: config.tools ?? [],
  };

  if (config.modifyModelRequest) {
    middleware.modifyModelRequest = async (options, state, runtime) =>
      Promise.resolve(
        config.modifyModelRequest!(
          options,
          state,
          runtime as Runtime<
            (TSchema extends InteropZodObject
              ? InferInteropZodInput<TSchema>
              : {}) &
              AgentBuiltInState,
            TContextSchema extends InteropZodObject
              ? InferInteropZodOutput<TContextSchema>
              : TContextSchema extends InteropZodDefault
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
            (TSchema extends InteropZodObject
              ? InferInteropZodInput<TSchema>
              : {}) &
              AgentBuiltInState,
            TContextSchema extends InteropZodObject
              ? InferInteropZodOutput<TContextSchema>
              : TContextSchema extends InteropZodDefault
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
            (TSchema extends InteropZodObject
              ? InferInteropZodInput<TSchema>
              : {}) &
              AgentBuiltInState,
            TContextSchema extends InteropZodObject
              ? InferInteropZodOutput<TContextSchema>
              : TContextSchema extends InteropZodDefault
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
