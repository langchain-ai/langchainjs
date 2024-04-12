import { StructuredToolInterface } from "@langchain/core/tools";
import type {
  GeminiFunctionSchema,
  GeminiTool,
  GoogleAIBaseLanguageModelCallOptions,
  GoogleAIModelParams,
  GoogleAIModelRequestParams,
  GoogleLLMModelFamily,
} from "../types.js";
import { isModelGemini, validateGeminiParams } from "./gemini.js";

export function copyAIModelParams(
  params: GoogleAIModelParams | undefined,
  options: GoogleAIBaseLanguageModelCallOptions | undefined
): GoogleAIModelRequestParams {
  return copyAIModelParamsInto(params, options, {});
}

interface ToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isToolWithFunction(tool: any): tool is { function: ToolFunction } {
  return "function" in tool && "parameters" in tool.function;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isToolWithFunctionDeclarations(tool: any): tool is GeminiTool {
  return "functionDeclarations" in tool;
}

function cleanParameters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: Record<string, any>
): GeminiFunctionSchema {
  const cleanedParameters = { ...parameters };
  delete cleanedParameters.$schema;
  delete cleanedParameters.additionalProperties;
  if (
    !("type" in cleanedParameters) ||
    typeof cleanedParameters.type !== "string"
  ) {
    throw new Error("Missing 'type' field in parameters");
  }
  return cleanedParameters as GeminiFunctionSchema;
}

function convertToolToGeminiFormat(tool: {
  function: ToolFunction;
}): GeminiTool {
  const { name, description, parameters } = tool.function;
  return {
    functionDeclarations: [
      {
        name,
        description,
        parameters: cleanParameters(parameters),
      },
    ],
  };
}

function updateGeminiTools(
  geminiTools: GeminiTool[],
  tool: GeminiTool
): GeminiTool[] {
  if (!geminiTools.length) {
    return [tool];
  } else {
    const firstTool = geminiTools[0];
    if (firstTool.functionDeclarations) {
      firstTool.functionDeclarations.push(...(tool.functionDeclarations ?? []));
    }
    return geminiTools;
  }
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

  ret.tools = options?.tools;
  let geminiTools: GeminiTool[] = [];
  options?.tools?.forEach((tool) => {
    if (isToolWithFunction(tool)) {
      const geminiTool = convertToolToGeminiFormat(tool);
      geminiTools = updateGeminiTools(geminiTools, geminiTool);
    } else if (isToolWithFunctionDeclarations(tool)) {
      geminiTools = updateGeminiTools(geminiTools, tool);
    }
  });

  const structuredOutputTools = options?.tools
    ?.map((tool) => {
      if ("lc_namespace" in tool) {
        return tool;
      } else {
        return null;
      }
    })
    .filter((tool): tool is StructuredToolInterface => tool !== null);

  if (
    structuredOutputTools &&
    structuredOutputTools.length > 0 &&
    geminiTools &&
    geminiTools.length > 0
  ) {
    throw new Error(
      `Cannot mix structured tools with Gemini tools.\nReceived ${structuredOutputTools.length} structured tools and ${geminiTools.length} Gemini tools.`
    );
  }
  ret.tools = geminiTools ?? structuredOutputTools;

  return ret;
}

export function modelToFamily(
  modelName: string | undefined
): GoogleLLMModelFamily {
  if (!modelName) {
    return null;
  } else if (isModelGemini(modelName)) {
    return "gemini";
  } else {
    return null;
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
