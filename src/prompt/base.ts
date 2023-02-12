import { BaseOutputParser } from "./parser";
import { PromptTemplate, FewShotPromptTemplate } from "./index";

const templateClasses = [PromptTemplate, FewShotPromptTemplate];

export type SerializedBasePromptTemplate = ReturnType<
  InstanceType<(typeof templateClasses)[number]>["serialize"]
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputValues = Record<string, any>;

export interface BasePromptTemplateInput {
  inputVariables: string[];
  outputParser?: BaseOutputParser;
}

export abstract class BasePromptTemplate implements BasePromptTemplateInput {
  inputVariables: string[];

  outputParser?: BaseOutputParser;

  constructor(input: BasePromptTemplateInput) {
    const { inputVariables } = input;
    if (inputVariables.includes("stop")) {
      throw new Error(
        "Cannot have an input variable named 'stop', as it is used internally, please rename."
      );
    }
    Object.assign(this, input);
  }

  abstract format(values: InputValues): string;

  abstract _getPromptType(): string;

  abstract serialize(): SerializedBasePromptTemplate;

  // Deserializing needs to be async because templates (e.g. few_shot) can
  // reference remote resources that we read asynchronously with a web
  // request.
  static async deserialize(
    data: SerializedBasePromptTemplate
  ): Promise<BasePromptTemplate> {
    switch (data._type) {
      case "prompt":
        return PromptTemplate.deserialize(data);
      case undefined:
        return PromptTemplate.deserialize({ ...data, _type: "prompt" });
      case "few_shot":
        return FewShotPromptTemplate.deserialize(data);
      default:
        throw new Error(
          `Invalid prompt type in config: ${
            (data as SerializedBasePromptTemplate)._type
          }`
        );
    }
  }
}
