/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodDefault,
  InteropZodOptional,
} from "../utils/types/index.js";

/**
 * Type helper to check if TContext is an optional Zod schema
 */
type IsOptionalZodObject<T> = T extends InteropZodOptional<any> ? true : false;
type IsDefaultZodObject<T> = T extends InteropZodDefault<any> ? true : false;

export type WithMaybeContext<TContext> = undefined extends TContext
  ? { readonly context?: TContext }
  : IsOptionalZodObject<TContext> extends true
  ? { readonly context?: TContext }
  : IsDefaultZodObject<TContext> extends true
  ? { readonly context?: TContext }
  : { readonly context: TContext };

export interface IBaseRuntime {}

/**
 * Runtime information available to middleware (readonly).
 */
export type Runtime<TContext = unknown, BaseRuntime = IBaseRuntime> = Partial<
  Omit<BaseRuntime, "context" | "configurable">
> &
  WithMaybeContext<TContext> &
  PrivateState & {
    configurable?: {
      thread_id?: string;
      [key: string]: unknown;
    };
  };

export interface RunLevelPrivateState {
  /**
   * The number of times the model has been called at the run level.
   * This includes multiple agent invocations.
   */
  runModelCallCount: number;
}
export interface ThreadLevelPrivateState {
  /**
   * The number of times the model has been called at the thread level.
   * This includes multiple agent invocations within different environments
   * using the same thread.
   */
  threadLevelCallCount: number;
}

/**
 * As private state we consider all information we want to track within
 * the lifecycle of the agent, without exposing it to the user. These informations
 * are propagated to the user as _readonly_ runtime properties.
 */
export interface PrivateState
  extends ThreadLevelPrivateState,
    RunLevelPrivateState {}
