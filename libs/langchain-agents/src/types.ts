import { InteropZodObject, InteropZodType } from "@langchain/core/utils/types";
import {
  LangGraphRunnableConfig,
  AnnotationRoot,
  MessagesAnnotation,
  START,
} from "@langchain/langgraph";
import type { InteropZodToStateDefinition } from "@langchain/langgraph/zod";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import { SystemMessage, BaseMessageLike } from "@langchain/core/messages";
import {
  All,
  BaseCheckpointSaver,
  BaseStore,
} from "@langchain/langgraph-checkpoint";
import { DynamicTool, StructuredToolInterface } from "@langchain/core/tools";
import {
  Runnable,
  RunnableLike,
  RunnableToolLike,
} from "@langchain/core/runnables";

import { ToolNode } from "./ToolNode.js";
import { PreHookAnnotation } from "./PreHookAnnotation.js";

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

export type Prompt =
  | SystemMessage
  | string
  | ((
      state: typeof MessagesAnnotation.State,
      config: LangGraphRunnableConfig
    ) => BaseMessageLike[])
  | ((
      state: typeof MessagesAnnotation.State,
      config: LangGraphRunnableConfig
    ) => Promise<BaseMessageLike[]>)
  | Runnable;

export type CreateReactAgentParams<
  A extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StructuredResponseType = Record<string, any>
> = {
  /** The chat model that can utilize OpenAI-style tool calling. */
  llm: LanguageModelLike;

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
  prompt?: Prompt;
  stateSchema?: A;
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
   * Use to specify how to expose the agent name to the underlying supervisor LLM.
   * - `undefined`: Relies on the LLM provider {@link AIMessage#name}. Currently, only OpenAI supports this.
   * - `"inline"`: Add the agent name directly into the content field of the {@link AIMessage} using XML-style tags.
   *      Example: `"How can I help you"` -> `"<name>agent_name</name><content>How can I help you?</content>"`
   */
  includeAgentName?: "inline" | undefined;

  /**
   * An optional node to add before the `agent` node (i.e., the node that calls the LLM).
   * Useful for managing long message histories (e.g., message trimming, summarization, etc.).
   */
  preModelHook?: RunnableLike<
    ToAnnotationRoot<A>["State"] & PreHookAnnotation["State"],
    ToAnnotationRoot<A>["Update"] & PreHookAnnotation["Update"],
    LangGraphRunnableConfig
  >;

  /**
   * An optional node to add after the `agent` node (i.e., the node that calls the LLM).
   * Useful for implementing human-in-the-loop, guardrails, validation, or other post-processing.
   */
  postModelHook?: RunnableLike<
    ToAnnotationRoot<A>["State"],
    ToAnnotationRoot<A>["Update"],
    LangGraphRunnableConfig
  >;
};

export type StructuredResponseSchemaOptions<StructuredResponseType> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: InteropZodType<StructuredResponseType> | Record<string, any>;
  prompt?: string;

  strict?: boolean;
  [key: string]: unknown;
};
