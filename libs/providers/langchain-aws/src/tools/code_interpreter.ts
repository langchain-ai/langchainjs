import { z } from "zod/v4";
import {
  BedrockAgentCoreClient,
  InvokeCodeInterpreterCommand,
  StartCodeInterpreterSessionCommand,
  StopCodeInterpreterSessionCommand,
  type BedrockAgentCoreClientConfig,
  type CodeInterpreterStreamOutput,
  type ContentBlock,
  type InvokeCodeInterpreterResponse,
  type ToolArguments,
  type ToolName,
} from "@aws-sdk/client-bedrock-agentcore";
import {
  BaseToolkit,
  tool,
  type StructuredToolInterface,
  type ToolRunnableConfig,
} from "@langchain/core/tools";
import type { CredentialType } from "../types.js";

/**
 * Identifier of the AWS managed code interpreter.
 */
export const DEFAULT_CODE_INTERPRETER_IDENTIFIER = "aws.codeinterpreter.v1";

const DEFAULT_SESSION_TIMEOUT_SECONDS = 900;

const CHECKPOINT_NS_SEPARATOR = "|";

// Allowlist for pip package specifiers, e.g. `pandas`, `numpy<2.0`,
// `requests[socks]==2.31.0`. Mirrors the Python `bedrock-agentcore` SDK.
const VALID_PACKAGE_NAME =
  /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?(\[[a-zA-Z0-9._,-]*\])?(==|>=|<=|!=|~=|>|<)?[a-zA-Z0-9.*]*$/;

export const ExecuteCodeInputSchema = z.object({
  code: z
    .string()
    .describe(
      "Python/JavaScript/TypeScript code to execute. Can include imports, function definitions, data analysis, and visualizations. Variables and imports persist across calls within the same session."
    ),
  language: z
    .enum(["python", "javascript", "typescript"])
    .optional()
    .describe(
      "Programming language: 'python' (default), 'javascript', or 'typescript'"
    ),
  clear_context: z
    .boolean()
    .optional()
    .describe(
      "If true, clears all previous variable state before execution. Use this to start fresh or free memory. Defaults to false."
    ),
});

export const ExecuteCommandInputSchema = z.object({
  command: z
    .string()
    .describe(
      "Shell command to execute (e.g., 'ls -la', 'pip list', 'cat file.txt'). Runs in a bash shell environment."
    ),
});

export const ReadFilesInputSchema = z.object({
  paths: z
    .array(z.string())
    .describe(
      "List of file paths to read (e.g., ['data.csv', 'results/output.json'])"
    ),
});

export const ListFilesInputSchema = z.object({
  directory_path: z
    .string()
    .optional()
    .describe(
      "Directory path to list. Empty string or '.' for current directory."
    ),
});

export const DeleteFilesInputSchema = z.object({
  paths: z.array(z.string()).describe("List of file paths to delete"),
});

export const WriteFilesInputSchema = z.object({
  files: z
    .array(
      z.object({
        path: z
          .string()
          .describe(
            "Relative file path, like 'data.csv' or 'scripts/analyze.py'"
          ),
        text: z.string().describe("File content"),
      })
    )
    .describe(
      "List of files to write. Each file must have 'path' (relative path like 'data.csv' or 'scripts/analyze.py') and 'text' (file content). Cannot use absolute paths starting with '/'."
    ),
});

export const UploadFileInputSchema = z.object({
  path: z
    .string()
    .describe(
      "Relative path where file should be saved (e.g., 'data.csv', 'scripts/analyze.py')"
    ),
  content: z.string().describe("File content as string"),
  description: z
    .string()
    .optional()
    .describe(
      "Optional semantic description of the file contents to help understand the data structure (e.g., 'CSV with columns: date, revenue, product_id')"
    ),
});

export const InstallPackagesInputSchema = z.object({
  packages: z
    .array(z.string())
    .describe(
      "List of Python packages to install. Can include version specifiers (e.g., ['pandas>=2.0', 'numpy', 'scikit-learn==1.3.0'])"
    ),
  upgrade: z
    .boolean()
    .optional()
    .describe(
      "If true, upgrades packages if already installed. Defaults to false."
    ),
});

