import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ShellSession } from "./shellSession.js";
import { BaseExecutionPolicy } from "./execution.js";
import { ResolvedRedactionRule, type PIIMatch } from "./redaction.js";
import { SHELL_TEMP_PREFIX, type ShellToolState } from "./constants.js";

interface SessionResources {
  session: ShellSession;
  tempdir: string | null;
  policy: BaseExecutionPolicy;
}

/**
 * Ensure command is an array of strings.
 * @param commands - The commands to normalize.
 * @returns The normalized commands.
 */
export function normalizeCommands(
  commands?: string[] | string
): readonly string[] {
  if (!commands) {
    return [];
  }
  if (typeof commands === "string") {
    return [commands];
  }
  return commands;
}

/**
 * Ensure shell command is an array of strings. Defaults to ["/bin/bash"].
 * @param shellCommand - The shell command to normalize.
 * @returns The normalized shell command.
 */
export function normalizeShellCommand(
  shellCommand?: string[] | string
): readonly string[] {
  if (!shellCommand) {
    return ["/bin/bash"];
  }
  if (typeof shellCommand === "string") {
    return [shellCommand];
  }
  if (shellCommand.length === 0) {
    throw new Error("Shell command must contain at least one argument.");
  }
  return shellCommand;
}

export function normalizeEnv(
  env?: Record<string, unknown>
): Record<string, string> | undefined {
  if (!env) {
    return undefined;
  }
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof key !== "string") {
      throw new TypeError("Environment variable names must be strings.");
    }
    normalized[key] = String(value);
  }
  return normalized;
}

export async function createResources(
  workspaceRoot: string | undefined,
  shellCommand: readonly string[],
  environment: Record<string, string> | undefined,
  executionPolicy: BaseExecutionPolicy,
  startupCommands: readonly string[]
): Promise<SessionResources> {
  let workspace: string;
  let tempdir: string | null = null;

  if (workspaceRoot) {
    workspace = workspaceRoot;
    await mkdir(workspace, { recursive: true });
  } else {
    tempdir = await mkdtemp(join(tmpdir(), SHELL_TEMP_PREFIX));
    workspace = tempdir;
  }

  const session = new ShellSession(
    workspace,
    executionPolicy,
    shellCommand,
    environment ?? {}
  );

  try {
    await session.start();
    await runStartupCommands(session, startupCommands, executionPolicy);
  } catch (error) {
    await session.stop(executionPolicy.terminationTimeout);
    if (tempdir) {
      await rm(tempdir, { recursive: true, force: true });
    }
    throw error;
  }

  return {
    session,
    tempdir,
    policy: executionPolicy,
  };
}

export function ensureResources(
  state: ShellToolState & { messages?: unknown }
): SessionResources {
  const resources = state.shellSessionResources;
  if (!resources) {
    throw new Error(
      "Shell session resources are unavailable. Ensure `beforeAgent` ran successfully before invoking the shell tool."
    );
  }
  return resources as SessionResources;
}

export async function runStartupCommands(
  session: ShellSession,
  commands: readonly string[],
  policy: BaseExecutionPolicy
): Promise<void> {
  for (const command of commands) {
    const result = await session.execute(command, policy.startupTimeout);
    if (
      result.timedOut ||
      (result.exitCode !== null && result.exitCode !== 0)
    ) {
      throw new Error(
        `Startup command '${command}' failed with exit code ${result.exitCode}`
      );
    }
  }
}

export async function runShutdownCommands(
  session: ShellSession,
  commands: readonly string[],
  policy: BaseExecutionPolicy
): Promise<void> {
  for (const command of commands) {
    try {
      const result = await session.execute(command, policy.commandTimeout);
      if (result.timedOut) {
        console.warn(`Shutdown command '${command}' timed out.`);
      } else if (result.exitCode !== null && result.exitCode !== 0) {
        console.warn(
          `Shutdown command '${command}' exited with ${result.exitCode}.`
        );
      }
    } catch (error) {
      console.warn(`Failed to run shutdown command '${command}':`, error);
    }
  }
}

export async function cleanupResources(
  resources: SessionResources
): Promise<void> {
  try {
    await resources.session.stop(resources.policy.terminationTimeout);
  } catch {
    // Ignore cleanup errors
  }

  if (resources.tempdir) {
    try {
      await rm(resources.tempdir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

export function applyRedactions(
  content: string,
  rules: ResolvedRedactionRule[]
): [string, Record<string, PIIMatch[]>] {
  const matchesByType: Record<string, PIIMatch[]> = {};
  let updated = content;

  for (const rule of rules) {
    const [redacted, matches] = rule.apply(updated);
    updated = redacted;
    if (matches.length > 0) {
      matchesByType[rule.piiType] = matches;
    }
  }

  return [updated, matchesByType];
}
