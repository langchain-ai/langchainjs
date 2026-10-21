import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { isOpenAITool } from "@langchain/core/language_models/base";
import { Converter } from "@langchain/core/utils/format";
import type {
  BindToolsInput,
  ToolChoice,
} from "@langchain/core/language_models/chat_models";
import type { Gemini } from "../../chat_models/types.js";
import { InvalidToolError } from "../../utils/errors.js";
import { schemaToGeminiParameters } from "../generate_content/tools.js";

const INTERACTIONS_TOOL_TYPES = new Set([
  "function",
  "google_search",
  "code_execution",
  "url_context",
  "computer_use",
  "file_search",
  "google_maps",
  "mcp_server",
  "retrieval",
]);

/**
 * Type guard to check if a tool is already in Interactions API format.
 * Note: OpenAI tools also have `type: "function"`, so we exclude objects
 * that have an OpenAI-style nested `function` object.
 */
function isInteractionsTool(
  tool: BindToolsInput
): tool is Gemini.Interactions.Tool {
  if (typeof tool !== "object" || tool === null) {
    return false;
  }
  if (isOpenAITool(tool)) {
    return false;
  }
  if (!("type" in tool) || typeof tool.type !== "string") {
    return false;
  }
  return INTERACTIONS_TOOL_TYPES.has(tool.type);
}

/**
 * Type guard to check if a tool is in GenerateContent `Gemini.Tool` format.
 */
function isGenerateContentTool(tool: BindToolsInput): tool is Gemini.Tool {
  if (typeof tool !== "object" || tool === null) {
    return false;
  }

  const geminiToolAttributes = [
    "functionDeclarations",
    "codeExecution",
    "googleSearch",
    "googleSearchRetrieval",
    "urlContext",
    "googleMaps",
    "fileSearch",
    "computerUse",
    "mcpServers",
    "retrieval",
  ];

  return geminiToolAttributes.some((attr) => attr in tool);
}

/**
 * Converts a GenerateContent-formatted `Gemini.Tool` object into one or more
 * flat Interactions API `Gemini.Interactions.Tool` objects, translating
 * camelCase properties to snake_case where appropriate.
 */
