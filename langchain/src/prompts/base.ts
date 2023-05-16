import { z } from "zod";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BasePromptTemplateInputSchema = z.ZodObject<any, any, any, any>;

/**
 * Input common to all prompt templates.
 */
export interface BasePromptTemplateInput<
  InputSchema extends BasePromptTemplateInputSchema = BasePromptTemplateInputSchema
> {
  /**
   * A list of variable names the prompt template expects
   */
  inputVariables?: string[];

  /**
   * Schema for the variable names the prompt template expects
   */
  inputSchema?: InputSchema;

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
  InputSchema extends BasePromptTemplateInputSchema = BasePromptTemplateInputSchema
> implements BasePromptTemplateInput<BasePromptTemplateInputSchema>
{
  inputVariables: string[];

  inputSchema: InputSchema;

  outputParser?: BaseOutputParser;

  partialVariables?: InputValues;

  constructor(input: BasePromptTemplateInput<InputSchema>) {
    Object.assign(this, input);

    if (input.inputVariables) {
      if (input.inputSchema) {
        throw new Error(
          `Please only pass in one of "inputVariables" or "inputSchema".`
        );
      }
      this.inputSchema =
        input.inputSchema ??
        (z.object(
          /* eslint-disable no-param-reassign */
          input.inputVariables.reduce(
            (objectSchema: Record<string, z.ZodString>, inputVariable) => {
              objectSchema[inputVariable] = z.string();
              return objectSchema;
            },
            {}
          )
          /* eslint-enable no-param-reassign */
        ) as InputSchema);
    }
    if (input.inputSchema) {
      if (input.inputVariables) {
        throw new Error(
          `Please only pass in one of "inputVariables" or "inputSchema".`
        );
      }
      this.inputVariables =
        input.inputVariables ?? Object.keys(input.inputSchema.shape);
    }

    if (this.inputVariables?.includes("stop")) {
      throw new Error(
        "Cannot have an input variable named 'stop', as it is used internally, please rename."
      );
    }
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

export abstract class BaseStringPromptTemplate<
  InputSchema extends BasePromptTemplateInputSchema = BasePromptTemplateInputSchema
> extends BasePromptTemplate<InputSchema> {
  async formatPromptValue(values: InputValues): Promise<BasePromptValue> {
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
