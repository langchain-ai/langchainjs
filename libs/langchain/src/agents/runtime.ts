/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InteropZodOptional } from "@langchain/core/utils/types";
import type { InteropZodDefault } from "@langchain/core/utils/types";
import type {
  Runtime as LangGraphRuntime,
  PregelOptions,
} from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";

import type { ResponseFormatUndefined } from "./responses.js";

/**
 * Type for the agent's built-in state properties.
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

/**
 * Runtime information available to middleware (readonly).
 */
export type Runtime<TContext = unknown> = Partial<
  Omit<LangGraphRuntime<TContext>, "context" | "configurable">
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

export type InternalAgentState<
  StructuredResponseType extends Record<string, unknown> | undefined = Record<
    string,
    unknown
  >
> = {
  messages: BaseMessage[];
  _privateState?: PrivateState;
} & (StructuredResponseType extends ResponseFormatUndefined
  ? Record<string, never>
  : { structuredResponse: StructuredResponseType });

/**
 * Helper type to check if a type is optional (includes undefined)
 */
type IsOptionalType<T> = undefined extends T ? true : false;

/**
 * Extract non-undefined part of a union that includes undefined
 */
type ExtractNonUndefined<T> = T extends undefined ? never : T;

/**
 * Helper type to check if all properties of a type are optional
 */
export type IsAllOptional<T> =
  // If T includes undefined, then it's optional (can be omitted entirely)
  undefined extends T
    ? true
    : IsOptionalType<T> extends true
    ? true
    : ExtractNonUndefined<T> extends Record<string, any>
    ? {} extends ExtractNonUndefined<T>
      ? true
      : false
    : IsOptionalType<T>;

/**
 * Pregel options that are propagated to the agent
 */
type CreateAgentPregelOptions =
  | "configurable"
  | "durability"
  | "store"
  | "cache"
  | "signal"
  | "recursionLimit"
  | "maxConcurrency"
  | "timeout";

/**
 * Decide whether provided configuration requires a context
 */
export type InvokeConfiguration<ContextSchema extends Record<string, any>> =
  /**
   * If the context schema is a default object, `context` can be optional
   */
  ContextSchema extends InteropZodDefault<any>
    ? Partial<Pick<PregelOptions<any, any, any>, CreateAgentPregelOptions>> & {
        context?: Partial<ContextSchema>;
      }
    : /**
     * If the context schema is all optional, `context` can be optional
     */
    IsAllOptional<ContextSchema> extends true
    ? Partial<Pick<PregelOptions<any, any, any>, CreateAgentPregelOptions>> & {
        context?: Partial<ContextSchema>;
      }
    : Partial<Pick<PregelOptions<any, any, any>, CreateAgentPregelOptions>> &
        WithMaybeContext<ContextSchema>;

export type StreamConfiguration<ContextSchema extends Record<string, any>> =
  /**
   * If the context schema is a default object, `context` can be optional
   */
  ContextSchema extends InteropZodDefault<any>
    ? Partial<Pick<PregelOptions<any, any, any>, CreateAgentPregelOptions>> & {
        context?: Partial<ContextSchema>;
      }
    : /**
     * If the context schema is all optional, `context` can be optional
     */
    IsAllOptional<ContextSchema> extends true
    ? Partial<
        Pick<
          PregelOptions<any, any, any>,
          CreateAgentPregelOptions | "streamMode"
        >
      > & {
        context?: Partial<ContextSchema>;
      }
    : Partial<
        Pick<
          PregelOptions<any, any, any>,
          CreateAgentPregelOptions | "streamMode"
        >
      > &
        WithMaybeContext<ContextSchema>;
