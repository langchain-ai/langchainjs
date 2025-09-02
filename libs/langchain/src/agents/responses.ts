/* eslint-disable no-instanceof/no-instanceof */
import {
  InteropZodObject,
  isInteropZodSchema,
  InteropZodType,
  isInteropZodObject,
} from "@langchain/core/utils/types";
import { type AIMessage } from "@langchain/core/messages";
import { toJsonSchema, Validator } from "@langchain/core/utils/json_schema";
import { type FunctionDefinition } from "@langchain/core/language_models/base";

import {
  StructuredOutputParsingError,
  MultipleStructuredOutputsError,
} from "./errors.js";

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
    options?: {
      name?: string;
      description?: string;
      strict?: boolean;
    },
    outputOptions?: ToolStrategyOptions
  ): ToolStrategy<S extends InteropZodType<infer U> ? U : unknown>;

  static fromSchema(
    schema: Record<string, unknown>,
    options?: {
      name?: string;
      description?: string;
      strict?: boolean;
    },
    outputOptions?: ToolStrategyOptions
  ): ToolStrategy<Record<string, unknown>>;

  static fromSchema(
    schema: InteropZodObject | Record<string, unknown>,
    options?: {
      name?: string;
      description?: string;
      strict?: boolean;
    },
    outputOptions?: ToolStrategyOptions
  ): ToolStrategy<any> {
    /**
     * It is required for tools to have a name so we can map the tool call to the correct tool
     * when parsing the response.
     */
    function getFunctionName(name?: string) {
      return name ?? options?.name ?? `extract-${++bindingIdentifier}`;
    }

    if (isInteropZodSchema(schema)) {
      const asJsonSchema = toJsonSchema(schema);
      const tool = {
        type: "function" as const,
        function: {
          name: getFunctionName(),
          strict: options?.strict,
          description:
            options?.description ??
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

  private constructor(public readonly schema: Record<string, unknown>) {}

  static fromSchema<T>(schema: InteropZodType<T>): ProviderStrategy<T>;

  static fromSchema(
    schema: Record<string, unknown>
  ): ProviderStrategy<Record<string, unknown>>;

  static fromSchema<T = unknown>(
    schema: InteropZodType<T> | Record<string, unknown>
  ): ProviderStrategy<T> | ProviderStrategy<Record<string, unknown>> {
    const asJsonSchema = toJsonSchema(schema);
    return new ProviderStrategy(asJsonSchema) as
      | ProviderStrategy<T>
      | ProviderStrategy<Record<string, unknown>>;
  }

  /**
   * Parse tool arguments according to the schema. If the response is not valid, return undefined.
   *
   * @param toolArgs - The arguments from the tool call
   * @returns The parsed response according to the schema type
   */
  parse(response: AIMessage) {
    /**
     * return if the response doesn't contain valid content
     */
    if (typeof response.content !== "string" || response.content === "") {
      return;
    }

    try {
      const content = JSON.parse(response.content);
      const validator = new Validator(this.schema);
      const result = validator.validate(content);
      if (!result.valid) {
        return;
      }

      return content;
    } catch (error) {
      // no-op
    }
  }
}

export type ResponseFormat = ToolStrategy<any> | ProviderStrategy<any>;

/**
 * Handle user input for `responseFormat` parameter of `CreateReactAgentParams`.
 * This function defines the default behavior for the `responseFormat` parameter, which is:
 *
 * - if value is a Zod schema, default to structured output via tool calling
 * - if value is a JSON schema, default to structured output via tool calling
 * - if value is a custom response format, return it as is
 * - if value is an array, ensure all array elements are instance of `ToolStrategy`
 * @param responseFormat
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
  options?: ToolStrategyOptions
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
        ToolStrategy.fromSchema(item as InteropZodObject, undefined, options)
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
        ToolStrategy.fromSchema(item as JsonSchemaFormat, undefined, options)
      );
    }

    throw new Error(
      `Invalid response format: list contains mixed types.\n` +
        `All items must be either InteropZodObject or plain JSON schema objects.`
    );
  }

  if (isInteropZodObject(responseFormat)) {
    return [ToolStrategy.fromSchema(responseFormat, undefined, options)];
  }

  if (
    responseFormat instanceof ToolStrategy ||
    responseFormat instanceof ProviderStrategy
  ) {
    return [responseFormat];
  }

  /**
   * Handle plain object (JSON schema)
   */
  if (
    typeof responseFormat === "object" &&
    responseFormat !== null &&
    "properties" in responseFormat
  ) {
    return [
      ToolStrategy.fromSchema(
        responseFormat as JsonSchemaFormat,
        undefined,
        options
      ),
    ];
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
 * Define how to transform the response format from a tool call.
 *
 * @param responseFormat - The response format to transform
 * @param options - The options to use for the transformation
 * @param options.handleError - Whether to handle errors from the tool call
 * @returns The transformed response format
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

export function providerStrategy<T extends InteropZodType<any>>(
  responseFormat: T
): ProviderStrategy<T extends InteropZodType<infer U> ? U : never>;
export function providerStrategy(
  responseFormat: JsonSchemaFormat
): ProviderStrategy<Record<string, unknown>>;
export function providerStrategy(
  responseFormat: InteropZodType<any> | JsonSchemaFormat
): ProviderStrategy<any> {
  return ProviderStrategy.fromSchema(
    responseFormat as any
  ) as ProviderStrategy<any>;
}

/**
 * Special type to indicate that no response format is provided.
 * When this type is used, the structuredResponse property should not be present in the result.
 */
export type ResponseFormatUndefined = {
  __responseFormatUndefined: true;
};

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
