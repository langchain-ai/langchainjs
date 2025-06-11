import { isOpenAITool } from "@langchain/core/language_models/base";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { isModelGemini, isModelGemma, validateGeminiParams } from "./gemini.js";
import {
  GeminiFunctionDeclaration,
  GeminiFunctionSchema,
  GeminiTool,
  GeminiToolAttributes,
  GoogleAIBaseLanguageModelCallOptions,
  GoogleAIModelParams,
  GoogleAIModelRequestParams,
  GoogleAIToolType,
  GoogleSpeakerVoiceConfig,
  GoogleSpeechConfig,
  GoogleSpeechConfigSimplified,
  GoogleSpeechSimplifiedLanguage,
  GoogleSpeechSpeakerName,
  GoogleSpeechVoice,
  GoogleSpeechVoiceLanguage,
  VertexModelFamily,
} from "../types.js";
import {
  jsonSchemaToGeminiParameters,
  schemaToGeminiParameters,
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

function isGeminiTool(tool: GoogleAIToolType): tool is GeminiTool {
  for (const toolAttribute of GeminiToolAttributes) {
    if (toolAttribute in tool) {
      return true;
    }
  }
  return false;
}

function isGeminiNonFunctionTool(tool: GoogleAIToolType): tool is GeminiTool {
  return isGeminiTool(tool) && !("functionDeclaration" in tool);
}

export function convertToGeminiTools(tools: GoogleAIToolType[]): GeminiTool[] {
  const geminiTools: GeminiTool[] = [];
  let functionDeclarationsIndex = -1;
  tools.forEach((tool) => {
    if (isGeminiNonFunctionTool(tool)) {
      geminiTools.push(tool);
    } else {
      if (functionDeclarationsIndex === -1) {
        geminiTools.push({
          functionDeclarations: [],
        });
        functionDeclarationsIndex = geminiTools.length - 1;
      }
      if (
        "functionDeclarations" in tool &&
        Array.isArray(tool.functionDeclarations)
      ) {
        const funcs: GeminiFunctionDeclaration[] = tool.functionDeclarations;
        geminiTools[functionDeclarationsIndex].functionDeclarations!.push(
          ...funcs
        );
      } else if (isLangChainTool(tool)) {
        const jsonSchema = schemaToGeminiParameters(tool.schema);
        geminiTools[functionDeclarationsIndex].functionDeclarations!.push({
          name: tool.name,
          description: tool.description ?? `A function available to call.`,
          parameters: jsonSchema as GeminiFunctionSchema,
        });
      } else if (isOpenAITool(tool)) {
        geminiTools[functionDeclarationsIndex].functionDeclarations!.push({
          name: tool.function.name,
          description:
            tool.function.description ?? `A function available to call.`,
          parameters: jsonSchemaToGeminiParameters(tool.function.parameters),
        });
      } else {
        throw new Error(`Received invalid tool: ${JSON.stringify(tool)}`);
      }
    }
  });
  return geminiTools;
}

function reasoningEffortToReasoningTokens(
  _modelName?: string,
  effort?: string
): number | undefined {
  if (effort === undefined) {
    return undefined;
  }
  const maxEffort = 24 * 1024; // Max for Gemini 2.5 Flash
  switch (effort) {
    case "low":
      return maxEffort / 3;
    case "medium":
      return (2 * maxEffort) / 3;
    case "high":
      return maxEffort;
    default:
      return undefined;
  }
}

export function normalizeSpeechConfig(
  config: GoogleSpeechConfig | GoogleSpeechConfigSimplified | undefined
): GoogleSpeechConfig | undefined {
  function isSpeechConfig(
    config: GoogleSpeechConfig | GoogleSpeechConfigSimplified
  ): config is GoogleSpeechConfig {
    return (
      typeof config === "object" &&
      (Object.hasOwn(config, "voiceConfig") ||
        Object.hasOwn(config, "multiSpeakerVoiceConfig"))
    );
  }

  function hasLanguage(
    config: GoogleSpeechConfigSimplified
  ): config is GoogleSpeechSimplifiedLanguage {
    return typeof config === "object" && Object.hasOwn(config, "languageCode");
  }

  function hasVoice(
    config: GoogleSpeechSimplifiedLanguage
  ): config is GoogleSpeechVoiceLanguage {
    return Object.hasOwn(config, "voice");
  }

  if (typeof config === "undefined") {
    return undefined;
  }

  // If this is already a GoogleSpeechConfig, just return it
  if (isSpeechConfig(config)) {
    return config;
  }

  let languageCode: string | undefined;
  let voice: GoogleSpeechVoice;
  if (hasLanguage(config)) {
    languageCode = config.languageCode;
    voice = hasVoice(config) ? config.voice : config.voices;
  } else {
    languageCode = undefined;
    voice = config;
  }

  let ret: GoogleSpeechConfig;

  if (typeof voice === "string") {
    // They just provided the prebuilt voice configuration name. Use it.
    ret = {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: voice,
        },
      },
    };
  } else {
    // This is multi-speaker, so we have speaker/name pairs
    // If we have just one (why?), turn it into an array for the moment
    const voices: GoogleSpeechSpeakerName[] = Array.isArray(voice)
      ? voice
      : [voice];
    // Go through all the speaker/name pairs and turn this into the voice config array
    const speakerVoiceConfigs: GoogleSpeakerVoiceConfig[] = voices.map(
      (v: GoogleSpeechSpeakerName): GoogleSpeakerVoiceConfig => ({
        speaker: v.speaker,
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: v.name,
          },
        },
      })
    );
    // Create the multi-speaker voice configuration
    ret = {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs,
      },
    };
  }

  if (languageCode) {
    ret.languageCode = languageCode;
  }

  return ret;
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
  ret.maxReasoningTokens =
    options?.maxReasoningTokens ??
    params?.maxReasoningTokens ??
    target?.maxReasoningTokens ??
    options?.thinkingBudget ??
    params?.thinkingBudget ??
    target?.thinkingBudget ??
    reasoningEffortToReasoningTokens(ret.modelName, params?.reasoningEffort) ??
    reasoningEffortToReasoningTokens(ret.modelName, target?.reasoningEffort) ??
    reasoningEffortToReasoningTokens(ret.modelName, options?.reasoningEffort);
  ret.topP = options?.topP ?? params?.topP ?? target.topP;
  ret.topK = options?.topK ?? params?.topK ?? target.topK;
  ret.seed = options?.seed ?? params?.seed ?? target.seed;
  ret.presencePenalty =
    options?.presencePenalty ??
    params?.presencePenalty ??
    target.presencePenalty;
  ret.frequencyPenalty =
    options?.frequencyPenalty ??
    params?.frequencyPenalty ??
    target.frequencyPenalty;
  ret.stopSequences =
    options?.stopSequences ?? params?.stopSequences ?? target.stopSequences;
  ret.safetySettings =
    options?.safetySettings ?? params?.safetySettings ?? target.safetySettings;
  ret.logprobs = options?.logprobs ?? params?.logprobs ?? target.logprobs;
  ret.topLogprobs =
    options?.topLogprobs ?? params?.topLogprobs ?? target.topLogprobs;
  ret.convertSystemMessageToHumanContent =
    options?.convertSystemMessageToHumanContent ??
    params?.convertSystemMessageToHumanContent ??
    target?.convertSystemMessageToHumanContent;
  ret.responseMimeType =
    options?.responseMimeType ??
    params?.responseMimeType ??
    target?.responseMimeType;
  ret.responseModalities =
    options?.responseModalities ??
    params?.responseModalities ??
    target?.responseModalities;
  ret.speechConfig = normalizeSpeechConfig(
    options?.speechConfig ?? params?.speechConfig ?? target?.speechConfig
  );
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

  if (options?.cachedContent) {
    ret.cachedContent = options.cachedContent;
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
  } else if (isModelGemma(modelName)) {
    return "gemma";
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
    case "gemma":
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
    case "gemma": // TODO: Are we sure?
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
