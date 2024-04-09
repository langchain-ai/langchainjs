import { z } from "zod";
import {
  BaseLLMOutputParser,
  OutputParserException,
} from "@langchain/core/output_parsers";
import { JsonOutputKeyToolsParserParams } from "@langchain/core/output_parsers/openai_tools";
import { ChatGeneration } from "@langchain/core/outputs";
import { AnthropicToolResponse } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AnthropicToolsOutputParserParams<T extends Record<string, any>>
  extends JsonOutputKeyToolsParserParams<T> {}

export class AnthropicToolsOutputParser<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> extends BaseLLMOutputParser<T> {
  static lc_name() {
    return "AnthropicToolsOutputParser";
  }

  lc_namespace = ["langchain", "anthropic", "output_parsers"];

  returnId = false;

  /** The type of tool calls to return. */
  keyName: string;

  /** Whether to return only the first tool call. */
  returnSingle = false;

  zodSchema?: z.ZodType<T>;

  constructor(params: AnthropicToolsOutputParserParams<T>) {
    super(params);
    this.keyName = params.keyName;
    this.returnSingle = params.returnSingle ?? this.returnSingle;
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
  async parseResult(generations: ChatGeneration[]): Promise<T> {
    const tools = generations.flatMap((generation) => {
      const { message } = generation;
      if (typeof message === "string") {
        return [];
      }
      if (!Array.isArray(message.content)) {
        return [];
      }
      const tool = message.content.find((item) => item.type === "tool_use") as
        | AnthropicToolResponse
        | undefined;
      return tool;
    });
    if (tools[0] === undefined) {
      throw new Error(
        "No parseable tool calls provided to AnthropicToolsOutputParser."
      );
    }
    const [tool] = tools;
    const validatedResult = await this._validateResult(tool.input);
    return validatedResult;
  }
}
