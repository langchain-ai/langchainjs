/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-instanceof/no-instanceof */
import { BaseMessage, ToolMessage, AIMessage } from "@langchain/core/messages";
import { RunnableConfig, RunnableToolLike } from "@langchain/core/runnables";
import {
  DynamicTool,
  StructuredToolInterface,
  ToolInputParsingException,
} from "@langchain/core/tools";
import type { ToolCall } from "@langchain/core/messages/tool";
import type { InteropZodObject } from "@langchain/core/utils/types";
import {
  isCommand,
  Command,
  Send,
  isGraphInterrupt,
  type LangGraphRunnableConfig,
} from "@langchain/langgraph";

import { RunnableCallable } from "../RunnableCallable.js";
import { PreHookAnnotation } from "../annotation.js";
import { mergeAbortSignals } from "./utils.js";
import { ToolInvocationError } from "../errors.js";
import type { PrivateState } from "../runtime.js";
import type {
  ToAnnotationRoot,
  AnyAnnotationRoot,
  ToolCallWrapper,
  ToolCallRequest,
} from "../middleware/types.js";

export interface ToolNodeOptions {
  /**
   * The name of the tool node.
   */
  name?: string;
  /**
   * The tags to add to the tool call.
   */
  tags?: string[];
  /**
   * The abort signal to cancel the tool call.
   */
  signal?: AbortSignal;
  /**
   * Whether to throw the error immediately if the tool fails or handle it by the `onToolError` function or via ToolMessage.
   *
   * **Default behavior** (matches Python):
   *   - Catches only `ToolInvocationError` (invalid arguments from model) and converts to ToolMessage
   *   - Re-raises all other errors including errors from `wrapToolCall` middleware
   *
   * If `true`:
   *   - Catches all errors and returns a ToolMessage with the error
   *
   * If `false`:
   *   - All errors are thrown immediately
   *
   * If a function is provided:
   *   - If function returns a `ToolMessage`, use it as the result
   *   - If function returns `undefined`, re-raise the error
   *
   * @default A function that only catches ToolInvocationError
   */
  handleToolErrors?:
    | boolean
    | ((error: unknown, toolCall: ToolCall) => ToolMessage | undefined);
  /**
   * Optional wrapper function for tool execution.
   * Allows middleware to intercept and modify tool calls before execution.
   * The wrapper receives the tool call request and a handler function to execute the tool.
   */
  wrapToolCall?: ToolCallWrapper;
  /**
   * Optional function to get the private state (threadLevelCallCount, runModelCallCount).
   * Used to provide runtime metadata to wrapToolCall middleware.
   */
  getPrivateState?: () => PrivateState;
}

const isBaseMessageArray = (input: unknown): input is BaseMessage[] =>
  Array.isArray(input) && input.every(BaseMessage.isInstance);

const isMessagesState = (
  input: unknown
): input is { messages: BaseMessage[] } =>
  typeof input === "object" &&
  input != null &&
  "messages" in input &&
  isBaseMessageArray(input.messages);

const isSendInput = (input: unknown): input is { lg_tool_call: ToolCall } =>
  typeof input === "object" && input != null && "lg_tool_call" in input;

/**
 * Default error handler for tool errors.
 *
 * This is applied to errors from baseHandler (tool execution).
 * For errors from wrapToolCall middleware, those are handled separately
 * and will bubble up by default.
 *
 * Catches all tool execution errors and converts them to ToolMessage.
 * This allows the LLM to see the error and potentially retry with different arguments.
 */
function defaultHandleToolErrors(
  error: unknown,
  toolCall: ToolCall
): ToolMessage | undefined {
  if (error instanceof ToolInvocationError) {
    return new ToolMessage({
      content: error.message,
      tool_call_id: toolCall.id!,
      name: toolCall.name,
    });
  }
  /**
   * Catch all other tool errors and convert to ToolMessage
   */
  return new ToolMessage({
    content: `${error}\n Please fix your mistakes.`,
    tool_call_id: toolCall.id!,
    name: toolCall.name,
  });
}

