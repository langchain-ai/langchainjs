import type { Gemini } from "../chat_models/types.js";
import { iife } from "./misc.js";

function GoogleError<TMarker extends string>(marker: TMarker) {
  const symbol: symbol = Symbol.for(`langchain.google.error.${marker}`);

  return class extends Error {
    readonly [symbol] = true as const;

    constructor(message: string) {
      super(message);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      }
    }

    isInstance(obj: unknown): obj is this {
      return (
        typeof obj === "object" &&
        obj !== null &&
        symbol in obj &&
        obj[symbol as keyof typeof obj] === true
      );
    }
  };
}

/**
 * Error thrown when there is a configuration issue with the Google provider.
 *
 * This error is thrown when the Google provider encounters invalid configuration
 * parameters or settings that prevent it from functioning correctly.
 *
 * @example
 * ```typescript
 * try {
 *   const model = new ChatGoogle({ invalidOption: true });
 * } catch (error) {
 *   if (ConfigurationError.isInstance(error)) {
 *     console.log(`Configuration error: ${error.message}`);
 *   }
 * }
 * ```
 */
export class ConfigurationError extends GoogleError("configuration") {
  readonly name = "ConfigurationError" as const;
}

/**
 * Parameters for constructing a PromptBlockedError
 */
type PromptBlockedErrorParams = {
  /**
   * The reason why the prompt was blocked (e.g., "SAFETY", "OTHER", "UNKNOWN")
   */
  blockReason: string;
  /**
   * Optional array of safety ratings that contributed to the block decision
   */
  safetyRatings?: Gemini.SafetyRating[];
  /**
   * Optional custom error message. If not provided, a default message will be generated
   */
  message?: string;
};

/**
 * Error thrown when a prompt is blocked by Google's safety filters.
 *
 * This error is thrown when the Gemini API blocks a prompt due to safety concerns.
 * It contains information about why the prompt was blocked and the safety ratings
 * that triggered the block.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("some potentially unsafe prompt");
 * } catch (error) {
 *   if (PromptBlockedError.isInstance(error)) {
 *     console.log(`Blocked due to: ${error.blockReason}`);
 *     console.log(`Safety ratings:`, error.safetyRatings);
 *   }
 * }
 * ```
 */
export class PromptBlockedError extends GoogleError("prompt-blocked") {
  /**
   * The name of the error class.
   * @readonly
   */
  readonly name = "PromptBlockedError" as const;

  /**
   * The reason why the prompt was blocked.
   *
   * Common values include:
   * - "SAFETY" - Blocked due to safety concerns
   * - "OTHER" - Blocked for other reasons
   * - "UNKNOWN" - Reason is unknown
   *
   * @readonly
   */
  readonly blockReason: string;

  /**
   * Optional array of safety ratings that contributed to the block decision.
   *
   * Each rating contains information about different safety categories
   * (e.g., hate speech, sexually explicit content, dangerous content)
   * and their probability levels.
   *
   * @readonly
   */
  readonly safetyRatings?: Gemini.SafetyRating[];

  constructor(params: PromptBlockedErrorParams) {
    const message =
      params.message ??
      `Prompt was blocked: ${params.blockReason}.${
        params.safetyRatings && params.safetyRatings.length > 0
          ? ` Safety ratings: ${JSON.stringify(params.safetyRatings)}`
          : ""
      }`;

    super(message);
    this.blockReason = params.blockReason;
    this.safetyRatings = params.safetyRatings;
  }

  /**
   * Creates a PromptBlockedError from a Gemini API prompt feedback object.
   *
   * This is a convenience factory method for creating errors from the API response
   * when a prompt is blocked. It extracts the relevant information from the
   * promptFeedback object returned by the Gemini API.
   *
   * @param promptFeedback - The prompt feedback object from the Gemini API response
   * @returns A new PromptBlockedError instance with information from the feedback
   *
   * @example
   * ```typescript
   * const response = await geminiApi.generateContent(request);
   * if (response.promptFeedback?.blockReason) {
   *   throw PromptBlockedError.fromPromptFeedback(response.promptFeedback);
   * }
   * ```
   */
  static fromPromptFeedback(
    promptFeedback: Gemini.PromptFeedback
  ): PromptBlockedError {
    return new PromptBlockedError({
      blockReason: promptFeedback.blockReason ?? "UNKNOWN",
      safetyRatings: promptFeedback.safetyRatings,
    });
  }
}

