import { StructuredToolInterface } from "@langchain/core/tools";
import type {
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

  ret.tools = options?.tools;
  // Ensure tools are formatted properly for Gemini
  const geminiTools = options?.tools
    ?.map((tool) => {
      if (
        "function" in tool &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "parameters" in (tool.function as Record<string, any>)
      ) {
        // Tool is in OpenAI format. Convert to Gemini then return.

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const castTool = tool.function as Record<string, any>;
        const cleanedParameters = castTool.parameters;
        if ("$schema" in cleanedParameters) {
          delete cleanedParameters.$schema;
        }
        if ("additionalProperties" in cleanedParameters) {
          delete cleanedParameters.additionalProperties;
        }
        const toolInGeminiFormat: GeminiTool = {
          functionDeclarations: [
            {
              name: castTool.name,
              description: castTool.description,
              parameters: cleanedParameters,
            },
          ],
        };
        return toolInGeminiFormat;
      } else if ("functionDeclarations" in tool) {
        return tool;
      } else {
        return null;
      }
    })
    .filter((tool): tool is GeminiTool => tool !== null);

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
