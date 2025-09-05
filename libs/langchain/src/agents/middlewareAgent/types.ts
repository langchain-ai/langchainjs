import { z } from "zod";
import type {
  InteropZodObject,
  InteropZodType,
  InferInteropZodInput,
} from "@langchain/core/utils/types";
import type { LangGraphRunnableConfig, START } from "@langchain/langgraph";

import type { LanguageModelLike } from "@langchain/core/language_models/base";
import type {
  SystemMessage,
  BaseMessageLike,
  BaseMessage,
} from "@langchain/core/messages";
import type {
  All,
  BaseCheckpointSaver,
  BaseStore,
} from "@langchain/langgraph-checkpoint";
import type { Runnable } from "@langchain/core/runnables";

import type { AnyAnnotationRoot, ToAnnotationRoot } from "../annotation.js";
import type { PreHookAnnotation } from "../annotation.js";
import type { AgentRuntime } from "../types.js";

import type {
  ResponseFormat,
  ToolStrategy,
  TypedToolStrategy,
  ProviderStrategy,
  ResponseFormatUndefined,
  JsonSchemaFormat,
} from "../responses.js";
import type { ToolNode } from "../nodes/ToolNode.js";

import type { ClientTool, ServerTool } from "../types.js";

export type N = typeof START | "model_request" | "tools";

export interface BuiltInState {
  messages: BaseMessage[];
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

export interface AnthropicModelSettings {
  cache_control: {
    type: string;
    ttl: string;
  };
}

/**
 * Configuration for modifying a model call at runtime.
 * All fields are optional and only provided fields will override defaults.
 */
export interface PreparedCall {
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
  systemMessage?: string;
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
  tools: (string | ClientTool | ServerTool)[];

  /**
   * The model settings to use for this step.
   * Currently only supported for Anthropic models.
   */
  modelSettings?: AnthropicModelSettings | Record<string, any>;
}

/**
 * Runtime information available to middleware (readonly).
 */
export interface Runtime<TContext = unknown> {
  readonly toolCalls: ToolCall[];
  readonly toolResults: ToolResult[];
  readonly tokenUsage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  };
  readonly context: TContext;
  readonly currentIteration: number;
}

/**
 * Control flow interface for middleware.
 */
export interface Controls<TState = unknown> {
  jumpTo(
    target: "model" | "tools",
    stateUpdate?: Partial<TState>
  ): ControlAction<TState>;
  terminate(result?: Partial<TState> | Error): ControlAction<TState>;
}

/**
 * Control action type returned by control methods.
 */
export type ControlAction<TStateSchema> = {
  type: "jump" | "terminate" | "retry";
  target?: string;
  stateUpdate?: Partial<TStateSchema>;
  result?: any;
  error?: Error;
};

/**
 * Result type for middleware functions.
 */
export type MiddlewareResult<TState> = TState | ControlAction<TState> | void;

/**
 * Type for the agent's built-in state properties.
 */
export type AgentBuiltInState = {
  messages: BaseMessage[];
};

/**
 * Helper type to infer the state schema type from a middleware
 */
export type InferMiddlewareState<T extends AgentMiddleware<any, any, any>> =
  T extends AgentMiddleware<infer S, any, any>
    ? S extends z.ZodObject<any>
      ? z.infer<S>
      : {}
    : {};

/**
 * Helper type to infer the input state schema type from a middleware (all properties optional)
 */
export type InferMiddlewareInputState<
  T extends AgentMiddleware<any, any, any>
> = T extends AgentMiddleware<infer S, any, any>
  ? S extends z.ZodObject<any>
    ? z.input<S>
    : {}
  : {};

/**
 * Helper type to infer merged state from an array of middlewares (just the middleware states)
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
 * Helper type to infer merged input state from an array of middlewares (with optional defaults)
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
 * Helper type to infer merged state from an array of middlewares (includes built-in state)
 */
export type InferMergedState<
  T extends readonly AgentMiddleware<any, any, any>[]
> = InferMiddlewareStates<T> & AgentBuiltInState;

/**
 * Helper type to infer merged input state from an array of middlewares (includes built-in state)
 */
export type InferMergedInputState<
  T extends readonly AgentMiddleware<any, any, any>[]
> = InferMiddlewareInputStates<T> & AgentBuiltInState;

/**
 * Helper type to infer the context schema type from a middleware
 */
export type InferMiddlewareContext<T extends AgentMiddleware<any, any, any>> =
  T extends AgentMiddleware<any, infer C, any>
    ? C extends z.ZodObject<any>
      ? z.infer<C>
      : {}
    : {};

/**
 * Helper type to infer the input context schema type from a middleware (with optional defaults)
 */
export type InferMiddlewareContextInput<
  T extends AgentMiddleware<any, any, any>
> = T extends AgentMiddleware<any, infer C, any>
  ? C extends z.ZodObject<any>
    ? z.input<C>
    : {}
  : {};

/**
 * Helper type to infer merged context from an array of middlewares
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
 * Helper type to infer merged input context from an array of middlewares (with optional defaults)
 */
