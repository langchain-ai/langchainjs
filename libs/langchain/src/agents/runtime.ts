/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InteropZodDefault } from "@langchain/core/utils/types";
import type {
  PrivateState,
  WithMaybeContext,
} from "@langchain/core/middleware";
import type { PregelOptions } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";

import type { ResponseFormatUndefined } from "./responses.js";

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