export const StartCommandExecutionInputSchema = z.object({
  command: z
    .string()
    .describe("Long-running shell command to start in the background"),
});

export const TaskInputSchema = z.object({
  task_id: z
    .string()
    .describe("ID of the task returned by start_command_execution"),
});

export type ExecuteCodeInput = z.input<typeof ExecuteCodeInputSchema>;
export type ExecuteCommandInput = z.input<typeof ExecuteCommandInputSchema>;
export type ReadFilesInput = z.input<typeof ReadFilesInputSchema>;
export type ListFilesInput = z.input<typeof ListFilesInputSchema>;
export type DeleteFilesInput = z.input<typeof DeleteFilesInputSchema>;
export type WriteFilesInput = z.input<typeof WriteFilesInputSchema>;
export type UploadFileInput = z.input<typeof UploadFileInputSchema>;
export type InstallPackagesInput = z.input<typeof InstallPackagesInputSchema>;
export type StartCommandExecutionInput = z.input<
  typeof StartCommandExecutionInputSchema
>;
export type TaskInput = z.input<typeof TaskInputSchema>;

/**
 * Input for the {@link CodeInterpreterToolkit} constructor.
 */
export interface CodeInterpreterToolkitParams {
  /**
   * The AWS region e.g. `us-west-2`. Falls back to the AWS SDK default
   * region resolution (`AWS_REGION` env variable, `~/.aws/config`, ...).
   */
  region?: string;

  /**
   * AWS Credentials. If no credentials are provided, the default credentials
   * from `@aws-sdk/credential-provider-node` will be used.
   */
  credentials?: CredentialType;

  /**
   * Overrides the default AgentCore client configuration.
   */
  clientOptions?: BedrockAgentCoreClientConfig;

  /**
   * A custom AgentCore client. When provided, `region`, `credentials` and
   * `clientOptions` are ignored.
   */
  client?: BedrockAgentCoreClient;

  /**
   * The code interpreter to start sessions on. Defaults to the AWS managed
   * interpreter (`aws.codeinterpreter.v1`). Set to the ID of a custom
   * interpreter, e.g. one with VPC configuration.
   */
  codeInterpreterIdentifier?: string;

  /**
   * Time-to-live of each code interpreter session, in seconds.
   * @default 900
   */
  sessionTimeoutSeconds?: number;
}

interface CodeInterpreterSession {
  codeInterpreterIdentifier: string;
  sessionId: string;
}

interface SessionEntry {
  threadId: string;
  session: Promise<CodeInterpreterSession>;
}

/**
 * Toolkit for running code in an
 * [Amazon Bedrock AgentCore Code Interpreter](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/code-interpreter-tool.html)
 * sandbox.
 *
 * Provides the following tools:
 *
 * - `execute_code` - Run Python, JavaScript or TypeScript code
 * - `execute_command` - Run shell commands
 * - `read_files` - Read content of files in the sandbox
 * - `list_files` - List files in directories
 * - `delete_files` - Remove files from the sandbox
 * - `write_files` - Create or update files
 * - `upload_file` - Upload a file with a semantic description
 * - `install_packages` - Install Python packages
 * - `start_command_execution` - Start long-running commands asynchronously
 * - `get_task` - Check status of async tasks
 * - `stop_task` - Stop running tasks
 *
 * A code interpreter session is lazily started on first use. Each LangGraph
 * thread (`configurable.thread_id`) gets its own session, so state is
 * isolated between conversations. Subagents get their own session too.
 * Tool calls without a `thread_id` all share a single `default` session, so
 * always pass a `thread_id` when one toolkit serves several conversations.
 * If a session expires, a new one is started on the next tool call.
 *
 * @example
 * ```typescript
 * import { createAgent } from "langchain";
 * import { ChatBedrockConverse, CodeInterpreterToolkit } from "@langchain/aws";
 *
 * const toolkit = new CodeInterpreterToolkit({ region: "us-west-2" });
 *
 * const agent = createAgent({
 *   model: new ChatBedrockConverse({
 *     model: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
 *     region: "us-west-2",
 *   }),
 *   tools: toolkit.getTools(),
 * });
 *
 * const result = await agent.invoke(
 *   {
 *     messages: [
 *       { role: "user", content: "What is the 50th Fibonacci number?" },
 *     ],
 *   },
 *   { configurable: { thread_id: "session-123" } }
 * );
 *
 * // Stop all code interpreter sessions when done
 * await toolkit.cleanup();
 * ```
 */
