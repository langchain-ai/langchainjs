/* oxlint-disable @typescript-eslint/no-explicit-any */
import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
import {
  IamAuthenticator,
  BearerTokenAuthenticator,
  CloudPakForDataAuthenticator,
  Authenticator,
} from "ibm-cloud-sdk-core";
import {
  JsonOutputKeyToolsParserParamsInterop,
  JsonOutputToolsParser,
} from "@langchain/core/output_parsers/openai_tools";
import { OutputParserException } from "@langchain/core/output_parsers";
import { z } from "zod/v3";
import { ChatGeneration } from "@langchain/core/outputs";
import { AIMessageChunk } from "@langchain/core/messages";
import { ToolCall } from "@langchain/core/messages/tool";
import {
  InteropZodType,
  interopSafeParseAsync,
} from "@langchain/core/utils/types";
import { Gateway } from "@ibm-cloud/watsonx-ai/gateway";
import {
  WatsonxAuth,
  WatsonxInit,
  WatsonxAuthenticationError,
  WatsonxValidationError,
  WatsonxUnsupportedOperationError,
} from "../types.js";
import { AWSAuthenticator } from "@ibm-cloud/watsonx-ai/authentication";

/**
 * Creates an authenticator instance based on the provided authentication configuration.
 * Supports IAM, Bearer Token, and Cloud Pak for Data authentication methods.
 *
 * @param config - Authentication configuration
 * @returns Authenticator instance or undefined if configuration is invalid
 */
const createAuthenticator = ({
  apiKey,
  authType,
  bearerToken,
  username,
  password,
  authUrl,
  disableSSL,
  serviceUrl,
}: WatsonxAuth): Authenticator | undefined => {
  switch (authType) {
    case "iam":
      if (apiKey)
        return new IamAuthenticator({
          apikey: apiKey,
        });
      throw new WatsonxAuthenticationError("ApiKey is required for IAM auth");
    case "bearertoken":
      if (bearerToken)
        return new BearerTokenAuthenticator({
          bearerToken,
        });
      throw new WatsonxAuthenticationError(
        "BearerToken is required for BearerToken auth",
      );
    case "cp4d":
      if (username && (password || apiKey)) {
        const watsonxCPDAuthUrl = authUrl ?? serviceUrl;
        return new CloudPakForDataAuthenticator({
          username,
          password,
          url: watsonxCPDAuthUrl.concat("/icp4d-api/v1/authorize"),
          apikey: apiKey,
          disableSslVerification: disableSSL,
        });
      }
      throw new WatsonxAuthenticationError(
        "Username and Password or ApiKey is required for IBM watsonx.ai software auth",
      );
    case "aws":
      return new AWSAuthenticator({
        apikey: apiKey,
        url: authUrl,
        disableSslVerification: disableSSL,
      });
    default:
      return undefined;
  }
};

/**
 * Prepares the Watsonx client configuration and attaches an authenticator
 * derived from the provided auth-related parameters when available.
 *
 * @param params - Initialization and authentication parameters for Watsonx clients
 * @returns Configuration object for Watsonx SDK client construction
 */
const prepareInstanceConfig = ({
  watsonxAIApikey,
  watsonxAIAuthType,
  watsonxAIBearerToken,
  watsonxAIUsername,
  watsonxAIPassword,
  watsonxAIUrl,
  disableSSL,
  version,
  serviceUrl,
  apiKey,
  bearerToken,
  username,
  password,
  authType,
  authUrl,
}: WatsonxAuth & Omit<WatsonxInit, "authenticator">) => {
  const isIam =
    (watsonxAIApikey || apiKey) && !watsonxAIUsername ? "iam" : undefined;
  const authenticator = createAuthenticator({
    apiKey: watsonxAIApikey ?? apiKey,
    authType: watsonxAIAuthType ?? authType ?? isIam,
    bearerToken: watsonxAIBearerToken ?? bearerToken,
    username: watsonxAIUsername ?? username,
    password: watsonxAIPassword ?? password,
    authUrl: watsonxAIUrl ?? authUrl,
    disableSSL,
    serviceUrl,
  });
  return {
    version,
    serviceUrl,
    ...(authenticator ? { authenticator } : {}),
  };
};

/**
 * Initializes and returns a WatsonX AI or Gateway instance with authentication.
 * 
 * @param params - Initialization and authentication parameters
 * @param useGateway - If true, returns Gateway instance; otherwise returns WatsonXAI instance
 * @returns Configured WatsonXAI or Gateway instance
 */
