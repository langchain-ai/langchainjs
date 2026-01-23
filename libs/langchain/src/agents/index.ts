/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodObject,
  InteropZodType,
} from "@langchain/core/utils/types";
import type { ClientTool, ServerTool } from "@langchain/core/tools";
import type { StateDefinitionInit } from "@langchain/langgraph";

import type { ResponseFormatUndefined } from "./responses.js";
import type {
  CreateAgentParams,
  AgentTypeConfig,
  CombineTools,
} from "./types.js";
import type { AgentMiddleware, AnyAnnotationRoot } from "./middleware/types.js";
import type { ExtractZodArrayTypes } from "./types.js";
import type {
  ToolStrategy,
  TypedToolStrategy,
  ProviderStrategy,
  ResponseFormat,
  JsonSchemaFormat,
} from "./responses.js";
import { ReactAgent } from "./ReactAgent.js";

/**
 * Creates a production-ready ReAct (Reasoning + Acting) agent that combines language models with tools
 * and middleware to create systems that can reason about tasks, decide which tools to use, and iteratively
 * work towards solutions.
 *
 * The agent follows the ReAct pattern, interleaving reasoning steps with tool calls to iteratively
 * work towards solutions. It can handle multiple tool calls in sequence or parallel, maintain state
 * across interactions, and provide auditable decision processes.
 *
 * ## Core Components
 *
 * ### Model
 * The reasoning engine can be specified as:
 * - **String identifier**: `"openai:gpt-4o"` for simple setup
 * - **Model instance**: Configured model object for full control
 * - **Dynamic function**: Select models at runtime based on state
 *
 * ### Tools
 * Tools give agents the ability to take actions:
 * - Pass an array of tools created with the `tool` function
 * - Or provide a configured `ToolNode` for custom error handling
 *
 * ### Prompt
 * Shape how your agent approaches tasks:
 * - String for simple instructions
 * - SystemMessage for structured prompts
 * - Function for dynamic prompts based on state
 *
 * ### Middleware
 * Middleware allows you to extend the agent's behavior:
 * - Add pre/post-model processing for context injection or validation
 * - Add dynamic control flows, e.g. terminate invocation or retries
 * - Add human-in-the-loop capabilities
 * - Add tool calls to the agent
 * - Add tool results to the agent
 *
 * ## Advanced Features
 *
 * - **Structured Output**: Use `responseFormat` with a Zod schema to get typed responses
 * - **Memory**: Extend the state schema to remember information across interactions
 * - **Streaming**: Get real-time updates as the agent processes
 *
 * @param options - Configuration options for the agent
 * @param options.llm - The language model as an instance of a chat model
 * @param options.model - The language model as a string identifier, see more in {@link https://docs.langchain.com/oss/javascript/langchain/models#basic-usage | Models}.
 * @param options.tools - Array of tools or configured ToolNode
 * @param options.prompt - System instructions (string, SystemMessage, or function)
 * @param options.responseFormat - Zod schema for structured output
 * @param options.stateSchema - Custom state schema for memory
 * @param options.middleware - Array of middleware for extending agent behavior, see more in {@link https://docs.langchain.com/oss/javascript/langchain/middleware | Middleware}.
 *
 * @returns A ReactAgent instance with `invoke` and `stream` methods
 *
 * @example Basic agent with tools
 * ```ts
 * import { createAgent, tool } from "langchain";
 * import { z } from "zod";
 *
 * const search = tool(
 *   ({ query }) => `Results for: ${query}`,
 *   {
 *     name: "search",
 *     description: "Search for information",
 *     schema: z.object({
 *       query: z.string().describe("The search query"),
 *     })
 *   }
 * );
 *
 * const agent = createAgent({
 *   llm: "openai:gpt-4o",
 *   tools: [search],
 * });
 *
 * const result = await agent.invoke({
 *   messages: [{ role: "user", content: "Search for ReAct agents" }],
 * });
 * ```
 *
 * @example Structured output
 * ```ts
 * import { createAgent } from "langchain";
 * import { z } from "zod";
 *
 * const ContactInfo = z.object({
 *   name: z.string(),
 *   email: z.string(),
 *   phone: z.string(),
 * });
 *
 * const agent = createAgent({
 *   llm: "openai:gpt-4o",
 *   tools: [],
 *   responseFormat: ContactInfo,
 * });
 *
 * const result = await agent.invoke({
 *   messages: [{
 *     role: "user",
 *     content: "Extract: John Doe, john@example.com, (555) 123-4567"
 *   }],
 * });
 *
 * console.log(result.structuredResponse);
 * // { name: 'John Doe', email: 'john@example.com', phone: '(555) 123-4567' }
 * ```
 *
 * @example Streaming responses
 * ```ts
 * const stream = await agent.stream(
 *   { messages: [{ role: "user", content: "What's the weather?" }] },
 *   { streamMode: "values" }
 * );
 *
 * for await (const chunk of stream) {
 *   // ...
 * }
 * ```
 *
 * @example With StateSchema
 * ```ts
 * import { createAgent } from "langchain";
 * import { StateSchema, ReducedValue } from "@langchain/langgraph";
 * import { z } from "zod";
 *
 * const AgentState = new StateSchema({
 *   userId: z.string(),
 *   count: z.number().default(0),
 *   history: new ReducedValue(
 *     z.array(z.string()).default(() => []),
 *     { inputSchema: z.string(), reducer: (c, n) => [...c, n] }
 *   ),
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   tools: [searchTool],
 *   stateSchema: AgentState,
 * });
 * ```
 */
