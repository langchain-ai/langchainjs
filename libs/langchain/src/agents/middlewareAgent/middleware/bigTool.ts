import { z } from "zod/v3";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { InferInteropZodInput } from "@langchain/core/utils/types";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";

import { createMiddleware } from "../middleware.js";
import { initChatModel } from "../../../chat_models/universal.js";
import type { ModelRequest } from "../types.js";

/**
 * Zod schema for tool selection structured output.
 */
const ToolSelectionSchema = z.object({
  selectedTools: z.array(z.string()).describe("List of selected tool names"),
});

const DEFAULT_SYSTEM_PROMPT =
  "Your goal is to select the most relevant tool for answering the user's query.";
const DEFAULT_INCLUDE_FULL_HISTORY = false;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Options for configuring the LLM Tool Selector middleware.
 */
export const LLMToolSelectorOptionsSchema = z.object({
  /**
   * The language model to use for tool selection (default: the provided model from the agent options).
   */
  model: z.string().or(z.instanceof(BaseChatModel)).optional(),
  /**
   * System prompt for the tool selection model.
   */
  systemPrompt: z.string().default(DEFAULT_SYSTEM_PROMPT),
  /**
   * Maximum number of tools to select.
   */
  maxTools: z.number().optional(),
  /**
   * Whether to include the full conversation history in the tool selection prompt.
   */
  includeFullHistory: z.boolean().default(DEFAULT_INCLUDE_FULL_HISTORY),
  /**
   * Maximum number of retries if the model selects incorrect tools.
   */
  maxRetries: z.number().default(DEFAULT_MAX_RETRIES),
});
export type LLMToolSelectorConfig = InferInteropZodInput<
  typeof LLMToolSelectorOptionsSchema
>;

/**
 * Middleware for selecting tools using an LLM-based strategy.
 *
 * This middleware analyzes the user's query and available tools to select
 * the most relevant tools for the task, reducing the cognitive load on the
 * main model and improving response quality.
 *
 * @param options - Configuration options for the middleware
 * @param options.model - The language model to use for tool selection (default: the provided model from the agent options).
 * @param options.systemPrompt - System prompt for the tool selection model.
 * @param options.maxTools - Maximum number of tools to select.
 * @param options.includeFullHistory - Whether to include the full conversation history in the tool selection prompt.
 * @param options.maxRetries - Maximum number of retries if the model selects incorrect tools.
 *
 * @example
 * ```ts
 * import { llmToolSelectorMiddleware } from "langchain/agents/middleware";
 *
 * const middleware = llmToolSelectorMiddleware({
 *   maxTools: 3,
 *   systemPrompt: "Select the most relevant tools for the user's query."
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   tools: [tool1, tool2, tool3, tool4, tool5],
 *   middleware: [middleware],
 * });
 * ```
 */
export function llmToolSelectorMiddleware(options: LLMToolSelectorConfig) {
  return createMiddleware({
    name: "LLMToolSelector",
    contextSchema: LLMToolSelectorOptionsSchema,
    async modifyModelRequest(request, _, runtime): Promise<ModelRequest> {
      const model = runtime.context.model ?? options.model;
      const maxTools = runtime.context.maxTools ?? options.maxTools;
      const includeFullHistory =
        runtime.context.includeFullHistory === DEFAULT_INCLUDE_FULL_HISTORY
          ? options.includeFullHistory ?? runtime.context.includeFullHistory
          : runtime.context.includeFullHistory ?? options.includeFullHistory;
      const maxRetries =
        runtime.context.maxRetries === DEFAULT_MAX_RETRIES
          ? options.maxRetries ?? runtime.context.maxRetries
          : runtime.context.maxRetries ?? options.maxRetries;
      const defaultSystemPrompt =
        runtime.context.systemPrompt === DEFAULT_SYSTEM_PROMPT
          ? options.systemPrompt ?? runtime.context.systemPrompt
          : runtime.context.systemPrompt ?? options.systemPrompt;

      /**
       * If no tools available, return request unchanged
       */
      if (!request.tools || request.tools.length === 0) {
        return request;
      }

      /**
       * Extract tool information
       */
      const toolInfo = runtime.tools.map((tool) => ({
        name: tool.name as string,
        description: tool.description,
        tool,
      }));

      /**
       * Build tool representation for the prompt
       */
      const toolRepresentation = toolInfo
        .map(({ name, description }) => `- ${name}: ${description}`)
        .join("\n");

      /**
       * Build system message
       */
      let systemMessage = `You are an agent that can use the following tools:\n${toolRepresentation}\n${defaultSystemPrompt}`;

      if (includeFullHistory) {
        const userMessages = request.messages
          .filter(HumanMessage.isInstance)
          .map((msg: BaseMessage) => msg.content)
          .join("\n");
        systemMessage += `\nThe full conversation history is:\n${userMessages}`;
      }

      if (maxTools !== undefined) {
        systemMessage += ` You can select up to ${maxTools} tools.`;
      }

      /**
       * Get the latest user message
       */
      const latestMessage = request.messages.at(-1);
      const userContent =
        typeof latestMessage?.content === "string"
          ? latestMessage?.content
          : JSON.stringify(latestMessage?.content);

      /**
       * Create tool selection model
       */
      const toolSelectionModel = !model
        ? (request.model as BaseChatModel)
        : typeof model === "string"
        ? await initChatModel(model)
        : model;

      const validToolNames = toolInfo.map(({ name }) => name);
      const structuredModel = await toolSelectionModel.withStructuredOutput(
        ToolSelectionSchema
      );

      let attempts = 0;
      let selectedToolNames: string[] = [...validToolNames];

      while (attempts <= maxRetries) {
        try {
          const response = await structuredModel.invoke([
            { role: "system", content: systemMessage },
            { role: "user", content: userContent },
          ]);

          selectedToolNames = response.selectedTools;

          /**
           * Validate that selected tools exist
           */
          const invalidTools = selectedToolNames.filter(
            (name) => !validToolNames.includes(name)
          );

          if (selectedToolNames.length === 0) {
            systemMessage += `\n\nNote: You have not selected any tools. Please select at least one tool.`;
            attempts++;
          } else if (
            invalidTools.length === 0 &&
            maxTools &&
            selectedToolNames.length > maxTools
          ) {
            systemMessage += `\n\nNote: You have selected more tools than the maximum allowed. You can select up to ${maxTools} tools.`;
            attempts++;
          } else if (invalidTools.length === 0) {
            /**
             * Success
             */
            break;
          } else if (attempts < maxRetries) {
            /**
             * Retry with feedback about invalid tools
             */
            systemMessage += `\n\nNote: The following tools are not available: ${invalidTools.join(
              ", "
            )}. Please select only from the available tools.`;
            attempts++;
          } else {
            /**
             * Filter out invalid tools on final attempt
             */
            selectedToolNames = selectedToolNames.filter((name) =>
              validToolNames.includes(name)
            );
            break;
          }
        } catch {
          /**
           * Fall back to using all tools
           */
          if (attempts >= maxRetries) {
            return request;
          }
          attempts++;
        }
      }

      /**
       * Filter tools based on selection
       */
      const selectedTools = toolInfo
        .filter(({ name }) => selectedToolNames.includes(name))
        .map(({ name }) => name);

      return {
        ...request,
        tools: selectedTools,
      };
    },
  });
}
