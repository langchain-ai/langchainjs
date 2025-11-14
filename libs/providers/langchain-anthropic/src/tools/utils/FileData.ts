import z from "zod/v3";

/**
 * Zod schema for file data.
 */
export const FileDataSchema = z.object({
  content: z.string(),
  created_at: z.string(),
  modified_at: z.string(),
});

export type FileData = z.infer<typeof FileDataSchema>;
