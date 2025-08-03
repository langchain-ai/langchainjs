import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { VectorStoreInterface } from "@langchain/core/vectorstores";
import { Tool } from "@langchain/core/tools";
import { VectorDBQAChain } from "../chains/vector_db_qa.js";

/**
 * Interface for tools that interact with a Vector Store.
 */
interface VectorStoreTool {
  vectorStore: VectorStoreInterface;
  llm: BaseLanguageModelInterface;
}

/**
 * A tool for the VectorDBQA chain to interact with a Vector Store. It is
 * used to answer questions about a specific topic. The input to this tool
 * should be a fully formed question.
 */
export class VectorStoreQATool extends Tool implements VectorStoreTool {
  static lc_name() {
    return "VectorStoreQATool";
  }

  vectorStore: VectorStoreInterface;

  llm: BaseLanguageModelInterface;

  name: string;

  description: string;

  chain: VectorDBQAChain;

  constructor(name: string, description: string, fields: VectorStoreTool) {
    super(...arguments);
    this.name = name;
    this.description = description;
    this.vectorStore = fields.vectorStore;
    this.llm = fields.llm;
    this.chain = VectorDBQAChain.fromLLM(this.llm, this.vectorStore);
  }

  /**
   * Returns a string that describes what the tool does.
   * @param name The name of the tool.
   * @param description A description of what the tool does.
   * @returns A string that describes what the tool does.
   */
  static getDescription(name: string, description: string): string {
    return `Useful for when you need to answer questions about ${name}. Whenever you need information about ${description} you should ALWAYS use this. Input should be a fully formed question.`;
  }

  /** @ignore */
  async _call(input: string) {
    return this.chain.run(input);
  }
}
