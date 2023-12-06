// Default generic "any" values are for backwards compatibility.
// Replace with "string" when we are comfortable with a breaking change.

import { BaseStringPromptTemplate } from "./string.js";
import type {
  BasePromptTemplateInput,
  TypedPromptInputValues,
} from "./base.js";
import {
  checkValidTemplate,
  parseTemplate,
  renderTemplate,
  type TemplateFormat,
} from "./template.js";
import type { SerializedPromptTemplate } from "./serde.js";
import type { InputValues, PartialValues } from "../utils/types.js";

/**
 * Inputs to create a {@link PromptTemplate}
 * @augments BasePromptTemplateInput
 */
export interface PromptTemplateInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplateInput<RunInput, PartialVariableName> {
  /**
   * The prompt template
   */
  template: string;

  /**
   * The format of the prompt template. Options are 'f-string'
   *
   * @defaultValue 'f-string'
   */
  templateFormat?: TemplateFormat;

  /**
   * Whether or not to try validating the template on initialization
   *
   * @defaultValue `true`
   */
  validateTemplate?: boolean;
}

type NonAlphanumeric =
  | " "
  | "\t"
  | "\n"
  | "\r"
  | '"'
  | "'"
  | "{"
  | "["
  | "("
  | "`"
  | ":"
  | ";";

/**
 * Recursive type to extract template parameters from a string.
 * @template T - The input string.
 * @template Result - The resulting array of extracted template parameters.
 */
type ExtractTemplateParamsRecursive<
  T extends string,
  Result extends string[] = []
> = T extends `${string}{${infer Param}}${infer Rest}`
  ? Param extends `${NonAlphanumeric}${string}`
    ? ExtractTemplateParamsRecursive<Rest, Result> // for non-template variables that look like template variables e.g. see https://github.com/langchain-ai/langchainjs/blob/main/langchain/src/chains/query_constructor/prompt.ts
    : ExtractTemplateParamsRecursive<Rest, [...Result, Param]>
  : Result;

export type ParamsFromFString<T extends string> = {
  [Key in
    | ExtractTemplateParamsRecursive<T>[number]
    | (string & Record<never, never>)]: string;
};

/**
 * Schema to represent a basic prompt for an LLM.
 * @augments BasePromptTemplate
 * @augments PromptTemplateInput
 *
 * @example
 * ```ts
 * import { PromptTemplate } from "langchain/prompts";
 *
 * const prompt = new PromptTemplate({
 *   inputVariables: ["foo"],
 *   template: "Say {foo}",
 * });
 * ```
 */
export class PromptTemplate<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunInput extends InputValues = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PartialVariableName extends string = any
  >
  extends BaseStringPromptTemplate<RunInput, PartialVariableName>
  implements PromptTemplateInput<RunInput, PartialVariableName>
{
  static lc_name() {
    return "PromptTemplate";
  }

  template: string;

  templateFormat: TemplateFormat = "f-string";

  validateTemplate = true;

  constructor(input: PromptTemplateInput<RunInput, PartialVariableName>) {
    super(input);
    Object.assign(this, input);

    if (this.validateTemplate) {
      let totalInputVariables: string[] = this.inputVariables;
      if (this.partialVariables) {
        totalInputVariables = totalInputVariables.concat(
          Object.keys(this.partialVariables)
        );
      }
      checkValidTemplate(
        this.template,
        this.templateFormat,
        totalInputVariables
      );
    }
  }

  _getPromptType(): "prompt" {
    return "prompt";
  }

  /**
   * Formats the prompt template with the provided values.
   * @param values The values to be used to format the prompt template.
   * @returns A promise that resolves to a string which is the formatted prompt.
   */
  async format(values: TypedPromptInputValues<RunInput>): Promise<string> {
    const allValues = await this.mergePartialAndUserVariables(values);
    return renderTemplate(this.template, this.templateFormat, allValues);
  }

  /**
   * Take examples in list format with prefix and suffix to create a prompt.
   *
   * Intended to be used a a way to dynamically create a prompt from examples.
   *
   * @param examples - List of examples to use in the prompt.
   * @param suffix - String to go after the list of examples. Should generally set up the user's input.
   * @param inputVariables - A list of variable names the final prompt template will expect
   * @param exampleSeparator - The separator to use in between examples
   * @param prefix - String that should go before any examples. Generally includes examples.
   *
   * @returns The final prompt template generated.
   */
  static fromExamples(
    examples: string[],
    suffix: string,
    inputVariables: string[],
    exampleSeparator = "\n\n",
    prefix = ""
  ) {
    const template = [prefix, ...examples, suffix].join(exampleSeparator);
    return new PromptTemplate({
      inputVariables,
      template,
    });
  }

  /**
   * Load prompt template from a template f-string
   */
  static fromTemplate<
    // eslint-disable-next-line @typescript-eslint/ban-types
    RunInput extends InputValues = Symbol,
    T extends string = string
  >(
    template: T,
    {
      templateFormat = "f-string",
      ...rest
    }: Omit<
      PromptTemplateInput<RunInput, string>,
      "template" | "inputVariables"
    > = {}
  ) {
    const names = new Set<string>();
    parseTemplate(template, templateFormat).forEach((node) => {
      if (node.type === "variable") {
        names.add(node.name);
      }
    });
    return new PromptTemplate<
      // eslint-disable-next-line @typescript-eslint/ban-types
      RunInput extends Symbol ? ParamsFromFString<T> : RunInput
    >({
      // Rely on extracted types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputVariables: [...names] as any[],
      templateFormat,
      template,
      ...rest,
    });
  }

  /**
   * Partially applies values to the prompt template.
   * @param values The values to be partially applied to the prompt template.
   * @returns A new instance of PromptTemplate with the partially applied values.
   */
  async partial<NewPartialVariableName extends string>(
    values: PartialValues<NewPartialVariableName>
  ) {
    const newInputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    ) as Exclude<Extract<keyof RunInput, string>, NewPartialVariableName>[];
    const newPartialVariables = {
      ...(this.partialVariables ?? {}),
      ...values,
    } as PartialValues<PartialVariableName | NewPartialVariableName>;
    const promptDict = {
      ...this,
      inputVariables: newInputVariables,
      partialVariables: newPartialVariables,
    };
    return new PromptTemplate<
      InputValues<
        Exclude<Extract<keyof RunInput, string>, NewPartialVariableName>
      >
    >(promptDict);
  }

  serialize(): SerializedPromptTemplate {
    if (this.outputParser !== undefined) {
      throw new Error(
        "Cannot serialize a prompt template with an output parser"
      );
    }
    return {
      _type: this._getPromptType(),
      input_variables: this.inputVariables,
      template: this.template,
      template_format: this.templateFormat,
    };
  }

  static async deserialize(
    data: SerializedPromptTemplate
  ): Promise<PromptTemplate> {
    if (!data.template) {
      throw new Error("Prompt template must have a template");
    }
    const res = new PromptTemplate({
      inputVariables: data.input_variables,
      template: data.template,
      templateFormat: data.template_format,
    });
    return res;
  }

  // TODO(from file)
}
