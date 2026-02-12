import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { isOpenAITool } from "@langchain/core/language_models/base";
import {
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import {
  type JsonSchema7Type,
  toJsonSchema,
} from "@langchain/core/utils/json_schema";
import { Converter } from "@langchain/core/utils/format";
import type {
  BindToolsInput,
  ToolChoice,
} from "@langchain/core/language_models/chat_models";
import type { Gemini } from "../chat_models/types.js";
import { InvalidInputError, InvalidToolError } from "../utils/errors.js";

/**
 * Adjusts a JSON Schema object type to be compatible with Gemini's function schema format.
 *
 * Gemini's function schema format has specific requirements:
 * - Type must be a string, not an array
 * - Nullable types should use the `nullable` property instead of including "null" in a type array
 * - Union types are not supported
 *
 * @param obj - The JSON Schema object to adjust
 * @returns The adjusted object with type converted to Gemini-compatible format
 * @throws {Error} If the type is a union type or null-only type, which Gemini cannot handle
 *
 * @internal
 */
function adjustObjectType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  if (!Array.isArray(obj.type)) {
    return obj;
  }

  const len = obj.type.length;
  const nullIndex = obj.type.indexOf("null");
  if (len === 2 && nullIndex >= 0) {
    // There are only two values set for the type, and one of them is "null".
    // Set the type to the other one and set nullable to true.
    const typeIndex = nullIndex === 0 ? 1 : 0;
    obj.type = obj.type[typeIndex];
    obj.nullable = true;
  } else if (len === 1 && nullIndex === 0) {
    // This is nullable only without a type, which doesn't make sense for Gemini
    throw new InvalidInputError(
      "Gemini does not support null-only types in function schemas. Provide a non-null type alongside nullable."
    );
  } else if (len === 1) {
    // Although an array, it has only one value.
    // So set it to the string to match what Gemini expects.
    obj.type = obj?.type[0];
  } else if (len === 0) {
    // Empty type array is invalid
    throw new InvalidInputError(
      "Gemini does not support empty type arrays in function schemas. Provide at least one type."
    );
  } else {
    // Anything else could be a union type, so reject it.
    throw new InvalidInputError(
      "Gemini does not support union types in function schemas. Use a single type instead."
    );
  }
  return obj;
}

/**
 * Recursively removes unsupported properties from a JSON Schema object to make it
 * compatible with Gemini's function schema format.
 *
 * Gemini's function schema format does not support:
 * - `additionalProperties` property
 * - Array types (must be converted to string types with nullable flag)
 * - Union types
 *
 * @param obj - The JSON Schema object to clean
 * @returns A cleaned GeminiFunctionSchema object
 *
 * @internal
 */
function removeAdditionalProperties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>
): Gemini.Tools.Schema & { $schema?: string } {
  if (typeof obj === "object" && obj !== null) {
    const newObj = { ...obj };

    if ("additionalProperties" in newObj) {
      delete newObj.additionalProperties;
    }

    adjustObjectType(newObj);

    for (const key in newObj) {
      if (key in newObj) {
        if (Array.isArray(newObj[key])) {
          newObj[key] = newObj[key].map(removeAdditionalProperties);
        } else if (typeof newObj[key] === "object" && newObj[key] !== null) {
          newObj[key] = removeAdditionalProperties(newObj[key]);
        }
      }
    }

    return newObj as Gemini.Tools.Schema;
  }

  return obj as Gemini.Tools.Schema;
}

/**
 * Converts a Zod schema or JSON Schema to Gemini function parameters format.
 *
 * This function handles the conversion of schema definitions from various formats
 * (Zod schemas, JSON Schema 7) to Gemini's function schema format. It removes
 * unsupported properties and adjusts type definitions to be compatible with Gemini.
 *
 * @param schema - The schema to convert (Zod schema or JSON Schema 7)
 * @returns A schema object compatible with Gemini's API
 *
 * @internal
 */
export function schemaToGeminiParameters<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(schema: InteropZodType<RunOutput> | JsonSchema7Type): Gemini.Tools.Schema {
  // Gemini doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  // Zod sometimes also makes an array of type (because of .nullish()),
  // which needs cleaning up.
  const jsonSchema = removeAdditionalProperties(
    isInteropZodSchema(schema) ? toJsonSchema(schema) : schema
  );
  const { $schema, ...rest } = jsonSchema;

  return rest;
}

