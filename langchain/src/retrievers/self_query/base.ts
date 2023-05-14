import { LLMChain } from "../../chains/llm_chain.js";
import {
  QueryConstructorChainOptions,
  loadQueryContstructorChain,
} from "../../chains/query_constructor/base.js";
import { StructuredQuery, Visitor } from "../../chains/query_constructor/ir.js";
import { Document } from "../../document.js";
import { BaseRetriever } from "../../schema/index.js";
import { VectorStore } from "../../vectorstores/base.js";
import { PineconeStore } from "../../vectorstores/pinecone.js";
import { PineconeTranslator } from "./pinecone.js";

export const BUILTIN_TRANSLATORS = /* #__PURE__ */ new Map<
  typeof VectorStore,
  new () => Visitor
>([[PineconeStore, PineconeTranslator]]);

function _getBuiltinTranslator(vectorStore: typeof VectorStore): Visitor {
  const Translator = BUILTIN_TRANSLATORS.get(vectorStore);
  if (Translator === undefined) {
    throw new Error(`No translator for ${vectorStore.name}`);
  }
  return new Translator();
}
export type SelfQueryRetrieverArgs = {
  vectorStore: VectorStore;
  llmChain: LLMChain;
  structuredQueryTranslator: Visitor;
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

  structuredQueryTranslator: Visitor;

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

    this.structuredQueryTranslator = _getBuiltinTranslator(
      options.vectorStore.constructor as typeof VectorStore
    );
  }

  async getRelevantDocuments(
    query: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Document<Record<string, any>>[]> {
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
        nextArg.filter
      );
    } else {
      return this.vectorStore.similaritySearch(
        query,
        this.searchParams?.k,
        this.searchParams?.filter
      );
    }
  }

  static fromLLM(
    opts: QueryConstructorChainOptions & {
      vectorStore: VectorStore;
      structuredQueryTranslator?: Visitor;
    }
  ): SelfQueryRetriever {
    const structuredQueryTranslator =
      opts.structuredQueryTranslator ??
      _getBuiltinTranslator(opts.vectorStore.constructor as typeof VectorStore);
    const allowedComparators =
      opts.allowedComparators ?? structuredQueryTranslator.allowedComparators;
    const allowedOperators =
      opts.allowedOperators ?? structuredQueryTranslator.allowedOperators;

    const llmChain = loadQueryContstructorChain({
      llm: opts.llm,
      documentContents: opts.documentContents,
      attributeInfo: opts.attributeInfo,
      examples: opts.examples,
      allowedComparators,
      allowedOperators,
    });

    return new SelfQueryRetriever({
      vectorStore: opts.vectorStore,
      llmChain,
      structuredQueryTranslator,
    });
  }
}
