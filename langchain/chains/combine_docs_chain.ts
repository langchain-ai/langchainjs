import { BaseChain, ChainValues, LLMChain, SerializedLLMChain } from "./index";

import { Document } from "../document";

import { resolveConfigFromFile } from "../util";

export interface StuffDocumentsChainInput {
  llmChain: LLMChain;
  inputKey: string;
  outputKey: string;
  documentVariableName: string;
}

export type SerializedStuffDocumentsChain = {
  _type: "stuff_documents_chain";
  llm_chain?: SerializedLLMChain;
  llm_chain_path?: string;
};

export class StuffDocumentsChain extends BaseChain implements StuffDocumentsChainInput {
  llmChain: LLMChain;

  inputKey = "input_documents";

  outputKey = "output_text";

  documentVariableName = "context";

  constructor(fields: {
    llmChain: LLMChain;
    inputKey?: string;
    outputKey?: string;
    documentVariableName?: string;
  }) {
    super();
    this.llmChain = fields.llmChain;
    this.documentVariableName = fields.documentVariableName ?? this.documentVariableName;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    if (!(this.inputKey in values)) {
        throw new Error(`Document key ${  this.inputKey  } not found.`);
      }
    const docs: Document[] = values[this.inputKey];
    const texts = docs.map(({ pageContent }) => pageContent);
    const text = texts.join("\n\n");
    delete values[this.inputKey];
    values[this.documentVariableName] = text;
    const result = await this.llmChain.call(values);
    return result;
  }

  _chainType() {
    return "stuff_documents_chain" as const;
  }

  static async deserialize(data: SerializedStuffDocumentsChain) {
    const SerializedLLMChain = resolveConfigFromFile<"llm_chain", SerializedLLMChain>(
      "llm_chain",
      data
    );

    return new StuffDocumentsChain({
      llmChain: await LLMChain.deserialize(SerializedLLMChain),
    });
  }

  serialize(): SerializedStuffDocumentsChain {
    return {
      _type: this._chainType(),
      llm_chain: this.llmChain.serialize(),
    };
  }
}