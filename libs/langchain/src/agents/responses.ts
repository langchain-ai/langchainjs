/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-instanceof/no-instanceof */
import {
  InteropZodObject,
  isInteropZodSchema,
  InteropZodType,
  isInteropZodObject,
} from "@langchain/core/utils/types";
import { type AIMessage } from "@langchain/core/messages";
import { type LanguageModelLike } from "@langchain/core/language_models/base";
import { toJsonSchema, Validator } from "@langchain/core/utils/json_schema";
import { type FunctionDefinition } from "@langchain/core/language_models/base";

import {
  StructuredOutputParsingError,
  MultipleStructuredOutputsError,
} from "./errors.js";
import { isConfigurableModel, isBaseChatModel } from "./model.js";

/**
 * Special type to indicate that no response format is provided.
 * When this type is used, the structuredResponse property should not be present in the result.
 */
export type ResponseFormatUndefined = {
  __responseFormatUndefined: true;
};

/**
 * This is a global counter for generating unique names for tools.
 */
let bindingIdentifier = 0;

/**
 * Information for tracking structured output tool metadata.
 * This contains all necessary information to handle structured responses generated
 * via tool calls, including the original schema, its type classification, and the
 * corresponding tool implementation used by the tools strategy.
 */
export class ToolStrategy<_T = unknown> {
  private constructor(
    /**
     * The original JSON Schema provided for structured output
     */
    public readonly schema: Record<string, unknown>,

    /**
     * The tool that will be used to parse the tool call arguments.
     */
    public readonly tool: {
      type: "function";
      function: FunctionDefinition;
    },

    /**
     * The options to use for the tool output.
     */
    public readonly options?: ToolStrategyOptions
  ) {}

  get name() {
    return this.tool.function.name;
  }

  static fromSchema<S extends InteropZodObject>(
    schema: S,
    outputOptions?: ToolStrategyOptions
  ): ToolStrategy<S extends InteropZodType<infer U> ? U : unknown>;

  static fromSchema(
    schema: Record<string, unknown>,
    outputOptions?: ToolStrategyOptions
  ): ToolStrategy<Record<string, unknown>>;

  static fromSchema(
    schema: InteropZodObject | Record<string, unknown>,
    outputOptions?: ToolStrategyOptions
  ): ToolStrategy<any> {
    /**
     * It is required for tools to have a name so we can map the tool call to the correct tool
     * when parsing the response.
     */
    function getFunctionName(name?: string) {
      return name ?? `extract-${++bindingIdentifier}`;
    }

    if (isInteropZodSchema(schema)) {
      const asJsonSchema = toJsonSchema(schema);
      const tool = {
        type: "function" as const,
        function: {
          name: getFunctionName(),
          strict: false,
          description:
            asJsonSchema.description ??
            "Tool for extracting structured output from the model's response.",
          parameters: asJsonSchema,
        },
      };
      return new ToolStrategy(asJsonSchema, tool, outputOptions);
    }

    let functionDefinition: FunctionDefinition;
    if (
      typeof schema.name === "string" &&
      typeof schema.parameters === "object" &&
      schema.parameters != null
    ) {
      functionDefinition = schema as unknown as FunctionDefinition;
    } else {
      functionDefinition = {
        name: getFunctionName(schema.title as string),
        description: (schema.description as string) ?? "",
        parameters: schema.schema || (schema as Record<string, unknown>),
      };
    }
    const asJsonSchema = toJsonSchema(schema);
    const tool = {
      type: "function" as const,
      function: functionDefinition,
    };
    return new ToolStrategy(asJsonSchema, tool, outputOptions);
  }

  /**
   * Parse tool arguments according to the schema.
   *
   * @throws {StructuredOutputParsingError} if the response is not valid
   * @param toolArgs - The arguments from the tool call
   * @returns The parsed response according to the schema type
   */
  parse(toolArgs: Record<string, unknown>): Record<string, unknown> {
    const validator = new Validator(this.schema);
    const result = validator.validate(toolArgs);
    if (!result.valid) {
      throw new StructuredOutputParsingError(
        this.name,
        result.errors.map((e) => e.error)
      );
    }
    return toolArgs;
  }
}

