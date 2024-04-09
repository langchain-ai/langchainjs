import { z } from "zod";
import { ChatGeneration } from "../../outputs.js";
import { BaseLLMOutputParser, OutputParserException } from "../base.js";
import { parsePartialJson } from "../json.js";

export type ParsedToolCall = {
  id?: string;

  type: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;

  /** @deprecated Use `type` instead. Will be removed in 0.2.0. */
  name: string;

  /** @deprecated Use `args` instead. Will be removed in 0.2.0. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arguments: Record<string, any>;
};

export type JsonOutputToolsParserParams = {
  /** Whether to return the tool call id. */
  returnId?: boolean;
};

export function parseToolCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawToolCall: Record<string, any>,
  options?: { returnId?: boolean }
) {
  if (rawToolCall.function === undefined) {
    return undefined;
  }
  let functionArgs;
  try {
    functionArgs = parsePartialJson(rawToolCall.function.arguments ?? "{}");
  } catch (e) {
    return undefined;
  }
  // @ts-expect-error name and arguemnts are defined by Object.defineProperty
  const parsedToolCall: ParsedToolCall = {
    type: rawToolCall.function.name,
    args: functionArgs,
  };

  if (options?.returnId) {
    parsedToolCall.id = rawToolCall.id;
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

  return parsedToolCall;
}

/**
 * Class for parsing the output of a tool-calling LLM into a JSON object.
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
      const parsedToolCall = parseToolCall(toolCall);
      if (parsedToolCall !== undefined) {
        parsedToolCalls.push(parsedToolCall);
      }
    }
    return parsedToolCalls;
  }
}

export type JsonOutputKeyToolsParserParams<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> = {
  keyName: string;
  returnSingle?: boolean;
  /** Whether to return the tool call id. */
  returnId?: boolean;
  zodSchema?: z.ZodType<T>;
};

/**
 * Class for parsing the output of a tool-calling LLM into a JSON object if you are
 * expecting only a single tool to be called.
 */
export class JsonOutputKeyToolsParser<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> extends BaseLLMOutputParser<T> {
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

  zodSchema?: z.ZodType<T>;

  constructor(params: JsonOutputKeyToolsParserParams<T>) {
    super(params);
    this.keyName = params.keyName;
    this.returnSingle = params.returnSingle ?? this.returnSingle;
    this.initialParser = new JsonOutputToolsParser(params);
    this.zodSchema = params.zodSchema;
  }

  protected async _validateResult(result: unknown): Promise<T> {
    if (this.zodSchema === undefined) {
      return result as T;
    }
    const zodParsedResult = await this.zodSchema.safeParseAsync(result);
    if (zodParsedResult.success) {
      return zodParsedResult.data;
    } else {
      throw new OutputParserException(
        `Failed to parse. Text: "${JSON.stringify(
          result,
          null,
          2
        )}". Error: ${JSON.stringify(zodParsedResult.error.errors)}`,
        JSON.stringify(result, null, 2)
      );
    }
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
      return this._validateResult(returnedValues[0]);
    }
    const toolCallResults = await Promise.all(
      returnedValues.map((value) => this._validateResult(value))
    );
    return toolCallResults;
  }
}
