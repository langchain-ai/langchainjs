import { Example } from "../../schema/index.js";
import type { BaseExampleSelector } from "../base.js";
import { PromptTemplate } from "../prompt.js";

function getLengthBased(text: string): number {
  return text.split(/\n| /).length;
}

interface LengthBasedExampleSelectorArgs {
  examplePrompt: PromptTemplate;
  maxLength?: number;
  getTextLength?: (text: string) => number;
}

export class LengthBasedExampleSelector implements BaseExampleSelector {
  protected examples: Example[] = [];

  examplePrompt!: PromptTemplate;

  getTextLength: (text: string) => number = getLengthBased;

  maxLength = 2048;

  exampleTextLengths: number[] = [];

  constructor(data: LengthBasedExampleSelectorArgs) {
    this.examplePrompt = data.examplePrompt;
    this.maxLength = data.maxLength ?? 2048;
    this.getTextLength = data.getTextLength ?? getLengthBased;
  }

  async addExample(example: Example): Promise<void> {
    this.examples.push(example);
    const stringExample = await this.examplePrompt.format(example);
    this.exampleTextLengths.push(this.getTextLength(stringExample));
  }

  async calculateExampleTextLengths(
    v: number[],
    values: LengthBasedExampleSelector
  ): Promise<number[]> {
    if (v.length > 0) {
      return v;
    }

    const { examples, examplePrompt } = values;
    const stringExamples = await Promise.all(
      examples.map((eg: Example) => examplePrompt.format(eg))
    );
    return stringExamples.map((eg: string) => this.getTextLength(eg));
  }

  async selectExamples(inputVariables: Example): Promise<Example[]> {
    const inputs = Object.values(inputVariables).join(" ");
    let remainingLength = this.maxLength - this.getTextLength(inputs);
    let i = 0;
    const examples: Example[] = [];

    while (remainingLength > 0 && i < this.examples.length) {
      const newLength = remainingLength - this.exampleTextLengths[i];
      if (newLength < 0) {
        break;
      } else {
        examples.push(this.examples[i]);
        remainingLength = newLength;
      }
      i += 1;
    }

    return examples;
  }

  static async fromExamples(
    examples: Example[],
    args: LengthBasedExampleSelectorArgs
  ) {
    const selector = new LengthBasedExampleSelector(args);
    await Promise.all(examples.map((eg) => selector.addExample(eg)));
    return selector;
  }
}
