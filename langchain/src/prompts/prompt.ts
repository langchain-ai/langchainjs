import { BaseStringPromptTemplate, BasePromptTemplateInput } from "./base.js";
import {
  checkValidTemplate,
  parseTemplate,
  renderTemplate,
  TemplateFormat,
} from "./template.js";
import { SerializedPromptTemplate } from "./serde.js";
import { InputValues, PartialValues } from "../schema/index.js";

/**
 * Inputs to create a {@link PromptTemplate}
 * @augments BasePromptTemplateInput
 */
export interface PromptTemplateInput extends BasePromptTemplateInput {
  /**
   * The propmt template
   */
  template: string;

  /**
   * The format of the prompt template. Options are 'f-string', 'jinja-2'
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
export class PromptTemplate
  extends BaseStringPromptTemplate
  implements PromptTemplateInput
{
  template: string;

  templateFormat: TemplateFormat = "f-string";

  validateTemplate = true;

  constructor(input: PromptTemplateInput) {
    super(input);
    Object.assign(this, input);

    if (this.validateTemplate) {
      let totalInputVariables = this.inputVariables;
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

  async format(values: InputValues): Promise<string> {
    const allValues = await this.mergePartialAndUserVariables(values);
    return renderTemplate(this.template, this.templateFormat, allValues);
  }

  /**
   * Take examples in list format with prefix and suffix to create a prompt.
   *
   * Intendend to be used a a way to dynamically create a prompt from examples.
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
  static fromTemplate(
    template: string,
    {
      templateFormat = "f-string",
      ...rest
    }: Omit<PromptTemplateInput, "template" | "inputVariables"> = {}
  ) {
    const names = new Set<string>();
    parseTemplate(template, templateFormat).forEach((node) => {
      if (node.type === "variable") {
        names.add(node.name);
      }
    });

    return new PromptTemplate({
      inputVariables: [...names],
      templateFormat,
      template,
      ...rest,
    });
  }

  async partial(values: PartialValues): Promise<PromptTemplate> {
    const promptDict: PromptTemplateInput = { ...this };
    promptDict.inputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    );
    promptDict.partialVariables = {
      ...(this.partialVariables ?? {}),
      ...values,
    };
    return new PromptTemplate(promptDict);
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
