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
  if (tools.every(isOpenAITool)) {
    return tools.map((tool) => ({
      toolSpec: {
        name: tool.function.name,
        description: tool.function.description,
        inputSchema: {
          json: tool.function.parameters as __DocumentType,
        },
      },
    }));
  } else if (tools.every(isLangChainTool)) {
    return tools.map((tool) => ({
      toolSpec: {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          json: (isInteropZodSchema(tool.schema)
            ? toJsonSchema(tool.schema)
            : tool.schema) as __DocumentType,
        },
      },
    }));
  } else if (tools.every(isBedrockTool)) {
    return tools;
  }

  throw new Error(
    "Invalid tools passed. Must be an array of StructuredToolInterface, ToolDefinition, or BedrockTool."
  );
}

export type BedrockConverseToolChoice =
  | "any"
  | "auto"
  | string
  | BedrockToolChoice;

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
        bedrockToolChoice = {
          any: {},
        };
        break;
      case "auto":
        bedrockToolChoice = {
          auto: {},
        };
        break;
      default: {
        const foundTool = tools.find(
          (tool) => tool.toolSpec?.name === toolChoice
        );
        if (!foundTool) {
          throw new Error(
            `Tool with name ${toolChoice} not found in tools list.`
          );
        }
        bedrockToolChoice = {
          tool: {
            name: toolChoice,
          },
        };
      }
    }
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
    model.includes("claude-opus-4") ||
    model.includes("claude-sonnet-4")
  ) {
    return ["auto", "any", "tool"];
  }
  if (model.includes("mistral-large")) {
    return ["auto", "any"];
  }
  return undefined;
}
