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
export class ToolOutput {
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

  static fromSchema(
    schema: InteropZodObject | Record<string, unknown>,
    options?: {
      name?: string;
      description?: string;
      strict?: boolean;
    }
  ): ToolOutput {
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

export class NativeOutput {
  private constructor(public readonly schema: Record<string, unknown>) {}

  static fromSchema(schema: InteropZodObject | Record<string, unknown>) {
    const asJsonSchema = toJsonSchema(schema);
    return new NativeOutput(asJsonSchema);
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

export type ResponseFormat = ToolOutput | NativeOutput;

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
    | Record<string, unknown>
    | ResponseFormat
    | ToolOutput[]
): ResponseFormat[] {
  if (!responseFormat) {
    return [];
  }

  /**
   * If users provide an array, all elements in that list need to be from type `ToolOutput`
   * as we only support multiple structured outputs via tool calling.
   */
  if (Array.isArray(responseFormat)) {
    if (responseFormat.every((item) => item instanceof ToolOutput)) {
      return responseFormat as ToolOutput[];
    }
    if (responseFormat.every((item) => isInteropZodObject(item))) {
      return responseFormat.map((item) =>
        ToolOutput.fromSchema(item as InteropZodObject)
      );
    }

    throw new Error(
      `Invalid response format: list contains items that are either instances of ToolOutput or InteropZodObject.\n` +
        `Make sure all items are instances of ToolOutput or InteropZodObject.`
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

  if ("schema" in responseFormat) {
    const { schema, ...rest } = responseFormat;
    return [ToolOutput.fromSchema(schema as Record<string, unknown>, rest)];
  }

  throw new Error(`Invalid response format: ${responseFormat.toString()}`);
}

export function asToolOutput(
  responseFormat:
    | InteropZodType<any>
    | InteropZodType<any>[]
    | Record<string, unknown>
    | ToolOutput[]
): ToolOutput[] {
  return transformResponseFormat(responseFormat) as ToolOutput[];
}

export function asNativeOutput(
  responseFormat: InteropZodObject | Record<string, unknown>
): NativeOutput {
  return NativeOutput.fromSchema(responseFormat);
}
