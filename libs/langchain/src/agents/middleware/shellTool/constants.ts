import { z } from "zod/v3";

export const SHELL_TEMP_PREFIX = "langchain-shell-";
export const DEFAULT_TOOL_DESCRIPTION = `Execute a shell command inside a persistent session. Before running a command, confirm the working directory is correct (e.g., inspect with \`ls\` or \`pwd\`) and ensure any parent directories exist. Prefer absolute paths and quote paths containing spaces, such as \`cd "/path/with spaces"\`. Chain multiple commands with \`&&\` or \`;\` instead of embedding newlines. Avoid unnecessary \`cd\` usage unless explicitly required so the session remains stable. Outputs may be truncated when they become very large, and long running commands will be terminated once their configured timeout elapses.`;

/**
 * State schema for the shell tool middleware.
 */
export const stateSchema = z.object({
  shellSessionResources: z
    .object({
      session: z.any(), // ShellSession instance (not serialized)
      tempdir: z.string().nullable(),
      policy: z.any(), // BaseExecutionPolicy instance (not serialized)
    })
    .nullable()
    .optional(),
});

export type ShellToolState = z.infer<typeof stateSchema>;
