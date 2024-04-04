import { BaseLLMOutputParser } from "@langchain/core/output_parsers";
import { JsonOutputKeyToolsParserParams } from "@langchain/core/output_parsers/openai_tools";
import { ChatGeneration } from "@langchain/core/outputs";
import { AnthropicToolResponse } from "./types.js";

interface AnthropicToolsOutputParserParams
  extends JsonOutputKeyToolsParserParams {}

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

  constructor(params: AnthropicToolsOutputParserParams) {
    super(params);
    this.keyName = params.keyName;
    this.returnSingle = params.returnSingle ?? this.returnSingle;
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
    if (tools.length === 0 || !tools[0]) {
      throw new Error("No tools provided to AnthropicToolsOutputParser.");
    }
    const [tool] = tools;
    return tool.input as T;
  }
}
