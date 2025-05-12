import { z } from "zod";
import { BasePinataTool } from "./base.js";
import { PinataQueryFileSchema } from "./schema.js";

/**
 * Tool integration for Pinata: Crypto's File Storage.
 * This class allows querying and listing files from IPFS via Pinata with optional filters.
 */
export class PinataQueryFileTool extends BasePinataTool {
  static lc_name() {
    return "PinataQueryFileTool";
  }

  name = "pinata-query-file";

  description = `Query and list files from IPFS via Pinata with optional filters (name, group, cid, mimeType, keyvalues, order, limit, and cidPending).`;

  schema = PinataQueryFileSchema;

  async _call(input: z.infer<typeof PinataQueryFileSchema>): Promise<string> {
    const { name, group, cid, mimeType, keyvalues, order, limit, cidPending } =
      input;

    try {
      let query = this.pinata.files.public.list();

      const methodMap: [string, unknown][] = [
        ["name", name],
        ["group", group],
        ["cid", cid],
        ["mimeType", mimeType],
        ["keyvalues", keyvalues],
        ["order", order],
        ["limit", limit],
        ["cidPending", cidPending],
      ];

      for (const [method, value] of methodMap) {
        if (value !== undefined) {
          // @ts-expect-error - dynamic method call with Pinata SDK
          query = query[method](value);
        }
      }

      const result = await query;
      return JSON.stringify(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        return `Error querying and listing files from IPFS via Pinata: ${err.message}`;
      }
      return "Unknown error occurred during querying and listing.";
    }
  }
}
