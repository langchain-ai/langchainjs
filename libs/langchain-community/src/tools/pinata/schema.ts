import { z } from "zod";

/**
 * Schema for the PinataUploadFileTool.
 * Defines the structure for uploading a file to IPFS via Pinata.
 */
export const PinataUploadFileSchema = z.object({
  url: z
    .string()
    .describe(
      "A publicly accessible URL to the file you want to upload to IPFS via Pinata."
    ),
  group: z
    .string()
    .optional()
    .describe(
      "Optional group ID to associate the uploaded file with an existing group on Pinata."
    ),
  keyvalues: z
    .record(z.string())
    .optional()
    .describe(
      'Optional metadata as a JSON object with string keys and string values. Example: { "env": "prod", "version": "v1.0.0" }'
    ),
  name: z
    .string()
    .optional()
    .describe(
      "Optional custom filename for the uploaded file. If omitted, Pinata will use the default name from the URL."
    ),
});

export type PinataUploadFileSchema = z.infer<typeof PinataUploadFileSchema>;

/**
 * Schema for the PinataQueryFileTool.
 * Defines the structure for querying files on IPFS via Pinata.
 */
export const PinataQueryFileSchema = z.object({
  name: z
    .string()
    .optional()
    .describe("A specific filename to filter the query result."),
  group: z
    .string()
    .optional()
    .describe(
      "A specific group ID where the file is stored to filter the query result."
    ),
  cid: z
    .string()
    .optional()
    .describe("A specific CID of the file to filter the query result."),
  mimeType: z
    .string()
    .optional()
    .describe(
      "A specific mime type of the file to filter the query result. Example: `image/png`."
    ),
  keyvalues: z
    .record(z.string())
    .optional()
    .describe(
      'Keyvalue pairs in metadata to filter the query result. Example: { "env": "prod" }.'
    ),
  order: z
    .enum(["ASC", "DESC"])
    .optional()
    .describe("Order results either ascending or descending by created date."),
  limit: z
    .number()
    .min(1, { message: "Value must be greater than or equal to 1" })
    .optional()
    .describe(
      "A number limit of the returned query result. Should be greater than or equal to 1."
    ),
  cidPending: z
    .boolean()
    .optional()
    .describe(
      "If true, only files where CID is still pending will be returned."
    ),
});

export type PinataQueryFileSchema = z.infer<typeof PinataQueryFileSchema>;

/**
 * Schema for the PinataCreateGroupTool.
 * Defines the structure for creating a group in your Pinata account.
 */
export const PinataCreateGroupSchema = z.object({
  name: z.string().describe("Name for the new group."),
});

export type PinataCreateGroupSchema = z.infer<typeof PinataCreateGroupSchema>;

/**
 * Schema for the PinataGetGroupTool.
 * Defines the structure for retrieving a specific group by ID.
 */
export const PinataGetGroupSchema = z.object({
  groupId: z.string().describe("The ID of the group to retrieve."),
});

export type PinataGetGroupSchema = z.infer<typeof PinataGetGroupSchema>;

/**
 * Schema for the PinataListGroupTool.
 * Defines the structure for listing groups with optional filters.
 */
export const PinataListGroupSchema = z.object({
  name: z
    .string()
    .optional()
    .describe("Optional filter to match groups by name."),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of queried results to return."),
  pageToken: z
    .string()
    .optional()
    .describe("Token to paginate through groups."),
});

export type PinataListGroupSchema = z.infer<typeof PinataListGroupSchema>;

/**
 * Schema for the PinataUpdateGroupTool.
 * Defines the structure for updating a specific group.
 */
export const PinataUpdateGroupSchema = z.object({
  groupId: z.string().describe("The ID of the target group to update."),
  name: z.string().describe("The updated name of the group."),
});

export type PinataUpdateGroupSchema = z.infer<typeof PinataUpdateGroupSchema>;

/**
 * Schema for the PinataDeleteGroupTool.
 * Defines the structure for deleting a specific group.
 */
export const PinataDeleteGroupSchema = z.object({
  groupId: z.string().describe("The ID of the group to be deleted."),
});

export type PinataDeleteGroupSchema = z.infer<typeof PinataDeleteGroupSchema>;

/**
 * Schema for the PinataDeleteFileTool.
 * Defines the structure for deleting specific files from your Pinata account with file IDs.
 */
export const PinataDeleteFileSchema = z.object({
  files: z
    .array(z.string())
    .describe("An array of file IDs to delete from your Pinata account."),
});

export type PinataDeleteFileSchema = z.infer<typeof PinataDeleteFileSchema>;
