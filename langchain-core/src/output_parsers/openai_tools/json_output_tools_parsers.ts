import type * as z3 from "zod/v3";
import type * as z4 from "zod/v4/core";
import { ChatGeneration, ChatGenerationChunk } from "../../outputs.js";
import { OutputParserException } from "../base.js";
import { parsePartialJson } from "../json.js";
import { InvalidToolCall, ToolCall } from "../../messages/tool.js";
import {
  BaseCumulativeTransformOutputParser,
  BaseCumulativeTransformOutputParserInput,
} from "../transform.js";
import { isAIMessage } from "../../messages/ai.js";
import {
  type InteropZodType,
  interopSafeParseAsync,
} from "../../utils/types/zod.js";

export type ParsedToolCall = {
  id?: string;

  type: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
};

export type JsonOutputToolsParserParams = {
  /** Whether to return the tool call id. */
  returnId?: boolean;
} & BaseCumulativeTransformOutputParserInput;

export function parseToolCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawToolCall: Record<string, any>,
  options: { returnId?: boolean; partial: true }
): ToolCall | undefined;
export function parseToolCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawToolCall: Record<string, any>,
  options?: { returnId?: boolean; partial?: false }
): ToolCall;
export function parseToolCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawToolCall: Record<string, any>,
  options?: { returnId?: boolean; partial?: boolean }
): ToolCall | undefined;
export function parseToolCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawToolCall: Record<string, any>,
  options?: { returnId?: boolean; partial?: boolean }
): ToolCall | undefined {
  if (rawToolCall.function === undefined) {
    return undefined;
  }
  let functionArgs;
  if (options?.partial) {
    try {
      functionArgs = parsePartialJson(rawToolCall.function.arguments ?? "{}");
    } catch (e) {
      return undefined;
    }
  } else {
    try {
      functionArgs = JSON.parse(rawToolCall.function.arguments);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      throw new OutputParserException(
        [
          `Function "${rawToolCall.function.name}" arguments:`,
          ``,
          rawToolCall.function.arguments,
          ``,
          `are not valid JSON.`,
          `Error: ${e.message}`,
        ].join("\n")
      );
    }
  }

  const parsedToolCall: ToolCall = {
    name: rawToolCall.function.name,
    args: functionArgs,
    type: "tool_call",
  };

  if (options?.returnId) {
    parsedToolCall.id = rawToolCall.id;
  }

  return parsedToolCall;
}

export function convertLangChainToolCallToOpenAI(toolCall: ToolCall) {
  if (toolCall.id === undefined) {
    throw new Error(`All OpenAI tool calls must have an "id" field.`);
  }
  return {
    id: toolCall.id,
    type: "function",
    function: {
      name: toolCall.name,
      arguments: JSON.stringify(toolCall.args),
    },
  };
}

export function makeInvalidToolCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawToolCall: Record<string, any>,
  errorMsg?: string
): InvalidToolCall {
  return {
    name: rawToolCall.function?.name,
    args: rawToolCall.function?.arguments,
    id: rawToolCall.id,
    error: errorMsg,
    type: "invalid_tool_call",
  };
}

/**
 * Class for parsing the output of a tool-calling LLM into a JSON object.
 */
export class JsonOutputToolsParser<
  T
> extends BaseCumulativeTransformOutputParser<T> {
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

  protected _diff() {
    throw new Error("Not supported.");
  }

  async parse(): Promise<T> {
    throw new Error("Not implemented.");
  }

  async parseResult(generations: ChatGeneration[]): Promise<T> {
    const result = await this.parsePartialResult(generations, false);
    return result;
  }

  /**
   * Parses the output and returns a JSON object. If `argsOnly` is true,
   * only the arguments of the function call are returned.
   * @param generations The output of the LLM to parse.
   * @returns A JSON object representation of the function call or its arguments.
   */
  async parsePartialResult(
    generations: ChatGenerationChunk[] | ChatGeneration[],
    partial = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const message = generations[0].message;
    let toolCalls;
    if (isAIMessage(message) && message.tool_calls?.length) {
      toolCalls = message.tool_calls.map((toolCall) => {
        const { id, ...rest } = toolCall;
        if (!this.returnId) {
          return rest;
        }
        return {
          id,
          ...rest,
        };
      });
    } else if (message.additional_kwargs.tool_calls !== undefined) {
      const rawToolCalls = JSON.parse(
        JSON.stringify(message.additional_kwargs.tool_calls)
      );
      toolCalls = rawToolCalls.map((rawToolCall: Record<string, unknown>) => {
        return parseToolCall(rawToolCall, { returnId: this.returnId, partial });
      });
    }
    if (!toolCalls) {
      return [];
    }
    const parsedToolCalls = [];
    for (const toolCall of toolCalls) {
      if (toolCall !== undefined) {
        const backwardsCompatibleToolCall: ParsedToolCall = {
          type: toolCall.name,
          args: toolCall.args,
          id: toolCall.id,
        };
        parsedToolCalls.push(backwardsCompatibleToolCall);
      }
    }
    return parsedToolCalls;
  }
}

