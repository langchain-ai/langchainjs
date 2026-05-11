/**
 * Output parsers for IBM watsonx.ai
 * @module utils/parsers
 */

/* oxlint-disable @typescript-eslint/no-explicit-any */
import {
  JsonOutputKeyToolsParserParamsInterop,
  JsonOutputToolsParser,
} from "@langchain/core/output_parsers/openai_tools";
import { OutputParserException } from "@langchain/core/output_parsers";
import { ChatGeneration } from "@langchain/core/outputs";
import { AIMessageChunk } from "@langchain/core/messages";
import { ToolCall } from "@langchain/core/messages/tool";
import {
  InteropZodType,
  interopSafeParseAsync,
} from "@langchain/core/utils/types";

interface WatsonxToolsOutputParserParams<
  T extends Record<string, any>,
> extends JsonOutputKeyToolsParserParamsInterop<T> {}

/**
 * Output parser for Watsonx tool calls.
 * Extends JsonOutputToolsParser with Watsonx-specific handling.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 *
 * const parser = new WatsonxToolsOutputParser({
 *   keyName: "function",
 *   returnSingle: true,
 *   zodSchema: z.object({
 *     location: z.string(),
 *     unit: z.enum(["celsius", "fahrenheit"])
 *   })
 * });
 *
 * const result = await parser.parse(generations);
 * ```
 */
export class WatsonxToolsOutputParser<
  T extends Record<string, any> = Record<string, any>,
> extends JsonOutputToolsParser<T> {
  static lc_name() {
    return "WatsonxToolsOutputParser";
  }

  lc_namespace = ["langchain", "watsonx", "output_parsers"];

  returnId = false;

  keyName: string;

  returnSingle = false;

  zodSchema?: InteropZodType<T>;

  latestCorrect?: ToolCall;

  constructor(params: WatsonxToolsOutputParserParams<T>) {
    super(params);
    this.keyName = params.keyName;
    this.returnSingle = params.returnSingle ?? this.returnSingle;
    this.zodSchema = params.zodSchema;
  }

  protected async _validateResult(result: unknown): Promise<T> {
    let parsedResult = result;
    if (typeof result === "string") {
      try {
        parsedResult = JSON.parse(result);
      } catch (e: any) {
        throw new OutputParserException(
          `Failed to parse. Text: "${JSON.stringify(
            result,
            null,
            2,
          )}". Error: ${JSON.stringify(e.message)}`,
          result,
        );
      }
    } else {
      parsedResult = result;
    }

    if (this.zodSchema === undefined) {
      return parsedResult as T;
    }

    const zodParsedResult = await interopSafeParseAsync(
      this.zodSchema,
      parsedResult,
    );

    if (zodParsedResult.success) {
      return zodParsedResult.data;
    }

    throw new OutputParserException(
      `Failed to parse. Text: "${JSON.stringify(
        result,
        null,
        2,
      )}". Error: ${JSON.stringify(zodParsedResult.error.issues)}`,
      JSON.stringify(result, null, 2),
    );
  }

  async parsePartialResult(generations: ChatGeneration[]): Promise<T> {
    const tools = generations.flatMap((generation) => {
      const message = generation.message as AIMessageChunk;
      if (!Array.isArray(message.tool_calls)) {
        return [];
      }
      return message.tool_calls;
    });

    if (tools[0] === undefined) {
      if (this.latestCorrect) {
        tools.push(this.latestCorrect);
      } else {
        const toolCall: ToolCall = { name: "", args: {} };
        tools.push(toolCall);
      }
    }

    const [tool] = tools;
    tool.name = "";
    this.latestCorrect = tool;
    return tool.args as T;
  }
}
