/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodObject,
  InteropZodDefault,
  InteropZodOptional,
  InferInteropZodInput,
  InferInteropZodOutput,
} from "@langchain/core/utils/types";
import {
  createMiddleware as coreCreateMiddleware,
  type AgentBuiltInState,
  type AgentMiddleware,
  type JumpToTarget,
  type ModelRequest as CoreModelRequest,
  type ToolCallRequest as CoreToolCallRequest,
  type MiddlewareResult,
} from "@langchain/core/middleware";
import type { Command } from "@langchain/langgraph";
import type { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { ClientTool, ServerTool } from "@langchain/core/tools";
import type { Runtime } from "./types.js";

/**
 * Configuration for modifying a model call at runtime.
 * All fields are optional and only provided fields will override defaults.
 *
 * @template TState - The agent's state type, must extend Record<string, unknown>. Defaults to Record<string, unknown>.
 * @template TContext - The runtime context type for accessing metadata and control flow. Defaults to unknown.
 */
export interface ModelRequest<
  TState extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown
> extends CoreModelRequest<TState> {
  /**
   * The runtime context containing metadata, signal, writer, interrupt, etc.
   */
  runtime: Runtime<TContext>;
}

/**
 * Represents a tool call request for the wrapToolCall hook.
 * Contains the tool call information along with the agent's current state and runtime.
 */
export interface ToolCallRequest<
  TState extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown
> extends CoreToolCallRequest<TState> {
  /**
   * The runtime context containing metadata, signal, writer, interrupt, etc.
   */
  runtime: Runtime<TContext>;
}

/**
 * Handler function type for wrapping tool calls.
 * Takes a tool call and returns the tool result or a command.
 */
export type ToolCallHandler<
  Command,
  TState extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown
> = (
  request: ToolCallRequest<TState, TContext>
) => Promise<ToolMessage | Command> | ToolMessage | Command;

/**
 * Wrapper function type for the wrapToolCall hook.
 * Allows middleware to intercept and modify tool execution.
 */
export type ToolCallWrapper<
  Command,
  TState extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown
> = (
  request: ToolCallRequest<TState, TContext>,
  handler: ToolCallHandler<Command, TState, TContext>
) => Promise<ToolMessage | Command> | ToolMessage | Command;

/**
 * Creates a middleware instance with automatic schema inference and LangGraph Runtime support.
 *
 * This is a typed wrapper around the core createMiddleware that provides proper type inference
 * for the LangGraph Runtime type, including properties like `interrupt`, `writer`, and `signal`.
 *
 * @param config - Middleware configuration
 * @param config.name - The name of the middleware
 * @param config.stateSchema - The schema of the middleware state
 * @param config.contextSchema - The schema of the middleware context
 * @param config.wrapModelCall - The function to wrap model invocation
 * @param config.wrapToolCall - The function to wrap tool invocation
 * @param config.beforeModel - The function to run before the model call
 * @param config.afterModel - The function to run after the model call
 * @param config.beforeAgent - The function to run before the agent execution starts
 * @param config.afterAgent - The function to run after the agent execution completes
 * @returns A middleware instance
 *
 * @example
 * ```ts
 * import { createMiddleware } from "langchain";
 * import { z } from "zod";
 *
 * const hitlMiddleware = createMiddleware({
 *   name: "HumanInTheLoop",
 *   beforeModel: async (state, runtime) => {
 *     const userInput = runtime.interrupt?.({
 *       type: "review",
 *       data: state.messages
 *     });
 *     return { approved: userInput === "yes" };
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
    | undefined = undefined
>(config: {
  /**
   * The name of the middleware
   */
  name: string;
  /**
   * The schema of the middleware state. Middleware state is persisted between multiple invocations.
   */
  stateSchema?: TSchema;
  /**
   * The schema of the middleware context. Middleware context is read-only and not persisted between multiple invocations.
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
   * Wraps tool execution with custom logic.
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
    handler: ToolCallHandler<
      Command,
      (TSchema extends InteropZodObject ? InferInteropZodInput<TSchema> : {}) &
        AgentBuiltInState,
      TContextSchema extends InteropZodObject
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodDefault<any>
        ? InferInteropZodOutput<TContextSchema>
        : TContextSchema extends InteropZodOptional<any>
        ? Partial<InferInteropZodOutput<TContextSchema>>
        : never
    >
  ) => Promise<ToolMessage | Command> | ToolMessage | Command;
  /**
   * Wraps the model invocation with custom logic.
   */
  wrapModelCall?: (
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
   * The function to run before the agent execution starts.
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
   * The function to run before the model call.
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
   * The function to run after the model call.
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
   * The function to run after the agent execution completes.
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
  return coreCreateMiddleware(config) as AgentMiddleware<
    TSchema,
    TContextSchema,
    any
  >;
}
