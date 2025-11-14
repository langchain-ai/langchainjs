import { CommandHandler } from "./CommandHandler.js";
import type { MemoryCommand } from "../types.js";

/**
 * Handle memory tool commands.
 * Supports: view, create, str_replace, insert, delete, rename
 */
export async function handleMemoryCommand(
  commandHandler: CommandHandler,
  args: MemoryCommand
): Promise<string> {
  switch (args.command) {
    case "view":
      return commandHandler.handleViewCommand(args.path);

    case "create":
      return commandHandler.handleCreateCommand(args.path, args.file_text);

    case "str_replace":
      return commandHandler.handleStrReplaceCommand(
        args.path,
        args.old_str,
        args.new_str
      );

    case "insert":
      return commandHandler.handleInsertCommand(
        args.path,
        args.insert_line,
        args.insert_text
      );

    case "delete":
      return commandHandler.handleDeleteCommand(args.path);

    case "rename":
      return commandHandler.handleRenameCommand(args.old_path, args.new_path);

    default:
      throw new Error(
        `Unknown command: ${(args as { command?: string }).command}`
      );
  }
}
