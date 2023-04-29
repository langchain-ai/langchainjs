import { Document } from "document.js";
import { PromptTemplate } from "index.js";
import { LLM } from "llms/base.js";
import { VectorStore, VectorStoreRetriever } from "vectorstores/base.js";

interface HydeRetrieverOptions {
  llm: LLM;
  promptTemplate?: PromptTemplate;
  vectorStore: VectorStore;
  k?: number;
  filter?: VectorStore["FilterType"];
}

export class HydeRetriever extends VectorStoreRetriever {
  llm: LLM;
  promptTemplate?: PromptTemplate;

  constructor(fields: HydeRetrieverOptions) {
    super({
      vectorStore: fields.vectorStore,
      k: fields.k,
      filter: fields.filter,
    });
    this.llm = fields.llm;
    this.promptTemplate = fields.promptTemplate;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    // Use a custom template if provided
    if (this.promptTemplate) {
      query = await this.promptTemplate.format({ question: query });
    }

    // Get a hypothetical answer from the LLM
    const res = await this.llm.call(query);

    // Retrieve relevant documents based on the hypothetical answer
    const results = await this.vectorStore.similaritySearch(
      res,
      this.k,
      this.filter
    );

    return results;
  }
}
