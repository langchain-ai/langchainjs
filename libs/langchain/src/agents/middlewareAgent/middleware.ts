/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod/v3";
import type {
  AgentMiddleware,
  Runtime,
  MiddlewareResult,
  AgentBuiltInState,
  ModelRequest,
} from "./types.js";

/**
 * Creates a middleware instance with automatic schema inference.
 *
 * @param config - Middleware configuration
 * @param config.name - The name of the middleware
 * @param config.stateSchema - The schema of the middleware state
 * @param config.contextSchema - The schema of the middleware context
 * @param config.prepareModelRequest - The function to prepare the model request
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
  TSchema extends z.ZodObject<any> | undefined = undefined,
  TContextSchema extends z.ZodObject<any> | undefined = undefined
>(config: {
  name: string;
  stateSchema?: TSchema;
  contextSchema?: TContextSchema;
  prepareModelRequest?: (
    options: ModelRequest,
    state: (TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}) &
      AgentBuiltInState,
    runtime: Runtime<
      TSchema,
      TContextSchema extends z.ZodObject<any> ? z.infer<TContextSchema> : {}
    >
  ) => Promise<ModelRequest | void> | ModelRequest | void;
  beforeModel?: (
    state: (TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}) &
      AgentBuiltInState,
    runtime: Runtime<
      TSchema,
      TContextSchema extends z.ZodObject<any> ? z.infer<TContextSchema> : {}
    >
  ) =>
    | Promise<
        MiddlewareResult<
          Partial<TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}>
        >
      >
    | MiddlewareResult<
        Partial<TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}>
      >;
  afterModel?: (
    state: (TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}) &
      AgentBuiltInState,
    runtime: Runtime<
      TSchema,
      TContextSchema extends z.ZodObject<any> ? z.infer<TContextSchema> : {}
    >
  ) =>
    | Promise<
        MiddlewareResult<
          Partial<TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}>
        >
      >
    | MiddlewareResult<
        Partial<TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}>
      >;
}): AgentMiddleware<TSchema, TContextSchema, any> {
  const middleware: AgentMiddleware<TSchema, TContextSchema, any> = {
    name: config.name,
    stateSchema: config.stateSchema,
    contextSchema: config.contextSchema,
  };

  if (config.prepareModelRequest) {
    middleware.prepareModelRequest = async (options, state, runtime) =>
      Promise.resolve(
        config.prepareModelRequest!(options, state, runtime as any)
      );
  }

  if (config.beforeModel) {
    middleware.beforeModel = async (state, runtime) =>
      Promise.resolve(config.beforeModel!(state, runtime as any));
  }

  if (config.afterModel) {
    middleware.afterModel = async (state, runtime) =>
      Promise.resolve(config.afterModel!(state, runtime as any));
  }

  return middleware;
}