function convertGenerateContentToolToInteractionsTools(
  tool: Gemini.Tool & Record<string, unknown>
): Gemini.Interactions.Tool[] {
  const results: Gemini.Interactions.Tool[] = [];

  if (
    "functionDeclarations" in tool &&
    Array.isArray(tool.functionDeclarations)
  ) {
    for (const decl of tool.functionDeclarations) {
      const parameters = (decl.parameters ?? decl.parametersJsonSchema) as
        | Record<string, unknown>
        | undefined;
      results.push({
        type: "function",
        name: decl.name ?? "",
        description: decl.description ?? "A function available to call.",
        ...(parameters ? { parameters } : {}),
      });
    }
  }

  if ("googleSearch" in tool && tool.googleSearch) {
    const gs = tool.googleSearch as Gemini.Tools.GoogleSearch &
      Record<string, unknown>;
    const searchTypes: Array<"web_search" | "image_search" | "enterprise_web_search"> =
      [];
    if (gs.searchTypes?.webSearch) {
      searchTypes.push("web_search");
    }
    if (gs.searchTypes?.imageSearch) {
      searchTypes.push("image_search");
    }
    const timeRangeFilter =
      (gs.time_range_filter as Gemini.Interactions.GoogleSearch["time_range_filter"]) ??
      (gs.timeRangeFilter
        ? {
            start_time: gs.timeRangeFilter.startTime,
            end_time: gs.timeRangeFilter.endTime,
          }
        : undefined);

    results.push({
      type: "google_search",
      ...(searchTypes.length > 0 ? { search_types: searchTypes } : {}),
      ...(timeRangeFilter ? { time_range_filter: timeRangeFilter } : {}),
    });
  } else if ("googleSearchRetrieval" in tool) {
    results.push({
      type: "google_search",
    });
  }

  if ("codeExecution" in tool && tool.codeExecution) {
    results.push({
      type: "code_execution",
    });
  }

  if ("urlContext" in tool && tool.urlContext) {
    results.push({
      type: "url_context",
    });
  }

  if ("googleMaps" in tool && tool.googleMaps) {
    const gm = tool.googleMaps as Gemini.Tools.GoogleMaps &
      Record<string, unknown>;
    const enableWidget =
      (gm.enable_widget as boolean | undefined) ?? gm.enableWidget;
    results.push({
      type: "google_maps",
      ...(typeof enableWidget === "boolean"
        ? { enable_widget: enableWidget }
        : {}),
      ...(typeof gm.latitude === "number" ? { latitude: gm.latitude } : {}),
      ...(typeof gm.longitude === "number" ? { longitude: gm.longitude } : {}),
    });
  }

  if ("fileSearch" in tool && tool.fileSearch) {
    const fs = tool.fileSearch as Gemini.Tools.FileSearch &
      Record<string, unknown>;
    const storeNames =
      (fs.file_search_store_names as string[] | undefined) ??
      fs.fileSearchStoreNames;
    const topK = (fs.top_k as number | undefined) ?? fs.topK;
    const metadataFilter =
      (fs.metadata_filter as string | undefined) ?? fs.metadataFilter;
    results.push({
      type: "file_search",
      ...(storeNames ? { file_search_store_names: storeNames } : {}),
      ...(typeof topK === "number" ? { top_k: topK } : {}),
      ...(metadataFilter ? { metadata_filter: metadataFilter } : {}),
    });
  }

  if ("computerUse" in tool && tool.computerUse) {
    const cu = tool.computerUse as Gemini.Tools.ComputerUse &
      Record<string, unknown>;
    const rawEnv = cu.environment;
    const environment =
      rawEnv === "ENVIRONMENT_BROWSER" || rawEnv === "browser"
        ? ("browser" as const)
        : undefined;
    const excludedPredefinedFunctions =
      (cu.excluded_predefined_functions as string[] | undefined) ??
      cu.excludedPredefinedFunctions;
    results.push({
      type: "computer_use",
      ...(environment ? { environment } : {}),
      ...(excludedPredefinedFunctions
        ? { excluded_predefined_functions: excludedPredefinedFunctions }
        : {}),
    });
  }

  if ("mcpServers" in tool && Array.isArray(tool.mcpServers)) {
    for (const server of tool.mcpServers as Array<Record<string, unknown>>) {
      const transport = server.streamableHttpTransport as
        | Record<string, unknown>
        | undefined;
      const url = (server.url ?? transport?.url) as string | undefined;
      const headers = (server.headers ?? transport?.headers) as
        | Record<string, string>
        | undefined;
      const allowedTools = (server.allowed_tools ?? server.allowedTools) as
        | Gemini.Interactions.AllowedTools[]
        | undefined;
      results.push({
        type: "mcp_server",
        ...(typeof server.name === "string" ? { name: server.name } : {}),
        ...(url ? { url } : {}),
        ...(headers ? { headers } : {}),
        ...(allowedTools ? { allowed_tools: allowedTools } : {}),
      });
    }
  }

  if ("retrieval" in tool && tool.retrieval) {
    const ret = tool.retrieval as Record<string, unknown>;
    const vas = (ret.vertex_ai_search_config ?? ret.vertexAiSearch) as
      | Record<string, unknown>
      | undefined;
    const datastores = Array.isArray(vas?.datastores)
      ? (vas.datastores as string[])
      : typeof vas?.datastore === "string"
        ? [vas.datastore]
        : undefined;
    results.push({
      type: "retrieval",
      ...(vas
        ? {
            retrieval_types: ["vertex_ai_search"],
            vertex_ai_search_config: {
              ...(datastores ? { datastores } : {}),
              ...(typeof vas.engine === "string" ? { engine: vas.engine } : {}),
            },
          }
        : {}),
    });
  }

  return results;
}

/**
 * Converts an array of tools in any supported format (LangChain `StructuredTool`,
 * OpenAI tool, GenerateContent `Gemini.Tool`, raw `FunctionDeclaration`, or native
 * Interactions `Tool`) into flat `Gemini.Interactions.Tool[]` items.
 */
