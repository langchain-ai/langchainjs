// Default generic "any" values are for backwards compatibility.
// Replace with "string" when we are comfortable with a breaking change.

import { HumanMessage } from "../schema/messages.js";
import { InputValues } from "../schema/index.js";
import { BasePromptValue } from "../schema/prompt.js";
import { BasePromptTemplate } from "../schema/prompt_template.js";
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
