import { BasePromptTemplate, PromptTemplate } from "langchain/prompts";
import { BaseLanguageModel } from "langchain/base_language";
import { CallbackManagerForChainRun } from "langchain/callbacks";
import { BaseChain, ChainInputs } from "langchain/chains";
import { ChainValues } from "langchain/schema";

export interface MyCustomChainInputs extends ChainInputs {
  llm: BaseLanguageModel;
  promptTemplate: string;
}

export class MyCustomChain extends BaseChain implements MyCustomChainInputs {
  llm: BaseLanguageModel;

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
      runManager?.getChild()
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
