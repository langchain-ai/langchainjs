import { type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import type { PathLike } from "node:fs";
import { EventEmitter } from "node:events";

import type { BaseExecutionPolicy } from "./execution.js";

const DONE_MARKER_PREFIX = "__LC_SHELL_DONE__";

/**
 * Result from executing a command in the shell session.
 */
export interface CommandExecutionResult {
  /**
   * The command output (stdout and stderr combined).
   */
  output: string;
  /**
   * The exit code, or null if the command timed out.
   */
  exitCode: number | null;
  /**
   * Whether the command timed out.
   */
  timedOut: boolean;
  /**
   * Whether output was truncated due to line limit.
   */
  truncatedByLines: boolean;
  /**
   * Whether output was truncated due to byte limit.
   */
  truncatedByBytes: boolean;
  /**
   * Total number of lines collected before truncation.
   */
  totalLines: number;
  /**
   * Total number of bytes collected before truncation.
   */
  totalBytes: number;
}

/**
 * Manages a persistent shell session that supports sequential command execution.
 */
export class ShellSession {
  #process?: ChildProcess;
  #terminated = false;
  #lockPromise: Promise<void> = Promise.resolve();
  #stdoutBuffer = "";
  #stderrBuffer = "";

  readonly #workspace: PathLike;
  readonly #policy: BaseExecutionPolicy;
  readonly #command: readonly string[];
  readonly #environment: Record<string, string>;
  readonly #outputQueue: {
    source: "stdout" | "stderr";
    data: string | null;
  }[] = [];
  readonly #outputEmitter = new EventEmitter();

  constructor(
    workspace: PathLike,
    policy: BaseExecutionPolicy,
    command: readonly string[],
    environment: Record<string, string>
  ) {
    this.#workspace = workspace;
    this.#policy = policy;
    this.#command = command;
    this.#environment = environment;
  }

  /**
   * Starts the shell subprocess and sets up output readers.
   */
  async start(): Promise<void> {
    if (this.#process && this.#process.exitCode === null) {
      return;
    }

    /**
     * Ensure workspace directory exists
     */
    await mkdir(this.#workspace.toString(), { recursive: true });

    this.#process = this.#policy.spawn(
      this.#workspace,
      this.#environment,
      this.#command
    );

    if (
      !this.#process.stdin ||
      !this.#process.stdout ||
      !this.#process.stderr
    ) {
      throw new Error("Failed to initialize shell session pipes.");
    }

    this.#terminated = false;
    this.#outputQueue.length = 0;
    this.#stdoutBuffer = "";
    this.#stderrBuffer = "";

    // Set up stdout reader
    this.#process.stdout.setEncoding("utf8");
    this.#process.stdout.on("data", (chunk: string) => {
      this.#stdoutBuffer += chunk;
      const lines = this.#stdoutBuffer.split("\n");
      // Keep the last partial line in the buffer
      this.#stdoutBuffer = lines.pop() || "";

      for (const line of lines) {
        this.#outputQueue.push({ source: "stdout", data: `${line}\n` });
      }
      this.#outputEmitter.emit("data");
    });

    this.#process.stdout.on("end", () => {
      if (this.#stdoutBuffer) {
        this.#outputQueue.push({ source: "stdout", data: this.#stdoutBuffer });
      }
      this.#outputQueue.push({ source: "stdout", data: null });
      this.#outputEmitter.emit("data");
    });

    // Set up stderr reader
    this.#process.stderr.setEncoding("utf8");
    this.#process.stderr.on("data", (chunk: string) => {
      this.#stderrBuffer += chunk;
      const lines = this.#stderrBuffer.split("\n");
      // Keep the last partial line in the buffer
      this.#stderrBuffer = lines.pop() || "";

      for (const line of lines) {
        this.#outputQueue.push({ source: "stderr", data: `${line}\n` });
      }
      this.#outputEmitter.emit("data");
    });

    this.#process.stderr.on("end", () => {
      if (this.#stderrBuffer) {
        this.#outputQueue.push({ source: "stderr", data: this.#stderrBuffer });
      }
      this.#outputQueue.push({ source: "stderr", data: null });
      this.#outputEmitter.emit("data");
    });

    this.#process.on("error", (error) => {
      this.#outputEmitter.emit("error", error);
    });
  }

  /**
   * Restarts the shell process.
   */
  async restart(): Promise<void> {
    await this.stop(this.#policy.terminationTimeout);
    await this.start();
  }

  /**
   * Stops the shell subprocess.
   *
   * @param timeout - Maximum time to wait for graceful shutdown (in seconds)
   */
  async stop(timeout: number): Promise<void> {
    if (!this.#process) {
      return;
    }

    if (this.#process.exitCode === null && !this.#terminated) {
      try {
        if (this.#process.stdin && !this.#process.stdin.destroyed) {
          this.#process.stdin.write("exit\n");
          this.#process.stdin.end();
        }
      } catch {
        // Ignore errors writing exit command
      }
    }

    const exitPromise = new Promise<void>((resolve) => {
      if (this.#process) {
        if (this.#process.exitCode !== null) {
          resolve();
          return;
        }
        this.#process.once("exit", () => resolve());
      } else {
        resolve();
      }
    });

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        this.#killProcess();
        resolve();
      }, timeout * 1000);
    });

    await Promise.race([exitPromise, timeoutPromise]);
    this.#terminated = true;
    this.#process = undefined;
  }

  /**
   * Executes a command in the persistent shell.
   *
   * @param command - The command to execute
   * @param timeout - Maximum time to wait for command completion (in seconds)
   * @returns The execution result
   */
  async execute(
    command: string,
    timeout: number
  ): Promise<CommandExecutionResult> {
    if (!this.#process || this.#process.exitCode !== null) {
      throw new Error("Shell session is not running.");
    }

    if (!this.#process.stdin || this.#process.stdin.destroyed) {
      throw new Error("Shell session stdin is not available.");
    }

    /**
     * Acquire lock
     */
    const currentLock = this.#lockPromise;
    let lockResolve: (() => void) | undefined;
    this.#lockPromise = new Promise<void>((resolve) => {
      lockResolve = resolve as () => void;
    });

    await currentLock;

    /**
     * Drain any existing output
     */
    this.#drainQueue();

    const marker = `${DONE_MARKER_PREFIX}${randomUUID().replace(/-/g, "")}`;
    const deadline = Date.now() + timeout * 1000;

    /**
     * Write command and marker
     */
    const commandLine = command.endsWith("\n") ? command : `${command}\n`;
    this.#process.stdin.write(commandLine);
    this.#process.stdin.write(`printf '${marker} %s\\n' $?\n`);

    try {
      return await this.#collectOutput(marker, deadline);
    } finally {
      /**
       * Release lock
       */
      if (lockResolve) {
        lockResolve();
      }
    }
  }

  async #collectOutput(
    marker: string,
    deadline: number
  ): Promise<CommandExecutionResult> {
    const collected: string[] = [];
    let totalLines = 0;
    let totalBytes = 0;
    let truncatedByLines = false;
    let truncatedByBytes = false;
    let exitCode: number | null = null;
    let timedOut = false;

    const waitForData = (): Promise<void> => {
      return new Promise((resolve) => {
        const checkQueue = () => {
          if (this.#outputQueue.length > 0) {
            resolve();
          } else {
            this.#outputEmitter.once("data", checkQueue);
          }
        };
        checkQueue();
      });
    };

    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        timedOut = true;
        break;
      }

      try {
        // Wait for data with timeout
        await Promise.race([
          waitForData(),
          new Promise((resolve) =>
            setTimeout(() => resolve(null), Math.max(remaining, 0))
          ),
        ]);

        if (this.#outputQueue.length === 0) {
          timedOut = true;
          break;
        }

        const item = this.#outputQueue.shift();
        if (!item || item.data === null) {
          continue;
        }

        const { source, data } = item;

        // Check for done marker
        if (source === "stdout" && data.startsWith(marker)) {
          const parts = data.split(" ");
          if (parts.length >= 2) {
            const statusStr = parts[1].trim();
            exitCode = this.#safeParseInt(statusStr);
          }
          break;
        }

        totalLines += 1;
        const encoded = Buffer.from(data, "utf8");
        totalBytes += encoded.length;

        if (totalLines > this.#policy.maxOutputLines) {
          truncatedByLines = true;
          continue;
        }

        if (
          this.#policy.maxOutputBytes !== undefined &&
          totalBytes > this.#policy.maxOutputBytes
        ) {
          truncatedByBytes = true;
          continue;
        }

        if (source === "stderr") {
          const stripped = data.replace(/\n$/, "");
          collected.push(`[stderr] ${stripped}`);
          if (data.endsWith("\n")) {
            collected.push("\n");
          }
        } else {
          collected.push(data);
        }
      } catch {
        // If we get an error, assume timeout
        timedOut = true;
        break;
      }
    }

    if (timedOut) {
      // Restart shell session on timeout
      await this.restart();
      return {
        output: "",
        exitCode: null,
        timedOut: true,
        truncatedByLines,
        truncatedByBytes,
        totalLines,
        totalBytes,
      };
    }

    const output = collected.join("");
    return {
      output,
      exitCode,
      timedOut: false,
      truncatedByLines,
      truncatedByBytes,
      totalLines,
      totalBytes,
    };
  }

  #drainQueue(): void {
    while (this.#outputQueue.length > 0) {
      this.#outputQueue.shift();
    }
  }

  #killProcess(): void {
    if (!this.#process) {
      return;
    }

    try {
      if (this.#process.pid) {
        process.kill(this.#process.pid, "SIGKILL");
      }
    } catch {
      // Ignore errors killing process
    }
  }

  #safeParseInt(value: string): number | null {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }
}
