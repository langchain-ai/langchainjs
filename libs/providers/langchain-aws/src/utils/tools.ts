import { isOpenAITool } from "@langchain/core/language_models/base";
import type { Tool as BedrockTool } from "@aws-sdk/client-bedrock-runtime";
import type { DocumentType as __DocumentType } from "@smithy/types";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { isInteropZodSchema } from "@langchain/core/utils/types";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { ChatBedrockConverseToolType, BedrockToolChoice } from "../types.js";

export function isBedrockTool(tool: unknown): tool is BedrockTool {
  if (typeof tool === "object" && tool && "toolSpec" in tool) {
    return true;
  }
  return false;
}

export function convertToConverseTools(
  tools: ChatBedrockConverseToolType[]
): BedrockTool[] {
  return tools.map((tool, index) => {
    if (isOpenAITool(tool)) {
      return {
        toolSpec: {
          name: tool.function.name,
          description: tool.function.description,
          inputSchema: {
            json: tool.function.parameters as __DocumentType,
          },
        },
      };
    } else if (isLangChainTool(tool)) {
      return {
        toolSpec: {
          name: tool.name,
          description: tool.description,
          inputSchema: {
            json: (isInteropZodSchema(tool.schema)
              ? toJsonSchema(tool.schema)
              : tool.schema) as __DocumentType,
          },
        },
      };
    } else if (isBedrockTool(tool)) {
      return tool;
    }

    const toolInfo =
      typeof tool === "object" && tool !== null
        ? `Tool at index ${index}: ${JSON.stringify(tool, null, 2)}`
        : `Tool at index ${index}: ${String(tool)}`;
    throw new Error(
      `Invalid tool passed at index ${index}. Must be a StructuredToolInterface, ToolDefinition, or BedrockTool. ${toolInfo}`
    );
  });
}

/**
 * OpenAI-style tool choice that forces a call to one named function, as used
 * by `createAgent` middleware.
 */
type FunctionToolChoice = {
  type: "function";
  function: { name: string };
};

export type BedrockConverseToolChoice =
  | "any"
  | "auto"
  | "required"
  | string
  | FunctionToolChoice
  | BedrockToolChoice;

function isFunctionToolChoice(
  toolChoice: BedrockConverseToolChoice
): toolChoice is FunctionToolChoice {
  return (
    typeof toolChoice === "object" &&
    "type" in toolChoice &&
    toolChoice.type === "function"
  );
}

function toNamedBedrockToolChoice(
  name: string,
  tools: BedrockTool[]
): BedrockToolChoice {
  const foundTool = tools.find((tool) => tool.toolSpec?.name === name);
  if (!foundTool) {
    throw new Error(`Tool with name ${name} not found in tools list.`);
  }
  return {
    tool: {
      name,
    },
  };
}

export function convertToBedrockToolChoice(
  toolChoice: BedrockConverseToolChoice,
  tools: BedrockTool[],
  fields: {
    model: string;
    supportsToolChoiceValues?: Array<"auto" | "any" | "tool">;
  }
): BedrockToolChoice {
  const supportsToolChoiceValues = fields.supportsToolChoiceValues ?? [];

  let bedrockToolChoice: BedrockToolChoice;
  if (typeof toolChoice === "string") {
    switch (toolChoice) {
      case "any":
      case "required":
        bedrockToolChoice = {
          any: {},
        };
        break;
      case "auto":
        bedrockToolChoice = {
          auto: {},
        };
        break;
      default:
        bedrockToolChoice = toNamedBedrockToolChoice(toolChoice, tools);
    }
  } else if (isFunctionToolChoice(toolChoice)) {
    bedrockToolChoice = toNamedBedrockToolChoice(
      toolChoice.function.name,
      tools
    );
  } else {
    bedrockToolChoice = toolChoice;
  }

  const toolChoiceType = Object.keys(bedrockToolChoice)[0] as
    | "auto"
    | "any"
    | "tool";
  if (!supportsToolChoiceValues.includes(toolChoiceType)) {
    let supportedTxt = "";
    if (supportsToolChoiceValues.length) {
      supportedTxt =
        `Model ${fields.model} does not currently support 'tool_choice' ` +
        `of type ${toolChoiceType}. The following 'tool_choice' types ` +
        `are supported: ${supportsToolChoiceValues.join(", ")}.`;
    } else {
      supportedTxt = `Model ${fields.model} does not currently support 'tool_choice'.`;
    }

    throw new Error(
      `${supportedTxt} Please see` +
        "https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolChoice.html" +
        "for the latest documentation on models that support tool choice."
    );
  }

  return bedrockToolChoice;
}

export function supportedToolChoiceValuesForModel(
  model: string
): Array<"auto" | "any" | "tool"> | undefined {
  if (
    model.includes("claude-3") ||
    model.includes("claude-4") ||
    model.includes("claude-haiku-4") ||
    model.includes("claude-opus-4") ||
    model.includes("claude-sonnet-4") ||
    model.includes("claude-haiku-5") ||
    model.includes("claude-opus-5") ||
    model.includes("claude-sonnet-5")
  ) {
    return ["auto", "any", "tool"];
  }
  if (model.includes("mistral-large")) {
    return ["auto", "any"];
  }
  return undefined;
}
