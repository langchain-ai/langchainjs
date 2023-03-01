import { VectorStore } from "../../vectorstores/index.js";
import { BaseLLM } from "../../llms/index.js";
import { VectorDBQAChain } from "../../chains/index.js";
import { Tool } from "./base.js";

interface VectorStoreTool {
  vectorStore: VectorStore;
  llm: BaseLLM;
}

export class VectorStoreQATool extends Tool implements VectorStoreTool {
  vectorStore: VectorStore;

  llm: BaseLLM;

  name: string;

  description: string;

  chain: VectorDBQAChain;

  constructor(name: string, description: string, fields: VectorStoreTool) {
    super();
    this.name = name;
    this.description = description;
    this.vectorStore = fields.vectorStore;
    this.llm = fields.llm;
    this.chain = VectorDBQAChain.fromLLM(this.llm, this.vectorStore);
  }

  static getDescription(name: string, description: string): string {
    return `Useful for when you need to answer questions about ${name}. Whenever you need information about ${description} you should ALWAYS use this. Input should be a fully formed question.`;
  }

  async call(input: string) {
    return this.chain.run(input);
  }
}
