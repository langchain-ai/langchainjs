import { BaseStringPromptTemplate, BasePromptTemplateInput } from "./base.js";
import {
  checkValidTemplate,
  parseTemplate,
  renderTemplate,
  TemplateFormat,
} from "./template.js";
import { resolveTemplateFromFile } from "../util/index.js";
import { SerializedPromptTemplate } from "./serde.js";

/**
 * Inputs to create a {@link PromptTemplate}
 * @augments BasePromptTemplateInput
 */
export interface PromptTemplateInput<K extends string, P extends string>
  extends BasePromptTemplateInput<K, P> {
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
export class PromptTemplate<K extends string, P extends string>
  extends BaseStringPromptTemplate<K, P>
  implements PromptTemplateInput<K, P>
{
  template: string;

  templateFormat: TemplateFormat = "f-string";

  validateTemplate = true;

  constructor(input: PromptTemplateInput<K, P>) {
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

  async format(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<string> {
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
  static fromTemplate<K extends string = string, P extends string = string>(
    template: string,
    {
      templateFormat = "f-string",
      ...rest
    }: Omit<PromptTemplateInput<K, P>, "template" | "inputVariables"> = {}
  ) {
    const names = new Set<K>();
    parseTemplate(template, templateFormat).forEach((node) => {
      if (node.type === "variable") {
        names.add(node.name as K);
      }
    });

    return new PromptTemplate<K, P>({
      inputVariables: [...names],
      templateFormat,
      template,
      ...rest,
    });
  }

  async partial<P2 extends string>(
    values: Record<P2, any>
  ): Promise<PromptTemplate<Exclude<K, P2>, P | P2>> {
    const promptDict: PromptTemplate<Exclude<K, P2>, P | P2> = {
      ...this,
    } as never;
    promptDict.inputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    ) as Exclude<K, P2>[];
    promptDict.partialVariables = {
      ...(this.partialVariables ?? {}),
      ...values,
    } as Record<P | P2, any>;

    return new PromptTemplate<Exclude<K, P2>, P | P2>(promptDict);
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
  ): Promise<PromptTemplate<string, string>> {
    const res = new PromptTemplate({
      inputVariables: data.input_variables,
      template: await resolveTemplateFromFile("template", data),
      templateFormat: data.template_format,
    });
    return res;
  }

  // TODO(from file)
}
