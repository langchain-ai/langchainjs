import { AnthropicBeta } from "@anthropic-ai/sdk/resources";

import {
  AnthropicInvocationParams,
  AnthropicOutputConfig,
  AnthropicThinkingConfigParam,
} from "../types.js";

type InvocationCompatibilityFields = {
  model?: string;
  thinking: AnthropicThinkingConfigParam;
  topK?: number;
  topP?: number;
  temperature?: number;
};

const ADAPTIVE_ONLY_MODEL_PREFIXES = [
  "claude-opus-4-7",
  "claude-opus-4-8",
  "claude-fable-5",
  "claude-mythos-5",
  "claude-mythos-preview",
] as const;

function modelStartsWithAnyPrefix(
  model: string | undefined,
  prefixes: readonly string[]
): boolean {
  return model ? prefixes.some((prefix) => model.startsWith(prefix)) : false;
}

function isThinkingEnabled(thinking: AnthropicThinkingConfigParam): boolean {
  return thinking.type === "enabled" || thinking.type === "adaptive";
}

export function isOpus47Model(model?: string): boolean {
  return modelStartsWithAnyPrefix(model, ["claude-opus-4-7"]);
}

export function isAdaptiveOnlyModel(model?: string): boolean {
  return modelStartsWithAnyPrefix(model, ADAPTIVE_ONLY_MODEL_PREFIXES);
}

export function getTaskBudgetBetas(
  model?: string,
  outputConfig?: AnthropicOutputConfig
): AnthropicBeta[] {
  const hasTaskBudget =
    outputConfig &&
    typeof outputConfig === "object" &&
    "task_budget" in outputConfig &&
    outputConfig.task_budget != null;

  return isOpus47Model(model) && hasTaskBudget
    ? (["task-budgets-2026-03-13"] as AnthropicBeta[])
    : [];
}

export function validateInvocationParamCompatibility(
  fields: InvocationCompatibilityFields
): void {
  const { model, thinking, topK, topP, temperature } = fields;
  const adaptiveOnlyModel = isAdaptiveOnlyModel(model);
  const modelName = model ?? "this model";

  if (adaptiveOnlyModel && thinking.type === "enabled") {
    throw new Error(
      `thinking.type="enabled" is not supported for ${modelName}; use thinking.type="adaptive" instead`
    );
  }
  if (
    adaptiveOnlyModel &&
    typeof thinking === "object" &&
    thinking != null &&
    "budget_tokens" in thinking
  ) {
    throw new Error(
      `thinking.budget_tokens is not supported for ${modelName}; use outputConfig.effort instead`
    );
  }
  if (adaptiveOnlyModel) {
    if (topK !== undefined) {
      throw new Error(
        `topK is not supported for ${modelName}; omit topK/topP/temperature or use model prompting instead`
      );
    }
    if (topP !== undefined && topP !== 1) {
      throw new Error(
        `topP is not supported for ${modelName} when set to non-default values`
      );
    }
    if (temperature !== undefined && temperature !== 1) {
      throw new Error(
        `temperature is not supported for ${modelName} when set to non-default values`
      );
    }
  }

  if (isThinkingEnabled(thinking)) {
    if (topK !== undefined) {
      throw new Error("topK is not supported when thinking is enabled");
    }
    if (topP !== undefined) {
      throw new Error("topP is not supported when thinking is enabled");
    }
    if (temperature !== undefined && temperature !== 1) {
      throw new Error("temperature is not supported when thinking is enabled");
    }
  }
}

export function resolveThinkingParam(
  model: string | undefined,
  thinking: AnthropicThinkingConfigParam
): AnthropicThinkingConfigParam | undefined {
  // Adaptive-only models (e.g. claude-fable-5, claude-mythos-5) reject
  // `thinking.type: "disabled"` — they default to adaptive mode when thinking
  // is omitted. ChatAnthropic defaults `thinking` to `{ type: "disabled" }`, so
  // without this these models 400 on every default-configured request. Drop the
  // disabled thinking param for them and let the API apply its adaptive default.
  if (isAdaptiveOnlyModel(model) && thinking.type === "disabled") {
    return undefined;
  }
  return thinking;
}

export function getSamplingParams(
  fields: InvocationCompatibilityFields
): Pick<AnthropicInvocationParams, "temperature" | "top_k" | "top_p"> {
  const { model, thinking, topK, topP, temperature } = fields;
  const output: Pick<
    AnthropicInvocationParams,
    "temperature" | "top_k" | "top_p"
  > = {};

  if (isThinkingEnabled(thinking) || isAdaptiveOnlyModel(model)) {
    return output;
  }

  if (temperature !== undefined) {
    output.temperature = temperature;
  }
  if (topK !== undefined) {
    output.top_k = topK;
  }
  if (topP !== undefined) {
    output.top_p = topP;
  }

  return output;
}