/**
 * Parameters for constructing an AuthError
 */
type AuthErrorParams = {
  /**
   * The error message describing what went wrong
   */
  message: string;

  /**
   * The HTTP status code of the failed response.
   * Common values include 400 (Bad Request), 401 (Unauthorized),
   * 403 (Forbidden), 404 (Not Found), 429 (Too Many Requests),
   * 500 (Internal Server Error), etc.
   */
  statusCode?: number;

  /**
   * The HTTP status text of the failed response.
   * This is the human-readable status message that accompanies the status code
   * (e.g., "Bad Request", "Internal Server Error").
   */
  statusText?: string;

  /**
   * The HTTP response headers from the failed request.
   * Stored as a key-value record for easy access to header information.
   */
  headers?: Record<string, string>;

  /**
   * The response body data from the failed request.
   * This may be a parsed JSON object, a text string, or null if the body
   * could not be read. Often contains additional error details from the API.
   */
  data?: unknown;
};

/**
 * Error class for authentication failures when communicating with Google APIs.
 *
 * This error is thrown when authentication with a Google API fails, typically
 * during the OAuth token exchange process or when using service account credentials.
 * It captures detailed information about the failed authentication attempt including
 * the status code, headers, and response body to aid in debugging and error handling.
 *
 * Common authentication failure scenarios include:
 * - Invalid or expired credentials
 * - Incorrect service account configuration
 * - Missing or invalid API keys
 * - Insufficient permissions or scopes
 * - Token exchange failures
 *
 * @example
 * ```typescript
 * try {
 *   const token = await getAccessToken(credentials);
 * } catch (error) {
 *   if (AuthError.isInstance(error)) {
 *     console.error(`Auth failed with status ${error.statusCode}: ${error.message}`);
 *     console.error('Response data:', error.data);
 *   }
 * }
 * ```
 */
export class AuthError extends GoogleError("auth") {
  readonly name = "AuthError" as const;

  /**
   * The HTTP status code of the failed response.
   * Common values include 400 (Bad Request), 401 (Unauthorized),
   * 403 (Forbidden), 404 (Not Found), 429 (Too Many Requests),
   * 500 (Internal Server Error), etc.
   */
  readonly statusCode?: number;

  /**
   * The HTTP status text of the failed response.
   * This is the human-readable status message that accompanies the status code
   * (e.g., "Bad Request", "Internal Server Error").
   */
  readonly statusText?: string;

  /**
   * The HTTP response headers from the failed request.
   * Stored as a key-value record for easy access to header information.
   */
  readonly headers?: Record<string, string>;

  /**
   * The response body data from the failed request.
   * This may be a parsed JSON object, a text string, or null if the body
   * could not be read. Often contains additional error details from the API.
   */
  readonly data?: unknown;

  constructor(params: AuthErrorParams) {
    super(params.message);

    this.statusCode = params.statusCode;
    this.statusText = params.statusText;
    this.headers = params.headers;
    this.data = params.data;
  }

  /**
   * Creates an AuthError from a failed HTTP response.
   *
   * This is a convenience factory method for creating authentication errors from
   * HTTP responses. It automatically extracts the error message, status code,
   * headers, and response body from the Response object.
   *
   * The method attempts to parse the response body as JSON to extract an
   * `error_description` field if available. If JSON parsing fails or the
   * content type is not JSON, it falls back to reading the response as text.
   * If both fail, the error body will be null.
   *
   * @param response - The failed HTTP Response object from the authentication request
   * @returns A Promise that resolves to a new AuthError instance with information from the response
   *
   * @example
   * ```typescript
   * const response = await fetch(tokenUrl, {
   *   method: 'POST',
   *   body: authRequestBody
   * });
   *
   * if (!response.ok) {
   *   throw await AuthError.fromResponse(response);
   * }
   * ```
   */
  static async fromResponse(response: Response): Promise<AuthError> {
    const errorBody = await iife(async () => {
      try {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          return await response.json();
        }
        return await response.text();
      } catch {
        return null;
      }
    });

