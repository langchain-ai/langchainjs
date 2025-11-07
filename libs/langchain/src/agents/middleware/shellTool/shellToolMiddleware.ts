/* eslint-disable no-instanceof/no-instanceof */
import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";
import { ToolMessage } from "@langchain/core/messages";
import { createMiddleware } from "../../middleware.js";
import { type BaseExecutionPolicy, HostExecutionPolicy } from "./execution.js";
import {
  type RedactionRule,
  ResolvedRedactionRule,
  PIIDetectionError,
} from "./redaction.js";
import {
  normalizeCommands,
  normalizeShellCommand,
  normalizeEnv,
  createResources,
  ensureResources,
  runStartupCommands,
  runShutdownCommands,
  cleanupResources,
  applyRedactions,
} from "./utils.js";
import {
  DEFAULT_TOOL_DESCRIPTION,
  stateSchema,
  type ShellToolState,
} from "./constants.js";

/**
 * identify the tool name in tool messages
 */
const name = "shell";

/**
 * Configuration options for the shell tool middleware.
 */
export interface ShellToolMiddlewareOptions {
  /**
   * Base directory for the shell session. If omitted, a temporary
   * directory is created when the agent starts and removed when it ends.
   */
  workspaceRoot?: string;

  /**
   * Optional commands executed sequentially after the session starts.
   */
  startupCommands?: string[] | string;

  /**
   * Optional commands executed before the session shuts down.
   */
  shutdownCommands?: string[] | string;

  /**
   * Execution policy controlling timeouts, output limits, and resource
   * configuration. Defaults to HostExecutionPolicy for native execution.
   */
  executionPolicy?: BaseExecutionPolicy;

  /**
   * Optional redaction rules to sanitize command output before
   * returning it to the model.
   */
  redactionRules?: RedactionRule[];

  /**
   * Optional override for the registered shell tool description.
   */
  toolDescription?: string;

  /**
   * Optional shell executable (string) or argument sequence used to
   * launch the persistent session. Defaults to ["/bin/bash"].
   */
  shellCommand?: string[] | string;

  /**
   * Optional environment variables to supply to the shell session.
   * Values are coerced to strings before command execution.
   * If omitted, the session inherits the parent process environment.
   */
  env?: Record<string, unknown>;
}

/**
 * Creates a middleware that registers a persistent shell tool for agents.
 *
 * The middleware exposes a single long-lived shell session. Use the execution policy to
 * match your deployment's security posture:
 *
 * - `HostExecutionPolicy` - full host access; best for trusted environments where the
 *   agent already runs inside a container or VM that provides isolation.
 * - `CodexSandboxExecutionPolicy` - reuses the Codex CLI sandbox for additional
 *   syscall/filesystem restrictions when the CLI is available.
 * - `DockerExecutionPolicy` - launches a separate Docker container for each agent run,
 *   providing stronger isolation, optional read-only root filesystems, and user remapping.
 *
 * When no policy is provided the middleware defaults to `HostExecutionPolicy`.
 *
 * @example
 * ```typescript
 * import { shellToolMiddleware, HostExecutionPolicy } from "langchain";
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   middleware: [
 *     shellToolMiddleware({
 *       executionPolicy: new HostExecutionPolicy({
 *         commandTimeout: 60,
 *         maxOutputLines: 5000,
 *       }),
 *     }),
 *   ],
 * });
 * ```
 */