export class CodeInterpreterToolkit extends BaseToolkit {
  tools: StructuredToolInterface[];

  client: BedrockAgentCoreClient;

  codeInterpreterIdentifier: string;

  sessionTimeoutSeconds: number;

  /**
   * Sessions keyed by thread and subagent namespace. Promises are stored so
   * that concurrent tool calls on the same thread share a single session.
   */
  protected sessions = new Map<string, SessionEntry>();

  constructor(fields: CodeInterpreterToolkitParams = {}) {
    super();
    this.client =
      fields.client ??
      new BedrockAgentCoreClient({
        ...fields.clientOptions,
        ...(fields.region ? { region: fields.region } : {}),
        ...(fields.credentials ? { credentials: fields.credentials } : {}),
      });
    this.codeInterpreterIdentifier =
      fields.codeInterpreterIdentifier ?? DEFAULT_CODE_INTERPRETER_IDENTIFIER;
    this.sessionTimeoutSeconds =
      fields.sessionTimeoutSeconds ?? DEFAULT_SESSION_TIMEOUT_SECONDS;
    this.tools = this.createTools();
  }

  /**
   * Returns the tools keyed by name.
   */
  getToolsByName(): Record<string, StructuredToolInterface> {
    return Object.fromEntries(this.tools.map((t) => [t.name, t]));
  }

  /**
   * Stops code interpreter sessions. Sessions whose stop request fails are
   * kept, so calling `cleanup` again retries them.
   *
   * @param threadId - Stops the sessions of this thread, including the
   *   sessions of its subagents. Stops all sessions if omitted.
   */
  async cleanup(threadId?: string): Promise<void> {
    const errors: unknown[] = [];
    const failed = new Set<SessionEntry>();
    // Loop so that sessions started by tool calls that run while cleaning up
    // are stopped too.
    for (;;) {
      const entries = [...this.sessions].filter(
        ([, entry]) =>
          (threadId === undefined || entry.threadId === threadId) &&
          !failed.has(entry)
      );
      if (entries.length === 0) break;
      await Promise.all(
        entries.map(async ([key, entry]) => {
          let session: CodeInterpreterSession;
          try {
            session = await entry.session;
          } catch {
            // The session never started, so there is nothing to stop.
            this.removeSession(key, entry);
            return;
          }
          try {
            await this.client.send(
              new StopCodeInterpreterSessionCommand({
                codeInterpreterIdentifier: session.codeInterpreterIdentifier,
                sessionId: session.sessionId,
              })
            );
          } catch (e) {
            if (!isSessionGoneError(e)) {
              failed.add(entry);
              errors.push(e);
              return;
            }
          }
          this.removeSession(key, entry);
        })
      );
    }
    if (errors.length === 1) {
      throw errors[0];
    } else if (errors.length > 1) {
      throw new AggregateError(
        errors,
        "Failed to stop code interpreter sessions"
      );
    }
  }

  /**
   * Execute code in the thread's code interpreter session.
   */
  async executeCode(
    input: ExecuteCodeInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    return this.invoke(
      "executeCode",
      {
        code: input.code,
        language: input.language ?? "python",
        clearContext: input.clear_context ?? false,
      },
      config
    );
  }

  /**
   * Execute a shell command and wait for it to finish.
   */
  async executeCommand(
    input: ExecuteCommandInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    return this.invoke("executeCommand", { command: input.command }, config);
  }

  /**
   * Read the content of files.
   */
  async readFiles(
    input: ReadFilesInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    return this.invoke("readFiles", { paths: input.paths }, config);
  }

  /**
   * List files in a directory.
   */
  async listFiles(
    input: ListFilesInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    return this.invoke(
      "listFiles",
      { directoryPath: input.directory_path ?? "" },
      config
    );
  }

