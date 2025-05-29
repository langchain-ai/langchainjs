import { z } from "zod";
import { BasePinataTool } from "./base.js";
import { PinataDeleteFileSchema } from "./schema.js";

/**
 * Tool integration for Pinata: Crypto's File Storage.
 * This class allows deleting one or more files from Pinata by providing an array of file IDs.
 */
export class PinataDeleteFileTool extends BasePinataTool {
  static lc_name() {
    return "PinataDeleteFileTool";
  }

  name = "pinata-delete-file";

  description = `Deletes one or more files from your Pinata account by providing an array of file IDs.`;

  schema = PinataDeleteFileSchema;

  async _call(input: z.infer<typeof PinataDeleteFileSchema>): Promise<string> {
    const { files } = input;

    try {
      const deletedFiles = await this.pinata.files.public.delete(files);
      return JSON.stringify(deletedFiles);
    } catch (err: unknown) {
      if (err instanceof Error) {
        return `Error deleting files from Pinata: ${err.message}`;
      }
      return "Unknown error occurred during file deletion from Pinata.";
    }
  }
}
