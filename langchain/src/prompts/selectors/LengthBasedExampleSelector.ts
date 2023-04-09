import { Example } from "../../schema/index.js";
import type { BaseExampleSelector } from "../base.js";
import { PromptTemplate } from "../prompt.js";

function getLengthBased(text: string): number {
  return text.split(/\n| /).length;
}

interface LengthBasedExampleSelectorArgs<K extends string, P extends string> {
  examplePrompt: PromptTemplate<K, P>;
  maxLength?: number;
  getTextLength?: (text: string) => number;
}

export class LengthBasedExampleSelector<K extends string, P extends string>
  implements BaseExampleSelector<K, P>
{
  protected examples: Example<K, P>[] = [];

  examplePrompt!: PromptTemplate<K, P>;

  getTextLength: (text: string) => number = getLengthBased;

  maxLength = 2048;

  exampleTextLengths: number[] = [];

  constructor(data: LengthBasedExampleSelectorArgs<K, P>) {
    this.examplePrompt = data.examplePrompt;
    this.maxLength = data.maxLength ?? 2048;
    this.getTextLength = data.getTextLength ?? getLengthBased;
  }

  async addExample(example: Example<K, P>): Promise<void> {
    this.examples.push(example);
    const stringExample = await this.examplePrompt.format(example);
    this.exampleTextLengths.push(this.getTextLength(stringExample));
  }

  async calculateExampleTextLengths(
    v: number[],
    values: LengthBasedExampleSelector<K, P>
  ): Promise<number[]> {
    if (v.length > 0) {
      return v;
    }

    const { examples, examplePrompt } = values;
    const stringExamples = await Promise.all(
      examples.map((eg: Example<K, P>) => examplePrompt.format(eg))
    );
    return stringExamples.map((eg: string) => this.getTextLength(eg));
  }

  async selectExamples(
    inputVariables: Example<K, P>
  ): Promise<Example<K, P>[]> {
    const inputs = Object.values(inputVariables).join(" ");
    let remainingLength = this.maxLength - this.getTextLength(inputs);
    let i = 0;
    const examples: Example<K, P>[] = [];

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

  static async fromExamples<K extends string, P extends string>(
    examples: Example<K, P>[],
    args: LengthBasedExampleSelectorArgs<K, P>
  ) {
    const selector = new LengthBasedExampleSelector(args);
    await Promise.all(examples.map((eg) => selector.addExample(eg)));
    return selector;
  }
}