// Overload 1: With responseFormat as single InteropZodType
export function createAgent<
  StructuredResponseFormat extends Record<string, any> = Record<string, any>,
  TStateSchema extends StateDefinitionInit | undefined = undefined,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  const TMiddleware extends
    readonly AgentMiddleware[] = readonly AgentMiddleware[],
  const TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
>(
  params: CreateAgentParams<
    StructuredResponseFormat,
    TStateSchema,
    ContextSchema,
    InteropZodType<StructuredResponseFormat>
  > & {
    responseFormat: InteropZodType<StructuredResponseFormat>;
    middleware?: TMiddleware;
    tools?: TTools;
  }
): ReactAgent<
  AgentTypeConfig<
    StructuredResponseFormat,
    TStateSchema,
    ContextSchema,
    TMiddleware,
    CombineTools<TTools, TMiddleware>
  >
>;

// Overload 2: With responseFormat as array of InteropZodTypes (infers union type)
export function createAgent<
  StructuredResponseFormat extends readonly InteropZodType<any>[],
  TStateSchema extends StateDefinitionInit | undefined = undefined,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  const TMiddleware extends
    readonly AgentMiddleware[] = readonly AgentMiddleware[],
  const TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
>(
  params: CreateAgentParams<
    ExtractZodArrayTypes<StructuredResponseFormat> extends Record<string, any>
      ? ExtractZodArrayTypes<StructuredResponseFormat>
      : Record<string, any>,
    TStateSchema,
    ContextSchema,
    StructuredResponseFormat
  > & {
    responseFormat: StructuredResponseFormat;
    middleware?: TMiddleware;
    tools?: TTools;
  }
): ReactAgent<
  AgentTypeConfig<
    ExtractZodArrayTypes<StructuredResponseFormat> extends Record<string, any>
      ? ExtractZodArrayTypes<StructuredResponseFormat>
      : Record<string, any>,
    TStateSchema,
    ContextSchema,
    TMiddleware,
    CombineTools<TTools, TMiddleware>
  >
>;

// Overload 3: With responseFormat as JsonSchemaFormat (JSON schema object)
export function createAgent<
  TStateSchema extends StateDefinitionInit | undefined = undefined,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  const TMiddleware extends
    readonly AgentMiddleware[] = readonly AgentMiddleware[],
  const TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
>(
  params: CreateAgentParams<
    Record<string, unknown>,
    TStateSchema,
    ContextSchema,
    JsonSchemaFormat
  > & {
    responseFormat: JsonSchemaFormat;
    middleware?: TMiddleware;
    tools?: TTools;
  }
): ReactAgent<
  AgentTypeConfig<
    Record<string, unknown>,
    TStateSchema,
    ContextSchema,
    TMiddleware,
    CombineTools<TTools, TMiddleware>
  >
