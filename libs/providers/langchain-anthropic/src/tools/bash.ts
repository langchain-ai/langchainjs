import Anthropic from "@anthropic-ai/sdk";
import { tool } from "@langchain/core/tools";
import type { DynamicStructuredTool, ToolRuntime } from "@langchain/core/tools";

import {
  Bash20250124CommandSchema,
  type Bash20250124Command,
} from "./types.js";

/**
 * Options for the bash tool.
 */
export interface Bash20250124Options {
  /**
   * Optional execute function that handles bash command execution.
   * This function receives the command input and should return the result
   * (stdout and stderr combined, or an error message).
   */
  execute?: (args: Bash20250124Command) => string | Promise<string>;
}

/**
 * Creates an Anthropic bash tool for Claude 4 models and Claude 3.7 that enables
 * shell command execution in a persistent bash session.
 *
 * The bash tool provides Claude with:
 * - **Persistent bash session**: Maintains state between commands
 * - **Shell command execution**: Run any shell command
 * - **Environment access**: Access to environment variables and working directory
 * - **Command chaining**: Support for pipes, redirects, and scripting
 *
 * Available commands:
 * - Execute a command: `{ command: "ls -la" }`
 * - Restart the session: `{ restart: true }`
 *
 * @warning The bash tool provides direct system access. Implement safety measures
 * such as running in isolated environments (Docker/VM), command filtering,
 * and resource limits.
 *
 * @example
 * ```typescript
 * import { ChatAnthropic, tools } from "@langchain/anthropic";
 * import { execSync } from "child_process";
 *
 * const llm = new ChatAnthropic({
 *   model: "claude-sonnet-4-5-20250929",
 * });
 *
 * const bash = tools.bash_20250124({
 *   execute: async (args) => {
 *     if (args.restart) {
 *       // Reset session state
 *       return "Bash session restarted";
 *     }
 *     try {
 *       const output = execSync(args.command!, {
 *         encoding: "utf-8",
 *         timeout: 30000,
 *       });
 *       return output;
 *     } catch (error) {
 *       return `Error: ${error.message}`;
 *     }
 *   },
 * });
 *
 * const llmWithBash = llm.bindTools([bash]);
 * const response = await llmWithBash.invoke(
 *   "List all Python files in the current directory"
 * );
 *
 * // Outputs: "bash"
 * console.log(response.tool_calls[0].name);
 * // Outputs: "ls -la *.py 2>/dev/null || echo \"No Python files found in the current directory\"
 * console.log(response.tool_calls[0].args.command);
 * ```
 *
 * @example Multi-step automation
 * ```typescript
 * // Claude can chain commands in a persistent session:
 * // 1. cd /tmp
 * // 2. echo "Hello" > test.txt
 * // 3. cat test.txt  // Works because we're still in /tmp
 * ```
 *
 * @param options - Configuration options for the bash tool
 * @param options.execute - Function that handles bash command execution
 * @returns The bash tool object that can be passed to `bindTools`
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/bash-tool
 */
export function bash_20250124(options?: Bash20250124Options) {
  const name = "bash";
  const bashTool = tool(
    options?.execute as (
      input: unknown,
      runtime: ToolRuntime<unknown, unknown>
    ) => string | Promise<string>,
    {
      name,
      description: "A tool for executing bash commands",
      schema: Bash20250124CommandSchema,
    }
  );

  bashTool.extras = {
    ...(bashTool.extras ?? {}),
    providerToolDefinition: {
      type: "bash_20250124",
      name,
    } satisfies Anthropic.Beta.BetaToolBash20250124,
  };

  return bashTool as DynamicStructuredTool<
    typeof Bash20250124CommandSchema,
    Bash20250124Command,
    unknown,
    string
  >;
}
