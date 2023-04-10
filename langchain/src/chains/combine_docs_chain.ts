import type {
  SerializedStuffDocumentsChain,
  SerializedMapReduceDocumentsChain,
} from "./serde.js";
import { BaseChain } from "./base.js";
import { LLMChain } from "./llm_chain.js";

import { Document } from "../document.js";

import { ChainValues } from "../schema/index.js";

export interface StuffDocumentsChainInput {
  /** LLM Wrapper to use after formatting documents */
  llmChain: LLMChain;
  inputKey: string;
  outputKey: string;
  /** Variable name in the LLM chain to put the documents in */
  documentVariableName: string;
}

/**
 * Chain that combines documents by stuffing into context.
 * @augments BaseChain
 * @augments StuffDocumentsChainInput
 */
export class StuffDocumentsChain
  extends BaseChain
  implements StuffDocumentsChainInput
{
  llmChain: LLMChain;

  inputKey = "input_documents";

  outputKey = "output_text";

  documentVariableName = "context";

  get inputKeys() {
    return [this.inputKey, ...this.llmChain.inputKeys];
  }

  constructor(fields: {
    llmChain: LLMChain;
    inputKey?: string;
    outputKey?: string;
    documentVariableName?: string;
  }) {
    super();
    this.llmChain = fields.llmChain;
    this.documentVariableName =
      fields.documentVariableName ?? this.documentVariableName;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    if (!(this.inputKey in values)) {
      throw new Error(`Document key ${this.inputKey} not found.`);
    }
    const { [this.inputKey]: docs, ...rest } = values;
    const texts = (docs as Document[]).map(({ pageContent }) => pageContent);
    const text = texts.join("\n\n");
    const result = await this.llmChain.call({
      ...rest,
      [this.documentVariableName]: text,
    });
    return result;
  }

  _chainType() {
    return "stuff_documents_chain" as const;
  }

  static async deserialize(data: SerializedStuffDocumentsChain) {
    if (!data.llm_chain) {
      throw new Error("Missing llm_chain");
    }

    return new StuffDocumentsChain({
      llmChain: await LLMChain.deserialize(data.llm_chain),
    });
  }

  serialize(): SerializedStuffDocumentsChain {
    return {
      _type: this._chainType(),
      llm_chain: this.llmChain.serialize(),
    };
  }
}

export interface MapReduceDocumentsChainInput extends StuffDocumentsChainInput {
  maxTokens: number;
  maxIterations: number;
  combineDocumentsChain: BaseChain;
}

/**
 * Chain that combines documents by stuffing into context.
 * @augments BaseChain
 * @augments StuffDocumentsChainInput
 */
export class MapReduceDocumentsChain
  extends BaseChain
  implements StuffDocumentsChainInput
{
  llmChain: LLMChain;

  inputKey = "input_documents";

  outputKey = "output_text";

  documentVariableName = "context";

  get inputKeys() {
    return [this.inputKey, ...this.combineDocumentChain.inputKeys];
  }

  maxTokens = 3000;

  maxIterations = 10;

  ensureMapStep = false;

  combineDocumentChain: BaseChain;

  constructor(fields: {
    llmChain: LLMChain;
    combineDocumentChain: BaseChain;
    ensureMapStep?: boolean;
    inputKey?: string;
    outputKey?: string;
    documentVariableName?: string;
    maxTokens?: number;
    maxIterations?: number;
  }) {
    super();
    this.llmChain = fields.llmChain;
    this.combineDocumentChain = fields.combineDocumentChain;
    this.documentVariableName =
      fields.documentVariableName ?? this.documentVariableName;
    this.ensureMapStep = fields.ensureMapStep ?? this.ensureMapStep;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.maxTokens = fields.maxTokens ?? this.maxTokens;
    this.maxIterations = fields.maxIterations ?? this.maxIterations;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    if (!(this.inputKey in values)) {
      throw new Error(`Document key ${this.inputKey} not found.`);
    }
    const { [this.inputKey]: docs, ...rest } = values;

    let currentDocs = docs as Document[];

    for (let i = 0; i < this.maxIterations; i += 1) {
      const inputs = currentDocs.map((d) => ({
        [this.documentVariableName]: d.pageContent,
        ...rest,
      }));
      const promises = inputs.map(async (i) => {
        const prompt = await this.llmChain.prompt.format(i);
        return this.llmChain.llm.getNumTokens(prompt);
      });

      const length = await Promise.all(promises).then((results) =>
        results.reduce((a, b) => a + b, 0)
      );

      const canSkipMapStep = i !== 0 || !this.ensureMapStep;
      const withinTokenLimit = length < this.maxTokens;
      if (canSkipMapStep && withinTokenLimit) {
        break;
      }

      const results = await this.llmChain.apply(inputs);
      const { outputKey } = this.llmChain;

      currentDocs = results.map((r: ChainValues) => ({
        pageContent: r[outputKey],
      }));
    }
    const newInputs = { input_documents: currentDocs, ...rest };
    const result = await this.combineDocumentChain.call(newInputs);
    return result;
  }

  _chainType() {
    return "map_reduce_documents_chain" as const;
  }

  static async deserialize(data: SerializedMapReduceDocumentsChain) {
    if (!data.llm_chain) {
      throw new Error("Missing llm_chain");
    }

    if (!data.combine_document_chain) {
      throw new Error("Missing combine_document_chain");
    }

    return new MapReduceDocumentsChain({
      llmChain: await LLMChain.deserialize(data.llm_chain),
      combineDocumentChain: await BaseChain.deserialize(
        data.combine_document_chain
      ),
    });
  }

  serialize(): SerializedMapReduceDocumentsChain {
    return {
      _type: this._chainType(),
      llm_chain: this.llmChain.serialize(),
      combine_document_chain: this.combineDocumentChain.serialize(),
    };
  }
}
