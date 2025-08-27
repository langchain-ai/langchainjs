import type { ToolCall } from "@langchain/core/messages/tool";

export class MultipleToolsBoundError extends Error {
  constructor() {
    super(
      "The provided LLM already has bound tools. " +
        "Please provide an LLM without bound tools to createReactAgent. " +
        "The agent will bind the tools provided in the 'tools' parameter."
    );
  }
}

/**
 * Raised when model returns multiple structured output tool calls when only one is expected.
 */
export class MultipleStructuredOutputsError extends Error {
  public readonly toolNames: string[];

  constructor(toolNames: string[]) {
    super(
      `The model has called multiple tools: ${toolNames.join(
        ", "
      )} to return a structured output. ` +
        "This is not supported. Please provide a single structured output."
    );
    this.toolNames = toolNames;
  }
}

/**
 * Raised when structured output tool call arguments fail to parse according to the schema.
 */
export class StructuredOutputParsingError extends Error {
  public readonly toolName: string;

  public readonly errors: string[];

  constructor(toolName: string, errors: string[]) {
    super(
      `Failed to parse structured output for tool '${toolName}':${errors
        .map((e) => `\n  - ${e}`)
        .join("")}.`
    );
    this.toolName = toolName;
    this.errors = errors;
  }
}

/**
 * Raised when a tool call is throwing an error.
 */
export class ToolInvocationError extends Error {
  public readonly toolCall: ToolCall;

  public readonly toolError: Error;

  constructor(toolError: unknown, toolCall: ToolCall) {
    const error =
      toolError instanceof Error ? toolError : new Error(String(toolError));
    super(
      `Error invoking tool '${toolCall.name}' with kwargs ${JSON.stringify(
        toolCall.args
      )} ` +
        `with error:\n ${error.stack}\n Please fix the error and try again.`
    );

    this.toolCall = toolCall;
    this.toolError = error;
  }
}
