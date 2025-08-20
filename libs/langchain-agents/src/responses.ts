import {
  InteropZodObject,
  isInteropZodSchema,
  InteropZodType,
  isInteropZodObject,
} from "@langchain/core/utils/types";
import { type AIMessage } from "@langchain/core/messages";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { type FunctionDefinition } from "@langchain/core/language_models/base";
import { Validator } from "@langchain/core/utils/json_schema";

import type { JsonSchemaFormat } from "./types.js";

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
export class ToolOutput<_T = unknown> {
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
    }
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
    }
  ): ToolOutput<S extends InteropZodType<infer U> ? U : unknown>;
  static fromSchema(
    schema: Record<string, unknown>,
    options?: {
      name?: string;
      description?: string;
      strict?: boolean;
    }
  ): ToolOutput<Record<string, unknown>>;
  static fromSchema(
    schema: InteropZodObject | Record<string, unknown>,
    options?: {
      name?: string;
      description?: string;
      strict?: boolean;
    }
  ): ToolOutput<any> {
    /**
     * It is required for tools to have a name so we can map the tool call to the correct tool
     * when parsing the response.
     */
    let functionName = options?.name ?? `extract-${++bindingIdentifier}`;
    if (isInteropZodSchema(schema)) {
      const asJsonSchema = toJsonSchema(schema);
      const tool = {
        type: "function" as const,
        function: {
          name: functionName,
          strict: options?.strict,
          description:
            options?.description ??
            asJsonSchema.description ??
            "Tool for extracting structured output from the model's response.",
          parameters: asJsonSchema,
        },
      };
      return new ToolOutput(asJsonSchema, tool);
    }

    let functionDefinition: FunctionDefinition;
    if (
      typeof schema.name === "string" &&
      typeof schema.parameters === "object" &&
      schema.parameters != null
    ) {
      functionDefinition = schema as unknown as FunctionDefinition;
      functionName = schema.name;
    } else {
      functionName = (schema.title as string) ?? functionName;
      functionDefinition = {
        name: functionName,
        description: (schema.description as string) ?? "",
        parameters: schema,
      };
    }
    const asJsonSchema = toJsonSchema(schema);
    const tool = {
      type: "function" as const,
      function: functionDefinition,
    };
    return new ToolOutput(asJsonSchema, tool);
  }

  /**
   * Parse tool arguments according to the schema.
   *
   * @throws Error if the response is not valid
   * @param toolArgs - The arguments from the tool call
   * @returns The parsed response according to the schema type
   */
  parse(toolArgs: Record<string, unknown>): Record<string, unknown> {
    const validator = new Validator(this.schema);
    const result = validator.validate(toolArgs);
    if (!result.valid) {
      throw new Error(
        `Response format for ${this.name} is invalid: ${JSON.stringify(
          result.errors
        )}`
      );
    }
    return toolArgs;
  }
}

export class NativeOutput<T = unknown> {
  // @ts-expect-error - _schemaType is used only for type inference
  private _schemaType?: T;

  private constructor(public readonly schema: Record<string, unknown>) {}

  static fromSchema<T>(schema: InteropZodType<T>): NativeOutput<T>;
  static fromSchema(
    schema: Record<string, unknown>
  ): NativeOutput<Record<string, unknown>>;
  static fromSchema<T = unknown>(
    schema: InteropZodType<T> | Record<string, unknown>
  ): NativeOutput<T> | NativeOutput<Record<string, unknown>> {
    const asJsonSchema = toJsonSchema(schema);
    return new NativeOutput(asJsonSchema) as
      | NativeOutput<T>
      | NativeOutput<Record<string, unknown>>;
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
      return;
    }
  }
}

export type ResponseFormat = ToolOutput<any> | NativeOutput<any>;

/**
 * Handle user input for `responseFormat` parameter of `CreateReactAgentParams`.
 * This function defines the default behavior for the `responseFormat` parameter, which is:
 *
 * - if value is a Zod schema, default to structured output via tool calling
 * - if value is a JSON schema, default to structured output via tool calling
 * - if value is a custom response format, return it as is
 * - if value is an array, ensure all array elements are instance of `ToolOutput`
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
    | ToolOutput<any>[]
): ResponseFormat[] {
  if (!responseFormat) {
    return [];
  }

  /**
   * If users provide an array, it should only contain raw schemas (Zod or JSON schema),
   * not ToolOutput or NativeOutput instances.
   */
  if (Array.isArray(responseFormat)) {
    // Check if any item is a ToolOutput or NativeOutput instance
    if (
      responseFormat.some(
        (item) => item instanceof ToolOutput || item instanceof NativeOutput
      )
    ) {
      throw new Error(
        `Invalid response format: arrays cannot contain ToolOutput or NativeOutput instances.\n` +
          `Arrays should only contain raw Zod schemas or JSON schema objects.\n` +
          `Use individual ToolOutput or NativeOutput instances, not arrays of them.`
      );
    }

    // Check if all items are Zod schemas
    if (responseFormat.every((item) => isInteropZodObject(item))) {
      return responseFormat.map((item) =>
        ToolOutput.fromSchema(item as InteropZodObject)
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
        ToolOutput.fromSchema(item as JsonSchemaFormat)
      );
    }

    throw new Error(
      `Invalid response format: list contains mixed types.\n` +
        `All items must be either InteropZodObject or plain JSON schema objects.`
    );
  }

  if (isInteropZodObject(responseFormat)) {
    return [ToolOutput.fromSchema(responseFormat)];
  }

  if (
    responseFormat instanceof ToolOutput ||
    responseFormat instanceof NativeOutput
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
    return [ToolOutput.fromSchema(responseFormat as JsonSchemaFormat)];
  }

  throw new Error(`Invalid response format: ${String(responseFormat)}`);
}

/**
 * Branded type for ToolOutput arrays that preserves type information
 */
export interface TypedToolOutput<T = unknown> extends Array<ToolOutput<any>> {
  _schemaType?: T;
}

export function toolOutput<T extends InteropZodType<any>>(
  responseFormat: T
): TypedToolOutput<T extends InteropZodType<infer U> ? U : never>;
export function toolOutput<T extends readonly InteropZodType<any>[]>(
  responseFormat: T
): TypedToolOutput<
  { [K in keyof T]: T[K] extends InteropZodType<infer U> ? U : never }[number]
>;
export function toolOutput(
  responseFormat: JsonSchemaFormat
): TypedToolOutput<Record<string, unknown>>;
export function toolOutput(
  responseFormat: JsonSchemaFormat[]
): TypedToolOutput<Record<string, unknown>>;
export function toolOutput(
  responseFormat:
    | InteropZodType<any>
    | InteropZodType<any>[]
    | JsonSchemaFormat
    | JsonSchemaFormat[]
): TypedToolOutput {
  return transformResponseFormat(responseFormat) as TypedToolOutput;
}

export function nativeOutput<T extends InteropZodType<any>>(
  responseFormat: T
): NativeOutput<T extends InteropZodType<infer U> ? U : never>;
export function nativeOutput(
  responseFormat: JsonSchemaFormat
): NativeOutput<Record<string, unknown>>;
export function nativeOutput(
  responseFormat: InteropZodType<any> | JsonSchemaFormat
): NativeOutput<any> {
  return NativeOutput.fromSchema(responseFormat as any) as NativeOutput<any>;
}
