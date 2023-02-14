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

export interface PromptTemplateInput extends BasePromptTemplateInput {
  template: string;
  templateFormat?: TemplateFormat;
  validateTemplate?: boolean;
}

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
      template: resolveTemplateFromFile("template", data),
      templateFormat: data.template_format,
    });
    return res;
  }

  // TODO(from file)
}