/**
 * Converts a JSON Schema object to Gemini function parameters format.
 *
 * @param schema - The JSON Schema object to convert
 * @returns A schema object compatible with Gemini's API
 *
 * @internal
 */
function jsonSchemaToGeminiParameters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Record<string, any>
): Gemini.Tools.Schema {
  const jsonSchema = removeAdditionalProperties(schema);
  const { $schema, ...rest } = jsonSchema;

  return rest;
}

/**
 * Type guard to check if a tool is already in Gemini's native format.
 *
 * Gemini tools can be:
 * - Function declarations (`functionDeclarations`)
 * - Code execution tools (`codeExecution`)
 * - Google Search retrieval tools (`googleSearchRetrieval` or `googleSearch`)
 *
 * The full list of tool types are those defined by the `Gemini.Tool` type.
 * Updating that list requires a change to the `geminiToolAttributes` below.
 *
 * @param tool - The tool to check
 * @returns `true` if the tool is already in Gemini format, `false` otherwise
 *
 * @internal
 */
function isGeminiTool(tool: BindToolsInput): tool is Gemini.Tool {
  if (typeof tool !== "object" || tool === null) {
    return false;
  }

  const geminiToolAttributes = [
    "functionDeclarations",
    "codeExecution",
    "googleSearch",
    "urlContext",
    "googleMaps",
    "fileSearch",
    "computerUse",
    "mcpServers",
  ];

  return geminiToolAttributes.some((attr) => attr in tool);
}

/**
 * Converts an array of LangChain tools to Gemini function declarations.
 *
 * This converter transforms various tool formats into Gemini's function declaration
 * format. It supports:
 * - LangChain structured tools (with Zod schemas)
 * - OpenAI format tools (with JSON Schema)
 * - Gemini-native function declarations (passed through)
 * - Raw function declaration objects
 *
 * @remarks
 * The converter handles each tool type differently:
 * - **LangChain tools**: Extracts name, description, and schema, converting the schema
 *   to Gemini-compatible format
 * - **OpenAI tools**: Extracts function name, description, and parameters from the
 *   OpenAI tool format
 * - **Gemini tools**: If the tool contains `functionDeclarations`, extracts and returns
 *   them directly. Non-function Gemini tools (like `codeExecution`) are skipped.
 * - **Raw objects**: Assumes the object is a function declaration and validates it has
 *   a `name` property
 *
 * @example
 * ```typescript
 * import { StructuredTool } from "@langchain/core/tools";
 * import { z } from "zod";
 *
 * const weatherTool = new StructuredTool({
 *   name: "get_weather",
 *   description: "Get the weather for a location",
 *   schema: z.object({
 *     location: z.string().describe("The city name"),
 *     unit: z.enum(["celsius", "fahrenheit"]).optional()
 *   }),
 *   func: async (args) => { /* ... *\/ }
 * });
 *
 * const declarations = convertToolsToGeminiFunctionDeclarations([weatherTool]);
 * // Returns: [{
 * //   name: "get_weather",
 * //   description: "Get the weather for a location",
 * //   parameters: {
 * //     type: "object",
 * //     properties: {
 * //       location: { type: "string", description: "The city name" },
 * //       unit: { type: "string", enum: ["celsius", "fahrenheit"], nullable: true }
 * //     },
 * //     required: ["location"]
 * //   }
 * // }]
 * ```
 *
 * @param tools - Array of tools in various formats (LangChain, OpenAI, or Gemini)
 * @returns Array of Gemini function declarations ready for API submission
 * @throws {Error} If a tool cannot be converted (invalid format)
 */
export const convertToolsToGeminiFunctionDeclarations: Converter<
  BindToolsInput[],
  Gemini.Tools.FunctionDeclaration[]
