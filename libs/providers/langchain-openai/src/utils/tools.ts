import { OpenAI as OpenAIClient } from "openai";

import { ToolDefinition } from "@langchain/core/language_models/base";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";
import { DynamicTool, StructuredToolInterface } from "@langchain/core/tools";
import { isInteropZodSchema } from "@langchain/core/utils/types";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { ToolCall } from "@langchain/core/messages/tool";

type OpenAIFunction = OpenAIClient.Chat.ChatCompletionCreateParams.Function;

// Types representing the OpenAI function definitions. While the OpenAI client library
// does have types for function definitions, the properties are just Record<string, unknown>,
// which isn't very useful for type checking this formatting code.
export interface FunctionDef extends Omit<OpenAIFunction, "parameters"> {
  name: string;
  description?: string;
  parameters: ObjectProp;
}

interface ObjectProp {
  type: "object";
  properties?: {
    [key: string]: Prop;
  };
  required?: string[];
}

interface AnyOfProp {
  anyOf: Prop[];
}

type Prop = {
  description?: string;
} & (
  | AnyOfProp
  | ObjectProp
  | {
      type: "string";
      enum?: string[];
    }
  | {
      type: "number" | "integer";
      minimum?: number;
      maximum?: number;
      enum?: number[];
    }
  | { type: "boolean" }
  | { type: "null" }
  | {
      type: "array";
      items?: Prop;
    }
);

function isAnyOfProp(prop: Prop): prop is AnyOfProp {
  return (
    (prop as AnyOfProp).anyOf !== undefined &&
    Array.isArray((prop as AnyOfProp).anyOf)
  );
}

// When OpenAI use functions in the prompt, they format them as TypeScript definitions rather than OpenAPI JSON schemas.
// This function converts the JSON schemas into TypeScript definitions.
export function formatFunctionDefinitions(functions: FunctionDef[]) {
  const lines = ["namespace functions {", ""];
  for (const f of functions) {
    if (f.description) {
      lines.push(`// ${f.description}`);
    }
    if (Object.keys(f.parameters.properties ?? {}).length > 0) {
      lines.push(`type ${f.name} = (_: {`);
      lines.push(formatObjectProperties(f.parameters, 0));
      lines.push("}) => any;");
    } else {
      lines.push(`type ${f.name} = () => any;`);
    }
    lines.push("");
  }
  lines.push("} // namespace functions");
  return lines.join("\n");
}

// Format just the properties of an object (not including the surrounding braces)
function formatObjectProperties(obj: ObjectProp, indent: number): string {
  const lines: string[] = [];
  for (const [name, param] of Object.entries(obj.properties ?? {})) {
    if (param.description && indent < 2) {
      lines.push(`// ${param.description}`);
    }
    if (obj.required?.includes(name)) {
      lines.push(`${name}: ${formatType(param, indent)},`);
    } else {
      lines.push(`${name}?: ${formatType(param, indent)},`);
    }
  }
  return lines.map((line) => " ".repeat(indent) + line).join("\n");
}

// Format a single property type
function formatType(param: Prop, indent: number): string {
  if (isAnyOfProp(param)) {
    return param.anyOf.map((v) => formatType(v, indent)).join(" | ");
  }
  switch (param.type) {
    case "string":
      if (param.enum) {
        return param.enum.map((v) => `"${v}"`).join(" | ");
      }
      return "string";
    case "number":
      if (param.enum) {
        return param.enum.map((v) => `${v}`).join(" | ");
      }
      return "number";
    case "integer":
      if (param.enum) {
        return param.enum.map((v) => `${v}`).join(" | ");
      }
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "object":
      return ["{", formatObjectProperties(param, indent + 2), "}"].join("\n");
    case "array":
      if (param.items) {
        return `${formatType(param.items, indent)}[]`;
      }
      return "any[]";
    default:
      return "";
  }
}

export function formatToOpenAIAssistantTool(
  tool: StructuredToolInterface
): ToolDefinition {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: isInteropZodSchema(tool.schema)
        ? toJsonSchema(tool.schema)
        : tool.schema,
    },
  };
}

export type OpenAIToolChoice =
  | OpenAIClient.ChatCompletionToolChoiceOption
  | "any"
  | string;

export type ResponsesToolChoice = NonNullable<
  OpenAIClient.Responses.ResponseCreateParams["tool_choice"]
>;

export type ChatOpenAIToolType =
  | BindToolsInput
  | OpenAIClient.Chat.ChatCompletionTool
  | ResponsesTool;

export type ResponsesTool = NonNullable<
  OpenAIClient.Responses.ResponseCreateParams["tools"]
>[number];

export function isBuiltInTool(tool: ChatOpenAIToolType): tool is ResponsesTool {
  return "type" in tool && tool.type !== "function";
}

export function isBuiltInToolChoice(
  tool_choice: OpenAIToolChoice | ResponsesToolChoice | undefined
): tool_choice is ResponsesToolChoice {
  return (
    tool_choice != null &&
    typeof tool_choice === "object" &&
    "type" in tool_choice &&
    tool_choice.type !== "function"
  );
}

export type CustomToolCall = ToolCall & {
  call_id: string;
  isCustomTool: true;
};

type LangchainCustomTool = DynamicTool<string> & {
  metadata: {
    customTool: OpenAIClient.Responses.CustomTool;
  };
};

export function isCustomTool(tool: unknown): tool is LangchainCustomTool {
  return (
    typeof tool === "object" &&
    tool !== null &&
    "metadata" in tool &&
    typeof tool.metadata === "object" &&
    tool.metadata !== null &&
    "customTool" in tool.metadata &&
    typeof tool.metadata.customTool === "object" &&
    tool.metadata.customTool !== null
  );
}

export function isOpenAICustomTool(
  tool: ChatOpenAIToolType
): tool is OpenAIClient.Chat.ChatCompletionCustomTool {
  return (
    "type" in tool &&
    tool.type === "custom" &&
    "custom" in tool &&
    typeof tool.custom === "object" &&
    tool.custom !== null
  );
}

export function parseCustomToolCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawToolCall: Record<string, any>
): CustomToolCall | undefined {
  if (rawToolCall.type !== "custom_tool_call") {
    return undefined;
  }
  return {
    ...rawToolCall,
    type: "tool_call",
    call_id: rawToolCall.id,
    id: rawToolCall.call_id,
    name: rawToolCall.name,
    isCustomTool: true,
    args: {
      input: rawToolCall.input,
    },
  };
}

export function isCustomToolCall(
  toolCall: ToolCall
): toolCall is CustomToolCall {
  return (
    toolCall.type === "tool_call" &&
    "isCustomTool" in toolCall &&
    toolCall.isCustomTool === true
  );
}
