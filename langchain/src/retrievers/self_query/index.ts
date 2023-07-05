import { LLMChain } from "../../chains/llm_chain.js";
import {
  QueryConstructorChainOptions,
  loadQueryConstructorChain,
} from "../../chains/query_constructor/index.js";
import { StructuredQuery } from "../../chains/query_constructor/ir.js";
import { Document } from "../../document.js";
import { BaseRetriever } from "../../schema/retriever.js";
import { VectorStore } from "../../vectorstores/base.js";
import { FunctionalTranslator } from "./functional.js";
import { BaseTranslator, BasicTranslator } from "./base.js";
import { Callbacks } from "../../callbacks/manager.js";

export { BaseTranslator, BasicTranslator, FunctionalTranslator };

export type SelfQueryRetrieverArgs = {
  vectorStore: VectorStore;
  structuredQueryTranslator: BaseTranslator;
  llmChain: LLMChain;
  verbose?: boolean;
  searchParams?: {
    k?: number;
    filter?: VectorStore["FilterType"];
  };
};
export class SelfQueryRetriever
  extends BaseRetriever
  implements SelfQueryRetrieverArgs
{
  vectorStore: VectorStore;

  llmChain: LLMChain;

  verbose?: boolean;

  structuredQueryTranslator: BaseTranslator;

  searchParams?: {
    k?: number;
    filter?: VectorStore["FilterType"];
  } = { k: 4 };

  constructor(options: SelfQueryRetrieverArgs) {
    super();
    this.vectorStore = options.vectorStore;
    this.llmChain = options.llmChain;
    this.verbose = options.verbose ?? false;
    this.searchParams = options.searchParams ?? this.searchParams;

    this.structuredQueryTranslator = options.structuredQueryTranslator;
  }

  async getRelevantDocuments(
    query: string,
    callbacks?: Callbacks
  ): Promise<Document<Record<string, unknown>>[]> {
    const { [this.llmChain.outputKey]: output } = await this.llmChain.call({
      [this.llmChain.inputKeys[0]]: query,
    });

    const nextArg = this.structuredQueryTranslator.visitStructuredQuery(
      output as StructuredQuery
    );

    if (nextArg.filter) {
      return this.vectorStore.similaritySearch(
        query,
        this.searchParams?.k,
        nextArg.filter,
        callbacks
      );
    } else {
      return this.vectorStore.similaritySearch(
        query,
        this.searchParams?.k,
        this.searchParams?.filter,
        callbacks
      );
    }
  }

  static fromLLM(
    options: QueryConstructorChainOptions &
      Omit<SelfQueryRetrieverArgs, "llmChain">
  ): SelfQueryRetriever {
    const {
      structuredQueryTranslator,
      allowedComparators,
      allowedOperators,
      llm,
      documentContents,
      attributeInfo,
      examples,
      vectorStore,
      ...rest
    } = options;
    const llmChain = loadQueryConstructorChain({
      llm,
      documentContents,
      attributeInfo,
      examples,
      allowedComparators:
        allowedComparators ?? structuredQueryTranslator.allowedComparators,
      allowedOperators:
        allowedOperators ?? structuredQueryTranslator.allowedOperators,
    });
    return new SelfQueryRetriever({
      ...rest,
      llmChain,
      vectorStore,
      structuredQueryTranslator,
    });
  }
}
