import { MessageContent, MessageContentComplex } from "../messages/index.js";
import { ImagePromptValue, ImageContent } from "../prompt_values.js";
import type { InputValues, PartialValues } from "../utils/types/index.js";
import {
  BasePromptTemplate,
  BasePromptTemplateInput,
  TypedPromptInputValues,
} from "./base.js";
import {
  TemplateFormat,
  checkValidTemplate,
  renderTemplate,
} from "./template.js";

/**
 * Inputs to create a {@link ImagePromptTemplate}
 * @augments BasePromptTemplateInput
 */
export interface ImagePromptTemplateInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any,
> extends BasePromptTemplateInput<RunInput, PartialVariableName> {
  /**
   * The prompt template
   */
  template: Record<string, unknown>;

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

  /**
   * Additional fields which should be included inside
   * the message content array if using a complex message
   * content.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  additionalContentFields?: MessageContentComplex;
}

/**
 * An image prompt template for a multimodal model.
 */
export class ImagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any,
> extends BasePromptTemplate<RunInput, ImagePromptValue, PartialVariableName> {
  static lc_name() {
    return "ImagePromptTemplate";
  }

  lc_namespace = ["langchain_core", "prompts", "image"];

  template: Record<string, unknown>;

  templateFormat: TemplateFormat = "f-string";

  validateTemplate = true;

  /**
   * Additional fields which should be included inside
   * the message content array if using a complex message
   * content.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  additionalContentFields?: MessageContentComplex;

  constructor(input: ImagePromptTemplateInput<RunInput, PartialVariableName>) {
    super(input);
    this.template = input.template;
    this.templateFormat = input.templateFormat ?? this.templateFormat;
    this.validateTemplate = input.validateTemplate ?? this.validateTemplate;
    this.additionalContentFields = input.additionalContentFields;

    if (this.validateTemplate) {
      let totalInputVariables: string[] = this.inputVariables;
      if (this.partialVariables) {
        totalInputVariables = totalInputVariables.concat(
          Object.keys(this.partialVariables)
        );
      }
      checkValidTemplate(
        [
          { type: "image_url", image_url: this.template },
        ] as unknown as MessageContent,
        this.templateFormat,
        totalInputVariables
      );
    }
  }

  _getPromptType(): "prompt" {
    return "prompt";
  }

  /**
   * Partially applies values to the prompt template.
   * @param values The values to be partially applied to the prompt template.
   * @returns A new instance of ImagePromptTemplate with the partially applied values.
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
    return new ImagePromptTemplate<
      InputValues<
        Exclude<Extract<keyof RunInput, string>, NewPartialVariableName>
      >
    >(promptDict);
  }

  /**
   * Formats the prompt template with the provided values.
   * @param values The values to be used to format the prompt template.
   * @returns A promise that resolves to a string which is the formatted prompt.
   */
  async format<FormatOutput = ImageContent>(
    values: TypedPromptInputValues<RunInput>
  ): Promise<FormatOutput> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatted: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.template)) {
      if (typeof value === "string") {
        formatted[key] = renderTemplate(value, this.templateFormat, values);
      } else {
        formatted[key] = value;
      }
    }
    const url = values.url || formatted.url;
    const detail = values.detail || formatted.detail;
    if (!url) {
      throw new Error("Must provide either an image URL.");
    }
    if (typeof url !== "string") {
      throw new Error("url must be a string.");
    }
    const output: ImageContent = { url };
    if (detail) {
      output.detail = detail;
    }
    return output as FormatOutput;
  }

  /**
   * Formats the prompt given the input values and returns a formatted
   * prompt value.
   * @param values The input values to format the prompt.
   * @returns A Promise that resolves to a formatted prompt value.
   */
  async formatPromptValue(
    values: TypedPromptInputValues<RunInput>
  ): Promise<ImagePromptValue> {
    const formattedPrompt = await this.format(values);
    return new ImagePromptValue(formattedPrompt);
  }
}
