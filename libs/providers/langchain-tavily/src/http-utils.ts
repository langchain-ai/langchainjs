/** Preserve useful API diagnostics without exposing credentials or unbounded bodies. */
export async function tavilyHttpError(
  response: Response,
  apiKey?: string
): Promise<Error> {
  let message = response.statusText || "Unknown error";
  try {
    const body = await response.text();
    if (body.trim()) {
      try {
        const data: unknown = JSON.parse(body);
        if (typeof data === "object" && data !== null && !Array.isArray(data)) {
          const fields = data as Record<string, unknown>;
          message =
            errorText(fields.detail) ??
            errorText(fields.error) ??
            errorText(fields.message) ??
            errorText(data) ??
            message;
        } else {
          message = errorText(data) ?? message;
        }
      } catch {
        message = body;
      }
    }
  } catch {
    // Keep the HTTP status when an error response body cannot be read.
  }
  if (apiKey) message = message.split(apiKey).join("[REDACTED]");
  message = message.replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [REDACTED]");
  return new Error(`Error ${response.status}: ${message.slice(0, 2000)}`);
}

function errorText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object") {
    if (!Object.keys(value).length) return undefined;
    if (!Array.isArray(value)) {
      const fields = value as Record<string, unknown>;
      if (typeof fields.error === "string" && fields.error.trim())
        return fields.error;
      if (typeof fields.message === "string" && fields.message.trim())
        return fields.message;
    }
    return JSON.stringify(value);
  }
  return undefined;
}
