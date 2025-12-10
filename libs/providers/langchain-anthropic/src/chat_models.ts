import { Anthropic, type ClientOptions } from "@anthropic-ai/sdk";
import type { Stream } from "@anthropic-ai/sdk/streaming";
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  type StructuredOutputMethodOptions,
  type BaseLanguageModelInput,
  isOpenAITool,
} from "@langchain/core/language_models/base";
import { ModelProfile } from "@langchain/core/language_models/profile";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import {
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import {
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";

import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { AnthropicToolsOutputParser } from "./output_parsers.js";
import {
  ANTHROPIC_TOOL_BETAS,
  AnthropicToolExtrasSchema,
  handleToolChoice,
} from "./utils/tools.js";
import { _convertMessagesToAnthropicPayload } from "./utils/message_inputs.js";
import {
  _makeMessageChunkFromAnthropicEvent,
  anthropicResponseToChatMessages,
} from "./utils/message_outputs.js";
import {
  AnthropicBuiltInToolUnion,
  AnthropicContextManagementConfigParam,
  AnthropicInvocationParams,
  AnthropicMessageCreateParams,
  AnthropicMessageStreamEvent,
  AnthropicRequestOptions,
  AnthropicStreamingMessageCreateParams,
  AnthropicThinkingConfigParam,
  AnthropicToolChoice,
  ChatAnthropicOutputFormat,
  ChatAnthropicToolType,
  AnthropicMCPServerURLDefinition,
  Kwargs,
} from "./types.js";
import { wrapAnthropicClientError } from "./utils/errors.js";
import PROFILES from "./profiles.js";
import { AnthropicBeta } from "@anthropic-ai/sdk/resources";

const MODEL_DEFAULT_MAX_OUTPUT_TOKENS: Partial<
  Record<Anthropic.Model, number>
> = {
  "claude-opus-4-1": 8192,
  "claude-opus-4": 8192,
  "claude-sonnet-4": 8192,
  "claude-sonnet-3-7-sonnet": 8192,
  "claude-3-5-sonnet": 4096,
  "claude-3-5-haiku": 4096,
  "claude-3-haiku": 2048,
};
const FALLBACK_MAX_OUTPUT_TOKENS = 2048;

function defaultMaxOutputTokensForModel(model?: Anthropic.Model): number {
  if (!model) {
    return FALLBACK_MAX_OUTPUT_TOKENS;
  }
  const maxTokens = Object.entries(MODEL_DEFAULT_MAX_OUTPUT_TOKENS).find(
    ([key]) => model.startsWith(key)
  )?.[1];
  return maxTokens ?? FALLBACK_MAX_OUTPUT_TOKENS;
}

export interface ChatAnthropicCallOptions
  extends BaseChatModelCallOptions,
    Pick<AnthropicInput, "streamUsage"> {
  tools?: ChatAnthropicToolType[];
  /**
   * Whether or not to specify what tool the model should use
   * @default "auto"
   */
  tool_choice?: AnthropicToolChoice;
  /**
   * Custom headers to pass to the Anthropic API
   * when making a request.
   */
  headers?: Record<string, string>;
  /**
   * Container ID for file persistence across turns with code execution.
   * Used with the code_execution_20250825 tool.
   */
  container?: string;
  /**
   * Output format to use for the response.
   */
  output_format?: ChatAnthropicOutputFormat;
  /**
   * Optional array of beta features to enable for the Anthropic API.
   * Beta features are experimental capabilities that may change or be removed.
   * See https://docs.anthropic.com/en/api/versioning for available beta features.
   */
  betas?: AnthropicBeta[];
  /**
   * Array of MCP server URLs to use for the request.
   */
  mcp_servers?: AnthropicMCPServerURLDefinition[];
}

function _toolsInParams(
  params: AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams
): boolean {
  return !!(params.tools && params.tools.length > 0);
}

function _documentsInParams(
  params: AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams
): boolean {
  for (const message of params.messages ?? []) {
    if (typeof message.content === "string") {
      continue;
    }
    for (const block of message.content ?? []) {
      if (
        typeof block === "object" &&
        block != null &&
        block.type === "document" &&
        typeof block.citations === "object" &&
        block.citations?.enabled
      ) {
        return true;
      }
    }
  }
  return false;
}

function _thinkingInParams(
  params: AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams
): boolean {
  return !!(params.thinking && params.thinking.type === "enabled");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAnthropicTool(tool: any): tool is Anthropic.Messages.Tool {
  return "input_schema" in tool;
}

function isBuiltinTool(tool: unknown): tool is AnthropicBuiltInToolUnion {
  const builtInToolPrefixes = [
    "text_editor_",
    "computer_",
    "bash_",
    "web_search_",
    "web_fetch_",
    "str_replace_editor_",
    "str_replace_based_edit_tool_",
    "code_execution_",
    "memory_",
    "tool_search_",
    "mcp_toolset",
  ];
  return (
    typeof tool === "object" &&
    tool !== null &&
    "type" in tool &&
    ("name" in tool || "mcp_server_name" in tool) &&
    typeof tool.type === "string" &&
    builtInToolPrefixes.some(
      (prefix) => typeof tool.type === "string" && tool.type.startsWith(prefix)
    )
  );
}

function _combineBetas(
  a?: Iterable<AnthropicBeta>,
  b?: Iterable<AnthropicBeta>,
  ...rest: Iterable<AnthropicBeta>[]
): AnthropicBeta[] {
  return Array.from(
    new Set([...(a ?? []), ...(b ?? []), ...rest.flatMap((x) => Array.from(x))])
  );
}

/**
 * @see https://docs.anthropic.com/claude/docs/models-overview
 */
export type AnthropicMessagesModelId =
  | Anthropic.Model
  | (string & NonNullable<unknown>);

/**
 * Input to AnthropicChat class.
 */
export interface AnthropicInput {
  /**
   * Amount of randomness injected into the response. Ranges
   * from 0 to 1. Use temperature closer to 0 for analytical /
   * multiple choice, and temperature closer to 1 for creative
   * and generative tasks.
   */
  temperature?: number;

  /**
   * Only sample from the top K options for each subsequent
   * token. Used to remove "long tail" low probability
   * responses.
   */
  topK?: number;

  /**
   * Does nucleus sampling, in which we compute the
   * cumulative distribution over all the options for each
   * subsequent token in decreasing probability order and
   * cut it off once it reaches a particular probability
   * specified by top_p. Note that you should either alter
   * temperature or top_p, but not both.
   */
  topP?: number | null;

  /** A maximum number of tokens to generate before stopping. */
  maxTokens?: number;

  /**
   * A list of strings upon which to stop generating.
   * You probably want `["\n\nHuman:"]`, as that's the cue for
   * the next turn in the dialog agent.
   */
  stopSequences?: string[];

  /** Whether to stream the results or not */
  streaming?: boolean;

  /** Anthropic API key */
  anthropicApiKey?: string;
  /** Anthropic API key */
  apiKey?: string;

  /** Anthropic API URL */
  anthropicApiUrl?: string;

  /** @deprecated Use "model" instead */
  modelName?: AnthropicMessagesModelId;
  /** Model name to use */
  model?: AnthropicMessagesModelId;

  /** Overridable Anthropic ClientOptions */
  clientOptions?: ClientOptions;

  /** Holds any additional parameters that are valid to pass to {@link
   * https://console.anthropic.com/docs/api/reference |
   * `anthropic.messages`} that are not explicitly specified on this class.
   */
  invocationKwargs?: Kwargs;

  /**
   * Whether or not to include token usage data in streamed chunks.
   * @default true
   */
  streamUsage?: boolean;

  /**
   * Optional method that returns an initialized underlying Anthropic client.
   * Useful for accessing Anthropic models hosted on other cloud services
   * such as Google Vertex.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createClient?: (options: ClientOptions) => any;

  /**
   * Options for extended thinking.
   */
  thinking?: AnthropicThinkingConfigParam;

  /**
   * Configuration for context management. See https://docs.claude.com/en/docs/build-with-claude/context-editing
   */
  contextManagement?: AnthropicContextManagementConfigParam;

  /**
   * Optional array of beta features to enable for the Anthropic API.
   * Beta features are experimental capabilities that may change or be removed.
   * See https://docs.claude.com/en/api/beta-headers for available beta features.
   */
  betas?: AnthropicBeta[];
}

/**
 * Input to ChatAnthropic class.
 */
export type ChatAnthropicInput = AnthropicInput & BaseChatModelParams;

function extractToken(chunk: AIMessageChunk): string | undefined {
  if (typeof chunk.content === "string") {
    return chunk.content;
  } else if (
    Array.isArray(chunk.content) &&
    chunk.content.length >= 1 &&
    "input" in chunk.content[0]
  ) {
    return typeof chunk.content[0].input === "string"
      ? chunk.content[0].input
      : JSON.stringify(chunk.content[0].input);
  } else if (
    Array.isArray(chunk.content) &&
    chunk.content.length >= 1 &&
    "text" in chunk.content[0] &&
    typeof chunk.content[0].text === "string"
  ) {
    return chunk.content[0].text;
  }
  return undefined;
}

/**
 * Anthropic chat model integration.
 *
 * Setup:
 * Install `@langchain/anthropic` and set an environment variable named `ANTHROPIC_API_KEY`.
 *
 * ```bash
 * npm install @langchain/anthropic
 * export ANTHROPIC_API_KEY="your-api-key"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/langchain_anthropic.ChatAnthropic.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/langchain_anthropic.ChatAnthropicCallOptions.html)
 *
 * Runtime args can be passed as the second argument to any of the base runnable methods `.invoke`. `.stream`, `.batch`, etc.
 * They can also be passed via `.bind`, or the second arg in `.bindTools`, like shown in the examples below:
 *
 * ```typescript
 * // When calling `.bind`, call options should be passed via the first argument
 * const llmWithArgsBound = llm.bindTools([...]).withConfig({
 *   stop: ["\n"],
 * });
 *
 * // When calling `.bindTools`, call options should be passed via the second argument
 * const llmWithTools = llm.bindTools(
 *   [...],
 *   {
 *     tool_choice: "auto",
 *   }
 * );
 * ```
 *
 * ## Examples
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { ChatAnthropic } from '@langchain/anthropic';
 *
 * const llm = new ChatAnthropic({
 *   model: "claude-sonnet-4-5-20250929",
 *   temperature: 0,
 *   maxTokens: undefined,
 *   maxRetries: 2,
 *   // apiKey: "...",
 *   // baseUrl: "...",
 *   // other params...
 * });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Invoking</strong></summary>
 *
 * ```typescript
 * const input = `Translate "I love programming" into French.`;
 *
 * // Models also accept a list of chat messages or a formatted prompt
 * const result = await llm.invoke(input);
 * console.log(result);
 * ```
 *
 * ```txt
 * AIMessage {
 *   "id": "msg_01QDpd78JUHpRP6bRRNyzbW3",
 *   "content": "Here's the translation to French:\n\nJ'adore la programmation.",
 *   "response_metadata": {
 *     "id": "msg_01QDpd78JUHpRP6bRRNyzbW3",
 *     "model": "claude-sonnet-4-5-20250929",
 *     "stop_reason": "end_turn",
 *     "stop_sequence": null,
 *     "usage": {
 *       "input_tokens": 25,
 *       "output_tokens": 19
 *     },
 *     "type": "message",
 *     "role": "assistant"
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 19,
 *     "total_tokens": 44
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Streaming Chunks</strong></summary>
 *
 * ```typescript
 * for await (const chunk of await llm.stream(input)) {
 *   console.log(chunk);
 * }
 * ```
 *
 * ```txt
 * AIMessageChunk {
 *   "id": "msg_01N8MwoYxiKo9w4chE4gXUs4",
 *   "content": "",
 *   "additional_kwargs": {
 *     "id": "msg_01N8MwoYxiKo9w4chE4gXUs4",
 *     "type": "message",
 *     "role": "assistant",
 *     "model": "claude-sonnet-4-5-20250929"
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 1,
 *     "total_tokens": 26
 *   }
 * }
 * AIMessageChunk {
 *   "content": "",
 * }
 * AIMessageChunk {
 *   "content": "Here",
 * }
 * AIMessageChunk {
 *   "content": "'s",
 * }
 * AIMessageChunk {
 *   "content": " the translation to",
 * }
 * AIMessageChunk {
 *   "content": " French:\n\nJ",
 * }
 * AIMessageChunk {
 *   "content": "'adore la programmation",
 * }
 * AIMessageChunk {
 *   "content": ".",
 * }
 * AIMessageChunk {
 *   "content": "",
 *   "additional_kwargs": {
 *     "stop_reason": "end_turn",
 *     "stop_sequence": null
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 0,
 *     "output_tokens": 19,
 *     "total_tokens": 19
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Aggregate Streamed Chunks</strong></summary>
 *
 * ```typescript
 * import { AIMessageChunk } from '@langchain/core/messages';
 * import { concat } from '@langchain/core/utils/stream';
 *
 * const stream = await llm.stream(input);
 * let full: AIMessageChunk | undefined;
 * for await (const chunk of stream) {
 *   full = !full ? chunk : concat(full, chunk);
 * }
 * console.log(full);
 * ```
 *
 * ```txt
 * AIMessageChunk {
 *   "id": "msg_01SBTb5zSGXfjUc7yQ8EKEEA",
 *   "content": "Here's the translation to French:\n\nJ'adore la programmation.",
 *   "additional_kwargs": {
 *     "id": "msg_01SBTb5zSGXfjUc7yQ8EKEEA",
 *     "type": "message",
 *     "role": "assistant",
 *     "model": "claude-sonnet-4-5-20250929",
 *     "stop_reason": "end_turn",
 *     "stop_sequence": null
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 20,
 *     "total_tokens": 45
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Bind tools</strong></summary>
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const GetWeather = {
 *   name: "GetWeather",
 *   description: "Get the current weather in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const GetPopulation = {
 *   name: "GetPopulation",
 *   description: "Get the current population in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const llmWithTools = llm.bindTools([GetWeather, GetPopulation]);
 * const aiMsg = await llmWithTools.invoke(
 *   "Which city is hotter today and which is bigger: LA or NY?"
 * );
 * console.log(aiMsg.tool_calls);
 * ```
 *
 * ```txt
 * [
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'Los Angeles, CA' },
 *     id: 'toolu_01WjW3Dann6BPJVtLhovdBD5',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'New York, NY' },
 *     id: 'toolu_01G6wfJgqi5zRmJomsmkyZXe',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'Los Angeles, CA' },
 *     id: 'toolu_0165qYWBA2VFyUst5RA18zew',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'New York, NY' },
 *     id: 'toolu_01PGNyP33vxr13tGqr7i3rDo',
 *     type: 'tool_call'
 *   }
 * ]
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Tool Search</strong></summary>
 *
 * Tool search enables Claude to dynamically discover and load tools on-demand
 * instead of loading all tool definitions upfront. This is useful when you have
 * many tools but want to avoid the overhead of sending all definitions with every request.
 *
 * ```typescript
 * import { ChatAnthropic } from "@langchain/anthropic";
 *
 * const model = new ChatAnthropic({
 *   model: "claude-sonnet-4-5-20250929",
 * });
 *
 * const tools = [
 *   // Tool search server tool
 *   {
 *     type: "tool_search_tool_regex_20251119",
 *     name: "tool_search_tool_regex",
 *   },
 *   // Tools with defer_loading are loaded on-demand
 *   {
 *     name: "get_weather",
 *     description: "Get the current weather for a location",
 *     input_schema: {
 *       type: "object",
 *       properties: {
 *         location: { type: "string", description: "City name" },
 *         unit: {
 *           type: "string",
 *           enum: ["celsius", "fahrenheit"],
 *         },
 *       },
 *       required: ["location"],
 *     },
 *     defer_loading: true, // Tool is loaded on-demand
 *   },
 *   {
 *     name: "search_files",
 *     description: "Search through files in the workspace",
 *     input_schema: {
 *       type: "object",
 *       properties: {
 *         query: { type: "string" },
 *       },
 *       required: ["query"],
 *     },
 *     defer_loading: true, // Tool is loaded on-demand
 *   },
 * ];
 *
 * const modelWithTools = model.bindTools(tools);
 * const response = await modelWithTools.invoke("What's the weather in San Francisco?");
 * ```
 *
 * You can also use the `tool()` helper with the `extras` field:
 *
 * ```typescript
 * import { tool } from "@langchain/core/tools";
 * import { z } from "zod";
 *
 * const getWeather = tool(
 *   async (input) => `Weather in ${input.location}`,
 *   {
 *     name: "get_weather",
 *     description: "Get weather for a location",
 *     schema: z.object({ location: z.string() }),
 *     extras: { defer_loading: true },
 *   }
 * );
 * ```
 *
 * **Note:** The required `advanced-tool-use-2025-11-20` beta header is automatically
 * appended to the request when using tool search tools.
 *
 * **Best practices:**
 * - Tools with `defer_loading: true` are only loaded when Claude discovers them via search
 * - Keep your 3-5 most frequently used tools as non-deferred for optimal performance
 * - Both regex and bm25 variants search tool names, descriptions, and argument info
 *
 * See the {@link https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool | Claude docs}
 * for more information.
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Structured Output</strong></summary>
 *
 * ChatAnthropic supports structured output through two main approaches:
 *
 * 1. **Function Calling with `withStructuredOutput()`**: Uses Anthropic's tool calling
 *    under the hood to constrain outputs to a specific schema.
 * 2. **JSON Schema Mode**: Uses Anthropic's native JSON schema support for direct
 *    structured output without tool calling overhead.
 *
 * **Using withStructuredOutput (Function Calling)**
 *
 * This method leverages Anthropic's tool calling capabilities to ensure the model
 * returns data matching your schema:
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const Joke = z.object({
 *   setup: z.string().describe("The setup of the joke"),
 *   punchline: z.string().describe("The punchline to the joke"),
 *   rating: z.number().optional().describe("How funny the joke is, from 1 to 10")
 * }).describe('Joke to tell user.');
 *
 * const structuredLlm = llm.withStructuredOutput(Joke, { name: "Joke" });
 * const jokeResult = await structuredLlm.invoke("Tell me a joke about cats");
 * console.log(jokeResult);
 * ```
 *
 * ```txt
 * {
 *   setup: "Why don't cats play poker in the jungle?",
 *   punchline: 'Too many cheetahs!',
 *   rating: 7
 * }
 * ```
 *
 * **Using JSON Schema Mode**
 *
 * For more direct control, you can use Anthropic's native JSON schema support by
 * passing `method: "jsonSchema"`:
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const RecipeSchema = z.object({
 *   recipeName: z.string().describe("Name of the recipe"),
 *   ingredients: z.array(z.string()).describe("List of ingredients needed"),
 *   steps: z.array(z.string()).describe("Cooking steps in order"),
 *   prepTime: z.number().describe("Preparation time in minutes")
 * });
 *
 * const structuredLlm = llm.withStructuredOutput(RecipeSchema, {
 *   method: "jsonSchema"
 * });
 *
 * const recipe = await structuredLlm.invoke(
 *   "Give me a simple recipe for chocolate chip cookies"
 * );
 * console.log(recipe);
 * ```
 *
 * ```txt
 * {
 *   recipeName: 'Classic Chocolate Chip Cookies',
 *   ingredients: [
 *     '2 1/4 cups all-purpose flour',
 *     '1 cup butter, softened',
 *     ...
 *   ],
 *   steps: [
 *     'Preheat oven to 375°F',
 *     'Mix butter and sugars until creamy',
 *     ...
 *   ],
 *   prepTime: 15
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Multimodal</strong></summary>
 *
 * ```typescript
 * import { HumanMessage } from '@langchain/core/messages';
 *
 * const imageUrl = "https://example.com/image.jpg";
 * const imageData = await fetch(imageUrl).then(res => res.arrayBuffer());
 * const base64Image = Buffer.from(imageData).toString('base64');
 *
 * const message = new HumanMessage({
 *   content: [
 *     { type: "text", text: "describe the weather in this image" },
 *     {
 *       type: "image_url",
 *       image_url: { url: `data:image/jpeg;base64,${base64Image}` },
 *     },
 *   ]
 * });
 *
 * const imageDescriptionAiMsg = await llm.invoke([message]);
 * console.log(imageDescriptionAiMsg.content);
 * ```
 *
 * ```txt
 * The weather in this image appears to be beautiful and clear. The sky is a vibrant blue with scattered white clouds, suggesting a sunny and pleasant day. The clouds are wispy and light, indicating calm conditions without any signs of storms or heavy weather. The bright green grass on the rolling hills looks lush and well-watered, which could mean recent rainfall or good growing conditions. Overall, the scene depicts a perfect spring or early summer day with mild temperatures, plenty of sunshine, and gentle breezes - ideal weather for enjoying the outdoors or for plant growth.
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Usage Metadata</strong></summary>
 *
 * ```typescript
 * const aiMsgForMetadata = await llm.invoke(input);
 * console.log(aiMsgForMetadata.usage_metadata);
 * ```
 *
 * ```txt
 * { input_tokens: 25, output_tokens: 19, total_tokens: 44 }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Stream Usage Metadata</strong></summary>
 *
 * ```typescript
 * const streamForMetadata = await llm.stream(
 *   input,
 *   {
 *     streamUsage: true
 *   }
 * );
 * let fullForMetadata: AIMessageChunk | undefined;
 * for await (const chunk of streamForMetadata) {
 *   fullForMetadata = !fullForMetadata ? chunk : concat(fullForMetadata, chunk);
 * }
 * console.log(fullForMetadata?.usage_metadata);
 * ```
 *
 * ```txt
 * { input_tokens: 25, output_tokens: 20, total_tokens: 45 }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Response Metadata</strong></summary>
 *
 * ```typescript
 * const aiMsgForResponseMetadata = await llm.invoke(input);
 * console.log(aiMsgForResponseMetadata.response_metadata);
 * ```
 *
 * ```txt
 * {
 *   id: 'msg_01STxeQxJmp4sCSpioD6vK3L',
 *   model: 'claude-sonnet-4-5-20250929',
 *   stop_reason: 'end_turn',
 *   stop_sequence: null,
 *   usage: { input_tokens: 25, output_tokens: 19 },
 *   type: 'message',
 *   role: 'assistant'
 * }
 * ```
 * </details>
 *
 * <br />
 */
export class ChatAnthropicMessages<
    CallOptions extends ChatAnthropicCallOptions = ChatAnthropicCallOptions
  >
  extends BaseChatModel<CallOptions, AIMessageChunk>
  implements AnthropicInput
{
  static lc_name() {
    return "ChatAnthropic";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      anthropicApiKey: "ANTHROPIC_API_KEY",
      apiKey: "ANTHROPIC_API_KEY",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
    };
  }

  lc_serializable = true;

  anthropicApiKey?: string;

  apiKey?: string;

  apiUrl?: string;

  temperature?: number;

  topK?: number;

  topP?: number;

  maxTokens: number;

  modelName = "claude-3-5-sonnet-latest";

  model = "claude-3-5-sonnet-latest";

  invocationKwargs?: Kwargs;

  stopSequences?: string[];

  streaming = false;

  clientOptions: ClientOptions;

  thinking: AnthropicThinkingConfigParam = { type: "disabled" };

  contextManagement?: AnthropicContextManagementConfigParam;

  // Used for non-streaming requests
  protected batchClient: Anthropic;

  // Used for streaming requests
  protected streamingClient: Anthropic;

  streamUsage = true;

  betas?: AnthropicBeta[];

  /**
   * Optional method that returns an initialized underlying Anthropic client.
   * Useful for accessing Anthropic models hosted on other cloud services
   * such as Google Vertex.
   */
  createClient: (options: ClientOptions) => Anthropic;

  constructor(fields?: ChatAnthropicInput) {
    super(fields ?? {});

    this.anthropicApiKey =
      fields?.apiKey ??
      fields?.anthropicApiKey ??
      getEnvironmentVariable("ANTHROPIC_API_KEY");

    if (!this.anthropicApiKey && !fields?.createClient) {
      throw new Error("Anthropic API key not found");
    }
    this.clientOptions = fields?.clientOptions ?? {};
    /** Keep anthropicApiKey for backwards compatibility */
    this.apiKey = this.anthropicApiKey;

    // Support overriding the default API URL (i.e., https://api.anthropic.com)
    this.apiUrl = fields?.anthropicApiUrl;

    /** Keep modelName for backwards compatibility */
    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;

    this.invocationKwargs = fields?.invocationKwargs ?? {};

    this.topP = fields?.topP ?? this.topP;

    this.temperature = fields?.temperature ?? this.temperature;
    this.topK = fields?.topK ?? this.topK;
    this.maxTokens =
      fields?.maxTokens ?? defaultMaxOutputTokensForModel(this.model);
    this.stopSequences = fields?.stopSequences ?? this.stopSequences;

    this.streaming = fields?.streaming ?? false;
    this.streamUsage = fields?.streamUsage ?? this.streamUsage;

    this.thinking = fields?.thinking ?? this.thinking;
    this.contextManagement =
      fields?.contextManagement ?? this.contextManagement;
    this.betas = fields?.betas ?? this.betas;

    this.createClient =
      fields?.createClient ??
      ((options: ClientOptions) => new Anthropic(options));
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "anthropic",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature ?? undefined,
      ls_max_tokens: params.max_tokens ?? undefined,
      ls_stop: options.stop,
    };
  }

  /**
   * Formats LangChain StructuredTools to AnthropicTools.
   *
   * @param {ChatAnthropicCallOptions["tools"]} tools The tools to format
   * @returns {AnthropicTool[] | undefined} The formatted tools, or undefined if none are passed.
   */
  formatStructuredToolToAnthropic(
    tools: ChatAnthropicCallOptions["tools"]
  ): Anthropic.Messages.ToolUnion[] | undefined {
    if (!tools || !tools.length) {
      return undefined;
    }
    return tools.map((tool) => {
      if (isLangChainTool(tool) && tool.extras?.providerToolDefinition) {
        return tool.extras
          .providerToolDefinition as Anthropic.Messages.ToolUnion;
      }
      if (isBuiltinTool(tool)) {
        return tool;
      }
      if (isAnthropicTool(tool)) {
        return tool;
      }
      if (isOpenAITool(tool)) {
        return {
          name: tool.function.name,
          description: tool.function.description,
          input_schema: tool.function
            .parameters as Anthropic.Messages.Tool.InputSchema,
        };
      }
      if (isLangChainTool(tool)) {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: (isInteropZodSchema(tool.schema)
            ? toJsonSchema(tool.schema)
            : tool.schema) as Anthropic.Messages.Tool.InputSchema,
          ...(tool.extras ? AnthropicToolExtrasSchema.parse(tool.extras) : {}),
        };
      }
      throw new Error(
        `Unknown tool type passed to ChatAnthropic: ${JSON.stringify(
          tool,
          null,
          2
        )}`
      );
    });
  }

  override bindTools(
    tools: ChatAnthropicToolType[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, CallOptions> {
    return this.withConfig({
      tools: this.formatStructuredToolToAnthropic(tools),
      ...kwargs,
    } as Partial<CallOptions>);
  }

  /**
   * Get the parameters used to invoke the model
   */
  override invocationParams(
    options?: this["ParsedCallOptions"]
  ): AnthropicInvocationParams {
    const tool_choice:
      | Anthropic.Messages.ToolChoiceAuto
      | Anthropic.Messages.ToolChoiceAny
      | Anthropic.Messages.ToolChoiceTool
      | Anthropic.Messages.ToolChoiceNone
      | undefined = handleToolChoice(options?.tool_choice);

    const toolBetas = options?.tools?.reduce<AnthropicBeta[]>((acc, tool) => {
      if (
        typeof tool === "object" &&
        "type" in tool &&
        tool.type in ANTHROPIC_TOOL_BETAS
      ) {
        const beta = ANTHROPIC_TOOL_BETAS[tool.type];
        if (!acc.includes(beta)) {
          return [...acc, beta];
        }
      }
      return acc;
    }, []);

    const output: AnthropicInvocationParams = {
      model: this.model,
      stop_sequences: options?.stop ?? this.stopSequences,
      stream: this.streaming,
      max_tokens: this.maxTokens,
      tools: this.formatStructuredToolToAnthropic(options?.tools),
      tool_choice,
      thinking: this.thinking,
      context_management: this.contextManagement,
      ...this.invocationKwargs,
      container: options?.container,
      betas: _combineBetas(this.betas, options?.betas, toolBetas ?? []),
      output_format: options?.output_format,
      mcp_servers: options?.mcp_servers,
    };

    if (this.thinking.type === "enabled") {
      if (this.topP !== undefined && this.topK !== -1) {
        throw new Error("topK is not supported when thinking is enabled");
      }
      if (this.temperature !== undefined && this.temperature !== 1) {
        throw new Error(
          "temperature is not supported when thinking is enabled"
        );
      }
    } else {
      // Only set temperature, top_k, and top_p if thinking is disabled
      output.temperature = this.temperature;
      output.top_k = this.topK;
      output.top_p = this.topP;
    }

    return output;
  }

  /** @ignore */
  _identifyingParams() {
    return {
      model_name: this.model,
      ...this.invocationParams(),
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return {
      model_name: this.model,
      ...this.invocationParams(),
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const params = this.invocationParams(options);
    const formattedMessages = _convertMessagesToAnthropicPayload(messages);
    const payload = {
      ...params,
      ...formattedMessages,
      stream: true,
    } as const;
    const coerceContentToString =
      !_toolsInParams(payload) &&
      !_documentsInParams(payload) &&
      !_thinkingInParams(payload);

    const stream = await this.createStreamWithRetry(payload, {
      headers: options.headers,
    });

    for await (const data of stream) {
      if (options.signal?.aborted) {
        stream.controller.abort();
        throw new Error("AbortError: User aborted the request.");
      }
      const shouldStreamUsage = this.streamUsage ?? options.streamUsage;
      const result = _makeMessageChunkFromAnthropicEvent(data, {
        streamUsage: shouldStreamUsage,
        coerceContentToString,
      });
      if (!result) continue;

      const { chunk } = result;

      // Extract the text content token for text field and runManager.
      const token = extractToken(chunk);
      const generationChunk = new ChatGenerationChunk({
        message: new AIMessageChunk({
          // Just yield chunk as it is and tool_use will be concat by BaseChatModel._generateUncached().
          content: chunk.content,
          additional_kwargs: chunk.additional_kwargs,
          tool_call_chunks: chunk.tool_call_chunks,
          usage_metadata: shouldStreamUsage ? chunk.usage_metadata : undefined,
          response_metadata: chunk.response_metadata,
          id: chunk.id,
        }),
        text: token ?? "",
      });
      yield generationChunk;

      await runManager?.handleLLMNewToken(
        token ?? "",
        undefined,
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk }
      );
    }
  }

  /** @ignore */
  async _generateNonStreaming(
    messages: BaseMessage[],
    params: Omit<
      | Anthropic.Messages.MessageCreateParamsNonStreaming
      | Anthropic.Messages.MessageCreateParamsStreaming,
      "messages"
    > &
      Kwargs,
    requestOptions: AnthropicRequestOptions
  ) {
    const response = await this.completionWithRetry(
      {
        ...params,
        stream: false,
        ..._convertMessagesToAnthropicPayload(messages),
      },
      requestOptions
    );

    const { content, ...additionalKwargs } = response;

    const generations = anthropicResponseToChatMessages(
      content,
      additionalKwargs
    );
    const { role: _role, type: _type, ...rest } = additionalKwargs;
    return { generations, llmOutput: rest };
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.stopSequences && options.stop) {
      throw new Error(
        `"stopSequence" parameter found in input and default params`
      );
    }

    const params = this.invocationParams(options);
    if (params.stream) {
      let finalChunk: ChatGenerationChunk | undefined;
      const stream = this._streamResponseChunks(messages, options, runManager);
      for await (const chunk of stream) {
        if (finalChunk === undefined) {
          finalChunk = chunk;
        } else {
          finalChunk = finalChunk.concat(chunk);
        }
      }
      if (finalChunk === undefined) {
        throw new Error("No chunks returned from Anthropic API.");
      }
      return {
        generations: [
          {
            text: finalChunk.text,
            message: finalChunk.message,
          },
        ],
      };
    } else {
      return this._generateNonStreaming(messages, params, {
        signal: options.signal,
        headers: options.headers,
      });
    }
  }

  /**
   * Creates a streaming request with retry.
   * @param request The parameters for creating a completion.
   * @param options
   * @returns A streaming request.
   */
  protected async createStreamWithRetry(
    request: AnthropicStreamingMessageCreateParams & Kwargs,
    options?: AnthropicRequestOptions
  ): Promise<Stream<AnthropicMessageStreamEvent>> {
    if (!this.streamingClient) {
      const options_ = this.apiUrl ? { baseURL: this.apiUrl } : undefined;
      this.streamingClient = this.createClient({
        dangerouslyAllowBrowser: true,
        ...this.clientOptions,
        ...options_,
        apiKey: this.apiKey,
        // Prefer LangChain built-in retries
        maxRetries: 0,
      });
    }
    const { betas, ...rest } = request;

    const makeCompletionRequest = async () => {
      try {
        if (request?.betas?.length) {
          const stream = await this.streamingClient.beta.messages.create(
            {
              ...rest,
              betas,
              ...this.invocationKwargs,
              stream: true,
            } as AnthropicStreamingMessageCreateParams,
            options
          );
          return stream as Stream<Anthropic.Messages.RawMessageStreamEvent>;
        }
        return await this.streamingClient.messages.create(
          {
            ...rest,
            ...this.invocationKwargs,
            stream: true,
          } as AnthropicStreamingMessageCreateParams,
          options
        );
      } catch (e) {
        const error = wrapAnthropicClientError(e);
        throw error;
      }
    };
    return this.caller.call(makeCompletionRequest);
  }

  /** @ignore */
  protected async completionWithRetry(
    request: AnthropicMessageCreateParams & Kwargs,
    options: AnthropicRequestOptions
  ): Promise<Anthropic.Message> {
    if (!this.batchClient) {
      const options = this.apiUrl ? { baseURL: this.apiUrl } : undefined;
      this.batchClient = this.createClient({
        dangerouslyAllowBrowser: true,
        ...this.clientOptions,
        ...options,
        apiKey: this.apiKey,
        maxRetries: 0,
      });
    }
    const { betas, ...rest } = request;

    const makeCompletionRequest = async () => {
      try {
        if (request?.betas?.length) {
          const response = await this.batchClient.beta.messages.create(
            {
              ...rest,
              ...this.invocationKwargs,
              betas,
            } as AnthropicMessageCreateParams,
            options
          );
          return response as Anthropic.Messages.Message;
        }
        return await this.batchClient.messages.create(
          {
            ...rest,
            ...this.invocationKwargs,
          } as AnthropicMessageCreateParams,
          options
        );
      } catch (e) {
        const error = wrapAnthropicClientError(e);
        throw error;
      }
    };
    return this.caller.callWithOptions(
      { signal: options.signal ?? undefined },
      makeCompletionRequest
    );
  }

  _llmType() {
    return "anthropic";
  }

  /**
   * Return profiling information for the model.
   *
   * Provides information about the model's capabilities and constraints,
   * including token limits, multimodal support, and advanced features like
   * tool calling and structured output.
   *
   * @returns {ModelProfile} An object describing the model's capabilities and constraints
   *
   * @example
   * ```typescript
   * const model = new ChatAnthropic({ model: "claude-opus-4-0" });
   * const profile = model.profile;
   * console.log(profile.maxInputTokens); // 200000
   * console.log(profile.imageInputs); // true
   * ```
   */
  get profile(): ModelProfile {
    return PROFILES[this.model] ?? {};
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    let llm: Runnable<BaseLanguageModelInput>;
    let outputParser: Runnable<AIMessageChunk, RunOutput>;

    const { schema, name, includeRaw } = {
      ...config,
      schema: outputSchema,
    };
    let method = config?.method ?? "functionCalling";

    if (method === "jsonMode") {
      console.warn(
        `"jsonMode" is not supported for Anthropic models. Falling back to "jsonSchema".`
      );
      method = "jsonSchema";
    }
    if (method === "jsonSchema") {
      // https://docs.claude.com/en/docs/build-with-claude/structured-outputs
      outputParser = isInteropZodSchema(schema)
        ? StructuredOutputParser.fromZodSchema(schema)
        : new JsonOutputParser<RunOutput>();
      const jsonSchema = transformJSONSchema(toJsonSchema(schema));
      llm = this.withConfig({
        outputVersion: "v0",
        output_format: {
          type: "json_schema",
          schema: jsonSchema,
        },
        betas: ["structured-outputs-2025-11-13"],
        ls_structured_output_format: {
          kwargs: { method: "json_schema" },
          schema: jsonSchema,
        },
      } as Partial<CallOptions>);
    } else if (method === "functionCalling") {
      let functionName = name ?? "extract";
      let tools: Anthropic.Messages.Tool[];
      if (isInteropZodSchema(schema)) {
        const jsonSchema = toJsonSchema(schema);
        tools = [
          {
            name: functionName,
            description:
              jsonSchema.description ?? "A function available to call.",
            input_schema: jsonSchema as Anthropic.Messages.Tool.InputSchema,
          },
        ];
        outputParser = new AnthropicToolsOutputParser({
          returnSingle: true,
          keyName: functionName,
          zodSchema: schema,
        });
      } else {
        let anthropicTools: Anthropic.Messages.Tool;
        if (
          typeof schema.name === "string" &&
          typeof schema.description === "string" &&
          typeof schema.input_schema === "object" &&
          schema.input_schema != null
        ) {
          anthropicTools = schema as Anthropic.Messages.Tool;
          functionName = schema.name;
        } else {
          anthropicTools = {
            name: functionName,
            description: schema.description ?? "",
            input_schema: schema as Anthropic.Messages.Tool.InputSchema,
          };
        }
        tools = [anthropicTools];
        outputParser = new AnthropicToolsOutputParser<RunOutput>({
          returnSingle: true,
          keyName: functionName,
        });
      }
      if (this.thinking?.type === "enabled") {
        const thinkingAdmonition =
          "Anthropic structured output relies on forced tool calling, " +
          "which is not supported when `thinking` is enabled. This method will raise " +
          "OutputParserException if tool calls are not " +
          "generated. Consider disabling `thinking` or adjust your prompt to ensure " +
          "the tool is called.";

        console.warn(thinkingAdmonition);

        llm = this.withConfig({
          outputVersion: "v0",
          tools,
          ls_structured_output_format: {
            kwargs: { method: "functionCalling" },
            schema: toJsonSchema(schema),
          },
        } as Partial<CallOptions>);

        const raiseIfNoToolCalls = (message: AIMessageChunk) => {
          if (!message.tool_calls || message.tool_calls.length === 0) {
            throw new Error(thinkingAdmonition);
          }
          return message;
        };

        llm = llm.pipe(raiseIfNoToolCalls);
      } else {
        llm = this.withConfig({
          outputVersion: "v0",
          tools,
          tool_choice: {
            type: "tool",
            name: functionName,
          },
          ls_structured_output_format: {
            kwargs: { method: "functionCalling" },
            schema: toJsonSchema(schema),
          },
        } as Partial<CallOptions>);
      }
    } else {
      throw new TypeError(
        `Unrecognized structured output method '${method}'. Expected 'functionCalling' or 'jsonSchema'`
      );
    }

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatAnthropicStructuredOutput",
      }) as Runnable<BaseLanguageModelInput, RunOutput>;
    }

    const parserAssign = RunnablePassthrough.assign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed: (input: any, config) => outputParser.invoke(input.raw, config),
    });
    const parserNone = RunnablePassthrough.assign({
      parsed: () => null,
    });
    const parsedWithFallback = parserAssign.withFallbacks({
      fallbacks: [parserNone],
    });
    return RunnableSequence.from<
      BaseLanguageModelInput,
      { raw: BaseMessage; parsed: RunOutput }
    >([
      {
        raw: llm,
      },
      parsedWithFallback,
    ]).withConfig({
      runName: "StructuredOutputRunnable",
    });
  }
}

export class ChatAnthropic extends ChatAnthropicMessages {}
