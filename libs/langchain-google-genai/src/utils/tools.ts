import {
  Tool as GenerativeAITool,
  ToolConfig,
  FunctionCallingMode,
  FunctionDeclaration,
} from "@google/generative-ai";
import { ToolChoice } from "@langchain/core/language_models/chat_models";
import { StructuredToolInterface } from "@langchain/core/tools";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { convertToGenerativeAITools } from "./common.js";
import { GoogleGenerativeAIToolType } from "../types.js";

export function convertToolsToGenAI(
  tools: GoogleGenerativeAIToolType[],
  extra?: {
    toolChoice?: ToolChoice;
    allowedFunctionNames?: string[];
  }
): {
  tools: GenerativeAITool[];
  toolConfig?: ToolConfig;
} {
  const functionDeclarationTools: FunctionDeclaration[] = [];
  let genAITools: GenerativeAITool[] = [];

  tools.forEach((t) => {
    if (isLangChainTool(t)) {
      const convertedTool = convertToGenerativeAITools([
        t as StructuredToolInterface,
      ])[0];
      if (convertedTool.functionDeclarations) {
        functionDeclarationTools.push(...convertedTool.functionDeclarations);
      }
    } else {
      genAITools.push(t as GenerativeAITool);
    }
  });

  genAITools = genAITools.map((t) => {
    if ("functionDeclarations" in t) {
      return {
        functionDeclarations: [
          ...(t.functionDeclarations || []),
          ...functionDeclarationTools,
        ],
      };
    }
    return t;
  });

  let toolConfig: ToolConfig | undefined;
  if (genAITools?.length && extra?.toolChoice) {
    if (["any", "auto", "none"].some((c) => c === extra?.toolChoice)) {
      const modeMap: Record<string, FunctionCallingMode> = {
        any: FunctionCallingMode.ANY,
        auto: FunctionCallingMode.AUTO,
        none: FunctionCallingMode.NONE,
      };

      toolConfig = {
        functionCallingConfig: {
          mode:
            modeMap[extra?.toolChoice as keyof typeof modeMap] ??
            "MODE_UNSPECIFIED",
          allowedFunctionNames: extra?.allowedFunctionNames,
        },
      };
    } else if (typeof extra?.toolChoice === "string") {
      toolConfig = {
        functionCallingConfig: {
          mode: FunctionCallingMode.ANY,
          allowedFunctionNames: [
            ...(extra?.allowedFunctionNames ?? []),
            extra?.toolChoice,
          ],
        },
      };
    }

    if (!extra?.toolChoice && extra?.allowedFunctionNames) {
      toolConfig = {
        functionCallingConfig: {
          mode: FunctionCallingMode.ANY,
          allowedFunctionNames: extra?.allowedFunctionNames,
        },
      };
    }
  }

  return {
    tools: genAITools,
    toolConfig,
  };
}