> = (tools) => {
  const functionDeclarations: Gemini.Tools.FunctionDeclaration[] = [];

  for (const tool of tools) {
    // Skip if already in Gemini format (non-function tools)
    if (isGeminiTool(tool) && !("functionDeclarations" in tool)) {
      continue;
    }

    // Handle Gemini format with functionDeclarations
    if (
      isGeminiTool(tool) &&
      "functionDeclarations" in tool &&
      Array.isArray(tool.functionDeclarations)
    ) {
      functionDeclarations.push(...tool.functionDeclarations);
      continue;
    }

    // Handle LangChain structured tools
    if (isLangChainTool(tool)) {
      const jsonSchema = schemaToGeminiParameters(tool.schema);
      functionDeclarations.push({
        name: tool.name,
        description: tool.description ?? `A function available to call.`,
        parameters: jsonSchema,
      });
      continue;
    }

    // Handle OpenAI format tools
    if (isOpenAITool(tool)) {
      functionDeclarations.push({
        name: tool.function.name,
        description:
          tool.function.description ?? `A function available to call.`,
        parameters: jsonSchemaToGeminiParameters(tool.function.parameters),
      });
      continue;
    }

    // Handle raw function declaration objects
    if (
      typeof tool === "object" &&
      tool !== null &&
      "name" in tool &&
      typeof tool.name === "string"
    ) {
      const funcDecl = tool as Partial<Gemini.Tools.FunctionDeclaration>;
      functionDeclarations.push({
        name: funcDecl.name!,
        description: funcDecl.description ?? `A function available to call.`,
        parameters: funcDecl.parameters,
      });
      continue;
    }

    throw new InvalidToolError(tool);
  }

  return functionDeclarations;
};

/**
 * Converts an array of tools to Gemini's Tools array format.
 *
 * This converter groups function declarations into a single tool object while
 * preserving Gemini-native tools (like code execution and Google Search retrieval)
 * as separate tool objects. This matches Gemini's API structure where:
 * - Function declarations are grouped together in a single tool
 * - Non-function tools (codeExecution, googleSearchRetrieval) are separate tools
 *
 * @remarks
 * The conversion process:
 * 1. Separates Gemini-native tools from function declarations
 * 2. Converts LangChain/OpenAI tools to function declarations
 * 3. Groups all function declarations into a single Tool object
 * 4. Returns an array with the grouped function declarations tool plus any
 *    non-function Gemini tools
 *
 * @example
 * ```typescript
 * import { StructuredTool } from "@langchain/core/tools";
 * import { z } from "zod";
 *
 * const weatherTool = new StructuredTool({
 *   name: "get_weather",
 *   description: "Get the weather",
 *   schema: z.object({ location: z.string() }),
 *   func: async () => {}
 * });
 *
 * const geminiCodeTool: Gemini.Tool = {
 *   codeExecution: { enabled: true }
 * };
 *
 * const tools = convertToolsToGeminiTools([weatherTool, geminiCodeTool]);
 * // Returns: [
 * //   { functionDeclarations: [{ name: "get_weather", ... }] },
 * //   { codeExecution: { enabled: true } }
 * // ]
 * ```
 *
 * @param tools - Array of tools in various formats (LangChain, OpenAI, or Gemini)
 * @returns Array of Tool objects ready for API submission
 */
export const convertToolsToGeminiTools: Converter<
  BindToolsInput[],
  Gemini.Tool[]
> = (tools) => {
  if (tools.length === 0) {
    return [];
  }

  const geminiTools: Gemini.Tool[] = [];
  const functionDeclarations: Gemini.Tools.FunctionDeclaration[] = [];

  // Separate Gemini-native tools from function declarations
  for (const tool of tools) {
    if (isGeminiTool(tool)) {
      if ("functionDeclarations" in tool) {
        // Already a Gemini tool with function declarations
        geminiTools.push(tool);
      } else {
        // Non-function Gemini tool (codeExecution, googleSearch, etc.)
        geminiTools.push(tool);
      }
    } else if ("googleSearchRetrieval" in tool) {
      // Convert the obsolete search into the modern one
      const searchTool: Gemini.Tool = {
        googleSearch: {},
      };
      geminiTools.push(searchTool);
    } else {
      // Convert to function declaration
      const funcDecls = convertToolsToGeminiFunctionDeclarations([tool]);
      functionDeclarations.push(...funcDecls);
    }
  }

  // Add function declarations as a single tool if we have any
  if (functionDeclarations.length > 0) {
    geminiTools.push({
      functionDeclarations,
    });
  }

  return geminiTools;
};