/**
 * `ToolNode` is a built-in LangGraph component that handles tool calls within an agent's workflow.
 * It works seamlessly with `createAgent`, offering advanced tool execution control, built
 * in parallelism, and error handling.
 *
 * @example
 * ```ts
 * import { ToolNode, tool, AIMessage } from "langchain";
 * import { z } from "zod/v3";
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
 */
export class ToolNode<
  StateSchema extends AnyAnnotationRoot | InteropZodObject = any,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = any
> extends RunnableCallable<StateSchema, ContextSchema> {
  tools: (StructuredToolInterface | DynamicTool | RunnableToolLike)[];

  trace = false;

  signal?: AbortSignal;

  handleToolErrors:
    | boolean
    | ((error: unknown, toolCall: ToolCall) => ToolMessage | undefined) =
    defaultHandleToolErrors;

  wrapToolCall?: ToolCallWrapper;

  getPrivateState?: () => PrivateState;

  constructor(
    tools: (StructuredToolInterface | DynamicTool | RunnableToolLike)[],
    public options?: ToolNodeOptions
  ) {
    const { name, tags, handleToolErrors, wrapToolCall, getPrivateState } =
      options ?? {};
    super({
      name,
      tags,
      func: (state, config) =>
        this.run(
          state as ToAnnotationRoot<StateSchema>["State"] &
            PreHookAnnotation["State"],
          config as RunnableConfig
        ),
    });
    this.tools = tools;
    this.handleToolErrors = handleToolErrors ?? this.handleToolErrors;
    this.wrapToolCall = wrapToolCall;
    this.getPrivateState = getPrivateState;
    this.signal = options?.signal;
  }

  /**
   * Handle errors from tool execution or middleware.
   * @param error - The error to handle
   * @param call - The tool call that caused the error
   * @param isMiddlewareError - Whether the error came from wrapToolCall middleware
   * @returns ToolMessage if error is handled, otherwise re-throws
   */
  #handleError(
    error: unknown,
    call: ToolCall,
    isMiddlewareError: boolean
  ): ToolMessage {
    /**
     * {@link NodeInterrupt} errors are a breakpoint to bring a human into the loop.
     * As such, they are not recoverable by the agent and shouldn't be fed
     * back. Instead, re-throw these errors even when `handleToolErrors = true`.
     */
    if (isGraphInterrupt(error)) {
      throw error;
    }

    /**
     * If the signal is aborted, we want to bubble up the error to the invoke caller.
     */
    if (this.signal?.aborted) {
      throw error;
    }

    /**
     * If error is from middleware and handleToolErrors is not true, bubble up
     * (default handler and false both re-raise middleware errors)
     */
    if (isMiddlewareError && this.handleToolErrors !== true) {
      throw error;
    }

    /**
     * If handleToolErrors is false, throw all errors
     */
    if (!this.handleToolErrors) {
      throw error;
    }

    /**
     * Apply handleToolErrors to the error
     */
    if (typeof this.handleToolErrors === "function") {
      const result = this.handleToolErrors(error, call);
      if (result && ToolMessage.isInstance(result)) {
        return result;
      }

      /**
       * `handleToolErrors` returned undefined - re-raise
       */
      throw error;
    } else if (this.handleToolErrors) {
      return new ToolMessage({
        name: call.name,
        content: `${error}\n Please fix your mistakes.`,
        tool_call_id: call.id!,
      });
    }

    /**
     * Shouldn't reach here, but throw as fallback
     */
    throw error;
  }

  protected async runTool(
    call: ToolCall,
    config: RunnableConfig,
    state?: ToAnnotationRoot<StateSchema>["State"] & PreHookAnnotation["State"]
  ): Promise<ToolMessage | Command> {
    /**
     * Define the base handler that executes the tool.
     * When wrapToolCall middleware is present, this handler does NOT catch errors
     * so the middleware can handle them.
     * When no middleware, errors are caught and handled here.
     */
    const baseHandler = async (
      request: ToolCallRequest
    ): Promise<ToolMessage | Command> => {
      const { toolCall } = request;
      const tool = this.tools.find((tool) => tool.name === toolCall.name);
      if (tool === undefined) {
        throw new Error(`Tool "${toolCall.name}" not found.`);
      }

      try {
        const output = await tool.invoke(
          { ...toolCall, type: "tool_call" },
          {
            ...config,
            signal: mergeAbortSignals(this.signal, config.signal),
          }
        );

        if (ToolMessage.isInstance(output) || isCommand(output)) {
          return output as ToolMessage | Command;
        }

        return new ToolMessage({
          name: tool.name,
          content: typeof output === "string" ? output : JSON.stringify(output),
          tool_call_id: toolCall.id!,
        });
      } catch (e: unknown) {
        /**
         * Handle errors from tool execution (not from wrapToolCall)
         * If tool invocation fails due to input parsing error, throw a {@link ToolInvocationError}
         */
        if (e instanceof ToolInputParsingException) {
          throw new ToolInvocationError(e, toolCall);
        }
        /**
         * Re-throw to be handled by caller
         */
        throw e;
      }
    };

    /**
     * Build runtime from LangGraph config
     */
    const lgConfig = config as LangGraphRunnableConfig;

    /**
     * Get private state if available
     */
    const privateState = this.getPrivateState?.() || {
      threadLevelCallCount: 0,
      runModelCallCount: 0,
    };

    const runtime = {
      context: lgConfig?.context,
      writer: lgConfig?.writer,
      interrupt: lgConfig?.interrupt,
      signal: lgConfig?.signal,
      threadLevelCallCount: privateState.threadLevelCallCount,
      runModelCallCount: privateState.runModelCallCount,
    };

    /**
     * Find the tool instance to include in the request
     */
    const tool = this.tools.find((t) => t.name === call.name);
    if (!tool) {
      throw new Error(`Tool "${call.name}" not found.`);
    }

    const request = {
      toolCall: call,
      tool,
      state: state || ({} as any),
      runtime,
    };

    /**
     * If wrapToolCall is provided, use it to wrap the tool execution
     */
    if (this.wrapToolCall && state) {
      try {
        return await this.wrapToolCall(request, baseHandler);
      } catch (e: unknown) {
        /**
         * Handle middleware errors
         */
        return this.#handleError(e, call, true);
      }
    }

    /**
     * No wrapToolCall - execute tool directly and handle errors here
     */
    try {
      return await baseHandler(request);
    } catch (e: unknown) {
      /**
       * Handle tool errors when no middleware provided
       */
      return this.#handleError(e, call, false);
    }
  }

  protected async run(
    state: ToAnnotationRoot<StateSchema>["State"] & PreHookAnnotation["State"],
    config: RunnableConfig
  ): Promise<ContextSchema> {
    let outputs: (ToolMessage | Command)[];

    if (isSendInput(state)) {
      outputs = [await this.runTool(state.lg_tool_call, config, state)];
    } else {
      let messages: BaseMessage[];
      if (isBaseMessageArray(state)) {
        messages = state;
      } else if (isMessagesState(state)) {
        messages = state.messages;
      } else {
        throw new Error(
          "ToolNode only accepts BaseMessage[] or { messages: BaseMessage[] } as input."
        );
      }

      const toolMessageIds: Set<string> = new Set(
        messages
          .filter((msg) => msg.getType() === "tool")
          .map((msg) => (msg as ToolMessage).tool_call_id)
      );

      let aiMessage: AIMessage | undefined;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (AIMessage.isInstance(message)) {
          aiMessage = message;
          break;
        }
      }

      if (!AIMessage.isInstance(aiMessage)) {
        throw new Error("ToolNode only accepts AIMessages as input.");
      }

      outputs = await Promise.all(
        aiMessage.tool_calls
          ?.filter((call) => call.id == null || !toolMessageIds.has(call.id))
          .map((call) => this.runTool(call, config, state)) ?? []
      );
    }

    // Preserve existing behavior for non-command tool outputs for backwards compatibility
    if (!outputs.some(isCommand)) {
      return (Array.isArray(state)
        ? outputs
        : { messages: outputs }) as unknown as ContextSchema;
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
          Array.isArray(state) ? [output] : { messages: [output] }
        );
      }
    }

    if (parentCommand) {
      combinedOutputs.push(parentCommand);
    }

    return combinedOutputs as unknown as ContextSchema;
  }
}

export function isSend(x: unknown): x is Send {
  return x instanceof Send;
}
