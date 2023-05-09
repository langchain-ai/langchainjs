import { BaseChatModel } from "../chat_models/base.js";
import { BasePromptTemplate } from "../prompts/base.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { BaseLLM } from "../llms/base.js";
import { PartialValues } from "../schema/index.js";

export type BasePromptTemplateGeneratorOptions = {
  partialVariables?: PartialValues;
};

export type BasePromptTemplateGenerator = (
  options: BasePromptTemplateGeneratorOptions
) => BasePromptTemplate;

export type GetPromptOptions = {
  partialVariables?: PartialValues;
};

export abstract class BasePromptSelector {
  abstract getPrompt(
    llm: BaseLanguageModel,
    options: GetPromptOptions
  ): BasePromptTemplate;
}

export class ConditionalPromptSelector extends BasePromptSelector {
  defaultPrompt: BasePromptTemplate | BasePromptTemplateGenerator;

  conditionals: Array<
    [
      condition: (llm: BaseLanguageModel) => boolean,
      prompt: BasePromptTemplate | BasePromptTemplateGenerator
    ]
  >;

  constructor(
    default_prompt: BasePromptTemplate | BasePromptTemplateGenerator,
    conditionals: Array<
      [
        condition: (llm: BaseLanguageModel) => boolean,
        prompt: BasePromptTemplate | BasePromptTemplateGenerator
      ]
    > = []
  ) {
    super();
    this.defaultPrompt = default_prompt;
    this.conditionals = conditionals;
  }

  getPrompt(
    llm: BaseLanguageModel,
    options?: GetPromptOptions
  ): BasePromptTemplate {
    for (const [condition, prompt] of this.conditionals) {
      if (condition(llm)) {
        if (typeof prompt === "function") {
          return prompt({ partialVariables: options?.partialVariables });
        }
        return prompt;
      }
    }
    if (typeof this.defaultPrompt === "function") {
      return this.defaultPrompt({
        partialVariables: options?.partialVariables,
      });
    }
    return this.defaultPrompt;
  }
}

export function isLLM(llm: BaseLanguageModel): llm is BaseLLM {
  return llm._modelType() === "base_llm";
}

export function isChatModel(llm: BaseLanguageModel): llm is BaseChatModel {
  return llm._modelType() === "base_chat_model";
}
