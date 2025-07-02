import { RunnableInterface } from "@langchain/core/runnables";
import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { VectorStore } from "@langchain/core/vectorstores";
import {
  BaseTranslator,
  BasicTranslator,
  FunctionalTranslator,
  StructuredQuery,
} from "@langchain/core/structured_query";
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import {
  loadQueryConstructorRunnable,
  QueryConstructorRunnableOptions,
} from "../../chains/query_constructor/index.js";

export { BaseTranslator, BasicTranslator, FunctionalTranslator };

/**
 * Interface for the arguments required to create a SelfQueryRetriever
 * instance. It extends the BaseRetrieverInput interface.
 */
export interface SelfQueryRetrieverArgs<T extends VectorStore>
  extends BaseRetrieverInput {
  vectorStore: T;
  structuredQueryTranslator: BaseTranslator<T>;
  queryConstructor: RunnableInterface<{ query: string }, StructuredQuery>;
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
 * const selfQueryRetriever = SelfQueryRetriever.fromLLM({
 *   llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
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

  queryConstructor: RunnableInterface<{ query: string }, StructuredQuery>;

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
    this.queryConstructor = options.queryConstructor;
    this.verbose = options.verbose ?? false;
    this.searchParams = options.searchParams ?? this.searchParams;
    this.useOriginalQuery = options.useOriginalQuery ?? this.useOriginalQuery;
    this.structuredQueryTranslator = options.structuredQueryTranslator;
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document<Record<string, unknown>>[]> {
    const generatedStructuredQuery = await this.queryConstructor.invoke(
      { query },
      {
        callbacks: runManager?.getChild("query_constructor"),
        runName: "query_constructor",
      }
    );

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

    return this.vectorStore
      .asRetriever({
        k: this.searchParams?.k,
        filter,
      })
      .invoke(myQuery, { callbacks: runManager?.getChild("retriever") });
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
    options: QueryConstructorRunnableOptions &
      Omit<SelfQueryRetrieverArgs<T>, "queryConstructor">
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
    const queryConstructor = loadQueryConstructorRunnable({
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
      queryConstructor,
      vectorStore,
      structuredQueryTranslator,
    });
  }
}
