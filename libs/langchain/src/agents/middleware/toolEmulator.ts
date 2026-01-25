import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ClientTool, ServerTool } from "@langchain/core/tools";
import { initChatModel } from "../../chat_models/universal.js";
import { createMiddleware } from "../middleware.js";

/**
 * Options for configuring the Tool Emulator middleware.
 */
export interface ToolEmulatorOptions {
  /**
   * List of tool names (string) or tool instances to emulate.
   * - If `undefined` (default), ALL tools will be emulated.
   * - If empty array, no tools will be emulated.
   * - If array with tool names/instances, only those tools will be emulated.
   */
  tools?: (string | ClientTool | ServerTool)[];

  /**
   * Model to use for emulation.
   * - Can be a model identifier string (e.g., "anthropic:claude-sonnet-4-5-20250929")
   * - Can be a BaseChatModel instance
   * - Defaults to agent model
   */
  model?: string | BaseChatModel;
}

/**
 * Middleware that emulates specified tools using an LLM instead of executing them.
 *
 * This middleware allows selective emulation of tools for testing purposes.
 * By default (when `tools` is undefined), all tools are emulated. You can specify
 * which tools to emulate by passing a list of tool names or tool instances.
 *
 * @param options - Configuration options for the middleware
 * @param options.tools - List of tool names or tool instances to emulate. If undefined, all tools are emulated.
 * @param options.model - Model to use for emulation. Defaults to "anthropic:claude-sonnet-4-5-20250929".
 *
 * @example Emulate all tools (default behavior)
 * ```ts
 * import { toolEmulatorMiddleware } from "@langchain/langchain/agents/middleware";
 * import { createAgent } from "@langchain/langchain/agents";
 *
 * const middleware = toolEmulatorMiddleware();
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   tools: [getWeather, getUserLocation, calculator],
 *   middleware: [middleware],
 * });
 * ```
 *
 * @example Emulate specific tools by name
 * ```ts
 * const middleware = toolEmulatorMiddleware({
 *   tools: ["get_weather", "get_user_location"]
 * });
 * ```
 *
 * @example Use a custom model for emulation
 * ```ts
 * const middleware = toolEmulatorMiddleware({
 *   tools: ["get_weather"],
 *   model: "anthropic:claude-sonnet-4-5-20250929"
 * });
 * ```
 *
 * @example Emulate specific tools by passing tool instances
 * ```ts
 * const middleware = toolEmulatorMiddleware({
 *   tools: [getWeather, getUserLocation]
 * });
 * ```
 */
export function toolEmulatorMiddleware(
  options: ToolEmulatorOptions = {}
): ReturnType<typeof createMiddleware> {
  let agentModel: BaseChatModel | undefined;
  const { tools, model } = options;

  /**
   * Extract tool names from tools
   */
  const emulateAll = !tools || tools.length === 0;
  const toolsToEmulate = new Set<string>();

  if (!emulateAll && tools) {
    for (const tool of tools) {
      if (typeof tool === "string") {
        toolsToEmulate.add(tool);
      } else {
        // Assume tool instance with .name property
        const toolName =
          typeof tool.name === "string" ? tool.name : String(tool.name);
        toolsToEmulate.add(toolName);
      }
    }
  }

  /**
   * Initialize emulator model
   * We'll initialize it lazily in wrapToolCall to handle async initChatModel
   */
  let emulatorModel: BaseChatModel | undefined;
  const getEmulatorModel = async (): Promise<BaseChatModel> => {
    if (typeof model === "object") {
      return model;
    }
    if (typeof model === "string") {
      emulatorModel =
        emulatorModel ??
        (await initChatModel(model, { temperature: 1 }).catch((err) => {
          console.error(
            "Error initializing emulator model, using agent model:",
            err
          );
          return agentModel as BaseChatModel;
        }));
      return emulatorModel;
    }
    return agentModel as BaseChatModel;
  };

  return createMiddleware({
    name: "ToolEmulatorMiddleware",
    wrapModelCall: async (request, handler) => {
      agentModel = request.model as BaseChatModel;
      return handler(request);
    },
    wrapToolCall: async (request, handler) => {
      const toolName = request.toolCall.name;

      // Check if this tool should be emulated
      const shouldEmulate = emulateAll || toolsToEmulate.has(toolName);

      if (!shouldEmulate) {
        // Let it execute normally by calling the handler
        return handler(request);
      }

      // Extract tool information for emulation
      const toolArgs = request.toolCall.args;
      const toolDescription =
        request.tool?.description || "No description available";

      // Build prompt for emulator LLM
      const toolArgsString =
        typeof toolArgs === "string" ? toolArgs : JSON.stringify(toolArgs);
      const prompt = `You are emulating a tool call for testing purposes.

Tool: ${toolName}
Description: ${toolDescription}
Arguments: ${toolArgsString}

Generate a realistic response that this tool would return given these arguments.
Return ONLY the tool's output, no explanation or preamble. Introduce variation into your responses.`;

      // Get emulated response from LLM
      const emulator = await getEmulatorModel();
      const response = await emulator.invoke([new HumanMessage(prompt)]);

      // Extract content from response
      const content =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

      // Short-circuit: return emulated result without executing real tool
      return new ToolMessage({
        content,
        tool_call_id: request.toolCall.id ?? "",
        name: toolName,
      });
    },
  });
}
