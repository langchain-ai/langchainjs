import { AnthropicBeta } from "@anthropic-ai/sdk/resources";

import {
  AnthropicInvocationParams,
  AnthropicOutputConfig,
  AnthropicThinkingConfigParam,
} from "../types.js";

type InvocationCompatibilityFields = {
  model?: string;
  thinking: AnthropicThinkingConfigParam;
  topK?: number | null;
  topP?: number | null;
  temperature?: number | null;
};

function isThinkingEnabled(thinking: AnthropicThinkingConfigParam): boolean {
  return thinking.type === "enabled" || thinking.type === "adaptive";
}

export function isOpus47Model(model?: string): boolean {
  return model?.startsWith("claude-opus-4-7") ?? false;
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
  const opus47 = isOpus47Model(model);

  if (opus47 && thinking.type === "enabled") {
    throw new Error(
      'thinking.type="enabled" is not supported for claude-opus-4-7; use thinking.type="adaptive" instead'
    );
  }
  if (
    opus47 &&
    typeof thinking === "object" &&
    thinking != null &&
    "budget_tokens" in thinking
  ) {
    throw new Error(
      "thinking.budget_tokens is not supported for claude-opus-4-7; use outputConfig.effort instead"
    );
  }
  if (opus47) {
    if (topK != null) {
      throw new Error(
        "topK is not supported for claude-opus-4-7; omit topK/topP/temperature or use model prompting instead"
      );
    }
    if (topP != null && topP !== 1) {
      throw new Error(
        "topP is not supported for claude-opus-4-7 when set to non-default values"
      );
    }
    if (temperature != null && temperature !== 1) {
      throw new Error(
        "temperature is not supported for claude-opus-4-7 when set to non-default values"
      );
    }
  }

  if (isThinkingEnabled(thinking)) {
    if (topK != null) {
      throw new Error("topK is not supported when thinking is enabled");
    }
    if (topP != null) {
      throw new Error("topP is not supported when thinking is enabled");
    }
    if (temperature != null && temperature !== 1) {
      throw new Error("temperature is not supported when thinking is enabled");
    }
  }
}

export function getSamplingParams(
  fields: InvocationCompatibilityFields
): Pick<AnthropicInvocationParams, "temperature" | "top_k" | "top_p"> {
  const { model, thinking, topK, topP, temperature } = fields;
  const output: Pick<
    AnthropicInvocationParams,
    "temperature" | "top_k" | "top_p"
  > = {};

  if (isThinkingEnabled(thinking) || isOpus47Model(model)) {
    return output;
  }

  if (temperature != null) {
    output.temperature = temperature;
  }
  if (topK != null) {
    output.top_k = topK;
  }
  if (topP != null) {
    output.top_p = topP;
  }

  return output;
}
