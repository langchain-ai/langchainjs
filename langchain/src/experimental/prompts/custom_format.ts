import type { InputValues } from "@langchain/core/utils/types";
import {
  type ParsedFStringNode,
  PromptTemplate,
  type PromptTemplateInput,
  TypedPromptInputValues,
} from "@langchain/core/prompts";

export type CustomFormatPromptTemplateInput<RunInput extends InputValues> =
  Omit<PromptTemplateInput<RunInput, string>, "templateFormat"> & {
    customParser: (template: string) => ParsedFStringNode[];
    templateValidator?: (template: string, inputVariables: string[]) => boolean;
    renderer: (template: string, values: InputValues) => string;
  };

export class CustomFormatPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any,
> extends PromptTemplate<RunInput, PartialVariableName> {
  static lc_name() {
    return "CustomPromptTemplate";
  }

  lc_serializable = false;

  templateValidator?: (template: string, inputVariables: string[]) => boolean;

  renderer: (template: string, values: InputValues) => string;

  constructor(input: CustomFormatPromptTemplateInput<RunInput>) {
    super(input);
    Object.assign(this, input);

    if (this.validateTemplate && this.templateValidator !== undefined) {
      let totalInputVariables: string[] = this.inputVariables;
      if (this.partialVariables) {
        totalInputVariables = totalInputVariables.concat(
          Object.keys(this.partialVariables)
        );
      }
      if (typeof this.template === "string") {
        this.templateValidator(this.template, totalInputVariables);
      } else {
        throw new Error(
          `Must pass in string as template. Received: ${this.template}`
        );
      }
    }
  }

  /**
   * Load prompt template from a template
   */
  static fromTemplate<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunInput extends InputValues = Record<string, any>,
  >(
    template: string,
    {
      customParser,
      ...rest
    }: Omit<
      CustomFormatPromptTemplateInput<RunInput>,
      "template" | "inputVariables"
    >
  ) {
    const names = new Set<string>();
    const nodes = customParser(template);
    for (const node of nodes) {
      if (node.type === "variable") {
        names.add(node.name);
      }
    }
    // eslint-disable-next-line @typescript-eslint/ban-types
    return new this<RunInput extends Symbol ? never : RunInput>({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputVariables: [...names] as any[],
      template,
      customParser,
      ...rest,
    });
  }

  /**
   * Formats the prompt template with the provided values.
   * @param values The values to be used to format the prompt template.
   * @returns A promise that resolves to a string which is the formatted prompt.
   */
  async format(values: TypedPromptInputValues<RunInput>): Promise<string> {
    const allValues = await this.mergePartialAndUserVariables(values);
    if (typeof this.template === "string") {
      return this.renderer(this.template, allValues);
    } else {
      throw new Error(
        `Must pass in string as template. Received: ${this.template}`
      );
    }
  }
}
