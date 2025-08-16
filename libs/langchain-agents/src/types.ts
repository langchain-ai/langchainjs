import type {
  InteropZodObject,
  InteropZodType,
} from "@langchain/core/utils/types";
import type {
  LangGraphRunnableConfig,
  AnnotationRoot,
  START,
  Runtime,
  StateGraph,
} from "@langchain/langgraph";
import type { InteropZodToStateDefinition } from "@langchain/langgraph/zod";
import type { LanguageModelLike } from "@langchain/core/language_models/base";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type {
  SystemMessage,
  BaseMessageLike,
  BaseMessage,
  ToolMessage,
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
  RunnableConfig,
  RunnableToolLike,
} from "@langchain/core/runnables";

import type { ToolNode } from "./nodes/ToolNode.js";
import type { PreHookAnnotation } from "./annotation.js";

export const META_EXTRAS_DESCRIPTION_PREFIX = "lg:";

export type N = typeof START | "agent" | "tools";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAnnotationRoot = AnnotationRoot<any>;

export type ToAnnotationRoot<A extends AnyAnnotationRoot | InteropZodObject> =
  A extends AnyAnnotationRoot
    ? A
    : A extends InteropZodObject
    ? AnnotationRoot<InteropZodToStateDefinition<A>>
    : never;

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

export type StructuredResponseSchemaOptions<StructuredResponseType> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: InteropZodType<StructuredResponseType> | Record<string, any>;
  prompt?: string;

  strict?: boolean;
  [key: string]: unknown;
};

export type CreateReactAgentState<
  AnnotationRoot extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot
> = ToAnnotationRoot<AnnotationRoot>["State"] & PreHookAnnotation["State"];

export type CreateReactAgentRuntime<
  AnnotationRoot extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot
> = Runtime<ToAnnotationRoot<AnnotationRoot>["State"]>;

export type LLM<
  StateSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> =
  | LanguageModelLike
  | ((
      state: CreateReactAgentState<StateSchema>,
      runtime: Runtime<ToAnnotationRoot<ContextSchema>["State"]>
    ) => Promise<LanguageModelLike> | LanguageModelLike);

export type CreateReactAgentParams<
  StateSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StructuredResponseType extends Record<string, any> = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> = {
  /** The chat model that can utilize OpenAI-style tool calling. */
  llm: LLM<StateSchema, ContextSchema>;

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
   */
  prompt?: Prompt<StateSchema, ContextSchema>;

  /**
   * Additional state schema for the agent.
   */
  stateSchema?: StateSchema;

  /**
   * An optional predicate function to stop the agent.
   */
  stopWhen?:
    | PredicateFunction<StructuredResponseType>
    | PredicateFunction<StructuredResponseType>[];

  /**
   * An optional schema for the context.
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
   *   - JSON schema
   *   - { prompt, schema }, where schema is one of the above.
   *        The prompt will be used together with the model that is being used to generate the structured response.
   *
   * @remarks
   * **Important**: `responseFormat` requires the model to support `.withStructuredOutput()`.
   *
   * **Note**: The graph will make a separate call to the LLM to generate the structured response after the agent loop is finished.
   * This is not the only strategy to get structured responses, see more options in [this guide](https://langchain-ai.github.io/langgraph/how-tos/react-agent-structured-output/).
   */
  responseFormat?:
    | InteropZodType<StructuredResponseType>
    | StructuredResponseSchemaOptions<StructuredResponseType>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | Record<string, any>;

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
   * An optional function to handle tool call errors.
   */
  onToolCallError?: (
    toolCall: ToolCallData,
    state: ToAnnotationRoot<StateSchema>["State"] & PreHookAnnotation["State"],
    config: LangGraphRunnableConfig<ToAnnotationRoot<ContextSchema>["State"]>
  ) => void | ToolMessage | Promise<ToolMessage>;

  /**
   * An optional AbortSignal to abort the agent.
   */
  abortSignal?: AbortSignal;
};

export interface ConfigurableModelInterface {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _queuedMethodOperations: Record<string, any>;
  _model: () => Promise<BaseChatModel>;
}

export interface AgentState<
  StructuredResponseType extends Record<string, unknown> = Record<
    string,
    unknown
  >
> {
  messages: BaseMessage[];
  // TODO: This won't be set until we
  // implement managed values in LangGraphJS
  // Will be useful for inserting a message on
  // graph recursion end
  // is_last_step: boolean;
  structuredResponse: StructuredResponseType;
}

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

export interface ToolCallData {
  /**
   * The id of the tool call.
   */
  id: string;
  /**
   * The name of the tool that was called.
   */
  name: string;
  /**
   * The arguments that were passed to the tool.
   */
  args: Record<string, unknown>;
  /**
   * The error that occurred if the tool call failed.
   */
  error: unknown;
}

/**
 * A predicate function that determines when to stop the agent.
 * @param state - The state of the agent.
 * @param config - The config of the agent.
 * @returns A predicate function that can be used to stop the agent.
 */
export type PredicateFunction<
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >
> = (
  state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
  config: RunnableConfig
) => PredicateFunctionReturn | Promise<PredicateFunctionReturn>;

export interface PredicateFunctionReturn {
  shouldStop: boolean;
  description?: string;
}
