import { BaseOutputParser } from "./parser";
import { PromptTemplate, FewShotPromptTemplate } from "./index";

const templateClasses = [PromptTemplate, FewShotPromptTemplate];

export type SerializedBasePromptTemplate = ReturnType<
  InstanceType<(typeof templateClasses)[number]>["serialize"]
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputValues = Record<string, any>;

/**
 * Input common to all prompt templates.
 */
export interface BasePromptTemplateInput {
  /**
   * A list of variable names the prompt template expects
   */
  inputVariables: string[];

  /**
   * How to parse the output of calling an LLM on this formatted prompt
   */
  outputParser?: BaseOutputParser;
}

/**
 * Base class for prompt templates. Exposes a format method that returns a
 * string prompt given a set of input values.
 * @augments BasePromptTemplateInput
 */
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

  /**
   * Format the prompt given the input values.
   *
   * @param inputValues - A dictionary of arguments to be passed to the prompt template.
   * @returns A formatted prompt string.
   *
   * @example
   * ```ts
   * prompt.format({ foo: "bar" });
   * ```
   */
  abstract format(values: InputValues): string;

  /**
   * Return the string type key uniquely identifying this class of prompt template.
   */
  abstract _getPromptType(): string;

  /**
   * Return a json-like object representing this prompt template.
   */
  abstract serialize(): SerializedBasePromptTemplate;

  /**
   * Load a prompt template from a json-like object describing it.
   *
   * @remarks
   * Deserializing needs to be async because templates (e.g. {@link FewShotPromptTemplate}) can
   * reference remote resources that we read asynchronously with a web
   * request.
   */
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
