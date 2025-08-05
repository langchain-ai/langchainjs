import {
  BaseMessage,
  ToolMessage,
  AIMessage,
  isBaseMessage,
} from "@langchain/core/messages";
import { RunnableConfig, RunnableToolLike } from "@langchain/core/runnables";
import { DynamicTool, StructuredToolInterface } from "@langchain/core/tools";
import type { ToolCall } from "@langchain/core/messages/tool";
import { MessagesAnnotation } from "@langchain/langgraph";
import { isGraphInterrupt } from "@langchain/langgraph";
import { END, isCommand, Command, Send } from "@langchain/langgraph";

import { RunnableCallable } from "./RunnableCallable.js";
import { isSend } from "./utils.js";

export type ToolNodeOptions = {
  name?: string;
  tags?: string[];
  handleToolErrors?: boolean;
};

const isBaseMessageArray = (input: unknown): input is BaseMessage[] =>
  Array.isArray(input);

const isMessagesState = (
  input: unknown
): input is { messages: BaseMessage[] } =>
  typeof input === "object" &&
  input != null &&
  "messages" in input &&
  Array.isArray(input.messages);

const isSendInput = (input: unknown): input is { lg_tool_call: ToolCall } =>
  typeof input === "object" && input != null && "lg_tool_call" in input;