export class ProviderStrategy<T = unknown> {
  // @ts-expect-error - _schemaType is used only for type inference
  private _schemaType?: T;

  /**
   * The schema to use for the provider strategy
   */
  public readonly schema: Record<string, unknown>;

  /**
   * Whether to use strict mode for the provider strategy
   */
  public readonly strict: boolean;

  private constructor(options: {
    schema: Record<string, unknown>;
    strict?: boolean;
  });
  private constructor(schema: Record<string, unknown>, strict?: boolean);
  private constructor(
    schemaOrOptions:
      | Record<string, unknown>
      | { schema: Record<string, unknown>; strict?: boolean },
    strict?: boolean
  ) {
    if (
      "schema" in schemaOrOptions &&
      typeof schemaOrOptions.schema === "object" &&
      schemaOrOptions.schema !== null &&
      !("type" in schemaOrOptions)
    ) {
      const options = schemaOrOptions as {
        schema: Record<string, unknown>;
        strict?: boolean;
      };
      this.schema = options.schema;
      this.strict = options.strict ?? false;
    } else {
      this.schema = schemaOrOptions as Record<string, unknown>;
      this.strict = strict ?? false;
    }
  }

  static fromSchema<T>(
    schema: InteropZodType<T>,
    strict?: boolean
  ): ProviderStrategy<T>;

  static fromSchema(
    schema: Record<string, unknown>,
    strict?: boolean
  ): ProviderStrategy<Record<string, unknown>>;

  static fromSchema<T = unknown>(
    schema: InteropZodType<T> | Record<string, unknown>,
    strict: boolean = false
  ): ProviderStrategy<T> | ProviderStrategy<Record<string, unknown>> {
    const asJsonSchema = toJsonSchema(schema);
    return new ProviderStrategy(asJsonSchema, strict) as
      | ProviderStrategy<T>
      | ProviderStrategy<Record<string, unknown>>;
  }

  /**
   * Parse tool arguments according to the schema. If the response is not valid, return undefined.
   *
   * @param response - The AI message response to parse
   * @returns The parsed response according to the schema type
   */
  parse(response: AIMessage) {
    /**
     * Extract text content from the response.
     * Handles both string content and array content (e.g., from thinking models).
     */
    let textContent: string | undefined;

    if (typeof response.content === "string") {
      textContent = response.content;
    } else if (Array.isArray(response.content)) {
      /**
       * For thinking models, content is an array with thinking blocks and text blocks.
       * Extract the text from text blocks.
       */
      for (const block of response.content) {
        if (
          typeof block === "object" &&
          block !== null &&
          "type" in block &&
          block.type === "text" &&
          "text" in block &&
          typeof block.text === "string"
        ) {
          textContent = block.text;
          break; // Use the first text block found
        }
      }
    }

    // Return if no valid text content found
    if (!textContent || textContent === "") {
      return;
    }

    try {
      const content = JSON.parse(textContent);
      const validator = new Validator(this.schema);
      const result = validator.validate(content);
      if (!result.valid) {
        return;
      }

      return content;
    } catch {
      // no-op
    }
  }
}

export type ResponseFormat = ToolStrategy<any> | ProviderStrategy<any>;

/**
 * Handle user input for `responseFormat` parameter of `CreateAgentParams`.
 * This function defines the default behavior for the `responseFormat` parameter, which is:
 *
 * - if value is a Zod schema, default to structured output via tool calling
 * - if value is a JSON schema, default to structured output via tool calling
 * - if value is a custom response format, return it as is
 * - if value is an array, ensure all array elements are instance of `ToolStrategy`
 * @param responseFormat - The response format to transform, provided by the user
 * @param options - The response format options for tool strategy
 * @param model - The model to check if it supports JSON schema output
 * @returns
 */
