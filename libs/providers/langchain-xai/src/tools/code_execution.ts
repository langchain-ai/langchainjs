/**
 * xAI Code Execution tool type constant.
 * Note: The Responses API uses "code_interpreter" as the type name.
 */
export const XAI_CODE_EXECUTION_TOOL_TYPE = "code_interpreter";

/**
 * xAI's built-in code execution tool interface.
 * Enables the model to write and execute Python code in real-time.
 *
 * This tool is part of xAI's agentic tool calling API and allows for:
 * - Mathematical computations
 * - Data analysis
 * - Financial modeling
 * - Scientific computing
 * - Code generation and testing
 */
export interface XAICodeExecutionTool {
  /**
   * The type of the tool. Must be "code_interpreter".
   */
  type: typeof XAI_CODE_EXECUTION_TOOL_TYPE;
}

/**
 * Creates an xAI code execution tool.
 * Enables the model to write and execute Python code in real-time for
 * calculations, data analysis, and complex computations.
 *
 * This tool is executed server-side by the xAI API in a secure, sandboxed
 * Python environment with common libraries pre-installed (NumPy, Pandas,
 * Matplotlib, SciPy).
 *
 * @returns An XAICodeExecutionTool object to pass to the model
 *
 * @example Basic usage
 * ```typescript
 * import { ChatXAIResponses, tools } from "@langchain/xai";
 *
 * const llm = new ChatXAIResponses({
 *   model: "grok-4-1-fast",
 * });
 *
 * const codeExecution = tools.xaiCodeExecution();
 * const result = await llm.invoke(
 *   "Calculate the compound interest for $10,000 at 5% annually for 10 years",
 *   { tools: [codeExecution] }
 * );
 * ```
 *
 * @example Combining with search tools
 * ```typescript
 * const webSearch = tools.xaiWebSearch();
 * const codeExecution = tools.xaiCodeExecution();
 *
 * const result = await llm.invoke(
 *   "Find the current stock price of AAPL and calculate what it would be worth with 10% annual growth over 5 years",
 *   { tools: [webSearch, codeExecution] }
 * );
 * ```
 */
export function xaiCodeExecution(): XAICodeExecutionTool {
  return {
    type: XAI_CODE_EXECUTION_TOOL_TYPE,
  };
}
