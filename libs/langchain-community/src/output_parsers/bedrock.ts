import { z } from "zod";
import {
  BaseLLMOutputParser,
  OutputParserException,
} from "@langchain/core/output_parsers";
import { JsonOutputKeyToolsParserParams } from "@langchain/core/output_parsers/openai_tools";
import { ChatGeneration } from "@langchain/core/outputs";
import { AIMessage } from "@langchain/core/messages";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface BedrockChatToolsOutputParserParams<T extends Record<string, any>>
  extends JsonOutputKeyToolsParserParams<T> {}

export class BedrockChatToolsOutputParser<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> extends BaseLLMOutputParser<T> {
  static lc_name() {
    return "BedrockChatToolsOutputParser";
  }

  lc_namespace = ["langchain", "bedrock", "output_parsers"];

  returnId = false;

  /** The type of tool calls to return. */
  keyName: string;

  /** Whether to return only the first tool call. */
  returnSingle = false;

  zodSchema?: z.ZodType<T>;

  constructor(params: BedrockChatToolsOutputParserParams<T>) {
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

  async parseResult(generations: ChatGeneration[]): Promise<T> {
    const tools = generations.flatMap((generation) => {
      const { message }: { message: AIMessage } = generation;
      if (!message.tool_calls || message.tool_calls.length === 0) {
        return [];
      }
      const tool = message.tool_calls.find(
        (tool) => tool.name === this.keyName
      );
      return tool;
    });
    if (tools[0] === undefined) {
      throw new Error(
        "No parsable tool calls provided to BedrockChatToolsOutputParser."
      );
    }
    const [tool] = tools;
    const validatedResult = await this._validateResult(tool.args);
    return validatedResult;
  }
}
