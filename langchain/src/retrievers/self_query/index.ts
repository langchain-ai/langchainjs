/* eslint-disable @typescript-eslint/no-explicit-any */
import { LLMChain } from "../../chains/llm_chain.js";
import {
  QueryConstructorChainOptions,
  loadQueryConstructorChain,
} from "../../chains/query_constructor/index.js";
import { StructuredQuery } from "../../chains/query_constructor/ir.js";
import { Document } from "../../document.js";
import { BaseRetriever, BaseRetrieverInput } from "../../schema/retriever.js";
import { VectorStore } from "../../vectorstores/base.js";
import { FunctionalTranslator } from "./functional.js";
import { BaseTranslator, BasicTranslator } from "./base.js";
import { CallbackManagerForRetrieverRun } from "../../callbacks/manager.js";

export { BaseTranslator, BasicTranslator, FunctionalTranslator };

export interface SelfQueryRetrieverArgs<T extends VectorStore>
  extends BaseRetrieverInput {
  vectorStore: T;
  structuredQueryTranslator: BaseTranslator<T>;
  llmChain: LLMChain;
  verbose?: boolean;
  useOriginalQuery?: boolean;
  searchParams?: {
    k?: number;
    filter?: T["FilterType"];
    mergeFiltersOperator?: "or" | "and" | "replace";
  };
}

export class SelfQueryRetriever<T extends VectorStore>
  extends BaseRetriever
  implements SelfQueryRetrieverArgs<T>
{
  get lc_namespace() {
    return ["langchain", "retrievers", "self_query"];
  }

  vectorStore: T;

  llmChain: LLMChain;

  verbose?: boolean;

  structuredQueryTranslator: BaseTranslator<T>;

  useOriginalQuery = false;

  searchParams?: {
    k?: number;
    filter?: T["FilterType"];
    mergeFiltersOperator?: "or" | "and" | "replace";
  } = { k: 4 };

  constructor(options: SelfQueryRetrieverArgs<T>) {
    super(options);
    this.vectorStore = options.vectorStore;
    this.llmChain = options.llmChain;
    this.verbose = options.verbose ?? false;
    this.searchParams = options.searchParams ?? this.searchParams;
    this.useOriginalQuery = options.useOriginalQuery ?? this.useOriginalQuery;
    this.structuredQueryTranslator = options.structuredQueryTranslator;
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document<Record<string, unknown>>[]> {
    const { [this.llmChain.outputKey]: output } = await this.llmChain.call(
      {
        [this.llmChain.inputKeys[0]]: query,
      },
      runManager?.getChild("llm_chain")
    );

    const generatedStructuredQuery = output as StructuredQuery;

    const nextArg = this.structuredQueryTranslator.visitStructuredQuery(
      generatedStructuredQuery
    );

    const filter = this.structuredQueryTranslator.mergeFilters(
      this.searchParams?.filter,
      nextArg.filter,
      this.searchParams?.mergeFiltersOperator
    );

    const generatedQuery = generatedStructuredQuery.query;
    let myQuery = query;

    if (!this.useOriginalQuery && generatedQuery && generatedQuery.length > 0) {
      myQuery = generatedQuery;
    }

    if (!filter) {
      return [];
    } else {
      return this.vectorStore.similaritySearch(
        myQuery,
        this.searchParams?.k,
        filter,
        runManager?.getChild("vectorstore")
      );
    }
  }

  static fromLLM<T extends VectorStore>(
    options: QueryConstructorChainOptions &
      Omit<SelfQueryRetrieverArgs<T>, "llmChain">
  ): SelfQueryRetriever<T> {
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
    return new SelfQueryRetriever<T>({
      ...rest,
      llmChain,
      vectorStore,
      structuredQueryTranslator,
    });
  }
}