  /**
   * Delete files.
   */
  async deleteFiles(
    input: DeleteFilesInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    return this.invoke("removeFiles", { paths: input.paths }, config);
  }

  /**
   * Write files. Paths must be relative to the sandbox working directory.
   */
  async writeFiles(
    input: WriteFilesInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    for (const file of input.files) {
      assertRelativePath(file.path);
    }
    return this.invoke("writeFiles", { content: input.files }, config);
  }

  /**
   * Upload a single file. The description is not stored in the sandbox, it
   * only gives the model a place to describe the data it uploads.
   */
  async uploadFile(
    input: UploadFileInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    assertRelativePath(input.path);
    return this.invoke(
      "writeFiles",
      { content: [{ path: input.path, text: input.content }] },
      config
    );
  }

  /**
   * Install Python packages with pip.
   */
  async installPackages(
    input: InstallPackagesInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    if (input.packages.length === 0) {
      throw new Error("At least one package name must be provided");
    }
    for (const pkg of input.packages) {
      if (!VALID_PACKAGE_NAME.test(pkg)) {
        throw new Error(`Invalid package name: ${pkg}`);
      }
    }
    const packages = input.packages.map(shellQuote).join(" ");
    const upgradeFlag = input.upgrade ? "--upgrade " : "";
    return this.invoke(
      "executeCommand",
      { command: `pip install ${upgradeFlag}${packages}` },
      config
    );
  }

  /**
   * Start a long-running shell command in the background.
   */
  async startCommandExecution(
    input: StartCommandExecutionInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    return this.invoke(
      "startCommandExecution",
      { command: input.command },
      config
    );
  }

  /**
   * Get the status of a task started with `startCommandExecution`.
   */
  async getTask(
    input: TaskInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    return this.invoke("getTask", { taskId: input.task_id }, config);
  }

  /**
   * Stop a task started with `startCommandExecution`.
   */
  async stopTask(
    input: TaskInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    return this.invoke("stopTask", { taskId: input.task_id }, config);
  }

  protected async invoke(
    name: ToolName,
    args: ToolArguments,
    config?: ToolRunnableConfig
  ): Promise<string> {
    const { key, threadId } = getSessionKey(config);
    const entry = this.getOrCreateSession(key, threadId);
    try {
      return await this.invokeSession(await entry.session, name, args, config);
    } catch (e) {
      if (!isSessionGoneError(e)) {
        throw e;
      }
      // The session expired or was stopped outside of the toolkit, so start
      // a new one and retry once.
      this.removeSession(key, entry);
      const retry = this.getOrCreateSession(key, threadId);
      const output = await this.invokeSession(
        await retry.session,
        name,
        args,
        config
      );
      return `The previous code interpreter session expired, so a new session was started. Variables and files from earlier calls are gone.\n${output}`;
    }
  }

  protected async invokeSession(
    session: CodeInterpreterSession,
    name: ToolName,
    args: ToolArguments,
    config?: ToolRunnableConfig
  ): Promise<string> {
    const response = await this.client.send(
      new InvokeCodeInterpreterCommand({
        codeInterpreterIdentifier: session.codeInterpreterIdentifier,
        sessionId: session.sessionId,
        name,
        arguments: args,
      }),
      { abortSignal: config?.signal }
    );
    return extractOutputFromStream(response);
  }

  protected getOrCreateSession(key: string, threadId: string): SessionEntry {
    let entry = this.sessions.get(key);
    if (!entry) {
      const newEntry: SessionEntry = { threadId, session: this.startSession() };
      this.sessions.set(key, newEntry);
      // Allow the next call to retry if the session failed to start.
      newEntry.session.catch(() => this.removeSession(key, newEntry));
      entry = newEntry;
    }
    return entry;
  }

  /**
   * Removes a session unless it was already replaced by a newer one.
   */
  protected removeSession(key: string, entry: SessionEntry) {
    if (this.sessions.get(key) === entry) {
      this.sessions.delete(key);
    }
  }

