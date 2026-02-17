import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";
import type {
  StructuredToolInterface,
  ToolRunnableConfig,
} from "@langchain/core/tools";
import { BaseToolkit } from "@langchain/core/tools";
import { CodeInterpreter } from "bedrock-agentcore/code-interpreter";
import type { CodeInterpreterConfig } from "bedrock-agentcore/code-interpreter";

export const ExecuteCodeInputSchema = z.object({
  code: z
    .string()
    .describe(
      "Python/JavaScript/TypeScript code to execute. Can include " +
        "imports, function definitions, data analysis, and visualizations. " +
        "Variables and imports persist across calls within the same session."
    ),
  language: z
    .enum(["python", "javascript", "typescript"])
    .default("python")
    .describe(
      "Programming language: 'python' (default), 'javascript', or 'typescript'"
    ),
  clear_context: z
    .boolean()
    .default(false)
    .describe(
      "If true, clears all previous variable state before execution. " +
        "Use this to start fresh or free memory."
    ),
});

export const ExecuteCommandInputSchema = z.object({
  command: z
    .string()
    .describe(
      "Shell command to execute " +
        "(e.g., 'ls -la', 'pip list', 'cat file.txt'). " +
        "Runs in a bash shell environment."
    ),
});

export const ReadFilesInputSchema = z.object({
  paths: z
    .array(z.string())
    .describe(
      "List of file paths to read " +
        "(e.g., ['data.csv', 'results/output.json'])"
    ),
});

export const WriteFilesInputSchema = z.object({
  files: z
    .array(
      z.object({
        path: z.string().describe("Relative file path"),
        content: z.string().describe("File content as string"),
      })
    )
    .describe(
      "List of files to write. Each object must have 'path' (relative path " +
        "like 'data.csv' or 'scripts/analyze.py') and 'content' (file content). " +
        "Cannot use absolute paths starting with '/'."
    ),
});

export const ListFilesInputSchema = z.object({
  directory_path: z
    .string()
    .default("")
    .describe(
      "Directory path to list. Empty string or '.' for current directory."
    ),
});

export const DeleteFilesInputSchema = z.object({
  paths: z
    .array(z.string())
    .describe("List of file paths to delete"),
});

export const UploadFileInputSchema = z.object({
  path: z
    .string()
    .describe(
      "Relative path where file should be saved " +
        "(e.g., 'data.csv', 'scripts/analyze.py')"
    ),
  content: z.string().describe("File content as string"),
  description: z
    .string()
    .default("")
    .describe(
      "Optional semantic description of the file contents to help " +
        "understand the data structure " +
        "(e.g., 'CSV with columns: date, revenue, product_id')"
    ),
});

export const InstallPackagesInputSchema = z.object({
  packages: z
    .array(z.string())
    .describe(
      "List of Python packages to install. Can include version " +
        "specifiers (e.g., ['pandas>=2.0', 'numpy', 'scikit-learn==1.3.0'])"
    ),
  upgrade: z
    .boolean()
    .default(false)
    .describe("If true, upgrades packages if already installed"),
});

export type ExecuteCodeInput = z.infer<typeof ExecuteCodeInputSchema>;
export type ExecuteCommandInput = z.infer<typeof ExecuteCommandInputSchema>;
export type ReadFilesInput = z.infer<typeof ReadFilesInputSchema>;
export type WriteFilesInput = z.infer<typeof WriteFilesInputSchema>;
export type ListFilesInput = z.infer<typeof ListFilesInputSchema>;
export type DeleteFilesInput = z.infer<typeof DeleteFilesInputSchema>;
export type UploadFileInput = z.infer<typeof UploadFileInputSchema>;
export type InstallPackagesInput = z.infer<typeof InstallPackagesInputSchema>;

/**
 * Extract thread_id from a RunnableConfig's configurable field.
 * Falls back to "default" when not provided.
 */
function getThreadId(config?: ToolRunnableConfig): string {
  if (
    config &&
    typeof config === "object" &&
    config.configurable &&
    typeof config.configurable === "object" &&
    "thread_id" in config.configurable
  ) {
    return config.configurable.thread_id as string;
  }
  return "default";
}

/**
 * Toolkit for working with AWS Bedrock code interpreter environment.
 *
 * Provides a set of LangChain tools for working with a remote code
 * interpreter environment:
 *
 * - **execute_code** – Run code in various languages (primarily Python)
 * - **execute_command** – Run shell commands
 * - **read_files** – Read content of files in the environment
 * - **list_files** – List files in directories
 * - **delete_files** – Remove files from the environment
 * - **write_files** – Create or update files
 * - **upload_file** – Upload files with semantic descriptions
 * - **install_packages** – Install Python packages
 *
 * The toolkit lazily initialises the code interpreter session on first use.
 * It supports multiple threads by maintaining separate code interpreter
 * sessions for each `thread_id` found in the LangChain `RunnableConfig`.
 *
 * @example
 * ```typescript
 * import { createCodeInterpreterToolkit } from "@langchain/aws";
 *
 * const toolkit = await createCodeInterpreterToolkit({ region: "us-west-2" });
 * const tools = toolkit.getTools();
 *
 * // Use tools with an agent
 * // const agent = createReactAgent({ llm: model, tools });
 *
 * // Cleanup when done
 * await toolkit.cleanup();
 * ```
 */
