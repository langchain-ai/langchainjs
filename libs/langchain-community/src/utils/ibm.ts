/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { z } from "zod";
import { ChatGeneration } from "@langchain/core/outputs";
import { AIMessageChunk } from "@langchain/core/messages";
import { ToolCall } from "@langchain/core/messages/tool";
import {
  InteropZodType,
  interopSafeParseAsync,
} from "@langchain/core/utils/types";
import { Gateway } from "@ibm-cloud/watsonx-ai/gateway";
import { WatsonxAuth, WatsonxInit } from "../types/ibm.js";

const createAuthenticator = ({
  watsonxAIApikey,
  watsonxAIAuthType,
  watsonxAIBearerToken,
  watsonxAIUsername,
  watsonxAIPassword,
  watsonxAIUrl,
  disableSSL,
  serviceUrl,
}: WatsonxAuth): Authenticator | undefined => {
  if (watsonxAIAuthType === "iam" && watsonxAIApikey) {
    return new IamAuthenticator({
      apikey: watsonxAIApikey,
    });
  } else if (watsonxAIAuthType === "bearertoken" && watsonxAIBearerToken) {
    return new BearerTokenAuthenticator({
      bearerToken: watsonxAIBearerToken,
    });
  } else if (watsonxAIAuthType === "cp4d") {
    // cp4d auth requires username with either Password of ApiKey but not both.
    if (watsonxAIUsername && (watsonxAIPassword || watsonxAIApikey)) {
      const watsonxCPDAuthUrl = watsonxAIUrl ?? serviceUrl;
      return new CloudPakForDataAuthenticator({
        username: watsonxAIUsername,
        password: watsonxAIPassword,
        url: watsonxCPDAuthUrl.concat("/icp4d-api/v1/authorize"),
        apikey: watsonxAIApikey,
        disableSslVerification: disableSSL,
      });
    }
  }
  return undefined;
};

export const authenticateAndSetInstance = ({
  watsonxAIApikey,
  watsonxAIAuthType,
  watsonxAIBearerToken,
  watsonxAIUsername,
  watsonxAIPassword,
  watsonxAIUrl,
  disableSSL,
  version,
  serviceUrl,
}: WatsonxAuth & Omit<WatsonxInit, "authenticator">): WatsonXAI | undefined => {
  if (watsonxAIAuthType === "iam" && watsonxAIApikey) {
    return WatsonXAI.newInstance({
      version,
      serviceUrl,
      authenticator: new IamAuthenticator({
        apikey: watsonxAIApikey,
      }),
    });
  } else if (watsonxAIAuthType === "bearertoken" && watsonxAIBearerToken) {
    return WatsonXAI.newInstance({
      version,
      serviceUrl,
      authenticator: new BearerTokenAuthenticator({
        bearerToken: watsonxAIBearerToken,
      }),
    });
  } else if (watsonxAIAuthType === "cp4d") {
    // cp4d auth requires username with either Password of ApiKey but not both.
    if (watsonxAIUsername && (watsonxAIPassword || watsonxAIApikey)) {
      const watsonxCPDAuthUrl = watsonxAIUrl ?? serviceUrl;
      return WatsonXAI.newInstance({
        version,
        serviceUrl,
        disableSslVerification: disableSSL,
        authenticator: new CloudPakForDataAuthenticator({
          username: watsonxAIUsername,
          password: watsonxAIPassword,
          url: watsonxCPDAuthUrl.concat("/icp4d-api/v1/authorize"),
          apikey: watsonxAIApikey,
          disableSslVerification: disableSSL,
        }),
      });
    }
  } else
    return WatsonXAI.newInstance({
      version,
      serviceUrl,
    });
  return undefined;
};

export function authenticateAndSetGatewayInstance({
  watsonxAIApikey,
  watsonxAIAuthType,
  watsonxAIBearerToken,
  watsonxAIUsername,
  watsonxAIPassword,
  watsonxAIUrl,
  disableSSL,
  version,
  serviceUrl,
}: WatsonxAuth & Omit<WatsonxInit, "authenticator">) {
  const authenticator = createAuthenticator({
    watsonxAIApikey,
    watsonxAIAuthType,
    watsonxAIBearerToken,
    watsonxAIUsername,
    watsonxAIPassword,
    watsonxAIUrl,
    disableSSL,
    serviceUrl,
  });

  return new Gateway({
    version,
    serviceUrl,
    authenticator,
  });
}

// Mistral enforces a specific pattern for tool call IDs
// Thanks to Mistral for implementing this, I was unable to import which is why this is copied 1:1
const TOOL_CALL_ID_PATTERN = /^[a-zA-Z0-9]{9}$/;

export function _isValidMistralToolCallId(toolCallId: string): boolean {
  return TOOL_CALL_ID_PATTERN.test(toolCallId);
}

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

function _simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

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

interface WatsonxToolsOutputParserParams<T extends Record<string, any>>
  extends JsonOutputKeyToolsParserParamsInterop<T> {}

export class WatsonxToolsOutputParser<
  T extends Record<string, any> = Record<string, any>
> extends JsonOutputToolsParser<T> {
  static lc_name() {
    return "WatsonxToolsOutputParser";
  }

  lc_namespace = ["langchain", "watsonx", "output_parsers"];

  returnId = false;

  keyName: string;

  returnSingle = false;

  zodSchema?: InteropZodType<T>;

  latestCorrect?: ToolCall;

  constructor(params: WatsonxToolsOutputParserParams<T>) {
    super(params);
    this.keyName = params.keyName;
    this.returnSingle = params.returnSingle ?? this.returnSingle;
    this.zodSchema = params.zodSchema;
  }

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
            2
          )}". Error: ${JSON.stringify(e.message)}`,
          result
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
      parsedResult
    );
    if (zodParsedResult.success) {
      return zodParsedResult.data;
    } else {
      throw new OutputParserException(
        `Failed to parse. Text: "${JSON.stringify(
          result,
          null,
          2
        )}". Error: ${JSON.stringify(zodParsedResult.error.issues)}`,
        JSON.stringify(result, null, 2)
      );
    }
  }

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
            prop.items ? jsonSchemaToZod(prop.items) : z.string()
          );
        else if (prop.type === "object") {
          zodType = jsonSchemaToZod(prop);
        } else throw new Error(`Unsupported type: ${prop.type}`);

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
  throw new Error("Unsupported root schema type");
}

export const expectOneOf = (
  params: Record<string, any>,
  keys: string[],
  exactlyOneOf = false
) => {
  const provided = keys.filter(
    (key) => key in params && params[key] !== undefined
  );
  if (exactlyOneOf && provided.length !== 1) {
    throw new Error(
      `Expected exactly one of: ${keys.join(", ")}. Got: ${provided.join(", ")}`
    );
  } else if (!exactlyOneOf && provided.length > 1) {
    throw new Error(
      `Expected one of: ${keys.join(", ")} or none. Got: ${provided.join(", ")}`
    );
  }
};

export const checkValidProps = (
  params: Record<string, any>,
  allowedKeys: string[]
) => {
  const unexpected = Object.keys(params).filter(
    (key) => !allowedKeys.includes(key)
  );
  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected properties: ${unexpected.join(
        ", "
      )}. Expected only: ${allowedKeys.join(", ")}.`
    );
  }
};