  protected async startSession(): Promise<CodeInterpreterSession> {
    const response = await this.client.send(
      new StartCodeInterpreterSessionCommand({
        codeInterpreterIdentifier: this.codeInterpreterIdentifier,
        sessionTimeoutSeconds: this.sessionTimeoutSeconds,
      })
    );
    if (!response.sessionId) {
      throw new Error("AgentCore did not return a code interpreter session ID");
    }
    return {
      codeInterpreterIdentifier:
        response.codeInterpreterIdentifier ?? this.codeInterpreterIdentifier,
      sessionId: response.sessionId,
    };
  }

  protected createTools(): StructuredToolInterface[] {
    return [
      tool((input, config) => this.executeCode(input, config), {
        name: "execute_code",
        description: `Execute code in a secure AWS sandbox environment.

Use this tool for:
- Data analysis and transformation (pandas, numpy)
- Mathematical calculations and statistics
- File processing (CSV, JSON, Excel, text files)
- Generating visualizations (matplotlib, plotly, seaborn)
- Running algorithms and data pipelines

Variables and imports persist across calls within the same session.
Use clear_context=true to reset state and free memory.`,
        schema: ExecuteCodeInputSchema,
      }),
      tool((input, config) => this.executeCommand(input, config), {
        name: "execute_command",
        description: `Execute a shell command in the sandbox environment.

Use this tool for:
- Listing files and directories (ls, find)
- Checking installed packages (pip list)
- System information (python --version, which python)
- File operations (cat, head, tail, wc)
- Running scripts (python script.py, bash script.sh)`,
        schema: ExecuteCommandInputSchema,
      }),
      tool((input, config) => this.readFiles(input, config), {
        name: "read_files",
        description: `Read content of one or more files from the sandbox.

Use this tool to:
- Read data files before analysis
- Check contents of generated files
- Verify file modifications`,
        schema: ReadFilesInputSchema,
      }),
      tool((input, config) => this.listFiles(input, config), {
        name: "list_files",
        description: `List files and directories in the sandbox.

Use this tool to:
- See what files are available
- Check output directories
- Explore the sandbox structure`,
        schema: ListFilesInputSchema,
      }),
      tool((input, config) => this.deleteFiles(input, config), {
        name: "delete_files",
        description: `Delete files from the sandbox environment.

Use this tool to:
- Clean up temporary files
- Remove old outputs
- Free disk space`,
        schema: DeleteFilesInputSchema,
      }),
      tool((input, config) => this.writeFiles(input, config), {
        name: "write_files",
        description: `Write/create files in the sandbox environment.

Use this tool to:
- Save analysis results
- Create data files for processing
- Write scripts or configuration files

Paths must be relative (e.g., 'output.csv', 'scripts/analyze.py').
Absolute paths starting with '/' are not allowed.`,
        schema: WriteFilesInputSchema,
      }),
      tool((input, config) => this.uploadFile(input, config), {
        name: "upload_file",
        description: `Upload a file with optional semantic description.

This is a convenience tool for creating files with context.
The description helps track what the file contains.

Example:
- path: 'sales_data.csv'
- content: 'date,revenue\\n2024-01-01,1000'
- description: 'Daily sales with columns: date, revenue'`,
        schema: UploadFileInputSchema,
      }),
      tool((input, config) => this.installPackages(input, config), {
        name: "install_packages",
        description: `Install Python packages in the sandbox.

Use this tool before running code that requires packages not pre-installed.

Examples:
- ['pandas', 'matplotlib'] - Install multiple packages
- ['scikit-learn==1.3.0'] - Install specific version
- ['tensorflow'], upgrade=true - Upgrade if exists`,
        schema: InstallPackagesInputSchema,
      }),
      tool((input, config) => this.startCommandExecution(input, config), {
        name: "start_command_execution",
        description:
          "Start a long-running command asynchronously. Returns a task_id to check status.",
        schema: StartCommandExecutionInputSchema,
      }),
      tool((input, config) => this.getTask(input, config), {
        name: "get_task",
        description: "Check status of an async task by task_id.",
        schema: TaskInputSchema,
      }),
      tool((input, config) => this.stopTask(input, config), {
        name: "stop_task",
        description: "Stop a running async task by task_id.",
        schema: TaskInputSchema,
      }),
    ];
  }
}

