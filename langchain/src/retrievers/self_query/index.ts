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

/**
 * Interface for the arguments required to create a SelfQueryRetriever
 * instance. It extends the BaseRetrieverInput interface.
 */
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
    forceDefaultFilter?: boolean;
  };
}

/**
 * Class for question answering over an index. It retrieves relevant
 * documents based on a query. It extends the BaseRetriever class and
 * implements the SelfQueryRetrieverArgs interface.
 * @example
 * ```typescript
 * const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
 *   llm: new ChatOpenAI(),
 *   vectorStore: await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings()),
 *   documentContents: "Brief summary of a movie",
 *   attributeInfo: attributeInfo,
 *   structuredQueryTranslator: new FunctionalTranslator(),
 * });
 * const relevantDocuments = await selfQueryRetriever.getRelevantDocuments(
 *   "Which movies are directed by Greta Gerwig?",
 * );
 * ```
 */
export class SelfQueryRetriever<T extends VectorStore>
  extends BaseRetriever
  implements SelfQueryRetrieverArgs<T>
{
  static lc_name() {
    return "SelfQueryRetriever";
  }

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
    forceDefaultFilter?: boolean;
  } = { k: 4, forceDefaultFilter: false };

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
      this.searchParams?.mergeFiltersOperator,
      this.searchParams?.forceDefaultFilter
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

  /**
   * Static method to create a new SelfQueryRetriever instance from a
   * BaseLanguageModel and a VectorStore. It first loads a query constructor
   * chain using the loadQueryConstructorChain function, then creates a new
   * SelfQueryRetriever instance with the loaded chain and the provided
   * options.
   * @param options The options used to create the SelfQueryRetriever instance. It includes the QueryConstructorChainOptions and all the SelfQueryRetrieverArgs except 'llmChain'.
   * @returns A new instance of SelfQueryRetriever.
   */
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
