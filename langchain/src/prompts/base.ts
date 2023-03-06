import { BaseOutputParser } from "./parser.js";
import type { FewShotPromptTemplate, PromptTemplate } from "./index.js";
import { ChatPromptTemplate } from "./index.js";
import { BasePromptValue, HumanChatMessage } from "../schema/index.js";

export type SerializedBasePromptTemplate = ReturnType<
  InstanceType<
    | typeof PromptTemplate
    | typeof FewShotPromptTemplate
    | typeof ChatPromptTemplate
  >["serialize"]
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputValues = Record<string, any>;
export type PartialValues = Record<
  string,
  string | (() => Promise<string>) | (() => string)
>;

export class StringPromptValue {
  value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString() {
    return this.value;
  }

  toChatMessages() {
    return [new HumanChatMessage(this.value)];
  }
}

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

  /** Partial variables */
  partialVariables?: PartialValues;
}

/**
 * Base class for prompt templates. Exposes a format method that returns a
 * string prompt given a set of input values.
 * @augments BasePromptTemplateInput
 */
export abstract class BasePromptTemplate implements BasePromptTemplateInput {
  inputVariables: string[];

  outputParser?: BaseOutputParser;

  partialVariables?: InputValues;

  constructor(input: BasePromptTemplateInput) {
    const { inputVariables } = input;
    if (inputVariables.includes("stop")) {
      throw new Error(
        "Cannot have an input variable named 'stop', as it is used internally, please rename."
      );
    }
    Object.assign(this, input);
  }

  abstract partial(values: PartialValues): Promise<BasePromptTemplate>;

  async mergePartialAndUserVariables(
    userVariables: InputValues
  ): Promise<InputValues> {
    const partialVariables = this.partialVariables ?? {};
    const partialValues: InputValues = {};
    for (let i = 0; i < Object.keys(partialVariables).length; i += 1) {
      const key = Object.keys(partialVariables)[i];
      const value = partialVariables[key];
      if (typeof value === "string") {
        partialValues[key] = value;
      } else {
        partialValues[key] = await value();
      }
    }
    const allKwargs = { ...partialValues, ...userVariables };
    return allKwargs;
  }

  /**
   * Format the prompt given the input values.
   *
   * @param values - A dictionary of arguments to be passed to the prompt template.
   * @returns A formatted prompt string.
   *
   * @example
   * ```ts
   * prompt.format({ foo: "bar" });
   * ```
   */
  abstract format(values: InputValues): Promise<string>;

  /**
   * Format the prompt given the input values and return a formatted prompt value.
   * @param values
   * @returns A formatted PromptValue.
   */
  abstract formatPromptValue(values: InputValues): Promise<BasePromptValue>;

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
      case "prompt": {
        const { PromptTemplate } = await import("./prompt.js");
        return PromptTemplate.deserialize(data);
      }
      case undefined: {
        const { PromptTemplate } = await import("./prompt.js");
        return PromptTemplate.deserialize({ ...data, _type: "prompt" });
      }
      case "few_shot": {
        const { FewShotPromptTemplate } = await import("./few_shot.js");
        return FewShotPromptTemplate.deserialize(data);
      }
      default:
        throw new Error(
          `Invalid prompt type in config: ${
            (data as SerializedBasePromptTemplate)._type
          }`
        );
    }
  }
}

export abstract class BaseStringPromptTemplate extends BasePromptTemplate {
  async formatPromptValue(values: InputValues): Promise<BasePromptValue> {
    const formattedPrompt = await this.format(values);
    return new StringPromptValue(formattedPrompt);
  }
}
