import { BaseChain, ChainInputs } from "./base.js";
import { BaseMemory, BufferMemory } from "../memory/index.js";
import { PromptTemplate } from "../prompts/prompt.js";
import { BasePromptTemplate } from "../prompts/base.js";
import { BaseLanguageModel } from "../base_language/index.js";
import {
  ChainValues,
  Generation,
  BasePromptValue,
  BaseOutputParser,
} from "../schema/index.js";
import { SerializedLLMChain } from "./serde.js";

export interface LLMChainInput extends ChainInputs {
  /** Prompt object to use */
  prompt: BasePromptTemplate;
  /** LLM Wrapper to use */
  llm: BaseLanguageModel;
  /** OutputParser to use */
  outputParser?: BaseOutputParser;

  /** @ignore */
  outputKey?: string;
}

/**
 * Chain to run queries against LLMs.
 * @augments BaseChain
 * @augments LLMChainInput
 *
 * @example
 * ```ts
 * import { LLMChain, OpenAI, PromptTemplate } from "langchain";
 * const prompt = PromptTemplate.fromTemplate("Tell me a {adjective} joke");
 * const llm = LLMChain({ llm: new OpenAI(), prompt });
 * ```
 */
export class LLMChain extends BaseChain implements LLMChainInput {
  prompt: BasePromptTemplate;

  llm: BaseLanguageModel;

  outputKey = "text";

  outputParser?: BaseOutputParser;

  get inputKeys() {
    return this.prompt.inputVariables;
  }

  constructor(fields: LLMChainInput) {
    super(fields.memory, fields.verbose, fields.callbackManager);
    this.prompt = fields.prompt;
    this.llm = fields.llm;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.outputParser = fields.outputParser ?? this.outputParser;
    if (this.prompt.outputParser) {
      if (this.outputParser) {
        throw new Error("Cannot set both outputParser and prompt.outputParser");
      }
      this.outputParser = this.prompt.outputParser;
    }
  }

  async _getFinalOutput(
    generations: Generation[],
    promptValue: BasePromptValue
  ): Promise<unknown> {
    const completion = generations[0].text;
    let finalCompletion: unknown;
    if (this.outputParser) {
      finalCompletion = await this.outputParser.parseWithPrompt(
        completion,
        promptValue
      );
    } else {
      finalCompletion = completion;
    }
    return finalCompletion;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    let stop;
    if ("stop" in values && Array.isArray(values.stop)) {
      stop = values.stop;
    }
    const promptValue = await this.prompt.formatPromptValue(values);
    const { generations } = await this.llm.generatePrompt([promptValue], stop);
    return {
      [this.outputKey]: await this._getFinalOutput(generations[0], promptValue),
    };
  }

  /**
   * Format prompt with values and pass to LLM
   *
   * @param values - keys to pass to prompt template
   * @returns Completion from LLM.
   *
   * @example
   * ```ts
   * llm.predict({ adjective: "funny" })
   * ```
   */
  async predict(values: ChainValues): Promise<string> {
    const output = await this.call(values);
    return output[this.outputKey];
  }

  _chainType() {
    return "llm_chain" as const;
  }

  static async deserialize(data: SerializedLLMChain) {
    const { llm, prompt } = data;
    if (!llm) {
      throw new Error("LLMChain must have llm");
    }
    if (!prompt) {
      throw new Error("LLMChain must have prompt");
    }

    return new LLMChain({
      llm: await BaseLanguageModel.deserialize(llm),
      prompt: await BasePromptTemplate.deserialize(prompt),
    });
  }

  serialize(): SerializedLLMChain {
    return {
      _type: this._chainType(),
      llm: this.llm.serialize(),
      prompt: this.prompt.serialize(),
    };
  }
}

// eslint-disable-next-line max-len
const defaultTemplate = `The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

Current conversation:
{history}
Human: {input}
AI:`;

export class ConversationChain extends LLMChain {
  constructor(fields: {
    llm: BaseLanguageModel;
    prompt?: BasePromptTemplate;
    outputKey?: string;
    memory?: BaseMemory;
  }) {
    super({
      prompt:
        fields.prompt ??
        new PromptTemplate({
          template: defaultTemplate,
          inputVariables: ["history", "input"],
        }),
      llm: fields.llm,
      outputKey: fields.outputKey ?? "response",
    });
    this.memory = fields.memory ?? new BufferMemory();
  }
}