export function initWatsonxOrGatewayInstance(
  params: WatsonxAuth & Omit<WatsonxInit, "authenticator">,
  useGateway: true,
): Gateway;
export function initWatsonxOrGatewayInstance(
  params: WatsonxAuth & Omit<WatsonxInit, "authenticator">,
  useGateway?: false,
): WatsonXAI;
export function initWatsonxOrGatewayInstance(
  params: WatsonxAuth & Omit<WatsonxInit, "authenticator">,
  useGateway = false,
): WatsonXAI | Gateway {
  const config = prepareInstanceConfig(params);
  try {
    return useGateway ? new Gateway(config) : new WatsonXAI(config);
  } catch (e) {
    throw new WatsonxAuthenticationError(
      "You have not provided any type of authentication",
    );
  }
}

const TOOL_CALL_ID_PATTERN = /^[a-zA-Z0-9]{9}$/;

/**
 * Validates if a tool call ID is compatible with Mistral format.
 *
 * @param toolCallId - The tool call ID to validate
 * @returns True if the ID matches Mistral format requirements
 */
export function _isValidMistralToolCallId(toolCallId: string): boolean {
  return TOOL_CALL_ID_PATTERN.test(toolCallId);
}

/**
 * Encodes a number to base62 string representation.
 *
 * @param num - Number to encode
 * @returns Base62 encoded string
 */
function _base62Encode(num: number): string {
  let numCopy = num;
  const base62 =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (numCopy === 0) return base62[0];
  const arr: string[] = [];
  const base = base62.length;
  while (numCopy) {
    arr.push(base62[numCopy % base]);
    numCopy = Math.floor(numCopy / base);
  }
  return arr.reverse().join("");
}

/**
 * Generates a simple hash from a string.
 *
 * @param str - String to hash
 * @returns Positive integer hash value
 */
function _simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return Math.abs(hash);
}

/**
 * Converts a tool call ID to Mistral-compatible format.
 * If already valid, returns as-is. Otherwise, generates a 9-character ID from hash.
 *
 * @param toolCallId - Original tool call ID
 * @returns Mistral-compatible 9-character tool call ID
 */
export function _convertToolCallIdToMistralCompatible(
  toolCallId: string
): string {
  if (_isValidMistralToolCallId(toolCallId)) {
    return toolCallId;
  } else {
    const hash = _simpleHash(toolCallId);
    const base62Str = _base62Encode(hash);
    if (base62Str.length >= 9) {
      return base62Str.slice(0, 9);
    } else {
      return base62Str.padStart(9, "0");
    }
  }
}

/**
 * Parameters for WatsonxToolsOutputParser.
 */
interface WatsonxToolsOutputParserParams<
  T extends Record<string, any>,
> extends JsonOutputKeyToolsParserParamsInterop<T> {}

/**
 * Output parser for Watsonx tool calls.
 * Extends JsonOutputToolsParser with Watsonx-specific handling.
 */
export class WatsonxToolsOutputParser<
  T extends Record<string, any> = Record<string, any>,
> extends JsonOutputToolsParser<T> {
  /**
   * Returns the serialized LangChain name for this parser class.
   */
  static lc_name() {
    return "WatsonxToolsOutputParser";
  }

  /**
   * LangChain namespace used for serialization metadata.
   */
  lc_namespace = ["langchain", "watsonx", "output_parsers"];

  /**
   * Whether parsed tool call IDs should be returned.
   */
  returnId = false;

  /**
   * Tool name key to extract from parsed output.
   */
  keyName: string;

  /**
   * Whether only a single parsed tool result should be returned.
   */
  returnSingle = false;

  /**
   * Optional Zod schema used to validate parsed tool arguments.
   */
  zodSchema?: InteropZodType<T>;

  /**
   * Most recent valid tool call used as a fallback during partial parsing.
   */
  latestCorrect?: ToolCall;

  /**
   * Creates a Watsonx tools output parser.
   *
   * @param params - Parser configuration including key name and optional schema validation
   */
  constructor(params: WatsonxToolsOutputParserParams<T>) {
    super(params);
    this.keyName = params.keyName;
    this.returnSingle = params.returnSingle ?? this.returnSingle;
    this.zodSchema = params.zodSchema;
  }

  /**
   * Parses and optionally validates a tool result payload.
   *
   * @param result - Raw result content to validate
   * @returns Parsed and validated tool arguments
   * @throws [`OutputParserException`](libs/providers/langchain-ibm/src/utils/ibm.ts:243) if JSON parsing or schema validation fails
   */
  protected async _validateResult(result: unknown): Promise<T> {
    let parsedResult = result;
    if (typeof result === "string") {
      try {
        parsedResult = JSON.parse(result);
      } catch (e: any) {
        throw new OutputParserException(
          `Failed to parse. Text: "${JSON.stringify(
            result,
            null,
            2,
          )}". Error: ${JSON.stringify(e.message)}`,
          result,
        );
      }
    } else {
      parsedResult = result;
    }
    if (this.zodSchema === undefined) {
      return parsedResult as T;
    }
    const zodParsedResult = await interopSafeParseAsync(
      this.zodSchema,
      parsedResult,
    );
    if (zodParsedResult.success) {
      return zodParsedResult.data;
    } else {
      throw new OutputParserException(
        `Failed to parse. Text: "${JSON.stringify(
          result,
          null,
          2,
        )}". Error: ${JSON.stringify(zodParsedResult.error.issues)}`,
        JSON.stringify(result, null, 2),
      );
    }
  }

  /**
   * Extracts tool arguments from partial chat generations, falling back to the
   * latest valid tool call when current partial output is incomplete.
   *
   * @param generations - Partial chat generations to inspect
   * @returns Parsed tool arguments from the most relevant partial tool call
   */
  async parsePartialResult(generations: ChatGeneration[]): Promise<T> {
    const tools = generations.flatMap((generation) => {
      const message = generation.message as AIMessageChunk;
      if (!Array.isArray(message.tool_calls)) {
        return [];
      }
      const tool = message.tool_calls;
      return tool;
    });

    if (tools[0] === undefined) {
      if (this.latestCorrect) {
        tools.push(this.latestCorrect);
      } else {
        const toolCall: ToolCall = { name: "", args: {} };
        tools.push(toolCall);
      }
    }

    const [tool] = tools;
    tool.name = "";
    this.latestCorrect = tool;
    return tool.args as T;
  }
}