>;

// Overload 4: With responseFormat as array of JsonSchemaFormat (JSON schema objects)
export function createAgent<
  TStateSchema extends StateDefinitionInit | undefined = undefined,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  const TMiddleware extends
    readonly AgentMiddleware[] = readonly AgentMiddleware[],
  const TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
>(
  params: CreateAgentParams<
    Record<string, unknown>,
    TStateSchema,
    ContextSchema,
    JsonSchemaFormat[]
  > & {
    responseFormat: JsonSchemaFormat[];
    middleware?: TMiddleware;
    tools?: TTools;
  }
): ReactAgent<
  AgentTypeConfig<
    Record<string, unknown>,
    TStateSchema,
    ContextSchema,
    TMiddleware,
    CombineTools<TTools, TMiddleware>
  >
>;

// Overload 4.5: With responseFormat as union of JsonSchemaFormat | JsonSchemaFormat[]
export function createAgent<
  TStateSchema extends StateDefinitionInit | undefined = undefined,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  const TMiddleware extends
    readonly AgentMiddleware[] = readonly AgentMiddleware[],
  const TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
>(
  params: CreateAgentParams<
    Record<string, unknown>,
    TStateSchema,
    ContextSchema,
    JsonSchemaFormat | JsonSchemaFormat[]
  > & {
    responseFormat: JsonSchemaFormat | JsonSchemaFormat[];
    middleware?: TMiddleware;
    tools?: TTools;
  }
): ReactAgent<
  AgentTypeConfig<
    Record<string, unknown>,
    TStateSchema,
    ContextSchema,
    TMiddleware,
    CombineTools<TTools, TMiddleware>
  >
>;

// Overload 5: With responseFormat as TypedToolStrategy (for union types from toolStrategy)
export function createAgent<
  StructuredResponseFormat extends Record<string, any> = Record<string, any>,
  TStateSchema extends StateDefinitionInit | undefined = undefined,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  const TMiddleware extends
    readonly AgentMiddleware[] = readonly AgentMiddleware[],
  const TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
>(
  params: CreateAgentParams<
    StructuredResponseFormat,
    TStateSchema,
    ContextSchema,
    TypedToolStrategy<StructuredResponseFormat>
  > & {
    responseFormat: TypedToolStrategy<StructuredResponseFormat>;
    middleware?: TMiddleware;
    tools?: TTools;
  }
): ReactAgent<
  AgentTypeConfig<
    StructuredResponseFormat,
    TStateSchema,
    ContextSchema,
    TMiddleware,
    CombineTools<TTools, TMiddleware>
  >
>;

// Overload 6: With responseFormat as single ToolStrategy instance
export function createAgent<
  StructuredResponseFormat extends Record<string, any> = Record<string, any>,
  TStateSchema extends StateDefinitionInit | undefined = undefined,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  const TMiddleware extends
    readonly AgentMiddleware[] = readonly AgentMiddleware[],
  const TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
>(
  params: CreateAgentParams<
    StructuredResponseFormat,
    TStateSchema,
    ContextSchema,
    ToolStrategy<StructuredResponseFormat>
  > & {
    responseFormat: ToolStrategy<StructuredResponseFormat>;
    middleware?: TMiddleware;
    tools?: TTools;
  }
): ReactAgent<
  AgentTypeConfig<
    StructuredResponseFormat,
    TStateSchema,
    ContextSchema,
    TMiddleware,
    CombineTools<TTools, TMiddleware>
  >
>;

// Overload 7: With responseFormat as ProviderStrategy
export function createAgent<
  StructuredResponseFormat extends Record<string, any> = Record<string, any>,
  TStateSchema extends StateDefinitionInit | undefined = undefined,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  const TMiddleware extends
    readonly AgentMiddleware[] = readonly AgentMiddleware[],
  const TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