export function transformResponseFormat(
  responseFormat?:
    | InteropZodType<any>
    | InteropZodType<any>[]
    | JsonSchemaFormat
    | JsonSchemaFormat[]
    | ResponseFormat
    | ToolStrategy<any>[]
    | ResponseFormatUndefined,
  options?: ToolStrategyOptions,
  model?: LanguageModelLike | string
): ResponseFormat[] {
  if (!responseFormat) {
    return [];
  }

  // Handle ResponseFormatUndefined case
  if (
    typeof responseFormat === "object" &&
    responseFormat !== null &&
    "__responseFormatUndefined" in responseFormat
  ) {
    return [];
  }

  /**
   * If users provide an array, it should only contain raw schemas (Zod or JSON schema),
   * not ToolStrategy or ProviderStrategy instances.
   */
  if (Array.isArray(responseFormat)) {
    /**
     * if every entry is a ToolStrategy or ProviderStrategy instance, return the array as is
     */
    if (
      responseFormat.every(
        (item) =>
          item instanceof ToolStrategy || item instanceof ProviderStrategy
      )
    ) {
      return responseFormat as unknown as ResponseFormat[];
    }

    /**
     * Check if all items are Zod schemas
     */
    if (responseFormat.every((item) => isInteropZodObject(item))) {
      return responseFormat.map((item) =>
        ToolStrategy.fromSchema(item as InteropZodObject, options)
      );
    }

    /**
     * Check if all items are plain objects (JSON schema)
     */
    if (
      responseFormat.every(
        (item) =>
          typeof item === "object" && item !== null && !isInteropZodObject(item)
      )
    ) {
      return responseFormat.map((item) =>
        ToolStrategy.fromSchema(item as JsonSchemaFormat, options)
      );
    }

    throw new Error(
      `Invalid response format: list contains mixed types.\n` +
        `All items must be either InteropZodObject or plain JSON schema objects.`
    );
  }

  if (
    responseFormat instanceof ToolStrategy ||
    responseFormat instanceof ProviderStrategy
  ) {
    return [responseFormat];
  }

  const useProviderStrategy = hasSupportForJsonSchemaOutput(model);

  /**
   * `responseFormat` is a Zod schema
   */
  if (isInteropZodObject(responseFormat)) {
    return useProviderStrategy
      ? [ProviderStrategy.fromSchema(responseFormat)]
      : [ToolStrategy.fromSchema(responseFormat, options)];
  }

  /**
   * Handle plain object (JSON schema)
   */
  if (
    typeof responseFormat === "object" &&
    responseFormat !== null &&
    "properties" in responseFormat
  ) {
    return useProviderStrategy
      ? [ProviderStrategy.fromSchema(responseFormat as JsonSchemaFormat)]
      : [ToolStrategy.fromSchema(responseFormat as JsonSchemaFormat, options)];
  }

  throw new Error(`Invalid response format: ${String(responseFormat)}`);
}

/**
 * Branded type for ToolStrategy arrays that preserves type information
 */
export interface TypedToolStrategy<T = unknown>
  extends Array<ToolStrategy<any>> {
  _schemaType?: T;
}
export type ToolStrategyError =
  | StructuredOutputParsingError
  | MultipleStructuredOutputsError;
export interface ToolStrategyOptions {
  /**
   * Allows you to customize the message that appears in the conversation history when structured
   * output is generated.
   */
  toolMessageContent?: string;
  /**
   * Handle errors from the structured output tool call. Using tools to generate structured output
   * can cause errors, e.g. if:
   * - you provide multiple structured output schemas and the model calls multiple structured output tools
   * - if the structured output generated by the tool call doesn't match provided schema
   *
   * This property allows to handle these errors in different ways:
   * - `true` - retry the tool call
   * - `false` - throw an error
   * - `string` - retry the tool call with the provided message
   * - `(error: ToolStrategyError) => Promise<string> | string` - retry with the provided message or throw the error
   *
   * @default true
   */
  handleError?:
    | boolean
    | string
    | ((error: ToolStrategyError) => Promise<string> | string);
}

export function toolStrategy<T extends InteropZodType<any>>(
  responseFormat: T,
  options?: ToolStrategyOptions
): TypedToolStrategy<T extends InteropZodType<infer U> ? U : never>;
export function toolStrategy<T extends readonly InteropZodType<any>[]>(
  responseFormat: T,
  options?: ToolStrategyOptions
): TypedToolStrategy<
  { [K in keyof T]: T[K] extends InteropZodType<infer U> ? U : never }[number]
