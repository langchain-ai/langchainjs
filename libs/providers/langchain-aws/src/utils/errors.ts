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

function getBedrockHttpStatusCode(error: unknown): number | undefined {
  if (
    !error ||
    typeof error !== "object" ||
    !("$metadata" in error) ||
    !error.$metadata ||
    typeof error.$metadata !== "object" ||
    !("httpStatusCode" in error.$metadata) ||
    typeof error.$metadata.httpStatusCode !== "number"
  ) {
    return undefined;
  }
  return error.$metadata.httpStatusCode;
}

function preserveBedrockErrorProperties(source: object, target: Error) {
  let keys: Array<string | symbol>;
  try {
    keys = Reflect.ownKeys(source);
  } catch {
    return;
  }
  for (const key of keys) {
    if (key === "message" || key === "cause" || key === "stack") {
      continue;
    }
    try {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (descriptor) {
        Object.defineProperty(target, key, descriptor);
      }
    } catch {
      // Ignore properties that cannot be read or defined safely.
    }
  }
}

function attachBedrockHttpStatus(error: Error, source: unknown) {
  const status = getBedrockHttpStatusCode(source);
  if (status === undefined || status === 429 || "status" in error) {
    return;
  }
  try {
    Object.defineProperty(error, "status", {
      configurable: true,
      enumerable: false,
      value: status,
      writable: true,
    });
  } catch {
    // Keep the original error intact if it is not extensible.
  }
}

export function normalizeBedrockError(error: unknown): Error {
  // oxlint-disable-next-line no-instanceof/no-instanceof
  if (error instanceof Error) {
    attachBedrockHttpStatus(error, error);
    return error;
  }
  const message =
    extractBedrockErrorMessage(error) ??
    "An error occurred while calling Bedrock Converse.";
  const normalizedError = new Error(message, { cause: error });
  if (error && typeof error === "object") {
    preserveBedrockErrorProperties(error, normalizedError);
  }
  attachBedrockHttpStatus(normalizedError, error);
  return normalizedError;
}