export class CodeInterpreterToolkit extends BaseToolkit {
  tools: StructuredToolInterface[] = [];

  readonly region: string;

  private _codeInterpreters: Map<string, CodeInterpreter> = new Map();

  private _config: CodeInterpreterConfig;

  constructor(config: CodeInterpreterConfig = {}) {
    super();
    this.region = config.region ?? "us-west-2";
    this._config = config;
  }

  getToolsByName(): Record<string, StructuredToolInterface> {
    return Object.fromEntries(this.tools.map((t) => [t.name, t]));
  }

  /**
   * Get or create a `CodeInterpreter` for the given runnable config.
   *
   * The config is inspected for `configurable.thread_id`.
   * If no thread_id is present, the session is stored under `"default"`.
   */
  private async _getOrCreateInterpreter(
    config?: ToolRunnableConfig
  ): Promise<CodeInterpreter> {
    const threadId = getThreadId(config);

    const existing = this._codeInterpreters.get(threadId);
    if (existing) {
      return existing;
    }

    const interpreter = new CodeInterpreter(this._config);
    await interpreter.startSession();

    this._codeInterpreters.set(threadId, interpreter);
    return interpreter;
  }

  /**
   * Initialise the toolkit and build the tool list.
   *
   * This is idempotent – calling it multiple times returns the same tools.
   */
  async setup(): Promise<StructuredToolInterface[]> {
    if (this.tools.length > 0) {
      return this.tools;
    }

    this.tools = this._createTools();
    return this.tools;
  }

  /**
   * Clean up code interpreter resources.
   *
   * @param threadId - Optional thread ID to clean up.
   *   If omitted, cleans up all sessions.
   */
  async cleanup(threadId?: string): Promise<void> {
    if (threadId) {
      const interpreter = this._codeInterpreters.get(threadId);
      if (interpreter) {
        try {
          await interpreter.stopSession();
        } catch {
          // Gracefully ignore stop errors
        }
        this._codeInterpreters.delete(threadId);
      }
    } else {
      const stopPromises = Array.from(this._codeInterpreters.values()).map(
        async (interp) => {
          try {
            await interp.stopSession();
          } catch {
            // Gracefully ignore stop errors
          }
        }
      );
      await Promise.all(stopPromises);
      this._codeInterpreters.clear();
    }
  }

  private async _executeCode(
    input: ExecuteCodeInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    const interpreter = await this._getOrCreateInterpreter(config);
    return interpreter.executeCode({
      code: input.code,
      language: input.language,
      clearContext: input.clear_context,
    });
  }

  private async _executeCommand(
    input: ExecuteCommandInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    const interpreter = await this._getOrCreateInterpreter(config);
    return interpreter.executeCommand({ command: input.command });
  }

  // The file-system methods below are intentionally public so they can be
  // called programmatically for context management (e.g. pre-loading data
  // files or reading results outside of the agent tool loop).

  async readFiles(
    input: ReadFilesInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    const interpreter = await this._getOrCreateInterpreter(config);
    return interpreter.readFiles({ paths: input.paths });
  }

  async listFiles(
    input: ListFilesInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    const interpreter = await this._getOrCreateInterpreter(config);
    return interpreter.listFiles({
      path: input.directory_path || undefined,
    });
  }

  async removeFiles(
    input: DeleteFilesInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    const interpreter = await this._getOrCreateInterpreter(config);
    return interpreter.removeFiles({ paths: input.paths });
  }

  async writeFiles(
    input: WriteFilesInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    const interpreter = await this._getOrCreateInterpreter(config);
    return interpreter.writeFiles({
      files: input.files,
    });
  }

  async uploadFile(
    input: UploadFileInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    if (input.path.startsWith("/")) {
      throw new Error(
        `Path must be relative, not absolute. Got: ${input.path}. ` +
          "Use paths like 'data.csv' or 'scripts/analyze.py'."
      );
    }

    const interpreter = await this._getOrCreateInterpreter(config);
    return interpreter.writeFiles({
      files: [
        {
          path: input.path,
          content: input.content,
        },
      ],
    });
  }

  private async _installPackages(
    input: InstallPackagesInput,
    config?: ToolRunnableConfig
  ): Promise<string> {
    if (input.packages.length === 0) {
      throw new Error("At least one package name must be provided");
    }

    const upgradeFlag = input.upgrade ? " --upgrade" : "";
    const pkgList = input.packages.join(" ");
    const command = `pip install${upgradeFlag} ${pkgList}`;

    const interpreter = await this._getOrCreateInterpreter(config);
    return interpreter.executeCommand({ command });
  }

