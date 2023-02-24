import {
  BasePromptTemplate,
  BasePromptTemplateInput,
  InputValues,
} from "./index";
import {
  TemplateFormat,
  checkValidTemplate,
  renderTemplate,
  parseFString,
} from "./template";
import { resolveTemplateFromFile } from "../util";
import { SerializedOutputParser, BaseOutputParser } from "./parser";

export type SerializedPromptTemplate = {
  _type?: "prompt";
  input_variables: string[];
  output_parser?: SerializedOutputParser;
  template?: string;
  template_path?: string;
  template_format?: TemplateFormat;
};

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
  extends BasePromptTemplate
  implements PromptTemplateInput
{
  template: string;

  templateFormat: TemplateFormat = "f-string";

  validateTemplate = true;

  constructor(input: PromptTemplateInput) {
    super(input);
    Object.assign(this, input);

    if (this.validateTemplate) {
      checkValidTemplate(
        this.template,
        this.templateFormat,
        this.inputVariables
      );
    }
  }

  _getPromptType(): "prompt" {
    return "prompt";
  }

  format(values: InputValues): string {
    return renderTemplate(this.template, this.templateFormat, values);
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
  static fromTemplate(template: string) {
    const names = new Set<string>();
    parseFString(template).forEach((node) => {
      if (node.type === "variable") {
        names.add(node.name);
      }
    });

    return new PromptTemplate({
      inputVariables: [...names],
      template,
    });
  }

  serialize(): SerializedPromptTemplate {
    return {
      _type: this._getPromptType(),
      input_variables: this.inputVariables,
      output_parser: this.outputParser?.serialize(),
      template: this.template,
      template_format: this.templateFormat,
    };
  }

  static async deserialize(
    data: SerializedPromptTemplate
  ): Promise<PromptTemplate> {
    const res = new PromptTemplate({
      inputVariables: data.input_variables,
      outputParser:
        data.output_parser && BaseOutputParser.deserialize(data.output_parser),
      template: await resolveTemplateFromFile("template", data),
      templateFormat: data.template_format,
    });
    return res;
  }

  // TODO(from file)
}
