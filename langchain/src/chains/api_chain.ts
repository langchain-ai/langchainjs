import { BaseChain, ChainInputs } from "./base.js";
import { SerializedAPIChain } from "./serde.js";
import { LLMChain } from "./llm_chain.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";
import { ChainValues } from "../schema/index.js";
import { API_URL_PROMPT, API_RESPONSE_PROMPT } from "./api/prompts.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

export interface APIChainInput extends Omit<ChainInputs, "memory"> {
  apiAnswerChain: LLMChain;
  apiRequestChain: LLMChain;
  apiDocs: string;
  inputKey?: string;
  /** Key to use for output, defaults to `output` */
  outputKey?: string;
}

export class APIChain extends BaseChain implements APIChainInput {
  apiAnswerChain: LLMChain;

  apiRequestChain: LLMChain;

  apiDocs: string;

  inputKey = "question";

  outputKey = "output";

  get inputKeys() {
    return [this.inputKey];
  }

  get outputKeys() {
    return [this.outputKey];
  }

  constructor(fields: APIChainInput) {
    super(fields);
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.apiAnswerChain = fields.apiAnswerChain;
    this.apiRequestChain = fields.apiRequestChain;
    this.apiDocs = fields.apiDocs;
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    console.log(`Called with values ${JSON.stringify(values)}`);

    const question: string = values[this.inputKey];

    const api_url = await this.apiRequestChain.predict(
      { question, api_docs: this.apiDocs },
      runManager?.getChild()
    );

    await runManager?.handleText(api_url);

    const res = await fetch(api_url);
    const api_response = await res.text();

    await runManager?.handleText(api_response);

    const answer = await this.apiAnswerChain.predict(
      { question, api_docs: this.apiDocs, api_url, api_response },
      runManager?.getChild()
    );

    return { [this.outputKey]: answer };
  }

  _chainType() {
    return "api_chain" as const;
  }

  static async deserialize(data: SerializedAPIChain) {
    const { api_request_chain, api_answer_chain, api_docs } = data;

    if (!api_request_chain) {
      throw new Error("LLMChain must have api_request_chain");
    }
    if (!api_answer_chain) {
      throw new Error("LLMChain must have api_answer_chain");
    }

    if (!api_docs) {
      throw new Error("LLMChain must have api_docs");
    }

    return new APIChain({
      apiAnswerChain: await LLMChain.deserialize(api_answer_chain),
      apiRequestChain: await LLMChain.deserialize(api_request_chain),
      apiDocs: api_docs,
    });
  }

  serialize(): SerializedAPIChain {
    return {
      _type: this._chainType(),
      api_answer_chain: this.apiAnswerChain.serialize(),
      api_request_chain: this.apiRequestChain.serialize(),
      api_docs: this.apiDocs,
    };
  }

  static fromLLMAndApiDocs(
    llm: BaseLanguageModel,
    api_docs: string,
    options?: Partial<
      Omit<APIChainInput, "combineDocumentsChain" | "vectorstore">
    >
  ): APIChain {
    const apiAnswerChain = new LLMChain({ prompt: API_URL_PROMPT, llm });
    const apiRequestChain = new LLMChain({ prompt: API_RESPONSE_PROMPT, llm });
    return new this({
      apiAnswerChain,
      apiRequestChain,
      apiDocs: api_docs,
      ...options,
    });
  }
}