    const message =
      errorBody?.error_description ??
      `Authentication failed with status code ${response.status}`;

    const headers = iife(() => {
      const object: Record<string, string> = {};
      response.headers.forEach((value, name) => {
        object[name] = value;
      });
      return object;
    });

    return new AuthError({
      message,
      statusCode: response.status,
      statusText: response.statusText,
      headers,
      data: errorBody,
    });
  }
}

const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Parameters for constructing a RequestError
 */
type RequestErrorParams = {
  /**
   * The error message describing what went wrong
   */
  message: string;

  /**
   * The URL of the failed request.
   * This is the full URL that was being accessed when the error occurred.
   */
  url: string;

  /**
   * The HTTP status code of the failed response.
   * Common values include 400 (Bad Request), 401 (Unauthorized),
   * 403 (Forbidden), 404 (Not Found), 429 (Too Many Requests),
   * 500 (Internal Server Error), etc.
   */
  statusCode?: number;

  /**
   * The HTTP status text of the failed response.
   * This is the human-readable status message that accompanies the status code
   * (e.g., "Bad Request", "Internal Server Error").
   */
  statusText?: string;

  /**
   * The HTTP response headers from the failed request.
   * Stored as a key-value record for easy access to header information.
   */
  headers?: Record<string, string>;

  /**
   * The response body data from the failed request.
   * This may be a parsed JSON object, a text string, or null if the body
   * could not be read. Often contains additional error details from the API.
   */
  data?: unknown;
};

/**
 * Error class for HTTP request failures when communicating with Google APIs.
 *
 * This error is thrown when an HTTP request to a Google API endpoint fails.
 * It captures detailed information about the failed request including the URL,
 * status code, headers, and response body to aid in debugging and error handling.
 *
 * The error includes a `isRetryable()` method to determine if the request should
 * be retried based on the HTTP status code (e.g., 429 Too Many Requests, 503 Service Unavailable).
 *
 * @example
 * ```typescript
 * try {
 *   const response = await apiClient.fetch(request);
 *   if (!response.ok) {
 *     throw await RequestError.fromResponse(response);
 *   }
 * } catch (error) {
 *   if (RequestError.isInstance(error) && error.isRetryable()) {
 *     // Retry the request
 *   }
 * }
 * ```
 */
export class RequestError extends GoogleError("request") {
  readonly name = "RequestError" as const;

  /**
   * The URL of the failed request.
   * This is the full URL that was being accessed when the error occurred.
   */
  readonly url: string;

  /**
   * The HTTP status code of the failed response.
   * Common values include 400 (Bad Request), 401 (Unauthorized),
   * 403 (Forbidden), 404 (Not Found), 429 (Too Many Requests),
   * 500 (Internal Server Error), etc.
   */
  readonly statusCode?: number;

  /**
   * The HTTP status text of the failed response.
   * This is the human-readable status message that accompanies the status code
   * (e.g., "Bad Request", "Internal Server Error").
   */
  readonly statusText?: string;

  /**
   * The HTTP response headers from the failed request.
   * Stored as a key-value record for easy access to header information.
   */
  readonly headers?: Record<string, string>;

  /**
   * The response body data from the failed request.
   * This may be a parsed JSON object, a text string, or null if the body
   * could not be read. Often contains additional error details from the API.
   */
  readonly data?: unknown;

  constructor(params: RequestErrorParams) {
    super(params.message);

    this.url = params.url;
    this.statusCode = params.statusCode;
    this.statusText = params.statusText;
    this.headers = params.headers;
    this.data = params.data;
  }

