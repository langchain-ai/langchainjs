import type {
  InteropZodObject,
  InteropZodType,
} from "@langchain/core/utils/types";
import type {
  LangGraphRunnableConfig,
  START,
  Runtime,
  StateGraph,
} from "@langchain/langgraph";

import type { LanguageModelLike } from "@langchain/core/language_models/base";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
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
import type {
  DynamicTool,
  StructuredToolInterface,
} from "@langchain/core/tools";
import type {
  Runnable,
  RunnableLike,
  RunnableToolLike,
} from "@langchain/core/runnables";
import type { ToolNode } from "./nodes/ToolNode.js";
import type {
  PreHookAnnotation,
  AnyAnnotationRoot,
  ToAnnotationRoot,
} from "./annotation.js";
import type {
  ResponseFormat,
  ToolStrategy,
  TypedToolStrategy,
  ProviderStrategy,
  ResponseFormatUndefined,
  JsonSchemaFormat,
} from "./responses.js";

export const META_EXTRAS_DESCRIPTION_PREFIX = "lg:";

export type N = typeof START | "agent" | "tools";

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
 * Type helper to extract the inferred type from a single Zod schema or array of schemas
 */
export type ExtractZodType<T> = T extends InteropZodType<infer U>
  ? U
  : T extends readonly InteropZodType<any>[]
  ? ExtractZodArrayTypes<T>
  : never;

/**
 * Type helper to extract union type from an array of Zod schemas
 */
export type ExtractZodArrayTypes<T extends readonly InteropZodType<any>[]> =
  T extends readonly [InteropZodType<infer A>, ...infer Rest]
    ? Rest extends readonly InteropZodType<any>[]
      ? A | ExtractZodArrayTypes<Rest>
      : A
    : never;

/**
 * Type helper to extract the structured response type from responseFormat
 */
export type InferResponseFormatType<T> = T extends InteropZodType<infer U>
  ? U extends Record<string, any>
    ? U
    : Record<string, any>
  : T extends readonly InteropZodType<any>[]
  ? ExtractZodArrayTypes<T>
  : T extends ToolStrategy[]
  ? Record<string, any> // ToolStrategy arrays will be handled at runtime
  : T extends ResponseFormat
  ? Record<string, any> // Single ResponseFormat will be handled at runtime
  : Record<string, any>;

/** @internal */
export type ReducedZodChannel<
  T extends InteropZodType,
  TReducerSchema extends InteropZodType
> = T & {
  lg_reducer_schema: TReducerSchema;
};

export type ServerTool = Record<string, unknown>;
export type ClientTool =
  | StructuredToolInterface
  | DynamicTool
  | RunnableToolLike;

export type Prompt<
  StateSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> =
  | SystemMessage
  | string
  | ((
      state: ToAnnotationRoot<StateSchema>["State"] &
        PreHookAnnotation["State"],
      config: LangGraphRunnableConfig<ToAnnotationRoot<ContextSchema>["State"]>
    ) => BaseMessageLike[] | Promise<BaseMessageLike[]>)
  | Runnable;

export type AgentState<
  AnnotationRoot extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot
> = ToAnnotationRoot<AnnotationRoot>["State"] & PreHookAnnotation["State"];

export type AgentRuntime<
  AnnotationRoot extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot
> = Runtime<ToAnnotationRoot<AnnotationRoot>["State"]>;