  private _createTools(): StructuredToolInterface[] {
    const executeCodeTool = tool(
      (input, config) => this._executeCode(input, config),
      {
        name: "execute_code",
        description:
          "Execute code in a secure AWS sandbox environment.\n\n" +
          "Use this tool for:\n" +
          "- Data analysis and transformation (pandas, numpy)\n" +
          "- Mathematical calculations and statistics\n" +
          "- File processing (CSV, JSON, Excel, text files)\n" +
          "- Generating visualizations (matplotlib, plotly, seaborn)\n" +
          "- Running algorithms and data pipelines\n\n" +
          "Variables and imports persist across calls within the same session.\n" +
          "Use clear_context=true to reset state and free memory.",
        schema: ExecuteCodeInputSchema,
      }
    );

    const executeCommandTool = tool(
      (input, config) => this._executeCommand(input, config),
      {
        name: "execute_command",
        description:
          "Execute a shell command in the sandbox environment.\n\n" +
          "Use this tool for:\n" +
          "- Listing files and directories (ls, find)\n" +
          "- Checking installed packages (pip list)\n" +
          "- System information (python --version, which python)\n" +
          "- File operations (cat, head, tail, wc)\n" +
          "- Running scripts (python script.py, bash script.sh)",
        schema: ExecuteCommandInputSchema,
      }
    );

    const readFilesTool = tool(
      (input, config) => this.readFiles(input, config),
      {
        name: "read_files",
        description:
          "Read content of one or more files from the sandbox.\n\n" +
          "Use this tool to:\n" +
          "- Read data files before analysis\n" +
          "- Check contents of generated files\n" +
          "- Verify file modifications",
        schema: ReadFilesInputSchema,
      }
    );

    const listFilesTool = tool(
      (input, config) => this.listFiles(input, config),
      {
        name: "list_files",
        description:
          "List files and directories in the sandbox.\n\n" +
          "Use this tool to:\n" +
          "- See what files are available\n" +
          "- Check output directories\n" +
          "- Explore the sandbox structure",
        schema: ListFilesInputSchema,
      }
    );

    const deleteFilesTool = tool(
      (input, config) => this.removeFiles(input, config),
      {
        name: "delete_files",
        description:
          "Delete files from the sandbox environment.\n\n" +
          "Use this tool to:\n" +
          "- Clean up temporary files\n" +
          "- Remove old outputs\n" +
          "- Free disk space",
        schema: DeleteFilesInputSchema,
      }
    );

    const writeFilesTool = tool(
      (input, config) => this.writeFiles(input, config),
      {
        name: "write_files",
        description:
          "Write/create files in the sandbox environment.\n\n" +
          "Use this tool to:\n" +
          "- Save analysis results\n" +
          "- Create data files for processing\n" +
          "- Write scripts or configuration files\n\n" +
          "Paths must be relative (e.g., 'output.csv', 'scripts/analyze.py').\n" +
          "Absolute paths starting with '/' are not allowed.",
        schema: WriteFilesInputSchema,
      }
    );

    const uploadFileTool = tool(
      (input, config) => this.uploadFile(input, config),
      {
        name: "upload_file",
        description:
          "Upload a file with optional semantic description.\n\n" +
          "This is a convenience tool for creating files with context.\n" +
          "The description helps track what the file contains.\n\n" +
          "Example:\n" +
          "- path: 'sales_data.csv'\n" +
          "- content: 'date,revenue\\n2024-01-01,1000'\n" +
          "- description: 'Daily sales with columns: date, revenue'",
        schema: UploadFileInputSchema,
      }
    );

    const installPackagesTool = tool(
      (input, config) => this._installPackages(input, config),
      {
        name: "install_packages",
        description:
          "Install Python packages in the sandbox.\n\n" +
          "Use this tool before running code that requires packages not pre-installed.\n\n" +
          "Examples:\n" +
          "- ['pandas', 'matplotlib'] - Install multiple packages\n" +
          "- ['scikit-learn==1.3.0'] - Install specific version\n" +
          "- ['tensorflow'], upgrade=true - Upgrade if exists",
        schema: InstallPackagesInputSchema,
      }
    );

    return [
      executeCodeTool,
      executeCommandTool,
      readFilesTool,
      listFilesTool,
      deleteFilesTool,
      writeFilesTool,
      uploadFileTool,
      installPackagesTool,
    ];
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create and set up a {@link CodeInterpreterToolkit}.
 *
 * @param config - Configuration options for the toolkit.
 * @returns The initialised toolkit. Call `toolkit.getTools()` to retrieve the tools.
 *
 * @example
 * ```typescript
 * import { createCodeInterpreterToolkit } from "@langchain/aws";
 *
 * const toolkit = await createCodeInterpreterToolkit({
 *   region: "us-west-2",
 * });
 * const tools = toolkit.getTools();
 *
 * // Use tools with an agent …
 *
 * // Cleanup when done
 * await toolkit.cleanup();
 * ```
 */
export async function createCodeInterpreterToolkit(
  config: CodeInterpreterConfig = {}
): Promise<CodeInterpreterToolkit> {
  const toolkit = new CodeInterpreterToolkit(config);
  await toolkit.setup();
  return toolkit;
}
