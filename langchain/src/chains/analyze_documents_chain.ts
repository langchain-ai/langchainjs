import { BaseChain } from "./base.js";
import {
  TextSplitter,
  RecursiveCharacterTextSplitter,
} from "../text_splitter.js";
import { ChainValues } from "../schema/index.js";
import { SerializedAnalyzeDocumentChain } from "./serde.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

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
    const currentDocs = await this.textSplitter.createDocuments([currentDoc]);

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

    if (!data.combine_document_chain) {
      throw new Error(
        `Need to pass in a combine_document_chain to deserialize AnalyzeDocumentChain.`
      );
    }

    return new AnalyzeDocumentChain({
      combineDocumentsChain: await BaseChain.deserialize(
        data.combine_document_chain
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