>;
export function toolStrategy(
  responseFormat: JsonSchemaFormat,
  options?: ToolStrategyOptions
): TypedToolStrategy<Record<string, unknown>>;
export function toolStrategy(
  responseFormat: JsonSchemaFormat[],
  options?: ToolStrategyOptions
): TypedToolStrategy<Record<string, unknown>>;

/**
 * Creates a tool strategy for structured output using function calling.
 *
 * This function configures structured output by converting schemas into function tools that
 * the model calls. Unlike `providerStrategy`, which uses native JSON schema support,
 * `toolStrategy` works with any model that supports function calling, making it more
 * widely compatible across providers and model versions.
 *
 * The model will call a function with arguments matching your schema, and the agent will
 * extract and validate the structured output from the tool call. This approach is automatically
 * used when your model doesn't support native JSON schema output.
 *
 * @param responseFormat - The schema(s) to enforce. Can be a single Zod schema, an array of Zod schemas,
 *   a JSON schema object, or an array of JSON schema objects.
 * @param options - Optional configuration for the tool strategy
 * @param options.handleError - How to handle errors when the model calls multiple structured output tools
 *   or when the output doesn't match the schema. Defaults to `true` (auto-retry). Can be `false` (throw),
 *   a `string` (retry with message), or a `function` (custom handler).
 * @param options.toolMessageContent - Custom message content to include in conversation history
 *   when structured output is generated via tool call
 * @returns A `TypedToolStrategy` instance that can be used as the `responseFormat` in `createAgent`
 *
 * @example
 * ```ts
 * import { toolStrategy, createAgent } from "langchain";
 * import { z } from "zod";
 *
 * const agent = createAgent({
 *   model: "claude-haiku-4-5",
 *   responseFormat: toolStrategy(
 *     z.object({
 *       answer: z.string(),
 *       confidence: z.number().min(0).max(1),
 *     })
 *   ),
 * });
 * ```
 *
 * @example
 * ```ts
 * // Multiple schemas - model can choose which one to use
 * const agent = createAgent({
 *   model: "claude-haiku-4-5",
 *   responseFormat: toolStrategy([
 *     z.object({ name: z.string(), age: z.number() }),
 *     z.object({ email: z.string(), phone: z.string() }),
 *   ]),
 * });
 * ```
 */
export function toolStrategy(
  responseFormat:
    | InteropZodType<any>
    | InteropZodType<any>[]
    | JsonSchemaFormat
    | JsonSchemaFormat[],
  options?: ToolStrategyOptions
): TypedToolStrategy {
  return transformResponseFormat(responseFormat, options) as TypedToolStrategy;
}

/**
 * Creates a provider strategy for structured output using native JSON schema support.
 *
 * This function is used to configure structured output for agents when the underlying model
 * supports native JSON schema output (e.g., OpenAI's `gpt-4o`, `gpt-4o-mini`, and newer models).
 * Unlike `toolStrategy`, which uses function calling to extract structured output, `providerStrategy`
 * leverages the provider's native structured output capabilities, resulting in more efficient
 * and reliable schema enforcement.
 *
 * When used with a model that supports JSON schema output, the model will return responses
 * that directly conform to the provided schema without requiring tool calls. This is the
 * recommended approach for structured output when your model supports it.
 *
 * @param responseFormat - The schema to enforce, either a Zod schema, a JSON schema object, or an options object with `schema` and optional `strict` flag
 * @returns A `ProviderStrategy` instance that can be used as the `responseFormat` in `createAgent`
 *
 * @example
 * ```ts
 * import { providerStrategy, createAgent } from "langchain";
 * import { z } from "zod";
 *
 * const agent = createAgent({
 *   model: "claude-haiku-4-5",
 *   responseFormat: providerStrategy(
 *     z.object({
 *       answer: z.string().describe("The answer to the question"),
 *       confidence: z.number().min(0).max(1),
 *     })
 *   ),
 * });
 * ```
 *
 * @example
 * ```ts
 * // Using strict mode for stricter schema enforcement
 * const agent = createAgent({
 *   model: "claude-haiku-4-5",
 *   responseFormat: providerStrategy({
 *     schema: z.object({
 *       name: z.string(),
 *       age: z.number(),
 *     }),
 *     strict: true
 *   }),
 * });
 * ```
 */