  /**
   * Determines if this error represents a retryable request failure.
   *
   * A request is considered retryable if it failed with a status code that
   * indicates a temporary issue that might succeed on retry. This includes:
   * - 408 (Request Timeout)
   * - 429 (Too Many Requests / Rate Limiting)
   * - 500 (Internal Server Error)
   * - 502 (Bad Gateway)
   * - 503 (Service Unavailable)
   * - 504 (Gateway Timeout)
   *
   * @returns `true` if the request should be retried, `false` otherwise
   *
   * @example
   * ```typescript
   * if (RequestError.isInstance(error) && error.isRetryable()) {
   *   await sleep(1000);
   *   return retry(request);
   * }
   * ```
   */
  isRetryable(): boolean {
    if (!this.statusCode) return false;
    return RETRYABLE_STATUS_CODES.includes(this.statusCode);
  }

  /**
   * Creates a RequestError from a failed HTTP Response object.
   *
   * This is a factory method that extracts all relevant information from a
   * Response object and constructs a RequestError with appropriate details.
   * It attempts to parse the response body as JSON first, falling back to
   * text if that fails, and finally to null if the body cannot be read.
   *
   * The error message is extracted from the response body if available
   * (looking for `message` or `error` fields), otherwise a generic message
   * is constructed using the status code.
   *
   * @param response - The failed HTTP Response object to convert into an error
   * @returns A Promise that resolves to a new RequestError instance
   *
   * @example
   * ```typescript
   * const response = await fetch(url);
   * if (!response.ok) {
   *   throw await RequestError.fromResponse(response);
   * }
   * ```
   */
  static async fromResponse(response: Response): Promise<RequestError> {
    const errorBody = await iife(async () => {
      try {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          return await response.json();
        }
        return await response.text();
      } catch {
        return null;
      }
    });

    const message =
      errorBody?.error?.message ??
      errorBody?.message ??
      errorBody?.error ??
      `Request failed with status code ${response.status}`;

    const headers = iife(() => {
      const object: Record<string, string> = {};
      response.headers.forEach((value, name) => {
        object[name] = value;
      });
      return object;
    });

    return new RequestError({
      message,
      url: response.url,
      statusCode: response.status,
      statusText: response.statusText,
      headers,
      data: errorBody,
    });
  }
}

/**
 * Error thrown when the Gemini API returns no candidates in the response.
 *
 * This error is thrown when the API successfully processes a request but returns
 * an empty candidates array. This can occur when:
 * - The prompt was blocked by safety filters (but no explicit block reason was provided)
 * - An internal error occurred during generation
 * - The model was unable to generate a valid response
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("some prompt");
 * } catch (error) {
 *   if (NoCandidatesError.isInstance(error)) {
 *     console.log("No response candidates were generated");
 *   }
 * }
 * ```
 */
export class NoCandidatesError extends GoogleError("no-candidates") {
  readonly name = "NoCandidatesError" as const;

  constructor() {
    super(
      "No candidates returned from API. This may indicate the prompt was blocked or an error occurred."
    );
  }
}

/**
 * Error thrown when an invalid tool is provided to the tool converter.
 *
 * This error is thrown when a tool cannot be converted to Gemini's function
 * declaration format. Tools must be one of:
 * - LangChain structured tools (with Zod schemas)
 * - OpenAI format tools (with JSON Schema)
 * - Gemini-native function declarations
 * - Gemini-native tools (codeExecution, googleSearchRetrieval)
 *
 * @example
 * ```typescript
 * try {
 *   convertToolsToGeminiFunctionDeclarations([invalidTool]);
 * } catch (error) {
 *   if (InvalidToolError.isInstance(error)) {
 *     console.log(`Invalid tool: ${error.tool}`);
 *     console.log(`Expected formats: LangChain tools, OpenAI tools, or Gemini function declarations`);
 *   }
 * }
 * ```
 */