/**
 * Converts a JSON schema object to a Zod schema.
 * Supports string, number, integer, float, boolean, array, and object types.
 *
 * @param obj - JSON schema object to convert
 * @returns Zod schema object
 * @throws Error if schema type is unsupported
 */
export function jsonSchemaToZod(obj: WatsonXAI.JsonObject | undefined) {
  if (obj?.properties && obj.type === "object") {
    const shape: Record<string, any> = {};

    Object.keys(obj.properties).forEach((key) => {
      if (obj.properties) {
        const prop = obj.properties[key];

        let zodType;
        if (prop.type === "string") {
          zodType = z.string();
          if (prop?.pattern) {
            zodType = zodType.regex(prop.pattern, "Invalid pattern");
          }
        } else if (
          prop.type === "number" ||
          prop.type === "integer" ||
          prop.type === "float"
        ) {
          zodType = z.number();
          if (typeof prop?.minimum === "number") {
            zodType = zodType.min(prop.minimum, {
              message: `${key} must be at least ${prop.minimum}`,
            });
          }
          if (prop?.maximum)
            zodType = zodType.lte(prop.maximum, {
              message: `${key} must be maximum of ${prop.maximum}`,
            });
        } else if (prop.type === "boolean") zodType = z.boolean();
        else if (prop.type === "array")
          zodType = z.array(
            prop.items ? jsonSchemaToZod(prop.items) : z.string(),
          );
        else if (prop.type === "object") {
          zodType = jsonSchemaToZod(prop);
        } else
          throw new WatsonxUnsupportedOperationError(
            `Unsupported type: ${prop.type}`,
          );

        if (prop.description) {
          zodType = zodType.describe(prop.description);
        }

        if (!obj.required?.includes(key)) {
          zodType = zodType.optional();
        }

        shape[key] = zodType;
      }
    });
    return z.object(shape);
  }
  throw new WatsonxUnsupportedOperationError("Unsupported root schema type");
}

/**
 * Validates that exactly one or at most one of the specified keys is present in params.
 *
 * @param params - Object to validate
 * @param keys - Array of key names to check
 * @param exactlyOneOf - If true, requires exactly one key; if false, allows zero or one
 * @throws Error if validation fails
 */
export const expectOneOf = (
  params: Record<string, any>,
  keys: string[],
  exactlyOneOf = false
) => {
  const provided = keys.filter(
    (key) => key in params && params[key] !== undefined
  );
  if (exactlyOneOf && provided.length !== 1) {
    throw new WatsonxValidationError(
      `Expected exactly one of: ${keys.join(", ")}. Got: ${provided.join(", ")}`,
    );
  } else if (!exactlyOneOf && provided.length > 1) {
    throw new WatsonxValidationError(
      `Expected one of: ${keys.join(", ")} or none. Got: ${provided.join(", ")}`,
    );
  }
};

/**
 * Validates that an object only contains allowed properties.
 *
 * @param params - Object to validate
 * @param allowedKeys - Array of allowed property names
 * @throws Error if unexpected properties are found
 */
export const checkValidProps = (
  params: Record<string, any>,
  allowedKeys: string[]
) => {
  const unexpected = Object.keys(params).filter(
    (key) => !allowedKeys.includes(key)
  );
  if (unexpected.length > 0) {
    throw new WatsonxValidationError(
      `Unexpected properties: ${unexpected.join(
        ", ",
      )}. Expected only: ${allowedKeys.join(", ")}.`,
    );
  }
};

