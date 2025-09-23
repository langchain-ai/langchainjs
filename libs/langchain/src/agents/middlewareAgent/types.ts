/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod/v3";
import type {
  InteropZodObject,
  InteropZodDefault,
  InteropZodOptional,
  InteropZodType,
  InteropZodInput,
  InferInteropZodInput,
} from "@langchain/core/utils/types";
import type {
  LangGraphRunnableConfig,
  START,
  PregelOptions,
  Runtime as LangGraphRuntime,
  END,
} from "@langchain/langgraph";

import type { LanguageModelLike } from "@langchain/core/language_models/base";
import type { BaseMessage } from "@langchain/core/messages";
import type {
  BaseCheckpointSaver,
  BaseStore,
} from "@langchain/langgraph-checkpoint";

import { JUMP_TO_TARGETS } from "./constants.js";
import type { AnyAnnotationRoot, ToAnnotationRoot } from "../annotation.js";
import type {
  ResponseFormat,
  ToolStrategy,
  TypedToolStrategy,
  ProviderStrategy,
  JsonSchemaFormat,
} from "../responses.js";
import type { ResponseFormatUndefined } from "../annotation.js";
import type { Interrupt } from "../interrupt.js";
import type { ToolNode } from "../nodes/ToolNode.js";
import type { ClientTool, ServerTool } from "../types.js";

export type N = typeof START | "model_request" | "tools";

export interface BuiltInState {
  messages: BaseMessage[];
  __interrupt__?: Interrupt[];
  /**
   * Optional property to control routing after afterModel middleware execution.
   * When set by middleware, the agent will jump to the specified node instead of
   * following normal routing logic. The property is automatically cleared after use.
   *
   * - "model_request": Jump back to the model for another LLM call
   * - "tools": Jump to tool execution (requires tools to be available)
   */
  jumpTo?: JumpToTarget;
}

/**
 * Information about a tool call that has been executed.
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
 * Information about a tool result from a tool execution.
 */
export interface ToolResult {
  /**
   * The ID of the tool call.
   */
  id: string;
  /**
   * The result of the tool call.
   */
  result: any;
  /**
   * An optional error message if the tool call failed.
   */
  error?: string;
}

/**
 * Configuration for modifying a model call at runtime.
 * All fields are optional and only provided fields will override defaults.
 */
export interface ModelRequest {
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
  systemMessage?: BaseMessage;
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
   * Can be tool names (strings) or tool instances.
   */
  tools: (ClientTool | ServerTool)[];
}

/**
 * Type helper to check if TContext is an optional Zod schema
 */
type IsOptionalZodObject<T> = T extends InteropZodOptional ? true : false;
type IsDefaultZodObject<T> = T extends InteropZodDefault ? true : false;

type WithMaybeContext<TContext> = undefined extends TContext
  ? { readonly context?: TContext }
  : IsOptionalZodObject<TContext> extends true
  ? { readonly context?: TContext }
  : IsDefaultZodObject<TContext> extends true
  ? { readonly context?: TContext }
  : { readonly context: TContext };

/**
 * Runtime information available to middleware (readonly).
 */
export type Runtime<TState = unknown, TContext = unknown> = Partial<
  Omit<LangGraphRuntime<TContext>, "context" | "configurable">
> & {
  readonly toolCalls: ToolCall[];
  /**
   * Terminates the agent with an update to the state or throws an error.
   * @param result - The result to terminate the agent with.
   */
  terminate(result: Partial<TState> | Error): ControlAction<TState>;
} & WithMaybeContext<TContext>;

/**
 * Control action type returned by control methods.
 */
export type ControlAction<TStateSchema> = {
  type: "terminate";
  target?: string;
  stateUpdate?: Partial<TStateSchema>;
  result?: any;
  error?: Error;
};

/**
 * Result type for middleware functions.
 */
export type MiddlewareResult<TState> = TState | void;

/**
 * Type for the agent's built-in state properties.
 */
