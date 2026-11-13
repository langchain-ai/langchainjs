import {
  BaseLLMOutputParser,
  OutputParserException,
} from "@langchain/core/output_parsers";
import {
  JsonOutputKeyToolsParserParamsInterop,
  JsonOutputKeyToolsParserParamsSerializable,
} from "@langchain/core/output_parsers/openai_tools";
import { ChatGeneration } from "@langchain/core/outputs";
import { ModelRefusalError } from "@langchain/core/errors";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { ToolCall } from "@langchain/core/messages/tool";
import {
  interopSafeParseAsync,
  InteropZodType,
} from "@langchain/core/utils/types";
import { SerializableSchema } from "@langchain/core/utils/standard_schema";
import { findRefusal } from "./utils/refusal.js";

interface AnthropicToolsOutputParserParams<
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any>,
>
  extends
    JsonOutputKeyToolsParserParamsInterop<T>,
    JsonOutputKeyToolsParserParamsSerializable<T> {}

export class AnthropicToolsOutputParser<
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>,
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

  zodSchema?: InteropZodType<T>;

  serializableSchema?: SerializableSchema<T>;

  constructor(params: AnthropicToolsOutputParserParams<T>) {
    super(params);
    this.keyName = params.keyName;
    this.returnSingle = params.returnSingle ?? this.returnSingle;
    this.zodSchema = params.zodSchema;
    this.serializableSchema = params.serializableSchema;
  }

  protected async _validateResult(result: unknown): Promise<T> {
    let parsedResult = result;
    if (typeof result === "string") {
      try {
        parsedResult = JSON.parse(result);
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        throw new OutputParserException(
          `Failed to parse. Text: "${JSON.stringify(
            result,
            null,
            2
          )}". Error: ${JSON.stringify(e.message)}`,
          result
        );
      }
    } else {
      parsedResult = result;
    }

    if (this.serializableSchema !== undefined) {
      const validated =
        await this.serializableSchema["~standard"].validate(parsedResult);
      if (validated.issues) {
        throw new OutputParserException(
          `Failed to parse. Text: "${JSON.stringify(
            parsedResult,
            null,
            2
          )}". Error: ${JSON.stringify(validated.issues)}`,
          JSON.stringify(parsedResult, null, 2)
        );
      }
      return validated.value as T;
    }

    if (this.zodSchema === undefined) {
      return parsedResult as T;
    }
    const zodParsedResult = await interopSafeParseAsync(
      this.zodSchema,
      parsedResult
    );
    if (zodParsedResult.success) {
      return zodParsedResult.data;
    } else {
      throw new OutputParserException(
        `Failed to parse. Text: "${JSON.stringify(
          result,
          null,
          2
        )}". Error: ${JSON.stringify(zodParsedResult.error.issues)}`,
        JSON.stringify(parsedResult, null, 2)
      );
    }
  }

  /**
   * @throws {ModelRefusalError} If the model refused instead of answering.
   */
  async parseResult(generations: ChatGeneration[]): Promise<T> {
    const message = generations[0]?.message;
    const refusal = message ? findRefusal(message) : undefined;
    if (refusal) {
      throw ModelRefusalError.fromRefusal(refusal, message);
    }
    const tools = generations.flatMap((generation) => {
      const { message } = generation;
      // Prefer raw `tool_use` blocks so truncated JSON still fails strict
      // parsing; `tool_calls` is a fallback for streams rebuilt as `tool_call`.
      const contentTool = Array.isArray(message.content)
        ? extractToolCalls(message.content)[0]
        : undefined;
      if (contentTool) return contentTool;
      if (
        (AIMessage.isInstance(message) || AIMessageChunk.isInstance(message)) &&
        message.tool_calls?.length
      ) {
        return message.tool_calls[0];
      }
      return [];
    });
    if (tools[0] === undefined) {
      throw new Error(
        "No parseable tool calls provided to AnthropicToolsOutputParser."
      );
    }
    const [tool] = tools;
    const validatedResult = await this._validateResult(tool.args);
    return validatedResult;
  }
}

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export function extractToolCalls(content: Record<string, any>[]) {
  const toolCalls: ToolCall[] = [];

  for (const block of content) {
    if (block.type === "tool_use") {
      toolCalls.push({
        name: block.name,
        args: block.input,
        id: block.id,
        type: "tool_call",
      });
    }
  }

  return toolCalls;
}
