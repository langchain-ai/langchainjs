import type {
  GoogleAIBaseLanguageModelCallOptions,
  GoogleAIModelParams,
  GoogleLLMModelFamily,
} from "../types.js";
import { isModelGemini, validateGeminiParams } from "./gemini.js";

export function copyAIModelParams(
  params: GoogleAIModelParams | undefined,
  options: GoogleAIBaseLanguageModelCallOptions | undefined
): GoogleAIModelParams {
  return copyAIModelParamsInto(params, options, {});
}

export function copyAIModelParamsInto(
  params: GoogleAIModelParams | undefined,
  options: GoogleAIBaseLanguageModelCallOptions | undefined,
  target: GoogleAIModelParams
): GoogleAIModelParams {
  const ret: GoogleAIModelParams = target || {};

  ret.model = options?.model ?? params?.model ?? target.model;

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

  ret.tools = options?.tools ?? params?.tools ?? target.tools;

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
  switch (modelToFamily(testParams.model)) {
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
