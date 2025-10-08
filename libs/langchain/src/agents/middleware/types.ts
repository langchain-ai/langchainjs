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
 * Base middleware interface.
 */
export interface AgentMiddleware<
  TSchema extends InteropZodObject | undefined = undefined,
  TContextSchema extends
    | InteropZodObject
    | InteropZodDefault<InteropZodObject>
    | InteropZodOptional<InteropZodObject>
    | undefined = undefined,
  TFullContext = any
> {
  stateSchema?: TSchema;
  contextSchema?: TContextSchema;
  name: string;
  beforeModelJumpTo?: JumpToTarget[];
  afterModelJumpTo?: JumpToTarget[];
  tools?: (ClientTool | ServerTool)[];
  /**
   * Runs before each LLM call, can modify call parameters, changes are not persistent
   * e.g. if you change `model`, it will only be changed for the next model call
   *
   * @param options - Current call options (can be modified by previous middleware)
   * @param state - Current state (read-only in this phase)
   * @param runtime - Runtime context and metadata
   * @returns Modified options or undefined to pass through
   */
  modifyModelRequest?(
    request: ModelRequest,
    state: (TSchema extends InteropZodObject
      ? InferInteropZodInput<TSchema>
      : {}) &
      AgentBuiltInState,
    runtime: Runtime<TFullContext>
  ): Promise<Partial<ModelRequest> | void> | Partial<ModelRequest> | void;
  /**
   * Logic to handle model invocation errors and optionally retry.
   *
   * @param error - The exception that occurred during model invocation.
   * @param request - The original model request that failed.
   * @param state - The current agent state.
   * @param runtime - The runtime context.
   * @param attempt - The current attempt number (1-indexed).
   * @returns Modified request to retry with, or undefined/null to propagate the error (re-raise).
   */
  retryModelRequest?(
    error: Error,
    request: ModelRequest,
    state: (TSchema extends InteropZodObject
      ? InferInteropZodInput<TSchema>
      : {}) &
      AgentBuiltInState,
    runtime: Runtime<TFullContext>,
    attempt: number
  ): Promise<ModelRequest | void> | ModelRequest | void;
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
export type InferMiddlewareState<T extends AgentMiddleware<any, any, any>> =
  T extends AgentMiddleware<infer S, any, any>
    ? S extends InteropZodObject
      ? FilterPrivateProps<InferInteropZodOutput<S>>
      : {}
    : {};

/**
 * Helper type to infer the input state schema type from a middleware (all properties optional)
 * This filters out private properties (those starting with underscore)
 */
export type InferMiddlewareInputState<
  T extends AgentMiddleware<any, any, any>
> = T extends AgentMiddleware<infer S, any, any>
  ? S extends InteropZodObject
    ? FilterPrivateProps<InferInteropZodInput<S>>
    : {}
  : {};

/**
 * Helper type to infer merged state from an array of middleware (just the middleware states)
 */
export type InferMiddlewareStates<T = AgentMiddleware<any, any, any>[]> =
  T extends readonly []
    ? {}
    : T extends readonly [infer First, ...infer Rest]
    ? First extends AgentMiddleware<any, any, any>
      ? Rest extends readonly AgentMiddleware<any, any, any>[]
        ? InferMiddlewareState<First> & InferMiddlewareStates<Rest>
        : InferMiddlewareState<First>
      : {}
    : {};

/**
 * Helper type to infer merged input state from an array of middleware (with optional defaults)
 */
export type InferMiddlewareInputStates<
  T extends readonly AgentMiddleware<any, any, any>[]
> = T extends readonly []
  ? {}
  : T extends readonly [infer First, ...infer Rest]
  ? First extends AgentMiddleware<any, any, any>
    ? Rest extends readonly AgentMiddleware<any, any, any>[]
      ? InferMiddlewareInputState<First> & InferMiddlewareInputStates<Rest>
      : InferMiddlewareInputState<First>
    : {}
  : {};

/**
 * Helper type to infer merged state from an array of middleware (includes built-in state)
 */
export type InferMergedState<
  T extends readonly AgentMiddleware<any, any, any>[]
> = InferMiddlewareStates<T> & AgentBuiltInState;

/**
 * Helper type to infer merged input state from an array of middleware (includes built-in state)
 */
export type InferMergedInputState<
  T extends readonly AgentMiddleware<any, any, any>[]
> = InferMiddlewareInputStates<T> & AgentBuiltInState;

/**
 * Helper type to infer the context schema type from a middleware
 */
export type InferMiddlewareContext<T extends AgentMiddleware<any, any, any>> =
  T extends AgentMiddleware<any, infer C, any>
    ? C extends InteropZodObject
      ? InferInteropZodInput<C>
      : {}
    : {};

/**
 * Helper type to infer the input context schema type from a middleware (with optional defaults)
 */
export type InferMiddlewareContextInput<
  T extends AgentMiddleware<any, any, any>
> = T extends AgentMiddleware<any, infer C, any>
  ? C extends InteropZodOptional<infer Inner>
    ? InferInteropZodInput<Inner> | undefined
    : C extends InteropZodObject
    ? InferInteropZodInput<C>
    : {}
  : {};

/**
 * Helper type to infer merged context from an array of middleware
 */
export type InferMiddlewareContexts<
  T extends readonly AgentMiddleware<any, any, any>[]
> = T extends readonly []
  ? {}
  : T extends readonly [infer First, ...infer Rest]
  ? First extends AgentMiddleware<any, any, any>
    ? Rest extends readonly AgentMiddleware<any, any, any>[]
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
export type InferMiddlewareContextInputs<
  T extends readonly AgentMiddleware<any, any, any>[]
> = T extends readonly []
  ? {}
  : T extends readonly [infer First, ...infer Rest]
  ? First extends AgentMiddleware<any, any, any>
    ? Rest extends readonly AgentMiddleware<any, any, any>[]
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
