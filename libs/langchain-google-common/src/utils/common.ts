import { isOpenAITool } from "@langchain/core/language_models/base";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { isModelGemini, validateGeminiParams } from "./gemini.js";
import type {
  GeminiFunctionDeclaration,
  GeminiFunctionSchema,
  GeminiTool,
  GoogleAIBaseLanguageModelCallOptions,
  GoogleAIModelParams,
  GoogleAIModelRequestParams,
  GoogleAIToolType,
  VertexModelFamily,
} from "../types.js";
import {
  jsonSchemaToGeminiParameters,
  zodToGeminiParameters,
} from "./zod_to_gemini_parameters.js";
import { isModelClaude, validateClaudeParams } from "./anthropic.js";

export function copyAIModelParams(
  params: GoogleAIModelParams | undefined,
  options: GoogleAIBaseLanguageModelCallOptions | undefined
): GoogleAIModelRequestParams {
  return copyAIModelParamsInto(params, options, {});
}

function processToolChoice(
  toolChoice: GoogleAIBaseLanguageModelCallOptions["tool_choice"],
  allowedFunctionNames: GoogleAIBaseLanguageModelCallOptions["allowed_function_names"]
):
  | {
      tool_choice: "any" | "auto" | "none";
      allowed_function_names?: string[];
    }
  | undefined {
  if (!toolChoice) {
    if (allowedFunctionNames) {
      // Allowed func names is passed, return 'any' so it forces the model to use a tool.
      return {
        tool_choice: "any",
        allowed_function_names: allowedFunctionNames,
      };
    }
    return undefined;
  }

  if (toolChoice === "any" || toolChoice === "auto" || toolChoice === "none") {
    return {
      tool_choice: toolChoice,
      allowed_function_names: allowedFunctionNames,
    };
  }
  if (typeof toolChoice === "string") {
    // String representing the function name.
    // Return any to force the model to predict the specified function call.
    return {
      tool_choice: "any",
      allowed_function_names: [...(allowedFunctionNames ?? []), toolChoice],
    };
  }
  throw new Error("Object inputs for tool_choice not supported.");
}

export function convertToGeminiTools(tools: GoogleAIToolType[]): GeminiTool[] {
  const geminiTools: GeminiTool[] = [
    {
      functionDeclarations: [],
    },
  ];
  tools.forEach((tool) => {
    if (
      "functionDeclarations" in tool &&
      Array.isArray(tool.functionDeclarations)
    ) {
      const funcs: GeminiFunctionDeclaration[] = tool.functionDeclarations;
      geminiTools[0].functionDeclarations?.push(...funcs);
    } else if (isLangChainTool(tool)) {
      const jsonSchema = zodToGeminiParameters(tool.schema);
      geminiTools[0].functionDeclarations?.push({
        name: tool.name,
        description: tool.description ?? `A function available to call.`,
        parameters: jsonSchema as GeminiFunctionSchema,
      });
    } else if (isOpenAITool(tool)) {
      geminiTools[0].functionDeclarations?.push({
        name: tool.function.name,
        description:
          tool.function.description ?? `A function available to call.`,
        parameters: jsonSchemaToGeminiParameters(tool.function.parameters),
      });
    }
  });
  return geminiTools;
}

export function copyAIModelParamsInto(
  params: GoogleAIModelParams | undefined,
  options: GoogleAIBaseLanguageModelCallOptions | undefined,
  target: GoogleAIModelParams
): GoogleAIModelRequestParams {
  const ret: GoogleAIModelRequestParams = target || {};
  const model = options?.model ?? params?.model ?? target.model;
  ret.modelName =
    model ?? options?.modelName ?? params?.modelName ?? target.modelName;
  ret.model = model;
  ret.temperature =
    options?.temperature ?? params?.temperature ?? target.temperature;
  ret.maxOutputTokens =
    options?.maxOutputTokens ??
    params?.maxOutputTokens ??
    target.maxOutputTokens;
  ret.topP = options?.topP ?? params?.topP ?? target.topP;
  ret.topK = options?.topK ?? params?.topK ?? target.topK;
  ret.stopSequences =
    options?.stopSequences ?? params?.stopSequences ?? target.stopSequences;
  ret.safetySettings =
    options?.safetySettings ?? params?.safetySettings ?? target.safetySettings;
  ret.convertSystemMessageToHumanContent =
    options?.convertSystemMessageToHumanContent ??
    params?.convertSystemMessageToHumanContent ??
    target?.convertSystemMessageToHumanContent;
  ret.responseMimeType =
    options?.responseMimeType ??
    params?.responseMimeType ??
    target?.responseMimeType;
  ret.streaming = options?.streaming ?? params?.streaming ?? target?.streaming;
  const toolChoice = processToolChoice(
    options?.tool_choice,
    options?.allowed_function_names
  );
  if (toolChoice) {
    ret.tool_choice = toolChoice.tool_choice;
    ret.allowed_function_names = toolChoice.allowed_function_names;
  }

  const tools = options?.tools;
  if (tools) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ret.tools = convertToGeminiTools(tools as Record<string, any>[]);
  }

  return ret;
}

export function modelToFamily(
  modelName: string | undefined
): VertexModelFamily {
  if (!modelName) {
    return null;
  } else if (isModelGemini(modelName)) {
    return "gemini";
  } else if (isModelClaude(modelName)) {
    return "claude";
  } else {
    return null;
  }
}

export function modelToPublisher(modelName: string | undefined): string {
  const family = modelToFamily(modelName);
  switch (family) {
    case "gemini":
    case "palm":
      return "google";

    case "claude":
      return "anthropic";

    default:
      return "unknown";
  }
}

export function validateModelParams(
  params: GoogleAIModelParams | undefined
): void {
  const testParams: GoogleAIModelParams = params ?? {};
  const model = testParams.model ?? testParams.modelName;
  switch (modelToFamily(model)) {
    case "gemini":
      return validateGeminiParams(testParams);

    case "claude":
      return validateClaudeParams(testParams);

    default:
      throw new Error(
        `Unable to verify model params: ${JSON.stringify(params)}`
      );
  }
}

export function copyAndValidateModelParamsInto(
  params: GoogleAIModelParams | undefined,
  target: GoogleAIModelParams
): GoogleAIModelParams {
  copyAIModelParamsInto(params, undefined, target);
  validateModelParams(target);
  return target;
}