/**
 * Builds the session key from the thread ID. The innermost `checkpoint_ns`
 * segment (the tool call itself) is dropped, so all tool calls of an agent
 * share a session while subagents get their own.
 *
 * - Top-level agent (ns `tools:abc`): `thread-001`
 * - Subagent (ns `sub-a:1|tools:xyz`): `thread-001:sub-a:1`
 */
function getSessionKey(config?: ToolRunnableConfig): {
  key: string;
  threadId: string;
} {
  const threadId = `${config?.configurable?.thread_id ?? "default"}`;
  const checkpointNs: string = config?.configurable?.checkpoint_ns ?? "";
  const separatorIndex = checkpointNs.lastIndexOf(CHECKPOINT_NS_SEPARATOR);
  const parentNs =
    separatorIndex === -1 ? "" : checkpointNs.slice(0, separatorIndex);
  return { key: parentNs ? `${threadId}:${parentNs}` : threadId, threadId };
}

/**
 * Whether the error means the session no longer exists. AgentCore returns a
 * `ValidationException` when invoking a stopped or expired session, a
 * `ConflictException` when stopping a stopped session, and a
 * `ResourceNotFoundException` for unknown sessions.
 */
function isSessionGoneError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  switch (error.name) {
    case "ResourceNotFoundException":
      return true;
    case "ValidationException":
      return /session .* is not active/i.test(error.message);
    case "ConflictException":
      return /session already terminated/i.test(error.message);
    default:
      return false;
  }
}

function assertRelativePath(path: string) {
  if (path.startsWith("/")) {
    throw new Error(
      `Path must be relative, not absolute. Got: ${path}. Use paths like 'data.csv' or 'scripts/analyze.py'.`
    );
  }
}

function shellQuote(value: string): string {
  if (/^[\w@%+=:,./-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

async function extractOutputFromStream(
  response: InvokeCodeInterpreterResponse
): Promise<string> {
  const output: string[] = [];
  for await (const event of response.stream ?? []) {
    if (event.result) {
      for (const block of event.result.content ?? []) {
        const text = formatContentBlock(block);
        if (text !== undefined) {
          output.push(text);
        }
      }
      // Task IDs and exit codes are only returned as structured content.
      const { taskId, taskStatus, exitCode } =
        event.result.structuredContent ?? {};
      if (taskId) {
        output.push(
          `Task ID: ${taskId}${taskStatus ? ` (status: ${taskStatus})` : ""}`
        );
      } else if (taskStatus) {
        output.push(`Task status: ${taskStatus}`);
      }
      if (exitCode !== undefined && exitCode !== 0) {
        output.push(`Exit code: ${exitCode}`);
      }
    } else {
      throw streamEventToError(event);
    }
  }
  return output.join("\n");
}

function formatContentBlock(block: ContentBlock): string | undefined {
  switch (block.type) {
    case "text":
      return block.text;
    case "resource": {
      const filePath = block.resource?.uri?.replace("file://", "") ?? "";
      if (block.resource?.text !== undefined) {
        return `==== File: ${filePath} ====\n${block.resource.text}\n`;
      }
      if (block.resource?.blob !== undefined) {
        return `==== Binary File: ${filePath} ====\n`;
      }
      return `==== File: ${filePath} ====\n`;
    }
    case "resource_link":
      return [block.name, block.description, block.mimeType, block.uri]
        .filter(Boolean)
        .join(" - ");
    case "image":
      return `==== Image${block.mimeType ? ` (${block.mimeType})` : ""} ====\n`;
    default:
      return undefined;
  }
}

function streamEventToError(event: CodeInterpreterStreamOutput): Error {
  if (event.$unknown) {
    return new Error(
      `Unknown code interpreter stream event: ${event.$unknown[0]}`
    );
  }
  const exception =
    event.accessDeniedException ??
    event.conflictException ??
    event.internalServerException ??
    event.resourceNotFoundException ??
    event.serviceQuotaExceededException ??
    event.throttlingException ??
    event.validationException;
  return exception instanceof Error
    ? exception
    : new Error("Unknown code interpreter stream error");
}
