import { BaseContentBlock } from "./base.js";

export type Tools = never;

export const KNOWN_BLOCK_TYPES = [
  "tool_call",
  "tool_call_chunk",
  "invalid_tool_call",
  "web_search_call",
  "web_search_result",
  "code_interpreter",
  "code_interpreter_result",
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

  /** Content block for a built-in web search tool call. */
  export interface WebSearchCall extends BaseContentBlock {
    /**
     * Type of the content block
     */
    readonly type: "web_search_call";
    /**
     * The search query used in the web search tool call
     */
    query?: string;
  }

  /** Content block for the result of a built-in search tool call */
  export interface WebSearchResult extends BaseContentBlock {
    /**
     * Type of the content block
     */
    readonly type: "web_search_result";
    /**
     * List of URLs returned by the web search tool call
     */
    urls?: string[];
  }

  /** Content block for a built-in code interpreter tool call. */
  export interface CodeInterpreterCall extends BaseContentBlock {
    /**
     * Type of the content block
     */
    readonly type: "code_interpreter_call";
    /**
     * The language of the code executed by the code interpreter tool call
     */
    language?: string;
    /**
     * The code to be executed by the code interpreter
     */
    code?: string;
  }

  /** Content block for the output of a singular code interpreter tool call */
  export interface CodeInterpreterOutput {
    readonly type: "code_interpreter_output";
    /**
     * The return code of the code interpreter tool call
     * Example: 0 for success, non-zero for failure
     */
    returnCode?: number;
    /**
     * Standard error output of the executed code
     */
    stderr?: string;
    /**
     * Standard output of the executed code
     */
    stdout?: string;
    /**
     * File IDs of the files created by the code interpreter tool call
     */
    fileIds?: string[];
  }

  /** Content block for the result of a code interpreter tool call */
  export interface CodeInterpreterResult extends BaseContentBlock {
    /**
     * Type of the content block
     */
    readonly type: "code_interpreter_result";
    /**
     * The result of the code interpreter tool call
     */
    output: CodeInterpreterOutput[];
  }

  export type Standard =
    | ToolCall
    | ToolCallChunk
    | InvalidToolCall
    | WebSearchCall
    | WebSearchResult
    | CodeInterpreterCall
    | CodeInterpreterResult;
}
