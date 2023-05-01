import { Document } from "../document.js";
import { BasePromptTemplate, StringPromptValue } from "../prompts/base.js";
import {
  VectorStore,
  VectorStoreRetriever,
  VectorStoreRetrieverInput,
} from "../vectorstores/base.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { BasePromptValue } from "../schema/index.js";

interface HydeRetrieverOptions<V extends VectorStore>
  extends VectorStoreRetrieverInput<V> {
  llm: BaseLanguageModel;
  promptTemplate?: BasePromptTemplate;
}

export class HydeRetriever<
  V extends VectorStore = VectorStore
> extends VectorStoreRetriever<V> {
  llm: BaseLanguageModel;

  promptTemplate?: BasePromptTemplate;

  constructor(fields: HydeRetrieverOptions<V>) {
    super(fields);
    this.llm = fields.llm;
    this.promptTemplate = fields.promptTemplate;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    let value: BasePromptValue = new StringPromptValue(query);

    // Use a custom template if provided
    if (this.promptTemplate) {
      value = await this.promptTemplate.formatPromptValue({ question: query });
    }

    // Get a hypothetical answer from the LLM
    const res = await this.llm.generatePrompt([value]);
    const answer = res.generations[0][0].text;

    // Retrieve relevant documents based on the hypothetical answer
    const results = await this.vectorStore.similaritySearch(
      answer,
      this.k,
      this.filter
    );

    return results;
  }
}
