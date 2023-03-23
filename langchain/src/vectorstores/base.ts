import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";
import { BaseRetriever } from "../schema/index.js";
import {
  BaseMemory,
  getInputValue,
  InputValues,
  MemoryVariables,
  OutputValues,
} from "../memory/base.js";
import { PromptTemplate } from "../prompts/prompt.js";

export class VectorStoreRetriever<
  V extends VectorStore = VectorStore
> extends BaseRetriever {
  vectorStore: V;

  k = 4;

  filter?: V["FilterType"];

  constructor(fields: {
    vectorStore: V;
    k?: number;
    filter?: V["FilterType"];
  }) {
    super();
    this.vectorStore = fields.vectorStore;
    this.k = fields.k ?? this.k;
    this.filter = fields.filter;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const results = await this.vectorStore.similaritySearch(
      query,
      this.k,
      this.filter
    );
    return results;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    await this.vectorStore.addDocuments(documents);
  }
}

interface VectorStoreMemoryParams {
  vectorStore: VectorStore;
  k?: number;
  template?: PromptTemplate;
  inputKey?: string;
  outputKey?: string;
  memoryKey?: string;
}

export class VectorStoreMemory extends BaseMemory {
  vectorStore: VectorStore;

  k: number;

  template: PromptTemplate;

  inputKey?: string;

  outputKey?: string;

  memoryKey: string;

  constructor(fields: VectorStoreMemoryParams) {
    super();
    this.vectorStore = fields.vectorStore;
    this.k = fields.k ?? 4;
    this.template =
      fields.template ?? PromptTemplate.fromTemplate("{input}\n\n{output}");
    this.inputKey = fields.inputKey;
    this.outputKey = fields.outputKey;
    this.memoryKey = fields.memoryKey ?? "memory";
  }

  async loadMemoryVariables(values: InputValues): Promise<MemoryVariables> {
    const query = getInputValue(values, this.inputKey);
    const results = await this.vectorStore.similaritySearch(query, this.k);
    return {
      [this.memoryKey]: results,
    };
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const text = await this.template.format({
      input: getInputValue(inputValues, this.inputKey),
      output: getInputValue(outputValues, this.outputKey),
    });
    await this.vectorStore.addDocuments([new Document({ pageContent: text })]);
  }
}

export abstract class VectorStore {
  declare FilterType: object;

  embeddings: Embeddings;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(embeddings: Embeddings, _dbConfig: Record<string, any>) {
    this.embeddings = embeddings;
  }

  abstract addVectors(
    vectors: number[][],
    documents: Document[]
  ): Promise<void>;

  abstract addDocuments(documents: Document[]): Promise<void>;

  abstract similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]>;

  async similaritySearch(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<Document[]> {
    const results = await this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      k,
      filter
    );

    return results.map((result) => result[0]);
  }

  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    return this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      k,
      filter
    );
  }

  static fromTexts(
    _texts: string[],
    _metadatas: object[] | object,
    _embeddings: Embeddings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _dbConfig: Record<string, any>
  ): Promise<VectorStore> {
    throw new Error(
      "the Langchain vectorstore implementation you are using forgot to override this, please report a bug"
    );
  }

  static fromDocuments(
    _docs: Document[],
    _embeddings: Embeddings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _dbConfig: Record<string, any>
  ): Promise<VectorStore> {
    throw new Error(
      "the Langchain vectorstore implementation you are using forgot to override this, please report a bug"
    );
  }

  asRetriever(
    k?: number,
    filter?: this["FilterType"]
  ): VectorStoreRetriever<this> {
    return new VectorStoreRetriever({ vectorStore: this, k, filter });
  }

  asMemory(fields: Omit<VectorStoreMemoryParams, "vectorStore">): BaseMemory {
    return new VectorStoreMemory({ vectorStore: this, ...fields });
  }
}

export abstract class SaveableVectorStore extends VectorStore {
  abstract save(directory: string): Promise<void>;

  static load(
    _directory: string,
    _embeddings: Embeddings
  ): Promise<SaveableVectorStore> {
    throw new Error("Not implemented");
  }
}
