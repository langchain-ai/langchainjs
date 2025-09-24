import type { LanguageModelLike } from "@langchain/core/language_models/base";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface ConfigurableModelInterface {
  _queuedMethodOperations: Record<string, unknown>;
  _model: () => Promise<BaseChatModel>;
}

export function isBaseChatModel(
  model: LanguageModelLike
): model is BaseChatModel {
  return (
    "invoke" in model &&
    typeof model.invoke === "function" &&
    "_modelType" in model
  );
}

export function isConfigurableModel(
  model: unknown
): model is ConfigurableModelInterface {
  return (
    typeof model === "object" &&
    model != null &&
    "_queuedMethodOperations" in model &&
    "_model" in model &&
    typeof model._model === "function"
  );
}
