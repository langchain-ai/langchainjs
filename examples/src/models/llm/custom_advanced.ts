import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { LLMResult } from "@langchain/core/outputs";
import {
  BaseLLM,
  BaseLLMCallOptions,
  BaseLLMParams,
} from "@langchain/core/language_models/llms";

export interface AdvancedCustomLLMCallOptions extends BaseLLMCallOptions {}

export interface AdvancedCustomLLMParams extends BaseLLMParams {
  n: number;
}

export class AdvancedCustomLLM extends BaseLLM<AdvancedCustomLLMCallOptions> {
  n: number;

  constructor(fields: AdvancedCustomLLMParams) {
    super(fields);
    this.n = fields.n;
  }

  _llmType() {
    return "advanced_custom_llm";
  }

  async _generate(
    inputs: string[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    const outputs = inputs.map((input) => input.slice(0, this.n));
    // One input could generate multiple outputs.
    const generations = outputs.map((output) => [
      {
        text: output,
        // Optional additional metadata for the generation
        generationInfo: { outputCount: 1 },
      },
    ]);
    const tokenUsage = {
      usedTokens: this.n,
    };
    return {
      generations,
      llmOutput: { tokenUsage },
    };
  }
}

const llm = new AdvancedCustomLLM({ n: 4 });

console.log(await llm.invoke("I am an LLM"));

const eventStream = await llm.streamEvents("I am an LLM", {
  version: "v1",
});
for await (const event of eventStream) {
  if (event.event === "on_llm_end") {
    console.log(JSON.stringify(event, null, 2));
  }
}
