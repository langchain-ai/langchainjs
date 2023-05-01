import { Document } from "../document.js";
import { BasePromptTemplate, StringPromptValue } from "../prompts/base.js";
import { PromptTemplate } from "../prompts/prompt.js";
import {
  VectorStore,
  VectorStoreRetriever,
  VectorStoreRetrieverInput,
} from "../vectorstores/base.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { BasePromptValue } from "../schema/index.js";

export type PromptKey =
  | "websearch"
  | "scifact"
  | "arguana"
  | "trec-covid"
  | "fiqa"
  | "dbpedia-entity"
  | "trec-news"
  | "mr-tydi";

export interface HydeRetrieverOptions<V extends VectorStore>
  extends VectorStoreRetrieverInput<V> {
  llm: BaseLanguageModel;
  promptTemplate?: BasePromptTemplate | PromptKey;
}

export class HydeRetriever<
  V extends VectorStore = VectorStore
> extends VectorStoreRetriever<V> {
  llm: BaseLanguageModel;

  promptTemplate?: BasePromptTemplate;

  constructor(fields: HydeRetrieverOptions<V>) {
    super(fields);
    this.llm = fields.llm;
    this.promptTemplate =
      typeof fields.promptTemplate === "string"
        ? getPromptTemplateFromKey(fields.promptTemplate)
        : fields.promptTemplate;
    if (this.promptTemplate) {
      const { inputVariables } = this.promptTemplate;
      if (inputVariables.length !== 1 && inputVariables[0] !== "question") {
        throw new Error(
          `Prompt template must accept a single input variable 'question'. Invalid input variables for prompt template: ${inputVariables}`
        );
      }
    }
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

export function getPromptTemplateFromKey(key: PromptKey): BasePromptTemplate {
  let template: string;

  switch (key) {
    case "websearch":
      template = `Please write a passage to answer the question 
Question: {question}
Passage:`;
      break;
    case "scifact":
      template = `Please write a scientific paper passage to support/refute the claim 
Claim: {question}
Passage:`;
      break;
    case "arguana":
      template = `Please write a counter argument for the passage 
Passage: {question}
Counter Argument:`;
      break;
    case "trec-covid":
      template = `Please write a scientific paper passage to answer the question
Question: {question}
Passage:`;
      break;
    case "fiqa":
      template = `Please write a financial article passage to answer the question
Question: {question}
Passage:`;
      break;
    case "dbpedia-entity":
      template = `Please write a passage to answer the question.
Question: {question}
Passage:`;
      break;
    case "trec-news":
      template = `Please write a news passage about the topic.
Topic: {question}
Passage:`;
      break;
    case "mr-tydi":
      template = `Please write a passage in Swahili/Korean/Japanese/Bengali to answer the question in detail.
Question: {question}
Passage:`;
      break;
    default:
      throw new Error(`Invalid prompt key: ${key}`);
  }

  return PromptTemplate.fromTemplate(template);
}
