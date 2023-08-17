import { InputValues, PartialValues } from "../schema/index.js";
import { BasePromptTemplate, BasePromptTemplateInput } from "./base.js";
import { ChatPromptTemplate } from "./chat.js";
import { SerializedBasePromptTemplate } from "./serde.js";

export type PipelinePromptParams<
  PromptTemplateType extends BasePromptTemplate
> = {
  name: string;
  prompt: PromptTemplateType;
};

export type PipelinePromptTemplateInput<
  PromptTemplateType extends BasePromptTemplate
> = Omit<BasePromptTemplateInput, "inputVariables"> & {
  pipelinePrompts: PipelinePromptParams<PromptTemplateType>[];
  finalPrompt: PromptTemplateType;
};

export class PipelinePromptTemplate<
  PromptTemplateType extends BasePromptTemplate
> extends BasePromptTemplate {
  pipelinePrompts: PipelinePromptParams<PromptTemplateType>[];

  finalPrompt: PromptTemplateType;

  constructor(input: PipelinePromptTemplateInput<PromptTemplateType>) {
    super({ ...input, inputVariables: [] });
    this.pipelinePrompts = input.pipelinePrompts;
    this.finalPrompt = input.finalPrompt;
    this.inputVariables = this.computeInputValues();
  }

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
