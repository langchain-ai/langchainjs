import { z } from "zod";
import { BasePinataTool } from "./base.js";
import { PinataUploadFileSchema } from "./schema.js";

/**
 * Tool integration for Pinata: Crypto's File Storage.
 * This class allows uploading a file to IPFS via Pinata by providing a direct URL to the file.
 */
export class PinataUploadFileTool extends BasePinataTool {
  static lc_name() {
    return "PinataUploadFileTool";
  }

  name = "pinata-upload-file";

  description = `Uploads a file to IPFS via Pinata using a publicly accessible URL. 
Input must be a direct URL to the file.`;

  schema = PinataUploadFileSchema;

  async _call(input: z.infer<typeof PinataUploadFileSchema>): Promise<string> {
    const { url, group, keyvalues, name } = input;

    try {
      let upload = this.pinata.upload.public.url(url);

      const methodMap: [string, unknown][] = [
        ["group", group],
        ["keyvalues", keyvalues],
        ["name", name],
      ];

      for (const [method, value] of methodMap) {
        if (value !== undefined) {
          // @ts-expect-error - dynamic method call with Pinata SDK
          upload = upload[method](value);
        }
      }

      const result = await upload;
      return JSON.stringify(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        return `Error uploading URL content to IPFS via Pinata: ${err.message}`;
      }
      return "Unknown error occurred during uploading URL content to IPFS via Pinata.";
    }
  }
}
