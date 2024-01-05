import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import { BaseChain, ChainInputs } from "langchain/chains";
import { BasePromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { CallbackManagerForChainRun } from "@langchain/core/callbacks/manager";
import { ChainValues } from "@langchain/core/utils/types";

export interface MyCustomChainInputs extends ChainInputs {
  llm: BaseLanguageModelInterface;
  promptTemplate: string;
}

export class MyCustomChain extends BaseChain implements MyCustomChainInputs {
  llm: BaseLanguageModelInterface;

  promptTemplate: string;

  prompt: BasePromptTemplate;

  constructor(fields: MyCustomChainInputs) {
    super(fields);
    this.llm = fields.llm;
    this.promptTemplate = fields.promptTemplate;
    this.prompt = PromptTemplate.fromTemplate(this.promptTemplate);
  }

  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    // Your custom chain logic goes here
    // This is just an example that mimics LLMChain
    const promptValue = await this.prompt.formatPromptValue(values);

    // Whenever you call a language model, or another chain, you should pass
    // a callback manager to it. This allows the inner run to be tracked by
    // any callbacks that are registered on the outer run.
    // You can always obtain a callback manager for this by calling
    // `runManager?.getChild()` as shown below.
    const result = await this.llm.generatePrompt(
      [promptValue],
      {},
      // This tag "a-tag" will be attached to this inner LLM call
      runManager?.getChild("a-tag")
    );

    // If you want to log something about this run, you can do so by calling
    // methods on the runManager, as shown below. This will trigger any
    // callbacks that are registered for that event.
    runManager?.handleText("Log something about this run");

    return { output: result.generations[0][0].text };
  }

  _chainType(): string {
    return "my_custom_chain";
  }

  get inputKeys(): string[] {
    return ["input"];
  }

  get outputKeys(): string[] {
    return ["output"];
  }
}