export function shellToolMiddleware(
  options?: ShellToolMiddlewareOptions
): ReturnType<typeof createMiddleware> {
  const workspaceRoot = options?.workspaceRoot;
  const shellCommand = normalizeShellCommand(options?.shellCommand);
  const environment = normalizeEnv(options?.env);
  const executionPolicy = options?.executionPolicy ?? new HostExecutionPolicy();
  const redactionRules = (options?.redactionRules ?? []).map(
    (rule) => new ResolvedRedactionRule(rule)
  );
  const startupCommands = normalizeCommands(options?.startupCommands);
  const shutdownCommands = normalizeCommands(options?.shutdownCommands);
  const toolDescription = options?.toolDescription ?? DEFAULT_TOOL_DESCRIPTION;

  /**
   * Create the shell tool (execution is intercepted by middleware)
   */
  const shellTool = tool(
    () => {
      throw new Error(
        "Persistent shell tool execution should be intercepted via middleware wrappers."
      );
    },
    {
      name,
      description: toolDescription,
      schema: z
        .object({
          command: z.string().optional(),
          restart: z.boolean().optional(),
        })
        .refine(
          (data) => (data.command !== undefined) !== (data.restart === true),
          {
            message:
              "Shell tool requires exactly one of 'command' or 'restart'.",
          }
        ),
    }
  );

  return createMiddleware({
    name: "shellToolMiddleware",
    stateSchema,
    tools: [shellTool],
    beforeAgent: async () => {
      const resources = await createResources(
        workspaceRoot,
        shellCommand,
        environment,
        executionPolicy,
        startupCommands
      );
      return {
        shellSessionResources: {
          session: resources.session,
          tempdir: resources.tempdir,
          policy: resources.policy,
        },
      };
    },
    afterAgent: async (state: ShellToolState) => {
      const resources = ensureResources(state);
      try {
        await runShutdownCommands(
          resources.session,
          shutdownCommands,
          executionPolicy
        );
      } finally {
        await cleanupResources(resources);
      }
    },
    wrapToolCall: async (request, handler) => {
      /**
       * Check if this is our shell tool
       */
      if (request.tool.name !== name) {
        return handler(request);
      }

      const resources = ensureResources(request.state);
      const args = request.toolCall.args as {
        command?: string;
        restart?: boolean;
      };

      if (args.restart) {
        try {
          await resources.session.restart();
          await runStartupCommands(
            resources.session,
            startupCommands,
            executionPolicy
          );
          return new ToolMessage({
            content: "Shell session restarted.",
            tool_call_id: request.toolCall.id ?? "",
            name,
            status: "success",
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to restart shell session.";
          return new ToolMessage({
            content: `Error: ${errorMessage}`,
            tool_call_id: request.toolCall.id ?? "",
            name,
            status: "error",
          });
        }
      }

      /**
       * At this point, command must be defined
       */
      const command = args.command;
      if (!command || typeof command !== "string") {
        return new ToolMessage({
          content:
            "Shell tool expects a 'command' string when restart is not requested.",
          tool_call_id: request.toolCall.id ?? "",
          name,
          status: "error",
        });
      }

      const result = await resources.session.execute(
        command,
        executionPolicy.commandTimeout
      );

      if (result.timedOut) {
        const timeoutSeconds = executionPolicy.commandTimeout;
        return new ToolMessage({
          content: `Error: Command timed out after ${timeoutSeconds.toFixed(
            1
          )} seconds.`,
          tool_call_id: request.toolCall.id ?? "",
          name,
          status: "error",
          artifact: {
            timed_out: true,
            exit_code: null,
          },
        });
      }

      try {
        const [sanitizedOutput, matches] = applyRedactions(
          result.output,
          redactionRules
        );

        let finalOutput = sanitizedOutput || "<no output>";

        if (result.truncatedByLines) {
          finalOutput = `${finalOutput.trim()}\n\n... Output truncated at ${
            executionPolicy.maxOutputLines
          } lines (observed ${result.totalLines}).`;
        }

        if (
          result.truncatedByBytes &&
          executionPolicy.maxOutputBytes !== undefined
        ) {
          finalOutput = `${finalOutput.trim()}\n\n... Output truncated at ${
            executionPolicy.maxOutputBytes
          } bytes (observed ${result.totalBytes}).`;
        }

        if (result.exitCode !== null && result.exitCode !== 0) {
          finalOutput = `${finalOutput.trim()}\n\nExit code: ${
            result.exitCode
          }`;
        }

        const status: "success" | "error" =
          result.exitCode === null || result.exitCode === 0
            ? "success"
            : "error";

        return new ToolMessage({
          content: finalOutput,
          tool_call_id: request.toolCall.id ?? "",
          name,
          status,
          artifact: {
            timed_out: false,
            exit_code: result.exitCode,
            truncated_by_lines: result.truncatedByLines,
            truncated_by_bytes: result.truncatedByBytes,
            total_lines: result.totalLines,
            total_bytes: result.totalBytes,
            redaction_matches: matches,
          },
        });
      } catch (error) {
        if (error instanceof PIIDetectionError) {
          return new ToolMessage({
            content: `Output blocked: detected ${error.piiType}.`,
            tool_call_id: request.toolCall.id ?? "",
            name,
            status: "error",
            artifact: {
              timed_out: false,
              exit_code: result.exitCode,
              matches: { [error.piiType]: error.matches },
            },
          });
        }
        throw error;
      }
    },
  });
}
