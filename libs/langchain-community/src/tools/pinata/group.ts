import { BasePinataTool } from "./base.js";
import {
  PinataCreateGroupSchema,
  PinataGetGroupSchema,
  PinataListGroupSchema,
  PinataUpdateGroupSchema,
  PinataDeleteGroupSchema,
} from "./schema.js";
import { z } from "zod";

/**
 * Tool integration for Pinata: Crypto's File Storage.
 * This class allows to create a new group in your Pinata account to organize files.
 */
export class PinataCreateGroupTool extends BasePinataTool {
  static lc_name() {
    return "PinataCreateGroupTool";
  }

  name = "pinata-create-group";
  description = "Create a new group in your Pinata account to organize files.";
  schema = PinataCreateGroupSchema;

  async _call(input: z.infer<typeof PinataCreateGroupSchema>): Promise<string> {
    try {
      const result = await this.pinata.groups.public.create(input);
      return JSON.stringify(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        return `Error creating group: ${err.message}`;
      }
      return "Error creating group: Unknown error";
    }
  }
}

/**
 * Tool integration for Pinata: Crypto's File Storage.
 * This class allows to retrieve detailed information about a specific group by its ID.
 */
export class PinataGetGroupTool extends BasePinataTool {
  static lc_name() {
    return "PinataGetGroupTool";
  }

  name = "pinata-get-group";
  description =
    "Retrieve detailed information about a specific group by its ID.";
  schema = PinataGetGroupSchema;

  async _call(input: z.infer<typeof PinataGetGroupSchema>): Promise<string> {
    try {
      const result = await this.pinata.groups.public.get(input);
      return JSON.stringify(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        return `Error retrieving group: ${err.message}`;
      }
      return "Error retrieving group: Unknown error";
    }
  }
}

/**
 * Tool integration for Pinata: Crypto's File Storage.
 * This class allows to list groups in your Pinata account, with optional filtering by name, limit, and pageToken.
 */
export class PinataListGroupTool extends BasePinataTool {
  static lc_name() {
    return "PinataListGroupTool";
  }

  name = "pinata-list-groups";
  description =
    "List groups in your Pinata account, with optional filtering by name, limit, and pageToken.";
  schema = PinataListGroupSchema;

  async _call(input: z.infer<typeof PinataListGroupSchema>): Promise<string> {
    try {
      let query = this.pinata.groups.public.list();
      const methodMap: [string, unknown][] = [
        ["name", input.name],
        ["limit", input.limit],
        ["pageToken", input.pageToken],
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
        return `Error listing groups: ${err.message}`;
      }
      return "Error listing groups: Unknown error";
    }
  }
}

/**
 * Tool integration for Pinata: Crypto's File Storage.
 * This class allows to update the name of an existing group on Pinata.
 */
export class PinataUpdateGroupTool extends BasePinataTool {
  static lc_name() {
    return "PinataUpdateGroupTool";
  }

  name = "pinata-update-group";
  description = "Update the name of an existing group on Pinata.";
  schema = PinataUpdateGroupSchema;

  async _call(input: z.infer<typeof PinataUpdateGroupSchema>): Promise<string> {
    try {
      const result = await this.pinata.groups.public.update(input);
      return JSON.stringify(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        return `Error updating group: ${err.message}`;
      }
      return "Error updating group: Unknown error";
    }
  }
}

/**
 * Tool integration for Pinata: Crypto's File Storage.
 * This class allows to delete a group from your Pinata storage by its group ID.
 */
export class PinataDeleteGroupTool extends BasePinataTool {
  static lc_name() {
    return "PinataDeleteGroupTool";
  }

  name = "pinata-delete-group";
  description = "Delete a group from your Pinata storage by its group ID.";
  schema = PinataDeleteGroupSchema;

  async _call(input: z.infer<typeof PinataDeleteGroupSchema>): Promise<string> {
    try {
      const result = await this.pinata.groups.public.delete(input);
      return JSON.stringify(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        return `Error deleting group: ${err.message}`;
      }
      return "Error deleting group: Unknown error";
    }
  }
}
