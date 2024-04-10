import { MessageContent } from "../messages/index.js";
import {
  AudioPromptValue,
  StringPromptValue,
  AudioContent,
} from "../prompt_values.js";
import type { InputValues, PartialValues } from "../utils/types/index.js";
import {
  BasePromptTemplate,
  BasePromptTemplateInput,
  TypedPromptInputValues,
} from "./base.js";
import { TemplateFormat, checkValidTemplate } from "./template.js";

/**
 * Inputs to create a {@link AudioPromptTemplate}
 * @augments BasePromptTemplateInput
 */
export interface AudioPromptTemplateInput<
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
 * An audio prompt template for a multimodal model.
 */
export class AudioPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplate<RunInput, StringPromptValue, PartialVariableName> {
  static lc_name() {
    return "AudioPromptTemplate";
  }

  lc_namespace = ["langchain_core", "prompts", "audio"];

  template: Record<string, unknown>;

  templateFormat: TemplateFormat = "f-string";

  validateTemplate = true;

  constructor(input: AudioPromptTemplateInput<RunInput, PartialVariableName>) {
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
        [
          { type: "audio_url", audio_url: this.template },
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
   * @returns A new instance of AudioPromptTemplate with the partially applied values.
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
    return new AudioPromptTemplate<
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
  async format<FormatOutput = AudioContent>(
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
    const url = values.url || formatted.url;

    return { url } as FormatOutput;
  }

  /**
   * Formats the prompt given the input values and returns a formatted
   * prompt value.
   * @param values The input values to format the prompt.
   * @returns A Promise that resolves to a formatted prompt value.
   */
  async formatPromptValue(
    values: TypedPromptInputValues<RunInput>
  ): Promise<AudioPromptValue> {
    const formattedPrompt = await this.format(values);
    return new AudioPromptValue(formattedPrompt);
  }
}
