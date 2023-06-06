// Default generic "any" values are for backwards compatibility.
// Replace with "string" when we are comfortable with a breaking change.

import {
  BasePromptValue,
  Example,
  HumanChatMessage,
  InputValues,
  PartialValues,
} from "../schema/index.js";
import { BaseOutputParser } from "../schema/output_parser.js";
import { SerializedBasePromptTemplate } from "./serde.js";

export class StringPromptValue extends BasePromptValue {
  value: string;

  constructor(value: string) {
    super();
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
export interface BasePromptTemplateInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariables extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> {
  /**
   * A list of variable names the prompt template expects
   */
  inputVariables: Array<Extract<keyof InputVariables, string>>;

  /**
   * How to parse the output of calling an LLM on this formatted prompt
   */
  outputParser?: BaseOutputParser;

  /** Partial variables */
  partialVariables?: PartialValues<PartialVariableName>;
}

/**
 * Base class for prompt templates. Exposes a format method that returns a
 * string prompt given a set of input values.
 */
export abstract class BasePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariables extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> implements BasePromptTemplateInput<InputVariables, PartialVariableName>
{
  declare PromptValueReturnType: BasePromptValue;

  inputVariables: Array<Extract<keyof InputVariables, string>>;

  outputParser?: BaseOutputParser;

  partialVariables?: PartialValues<PartialVariableName>;

  constructor(
    input: BasePromptTemplateInput<InputVariables, PartialVariableName>
  ) {
    const { inputVariables } = input;
    if ((inputVariables as string[]).includes("stop")) {
      throw new Error(
        "Cannot have an input variable named 'stop', as it is used internally, please rename."
      );
    }
    Object.assign(this, input);
  }

  abstract partial(
    values: PartialValues
  ): Promise<BasePromptTemplate<InputVariables, PartialVariableName>>;

  async mergePartialAndUserVariables(
    userVariables: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<
    InputValues<Extract<keyof InputVariables, string> | PartialVariableName>
  > {
    const partialVariables = this.partialVariables ?? {};
    const partialValues: Record<string, string> = {};

    for (const [key, value] of Object.entries(partialVariables)) {
      if (typeof value === "string") {
        partialValues[key] = value;
      } else {
        partialValues[key] = await (value as () => Promise<string>)();
      }
    }

    const allKwargs = {
      ...(partialValues as Record<PartialVariableName, string>),
      ...userVariables,
    };
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
  abstract format(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<string>;

  /**
   * Format the prompt given the input values and return a formatted prompt value.
   * @param values
   * @returns A formatted PromptValue.
   */
  abstract formatPromptValue(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<BasePromptValue>;

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
  ): Promise<BasePromptTemplate<InputValues, string>> {
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

export abstract class BaseStringPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariables extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplate<InputVariables, PartialVariableName> {
  async formatPromptValue(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<BasePromptValue> {
    const formattedPrompt = await this.format(values);
    return new StringPromptValue(formattedPrompt);
  }
}

/**
 * Base class for example selectors.
 */
export abstract class BaseExampleSelector {
  abstract addExample(example: Example): Promise<void | string>;

  abstract selectExamples(input_variables: Example): Promise<Example[]>;
}
