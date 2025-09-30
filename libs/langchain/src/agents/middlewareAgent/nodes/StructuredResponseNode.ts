/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-instanceof/no-instanceof */
import { RunnableConfig } from "@langchain/core/runnables";
import { BaseMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { InteropZodObject } from "@langchain/core/utils/types";
import type { ToolCall } from "@langchain/core/messages/tool";
import { Command } from "@langchain/langgraph";

import { MultipleStructuredOutputsError } from "../../errors.js";
import { RunnableCallable } from "../../RunnableCallable.js";
import { ToolStrategyError } from "../../responses.js";
import type { InternalAgentState, CreateAgentParams } from "../types.js";
import type { ResponseFormat, ToolResponseFormat } from "./utils.js";
import {} from "../../../../../langchain-core/dist/utils/types/zod.js";

export interface StructuredResponseNodeOptions<
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >
> extends Pick<
    CreateAgentParams<StructuredResponseFormat, InteropZodObject>,
    "model" | "responseFormat"
  > {
  name?: string;
  /**
   * Pre-computed structured response format.
   * This ensures consistent tool names between AgentNode and StructuredResponseNode.
   */
  structuredResponseFormat?: ResponseFormat;
}

/**
 * Node for generating structured responses from message history.
 * This node is executed before END when the user provides a responseFormat.
 */
export class StructuredResponseNode<
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >
> extends RunnableCallable<
  InternalAgentState<StructuredResponseFormat>,
  | { structuredResponse: StructuredResponseFormat; messages?: BaseMessage[] }
  | { messages: BaseMessage[] }
> {
  #options: StructuredResponseNodeOptions<StructuredResponseFormat>;

  constructor(
    options: StructuredResponseNodeOptions<StructuredResponseFormat>
  ) {
    super({
      name: "structured_response",
      func: (input, config) =>
        this.#run(input, config as RunnableConfig) as any,
    });

    this.#options = options;
  }

  async #run(
    state: InternalAgentState<StructuredResponseFormat>,
    _config: RunnableConfig
  ) {
    // Get the last AI message from the message history
    const messages = state.messages;
    const lastAiMessage = messages
      .slice()
      .reverse()
      .find((msg) => AIMessage.isInstance(msg)) as AIMessage | undefined;

    if (!lastAiMessage) {
      // No AI message found, cannot generate structured response
      return { messages: [] };
    }

    // Use the pre-computed structured response format if available (tool-based strategy)
    const structuredResponseFormat = this.#options.structuredResponseFormat;
    if (structuredResponseFormat && structuredResponseFormat.type === "tool") {
      if (!lastAiMessage.tool_calls || lastAiMessage.tool_calls.length === 0) {
        // No tool calls, cannot extract structured response
        return { messages: [] };
      }

      const toolCalls = lastAiMessage.tool_calls.filter(
        (call) => call.name in structuredResponseFormat.tools
      );

      /**
       * if there were no structured tool calls, we can return without structured response
       */
      if (toolCalls.length === 0) {
        return { messages: [] };
      }

      /**
       * if there were multiple structured tool calls, we should throw an error as this
       * scenario is not defined/supported.
       */
      if (toolCalls.length > 1) {
        return this.#handleMultipleStructuredOutputs(
          lastAiMessage,
          toolCalls,
          structuredResponseFormat
        );
      }

      const toolStrategy = structuredResponseFormat.tools[toolCalls[0].name];
      const toolMessageContent = toolStrategy?.options?.toolMessageContent;
      return this.#handleSingleStructuredOutput(
        lastAiMessage,
        toolCalls[0],
        structuredResponseFormat,
        toolMessageContent
      );
    }

    // Handle native schema output (e.g., OpenAI with native JSON schema)
    if (
      this.#options.structuredResponseFormat &&
      this.#options.structuredResponseFormat.type === "native"
    ) {
      const structuredResponse =
        this.#options.structuredResponseFormat.strategy.parse(lastAiMessage);
      if (structuredResponse) {
        return { structuredResponse };
      }

      // If parsing failed, return empty (no structured response)
      return { messages: [] };
    }

    // This shouldn't happen, but just in case
    return { messages: [] };
  }

  /**
   * If the model returns multiple structured outputs, we need to handle it.
   */
  #handleMultipleStructuredOutputs(
    response: AIMessage,
    toolCalls: ToolCall[],
    responseFormat: ToolResponseFormat
  ): Promise<Command> {
    const multipleStructuredOutputsError = new MultipleStructuredOutputsError(
      toolCalls.map((call) => call.name)
    );

    return this.#handleToolStrategyError(
      multipleStructuredOutputsError,
      response,
      toolCalls[0],
      responseFormat
    );
  }

  /**
   * If the model returns a single structured output, we need to handle it.
   */
  #handleSingleStructuredOutput(
    response: AIMessage,
    toolCall: ToolCall,
    responseFormat: ToolResponseFormat,
    lastMessage?: string
  ):
    | { structuredResponse: StructuredResponseFormat }
    | { messages: BaseMessage[] }
    | Promise<Command> {
    const tool = responseFormat.tools[toolCall.name];

    try {
      const structuredResponse = tool.parse(
        toolCall.args
      ) as StructuredResponseFormat;

      return {
        structuredResponse,
        ...(lastMessage && {
          messages: [
            new AIMessage(
              lastMessage ??
                `Returning structured response: ${JSON.stringify(
                  structuredResponse
                )}`
            ),
          ],
        }),
      };
    } catch (error) {
      return this.#handleToolStrategyError(
        error as ToolStrategyError,
        response,
        toolCall,
        responseFormat
      );
    }
  }

  async #handleToolStrategyError(
    error: ToolStrategyError,
    response: AIMessage,
    toolCall: ToolCall,
    responseFormat: ToolResponseFormat
  ): Promise<Command> {
    /**
     * Using the `errorHandler` option of the first `ToolStrategy` entry is sufficient here.
     */
    const errorHandler = Object.values(responseFormat.tools).at(0)?.options
      ?.handleError;

    const toolCallId = toolCall.id;
    if (!toolCallId) {
      throw new Error(
        "Tool call ID is required to handle tool output errors. Please provide a tool call ID."
      );
    }

    /**
     * retry if:
     */
    if (
      /**
       * if the user has provided `true` as the `errorHandler` option, return a new AIMessage
       * with the error message and retry the tool call.
       */
      (typeof errorHandler === "boolean" && errorHandler) ||
      /**
       * if `errorHandler` is an array and contains MultipleStructuredOutputsError
       */
      (Array.isArray(errorHandler) &&
        errorHandler.some((h) => h instanceof MultipleStructuredOutputsError))
    ) {
      return new Command({
        update: {
          messages: [
            response,
            new ToolMessage({
              content: error.message,
              tool_call_id: toolCallId,
            }),
          ],
        },
        goto: "model_request",
      });
    }

    /**
     * if `errorHandler` is a string, retry the tool call with given string
     */
    if (typeof errorHandler === "string") {
      return new Command({
        update: {
          messages: [
            response,
            new ToolMessage({
              content: errorHandler,
              tool_call_id: toolCallId,
            }),
          ],
        },
        goto: "model_request",
      });
    }

    /**
     * if `errorHandler` is a function, retry the tool call with the function
     */
    if (typeof errorHandler === "function") {
      const content = await errorHandler(error);
      if (typeof content !== "string") {
        throw new Error("Error handler must return a string.");
      }

      return new Command({
        update: {
          messages: [
            response,
            new ToolMessage({
              content,
              tool_call_id: toolCallId,
            }),
          ],
        },
        goto: "model_request",
      });
    }

    /**
     * throw otherwise, e.g. if `errorHandler` is not defined or set to `false`
     */
    throw error;
  }
}