export type InferMiddlewareContextInputs<
  T extends readonly AgentMiddleware<any, any, any>[]
> = T extends readonly []
  ? {}
  : T extends readonly [infer First, ...infer Rest]
  ? First extends AgentMiddleware<any, any, any>
    ? Rest extends readonly AgentMiddleware<any, any, any>[]
      ? InferMiddlewareContextInput<First> & InferMiddlewareContextInputs<Rest>
      : InferMiddlewareContextInput<First>
    : {}
  : {};

/**
 * Base middleware interface.
 */
export interface AgentMiddleware<
  TSchema extends z.ZodObject<z.ZodRawShape> | undefined = undefined,
  TContextSchema extends z.ZodObject<z.ZodRawShape> | undefined = undefined,
  TFullContext = any
> {
  stateSchema?: TSchema;
  contextSchema?: TContextSchema;
  name: string;
  /**
   * Runs before each LLM call, can modify call parameters, changes are not persistent
   * e.g. if you change `model`, it will only be changed for the next model call
   *
   * @param options - Current call options (can be modified by previous middleware)
   * @param state - Current state (read-only in this phase)
   * @param runtime - Runtime context and metadata
   * @returns Modified options or undefined to pass through
   */
  prepareModelRequest?(
    options: PreparedCall,
    state: (TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}) &
      AgentBuiltInState,
    runtime: Runtime<TFullContext>
  ):
    | Promise<Partial<PreparedCall> | undefined>
    | Partial<PreparedCall>
    | undefined;
  beforeModel?(
    state: (TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}) &
      AgentBuiltInState,
    runtime: Runtime<TFullContext>,
    controls: Controls<
      (TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}) &
        AgentBuiltInState
    >
  ): Promise<
    MiddlewareResult<
      Partial<TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}>
    >
  >;
  afterModel?(
    state: (TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}) &
      AgentBuiltInState,
    runtime: Runtime<TFullContext>,
    controls: Controls<
      (TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}) &
        AgentBuiltInState
    >
  ): Promise<
    MiddlewareResult<
      Partial<TSchema extends z.ZodObject<any> ? z.infer<TSchema> : {}>
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

/**
 * Duplicate of the Prompt type from ../types.ts
 */
export type Prompt<
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> =
  | SystemMessage
  | string
  | ((
      state: AgentBuiltInState,
      config: LangGraphRunnableConfig<ToAnnotationRoot<ContextSchema>["State"]>
    ) => BaseMessageLike[] | Promise<BaseMessageLike[]>)
  | Runnable;

export type DynamicLLMFunction<
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> = (
  state: AgentBuiltInState & PreHookAnnotation["State"],
  runtime: AgentRuntime<ToAnnotationRoot<ContextSchema>["State"]>
) => Promise<LanguageModelLike> | LanguageModelLike;

export type CreateAgentParams<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  /** The chat model that can utilize OpenAI-style tool calling. */
  llm?: LanguageModelLike | DynamicLLMFunction<ContextSchema>;

  /**
   * Initializes a ChatModel based on the provided model name and provider.
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
   */
  model?: string;

  /** A list of tools or a ToolNode. */
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
   * Cannot be used together with `prepareModelRequest`.
   */
  prompt?: Prompt<ContextSchema>;

  /**
   * An optional schema for the context. It allows to pass in a typed context object into the agent
   * invocation and allows to access it in hooks such as `prompt` and middlewares.
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
  /** An optional list of node names to interrupt before running. */
  interruptBefore?: N[] | All;
  /** An optional list of node names to interrupt after running. */
  interruptAfter?: N[] | All;
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
   * Middlewares to run during agent execution.
   * Each middleware can define its own state schema and hook into the agent lifecycle.
   */
  middlewares?: readonly AgentMiddleware<any, any, any>[];

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
 * Helper type to check if all properties of a type are optional
 */
export type IsAllOptional<T> = T extends Record<string, any>
  ? {} extends T
    ? true
    : false
  : true;

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
 * Helper type to get the required config type based on context schema
 */
export type InferAgentConfig<
  ContextSchema extends AnyAnnotationRoot | InteropZodObject,
  TMiddlewares extends readonly AgentMiddleware<any, any, any>[]
> = IsAllOptional<
  InferContextInput<ContextSchema> & InferMiddlewareContextInputs<TMiddlewares>
> extends true
  ?
      | LangGraphRunnableConfig<{
          context?: InferContextInput<ContextSchema> &
            InferMiddlewareContextInputs<TMiddlewares>;
        }>
      | undefined
  : LangGraphRunnableConfig<{
      context: InferContextInput<ContextSchema> &
        InferMiddlewareContextInputs<TMiddlewares>;
    }>;

export type InternalAgentState<
  StructuredResponseType extends Record<string, unknown> | undefined = Record<
    string,
    unknown
  >
> = {
  messages: BaseMessage[];
  __preparedModelOptions?: PreparedCall;
} & (StructuredResponseType extends ResponseFormatUndefined
  ? Record<string, never>
  : { structuredResponse: StructuredResponseType });
