import { BaseChain, ChainValues, SerializedBaseChain } from "./index.js";

import {
  TextSplitter,
  RecursiveCharacterTextSplitter,
} from "../text_splitter.js";

import { resolveConfigFromFile } from "../util/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

export type SerializedAnalyzeDocumentChain = {
  _type: "analyze_document_chain";
  combine_document_chain?: SerializedBaseChain;
  combine_document_chain_path?: string;
};

export interface AnalyzeDocumentChainInput {
  textSplitter: TextSplitter;
  combineDocumentsChain: BaseChain;
}

/**
 * Chain that combines documents by stuffing into context.
 * @augments BaseChain
 * @augments StuffDocumentsChainInput
 */
export class AnalyzeDocumentChain
  extends BaseChain
  implements AnalyzeDocumentChainInput
{
  inputKey = "input_document";

  outputKey = "output_text";

  combineDocumentsChain: BaseChain;

  textSplitter: TextSplitter;

  constructor(fields: {
    combineDocumentsChain: BaseChain;
    inputKey?: string;
    outputKey?: string;
    textSplitter?: TextSplitter;
  }) {
    super();
    this.combineDocumentsChain = fields.combineDocumentsChain;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.textSplitter =
      fields.textSplitter ?? new RecursiveCharacterTextSplitter();
  }

  get inputKeys(): string[] {
    return [this.inputKey];
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    if (!(this.inputKey in values)) {
      throw new Error(`Document key ${this.inputKey} not found.`);
    }
    const { [this.inputKey]: doc, ...rest } = values;

    const currentDoc = doc as string;
    const currentDocs = this.textSplitter.createDocuments([currentDoc]);

    const newInputs = { input_documents: currentDocs, ...rest };
    const result = await this.combineDocumentsChain.call(newInputs);
    return result;
  }

  _chainType() {
    return "analyze_document_chain" as const;
  }

  static async deserialize(
    data: SerializedAnalyzeDocumentChain,
    values: LoadValues
  ) {
    if (!("text_splitter" in values)) {
      throw new Error(
        `Need to pass in a text_splitter to deserialize AnalyzeDocumentChain.`
      );
    }
    const { text_splitter } = values;

    const SerializedCombineDocumentChain = await resolveConfigFromFile<
      "combine_document_chain",
      SerializedBaseChain
    >("combine_document_chain", data);

    return new AnalyzeDocumentChain({
      combineDocumentsChain: await BaseChain.deserialize(
        SerializedCombineDocumentChain
      ),
      textSplitter: text_splitter,
    });
  }

  serialize(): SerializedAnalyzeDocumentChain {
    return {
      _type: this._chainType(),
      combine_document_chain: this.combineDocumentsChain.serialize(),
    };
  }
}
