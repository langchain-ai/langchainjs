/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodObject,
  InteropZodType,
} from "@langchain/core/utils/types";
import type { START, END, StateGraph } from "@langchain/langgraph";

import type { LanguageModelLike } from "@langchain/core/language_models/base";
import type { BaseMessage, SystemMessage } from "@langchain/core/messages";
import type {
  BaseCheckpointSaver,
  BaseStore,
} from "@langchain/langgraph-checkpoint";
import type { Messages } from "@langchain/langgraph/";
import type { ClientTool, ServerTool } from "@langchain/core/tools";

import type {
  ResponseFormat,
  ToolStrategy,
  TypedToolStrategy,
  ProviderStrategy,
  JsonSchemaFormat,
  ResponseFormatUndefined,
} from "./responses.js";
import type {
  AgentMiddleware,
  AnyAnnotationRoot,
  InferSchemaInput,
} from "./middleware/types.js";
import type { JumpToTarget } from "./constants.js";

export type N = typeof START | "model_request" | "tools";

/**
 * Represents information about an interrupt.
 */
export interface Interrupt<TValue = unknown> {
  /**
   * The ID of the interrupt.
   */
  id: string;
  /**
   * The requests for human input.
   */
  value: TValue;
}

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
 * Base input type for `.invoke` and `.stream` methods.
 */
export type UserInput<
  TStateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject
    | undefined = undefined
> = InferSchemaInput<TStateSchema> & {
  messages: Messages;
};

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
 * jump targets (internal)
 */
export type JumpTo = "model_request" | "tools" | typeof END;

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

export type CreateAgentParams<
  StructuredResponseType extends Record<string, any> = Record<string, any>,
  StateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject
    | undefined = undefined,
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
  model: string | LanguageModelLike;

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
  tools?: (ServerTool | ClientTool)[];

  /**
   * An optional system message for the model.
   *
   * **Use a `string`** for simple, static system prompts. This is the most common use case
   * and works well with template literals for dynamic content. When a string is provided,
   * it's converted to a single text block internally.
   *
   * **Use a `SystemMessage`** when you need advanced features that require structured content:
   * - **Anthropic cache control**: Use `SystemMessage` with array content to enable per-block
   *   cache control settings (e.g., `cache_control: { type: "ephemeral" }`). This allows you
   *   to have different cache settings for different parts of your system prompt.
   * - **Multiple content blocks**: When you need multiple text blocks with different metadata
   *   or formatting requirements.
   * - **Integration with existing code**: When working with code that already produces
   *   `SystemMessage` instances.
   *
   * @example Using a string (recommended for most cases)
   * ```ts
   * const agent = createAgent({
   *   model: "anthropic:claude-3-5-sonnet",
   *   systemPrompt: "You are a helpful assistant.",
   *   // ...
   * });
   * ```
   *
   * @example Using a string with template literals
   * ```ts
   * const userRole = "premium";
   * const agent = createAgent({
   *   model: "anthropic:claude-3-5-sonnet",
   *   systemPrompt: `You are a helpful assistant for ${userRole} users.`,
   *   // ...
   * });
   * ```
   *
   * @example Using SystemMessage with cache control (Anthropic)
   * ```ts
   * import { SystemMessage } from "@langchain/core/messages";
   *
   * const agent = createAgent({
   *   model: "anthropic:claude-3-5-sonnet",
   *   systemPrompt: new SystemMessage({
   *     content: [
   *       {
   *         type: "text",
   *         text: "You are a helpful assistant.",
   *       },
   *       {
   *         type: "text",
   *         text: "Today's date is 2024-06-01.",
   *         cache_control: { type: "ephemeral" },
   *       },
   *     ],
   *   }),
   *   // ...
   * });
   * ```
   *
   * @example Using SystemMessage (simple)
   * ```ts
   * import { SystemMessage } from "@langchain/core/messages";
   *
   * const agent = createAgent({
   *   model: "anthropic:claude-3-5-sonnet",
   *   systemPrompt: new SystemMessage("You are a helpful assistant."),
   *   // ...
   * });
   * ```
   */
  systemPrompt?: string | SystemMessage;

  /**
   * An optional schema for the agent state. It allows you to define custom state properties that persist
   * across agent invocations and can be accessed in hooks, middleware, and throughout the agent's execution.
   * The state is persisted when using a checkpointer and can be updated by middleware or during execution.
   *
   * As opposed to the context (defined in `contextSchema`), the state is persisted between agent invocations
   * when using a checkpointer, making it suitable for maintaining conversation history, user preferences,
   * or any other data that should persist across multiple interactions.
   *
   * @example
   * ```ts
   * import { z } from "zod";
   * import { createAgent } from "@langchain/langgraph";
   *
   * const agent = createAgent({
   *   model: "openai:gpt-4o",
   *   tools: [getWeather],
   *   stateSchema: z.object({
   *     userPreferences: z.object({
   *       temperatureUnit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
   *       location: z.string().optional(),
   *     }).optional(),
   *     conversationCount: z.number().default(0),
   *   }),
   *   prompt: (state, config) => {
   *     const unit = state.userPreferences?.temperatureUnit || "celsius";
   *     return [
   *       new SystemMessage(`You are a helpful assistant. Use ${unit} for temperature.`),
   *     ];
   *   },
   * });
   *
   * const result = await agent.invoke({
   *   messages: [
   *     new HumanMessage("What's the weather like?"),
   *   ],
   *   userPreferences: {
   *     temperatureUnit: "fahrenheit",
   *     location: "New York",
   *   },
   *   conversationCount: 1,
   * });
   * ```
   */
  stateSchema?: StateSchema;
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
  /**
   * An optional checkpoint saver to persist the agent's state.
   * @see {@link https://docs.langchain.com/oss/javascript/langgraph/persistence | Checkpointing}
   */
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
   *
   * @see {@link https://docs.langchain.com/oss/javascript/langchain/middleware | Middleware}
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
 * Type helper to extract union type from an array of Zod schemas
 */
export type ExtractZodArrayTypes<T extends readonly InteropZodType<any>[]> =
  T extends readonly [InteropZodType<infer A>, ...infer Rest]
    ? Rest extends readonly InteropZodType<any>[]
      ? A | ExtractZodArrayTypes<Rest>
      : A
    : never;

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

export interface AgentState<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StructuredResponseType extends Record<string, any> = Record<string, any>
> {
  messages: BaseMessage[];
  structuredResponse?: StructuredResponseType;
}
