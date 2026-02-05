import { BaseContentBlock } from "./base.js";

export type Tools = never;

export const KNOWN_BLOCK_TYPES = [
  "tool_call",
  "tool_call_chunk",
  "invalid_tool_call",
  "server_tool_call",
  "server_tool_call_chunk",
  "server_tool_call_result",
];

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace Tools {
  /**
   * Represents a request to call a tool.
   *
   * @example
   * ```ts
   * const toolCall: ToolCall = {
   *     type: "tool_call",
   *     name: "foo",
   *     args: { a: 1 },
   *     callId: "123"
   * };
   * ```
   * This represents a request to call the tool named "foo" with arguments {"a": 1}
   * and an identifier of "123".
   */
  export interface ToolCall<TName extends string = string, TArgs = unknown>
    extends BaseContentBlock {
    /**
     * Type of the content block
     */
    readonly type: "tool_call";
    /**
     * The name of the tool being called
     */
    name: TName;
    /**
     * The arguments to the tool call
     */
    args: TArgs;
  }

  /** Content block to represent partial data of a tool call */
  export interface ToolCallChunk<TName extends string = string>
    extends BaseContentBlock {
    /**
     * Type of the content block
     */
    readonly type: "tool_call_chunk";
    /**
     * The name of the tool being called
     */
    name?: TName;
    /**
     * The arguments to the tool call
     */
    args?: string;
    /**
     * The index of the tool call chunk
     */
    index?: number;
  }

  /** Content block to represent an invalid tool call */
  export interface InvalidToolCall<TName extends string = string>
    extends BaseContentBlock {
    /**
     * Type of the content block
     */
    readonly type: "invalid_tool_call";
    /**
     * The name of the tool being called
     */
    name?: TName;
    /**
     * The arguments to the tool call
     */
    args?: string;
    /**
     * An error message associated with the tool call
     */
    error?: string;
    /**
     * Index of block in aggregate response
     */
    index?: string | number;
  }

  export interface ServerToolCall<
    TName extends string = string,
    TArgs = unknown,
  > extends BaseContentBlock {
    /**
     * Type of the content block
     */
    readonly type: "server_tool_call";
    /**
     * The name of the tool being called
     */
    name: TName;
    /**
     * The arguments to the tool call
     */
    args: TArgs;
  }

  export interface ServerToolCallChunk<TName extends string = string>
    extends BaseContentBlock {
    /**
     * Type of the content block
     */
    readonly type: "server_tool_call_chunk";
    /**
     * The name of the tool being called
     */
    name?: TName;
    /**
     * The arguments to the tool call
     */
    args?: string;
  }

  export interface ServerToolCallResult<TOutput = Record<string, unknown>>
    extends BaseContentBlock {
    /**
     * Type of the content block
     */
    readonly type: "server_tool_call_result";
    /**
     * The unique identifier of the tool call that this result corresponds to
     */
    toolCallId: string;
    /**
     * The status of the server tool call
     */
    status: "success" | "error";
    /**
     * The output of the server tool call
     */
    output: TOutput;
  }

  export type Standard =
    | ToolCall
    | ToolCallChunk
    | InvalidToolCall
    | ServerToolCall
    | ServerToolCallChunk
    | ServerToolCallResult;
}
