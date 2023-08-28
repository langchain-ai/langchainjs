import { z } from "zod";
import { BaseFileStore } from "../schema/index.js";
import { StructuredTool, ToolParams } from "./base.js";

/**
 * Interface for parameters required by the ReadFileTool class.
 */
interface ReadFileParams extends ToolParams {
  store: BaseFileStore;
}

/**
 * Class for reading files from the disk. Extends the StructuredTool
 * class.
 */
export class ReadFileTool extends StructuredTool {
  static lc_name() {
    return "ReadFileTool";
  }

  schema = z.object({
    file_path: z.string().describe("name of file"),
  });

  name = "read_file";

  description = "Read file from disk";

  store: BaseFileStore;

  constructor({ store }: ReadFileParams) {
    super(...arguments);

    this.store = store;
  }

  async _call({ file_path }: z.infer<typeof this.schema>) {
    return await this.store.readFile(file_path);
  }
}

/**
 * Interface for parameters required by the WriteFileTool class.
 */
interface WriteFileParams extends ToolParams {
  store: BaseFileStore;
}

/**
 * Class for writing data to files on the disk. Extends the StructuredTool
 * class.
 */
export class WriteFileTool extends StructuredTool {
  static lc_name() {
    return "WriteFileTool";
  }

  schema = z.object({
    file_path: z.string().describe("name of file"),
    text: z.string().describe("text to write to file"),
  });

  name = "write_file";

  description = "Write file from disk";

  store: BaseFileStore;

  constructor({ store, ...rest }: WriteFileParams) {
    super(rest);

    this.store = store;
  }

  async _call({ file_path, text }: z.infer<typeof this.schema>) {
    await this.store.writeFile(file_path, text);
    return "File written to successfully.";
  }
}
