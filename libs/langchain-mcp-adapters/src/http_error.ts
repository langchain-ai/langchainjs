import { z } from "zod/v3";

const httpStatusSchema = z.number().int().min(100).max(599);
const httpErrorSchema = z.object({
  status: httpStatusSchema.optional().catch(undefined),
  code: httpStatusSchema.optional().catch(undefined),
  message: z.string().optional().catch(undefined),
});

/** Read HTTP status from SDK HTTP/SSE errors, including legacy message-only errors. */
export function getHttpErrorStatus(error: unknown): number | undefined {
  const parsed = httpErrorSchema.safeParse(error);
  if (!parsed.success) return undefined;

  // SDK 2 HTTP errors use status; SSE errors use a numeric code.
  const { status, code, message } = parsed.data;
  if (status !== undefined) return status;
  if (code !== undefined) return code;

  const match = message?.match(/\(HTTP (\d{3})\)/);
  if (!match) return undefined;
  const parsedStatus = httpStatusSchema.safeParse(Number(match[1]));
  return parsedStatus.success ? parsedStatus.data : undefined;
}
