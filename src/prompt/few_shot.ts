import fs from "fs";
import path from "path";
import * as yaml from "yaml";

import {
  BasePromptTemplate,
  InputValues,
  BasePromptTemplateInput,
} from "./index";
import { TemplateFormat, checkValidTemplate, renderTemplate } from "./template";
import { resolveTemplate, loadPrompt } from "./load";
import { PromptTemplate, SerializedPromptTemplate } from "./prompt";
import { SerializedOutputParser, BaseOutputParser } from "./parser";

// TODO: support ExampleSelectors.
type ExampleSelector = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Example = Record<string, any>;

export type SerializedFewShotTemplate = {
  _type: "few_shot";
  input_variables: string[];
  output_parser?: SerializedOutputParser;
  examples: string | Example[];
  example_prompt?: SerializedPromptTemplate;
  example_prompt_path?: string;
  example_separator: string;
  prefix?: string;
  prefix_path?: string;
  suffix?: string;
  suffix_path?: string;
  template_format: TemplateFormat;
};

export interface FewShotPromptTemplateInput extends BasePromptTemplateInput {
  examples?: Example[];
  examplePrompt: PromptTemplate;
  exampleSelector?: ExampleSelector;
  exampleSeparator: string;
  prefix: string;
  suffix: string;
  templateFormat: TemplateFormat;
  validateTemplate?: boolean;
}

export class FewShotPromptTemplate
  extends BasePromptTemplate
  implements FewShotPromptTemplateInput
{
  examples?: InputValues[];

  exampleSelector?: ExampleSelector;

  examplePrompt: PromptTemplate;

  suffix: string;

  exampleSeparator: string;

  prefix: string;

  templateFormat: TemplateFormat = "f-string";

  validateTemplate = true;

  constructor(input: FewShotPromptTemplateInput) {
    super(input);
    Object.assign(this, input);

    if (this.examples !== undefined && this.exampleSelector !== undefined) {
      throw new Error(
        "Only one of 'examples' and 'example_selector' should be provided"
      );
    }

    if (this.examples === undefined && this.exampleSelector === undefined) {
      throw new Error(
        "One of 'examples' and 'example_selector' should be provided"
      );
    }

    if (this.validateTemplate) {
      checkValidTemplate(
        this.prefix + this.suffix,
        this.templateFormat,
        this.inputVariables
      );
    }
  }

  _getPromptType(): "few_shot" {
    return "few_shot";
  }

  private getExamples(_: InputValues): InputValues[] {
    if (this.examples !== undefined) {
      return this.examples;
    }
    if (this.exampleSelector !== undefined) {
      throw new Error("Example selectors are not yet supported.");
    }

    throw new Error(
      "One of 'examples' and 'example_selector' should be provided"
    );
  }

  format(values: InputValues): string {
    const examples = this.getExamples(values);

    const exampleStrings = examples.map((example) =>
      this.examplePrompt.format(example)
    );
    const template = [this.prefix, ...exampleStrings, this.suffix].join(
      this.exampleSeparator
    );
    return renderTemplate(template, this.templateFormat, values);
  }

  serialize(): SerializedFewShotTemplate {
    if (this.exampleSelector || !this.examples) {
      throw new Error(
        "Serializing an example selector is not currently supported"
      );
    }
    return {
      _type: this._getPromptType(),
      input_variables: this.inputVariables,
      output_parser: this.outputParser?.serialize(),
      example_prompt: this.examplePrompt.serialize(),
      example_separator: this.exampleSeparator,
      suffix: this.suffix,
      prefix: this.prefix,
      template_format: this.templateFormat,
      examples: this.examples,
    };
  }

  static async deserialize(
    data: SerializedFewShotTemplate
  ): Promise<FewShotPromptTemplate> {
    const {
      prefix,
      prefix_path,
      suffix,
      suffix_path,
      example_prompt,
      example_prompt_path,
    } = data;

    if (example_prompt_path !== undefined && example_prompt !== undefined) {
      throw new Error(
        "Only one of example_prompt and example_prompt_path should be specified."
      );
    }

    let examplePrompt: PromptTemplate;

    if (example_prompt_path !== undefined) {
      examplePrompt = (await loadPrompt(example_prompt_path)) as PromptTemplate;
    } else if (example_prompt !== undefined) {
      examplePrompt = await PromptTemplate.deserialize(example_prompt);
    } else {
      throw new Error(
        "One of example_prompt and example_prompt_path should be specified."
      );
    }

    let examples: Example[];

    if (typeof data.examples === "string") {
      const content = fs.readFileSync(data.examples).toString();
      switch (path.extname(data.examples)) {
        case ".json":
          examples = JSON.parse(content);
          break;
        case ".yml":
        case ".yaml":
          examples = yaml.parse(content);
          break;
        default:
          throw new Error(
            "Invalid file format. Only json or yaml formats are supported."
          );
      }
    } else if (Array.isArray(data.examples)) {
      examples = data.examples;
    } else {
      throw new Error(
        "Invalid examples format. Only list or string are supported."
      );
    }

    return new FewShotPromptTemplate({
      inputVariables: data.input_variables,
      outputParser:
        data.output_parser && BaseOutputParser.deserialize(data.output_parser),
      examplePrompt,
      examples,
      exampleSeparator: data.example_separator,
      prefix: resolveTemplate("prefix", prefix, prefix_path),
      suffix: resolveTemplate("suffix", suffix, suffix_path),
      templateFormat: data.template_format,
    });
  }
}
