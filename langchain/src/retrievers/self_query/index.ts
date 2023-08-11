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

export interface SelfQueryRetrieverArgs extends BaseRetrieverInput {
  vectorStore: VectorStore;
  structuredQueryTranslator: BaseTranslator;
  llmChain: LLMChain;
  verbose?: boolean;
  useOriginalQuery?: boolean;
  searchParams?: {
    k?: number;
    filter?: VectorStore["FilterType"];
  };
}

function isObject(obj: any): obj is object {
  return (
    obj &&
    typeof obj === "object" &&
    !Array.isArray(obj) &&
    obj.constructor.name === "Object"
  );
}

function isFilterEmpty(
  filter: ((q: any) => any) | object | string | undefined
): filter is undefined {
  if (!filter) return true;
  // for Milvus
  if (typeof filter === "string" && filter.length > 0) {
    return false;
  }
  if (typeof filter === "function") {
    return false;
  }
  return (
    typeof filter === "object" &&
    filter.constructor.name === "Object" &&
    Object.keys(filter).length === 0
  );
}

function mergeFilters<
  T extends ((q: any) => any) | object | string | undefined
>(a: T, b: T): ((q: any) => any) | object | string | undefined {
  if (isFilterEmpty(a) && isFilterEmpty(b)) {
    return undefined;
  }
  if (isFilterEmpty(a)) {
    return b;
  }
  if (isFilterEmpty(b)) {
    return a;
  }

  /**
   * This is for Milvus, which uses string
   * metadata filtering. We don't have
   * milvus self-query retriever (yet?), but
   * users could build their own Milvus query
   * translator and imo I think it might be a good
   * idea to have it to be able to return string
   * filter.
   *
   * btw, since FilterType declaration includes
   * string (which is required for Milvus),
   * typescript will throw an error if
   * we don't include this case.
   */
  if (typeof a === "string" && typeof b === "string") {
    return `(${a}) && (${b})`;
  }

  if (typeof a === "function" && typeof b === "function") {
    return (q: any) => {
      // For functional filter (e.g. HNSWLib, memory, etc)
      if (isObject(q)) {
        return a(q) && b(q);
      }

      // For SupabaseFilterRPCCall
      if (q.filter && typeof q.filter === "function") {
        return b(a(q));
      }
      throw new Error("Unknown filter type");
    };
  }

  if (isObject(a) && isObject(b)) {
    return { ...a, ...b };
  }

  throw new Error("Filter types mismatch");
}

export class SelfQueryRetriever
  extends BaseRetriever
  implements SelfQueryRetrieverArgs
{
  get lc_namespace() {
    return ["langchain", "retrievers", "self_query"];
  }

  vectorStore: VectorStore;

  llmChain: LLMChain;

  verbose?: boolean;

  structuredQueryTranslator: BaseTranslator;

  useOriginalQuery = false;

  searchParams?: {
    k?: number;
    filter?: VectorStore["FilterType"];
  } = { k: 4 };

  constructor(options: SelfQueryRetrieverArgs) {
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

    const filter = mergeFilters(this.searchParams?.filter, nextArg.filter);

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
