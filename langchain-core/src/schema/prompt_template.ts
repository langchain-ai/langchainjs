// Default generic "any" values are for backwards compatibility.
// Replace with "string" when we are comfortable with a breaking change.

import { HumanMessage } from "./messages.js";
import { InputValues, PartialValues } from "./index.js";
import { BasePromptValue } from "./prompt.js";
import { BaseOutputParser } from "./output_parser.js";
import { Serializable } from "../load/serializable.js";
import { SerializedFields } from "../load/map_keys.js";
import { Runnable } from "../runnables/base.js";
import { BaseCallbackConfig } from "../callbacks/manager.js";
import type { StringWithAutocomplete } from "../util/types.js";

export type TypedPromptInputValues<RunInput> = InputValues<
  StringWithAutocomplete<Extract<keyof RunInput, string>>
>;

export type Example = Record<string, string>;

/**
 * Represents a prompt value as a string. It extends the BasePromptValue
 * class and overrides the toString and toChatMessages methods.
 */
export class StringPromptValue extends BasePromptValue {
  lc_namespace = ["langchain", "prompts", "base"];

  value: string;

  constructor(value: string) {
    super({ value });
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
    RunInput extends InputValues = any,
    RunOutput extends BasePromptValue = BasePromptValue,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PartialVariableName extends string = any
  >
  extends Runnable<RunInput, RunOutput>
  implements BasePromptTemplateInput
{
  declare PromptValueReturnType: RunOutput;

  lc_serializable = true;

  lc_namespace = ["langchain", "prompts", this._getPromptType()];

  get lc_attributes(): SerializedFields | undefined {
    return {
      partialVariables: undefined, // python doesn't support this yet
    };
  }

  inputVariables: Array<Extract<keyof RunInput, string>>;

  outputParser?: BaseOutputParser;

  partialVariables: PartialValues<PartialVariableName>;

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

  abstract partial(
    values: PartialValues
  ): Promise<BasePromptTemplate<RunInput, RunOutput, PartialVariableName>>;

  /**
   * Merges partial variables and user variables.
   * @param userVariables The user variables to merge with the partial variables.
   * @returns A Promise that resolves to an object containing the merged variables.
   */
  async mergePartialAndUserVariables(
    userVariables: TypedPromptInputValues<RunInput>
  ): Promise<
    InputValues<Extract<keyof RunInput, string> | PartialVariableName>
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
   * Invokes the prompt template with the given input and options.
   * @param input The input to invoke the prompt template with.
   * @param options Optional configuration for the callback.
   * @returns A Promise that resolves to the output of the prompt template.
   */
  async invoke(
    input: RunInput,
    options?: BaseCallbackConfig
  ): Promise<RunOutput> {
    return this._callWithConfig(
      (input: RunInput) => this.formatPromptValue(input),
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
  abstract format(values: TypedPromptInputValues<RunInput>): Promise<string>;

  /**
   * Format the prompt given the input values and return a formatted prompt value.
   * @param values
   * @returns A formatted PromptValue.
   */
  abstract formatPromptValue(
    values: TypedPromptInputValues<RunInput>
  ): Promise<RunOutput>;

  /**
   * Return the string type key uniquely identifying this class of prompt template.
   */
  abstract _getPromptType(): string;
}

/**
 * Base class for string prompt templates. It extends the
 * BasePromptTemplate class and overrides the formatPromptValue method to
 * return a StringPromptValue.
 */
export abstract class BaseStringPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplate<RunInput, StringPromptValue, PartialVariableName> {
  /**
   * Formats the prompt given the input values and returns a formatted
   * prompt value.
   * @param values The input values to format the prompt.
   * @returns A Promise that resolves to a formatted prompt value.
   */
  async formatPromptValue(
    values: TypedPromptInputValues<RunInput>
  ): Promise<StringPromptValue> {
    const formattedPrompt = await this.format(values);
    return new StringPromptValue(formattedPrompt);
  }
}

/**
 * Base class for example selectors.
 */
export abstract class BaseExampleSelector extends Serializable {
  lc_namespace = ["langchain", "prompts", "selectors"];

  /**
   * Adds an example to the example selector.
   * @param example The example to add to the example selector.
   * @returns A Promise that resolves to void or a string.
   */
  abstract addExample(example: Example): Promise<void | string>;

  /**
   * Selects examples from the example selector given the input variables.
   * @param input_variables The input variables to select examples with.
   * @returns A Promise that resolves to an array of selected examples.
   */
  abstract selectExamples(input_variables: Example): Promise<Example[]>;
}
