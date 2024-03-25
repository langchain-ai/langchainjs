import type { GoogleAIModelParams, GoogleLLMModelFamily } from "../types.js";
import { isModelGemini, validateGeminiParams } from "./gemini.js";

export function copyAIModelParams(
  params: GoogleAIModelParams | undefined
): GoogleAIModelParams {
  return copyAIModelParamsInto(params, {});
}

export function copyAIModelParamsInto(
  params: GoogleAIModelParams | undefined,
  target: GoogleAIModelParams
): GoogleAIModelParams {
  const ret: GoogleAIModelParams = target || {};

  ret.modelName = params?.modelName ?? target.modelName;

  ret.temperature = params?.temperature ?? target.temperature;
  ret.maxOutputTokens = params?.maxOutputTokens ?? target.maxOutputTokens;
  ret.topP = params?.topP ?? target.topP;
  ret.topK = params?.topK ?? target.topK;
  ret.stopSequences = params?.stopSequences ?? target.stopSequences;
  ret.safetySettings = params?.safetySettings ?? target.safetySettings;

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
  switch (modelToFamily(testParams.modelName)) {
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
  copyAIModelParamsInto(params, target);
  validateModelParams(target);
  return target;
}