>(
  params: CreateAgentParams<
    StructuredResponseFormat,
    TStateSchema,
    ContextSchema,
    ProviderStrategy<StructuredResponseFormat>
  > & {
    responseFormat: ProviderStrategy<StructuredResponseFormat>;
    middleware?: TMiddleware;
    tools?: TTools;
  }
): ReactAgent<
  AgentTypeConfig<
    StructuredResponseFormat,
    TStateSchema,
    ContextSchema,
    TMiddleware,
    CombineTools<TTools, TMiddleware>
  >
>;

// Overload 8: Without responseFormat property at all - with proper middleware state typing
export function createAgent<
  TStateSchema extends StateDefinitionInit | undefined = undefined,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  const TMiddleware extends
    readonly AgentMiddleware[] = readonly AgentMiddleware[],
  const TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
>(
  params: Omit<
    CreateAgentParams<
      ResponseFormatUndefined,
      TStateSchema,
      ContextSchema,
      never
    >,
    "responseFormat"
  > & { middleware?: TMiddleware; tools?: TTools }
): ReactAgent<
  AgentTypeConfig<
    ResponseFormatUndefined,
    TStateSchema,
    ContextSchema,
    TMiddleware,
    CombineTools<TTools, TMiddleware>
  >
>;

// Overload 9: With responseFormat explicitly undefined
export function createAgent<
  TStateSchema extends StateDefinitionInit | undefined = undefined,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  const TMiddleware extends
    readonly AgentMiddleware[] = readonly AgentMiddleware[],
  const TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
>(
  params: Omit<
    CreateAgentParams<
      ResponseFormatUndefined,
      TStateSchema,
      ContextSchema,
      never
    >,
    "responseFormat"
  > & {
    responseFormat?: undefined;
    middleware?: TMiddleware;
    tools?: TTools;
  }
): ReactAgent<
  AgentTypeConfig<
    ResponseFormatUndefined,
    TStateSchema,
    ContextSchema,
    TMiddleware,
    CombineTools<TTools, TMiddleware>
  >
>;

// Overload 10: For other ResponseFormat values (failsafe)
export function createAgent<
  StructuredResponseFormat extends Record<string, any> = Record<string, any>,
  TStateSchema extends StateDefinitionInit | undefined = undefined,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  const TMiddleware extends
    readonly AgentMiddleware[] = readonly AgentMiddleware[],
  const TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
>(
  params: CreateAgentParams<
    StructuredResponseFormat,
    TStateSchema,
    ContextSchema,
    ResponseFormat
  > & {
    responseFormat: ResponseFormat;
    middleware?: TMiddleware;
    tools?: TTools;
  }
): ReactAgent<
  AgentTypeConfig<
    StructuredResponseFormat,
    TStateSchema,
    ContextSchema,
    TMiddleware,
    CombineTools<TTools, TMiddleware>
  >
>;

// Implementation
export function createAgent<
  StructuredResponseFormat extends Record<string, any>,
  TStateSchema extends StateDefinitionInit,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject,
  TMiddleware extends readonly AgentMiddleware[] = readonly AgentMiddleware[],
  TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
>(
  params: CreateAgentParams<
    StructuredResponseFormat,
    TStateSchema,
    ContextSchema,
    any
  >
): ReactAgent<
  AgentTypeConfig<
    StructuredResponseFormat,
    TStateSchema,
    ContextSchema,
    TMiddleware,
    CombineTools<TTools, TMiddleware>
  >
> {
  return new ReactAgent(params);
}

// Re-export types and utilities
export * from "./types.js";
export * from "./errors.js";
export type { JumpToTarget } from "./constants.js";
export type { Runtime } from "./runtime.js";
export {
  toolStrategy,
  providerStrategy,
  ToolStrategy,
  ProviderStrategy,
  type ResponseFormat,
  type ResponseFormatUndefined,
} from "./responses.js";
export { createMiddleware } from "./middleware.js";
export { MIDDLEWARE_BRAND } from "./middleware/types.js";
export type * from "./middleware/types.js";
export { FakeToolCallingModel } from "./tests/utils.js";
export type { ReactAgent } from "./ReactAgent.js";
