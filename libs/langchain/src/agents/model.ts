import type { LanguageModelLike } from "@langchain/core/language_models/base";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import type { ConfigurableModel } from "../chat_models/universal.js";

export function isBaseChatModel(
  model: LanguageModelLike
): model is BaseChatModel {
  return (
    "invoke" in model &&
    typeof model.invoke === "function" &&
    "_streamResponseChunks" in model
  );
}

export function isConfigurableModel(
  model: unknown
): model is ConfigurableModel {
  return (
    typeof model === "object" &&
    model != null &&
    "_queuedMethodOperations" in model &&
    "_model" in model &&
    typeof model._model === "function"
  );
}
