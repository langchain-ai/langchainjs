import {
  BasePromptValue,
  Example,
  HumanMessage,
  InputValues,
  PartialValues,
} from "../schema/index.js";
import { BaseOutputParser } from "../schema/output_parser.js";
import { Serializable } from "../load/serializable.js";
import { SerializedBasePromptTemplate } from "./serde.js";
import { SerializedFields } from "../load/map_keys.js";
import { Runnable } from "../schema/runnable.js";
import { BaseCallbackConfig } from "../callbacks/manager.js";

export class StringPromptValue extends BasePromptValue {
  lc_namespace = ["langchain", "prompts", "base"];

  value: string;

  constructor(value: string) {
    super(...arguments);
    this.value = value;
  }

  toString() {
    return this.value;
  }

  toChatMessages() {
    return [new HumanMessage(this.value)];
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
 */
export abstract class BasePromptTemplate<
    FormattedOutput extends BasePromptValue = BasePromptValue
  >
  extends Runnable<InputValues, FormattedOutput>
  implements BasePromptTemplateInput
{
  declare PromptValueReturnType: FormattedOutput;

  lc_serializable = true;

  lc_namespace = ["langchain", "prompts", this._getPromptType()];

  get lc_attributes(): SerializedFields | undefined {
    return {
      partialVariables: undefined, // python doesn't support this yet
    };
  }

  inputVariables: string[];

  outputParser?: BaseOutputParser;

  partialVariables: InputValues = {};

  constructor(input: BasePromptTemplateInput) {
    super(input);
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

    for (const [key, value] of Object.entries(partialVariables)) {
      if (typeof value === "string") {
        partialValues[key] = value;
      } else {
        partialValues[key] = await value();
      }
    }

    const allKwargs = { ...partialValues, ...userVariables };
    return allKwargs;
  }

  async invoke(
    input: InputValues,
    options?: BaseCallbackConfig
  ): Promise<FormattedOutput> {
    return this._callWithConfig(
      (input: InputValues) => this.formatPromptValue(input),
      input,
      { ...options, runType: "prompt" }
    );
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
  abstract formatPromptValue(values: InputValues): Promise<FormattedOutput>;

  /**
   * Return the string type key uniquely identifying this class of prompt template.
   */
  abstract _getPromptType(): string;

  /**
   * Return a json-like object representing this prompt template.
   * @deprecated
   */
  serialize(): SerializedBasePromptTemplate {
    throw new Error("Use .toJSON() instead");
  }

  /**
   * @deprecated
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
  async formatPromptValue(values: InputValues): Promise<StringPromptValue> {
    const formattedPrompt = await this.format(values);
    return new StringPromptValue(formattedPrompt);
  }
}

/**
 * Base class for example selectors.
 */
export abstract class BaseExampleSelector extends Serializable {
  lc_namespace = ["langchain", "prompts", "selectors"];

  abstract addExample(example: Example): Promise<void | string>;

  abstract selectExamples(input_variables: Example): Promise<Example[]>;
}
