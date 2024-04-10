import { MessageContent } from "../messages/index.js";
import {
  GenericObjectPromptValue,
  StringPromptValue,
} from "../prompt_values.js";
import type { InputValues, PartialValues } from "../utils/types/index.js";
import {
  BasePromptTemplate,
  BasePromptTemplateInput,
  TypedPromptInputValues,
} from "./base.js";
import { TemplateFormat, checkValidTemplate } from "./template.js";

/**
 * Inputs to create a {@link GenericObjectPromptTemplate}
 * @augments BasePromptTemplateInput
 */
export interface GenericObjectPromptTemplateInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
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
}

/**
 * A generic prompt template for a multimodal model.
 */
export class GenericObjectPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplate<RunInput, StringPromptValue, PartialVariableName> {
  static lc_name() {
    return "GenericObjectPromptTemplate";
  }

  lc_namespace = ["langchain_core", "prompts", "generic_object"];

  template: Record<string, unknown>;

  templateFormat: TemplateFormat = "f-string";

  validateTemplate = true;

  constructor(
    input: GenericObjectPromptTemplateInput<RunInput, PartialVariableName>
  ) {
    super(input);
    this.template = input.template;
    this.templateFormat = input.templateFormat ?? this.templateFormat;
    this.validateTemplate = input.validateTemplate ?? this.validateTemplate;

    if (this.validateTemplate) {
      let totalInputVariables: string[] = this.inputVariables;
      if (this.partialVariables) {
        totalInputVariables = totalInputVariables.concat(
          Object.keys(this.partialVariables)
        );
      }
      checkValidTemplate(
        [{ type: "generic", data: this.template }] as unknown as MessageContent,
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
   * @returns A new instance of GenericObjectPromptTemplate with the partially applied values.
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
    return new GenericObjectPromptTemplate<
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async format<FormatOutput = Record<string, any>>(
    values: TypedPromptInputValues<RunInput>
  ): Promise<FormatOutput> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatted: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.template)) {
      if (typeof value === "string") {
        formatted[key] = value.replace(/{([^{}]*)}/g, (match, group) => {
          const replacement = values[group];
          return typeof replacement === "string" ||
            typeof replacement === "number"
            ? String(replacement)
            : match;
        });
      } else {
        formatted[key] = value;
      }
    }
    const data = Object.values(values).length ? values : formatted;

    return data as FormatOutput;
  }

  /**
   * Formats the prompt given the input values and returns a formatted
   * prompt value.
   * @param values The input values to format the prompt.
   * @returns A Promise that resolves to a formatted prompt value.
   */
  async formatPromptValue(
    values: TypedPromptInputValues<RunInput>
  ): Promise<GenericObjectPromptValue> {
    const formattedPrompt = await this.format(values);
    return new GenericObjectPromptValue({
      data: formattedPrompt,
    });
  }
}
