import type { GoogleAIModelParams, GoogleLLMModelFamily } from "../types.js";
import { isModelGemini, validateGeminiParams } from "./gemini.js";

type GoogleAIParamsWithModelName = GoogleAIModelParams & { modelName?: string };

export function copyAIModelParams(
  params: GoogleAIParamsWithModelName | undefined
): GoogleAIParamsWithModelName {
  return copyAIModelParamsInto(params, {});
}

export function copyAIModelParamsInto(
  params: GoogleAIParamsWithModelName | undefined,
  target: GoogleAIParamsWithModelName
): GoogleAIParamsWithModelName {
  const ret: GoogleAIParamsWithModelName = target || {};

  ret.model = params?.modelName ?? params?.model ?? target.model;

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
  params: GoogleAIParamsWithModelName | undefined
): void {
  const testParams: GoogleAIParamsWithModelName = params ?? {};
  const model = testParams.modelName ?? testParams.model;
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
  params: GoogleAIParamsWithModelName | undefined,
  target: GoogleAIParamsWithModelName
): GoogleAIParamsWithModelName {
  copyAIModelParamsInto(params, target);
  validateModelParams(target);
  return target;
}
