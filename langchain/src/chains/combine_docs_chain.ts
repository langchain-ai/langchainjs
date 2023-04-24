import type {
  SerializedStuffDocumentsChain,
  SerializedMapReduceDocumentsChain,
  SerializedRefineDocumentsChain,
} from "./serde.js";
import { BaseChain } from "./base.js";
import { LLMChain } from "./llm_chain.js";

import { Document } from "../document.js";

import { ChainValues } from "../schema/index.js";
import { BasePromptTemplate } from "../prompts/base.js";
import { PromptTemplate } from "../prompts/prompt.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";

export interface StuffDocumentsChainInput {
  /** LLM Wrapper to use after formatting documents */
  llmChain: LLMChain;
  inputKey?: string;
  /** Variable name in the LLM chain to put the documents in */
  documentVariableName?: string;
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

  documentVariableName = "context";

  get inputKeys() {
    return [this.inputKey, ...this.llmChain.inputKeys];
  }

  get outputKeys() {
    return this.llmChain.outputKeys;
  }

  constructor(fields: StuffDocumentsChainInput) {
    super();
    this.llmChain = fields.llmChain;
    this.documentVariableName =
      fields.documentVariableName ?? this.documentVariableName;
    this.inputKey = fields.inputKey ?? this.inputKey;
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    if (!(this.inputKey in values)) {
      throw new Error(`Document key ${this.inputKey} not found.`);
    }
    const { [this.inputKey]: docs, ...rest } = values;
    const texts = (docs as Document[]).map(({ pageContent }) => pageContent);
    const text = texts.join("\n\n");
    const result = await this.llmChain.call(
      {
        ...rest,
        [this.documentVariableName]: text,
      },
      runManager?.getChild()
    );
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
  maxTokens?: number;
  maxIterations?: number;
  ensureMapStep?: boolean;
  combineDocumentChain: BaseChain;
}

/**
 * Combine documents by mapping a chain over them, then combining results.
 * @augments BaseChain
 * @augments StuffDocumentsChainInput
 */
export class MapReduceDocumentsChain
  extends BaseChain
  implements MapReduceDocumentsChainInput
{
  llmChain: LLMChain;

  inputKey = "input_documents";

  documentVariableName = "context";

  get inputKeys() {
    return [this.inputKey, ...this.combineDocumentChain.inputKeys];
  }

  get outputKeys() {
    return this.combineDocumentChain.outputKeys;
  }

  maxTokens = 3000;

  maxIterations = 10;

  ensureMapStep = false;

  combineDocumentChain: BaseChain;

  constructor(fields: MapReduceDocumentsChainInput) {
    super();
    this.llmChain = fields.llmChain;
    this.combineDocumentChain = fields.combineDocumentChain;
    this.documentVariableName =
      fields.documentVariableName ?? this.documentVariableName;
    this.ensureMapStep = fields.ensureMapStep ?? this.ensureMapStep;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.maxTokens = fields.maxTokens ?? this.maxTokens;
    this.maxIterations = fields.maxIterations ?? this.maxIterations;
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
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

      const results = await this.llmChain.apply(
        inputs,
        runManager ? [runManager.getChild()] : undefined
      );
      const { outputKey } = this.llmChain;

      currentDocs = results.map((r: ChainValues) => ({
        pageContent: r[outputKey],
      }));
    }
    const newInputs = { input_documents: currentDocs, ...rest };
    const result = await this.combineDocumentChain.call(
      newInputs,
      runManager?.getChild()
    );
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

export interface RefineDocumentsChainInput extends StuffDocumentsChainInput {
  refineLLMChain: LLMChain;
  documentPrompt?: BasePromptTemplate;
  initialResponseName?: string;
  documentVariableName?: string;
  outputKey?: string;
}

/**
 * Combine documents by doing a first pass and then refining on more documents.
 * @augments BaseChain
 * @augments RefineDocumentsChainInput
 */
export class RefineDocumentsChain
  extends BaseChain
  implements RefineDocumentsChainInput
{
  llmChain: LLMChain;

  inputKey = "input_documents";

  outputKey = "output_text";

  documentVariableName = "context";

  initialResponseName = "existing_answer";

  refineLLMChain: LLMChain;

  get defaultDocumentPrompt(): BasePromptTemplate {
    return new PromptTemplate({
      inputVariables: ["page_content"],
      template: "{page_content}",
    });
  }

  documentPrompt = this.defaultDocumentPrompt;

  get inputKeys() {
    return [this.inputKey, ...this.refineLLMChain.inputKeys];
  }

  get outputKeys() {
    return [this.outputKey];
  }

  constructor(fields: RefineDocumentsChainInput) {
    super();
    this.llmChain = fields.llmChain;
    this.refineLLMChain = fields.refineLLMChain;
    this.documentVariableName =
      fields.documentVariableName ?? this.documentVariableName;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.documentPrompt = fields.documentPrompt ?? this.documentPrompt;
    this.initialResponseName =
      fields.initialResponseName ?? this.initialResponseName;
  }

  /** @ignore */
  async _constructInitialInputs(doc: Document, rest: Record<string, unknown>) {
    const baseInfo: Record<string, unknown> = {
      page_content: doc.pageContent,
      ...doc.metadata,
    };
    const documentInfo: Record<string, unknown> = {};
    this.documentPrompt.inputVariables.forEach((value) => {
      documentInfo[value] = baseInfo[value];
    });

    const baseInputs: Record<string, unknown> = {
      [this.documentVariableName]: await this.documentPrompt.format({
        ...documentInfo,
      }),
    };
    const inputs = { ...baseInputs, ...rest };
    return inputs;
  }

  /** @ignore */
  async _constructRefineInputs(doc: Document, res: string) {
    const baseInfo: Record<string, unknown> = {
      page_content: doc.pageContent,
      ...doc.metadata,
    };
    const documentInfo: Record<string, unknown> = {};
    this.documentPrompt.inputVariables.forEach((value) => {
      documentInfo[value] = baseInfo[value];
    });
    const baseInputs: Record<string, unknown> = {
      [this.documentVariableName]: await this.documentPrompt.format({
        ...documentInfo,
      }),
    };
    const inputs = { [this.initialResponseName]: res, ...baseInputs };
    return inputs;
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    if (!(this.inputKey in values)) {
      throw new Error(`Document key ${this.inputKey} not found.`);
    }
    const { [this.inputKey]: docs, ...rest } = values;

    const currentDocs = docs as Document[];

    const initialInputs = await this._constructInitialInputs(
      currentDocs[0],
      rest
    );
    let res = await this.llmChain.predict(
      { ...initialInputs },
      runManager?.getChild()
    );

    const refineSteps = [res];

    for (let i = 1; i < currentDocs.length; i += 1) {
      const refineInputs = await this._constructRefineInputs(
        currentDocs[i],
        res
      );
      const inputs = { ...refineInputs, ...rest };
      res = await this.refineLLMChain.predict(
        { ...inputs },
        runManager?.getChild()
      );
      refineSteps.push(res);
    }

    return { [this.outputKey]: res };
  }

  _chainType() {
    return "refine_documents_chain" as const;
  }

  static async deserialize(data: SerializedRefineDocumentsChain) {
    const SerializedLLMChain = data.llm_chain;

    if (!SerializedLLMChain) {
      throw new Error("Missing llm_chain");
    }

    const SerializedRefineDocumentChain = data.refine_llm_chain;

    if (!SerializedRefineDocumentChain) {
      throw new Error("Missing refine_llm_chain");
    }

    return new RefineDocumentsChain({
      llmChain: await LLMChain.deserialize(SerializedLLMChain),
      refineLLMChain: await LLMChain.deserialize(SerializedRefineDocumentChain),
    });
  }

  serialize(): SerializedRefineDocumentsChain {
    return {
      _type: this._chainType(),
      llm_chain: this.llmChain.serialize(),
      refine_llm_chain: this.refineLLMChain.serialize(),
    };
  }
}
