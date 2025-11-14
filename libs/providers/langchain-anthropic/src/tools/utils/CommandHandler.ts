import { FileSystem } from "./FileSystem.js";

/**
 * Executes text editor and memory tool commands against a FileSystem.
 *
 * This class provides the command execution layer for Anthropic's text_editor and
 * memory tools, translating high-level commands (view, create, str_replace, etc.)
 * into FileSystem operations. It serves as an abstraction between the tool schemas
 * and the underlying storage implementation.
 *
 * The CommandHandler is used by both state-based (LangGraph) and filesystem-based
 * middleware implementations, enabling consistent command handling across different
 * storage backends.
 *
 * ## Supported Commands
 *
 * ### Text Editor and Memory Tools
 * - **view**: Display file contents with line numbers or list directory contents
 * - **create**: Create a new file or overwrite an existing file
 * - **str_replace**: Replace a string occurrence within a file
 * - **insert**: Insert text at a specific line number
 *
 * ### Memory Tool Only
 * - **delete**: Delete a file or directory
 * - **rename**: Rename or move a file/directory to a new path
 *
 * @example
 * ```ts
 * const fileSystem = new StateFileSystem(files, allowedPrefixes, onUpdate);
 * const handler = new CommandHandler(fileSystem);
 *
 * // View file contents
 * const contents = await handler.handleViewCommand("/path/to/file.txt");
 *
 * // Replace string in file
 * await handler.handleStrReplaceCommand(
 *   "/path/to/file.txt",
 *   "old text",
 *   "new text"
 * );
 * ```
 *
 * @see {@link FileSystem} for the underlying storage interface
 * @see {@link TextEditorCommandSchema} for text editor command schemas
 * @see {@link MemoryCommandSchema} for memory command schemas
 */
export class CommandHandler {
  /**
   * Creates a new CommandHandler instance.
   * @param fileSystem - The FileSystem implementation to execute commands against
   */
  constructor(private fileSystem: FileSystem) {}

  /**
   * Handle view command - shows file contents or directory listing.
   */
  async handleViewCommand(path: string): Promise<string> {
    const normalizedPath = this.fileSystem.validatePath(path);
    const fileData = await this.fileSystem.readFile(normalizedPath);

    if (!fileData) {
      // Try listing as directory
      const matching = await this.fileSystem.listDirectory(normalizedPath);
      // Format directory listing according to Anthropic docs
      const fileNames = matching.map((filePath) => {
        // Extract just the filename from the full path
        const parts = filePath.split("/");
        return `- ${parts[parts.length - 1]}`;
      });
      return `Directory: ${normalizedPath}\n${fileNames.join("\n")}`;
    }

    const lines = fileData.content.split("\n");
    const formattedLines = lines.map((line, i) => `${i + 1}|${line}`);
    return formattedLines.join("\n");
  }

  /**
   * Handle create command - creates or overwrites a file.
   */
  async handleCreateCommand(path: string, fileText: string): Promise<string> {
    const normalizedPath = this.fileSystem.validatePath(path);
    const existing = await this.fileSystem.readFile(normalizedPath);
    const now = new Date().toISOString();

    await this.fileSystem.writeFile(normalizedPath, {
      content: fileText,
      created_at: existing ? existing.created_at : now,
      modified_at: now,
    });

    return `File created: ${path}`;
  }

  /**
   * Handle str_replace command - replaces a string in a file.
   */
  async handleStrReplaceCommand(
    path: string,
    oldStr: string,
    newStr: string
  ): Promise<string> {
    const normalizedPath = this.fileSystem.validatePath(path);
    const fileData = await this.fileSystem.readFile(normalizedPath);
    if (!fileData) throw new Error(`File not found: ${path}`);

    if (!fileData.content.includes(oldStr)) {
      throw new Error(`String not found in file: ${oldStr}`);
    }

    const newContent = fileData.content.replace(oldStr, newStr);
    await this.fileSystem.writeFile(normalizedPath, {
      content: newContent,
      created_at: fileData.created_at,
      modified_at: new Date().toISOString(),
    });

    return `String replaced in file: ${path}`;
  }

  /**
   * Handle insert command - inserts text at a specific line.
   */
  async handleInsertCommand(
    path: string,
    insertLine: number,
    textToInsert: string
  ): Promise<string> {
    const normalizedPath = this.fileSystem.validatePath(path);
    const fileData = await this.fileSystem.readFile(normalizedPath);
    if (!fileData) throw new Error(`File not found: ${path}`);

    const lines = fileData.content.split("\n");
    const newLines = textToInsert.split("\n");
    const updatedLines = [
      ...lines.slice(0, insertLine),
      ...newLines,
      ...lines.slice(insertLine),
    ];

    await this.fileSystem.writeFile(normalizedPath, {
      content: updatedLines.join("\n"),
      created_at: fileData.created_at,
      modified_at: new Date().toISOString(),
    });

    return `Text inserted in file: ${path}`;
  }

  /**
   * Handle delete command - deletes a file or directory.
   */
  async handleDeleteCommand(path: string): Promise<string> {
    const normalizedPath = this.fileSystem.validatePath(path);
    await this.fileSystem.deleteFile(normalizedPath);
    return `File deleted: ${path}`;
  }

  /**
   * Handle rename command - renames/moves a file or directory.
   */
  async handleRenameCommand(oldPath: string, newPath: string): Promise<string> {
    const normalizedOld = this.fileSystem.validatePath(oldPath);
    const normalizedNew = this.fileSystem.validatePath(newPath);
    const fileData = await this.fileSystem.readFile(normalizedOld);
    if (!fileData) throw new Error(`File not found: ${oldPath}`);

    await this.fileSystem.renameFile(normalizedOld, normalizedNew, fileData);
    return `File renamed: ${oldPath} -> ${newPath}`;
  }
}