/**
 * A node that runs the tools requested in the last AIMessage. It can be used
 * either in StateGraph with a "messages" key or in MessageGraph. If multiple
 * tool calls are requested, they will be run in parallel. The output will be
 * a list of ToolMessages, one for each tool call.
 *
 * @example
 * ```ts
 * import { ToolNode } from "@langchain/langgraph/prebuilt";
 * import { tool } from "@langchain/core/tools";
 * import { z } from "zod";
 * import { AIMessage } from "@langchain/core/messages";
 *
 * const getWeather = tool((input) => {
 *   if (["sf", "san francisco"].includes(input.location.toLowerCase())) {
 *     return "It's 60 degrees and foggy.";
 *   } else {
 *     return "It's 90 degrees and sunny.";
 *   }
 * }, {
 *   name: "get_weather",
 *   description: "Call to get the current weather.",
 *   schema: z.object({
 *     location: z.string().describe("Location to get the weather for."),
 *   }),
 * });
 *
 * const tools = [getWeather];
 * const toolNode = new ToolNode(tools);
 *
 * const messageWithSingleToolCall = new AIMessage({
 *   content: "",
 *   tool_calls: [
 *     {
 *       name: "get_weather",
 *       args: { location: "sf" },
 *       id: "tool_call_id",
 *       type: "tool_call",
 *     }
 *   ]
 * })
 *
 * await toolNode.invoke({ messages: [messageWithSingleToolCall] });
 * // Returns tool invocation responses as:
 * // { messages: ToolMessage[] }
 * ```
 *
 * @example
 * ```ts
 * import {
 *   StateGraph,
 *   MessagesAnnotation,
 * } from "@langchain/langgraph";
 * import { ToolNode } from "@langchain/langgraph/prebuilt";
 * import { tool } from "@langchain/core/tools";
 * import { z } from "zod";
 * import { ChatAnthropic } from "@langchain/anthropic";
 *
 * const getWeather = tool((input) => {
 *   if (["sf", "san francisco"].includes(input.location.toLowerCase())) {
 *     return "It's 60 degrees and foggy.";
 *   } else {
 *     return "It's 90 degrees and sunny.";
 *   }
 * }, {
 *   name: "get_weather",
 *   description: "Call to get the current weather.",
 *   schema: z.object({
 *     location: z.string().describe("Location to get the weather for."),
 *   }),
 * });
 *
 * const tools = [getWeather];
 * const modelWithTools = new ChatAnthropic({
 *   model: "claude-3-haiku-20240307",
 *   temperature: 0
 * }).bindTools(tools);
 *
 * const toolNodeForGraph = new ToolNode(tools)
 *
 * const shouldContinue = (state: typeof MessagesAnnotation.State) => {
 *   const { messages } = state;
 *   const lastMessage = messages[messages.length - 1];
 *   if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls?.length) {
 *     return "tools";
 *   }
 *   return "__end__";
 * }
 *
 * const callModel = async (state: typeof MessagesAnnotation.State) => {
 *   const { messages } = state;
 *   const response = await modelWithTools.invoke(messages);
 *   return { messages: response };
 * }
 *
 * const graph = new StateGraph(MessagesAnnotation)
 *   .addNode("agent", callModel)
 *   .addNode("tools", toolNodeForGraph)
 *   .addEdge("__start__", "agent")
 *   .addConditionalEdges("agent", shouldContinue)
 *   .addEdge("tools", "agent")
 *   .compile();
 *
 * const inputs = {
 *   messages: [{ role: "user", content: "what is the weather in SF?" }],
 * };
 *
 * const stream = await graph.stream(inputs, {
 *   streamMode: "values",
 * });
 *
 * for await (const { messages } of stream) {
 *   console.log(messages);
 * }
 * // Returns the messages in the state at each step of execution
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ToolNode<T = any> extends RunnableCallable<T, T> {
  tools: (StructuredToolInterface | DynamicTool | RunnableToolLike)[];

  handleToolErrors = true;

  trace = false;

  constructor(
    tools: (StructuredToolInterface | DynamicTool | RunnableToolLike)[],
    options?: ToolNodeOptions
  ) {
    const { name, tags, handleToolErrors } = options ?? {};
    super({
      name,
      tags,
      func: (input, config) => this.run(input, config as RunnableConfig),
    });
    this.tools = tools;
    this.handleToolErrors = handleToolErrors ?? this.handleToolErrors;
  }

  protected async runTool(
    call: ToolCall,
    config: RunnableConfig
  ): Promise<ToolMessage | Command> {
    const tool = this.tools.find((tool) => tool.name === call.name);
    try {
      if (tool === undefined) {
        throw new Error(`Tool "${call.name}" not found.`);
      }
      const output = await tool.invoke({ ...call, type: "tool_call" }, config);

      if (
        (isBaseMessage(output) && output.getType() === "tool") ||
        isCommand(output)
      ) {
        return output as ToolMessage | Command;
      }

      return new ToolMessage({
        name: tool.name,
        content: typeof output === "string" ? output : JSON.stringify(output),
        tool_call_id: call.id!,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (!this.handleToolErrors) throw e;

      if (isGraphInterrupt(e)) {
        // `NodeInterrupt` errors are a breakpoint to bring a human into the loop.
        // As such, they are not recoverable by the agent and shouldn't be fed
        // back. Instead, re-throw these errors even when `handleToolErrors = true`.
        throw e;
      }

      return new ToolMessage({
        content: `Error: ${e.message}\n Please fix your mistakes.`,
        name: call.name,
        tool_call_id: call.id ?? "",
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async run(input: unknown, config: RunnableConfig): Promise<T> {
    let outputs: (ToolMessage | Command)[];

    if (isSendInput(input)) {
      outputs = [await this.runTool(input.lg_tool_call, config)];
    } else {
      let message: AIMessage | undefined;
      if (isBaseMessageArray(input)) {
        message = input.at(-1);
      } else if (isMessagesState(input)) {
        message = input.messages.at(-1);
      }

      if (message?.getType() !== "ai") {
        throw new Error("ToolNode only accepts AIMessages as input.");
      }

      outputs = await Promise.all(
        message.tool_calls?.map((call) => this.runTool(call, config)) ?? []
      );
    }

    // Preserve existing behavior for non-command tool outputs for backwards compatibility
    if (!outputs.some(isCommand)) {
      return (Array.isArray(input) ? outputs : { messages: outputs }) as T;
    }

    // Handle mixed Command and non-Command outputs
    const combinedOutputs: (
      | { messages: BaseMessage[] }
      | BaseMessage[]
      | Command
    )[] = [];
    let parentCommand: Command | null = null;

    for (const output of outputs) {
      if (isCommand(output)) {
        if (
          output.graph === Command.PARENT &&
          Array.isArray(output.goto) &&
          output.goto.every((send) => isSend(send))
        ) {
          if (parentCommand) {
            (parentCommand.goto as Send[]).push(...(output.goto as Send[]));
          } else {
            parentCommand = new Command({
              graph: Command.PARENT,
              goto: output.goto,
            });
          }
        } else {
          combinedOutputs.push(output);
        }
      } else {
        combinedOutputs.push(
          Array.isArray(input) ? [output] : { messages: [output] }
        );
      }
    }

    if (parentCommand) {
      combinedOutputs.push(parentCommand);
    }

    return combinedOutputs as T;
  }
}

export function toolsCondition(
  state: BaseMessage[] | typeof MessagesAnnotation.State
): "tools" | typeof END {
  const message = Array.isArray(state)
    ? state[state.length - 1]
    : state.messages[state.messages.length - 1];

  if (
    message !== undefined &&
    "tool_calls" in message &&
    ((message as AIMessage).tool_calls?.length ?? 0) > 0
  ) {
    return "tools";
  } else {
    return END;
  }
}
