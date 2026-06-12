function extractBedrockErrorMessage(error: unknown): string | undefined {
  if (typeof error === "string") {
    return error;
  }
  if (!error || typeof error !== "object") {
    return undefined;
  }
  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }
  if ("Message" in error && typeof error.Message === "string") {
    return error.Message;
  }
  if ("errors" in error && Array.isArray(error.errors)) {
    const messages = error.errors
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (
          item &&
          typeof item === "object" &&
          "message" in item &&
          typeof item.message === "string"
        ) {
          return item.message;
        }
        return undefined;
      })
      .filter((message): message is string => typeof message === "string");
    if (messages.length > 0) {
      return messages.join("; ");
    }
  }
  return undefined;
}

export function normalizeBedrockError(error: unknown): Error {
  // oxlint-disable-next-line no-instanceof/no-instanceof
  if (error instanceof Error) {
    return error;
  }
  const message =
    extractBedrockErrorMessage(error) ??
    "An error occurred while calling Bedrock Converse.";
  return new Error(message, { cause: error });
}
