import {
  BaseStringPromptTemplate,
  BasePromptTemplateInput,
  BaseExampleSelector,
} from "./base.js";
import {
  TemplateFormat,
  checkValidTemplate,
  renderTemplate,
} from "./template.js";
import { parseFileConfig } from "../util/parse.js";
import { PromptTemplate } from "./prompt.js";
import { SerializedFewShotTemplate } from "./serde.js";
import { Example, InputValues, PartialValues } from "../schema/index.js";

export interface FewShotPromptTemplateInput extends BasePromptTemplateInput {
  /**
   * Examples to format into the prompt. Exactly one of this or
   * {@link exampleSelector} must be
   * provided.
   */
  examples?: Example[];

  /**
   * An {@link BaseExampleSelector} Examples to format into the prompt. Exactly one of this or
   * {@link examples} must be
   * provided.
   */
  exampleSelector?: BaseExampleSelector;

  /**
   * An {@link PromptTemplate} used to format a single example.
   */
  examplePrompt: PromptTemplate;

  /**
   * String separator used to join the prefix, the examples, and suffix.
   */
  exampleSeparator?: string;

  /**
   * A prompt template string to put before the examples.
   *
   * @defaultValue `""`
   */
  prefix?: string;

  /**
   * A prompt template string to put after the examples.
   */
  suffix?: string;

  /**
   * The format of the prompt template. Options are: 'f-string', 'jinja-2'
   */
  templateFormat?: TemplateFormat;

  /**
   * Whether or not to try validating the template on initialization.
   */
  validateTemplate?: boolean;
}

/**
 * Prompt template that contains few-shot examples.
 * @augments BasePromptTemplate
 * @augments FewShotPromptTemplateInput
 */
export class FewShotPromptTemplate
  extends BaseStringPromptTemplate
  implements FewShotPromptTemplateInput
{
  examples?: InputValues[];

  exampleSelector?: BaseExampleSelector | undefined;

  examplePrompt: PromptTemplate;

  suffix = "";

  exampleSeparator = "\n\n";

  prefix = "";

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
      let totalInputVariables = this.inputVariables;
      if (this.partialVariables) {
        totalInputVariables = totalInputVariables.concat(
          Object.keys(this.partialVariables)
        );
      }
      checkValidTemplate(
        this.prefix + this.suffix,
        this.templateFormat,
        totalInputVariables
      );
    }
  }

  _getPromptType(): "few_shot" {
    return "few_shot";
  }

  private async getExamples(
    inputVariables: InputValues
  ): Promise<InputValues[]> {
    if (this.examples !== undefined) {
      return this.examples;
    }
    if (this.exampleSelector !== undefined) {
      return this.exampleSelector.selectExamples(inputVariables);
    }

    throw new Error(
      "One of 'examples' and 'example_selector' should be provided"
    );
  }

  async partial(values: PartialValues): Promise<FewShotPromptTemplate> {
    const promptDict: FewShotPromptTemplate = { ...this };
    promptDict.inputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    );
    promptDict.partialVariables = {
      ...(this.partialVariables ?? {}),
      ...values,
    };
    return new FewShotPromptTemplate(promptDict);
  }

  async format(values: InputValues): Promise<string> {
    const allValues = await this.mergePartialAndUserVariables(values);
    const examples = await this.getExamples(allValues);

    const exampleStrings = await Promise.all(
      examples.map((example) => this.examplePrompt.format(example))
    );
    const template = [this.prefix, ...exampleStrings, this.suffix].join(
      this.exampleSeparator
    );
    return renderTemplate(template, this.templateFormat, allValues);
  }

  serialize(): SerializedFewShotTemplate {
    if (this.exampleSelector || !this.examples) {
      throw new Error(
        "Serializing an example selector is not currently supported"
      );
    }
    if (this.outputParser !== undefined) {
      throw new Error(
        "Serializing an output parser is not currently supported"
      );
    }
    return {
      _type: this._getPromptType(),
      input_variables: this.inputVariables,
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
    const { example_prompt } = data;
    if (!example_prompt) {
      throw new Error("Missing example prompt");
    }
    const examplePrompt = await PromptTemplate.deserialize(example_prompt);

    let examples: Example[];

    if (typeof data.examples === "string") {
      examples = await parseFileConfig(data.examples, ".json", [
        ".json",
        ".yml",
        ".yaml",
      ]);
    } else if (Array.isArray(data.examples)) {
      examples = data.examples;
    } else {
      throw new Error(
        "Invalid examples format. Only list or string are supported."
      );
    }

    return new FewShotPromptTemplate({
      inputVariables: data.input_variables,
      examplePrompt,
      examples,
      exampleSeparator: data.example_separator,
      prefix: data.prefix,
      suffix: data.suffix,
      templateFormat: data.template_format,
    });
  }
}