export type AgentBuiltInState = {
  messages: BaseMessage[];
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
 */
export type InferMiddlewareState<T extends AgentMiddleware<any, any, any>> =
  T extends AgentMiddleware<infer S, any, any>
    ? S extends InteropZodObject
      ? FilterPrivateProps<InferInteropZodInput<S>>
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
    ? FilterPrivateProps<InteropZodInput<S>>
    : {}
  : {};

/**
 * Helper type to infer merged state from an array of middleware (just the middleware states)
 */
export type InferMiddlewareStates<
  T extends readonly AgentMiddleware<any, any, any>[]
> = T extends readonly []
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
  ? C extends z.ZodOptional<infer Inner>
    ? InteropZodInput<Inner> | undefined
    : C extends InteropZodObject
    ? InteropZodInput<C>
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
 * jump targets (user facing)
 */
export type JumpToTarget = (typeof JUMP_TO_TARGETS)[number];
/**
 * jump targets (internal)
 */
export type JumpTo = "model_request" | "tools" | typeof END;

/**
 * Base middleware interface.
 */
export interface AgentMiddleware<
  TSchema extends InteropZodObject | undefined = undefined,
  TContextSchema extends
    | InteropZodObject
    | InteropZodDefault
    | InteropZodOptional
    | undefined = undefined,
  TFullContext = any
> {
  stateSchema?: TSchema;
  contextSchema?: TContextSchema;
  name: string;
  beforeModelJumpTo?: JumpToTarget[];
  afterModelJumpTo?: JumpToTarget[];
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
 * Information about a tool call that has been executed.
 */
export interface ExecutedToolCall {
  /**
   * The name of the tool that was called.
   */
  name: string;
  /**
   * The arguments that were passed to the tool.
   */
  args: Record<string, unknown>;
  /**
   * The ID of the tool call.
   */
  tool_id: string;
  /**
   * The result of the tool call (if available).
   */
  result?: unknown;
}

/**
 * Information about an LLM invocation.
 */
export interface LLMCall {
  /**
   * The messages that were sent to the LLM.
   */
  messages: BaseMessage[];
  /**
   * The response from the LLM.
   */
  response?: BaseMessage;
}

export type CreateAgentParams<
  StructuredResponseType extends Record<string, any> = Record<string, any>,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  ResponseFormatType =
    | InteropZodType<StructuredResponseType>
    | InteropZodType<unknown>[]
    | JsonSchemaFormat
    | JsonSchemaFormat[]
    | ResponseFormat
    | TypedToolStrategy<StructuredResponseType>
    | ToolStrategy<StructuredResponseType>
    | ProviderStrategy<StructuredResponseType>
    | ResponseFormatUndefined
> = {
  /**
   * Defines a model to use for the agent. You can either pass in an instance of a LangChain chat model
   * or a string. If a string is provided the agent initializes a ChatModel based on the provided model name and provider.
   * It supports various model providers and allows for runtime configuration of model parameters.
   *
   * @uses {@link initChatModel}
   * @example
   * ```ts
   * const agent = createAgent({
   *   model: "anthropic:claude-3-7-sonnet-latest",
   *   // ...
   * });
   * ```
   *
   * @example
   * ```ts
   * import { ChatOpenAI } from "@langchain/openai";
   * const agent = createAgent({
   *   model: new ChatOpenAI({ model: "gpt-4o" }),
   *   // ...
   * });
   * ```
   */
  model?: string | LanguageModelLike;

  /**
   * A list of tools or a ToolNode.
   *
   * @example
   * ```ts
   * import { tool } from "langchain";
   *
   * const weatherTool = tool(() => "Sunny!", {
   *   name: "get_weather",
   *   description: "Get the weather for a location",
   *   schema: z.object({
   *     location: z.string().describe("The location to get weather for"),
   *   }),
   * });
   *
   * const agent = createAgent({
   *   tools: [weatherTool],
   *   // ...
   * });
   * ```
   */
  tools?: ToolNode | (ServerTool | ClientTool)[];

  /**
   * An optional prompt for the LLM. This takes full graph state BEFORE the LLM is called and prepares the input to LLM.
   *
   * Can take a few different forms:
   *
   * - str: This is converted to a SystemMessage and added to the beginning of the list of messages in state["messages"].
   * - SystemMessage: this is added to the beginning of the list of messages in state["messages"].
   * - Function: This function should take in full graph state and the output is then passed to the language model.
   * - Runnable: This runnable should take in full graph state and the output is then passed to the language model.
   *
   * Note:
   * Prior to `v0.2.46`, the prompt was set using `stateModifier` / `messagesModifier` parameters.
   * This is now deprecated and will be removed in a future release.
   *
   * Cannot be used together with `modifyModelRequest`.
   */
  prompt?: string;

  /**
   * An optional schema for the context. It allows to pass in a typed context object into the agent
   * invocation and allows to access it in hooks such as `prompt` and middleware.
   * As opposed to the agent state, defined in `stateSchema`, the context is not persisted between
   * agent invocations.
   *
   * @example
   * ```ts
   * const agent = createAgent({
   *   llm: model,
   *   tools: [getWeather],
   *   contextSchema: z.object({
   *     capital: z.string(),
   *   }),
   *   prompt: (state, config) => {
   *     return [
   *       new SystemMessage(`You are a helpful assistant. The capital of France is ${config.context.capital}.`),
   *     ];
   *   },
   * });
   *
   * const result = await agent.invoke({
   *   messages: [
   *     new SystemMessage("You are a helpful assistant."),
   *     new HumanMessage("What is the capital of France?"),
   *   ],
   * }, {
   *   context: {
   *     capital: "Paris",
   *   },
   * });
   * ```
   */
  contextSchema?: ContextSchema;
  /** An optional checkpoint saver to persist the agent's state. */
  checkpointSaver?: BaseCheckpointSaver | boolean;
  /** An optional checkpoint saver to persist the agent's state. Alias of "checkpointSaver". */
  checkpointer?: BaseCheckpointSaver | boolean;
  /**
   * An optional store to persist the agent's state.
   * @see {@link https://docs.langchain.com/oss/javascript/langgraph/memory#memory-storage | Long-term memory}
   */
  store?: BaseStore;
  /**
   * An optional schema for the final agent output.
   *
   * If provided, output will be formatted to match the given schema and returned in the 'structuredResponse' state key.
   * If not provided, `structuredResponse` will not be present in the output state.
   *
   * Can be passed in as:
   *   - Zod schema
   *     ```ts
   *     const agent = createAgent({
   *       responseFormat: z.object({
   *         capital: z.string(),
   *       }),
   *       // ...
   *     });
   *     ```
   *   - JSON schema
   *     ```ts
   *     const agent = createAgent({
   *       responseFormat: {
   *         type: "json_schema",
   *         schema: {
   *           type: "object",
   *           properties: {
   *             capital: { type: "string" },
   *           },
   *           required: ["capital"],
   *         },
   *       },
   *       // ...
   *     });
   *     ```
   *   - Create React Agent ResponseFormat
   *     ```ts
   *     import { providerStrategy, toolStrategy } from "langchain";
   *     const agent = createAgent({
   *       responseFormat: providerStrategy(
   *         z.object({
   *           capital: z.string(),
   *         })
   *       ),
   *       // or
   *       responseFormat: [
   *         toolStrategy({ ... }),
   *         toolStrategy({ ... }),
   *       ]
   *       // ...
   *     });
   *     ```
   *
   * **Note**: The graph will make a separate call to the LLM to generate the structured response after the agent loop is finished.
   * This is not the only strategy to get structured responses, see more options in [this guide](https://langchain-ai.github.io/langgraph/how-tos/react-agent-structured-output/).
   */
  responseFormat?: ResponseFormatType;

  /**
   * Middleware instances to run during agent execution.
   * Each middleware can define its own state schema and hook into the agent lifecycle.
   */
  middleware?: readonly AgentMiddleware<any, any, any>[];

  /**
   * An optional name for the agent.
   */
  name?: string;

  /**
   * An optional description for the agent.
   * This can be used to describe the agent to the underlying supervisor LLM.
   */
  description?: string;

  /**
   * Use to specify how to expose the agent name to the underlying supervisor LLM.
   *   - `undefined`: Relies on the LLM provider {@link AIMessage#name}. Currently, only OpenAI supports this.
   *   - `"inline"`: Add the agent name directly into the content field of the {@link AIMessage} using XML-style tags.
   *       Example: `"How can I help you"` -> `"<name>agent_name</name><content>How can I help you?</content>"`
   */
  includeAgentName?: "inline" | undefined;

  /**
   * An optional abort signal that indicates that the overall operation should be aborted.
   */
  signal?: AbortSignal;

  /**
   * Determines the version of the graph to create.
   *
   * Can be one of
   * - `"v1"`: The tool node processes a single message. All tool calls in the message are
   *           executed in parallel within the tool node.
   * - `"v2"`: The tool node processes a single tool call. Tool calls are distributed across
   *           multiple instances of the tool node using the Send API.
   *
   * @default `"v2"`
   */
  version?: "v1" | "v2";
};

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
export type IsAllOptional<T> = IsOptionalType<T> extends true
  ? true
  : ExtractNonUndefined<T> extends Record<string, any>
  ? {} extends ExtractNonUndefined<T>
    ? true
    : false
  : IsOptionalType<T>;

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

/**
 * Helper to check if ContextSchema is the default (AnyAnnotationRoot)
 */
type IsDefaultContext<T> = [T] extends [AnyAnnotationRoot]
  ? any extends T
    ? true
    : false
  : false;

/**
 * Helper type to get the required config type based on context schema
 */
export type InferAgentConfig<
  ContextSchema extends AnyAnnotationRoot | InteropZodObject,
  TMiddleware extends readonly AgentMiddleware<any, any, any>[]
> = IsDefaultContext<ContextSchema> extends true
  ? IsAllOptional<InferMiddlewareContextInputs<TMiddleware>> extends true
    ?
        | LangGraphRunnableConfig<{
            context?: InferMiddlewareContextInputs<TMiddleware>;
          }>
        | undefined
    : LangGraphRunnableConfig<{
        context: InferMiddlewareContextInputs<TMiddleware>;
      }>
  : IsAllOptional<
      InferContextInput<ContextSchema> &
        InferMiddlewareContextInputs<TMiddleware>
    > extends true
  ?
      | LangGraphRunnableConfig<{
          context?: InferContextInput<ContextSchema> &
            InferMiddlewareContextInputs<TMiddleware>;
        }>
      | undefined
  : LangGraphRunnableConfig<{
      context: InferContextInput<ContextSchema> &
        InferMiddlewareContextInputs<TMiddleware>;
    }>;

export type InternalAgentState<
  StructuredResponseType extends Record<string, unknown> | undefined = Record<
    string,
    unknown
  >
> = {
  messages: BaseMessage[];
  __preparedModelOptions?: ModelRequest;
} & (StructuredResponseType extends ResponseFormatUndefined
  ? Record<string, never>
  : { structuredResponse: StructuredResponseType });

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

export type InvokeConfiguration<ContextSchema extends Record<string, any>> =
  IsAllOptional<ContextSchema> extends true
    ? Partial<Pick<PregelOptions<any, any, any>, CreateAgentPregelOptions>> & {
        context?: Partial<ContextSchema>;
      }
    : Partial<Pick<PregelOptions<any, any, any>, CreateAgentPregelOptions>> &
        WithMaybeContext<ContextSchema>;

export type StreamConfiguration<ContextSchema extends Record<string, any>> =
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