export function providerStrategy<T extends InteropZodType<unknown>>(
  responseFormat: T | { schema: T; strict?: boolean }
): ProviderStrategy<T extends InteropZodType<infer U> ? U : never>;
export function providerStrategy(
  responseFormat:
    | JsonSchemaFormat
    | { schema: JsonSchemaFormat; strict?: boolean }
): ProviderStrategy<Record<string, unknown>>;
export function providerStrategy(
  responseFormat:
    | InteropZodType<unknown>
    | JsonSchemaFormat
    | { schema: InteropZodType<unknown> | JsonSchemaFormat; strict?: boolean }
): ProviderStrategy<unknown> {
  /**
   * Handle options object format
   */
  if (
    typeof responseFormat === "object" &&
    responseFormat !== null &&
    "schema" in responseFormat &&
    !isInteropZodSchema(responseFormat) &&
    !("type" in responseFormat)
  ) {
    const { schema, strict: strictFlag } = responseFormat as {
      schema: InteropZodType<unknown> | JsonSchemaFormat;
      strict?: boolean;
    };
    return ProviderStrategy.fromSchema(
      schema as InteropZodType<unknown>,
      strictFlag ?? false
    ) as ProviderStrategy<unknown>;
  }

  /**
   * Handle direct schema format
   */
  return ProviderStrategy.fromSchema(
    responseFormat as InteropZodType<unknown>,
    false
  ) as ProviderStrategy<unknown>;
}

/**
 * Type representing a JSON Schema object format.
 * This is a strict type that excludes ToolStrategy and ProviderStrategy instances.
 */
export type JsonSchemaFormat = {
  type:
    | "null"
    | "boolean"
    | "object"
    | "array"
    | "number"
    | "string"
    | "integer";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
} & {
  // Brand to ensure this is not a ToolStrategy or ProviderStrategy
  __brand?: never;
};

const CHAT_MODELS_THAT_SUPPORT_JSON_SCHEMA_OUTPUT = ["ChatOpenAI", "ChatXAI"];
const MODEL_NAMES_THAT_SUPPORT_JSON_SCHEMA_OUTPUT = [
  "grok",
  "gpt-5",
  "gpt-4.1",
  "gpt-4o",
  "gpt-oss",
  "o3-pro",
  "o3-mini",
];

/**
 * Identifies the models that support JSON schema output
 * @param model - The model to check
 * @returns True if the model supports JSON schema output, false otherwise
 */
export function hasSupportForJsonSchemaOutput(
  model?: LanguageModelLike | string
): boolean {
  if (!model) {
    return false;
  }

  if (typeof model === "string") {
    const modelName = model.split(":").pop() as string;
    return MODEL_NAMES_THAT_SUPPORT_JSON_SCHEMA_OUTPUT.some(
      (modelNameSnippet) => modelName.includes(modelNameSnippet)
    );
  }

  if (isConfigurableModel(model)) {
    const configurableModel = model as unknown as {
      _defaultConfig: { model: string };
    };
    return hasSupportForJsonSchemaOutput(
      configurableModel._defaultConfig.model
    );
  }

  if (!isBaseChatModel(model)) {
    return false;
  }

  const chatModelClass = model.getName();

  /**
   * for testing purposes only
   */
  if (chatModelClass === "FakeToolCallingChatModel") {
    return true;
  }

  if (
    CHAT_MODELS_THAT_SUPPORT_JSON_SCHEMA_OUTPUT.includes(chatModelClass) &&
    /**
     * OpenAI models
     */ (("model" in model &&
      MODEL_NAMES_THAT_SUPPORT_JSON_SCHEMA_OUTPUT.some(
        (modelNameSnippet) =>
          typeof model.model === "string" &&
          model.model.includes(modelNameSnippet)
      )) ||
      /**
       * for testing purposes only
       */
      (chatModelClass === "FakeToolCallingModel" &&
        "structuredResponse" in model))
  ) {
    return true;
  }

  return false;
}
