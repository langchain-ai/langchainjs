import { BaseLLMOutputParser } from "@langchain/core/output_parsers";
import type { ChatGeneration } from "@langchain/core/outputs";

/**
 * @deprecated Import from "@langchain/core/output_parsers/openai_tools"
 */
export type ParsedToolCall = {
  id?: string;

  type: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;

  /** @deprecated Use `type` instead. Will be removed in 0.2.0. */
  name: string;

  /** @deprecated Use `args` instead. Will be removed in 0.2.0. */
  arguments: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/**
 * @deprecated Import from "@langchain/core/output_parsers/openai_tools"
 */
export type JsonOutputToolsParserParams = {
  /** Whether to return the tool call id. */
  returnId?: boolean;
};

/**
 * @deprecated Import from "@langchain/core/output_parsers/openai_tools"
 */
export class JsonOutputToolsParser extends BaseLLMOutputParser<
  ParsedToolCall[]
> {
  static lc_name() {
    return "JsonOutputToolsParser";
  }

  returnId = false;

  lc_namespace = ["langchain", "output_parsers", "openai_tools"];

  lc_serializable = true;

  constructor(fields?: JsonOutputToolsParserParams) {
    super(fields);
    this.returnId = fields?.returnId ?? this.returnId;
  }

  /**
   * Parses the output and returns a JSON object. If `argsOnly` is true,
   * only the arguments of the function call are returned.
   * @param generations The output of the LLM to parse.
   * @returns A JSON object representation of the function call or its arguments.
   */
  async parseResult(generations: ChatGeneration[]): Promise<ParsedToolCall[]> {
    const toolCalls = generations[0].message.additional_kwargs.tool_calls;
    if (!toolCalls) {
      throw new Error(
        `No tools_call in message ${JSON.stringify(generations)}`
      );
    }
    const clonedToolCalls = JSON.parse(JSON.stringify(toolCalls));
    const parsedToolCalls = [];
    for (const toolCall of clonedToolCalls) {
      if (toolCall.function !== undefined) {
        // @ts-expect-error name and arguemnts are defined by Object.defineProperty
        const parsedToolCall: ParsedToolCall = {
          type: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments),
        };

        if (this.returnId) {
          parsedToolCall.id = toolCall.id;
        }

        // backward-compatibility with previous
        // versions of Langchain JS, which uses `name` and `arguments`
        Object.defineProperty(parsedToolCall, "name", {
          get() {
            return this.type;
          },
        });

        Object.defineProperty(parsedToolCall, "arguments", {
          get() {
            return this.args;
          },
        });

        parsedToolCalls.push(parsedToolCall);
      }
    }
    return parsedToolCalls;
  }
}

export type JsonOutputKeyToolsParserParams = {
  keyName: string;
  returnSingle?: boolean;
  /** Whether to return the tool call id. */
  returnId?: boolean;
};

/**
 * @deprecated Import from "@langchain/core/output_parsers/openai_tools"
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class JsonOutputKeyToolsParser extends BaseLLMOutputParser<any> {
  static lc_name() {
    return "JsonOutputKeyToolsParser";
  }

  lc_namespace = ["langchain", "output_parsers", "openai_tools"];

  lc_serializable = true;

  returnId = false;

  /** The type of tool calls to return. */
  keyName: string;

  /** Whether to return only the first tool call. */
  returnSingle = false;

  initialParser: JsonOutputToolsParser;

  constructor(params: JsonOutputKeyToolsParserParams) {
    super(params);
    this.keyName = params.keyName;
    this.returnSingle = params.returnSingle ?? this.returnSingle;
    this.initialParser = new JsonOutputToolsParser(params);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async parseResult(generations: ChatGeneration[]): Promise<any> {
    const results = await this.initialParser.parseResult(generations);
    const matchingResults = results.filter(
      (result) => result.type === this.keyName
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let returnedValues: ParsedToolCall[] | Record<string, any>[] =
      matchingResults;
    if (!this.returnId) {
      returnedValues = matchingResults.map((result) => result.args);
    }
    if (this.returnSingle) {
      return returnedValues[0];
    }
    return returnedValues;
  }
}
