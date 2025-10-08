import { z } from "zod/v3";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { InferInteropZodInput } from "@langchain/core/utils/types";
import { HumanMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";

import { createMiddleware } from "../middleware.js";
import { initChatModel } from "../../chat_models/universal.js";
import type { Runtime } from "../runtime.js";
import type { ModelRequest } from "../nodes/types.js";

const DEFAULT_SYSTEM_PROMPT =
  "Your goal is to select the most relevant tools for answering the user's query.";

/**
 * Prepared inputs for tool selection.
 */
interface SelectionRequest {
  availableTools: StructuredToolInterface[];
  systemMessage: string;
  lastUserMessage: HumanMessage;
  model: BaseLanguageModel;
  validToolNames: string[];
}

/**
 * Create a structured output schema for tool selection.
 *
 * @param tools - Available tools to include in the schema.
 * @returns Zod schema where each tool name is a literal with its description.
 */
function createToolSelectionResponse(tools: StructuredToolInterface[]) {
  if (!tools || tools.length === 0) {
    throw new Error("Invalid usage: tools must be non-empty");
  }

  // Create a union of literals for each tool name
  const toolLiterals = tools.map((tool) => z.literal(tool.name));
  const toolEnum = z.union(
    toolLiterals as [
      z.ZodLiteral<string>,
      z.ZodLiteral<string>,
      ...z.ZodLiteral<string>[]
    ]
  );

  return z.object({
    tools: z
      .array(toolEnum)
      .describe("Tools to use. Place the most relevant tools first."),
  });
}

/**
 * Options for configuring the LLM Tool Selector middleware.
 */
export const LLMToolSelectorOptionsSchema = z.object({
  /**
   * The language model to use for tool selection (default: the provided model from the agent options).
   */
  model: z.string().or(z.instanceof(BaseLanguageModel)).optional(),
  /**
   * System prompt for the tool selection model.
   */
  systemPrompt: z.string().optional(),
  /**
   * Maximum number of tools to select. If the model selects more,
   * only the first maxTools will be used. No limit if not specified.
   */
  maxTools: z.number().optional(),
  /**
   * Tool names to always include regardless of selection.
   * These do not count against the maxTools limit.
   */
  alwaysInclude: z.array(z.string()).optional(),
});
export type LLMToolSelectorConfig = InferInteropZodInput<
  typeof LLMToolSelectorOptionsSchema
>;

/**
 * Middleware for selecting tools using an LLM-based strategy.
 *
 * When an agent has many tools available, this middleware filters them down
 * to only the most relevant ones for the user's query. This reduces token usage
 * and helps the main model focus on the right tools.
 *
 * @param options - Configuration options for the middleware
 * @param options.model - The language model to use for tool selection (default: the provided model from the agent options).
 * @param options.systemPrompt - Instructions for the selection model.
 * @param options.maxTools - Maximum number of tools to select. If the model selects more,
 *   only the first maxTools will be used. No limit if not specified.
 * @param options.alwaysInclude - Tool names to always include regardless of selection.
 *   These do not count against the maxTools limit.
 *
 * @example
 * Limit to 3 tools:
 * ```ts
 * import { llmToolSelectorMiddleware } from "langchain/agents/middleware";
 *
 * const middleware = llmToolSelectorMiddleware({ maxTools: 3 });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   tools: [tool1, tool2, tool3, tool4, tool5],
 *   middleware: [middleware],
 * });
 * ```
 *
 * @example
 * Use a smaller model for selection:
 * ```ts
 * const middleware = llmToolSelectorMiddleware({
 *   model: "openai:gpt-4o-mini",
 *   maxTools: 2
 * });
 * ```
 */
export function llmToolSelectorMiddleware(
  options: LLMToolSelectorConfig
): ReturnType<typeof createMiddleware> {
  return createMiddleware({
    name: "LLMToolSelector",
    contextSchema: LLMToolSelectorOptionsSchema,
    async modifyModelRequest(request, _, runtime): Promise<ModelRequest> {
      const selectionRequest = await prepareSelectionRequest(
        request,
        options,
        runtime
      );
      if (!selectionRequest) {
        return request;
      }

      // Create dynamic response model with union of literal tool names
      const toolSelectionSchema = createToolSelectionResponse(
        selectionRequest.availableTools
      );
      const structuredModel =
        await selectionRequest.model.withStructuredOutput?.(
          toolSelectionSchema
        );

      const response = await structuredModel?.invoke([
        { role: "system", content: selectionRequest.systemMessage },
        selectionRequest.lastUserMessage,
      ]);

      // Response should be an object with a tools array
      if (!response || typeof response !== "object" || !("tools" in response)) {
        throw new Error(
          `Expected object response with tools array, got ${typeof response}`
        );
      }

      return processSelectionResponse(
        response as { tools: string[] },
        selectionRequest.availableTools,
        selectionRequest.validToolNames,
        request,
        options
      );
    },
  });
}

/**
 * Prepare inputs for tool selection.
 *
 * @param request - The model request to process.
 * @param options - Configuration options.
 * @param runtime - Runtime context.
 * @returns SelectionRequest with prepared inputs, or null if no selection is needed.
 */
async function prepareSelectionRequest(
  request: ModelRequest,
  options: LLMToolSelectorConfig,
  runtime: Runtime<LLMToolSelectorConfig>
): Promise<SelectionRequest | undefined> {
  const model = runtime.context.model ?? options.model;
  const maxTools = runtime.context.maxTools ?? options.maxTools;
  const alwaysInclude =
    runtime.context.alwaysInclude ?? options.alwaysInclude ?? [];
  const systemPrompt =
    runtime.context.systemPrompt ??
    options.systemPrompt ??
    DEFAULT_SYSTEM_PROMPT;

  /**
   * If no tools available, return null
   */
  if (!request.tools || request.tools.length === 0) {
    return undefined;
  }

  /**
   * Filter to only StructuredToolInterface instances (exclude provider-specific tool dicts)
   */
  const baseTools = request.tools.filter(
    (tool): tool is StructuredToolInterface =>
      typeof tool === "object" &&
      "name" in tool &&
      "description" in tool &&
      typeof tool.name === "string"
  );

  /**
   * Validate that alwaysInclude tools exist
   */
  if (alwaysInclude.length > 0) {
    const availableToolNames = new Set(baseTools.map((tool) => tool.name));
    const missingTools = alwaysInclude.filter(
      (name) => !availableToolNames.has(name)
    );
    if (missingTools.length > 0) {
      throw new Error(
        `Tools in alwaysInclude not found in request: ${missingTools.join(
          ", "
        )}. ` +
          `Available tools: ${Array.from(availableToolNames).sort().join(", ")}`
      );
    }
  }

  /**
   * Separate tools that are always included from those available for selection
   */
  const availableTools = baseTools.filter(
    (tool) => !alwaysInclude.includes(tool.name)
  );

  /**
   * If no tools available for selection, return null
   */
  if (availableTools.length === 0) {
    return undefined;
  }

  let systemMessage = systemPrompt;
  /**
   * If there's a maxTools limit, append instructions to the system prompt
   */
  if (maxTools !== undefined) {
    systemMessage +=
      `\nIMPORTANT: List the tool names in order of relevance, ` +
      `with the most relevant first. ` +
      `If you exceed the maximum number of tools, ` +
      `only the first ${maxTools} will be used.`;
  }

  /**
   * Get the last user message from the conversation history
   */
  let lastUserMessage: HumanMessage | undefined;
  for (const message of request.messages) {
    if (HumanMessage.isInstance(message)) {
      lastUserMessage = message;
    }
  }

  if (!lastUserMessage) {
    throw new Error("No user message found in request messages");
  }

  const modelInstance = !model
    ? (request.model as BaseLanguageModel)
    : typeof model === "string"
    ? await initChatModel(model)
    : model;

  const validToolNames = availableTools.map((tool) => tool.name);

  return {
    availableTools,
    systemMessage,
    lastUserMessage,
    model: modelInstance,
    validToolNames,
  };
}

/**
 * Process the selection response and return filtered ModelRequest.
 *
 * @param response - The structured output response from the model.
 * @param availableTools - Tools available for selection.
 * @param validToolNames - Valid tool names that can be selected.
 * @param request - Original model request.
 * @param options - Configuration options.
 * @returns Modified ModelRequest with filtered tools.
 */
function processSelectionResponse(
  response: { tools: string[] },
  availableTools: StructuredToolInterface[],
  validToolNames: string[],
  request: ModelRequest,
  options: LLMToolSelectorConfig
): ModelRequest {
  const maxTools = options.maxTools;
  const alwaysInclude = options.alwaysInclude ?? [];

  const selectedToolNames: string[] = [];
  const invalidToolSelections: string[] = [];

  for (const toolName of response.tools) {
    if (!validToolNames.includes(toolName)) {
      invalidToolSelections.push(toolName);
      continue;
    }

    /**
     * Only add if not already selected and within maxTools limit
     */
    if (
      !selectedToolNames.includes(toolName) &&
      (maxTools === undefined || selectedToolNames.length < maxTools)
    ) {
      selectedToolNames.push(toolName);
    }
  }

  if (invalidToolSelections.length > 0) {
    throw new Error(
      `Model selected invalid tools: ${invalidToolSelections.join(", ")}`
    );
  }

  /**
   * Filter tools based on selection
   */
  const selectedTools = availableTools.filter((tool) =>
    selectedToolNames.includes(tool.name)
  );

  /**
   * Append always-included tools
   */
  const alwaysIncludedTools = (request.tools ?? []).filter(
    (tool): tool is StructuredToolInterface =>
      typeof tool === "object" &&
      "name" in tool &&
      typeof tool.name === "string" &&
      alwaysInclude.includes(tool.name)
  );
  selectedTools.push(...alwaysIncludedTools);

  /**
   * Also preserve any provider-specific tool dicts from the original request
   */
  const providerTools = (request.tools ?? []).filter(
    (tool) =>
      !(
        typeof tool === "object" &&
        "name" in tool &&
        "description" in tool &&
        typeof tool.name === "string"
      )
  );

  return {
    ...request,
    tools: [...selectedTools, ...providerTools],
  };
}
