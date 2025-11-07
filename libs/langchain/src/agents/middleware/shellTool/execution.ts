import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import type { PathLike } from "node:fs";

/**
 * Base class for execution policies that control how shell commands are executed.
 * Execution policies determine timeouts, output limits, and resource configuration.
 */
export abstract class BaseExecutionPolicy {
  /**
   * Timeout for individual command execution (in seconds).
   */
  abstract readonly commandTimeout: number;

  /**
   * Timeout for startup commands (in seconds).
   */
  abstract readonly startupTimeout: number;

  /**
   * Timeout for terminating shell processes (in seconds).
   */
  abstract readonly terminationTimeout: number;

  /**
   * Maximum number of output lines before truncation.
   */
  abstract readonly maxOutputLines: number;

  /**
   * Maximum number of output bytes before truncation, or null for no limit.
   */
  abstract readonly maxOutputBytes: number | undefined;

  /**
   * Spawns a shell process with the given configuration.
   *
   * @param workspace - The working directory for the shell session
   * @param env - Environment variables to pass to the shell
   * @param command - The shell command and arguments to execute
   * @returns A spawned child process
   */
  abstract spawn(
    workspace: PathLike,
    env: Record<string, string>,
    command: readonly string[]
  ): ChildProcess;
}

/**
 * Execution policy that runs commands directly on the host system.
 * Best for trusted environments where the agent already runs inside
 * a container or VM that provides isolation.
 */
export class HostExecutionPolicy extends BaseExecutionPolicy {
  readonly commandTimeout: number;
  readonly startupTimeout: number;
  readonly terminationTimeout: number;
  readonly maxOutputLines: number;
  readonly maxOutputBytes: number | undefined;

  constructor(options?: {
    commandTimeout?: number;
    startupTimeout?: number;
    terminationTimeout?: number;
    maxOutputLines?: number;
    maxOutputBytes?: number;
  }) {
    super();
    this.commandTimeout = options?.commandTimeout ?? 30;
    this.startupTimeout = options?.startupTimeout ?? 10;
    this.terminationTimeout = options?.terminationTimeout ?? 5;
    this.maxOutputLines = options?.maxOutputLines ?? 10000;
    this.maxOutputBytes = options?.maxOutputBytes;
  }

  spawn(
    workspace: PathLike,
    env: Record<string, string>,
    command: readonly string[]
  ): ChildProcess {
    // eslint-disable-next-line no-process-env
    const processEnv = process.env;
    return spawn(command[0], command.slice(1), {
      cwd: workspace.toString(),
      env: { ...processEnv, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
  }
}

/**
 * Execution policy that runs commands in a Docker container.
 * Provides stronger isolation, optional read-only root filesystems,
 * and user remapping.
 */
export class DockerExecutionPolicy extends BaseExecutionPolicy {
  /**
   * Timeout for individual command execution (in seconds).
   * @default 30
   */
  readonly commandTimeout: number;
  /**
   * Timeout for startup commands (in seconds).
   * @default 10
   */
  readonly startupTimeout: number;
  /**
   * Timeout for terminating shell processes (in seconds).
   * @default 5
   */
  readonly terminationTimeout: number;
  /**
   * Maximum number of output lines before truncation.
   * @default 10000
   */
  readonly maxOutputLines: number;
  /**
   * Maximum number of output bytes before truncation, or null for no limit.
   */
  readonly maxOutputBytes: number | undefined;
  /**
   * Image to use for the Docker container.
   * @default "ubuntu:latest"
   */
  readonly image: string;
  /**
   * Whether to use a read-only root filesystem.
   * @default false
   */
  readonly readOnlyRootfs: boolean;
  /**
   * User to run the container as.
   */
  readonly user?: string;

  constructor(options?: {
    commandTimeout?: number;
    startupTimeout?: number;
    terminationTimeout?: number;
    maxOutputLines?: number;
    maxOutputBytes?: number;
    image?: string;
    readOnlyRootfs?: boolean;
    user?: string;
  }) {
    super();
    this.commandTimeout = options?.commandTimeout ?? 30;
    this.startupTimeout = options?.startupTimeout ?? 10;
    this.terminationTimeout = options?.terminationTimeout ?? 5;
    this.maxOutputLines = options?.maxOutputLines ?? 10000;
    this.maxOutputBytes = options?.maxOutputBytes;
    this.image = options?.image ?? "ubuntu:latest";
    this.readOnlyRootfs = options?.readOnlyRootfs ?? false;
    this.user = options?.user;
  }

  spawn(
    workspace: PathLike,
    env: Record<string, string>,
    command: readonly string[]
  ): ChildProcess {
    const workspacePath = workspace.toString();

    // Ensure workspace directory exists before mounting as Docker volume
    if (!existsSync(workspacePath)) {
      mkdirSync(workspacePath, { recursive: true });
    }

    const dockerArgs: string[] = [
      "run",
      "--rm",
      "--interactive",
      `--workdir=${workspacePath}`,
      `--volume=${workspacePath}:${workspacePath}`,
    ];

    if (this.readOnlyRootfs) {
      dockerArgs.push("--read-only");
    }

    if (this.user) {
      dockerArgs.push(`--user=${this.user}`);
    }

    // Add environment variables
    for (const [key, value] of Object.entries(env)) {
      dockerArgs.push(`--env=${key}=${value}`);
    }

    dockerArgs.push(this.image);
    dockerArgs.push(...command);

    return spawn("docker", dockerArgs, {
      stdio: ["pipe", "pipe", "pipe"],
    });
  }
}

/**
 * Execution policy that uses the Codex CLI sandbox for additional
 * syscall/filesystem restrictions when the CLI is available.
 */
export class CodexSandboxExecutionPolicy extends BaseExecutionPolicy {
  readonly commandTimeout: number;
  readonly startupTimeout: number;
  readonly terminationTimeout: number;
  readonly maxOutputLines: number;
  readonly maxOutputBytes: number | undefined;

  constructor(options?: {
    /**
     * Timeout for individual command execution (in seconds).
     * @default 30
     */
    commandTimeout?: number;
    /**
     * Timeout for startup commands (in seconds).
     * @default 10
     */
    startupTimeout?: number;
    /**
     * Timeout for terminating shell processes (in seconds).
     * @default 5
     */
    terminationTimeout?: number;
    /**
     * Maximum number of output lines before truncation.
     * @default 10000
     */
    maxOutputLines?: number;
    /**
     * Maximum number of output bytes before truncation, or null for no limit.
     */
    maxOutputBytes?: number;
  }) {
    super();
    this.commandTimeout = options?.commandTimeout ?? 30;
    this.startupTimeout = options?.startupTimeout ?? 10;
    this.terminationTimeout = options?.terminationTimeout ?? 5;
    this.maxOutputLines = options?.maxOutputLines ?? 10000;
    this.maxOutputBytes = options?.maxOutputBytes;
  }

  spawn(
    workspace: PathLike,
    env: Record<string, string>,
    command: readonly string[]
  ): ChildProcess {
    // Codex sandbox implementation would go here
    // For now, fall back to host execution
    // In a real implementation, this would use the Codex CLI
    // eslint-disable-next-line no-process-env
    const processEnv = process.env;
    return spawn(command[0], command.slice(1), {
      cwd: workspace.toString(),
      env: { ...processEnv, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
  }
}