export type CreateReactAgentParams<
  StateSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
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
  llm: LanguageModelLike | DynamicLLMFunction<StateSchema, ContextSchema>;

  /** A list of tools or a ToolNode. */
  tools: ToolNode | (ServerTool | ClientTool)[];

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
   * Cannot be used together with `prepareCall`.
   */
  prompt?: Prompt<StateSchema, ContextSchema>;

  /**
   * Additional state schema for the agent. It allows to define additional state keys that will be
   * persisted between agent invocations.
   *
   * @example
   * ```ts
   * // State schema defines data that persists across agent invocations
   * const stateSchema = z.object({
   *   userPreferences: z.object({
   *     theme: z.enum(["light", "dark"]),
   *     language: z.string(),
   *   }),
   *   taskHistory: z.array(z.string()),
   *   currentWorkflow: z.string().optional(),
   * });
   *
   * // Context schema defines runtime parameters passed per invocation
   * const contextSchema = z.object({ ... });
   *
   * const agent = createReactAgent({
   *   llm: model,
   *   tools: [updatePreferences, addTask],
   *   stateSchema,    // Persisted: preferences, e.g. task history, workflow state
   *   contextSchema,  // Per-invocation: user ID, session, API keys, etc.
   *   prompt: (state, config) => {
   *     // ...
   *   },
   * });
   *
   * // First invocation - state starts empty, context provided
   * await agent.invoke({
   *   messages: [new HumanMessage("Set my theme to dark")],
   * }, {
   *   context: { userId: "user123", sessionId: "sess456", apiKeys: {...} }
   * });
   *
   * // Second invocation - state persists, new context
   * await agent.invoke({
   *   messages: [new HumanMessage("Add a task to review code")],
   * }, {
   *   context: { userId: "user123", sessionId: "sess789", apiKeys: {...} }
   * });
   * // State now contains: userPreferences.theme="dark", taskHistory=["review code"]
   * ```
   */
  stateSchema?: StateSchema;

  /**
   * An optional schema for the context. It allows to pass in a typed context object into the agent
   * invocation and allows to access it in hooks such as `prompt`, `preModelHook`, `postModelHook`, etc.
   * As opposed to the agent state, defined in `stateSchema`, the context is not persisted between
   * agent invocations.
   *
   * @example
   * ```ts
   * const agent = createReactAgent({
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
   *     const agent = createReactAgent({
   *       responseFormat: z.object({
   *         capital: z.string(),
   *       }),
   *       // ...
   *     });
   *     ```
   *   - JSON schema
   *     ```ts
   *     const agent = createReactAgent({
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
   *     const agent = createReactAgent({
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
   * An optional node to add before the `agent` node (i.e., the node that calls the LLM).
   * Useful for managing long message histories (e.g., message trimming, summarization, etc.).
   */
  preModelHook?: RunnableLike<
    ToAnnotationRoot<StateSchema>["State"] & PreHookAnnotation["State"],
    ToAnnotationRoot<StateSchema>["Update"] & PreHookAnnotation["Update"],
    LangGraphRunnableConfig<ToAnnotationRoot<ContextSchema>["State"]>
  >;

  /**
   * An optional node to add after the `agent` node (i.e., the node that calls the LLM).
   * Useful for implementing human-in-the-loop, guardrails, validation, or other post-processing.
   */
  postModelHook?: RunnableLike<
    ToAnnotationRoot<StateSchema>["State"] & PreHookAnnotation["State"],
    ToAnnotationRoot<StateSchema>["Update"] & PreHookAnnotation["Update"],
    LangGraphRunnableConfig<ToAnnotationRoot<ContextSchema>["State"]>
  >;

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

export interface ConfigurableModelInterface {
  _queuedMethodOperations: Record<string, unknown>;
  _model: () => Promise<BaseChatModel>;
}

export type InternalAgentState<
  StructuredResponseType extends Record<string, unknown> | undefined = Record<
    string,
    unknown
  >
> = {
  messages: BaseMessage[];
  // TODO: This won't be set until we
  // implement managed values in LangGraphJS
  // Will be useful for inserting a message on
  // graph recursion end
  // is_last_step: boolean;
} & (StructuredResponseType extends ResponseFormatUndefined
  ? Record<string, never>
  : { structuredResponse: StructuredResponseType });

export type WithStateGraphNodes<
  K extends string,
  Graph
> = Graph extends StateGraph<
  infer SD,
  infer S,
  infer U,
  infer N,
  infer I,
  infer O,
  infer C
>
  ? StateGraph<SD, S, U, N | K, I, O, C>
  : never;

/**
 * @deprecated likely to be removed in the next version of the agent
 */
type DynamicLLMFunction<
  StateSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> = (
  state: ToAnnotationRoot<StateSchema>["State"] & PreHookAnnotation["State"],
  runtime: Runtime<ToAnnotationRoot<ContextSchema>["State"]>
) => Promise<LanguageModelLike> | LanguageModelLike;
