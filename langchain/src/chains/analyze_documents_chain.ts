import { BaseChain, ChainInputs } from "./base.js";
import {
  TextSplitter,
  RecursiveCharacterTextSplitter,
} from "../text_splitter.js";
import { ChainValues } from "../schema/index.js";
import { SerializedAnalyzeDocumentChain } from "./serde.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

/**
 * Interface for the input parameters required by the AnalyzeDocumentChain
 * class.
 */
export interface AnalyzeDocumentChainInput extends Omit<ChainInputs, "memory"> {
  combineDocumentsChain: BaseChain;
  textSplitter?: TextSplitter;
  inputKey?: string;
}

/**
 * Chain that combines documents by stuffing into context.
 * @augments BaseChain
 * @augments StuffDocumentsChainInput
 * @example
 * ```typescript
 * const model = new ChatOpenAI({ temperature: 0 });
 * const combineDocsChain = loadSummarizationChain(model);
 * const chain = new AnalyzeDocumentChain({
 *   combineDocumentsChain: combineDocsChain,
 * });
 *
 * // Read the text from a file (this is a placeholder for actual file reading)
 * const text = readTextFromFile("state_of_the_union.txt");
 *
 * // Invoke the chain to analyze the document
 * const res = await chain.call({
 *   input_document: text,
 * });
 *
 * console.log({ res });
 * ```
 */
export class AnalyzeDocumentChain
  extends BaseChain
  implements AnalyzeDocumentChainInput
{
  static lc_name() {
    return "AnalyzeDocumentChain";
  }

  inputKey = "input_document";

  combineDocumentsChain: BaseChain;

  textSplitter: TextSplitter;

  constructor(fields: AnalyzeDocumentChainInput) {
    super(fields);
    this.combineDocumentsChain = fields.combineDocumentsChain;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.textSplitter =
      fields.textSplitter ?? new RecursiveCharacterTextSplitter();
  }

  get inputKeys(): string[] {
    return [this.inputKey];
  }

  get outputKeys(): string[] {
    return this.combineDocumentsChain.outputKeys;
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    if (!(this.inputKey in values)) {
      throw new Error(`Document key ${this.inputKey} not found.`);
    }
    const { [this.inputKey]: doc, ...rest } = values;

    const currentDoc = doc as string;
    const currentDocs = await this.textSplitter.createDocuments([currentDoc]);

    const newInputs = { input_documents: currentDocs, ...rest };
    const result = await this.combineDocumentsChain.call(
      newInputs,
      runManager?.getChild("combine_documents")
    );
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