/**
 * Converts tool choice to Gemini's function calling configuration.
 *
 * This converter transforms LangChain's tool choice format into Gemini's
 * `toolConfig.functionCallingConfig` format. The configuration is only
 * created when tools are present (`hasTools` is true).
 *
 * @remarks
 * The conversion logic:
 * - If `hasTools` is `false`, returns `undefined` (no config needed)
 * - If `toolChoice` is provided, converts it to a Gemini mode:
 *   - `"auto"` → `"AUTO"` - Model decides whether to call functions
 *   - `"any"` or `"required"` → `"ANY"` - Model must call at least one function
 *   - `"none"` → `"NONE"` - Model cannot call functions
 *   - Function name string → `"ANY"` - Forces function use
 *   - Object with `mode` → Maps the mode string to Gemini format
 *   - Object with `function` → `"ANY"` - Forces function use
 * - If `toolChoice` is not provided but tools exist, defaults to `"AUTO"`
 *
 * Gemini's function calling modes:
 * - **AUTO**: The model can choose whether to call functions based on the conversation
 * - **ANY**: The model must call at least one function before responding
 * - **NONE**: The model cannot call any functions
 *
 * When a specific function is requested (via function name string or `{ function: { name } }`),
 * the converter uses `"ANY"` mode to force function usage, as Gemini doesn't support
 * specifying individual functions in the mode.
 *
 * @example
 * ```typescript
 * // With explicit tool choice
 * convertToolChoiceToGeminiConfig("auto", true);
 * // Returns: { functionCallingConfig: { mode: "AUTO" } }
 *
 * // Required mode - must call a function
 * convertToolChoiceToGeminiConfig("any", true);
 * // Returns: { functionCallingConfig: { mode: "ANY" } }
 *
 * // Without tool choice (defaults to AUTO when tools exist)
 * convertToolChoiceToGeminiConfig(undefined, true);
 * // Returns: { functionCallingConfig: { mode: "AUTO" } }
 *
 * // No tools - returns undefined
 * convertToolChoiceToGeminiConfig("auto", false);
 * // Returns: undefined
 * ```
 *
 * @param toolChoice - The tool choice option from LangChain (string, object, or undefined)
 * @param hasTools - Whether tools are present. If false, returns undefined
 * @returns The Gemini tool configuration object, or undefined if no tools are present
 */
export function convertToolChoiceToGeminiConfig(
  toolChoice: ToolChoice | undefined,
  hasTools: boolean
): Gemini.Tools.ToolConfig | undefined {
  // Only create config if tools are present
  if (!hasTools) {
    return undefined;
  }

  // Convert tool_choice to Gemini function calling config mode
  let mode: Gemini.Tools.FunctionCallingConfigMode | undefined;
  let allowedFunctionNames: string[] | undefined;

  let toolChoiceMode: string | undefined;
  let toolChoiceFunction: string | string[] | undefined;
  if (typeof toolChoice === "object") {
    toolChoiceMode = toolChoice.mode;
    toolChoiceFunction = toolChoice.function?.name;
  } else {
    toolChoiceMode = toolChoice;
  }

  if (toolChoiceMode === "auto") {
    mode = "AUTO";
  } else if (toolChoiceMode === "any" || toolChoiceMode === "required") {
    mode = "ANY";
  } else if (toolChoiceMode === "none") {
    mode = "NONE";
  } else if (typeof toolChoiceMode === "string") {
    // A function name, which is deprecated, but supported
    mode = "ANY";
    toolChoiceFunction = toolChoiceMode;
  }

  if (toolChoiceFunction) {
    if (Array.isArray(toolChoiceFunction)) {
      allowedFunctionNames = toolChoiceFunction;
    } else {
      allowedFunctionNames = [toolChoiceFunction];
    }
  }

  // Build toolConfig: use explicit mode if provided, otherwise default to AUTO
  const functionCallingConfig: Gemini.Tools.FunctionCallingConfig = {};
  if (allowedFunctionNames?.length) {
    functionCallingConfig.allowedFunctionNames = allowedFunctionNames;
  }
  if (mode) {
    functionCallingConfig.mode = mode;
  }
  return {
    functionCallingConfig,
  };
}
