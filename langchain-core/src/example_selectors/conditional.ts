import type { BaseChatModel } from "../language_models/chat_models.js";
import type { BasePromptTemplate } from "../prompts/base.js";
import type { BaseLanguageModel } from "../language_models/base.js";
import type { BaseLLM } from "../language_models/llms.js";
import type { PartialValues } from "../utils/types.js";

export type BaseGetPromptAsyncOptions = {
  partialVariables?: PartialValues;
};

/**
 * Abstract class that defines the interface for selecting a prompt for a
 * given language model.
 */
export abstract class BasePromptSelector {
  /**
   * Abstract method that must be implemented by any class that extends
   * `BasePromptSelector`. It takes a language model as an argument and
   * returns a prompt template.
   * @param llm The language model for which to get a prompt.
   * @returns A prompt template.
   */
  abstract getPrompt(llm: BaseLanguageModel): BasePromptTemplate;

  /**
   * Asynchronous version of `getPrompt` that also accepts an options object
   * for partial variables.
   * @param llm The language model for which to get a prompt.
   * @param options Optional object for partial variables.
   * @returns A Promise that resolves to a prompt template.
   */
  async getPromptAsync(
    llm: BaseLanguageModel,
    options?: BaseGetPromptAsyncOptions
  ): Promise<BasePromptTemplate> {
    const prompt = this.getPrompt(llm);
    return prompt.partial(options?.partialVariables ?? {});
  }
}

/**
 * Concrete implementation of `BasePromptSelector` that selects a prompt
 * based on a set of conditions. It has a default prompt that it returns
 * if none of the conditions are met.
 */
export class ConditionalPromptSelector extends BasePromptSelector {
  defaultPrompt: BasePromptTemplate;

  conditionals: Array<
    [condition: (llm: BaseLanguageModel) => boolean, prompt: BasePromptTemplate]
  >;

  constructor(
    default_prompt: BasePromptTemplate,
    conditionals: Array<
      [
        condition: (llm: BaseLanguageModel) => boolean,
        prompt: BasePromptTemplate
      ]
    > = []
  ) {
    super();
    this.defaultPrompt = default_prompt;
    this.conditionals = conditionals;
  }

  /**
   * Method that selects a prompt based on a set of conditions. If none of
   * the conditions are met, it returns the default prompt.
   * @param llm The language model for which to get a prompt.
   * @returns A prompt template.
   */
  getPrompt(llm: BaseLanguageModel): BasePromptTemplate {
    for (const [condition, prompt] of this.conditionals) {
      if (condition(llm)) {
        return prompt;
      }
    }
    return this.defaultPrompt;
  }
}

/**
 * Type guard function that checks if a given language model is of type
 * `BaseLLM`.
 */
export function isLLM(llm: BaseLanguageModel): llm is BaseLLM {
  return llm._modelType() === "base_llm";
}

/**
 * Type guard function that checks if a given language model is of type
 * `BaseChatModel`.
 */
export function isChatModel(llm: BaseLanguageModel): llm is BaseChatModel {
  return llm._modelType() === "base_chat_model";
}
