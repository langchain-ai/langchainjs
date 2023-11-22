import type { InputValues, PartialValues } from "../utils/types.js";
import type { SerializedBasePromptTemplate } from "./serde.js";
import { BasePromptTemplate, type BasePromptTemplateInput } from "./base.js";
import { ChatPromptTemplate } from "./chat.js";

/**
 * Type that includes the name of the prompt and the prompt itself.
 */
export type PipelinePromptParams<
  PromptTemplateType extends BasePromptTemplate
> = {
  name: string;
  prompt: PromptTemplateType;
};

/**
 * Type that extends the BasePromptTemplateInput type, excluding the
 * inputVariables property. It includes an array of pipelinePrompts and a
 * finalPrompt.
 */
export type PipelinePromptTemplateInput<
  PromptTemplateType extends BasePromptTemplate
> = Omit<BasePromptTemplateInput, "inputVariables"> & {
  pipelinePrompts: PipelinePromptParams<PromptTemplateType>[];
  finalPrompt: PromptTemplateType;
};

/**
 * Class that handles a sequence of prompts, each of which may require
 * different input variables. Includes methods for formatting these
 * prompts, extracting required input values, and handling partial
 * prompts.
 * @example
 * ```typescript
 * const composedPrompt = new PipelinePromptTemplate({
 *   pipelinePrompts: [
 *     {
 *       name: "introduction",
 *       prompt: PromptTemplate.fromTemplate(`You are impersonating {person}.`),
 *     },
 *     {
 *       name: "example",
 *       prompt: PromptTemplate.fromTemplate(
 *         `Here's an example of an interaction:
 * Q: {example_q}
 * A: {example_a}`,
 *       ),
 *     },
 *     {
 *       name: "start",
 *       prompt: PromptTemplate.fromTemplate(
 *         `Now, do this for real!
 * Q: {input}
 * A:`,
 *       ),
 *     },
 *   ],
 *   finalPrompt: PromptTemplate.fromTemplate(
 *     `{introduction}
 * {example}
 * {start}`,
 *   ),
 * });
 *
 * const formattedPrompt = await composedPrompt.format({
 *   person: "Elon Musk",
 *   example_q: `What's your favorite car?`,
 *   example_a: "Tesla",
 *   input: `What's your favorite social media site?`,
 * });
 * ```
 */
export class PipelinePromptTemplate<
  PromptTemplateType extends BasePromptTemplate
> extends BasePromptTemplate {
  static lc_name() {
    return "PipelinePromptTemplate";
  }

  pipelinePrompts: PipelinePromptParams<PromptTemplateType>[];

  finalPrompt: PromptTemplateType;

  constructor(input: PipelinePromptTemplateInput<PromptTemplateType>) {
    super({ ...input, inputVariables: [] });
    this.pipelinePrompts = input.pipelinePrompts;
    this.finalPrompt = input.finalPrompt;
    this.inputVariables = this.computeInputValues();
  }

  /**
   * Computes the input values required by the pipeline prompts.
   * @returns Array of input values required by the pipeline prompts.
   */
  protected computeInputValues() {
    const intermediateValues = this.pipelinePrompts.map(
      (pipelinePrompt) => pipelinePrompt.name
    );
    const inputValues = this.pipelinePrompts
      .map((pipelinePrompt) =>
        pipelinePrompt.prompt.inputVariables.filter(
          (inputValue) => !intermediateValues.includes(inputValue)
        )
      )
      .flat();
    return [...new Set(inputValues)];
  }

  protected static extractRequiredInputValues(
    allValues: InputValues,
    requiredValueNames: string[]
  ) {
    return requiredValueNames.reduce((requiredValues, valueName) => {
      // eslint-disable-next-line no-param-reassign
      requiredValues[valueName] = allValues[valueName];
      return requiredValues;
    }, {} as InputValues);
  }

  /**
   * Formats the pipeline prompts based on the provided input values.
   * @param values Input values to format the pipeline prompts.
   * @returns Promise that resolves with the formatted input values.
   */
  protected async formatPipelinePrompts(
    values: InputValues
  ): Promise<InputValues> {
    const allValues = await this.mergePartialAndUserVariables(values);
    for (const { name: pipelinePromptName, prompt: pipelinePrompt } of this
      .pipelinePrompts) {
      const pipelinePromptInputValues =
        PipelinePromptTemplate.extractRequiredInputValues(
          allValues,
          pipelinePrompt.inputVariables
        );
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (pipelinePrompt instanceof ChatPromptTemplate) {
        allValues[pipelinePromptName] = await pipelinePrompt.formatMessages(
          pipelinePromptInputValues
        );
      } else {
        allValues[pipelinePromptName] = await pipelinePrompt.format(
          pipelinePromptInputValues
        );
      }
    }
    return PipelinePromptTemplate.extractRequiredInputValues(
      allValues,
      this.finalPrompt.inputVariables
    );
  }

  /**
   * Formats the final prompt value based on the provided input values.
   * @param values Input values to format the final prompt value.
   * @returns Promise that resolves with the formatted final prompt value.
   */
  async formatPromptValue(
    values: InputValues
  ): Promise<PromptTemplateType["PromptValueReturnType"]> {
    return this.finalPrompt.formatPromptValue(
      await this.formatPipelinePrompts(values)
    );
  }

  async format(values: InputValues): Promise<string> {
    return this.finalPrompt.format(await this.formatPipelinePrompts(values));
  }

  /**
   * Handles partial prompts, which are prompts that have been partially
   * filled with input values.
   * @param values Partial input values.
   * @returns Promise that resolves with a new PipelinePromptTemplate instance with updated input variables.
   */
  async partial(
    values: PartialValues
  ): Promise<PipelinePromptTemplate<PromptTemplateType>> {
    const promptDict = { ...this };
    promptDict.inputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    );
    promptDict.partialVariables = {
      ...(this.partialVariables ?? {}),
      ...values,
    };
    return new PipelinePromptTemplate<PromptTemplateType>(promptDict);
  }

  serialize(): SerializedBasePromptTemplate {
    throw new Error("Not implemented.");
  }

  _getPromptType(): string {
    return "pipeline";
  }
}
