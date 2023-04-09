import {
  BasePromptValue,
  Example,
  HumanChatMessage,
  BaseOutputParser,
} from "../schema/index.js";
import { SerializedBasePromptTemplate } from "./serde.js";

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
export interface BasePromptTemplateInput<
  K extends string,
  P extends string
> {
  /**
   * A list of variable names the prompt template expects
   */
  inputVariables: K[];

  /**
   * How to parse the output of calling an LLM on this formatted prompt
   */
  outputParser?: BaseOutputParser;

  /** Partial variables */
  partialVariables?: Record<P, any>;
}

/**
 * Base class for prompt templates. Exposes a format method that returns a
 * string prompt given a set of input values.
 * @augments BasePromptTemplateInput
 */
export abstract class BasePromptTemplate<
  K extends string,
  P extends string
> implements BasePromptTemplateInput<K, P>
{
  inputVariables: K[];

  outputParser?: BaseOutputParser;

  partialVariables?: Record<P, any>;

  constructor(input: BasePromptTemplateInput<K, P>) {
    const { inputVariables } = input;
    if (inputVariables.includes("stop" as never)) {
      throw new Error(
        "Cannot have an input variable named 'stop', as it is used internally, please rename."
      );
    }
    Object.assign(this, input);
  }

  abstract partial<P2 extends K>(
    values: Record<P2, any>
  ): Promise<BasePromptTemplate<Exclude<K, P2>, P | P2>>;

  async mergePartialAndUserVariables(
    userVariables: Record<K, any> & Partial<Record<P, any>>
  ): Promise<Record<K | P, any>> {
    const partialVariables = this.partialVariables ?? ({} as Record<P, any>);
    const partialValues = {} as Record<P, any>;
    for (let i = 0; i < Object.keys(partialVariables).length; i += 1) {
      const key = Object.keys(partialVariables)[i] as P;
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
  abstract format(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<string>;

  /**
   * Format the prompt given the input values and return a formatted prompt value.
   * @param values
   * @returns A formatted PromptValue.
   */
  abstract formatPromptValue(values: Record<K, any>): Promise<BasePromptValue>;

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
  ): Promise<BasePromptTemplate<string, string>> {
    switch (data._type) {
      case "prompt": {
        const { PromptTemplate } = await import("./prompt.js");
        return PromptTemplate.deserialize(data) as any;
      }
      case undefined: {
        const { PromptTemplate } = await import("./prompt.js");
        return PromptTemplate.deserialize({ ...data, _type: "prompt" }) as any;
      }
      case "few_shot": {
        const { FewShotPromptTemplate } = await import("./few_shot.js");
        return FewShotPromptTemplate.deserialize(data) as any;
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
  K extends string,
  P extends string
> extends BasePromptTemplate<K, P> {
  async formatPromptValue(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<BasePromptValue> {
    const formattedPrompt = await this.format(values);
    return new StringPromptValue(formattedPrompt);
  }
}

/**
 * Base class for example selectors.
 */
export abstract class BaseExampleSelector<K extends string, P extends string> {
  abstract addExample(example: Example<K, P>): Promise<void | string>;

  abstract selectExamples(input_variables: Example<K, P>): Promise<Example<K, P>[]>;
}
