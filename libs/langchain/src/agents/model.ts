import type {
  BaseLanguageModelInput,
  LanguageModelOutput,
} from "@langchain/core/language_models/base";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { RunnableInterface } from "@langchain/core/runnables";

export type AgentLanguageModelLike = RunnableInterface<
  BaseLanguageModelInput,
  LanguageModelOutput
>;

export interface ConfigurableModelInterface {
  _queuedMethodOperations: Record<string, unknown>;
  _getModelInstance: () => Promise<BaseChatModel>;
}

export function isBaseChatModel(
  model: AgentLanguageModelLike
): model is BaseChatModel {
  return (
    "invoke" in model &&
    typeof model.invoke === "function" &&
    "_streamResponseChunks" in model
  );
}

export function isConfigurableModel(
  model: unknown
): model is ConfigurableModelInterface {
  return (
    typeof model === "object" &&
    model != null &&
    "_queuedMethodOperations" in model &&
    "_getModelInstance" in model &&
    typeof (model as { _getModelInstance: unknown })._getModelInstance ===
      "function"
  );
}