export const convertToolsToInteractionsTools: Converter<
  BindToolsInput[],
  Gemini.Interactions.Tool[]
> = (tools) => {
  if (tools.length === 0) {
    return [];
  }

  const interactionsTools: Gemini.Interactions.Tool[] = [];

  for (const tool of tools) {
    if (isInteractionsTool(tool)) {
      interactionsTools.push(tool);
      continue;
    }

    if (isGenerateContentTool(tool)) {
      interactionsTools.push(
        ...convertGenerateContentToolToInteractionsTools(
          tool as Gemini.Tool & Record<string, unknown>
        )
      );
      continue;
    }

    if (isLangChainTool(tool)) {
      const jsonSchema = schemaToGeminiParameters(tool.schema);
      interactionsTools.push({
        type: "function",
        name: tool.name,
        description: tool.description ?? "A function available to call.",
        parameters: jsonSchema as unknown as Record<string, unknown>,
      });
      continue;
    }

    if (isOpenAITool(tool)) {
      interactionsTools.push({
        type: "function",
        name: tool.function.name,
        description:
          tool.function.description ?? "A function available to call.",
        parameters: tool.function.parameters
          ? (schemaToGeminiParameters(
              tool.function.parameters
            ) as unknown as Record<string, unknown>)
          : undefined,
      });
      continue;
    }

    if (
      typeof tool === "object" &&
      tool !== null &&
      "name" in tool &&
      typeof tool.name === "string"
    ) {
      const funcDecl = tool as Partial<Gemini.Tools.FunctionDeclaration>;
      interactionsTools.push({
        type: "function",
        name: funcDecl.name!,
        description: funcDecl.description ?? "A function available to call.",
        ...(funcDecl.parameters
          ? {
              parameters: funcDecl.parameters as unknown as Record<
                string,
                unknown
              >,
            }
          : {}),
      });
      continue;
    }

    throw new InvalidToolError(tool);
  }

  return interactionsTools;
};

/**
 * Converts LangChain's `tool_choice` option into the Interactions API
 * `generation_config.tool_choice` format (`ToolChoiceType | ToolChoiceConfig`).
 */
export function convertToolChoiceToInteractionsConfig(
  toolChoice: ToolChoice | undefined,
  hasTools: boolean
): Gemini.Interactions.ToolChoice | undefined {
  if (!hasTools || toolChoice === undefined) {
    return undefined;
  }

  if (typeof toolChoice === "object" && toolChoice !== null) {
    if ("allowed_tools" in toolChoice) {
      return toolChoice as Gemini.Interactions.ToolChoiceConfig;
    }
  }

  let mode: Gemini.Interactions.ToolChoiceType | undefined;
  let allowedFunctionNames: string[] | undefined;

  let toolChoiceMode: string | undefined;
  let toolChoiceFunction: string | string[] | undefined;

  if (typeof toolChoice === "object" && toolChoice !== null) {
    const obj = toolChoice as {
      mode?: string;
      function?: { name?: string };
      allowedFunctionNames?: string[];
    };
    toolChoiceMode = obj.mode;
    toolChoiceFunction = obj.function?.name ?? obj.allowedFunctionNames;
  } else if (typeof toolChoice === "string") {
    toolChoiceMode = toolChoice;
  }

  const normalizedMode = toolChoiceMode?.toLowerCase();
  if (normalizedMode === "auto") {
    mode = "auto";
  } else if (normalizedMode === "any" || normalizedMode === "required") {
    mode = "any";
  } else if (normalizedMode === "none") {
    mode = "none";
  } else if (normalizedMode === "validated") {
    mode = "validated";
  } else if (typeof toolChoiceMode === "string" && toolChoiceMode.length > 0) {
    mode = "any";
    toolChoiceFunction = toolChoiceMode;
  }

  if (toolChoiceFunction) {
    allowedFunctionNames = Array.isArray(toolChoiceFunction)
      ? toolChoiceFunction
      : [toolChoiceFunction];
  }

  if (allowedFunctionNames && allowedFunctionNames.length > 0) {
    return {
      allowed_tools: {
        mode: mode ?? "any",
        tools: allowedFunctionNames,
      },
    };
  }

  return mode;
}
