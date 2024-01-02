import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import type { CallbackManagerForLLMRun } from "langchain/callbacks";
import { GenerationChunk } from "langchain/schema";

export interface CustomLLMInput extends BaseLLMParams {
  n: number;
}

export class CustomLLM extends LLM {
  n: number;

  constructor(fields: CustomLLMInput) {
    super(fields);
    this.n = fields.n;
  }

  _llmType() {
    return "custom";
  }

  async _call(
    prompt: string,
    _options: this["ParsedCallOptions"],
    // Can pass runManager into sub runs for tracing
    _runManager: CallbackManagerForLLMRun
  ): Promise<string> {
    return prompt.slice(0, this.n);
  }

  async *_streamResponseChunks(
    prompt: string,
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    for (const letter of prompt.slice(0, this.n)) {
      yield new GenerationChunk({
        text: letter,
      });
      await runManager?.handleLLMNewToken(letter);
    }
  }
}

const llm = new CustomLLM({ n: 4 });
await llm.invoke("I am an LLM");

const stream = await llm.stream("I am an LLM");
for await (const chunk of stream) {
  console.log(chunk);
}
