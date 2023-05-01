import { Document } from "../document.js";
import { VectorStoreRetriever } from "../vectorstores/base.js";
import {
  BaseMemory,
  getInputValue,
  InputValues,
  MemoryVariables,
  OutputValues,
} from "./base.js";

export interface VectorStoreRetrieverMemoryParams {
  vectorStoreRetriever: VectorStoreRetriever;
  inputKey?: string;
  outputKey?: string;
  memoryKey?: string;
  returnDocs?: boolean;
}

export class VectorStoreRetrieverMemory
  extends BaseMemory
  implements VectorStoreRetrieverMemoryParams
{
  vectorStoreRetriever: VectorStoreRetriever;

  inputKey?: string;

  memoryKey: string;

  returnDocs: boolean;

  constructor(fields: VectorStoreRetrieverMemoryParams) {
    super();
    this.vectorStoreRetriever = fields.vectorStoreRetriever;
    this.inputKey = fields.inputKey;
    this.memoryKey = fields.memoryKey ?? "memory";
    this.returnDocs = fields.returnDocs ?? false;
  }

  get memoryKeys(): string[] {
    return [this.memoryKey];
  }

  async loadMemoryVariables(values: InputValues): Promise<MemoryVariables> {
    const query = getInputValue(values, this.inputKey);
    const results = await this.vectorStoreRetriever.getRelevantDocuments(query);
    return {
      [this.memoryKey]: this.returnDocs
        ? results
        : results.map((r) => r.pageContent).join("\n"),
    };
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const text = Object.entries(inputValues)
      .filter(([k]) => k !== this.memoryKey)
      .concat(Object.entries(outputValues))
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    await this.vectorStoreRetriever.addDocuments([
      new Document({ pageContent: text }),
    ]);
  }
}
