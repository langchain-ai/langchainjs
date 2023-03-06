import {
  BaseStringPromptTemplate,
  InputValues,
  BasePromptTemplateInput,
  PartialValues,
} from "./index.js";
import {
  TemplateFormat,
  checkValidTemplate,
  renderTemplate,
} from "./template.js";
import {
  resolveTemplateFromFile,
  resolveConfigFromFile,
  parseFileConfig,
} from "../util/index.js";
import { PromptTemplate, SerializedPromptTemplate } from "./prompt.js";
import { SerializedOutputParser, BaseOutputParser } from "./parser.js";

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
  /**
   * Examples to format into the prompt. Exactly one of this or
   * {@link exampleSelector} must be
   * provided.
   */
  examples?: Example[];

  /**
   * An {@link ExampleSelector} Examples to format into the prompt. Exactly one of this or
   * {@link examples} must be
   * provided.
   */
  exampleSelector?: ExampleSelector;

  /**
   * An {@link PromptTemplate} used to format a single example.
   */
  examplePrompt: PromptTemplate;

  /**
   * String separator used to join the prefix, the examples, and suffix.
   */
  exampleSeparator: string;

  /**
   * A prompt template string to put before the examples.
   *
   * @defaultValue `""`
   */
  prefix: string;

  /**
   * A prompt template string to put after the examples.
   */
  suffix: string;

  /**
   * The format of the prompt template. Options are: 'f-string', 'jinja-2'
   */
  templateFormat: TemplateFormat;

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
    const examples = this.getExamples(allValues);

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
    const serializedPrompt = await resolveConfigFromFile<
      "example_prompt",
      SerializedPromptTemplate
    >("example_prompt", data);
    const examplePrompt = await PromptTemplate.deserialize(serializedPrompt);

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
      outputParser:
        data.output_parser && BaseOutputParser.deserialize(data.output_parser),
      examplePrompt,
      examples,
      exampleSeparator: data.example_separator,
      prefix: await resolveTemplateFromFile("prefix", data),
      suffix: await resolveTemplateFromFile("suffix", data),
      templateFormat: data.template_format,
    });
  }
}