export class InvalidToolError extends GoogleError("invalid-tool") {
  readonly name = "InvalidToolError" as const;

  /**
   * The invalid tool that was provided.
   */
  readonly tool: unknown;

  constructor(tool: unknown, message?: string) {
    const defaultMessage = `Received invalid tool: ${JSON.stringify(
      tool
    )}. Tools must be LangChain tools, OpenAI tools, or Gemini function declarations.`;

    super(message ?? defaultMessage);
    this.tool = tool;
  }
}

/**
 * Error thrown when a ToolMessage references a tool call that cannot be found.
 *
 * This error is thrown when a ToolMessage is passed to ChatGoogle but there is no
 * corresponding AIMessage with a matching toolCallId in the conversation history.
 * This typically indicates that:
 * - The tool call ID in the ToolMessage doesn't match any previous tool calls
 * - The AIMessage containing the tool call was not included in the message history
 * - The tool call ID was incorrectly set or modified
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke([
 *     new ToolMessage({ content: "result", tool_call_id: "nonexistent-id" })
 *   ]);
 * } catch (error) {
 *   if (ToolCallNotFoundError.isInstance(error)) {
 *     console.log(`Tool call not found: ${error.toolCallId}`);
 *   }
 * }
 * ```
 */
export class ToolCallNotFoundError extends GoogleError("tool-call-not-found") {
  readonly name = "ToolCallNotFoundError" as const;

  /**
   * The tool call ID that could not be found in the conversation history.
   */
  readonly toolCallId: string;

  constructor(toolCallId: string, message?: string) {
    const defaultMessage = `Tool call with ID "${toolCallId}" not found in conversation history. Ensure the corresponding AIMessage with this tool call ID is included in the input.`;

    super(message ?? defaultMessage);
    this.toolCallId = toolCallId;
  }
}

/**
 * Parameters for constructing a MalformedOutputError
 */
type MalformedOutputErrorParams = {
  /**
   * The error message describing what went wrong during parsing
   */
  message: string;
  /**
   * Optional cause of the parsing error (e.g., the original error that occurred)
   */
  cause?: unknown;
};

/**
 * Error thrown when output parsing fails in structured output methods.
 *
 * This error is thrown when the model's response cannot be parsed according to
 * the expected schema or format. Common causes include:
 * - Invalid message type (not an AIMessage or AIMessageChunk)
 * - Missing or empty content in the response
 * - Malformed JSON that cannot be parsed
 * - Schema validation failures
 *
 * @example
 * ```typescript
 * try {
 *   const result = await model.withStructuredOutput(schema).invoke("extract data");
 * } catch (error) {
 *   if (MalformedOutputError.isInstance(error)) {
 *     console.log(`Failed to parse output: ${error.message}`);
 *     if (error.cause) {
 *       console.log(`Cause:`, error.cause);
 *     }
 *   }
 * }
 * ```
 */
export class MalformedOutputError extends GoogleError("malformed-output") {
  readonly name = "MalformedOutputError" as const;

  /**
   * Optional cause of the parsing error.
   * This may be the original error that occurred during parsing,
   * or additional context about what went wrong.
   */
  readonly cause?: unknown;

  constructor(params: MalformedOutputErrorParams) {
    super(params.message);
    this.cause = params.cause;
  }
}

/**
 * Error thrown when input provided to the Google provider is invalid.
 *
 * This error is thrown when the user provides input that cannot be
 * processed by Gemini, such as:
 * - Union types in tool/function schemas
 * - Null-only types in schemas
 * - Unsupported content block source types
 * - Missing required fields in content blocks
 *
 * @example
 * ```typescript
 * try {
 *   const result = schemaToGeminiParameters(unionTypeSchema);
 * } catch (error) {
 *   if (InvalidInputError.isInstance(error)) {
 *     console.log(`Invalid input: ${error.message}`);
 *   }
 * }
 * ```
 */
export class InvalidInputError extends GoogleError("invalid-input") {
  readonly name = "InvalidInputError" as const;
}
