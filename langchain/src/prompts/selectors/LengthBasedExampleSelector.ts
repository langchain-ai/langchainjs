import type { BaseExampleSelector, Example } from "../base.js";
import { PromptTemplate } from "../prompt.js";

function getLengthBased(text: string): number {
  return text.split(/\n|\s+/).length;
}

export class LengthBasedExampleSelector implements BaseExampleSelector {
  examples!: Example[];

  example_prompt!: PromptTemplate;

  get_text_length: (text: string) => number = getLengthBased;

  max_length = 2048;

  example_text_lengths: number[] = [];

  async addExample(example: Example): Promise<void> {
    this.examples.push(example);
    const stringExample = await this.example_prompt.format(example);
    this.example_text_lengths.push(this.get_text_length(stringExample));
  }

  async calculateExampleTextLengths(
    v: number[],
    values: LengthBasedExampleSelector
  ): Promise<number[]> {
    if (v.length > 0) {
      return v;
    }

    const { examples, example_prompt } = values;
    const stringExamples = await Promise.all(
      examples.map((eg: Example) => example_prompt.format(eg))
    );
    return stringExamples.map((eg: string) => this.get_text_length(eg));
  }

  async selectExamples(inputVariables: Example): Promise<Example[]> {
    const inputs = Object.values(inputVariables).join(" ");
    let remainingLength = this.max_length - this.get_text_length(inputs);
    let i = 0;
    const examples = [];

    while (remainingLength > 0 && i < this.examples.length) {
      const newLength = remainingLength - this.example_text_lengths[i];
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
}