type JsonOutputKeyToolsParserParamsBase = {
  keyName: string;
  returnSingle?: boolean;
} & JsonOutputToolsParserParams;

type JsonOutputKeyToolsParserParamsV3<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> = { zodSchema?: z3.ZodType<T> } & JsonOutputKeyToolsParserParamsBase;

type JsonOutputKeyToolsParserParamsV4<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> = { zodSchema?: z4.$ZodType<T, T> } & JsonOutputKeyToolsParserParamsBase;

export type JsonOutputKeyToolsParserParamsInterop<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> = { zodSchema?: InteropZodType<T> } & JsonOutputKeyToolsParserParamsBase;

// Use Zod 3 for backwards compatibility
export type JsonOutputKeyToolsParserParams<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> = JsonOutputKeyToolsParserParamsV3<T>;

/**
 * Class for parsing the output of a tool-calling LLM into a JSON object if you are
 * expecting only a single tool to be called.
 */
export class JsonOutputKeyToolsParser<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> extends JsonOutputToolsParser<T> {
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

  zodSchema?: InteropZodType<T>;

  constructor(params: JsonOutputKeyToolsParserParamsV3<T>);

  constructor(params: JsonOutputKeyToolsParserParamsV4<T>);

  constructor(params: JsonOutputKeyToolsParserParamsInterop<T>);

  constructor(
    params:
      | JsonOutputKeyToolsParserParamsV3<T>
      | JsonOutputKeyToolsParserParamsV4<T>
      | JsonOutputKeyToolsParserParamsInterop<T>
  ) {
    super(params);
    this.keyName = params.keyName;
    this.returnSingle = params.returnSingle ?? this.returnSingle;
    this.zodSchema = params.zodSchema;
  }

  protected async _validateResult(result: unknown): Promise<T> {
    if (this.zodSchema === undefined) {
      return result as T;
    }
    const zodParsedResult = await interopSafeParseAsync(this.zodSchema, result);
    if (zodParsedResult.success) {
      return zodParsedResult.data;
    } else {
      throw new OutputParserException(
        `Failed to parse. Text: "${JSON.stringify(
          result,
          null,
          2
        )}". Error: ${JSON.stringify(zodParsedResult.error?.issues)}`,
        JSON.stringify(result, null, 2)
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async parsePartialResult(generations: ChatGeneration[]): Promise<any> {
    const results = await super.parsePartialResult(generations);
    const matchingResults = results.filter(
      (result: ParsedToolCall) => result.type === this.keyName
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let returnedValues: ParsedToolCall[] | Record<string, any>[] =
      matchingResults;
    if (!matchingResults.length) {
      return undefined;
    }
    if (!this.returnId) {
      returnedValues = matchingResults.map(
        (result: ParsedToolCall) => result.args
      );
    }
    if (this.returnSingle) {
      return returnedValues[0];
    }
    return returnedValues;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async parseResult(generations: ChatGeneration[]): Promise<any> {
    const results = await super.parsePartialResult(generations, false);
    const matchingResults = results.filter(
      (result: ParsedToolCall) => result.type === this.keyName
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let returnedValues: ParsedToolCall[] | Record<string, any>[] =
      matchingResults;
    if (!matchingResults.length) {
      return undefined;
    }
    if (!this.returnId) {
      returnedValues = matchingResults.map(
        (result: ParsedToolCall) => result.args
      );
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
